/**
 * driveDocumentParsers — Phase 4.14.
 *
 * Pure parsers for the five trade-document formats the AI assistant
 * ingests via Drive: xlsx, xls, docx, pdf, rtf. Each parser is
 * stateless, takes a Buffer + a small options object, and returns a
 * string payload formatted for AI consumption.
 *
 * Why a shared module instead of inlining into the MCP handler:
 *   - Phase 4.14.1 will mirror these parsers in the Cowork sovern MCP
 *     server. Sharing the contract here makes the future port a
 *     copy-paste rather than a rewrite-from-scratch.
 *   - Tests can exercise the parsers directly with synthetic fixtures
 *     (no Drive auth required).
 *   - Failure paths (legacy .doc, image-only PDF, encrypted PDF,
 *     oversized output) live in one place with one message contract.
 *
 * Phase 4.14 design decisions captured here:
 *   - xlsx formula handling: computed values by default; opt-in
 *     raw_formulas:true switches to formula source. Factory quotes
 *     overwhelmingly need the resolved number, not the formula text.
 *     If the cached value is stale (Excel didn't recalc on save) the
 *     parser shows the stale value — same as what the file's author
 *     last saw. SheetJS can't tell you the cache is stale.
 *   - pdf page markers: every page wrapped in `=== Page N ===` so the
 *     AI can answer "what's on page 3 of the contract" without rerolling.
 *   - docx max_pages: heuristic via 3000 chars/page (typical contract
 *     font size). mammoth has no hard page concept.
 *   - 200KB output hard cap with explicit truncation marker. The cap
 *     keeps AI context manageable; the marker tells the caller exactly
 *     which narrowing parameter to use.
 */

const xlsx = require('xlsx');
const mammoth = require('mammoth');
// pdf-parse's main entry executes a test PDF at import time when no
// argument is passed. The inner module path skips that — see commit
// history on read_attachment for the original write-up.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const RtfParser = require('rtf-parser');

const HARD_OUTPUT_CAP_BYTES = 200 * 1024;   // 200KB — keeps AI context manageable
const SOFT_INPUT_CAP_BYTES = 25 * 1024 * 1024;  // 25MB — refuse before we even download
const DOCX_CHARS_PER_PAGE_HEURISTIC = 3000; // typical contract font density

const TRUNCATE_MARKER = '\n\n[TRUNCATED at 200KB. Use sheet_name / row_range / column_range / page_range / max_pages parameters to narrow the response.]';

class ParserError extends Error {
  constructor(message, { code = 'parser_error', userMessage } = {}) {
    super(message);
    this.code = code;
    this.userMessage = userMessage || message;
  }
}

function assertInputSize(buffer, name) {
  if (!buffer || typeof buffer.length !== 'number') {
    throw new ParserError('parser received non-Buffer input', { code: 'invalid_input' });
  }
  if (buffer.length > SOFT_INPUT_CAP_BYTES) {
    const mb = (buffer.length / 1024 / 1024).toFixed(1);
    throw new ParserError(`File "${name}" is ${mb}MB — exceeds the 25MB Phase 4.14 ingestion cap. Narrow the request (sheet_name, row_range, page_range) or split the file.`, { code: 'file_too_large' });
  }
}

function applyOutputCap(text) {
  const byteLen = Buffer.byteLength(text, 'utf8');
  if (byteLen <= HARD_OUTPUT_CAP_BYTES) return text;
  // Walk back to a char boundary that fits the byte cap. Simple slice
  // truncates by char count; byteLength may differ for multi-byte UTF-8.
  let lo = 0;
  let hi = text.length;
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (Buffer.byteLength(text.slice(0, mid), 'utf8') <= HARD_OUTPUT_CAP_BYTES - TRUNCATE_MARKER.length) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, best) + TRUNCATE_MARKER;
}

// ── Range parsing helpers ────────────────────────────────────────────

// Convert an Excel column letter (A, B, …, Z, AA, AB, …) to a 0-indexed number.
function colLetterToIndex(letter) {
  const s = String(letter || '').toUpperCase().trim();
  if (!/^[A-Z]+$/.test(s)) {
    throw new ParserError(`Invalid column letter "${letter}" (expected A-Z, AA-ZZ, etc.)`, { code: 'invalid_range' });
  }
  let n = 0;
  for (const ch of s) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

function parseRowRange(rowRange) {
  if (!rowRange) return null;
  if (!Array.isArray(rowRange) || rowRange.length !== 2) {
    throw new ParserError('row_range must be a [startRow, endRow] tuple (1-indexed, inclusive).', { code: 'invalid_range' });
  }
  const [start, end] = rowRange.map(n => Number(n));
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    throw new ParserError(`row_range ${JSON.stringify(rowRange)} must be a [start,end] tuple with 1 <= start <= end.`, { code: 'invalid_range' });
  }
  return { startRow: start - 1, endRow: end - 1 };  // convert to 0-indexed inclusive
}

