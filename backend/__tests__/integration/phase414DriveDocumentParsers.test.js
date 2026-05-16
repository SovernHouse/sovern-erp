// Phase 4.14 — Drive document parser tests.
//
// Strategy: every fixture is generated programmatically at test time.
// CI runs offline with zero Drive auth, zero committed binary fixtures.
// Real-Drive fixtures live in a separate prod-smoke file that runs only
// when DRIVE_SMOKE_FIXTURES=true is set.
//
// Coverage per the spec acceptance criteria:
//   - All five formats (xlsx, xls, docx, pdf, rtf) parse cleanly
//   - Optional params narrow output as documented
//   - 200KB output hard cap with the right truncation marker
//   - 25MB input soft cap rejects with a helpful message
//   - Negative cases: legacy .doc, image-only PDF, invalid range params,
//     unknown sheet name
//   - raw_formulas opt-in flag (computed values default per L-048)

const xlsx = require('xlsx');
const JSZip = require('jszip');

const parsers = require('../../services/driveDocumentParsers');

// ── Fixture builders (inline, no committed binaries) ─────────────────

function makeXlsxFixture({ withFormulas = false } = {}) {
  const wb = xlsx.utils.book_new();

  const quoteData = [
    ['Sovern House — IronLite Quote'],
    ['Factory: HanHua'],
    ['Date: 2026-05-16'],
    ['Incoterm: FOB Shanghai'],
    [],
    [],
    ['SKU', 'Description', 'Thickness', 'Origin', 'MOQ', 'Cost/m²', 'Sell/m²'],
    ['IL-SPC-4MM', 'SPC 4mm click-lock',  '4mm',  'CN', 1000, 12.50, 25.50],
    ['IL-SPC-5MM', 'SPC 5mm click-lock',  '5mm',  'CN', 1000, 14.75, 28.90],
    ['IL-SPC-6MM', 'SPC 6mm click-lock',  '6mm',  'CN', 1000, 16.20, 31.40],
    ['IL-LVT-2MM', 'LVT 2mm glue-down',   '2mm',  'CN', 1000,  9.80, 19.90],
    ['IL-LVT-3MM', 'LVT 3mm glue-down',   '3mm',  'CN', 1000, 11.40, 23.10],
    ['IL-WPC-5MM', 'WPC 5mm click-lock',  '5mm',  'CN', 1000, 13.60, 27.50],
    ['IL-WPC-6MM', 'WPC 6mm click-lock',  '6mm',  'CN', 1000, 15.30, 30.40],
    ['IL-VS-2MM',  'Vinyl Sheet 2mm',     '2mm',  'CN', 1000,  5.80, 11.90],
    ['IL-EW-12MM', 'Engineered Wood 12mm','12mm', 'CN', 1000, 22.40, 44.80],
  ];
  const ws1 = xlsx.utils.aoa_to_sheet(quoteData);
  xlsx.utils.book_append_sheet(wb, ws1, 'Quote');

  const summaryData = [
    ['Total SKUs', 9],
    ['Avg cost/m²', withFormulas ? { f: 'AVERAGE(Quote!F8:F16)', v: 13.5 } : 13.5],
    ['Avg sell/m²', withFormulas ? { f: 'AVERAGE(Quote!G8:G16)', v: 27.0 } : 27.0],
  ];
  const ws2 = xlsx.utils.aoa_to_sheet(summaryData);
  xlsx.utils.book_append_sheet(wb, ws2, 'Summary');

  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Minimal valid .docx built via JSZip — just enough OOXML for mammoth.
async function makeDocxFixture(text = 'Phase 4.14 docx fixture text body.') {
  const zip = new JSZip();

  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '</Types>');

  zip.file('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '</Relationships>');

  zip.file('word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:body>' +
    '<w:p><w:r><w:t xml:space="preserve">' + escapeXml(text) + '</w:t></w:r></w:p>' +
    '</w:body>' +
    '</w:document>');

  return zip.generateAsync({ type: 'nodebuffer' });
}

function escapeXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// PDF fixtures built via pdfkit (devDep). Hand-building PDF bytes
// blows up against pdf-parse 1.1.4's xref parser in subtle ways
// (L-048); pdfkit's output is consistently parseable once the
// Buffer→Uint8Array wrap is in place inside parsePdf.
async function makePdfFixture(text = 'Phase 4.14 pdf fixture text content for the synthetic test suite. Long enough to clear the 100-char OCR-detection threshold so this counts as a text-based PDF rather than a scanned image.') {
  const PDFDoc = require('pdfkit');
  return new Promise((resolve) => {
    const doc = new PDFDoc();
    const bufs = [];
    doc.on('data', b => bufs.push(b));
    doc.on('end', () => resolve(Buffer.concat(bufs)));
    doc.fontSize(14).text(text);
    doc.end();
  });
}

async function makeImageOnlyPdfFixture() {
  // pdfkit page that draws a rectangle but never writes text. pdf-parse
  // returns near-zero characters → triggers the OCR-not-supported path.
  const PDFDoc = require('pdfkit');
  return new Promise((resolve) => {
    const doc = new PDFDoc();
    const bufs = [];
    doc.on('data', b => bufs.push(b));
    doc.on('end', () => resolve(Buffer.concat(bufs)));
    doc.rect(100, 100, 200, 200).fill('#808080');
    doc.end();
  });
}

function makeRtfFixture(paragraphs) {
  const body = paragraphs.map(p => `${p}\\par`).join('\n');
  return Buffer.from(`{\\rtf1\\ansi\\deff0 ${body}}`, 'utf8');
}

function makeLegacyDocFixture() {
  // The parser dispatcher branches on mime type alone; bytes don't
  // need to look like a real .doc to exercise the guidance error.
  return Buffer.from('legacy doc placeholder', 'utf8');
}

function makeOversizedFixture() {
  // 26MB buffer — exceeds the 25MB soft cap. Filled with spaces; size
  // alone is what triggers the cap, content is irrelevant.
  return Buffer.alloc(26 * 1024 * 1024, 0x20);
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Phase 4.14 — driveDocumentParsers', () => {
  describe('xlsx — Part A', () => {
    it('parses all sheets by default and includes sheet header markers', async () => {
      const buf = makeXlsxFixture();
      const out = await parsers.parseXlsx(buf, { name: 'quote.xlsx' });
      expect(out).toMatch(/=== Sheet: Quote/);
      expect(out).toMatch(/=== Sheet: Summary/);
      expect(out).toMatch(/IL-SPC-4MM/);
      expect(out).toMatch(/25\.5/);
    });

    it('honours sheet_name (case-insensitive)', async () => {
      const buf = makeXlsxFixture();
      const out = await parsers.parseXlsx(buf, { name: 'quote.xlsx', sheet_name: 'summary' });
      expect(out).toMatch(/=== Sheet: Summary/);
      expect(out).not.toMatch(/IL-SPC-4MM/);
    });

    it('throws sheet_not_found when sheet does not exist', async () => {
      const buf = makeXlsxFixture();
      await expect(parsers.parseXlsx(buf, { name: 'quote.xlsx', sheet_name: 'Nope' }))
        .rejects.toThrow(/not found/i);
    });

    it('row_range narrows to the requested 1-indexed rows', async () => {
      const buf = makeXlsxFixture();
      const out = await parsers.parseXlsx(buf, {
        name: 'quote.xlsx', sheet_name: 'Quote', row_range: [8, 10],
      });
      expect(out).toMatch(/IL-SPC-4MM/);
      expect(out).toMatch(/IL-SPC-6MM/);
      expect(out).not.toMatch(/IL-LVT-2MM/);
      expect(out).not.toMatch(/IronLite Quote/);
    });

    it('column_range narrows to the requested column letters', async () => {
      const buf = makeXlsxFixture();
      const out = await parsers.parseXlsx(buf, {
        name: 'quote.xlsx', sheet_name: 'Quote',
        row_range: [8, 8],
        column_range: ['A', 'B'],
      });
      expect(out).toMatch(/IL-SPC-4MM/);
      expect(out).toMatch(/SPC 4mm click-lock/);
      expect(out).not.toMatch(/25\.5/);
    });

    it('raw_formulas:false renders computed values (default)', async () => {
      const buf = makeXlsxFixture({ withFormulas: true });
      const out = await parsers.parseXlsx(buf, { name: 'quote.xlsx', sheet_name: 'Summary' });
      expect(out).toMatch(/13\.5/);
      expect(out).not.toMatch(/AVERAGE/);
    });

    it('raw_formulas:true renders formula source', async () => {
      const buf = makeXlsxFixture({ withFormulas: true });
      const out = await parsers.parseXlsx(buf, {
        name: 'quote.xlsx', sheet_name: 'Summary', raw_formulas: true,
      });
      expect(out).toMatch(/=AVERAGE\(Quote!F8:F16\)/);
    });

    it('rejects invalid row_range with a clear ParserError', async () => {
      const buf = makeXlsxFixture();
      await expect(parsers.parseXlsx(buf, { name: 'q.xlsx', row_range: [5] }))
        .rejects.toThrow(/row_range/i);
      await expect(parsers.parseXlsx(buf, { name: 'q.xlsx', row_range: [0, 5] }))
        .rejects.toThrow(/row_range/i);
      await expect(parsers.parseXlsx(buf, { name: 'q.xlsx', row_range: [10, 5] }))
        .rejects.toThrow(/row_range/i);
    });
  });

  describe('docx — Part B', () => {
    it('extracts raw text from a basic docx', async () => {
      const buf = await makeDocxFixture('Phase 4.14 docx fixture sentinel.');
      const out = await parsers.parseDocx(buf, { name: 'tiny.docx' });
      expect(out).toMatch(/Phase 4\.14 docx fixture sentinel\./);
    });

    it('does not truncate when text is well under max_pages threshold', async () => {
      const buf = await makeDocxFixture('Short doc.');
      const out = await parsers.parseDocx(buf, { name: 'tiny.docx', max_pages: 1 });
      expect(out).not.toMatch(/TRUNCATED — full document/);
    });

    it('truncates with the right marker when text exceeds max_pages × 3000 chars', async () => {
      const longText = 'A '.repeat(4000); // ~8000 chars, > 1 page (3000)
      const buf = await makeDocxFixture(longText);
      const out = await parsers.parseDocx(buf, { name: 'long.docx', max_pages: 1 });
      expect(out).toMatch(/TRUNCATED — full document is ~\d+ pages, requested first 1/);
    });

    it('rejects max_pages < 1 as a ParserError', async () => {
      const buf = await makeDocxFixture();
      await expect(parsers.parseDocx(buf, { name: 'd.docx', max_pages: 0 }))
        .rejects.toThrow(/positive integer/i);
    });

    it('legacy .doc returns the guidance message via the dispatcher', async () => {
      const buf = makeLegacyDocFixture();
      await expect(parsers.parseByMime(buf, parsers.LEGACY_DOC_MIME, { name: 'old.doc' }))
        .rejects.toThrow(/Legacy \.doc format/);
    });
  });

  describe('pdf — Part C', () => {
    it('parses a text-based PDF with page markers + count', async () => {
      const buf = await makePdfFixture();  // default text is 100+ chars
      const out = await parsers.parsePdf(buf, { name: 'tiny.pdf' });
      expect(out).toMatch(/=== PDF: tiny\.pdf \(\d+ pages\) ===/);
      expect(out).toMatch(/=== Page 1 ===/);
      expect(out).toMatch(/Phase 4\.14 pdf fixture/);
    });

    // Phase 4.15-followup: shared low-level parsePdfRaw used by both
    // parsePdf and read_attachment. Centralises the L-048 Uint8Array
    // wrap so future callers inherit the fix.
    it('parsePdfRaw returns { numpages, fullText, rawPages, info, metadata }', async () => {
      const buf = await makePdfFixture();
      const out = await parsers.parsePdfRaw(buf, { name: 'tiny.pdf' });
      expect(out.numpages).toBeGreaterThan(0);
      expect(typeof out.fullText).toBe('string');
      expect(out.fullText).toMatch(/Phase 4\.14 pdf fixture/);
      expect(Array.isArray(out.rawPages)).toBe(true);
      expect(out.rawPages.length).toBeGreaterThan(0);
      expect(out.info).toBeTruthy();
      expect(out.metadata).toBeTruthy();
    });

    it('parsePdfRaw on an image-only PDF throws pdf_image_only', async () => {
      const buf = await makeImageOnlyPdfFixture();
      await expect(parsers.parsePdfRaw(buf, { name: 'scanned.pdf' }))
        .rejects.toMatchObject({ code: 'pdf_image_only' });
    });

    it('page_range narrows to a subset of pages', async () => {
      const buf = await makePdfFixture();
      const out = await parsers.parsePdf(buf, { name: 'tiny.pdf', page_range: [1, 1] });
      expect(out).toMatch(/=== Page 1 ===/);
    });

    it('image-only PDF returns the OCR-not-supported guidance', async () => {
      const buf = await makeImageOnlyPdfFixture();
      await expect(parsers.parsePdf(buf, { name: 'scanned.pdf' }))
        .rejects.toThrow(/OCR is not yet supported/);
    });

    it('rejects invalid page_range', async () => {
      const buf = await makePdfFixture();
      await expect(parsers.parsePdf(buf, { name: 'p.pdf', page_range: [0, 5] }))
        .rejects.toThrow(/page_range/i);
    });
  });

  describe('rtf — Part D', () => {
    it('parses a basic rtf document', async () => {
      const buf = makeRtfFixture(['First paragraph here.', 'Second paragraph follows.']);
      const out = await parsers.parseRtf(buf, { name: 'tiny.rtf' });
      expect(out).toMatch(/First paragraph here\./);
      expect(out).toMatch(/Second paragraph follows\./);
    });
  });

  describe('size caps — Part I', () => {
    it('rejects buffers larger than 25MB with a helpful message', async () => {
      const buf = makeOversizedFixture();
      await expect(parsers.parseXlsx(buf, { name: 'huge.xlsx' }))
        .rejects.toThrow(/25MB Phase 4\.14 ingestion cap/);
    });

    it('applies the 200KB output cap with the right truncation marker', () => {
      const oversize = 'x'.repeat(250 * 1024);
      const capped = parsers.applyOutputCap(oversize);
      expect(Buffer.byteLength(capped, 'utf8')).toBeLessThanOrEqual(200 * 1024);
      expect(capped).toMatch(/TRUNCATED at 200KB/);
      expect(capped).toMatch(/sheet_name|row_range|page_range/);
    });

    it('does NOT cap output that fits under 200KB', () => {
      const fits = 'hello world';
      expect(parsers.applyOutputCap(fits)).toBe(fits);
    });
  });

  describe('mime dispatcher — Part E', () => {
    it('reports support for each Phase 4.14 mime type', () => {
      expect(parsers.isSupported('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
      expect(parsers.isSupported('application/vnd.ms-excel')).toBe(true);
      expect(parsers.isSupported('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
      expect(parsers.isSupported('application/pdf')).toBe(true);
      expect(parsers.isSupported('application/rtf')).toBe(true);
      expect(parsers.isSupported('text/rtf')).toBe(true);
    });

    it('reports NO support for explicitly-out-of-scope types', () => {
      expect(parsers.isSupported('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(false);
      expect(parsers.isSupported('image/png')).toBe(false);
      expect(parsers.isSupported('application/msword')).toBe(false);
    });
  });
});