function parseColumnRange(columnRange) {
  if (!columnRange) return null;
  if (!Array.isArray(columnRange) || columnRange.length !== 2) {
    throw new ParserError('column_range must be a [startCol, endCol] tuple of letters.', { code: 'invalid_range' });
  }
  const startIdx = colLetterToIndex(columnRange[0]);
  const endIdx = colLetterToIndex(columnRange[1]);
  if (endIdx < startIdx) {
    throw new ParserError(`column_range end "${columnRange[1]}" comes before start "${columnRange[0]}".`, { code: 'invalid_range' });
  }
  return { startCol: startIdx, endCol: endIdx };
}

function parsePageRange(pageRange) {
  if (!pageRange) return null;
  if (!Array.isArray(pageRange) || pageRange.length !== 2) {
    throw new ParserError('page_range must be a [startPage, endPage] tuple (1-indexed, inclusive).', { code: 'invalid_range' });
  }
  const [start, end] = pageRange.map(n => Number(n));
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    throw new ParserError(`page_range ${JSON.stringify(pageRange)} must be a [start,end] tuple with 1 <= start <= end.`, { code: 'invalid_range' });
  }
  return { startPage: start, endPage: end };
}

// ── xlsx / xls ────────────────────────────────────────────────────────

async function parseXlsx(buffer, { name, sheet_name = null, row_range = null, column_range = null, raw_formulas = false } = {}) {
  assertInputSize(buffer, name);
  const wb = xlsx.read(buffer, { type: 'buffer', cellFormula: !!raw_formulas, cellText: true });

  let targetSheets = wb.SheetNames;
  if (sheet_name) {
    const wanted = String(sheet_name).toLowerCase();
    targetSheets = wb.SheetNames.filter(n => n.toLowerCase() === wanted);
    if (!targetSheets.length) {
      throw new ParserError(`Sheet "${sheet_name}" not found. Available: ${wb.SheetNames.join(', ')}`, { code: 'sheet_not_found' });
    }
  }

  const rowSel = parseRowRange(row_range);
  const colSel = parseColumnRange(column_range);

  const blocks = [];
  for (const sheetName of targetSheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const ref = ws['!ref'];
    if (!ref) {
      blocks.push(`=== Sheet: ${sheetName} (empty) ===\n`);
      continue;
    }
    const range = xlsx.utils.decode_range(ref);
    const start = {
      r: rowSel ? Math.max(range.s.r, rowSel.startRow) : range.s.r,
      c: colSel ? Math.max(range.s.c, colSel.startCol) : range.s.c,
    };
    const end = {
      r: rowSel ? Math.min(range.e.r, rowSel.endRow) : range.e.r,
      c: colSel ? Math.min(range.e.c, colSel.endCol) : range.e.c,
    };
    if (end.r < start.r || end.c < start.c) {
      blocks.push(`=== Sheet: ${sheetName} (0 rows × 0 cols after range filter) ===\n`);
      continue;
    }

    // L-049: SheetJS sheet_to_csv silently ignores its `range` option.
    // The narrowed-string is built and passed but the full sheet is
    // emitted. We walk cells ourselves to get reliable row/column
    // narrowing AND consistent behaviour between the computed-value
    // and raw_formulas modes (both code paths now share one helper).
    const body = csvForRange(ws, start, end, { rawFormulas: !!raw_formulas });
    const rowCount = end.r - start.r + 1;
    const colCount = end.c - start.c + 1;
    blocks.push(`=== Sheet: ${sheetName} (${rowCount} rows × ${colCount} cols) ===\n${body.trimEnd()}\n`);
  }

  return applyOutputCap(blocks.join('\n'));
}

// Walk cells in the given 0-indexed inclusive range, emit a CSV. When
// rawFormulas is true and a cell has a formula, emit `=<formula>`;
// otherwise emit the cell's formatted text (cell.w) — that's SheetJS's
// pre-rendered computed value (the cached display string Excel would
// show), which matches what factory-quote consumers expect.
function csvForRange(ws, start, end, { rawFormulas = false } = {}) {
  const lines = [];
  for (let r = start.r; r <= end.r; r++) {
    const cells = [];
    for (let c = start.c; c <= end.c; c++) {
      const addr = xlsx.utils.encode_cell({ r, c });
      const cell = ws[addr];
      let value = '';
      if (cell) {
        if (rawFormulas && cell.f) {
          value = '=' + cell.f;
        } else if (cell.w != null) {
          value = String(cell.w);
        } else if (cell.v != null) {
          value = String(cell.v);
        }
      }
      if (/[",\n\r]/.test(value)) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      cells.push(value);
    }
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

// ── docx ──────────────────────────────────────────────────────────────

async function parseDocx(buffer, { name, max_pages = null } = {}) {
  assertInputSize(buffer, name);
  const result = await mammoth.extractRawText({ buffer });
  let text = (result.value || '').trim();

  let truncationNote = '';
  if (max_pages != null) {
    const pages = Number(max_pages);
    if (!Number.isInteger(pages) || pages < 1) {
      throw new ParserError('max_pages must be a positive integer.', { code: 'invalid_range' });
    }
    const cap = pages * DOCX_CHARS_PER_PAGE_HEURISTIC;
    if (text.length > cap) {
      const approxTotalPages = Math.ceil(text.length / DOCX_CHARS_PER_PAGE_HEURISTIC);
      text = text.slice(0, cap);
      truncationNote = `\n\n[TRUNCATED — full document is ~${approxTotalPages} pages, requested first ${pages} (heuristic: ${DOCX_CHARS_PER_PAGE_HEURISTIC} chars/page).]`;
    }
  }
  return applyOutputCap(text + truncationNote);
}

function legacyDocGuidance(name) {
  return `Legacy .doc format (pre-2007 Word) is not supported in Phase 4.14. File: "${name}".

To make this file readable:
  (a) Open in Microsoft Word and re-save as .docx, then re-upload.
  (b) Right-click the file in Google Drive and choose "Open with Google Docs" — Drive auto-converts and the resulting Google Doc is readable via this tool.

Phase 4.14 deferred legacy .doc parsing because the open-source libraries (antword, libreoffice-headless) have heavy install footprints. If .doc files become common in your workflow, file a follow-up phase.`;
}

// ── pdf ───────────────────────────────────────────────────────────────

/**
 * Phase 4.15-followup: parsePdfRaw is the shared low-level entry point.
 *
 * Both parsePdf (which formats the output with === Page N === markers
 * for the MCP read_drive_file tool) AND erpToolServer's legacy
 * read_attachment tool now route through this helper. Before extraction,
 * the L-048 Uint8Array wrap lived in two places — read_attachment hit
 * the same bad-XRef-entry bug on Node 22 and needed a separate fix
 * (commit 3676445). One canonical implementation prevents the next
 * caller from forgetting the wrap.
 *
 * Returns:
 *   { numpages, fullText, rawPages, info, metadata }
 *
 * - numpages: integer page count from pdf-parse.
 * - fullText: trimmed concatenation of every page's text.
 * - rawPages: per-page text, split by the form-feed delimiter our
 *   pagerender emits. Trailing empty pages stripped.
 * - info / metadata: pdf-parse's raw author / title / creator dictionaries
 *   (may be empty objects when the PDF has no metadata).
 *
 * Throws ParserError with codes:
 *   - 'pdf_encrypted'   — password-protected PDF
 *   - 'pdf_image_only'  — <100 chars extracted (OCR-needed scan)
 *   - 'pdf_parse_error' — anything else
 */
async function parsePdfRaw(buffer, { name = 'document.pdf' } = {}) {
  let parsed;
  try {
    // L-048: pdf-parse 1.1.4 + Node 22 throws "bad XRef entry" when fed
    // a Node Buffer for many otherwise-valid PDFs (pdfjs 1.10 internal
    // typing mismatch). Wrapping as Uint8Array sidesteps the bug.
    // Centralised here so every caller inherits the fix automatically.
    const u8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    parsed = await pdfParse(u8, {
      // pagerender lets us collect per-page text individually. Without
      // it pdf-parse concatenates the whole document into one string.
      pagerender: defaultPdfPageRender,
    });
  } catch (err) {
    if (/encrypt/i.test(err.message)) {
      throw new ParserError(`PDF "${name}" is encrypted/password-protected. Phase 4.14 cannot read encrypted PDFs. Remove the password protection and re-upload, or share the unprotected version.`, { code: 'pdf_encrypted' });
    }
    throw new ParserError(`PDF parse failed for "${name}": ${err.message}`, { code: 'pdf_parse_error' });
  }

  const numpages = parsed.numpages || 0;
  const fullText = (parsed.text || '').trim();

  // OCR detection: image-only PDFs return near-empty text. The threshold
  // is intentionally low (<100 chars across the entire document) to
  // catch the obvious cases without false-flagging short text PDFs.
  if (fullText.length < 100) {
    throw new ParserError(
      `PDF "${name}" appears to be image-based (scanned) and contains no extractable text. OCR is not yet supported. Phase 4.14 covers text-based PDFs only — OCR support is planned for a future phase. As a workaround, you may convert this PDF to a text-based PDF via OCR.space, Adobe Acrobat, or Google Drive's "Open with Google Docs" (which performs OCR on image PDFs).`,
      { code: 'pdf_image_only' },
    );
  }

  // Walk the per-page split. pdfParse with our pagerender emits a
  // form-feed (\f) delimiter between pages. Falls back to a single-page
  // emission if the delimiter isn't present.
  const rawPages = parsed.text.split(/\f/);
  // Trim trailing empty page that some PDFs produce.
  while (rawPages.length && !rawPages[rawPages.length - 1].trim()) rawPages.pop();

  return {
    numpages,
    fullText,
    rawPages,
    info: parsed.info || {},
    metadata: parsed.metadata || {},
  };
}

async function parsePdf(buffer, { name, page_range = null } = {}) {
  assertInputSize(buffer, name);
  const pageSel = parsePageRange(page_range);

  const { numpages, rawPages } = await parsePdfRaw(buffer, { name });

  const startPage = pageSel ? pageSel.startPage : 1;
  const endPage = pageSel ? Math.min(pageSel.endPage, rawPages.length) : rawPages.length;
  if (startPage > rawPages.length) {
    throw new ParserError(`page_range start ${startPage} exceeds document length (${rawPages.length} pages).`, { code: 'invalid_range' });
  }

  const blocks = [`=== PDF: ${name} (${numpages} pages) ===`];
  for (let i = startPage; i <= endPage; i++) {
    const pageText = (rawPages[i - 1] || '').trim();
    blocks.push(`=== Page ${i} ===\n${pageText}`);
  }
  if (pageSel && endPage < rawPages.length) {
    blocks.push(`\n[Showing pages ${startPage}-${endPage} of ${rawPages.length}. Use page_range to fetch more.]`);
  }
  return applyOutputCap(blocks.join('\n\n'));
}

// pdf-parse's default pagerender returns concatenated page strings.
// Adding a form-feed lets us split per page in the caller.
function defaultPdfPageRender(pageData) {
  return pageData.getTextContent().then(content => {
    let lastY;
    const strings = [];
    for (const item of content.items) {
      if (lastY === item.transform[5] || lastY == null) {
        strings.push(item.str);
      } else {
        strings.push('\n' + item.str);
      }
      lastY = item.transform[5];
    }
    return strings.join('') + '\f';
  });
}

// ── rtf ───────────────────────────────────────────────────────────────

function parseRtf(buffer, { name } = {}) {
  assertInputSize(buffer, name);
  return new Promise((resolve, reject) => {
    RtfParser.string(buffer.toString('utf8'), (err, doc) => {
      if (err) return reject(new ParserError(`RTF parse failed for "${name}": ${err.message}`, { code: 'rtf_parse_error' }));
      // rtf-parser yields a paragraph tree. Walk it, joining text with
      // paragraph breaks.
      const parts = [];
      for (const para of doc.content || []) {
        if (!para || !para.content) continue;
        const paraText = para.content.map(span => (span && span.value) || '').join('');
        parts.push(paraText);
      }
      resolve(applyOutputCap(parts.join('\n\n').trim()));
    });
  });
}

// ── Mime dispatcher ───────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = new Set([
  // xlsx / xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  // docx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // pdf
  'application/pdf',
  // rtf
  'application/rtf',
  'text/rtf',
]);

const LEGACY_DOC_MIME = 'application/msword';

function isSupported(mimeType) {
  return SUPPORTED_MIME_TYPES.has(mimeType);
}

async function parseByMime(buffer, mimeType, { name, ...opts } = {}) {
  switch (mimeType) {
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.ms-excel':
      return parseXlsx(buffer, { name, ...opts });
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return parseDocx(buffer, { name, ...opts });
    case 'application/pdf':
      return parsePdf(buffer, { name, ...opts });
    case 'application/rtf':
    case 'text/rtf':
      return parseRtf(buffer, { name, ...opts });
    case LEGACY_DOC_MIME:
      throw new ParserError(legacyDocGuidance(name), { code: 'legacy_doc_unsupported' });
    default:
      throw new ParserError(`Unsupported mime type for Phase 4.14 parser: ${mimeType}`, { code: 'unsupported_mime' });
  }
}

module.exports = {
  parseXlsx,
  parseDocx,
  parsePdf,
  parsePdfRaw,
  parseRtf,
  parseByMime,
  isSupported,
  legacyDocGuidance,
  applyOutputCap,
  SUPPORTED_MIME_TYPES,
  LEGACY_DOC_MIME,
  ParserError,
  HARD_OUTPUT_CAP_BYTES,
  SOFT_INPUT_CAP_BYTES,
  DOCX_CHARS_PER_PAGE_HEURISTIC,
};
