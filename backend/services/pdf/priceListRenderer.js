// ─── PriceList PDF renderer — Phase 4.28b ────────────────────────────────────
//
// Returns Promise<Buffer> for a printable / emailable PDF of a PriceList
// and its items. Same pdfkit pattern the other renderers use (see
// brandedQuotationRenderer.js / financeDocumentsPDF.js) so the visual
// language matches the rest of the document set.
//
// Layout:
//   - Brand-styled header (logo placeholder + company line)
//   - Title block: PriceList name, currency, valid window, parent
//     Customer or Factory if set
//   - Items table: SKU | Product Name | Unit | MOQ | Lead | Price
//   - Footer with generated-at timestamp + PriceList id (for support)
//
// Contract: takes a fully-loaded PriceList row (with .items already
// included). Caller handles the DB load + brand-scope checks.

const PDFDocument = require('pdfkit');
const { formatCurrency } = require('../../utils/helpers');
const { resolveTokens, registerBrandFonts } = require('./brandStyleTokens');
const { resolveBrand, assertBrandSafe, BrandLeakError } = require('../priceListBrandResolver');
const {
  displayUnit, displayPrice, originPortFor,
} = require('./priceFormatHelpers');

const PAGE_MARGIN = 50;
// Phase 4.28d follow-up: per-PriceList column visibility. hidden_columns
// JSON column lists standard column keys to skip; remaining columns
// reflow to fill the row. SKU + productName + price are always shown
// (the minimum needed for a useful price list). The renderer normalizes
// the ratios so the remaining columns fill 100% of the row.
//
// Phase 4.28m (2026-05-19): widened SKU default 0.22 → 0.28 to fit the
// new ILMY-180x1220-12.0mm / ILCN-180x1220-12.0mm origin-prefixed SKUs.
// Per-list manual override via PriceList.columnWidths takes precedence.
const ALWAYS_VISIBLE = new Set(['sku', 'productName', 'price']);
const DEFAULT_COL_RATIOS = {
  sku:          0.28,
  productName:  0.30,
  unit:         0.08,
  moq:          0.10,
  lead:         0.10,
  price:        0.14,
};
const COL_ORDER = ['sku', 'productName', 'unit', 'moq', 'lead', 'price'];
// Phase 4.28m: price column header is "FOB PRICE" with the origin
// port rendered as a smaller subline beneath. Other columns use a
// single label.
const COL_HEADERS = {
  sku:         'SKU',
  productName: 'PRODUCT',
  unit:        'UNIT',
  moq:         'MOQ',
  lead:        'LEAD',
  price:       'FOB PRICE',
};

// Custom columns (defined per-PriceList via columnDefinitions) get a
// base ratio share. The renderer normalizes all visible columns to
// 100% of pageWidth, so this only matters as a relative weight against
// the standard cols.
const CUSTOM_COL_RATIO = 0.10;

function resolveColumns(hiddenList, customDefs, labelOverrides, widthOverrides) {
  const hidden = new Set(
    (Array.isArray(hiddenList) ? hiddenList : []).map(s => String(s).toLowerCase()),
  );
  const labels = (labelOverrides && typeof labelOverrides === 'object' && !Array.isArray(labelOverrides))
    ? labelOverrides : {};
  const widths = (widthOverrides && typeof widthOverrides === 'object' && !Array.isArray(widthOverrides))
    ? widthOverrides : {};
  const headerFor = (k) => {
    const override = labels[k];
    if (override && String(override).trim()) return String(override).trim().toUpperCase();
    return COL_HEADERS[k];
  };
  // Phase 4.28m: per-list manual width override on PriceList.columnWidths.
  // Caller passes a {sku:0.30, price:0.18, ...} map; missing keys fall
  // back to the renderer default. Final widths are normalised to sum 1.0.
  const widthFor = (k, fallback) => {
    const raw = widths[k];
    if (raw == null || raw === '') return fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const visible = [];

  for (const k of COL_ORDER) {
    if (!ALWAYS_VISIBLE.has(k) && hidden.has(k)) continue;
    visible.push({
      kind:    'std',
      key:     k,
      header:  headerFor(k),
      ratio:   widthFor(k, DEFAULT_COL_RATIOS[k]),
      align:   (k === 'moq' || k === 'lead' || k === 'price') ? 'right' : 'left',
    });
  }

  const customs = (Array.isArray(customDefs) ? customDefs : []).filter(c => c && c.key);
  for (const c of customs) {
    const type = c.type || 'text';
    visible.push({
      kind:      'custom',
      key:       `custom:${c.key}`,
      customKey: c.key,
      header:    String(c.label || c.key).toUpperCase(),
      ratio:     widthFor(`custom:${c.key}`, CUSTOM_COL_RATIO),
      type,
      align:     (type === 'number' || type === 'boolean') ? 'right' : 'left',
    });
  }

  // Normalize so the visible columns fill 100% of pageWidth.
  const sum = visible.reduce((s, v) => s + v.ratio, 0);
  if (sum > 0) for (const v of visible) v.ratio = v.ratio / sum;

  return visible;
}

function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB'); } catch (_) { return String(d); }
}

function fmtMoney(value, currency) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try { return formatCurrency(n, currency || 'USD'); } catch (_) { return n.toFixed(2); }
}

async function renderPriceListPdf(priceList, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      // CRITICAL — brand resolution + assertion. Non-negotiable #9.
      // Refuses to render rather than silently falling back to SH.
      // Resilient flooring (LVT/SPC/Engineered SPC/WPC/Vinyl Sheet)
      // is FW (Malaysia) or HH (China), never SH.
      const resolution = resolveBrand(priceList, opts);
      if (!resolution.brand) {
        throw new BrandLeakError(
          'Cannot render PriceList PDF: brand context unresolved. Set PriceList.brand_code to FW (Malaysia / FlorWay) or HH (China / HanHua) for Resilient items, or to the parent factory/customer brand otherwise.',
          { priceListId: priceList.id, resolution },
        );
      }
      assertBrandSafe(priceList, resolution.brand);
      const tokens = resolveTokens(opts.brand || { code: resolution.brand });

      const doc = new PDFDocument({
        size: 'A4',
        margin: PAGE_MARGIN,
        info: {
          Title:    `Price List — ${priceList.name || priceList.id}`,
          Author:   tokens.displayName,
          Subject:  'Price List',
          Creator:  'Sovern ERP',
        },
      });

      const fonts = registerBrandFonts(doc);
      const buffers = [];
      doc.on('data', (b) => buffers.push(b));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width - PAGE_MARGIN * 2;

      // ── Header — brand-themed strip on the left, sender details right.
      doc.rect(PAGE_MARGIN, PAGE_MARGIN, 4, 56).fill(tokens.primaryColor);
      doc.fillColor(tokens.ink || '#0F172A')
         .fontSize(22).font(fonts.display)
         .text(tokens.displayName, PAGE_MARGIN + 14, PAGE_MARGIN);
      doc.fontSize(9).font(fonts.body).fillColor(tokens.steel || '#475569')
         .text(tokens.senderName || '', PAGE_MARGIN + 14, PAGE_MARGIN + 28)
         .text(tokens.senderTitle ? `${tokens.senderTitle}` : '', PAGE_MARGIN + 14, PAGE_MARGIN + 40);
      // Right column: sender email + footer-legal snippet anchored top-right.
      doc.fontSize(9).font(fonts.body).fillColor(tokens.steel || '#475569')
         .text(tokens.senderEmail || '', PAGE_MARGIN, PAGE_MARGIN + 28, { width: pageWidth, align: 'right' });

      // ── Document title
      doc.moveTo(PAGE_MARGIN, PAGE_MARGIN + 64)
         .lineTo(PAGE_MARGIN + pageWidth, PAGE_MARGIN + 64)
         .strokeColor(tokens.primaryColor).lineWidth(1).stroke();

      doc.fillColor(tokens.primaryColor).fontSize(22).font(fonts.display)
         .text('PRICE LIST', PAGE_MARGIN, PAGE_MARGIN + 76);

      doc.fontSize(14).font(fonts.bodyBold).fillColor(tokens.ink || '#0F172A')
         .text(priceList.name || '(unnamed)', PAGE_MARGIN, PAGE_MARGIN + 104);

      // ── Meta block (2 columns, auto-height rows)
      //
      // 2026-05-19 Alex feedback: the Supplier cell on the IronLite HH
      // list rendered "Anhui HanHua Building Materials Technology Co.,
      // Ltd." (52 chars) into a single-line cell with ellipsis, and
      // visually it ran into the description text below. Fix: drop
      // lineBreak:false on the value, measure each cell's actual
      // rendered height with heightOfString, advance y by the tallest
      // cell in each 2-column row plus padding. Every meta cell now
      // grows to fit its content instead of clipping with ellipsis.
      const metaY = PAGE_MARGIN + 134;
      const colWidth = pageWidth / 2 - 10;
      const META_LABEL_H = 11;     // label font size + descent
      const META_VALUE_FONT = 11;  // value font size (bold)
      const META_ROW_PAD = 10;     // vertical gap after each row
      const META_MIN_ROW_H = 22;   // floor so empty/short cells don't squash

      const meta = [
        ['Currency',  priceList.currencyCode || 'USD'],
        ['Valid from', fmtDate(priceList.validFrom)],
        ['Valid to',   fmtDate(priceList.validTo)],
        ['Status',     priceList.isActive ? 'Active' : 'Inactive'],
      ];
      const parent =
        (priceList.Customer && priceList.Customer.companyName) ||
        (priceList.customer && priceList.customer.companyName)  ||
        (priceList.Factory  && priceList.Factory.companyName)   ||
        (priceList.factory  && priceList.factory.companyName)   ||
        null;
      if (parent) {
        meta.push([
          priceList.customerId ? 'Client' : 'Supplier',
          parent,
        ]);
      }

      // Group meta cells into rows of 2 columns. Each row's height is
      // max(value heights in the row) + label height + padding. Cells
      // wrap to multiple lines if needed (e.g. long supplier names).
      let y = metaY;
      for (let i = 0; i < meta.length; i += 2) {
        const rowCells = meta.slice(i, i + 2);

        // First pass — measure each value cell's height at the value font.
        let maxValueH = 0;
        for (const [, value] of rowCells) {
          doc.font(fonts.bodyBold).fontSize(META_VALUE_FONT);
          const h = doc.heightOfString(String(value), { width: colWidth });
          if (h > maxValueH) maxValueH = h;
        }
        const rowH = Math.max(META_MIN_ROW_H, META_LABEL_H + maxValueH);

        // Second pass — render label (top) + value (under label) in each col.
        for (let c = 0; c < rowCells.length; c++) {
          const [label, value] = rowCells[c];
          const x = PAGE_MARGIN + c * (colWidth + 20);
          doc.fontSize(8).fillColor(tokens.steel || '#64748B').font(fonts.body)
             .text(label.toUpperCase(), x, y, { width: colWidth, lineBreak: false });
          doc.fontSize(META_VALUE_FONT).fillColor(tokens.ink || '#0F172A').font(fonts.bodyBold)
             .text(String(value), x, y + META_LABEL_H, { width: colWidth });
        }
        y += rowH + META_ROW_PAD;
      }

      if (priceList.description) {
        // y already points at the bottom of the meta block + standard
        // row padding. Add a small extra gap before the description so
        // the two blocks read as separate sections.
        y += 8;
        doc.fontSize(9).fillColor(tokens.steel || '#475569').font(fonts.body)
           .text(priceList.description, PAGE_MARGIN, y, { width: pageWidth });
        y += doc.heightOfString(priceList.description, { width: pageWidth });
      }

      // ── Product Details block (Phase 4.28v, 2026-05-19)
      //
      // Constants across all items in a price list (construction, click
      // system, surface finish, AC rating, certifications, HS code)
      // render once near the top so the buyer doesn't have to read the
      // SKU table to learn what they're buying. Picks the most common
      // non-null value per spec field across the included Product rows.
      // Falls back silently if no items carry the field.
      const itemsForSpecs = Array.isArray(priceList.items) ? priceList.items : [];
      const pickCommon = (key, accessor) => {
        const counts = new Map();
        for (const it of itemsForSpecs) {
          const v = accessor(it);
          if (v == null || v === '') continue;
          counts.set(v, (counts.get(v) || 0) + 1);
        }
        let best = null, bestCount = 0;
        for (const [v, c] of counts) {
          if (c > bestCount) { best = v; bestCount = c; }
        }
        return best;
      };
      const itemSpecs = (it) => {
        const p = it.Product || it.product || {};
        let s = p.specifications;
        if (typeof s === 'string') { try { s = JSON.parse(s); } catch (_) { s = null; } }
        return s || {};
      };
      const itemCerts = (it) => {
        const p = it.Product || it.product || {};
        let c = p.certifications;
        if (typeof c === 'string') { try { c = JSON.parse(c); } catch (_) { c = null; } }
        return Array.isArray(c) ? c : [];
      };

      const productDetails = [
        ['Construction',  pickCommon('construction', (it) => itemSpecs(it).construction)],
        ['Click System',  pickCommon('clickSystem',  (it) => itemSpecs(it).clickSystem)],
        ['Surface',       pickCommon('finish',       (it) => itemSpecs(it).finish)],
        ['AC Rating',     pickCommon('acRating',     (it) => itemSpecs(it).acRating)],
        ['Wear Layer',    pickCommon('wearLayer',    (it) => itemSpecs(it).wearLayer)],
        ['HS Code',       pickCommon('hsCode',       (it) => (it.Product || it.product || {}).hsCode)],
      ].filter(([, v]) => v != null && v !== '');

      // Certifications: aggregate unique names across every item's product.
      const certNames = new Set();
      for (const it of itemsForSpecs) {
        for (const c of itemCerts(it)) {
          if (c && c.name) certNames.add(c.note ? `${c.name} (${c.note})` : c.name);
        }
      }
      const certList = Array.from(certNames).join(' · ');

      if (productDetails.length > 0 || certList) {
        y += 16;
        // Block header
        doc.fillColor(tokens.primaryColor).fontSize(9).font(fonts.bodyBold)
           .text('PRODUCT DETAILS', PAGE_MARGIN, y, { width: pageWidth });
        y += 12;
        doc.moveTo(PAGE_MARGIN, y - 2)
           .lineTo(PAGE_MARGIN + Math.min(80, pageWidth), y - 2)
           .strokeColor(tokens.primaryColor).lineWidth(0.8).stroke();
        y += 4;

        // Two-column key-value list. Same auto-grow pattern as the meta
        // block above (heightOfString → tallest cell drives row advance).
        const PD_LABEL_H = 11;
        const PD_VALUE_FONT = 10;
        const PD_ROW_PAD = 8;
        const pdColWidth = pageWidth / 2 - 10;
        for (let i = 0; i < productDetails.length; i += 2) {
          const rowCells = productDetails.slice(i, i + 2);
          // Measure tallest value in the row.
          let maxValueH = 0;
          for (const [, v] of rowCells) {
            doc.font(fonts.bodyBold).fontSize(PD_VALUE_FONT);
            const h = doc.heightOfString(String(v), { width: pdColWidth });
            if (h > maxValueH) maxValueH = h;
          }
          const rowH = PD_LABEL_H + maxValueH;
          for (let c = 0; c < rowCells.length; c++) {
            const [label, value] = rowCells[c];
            const x = PAGE_MARGIN + c * (pdColWidth + 20);
            doc.fontSize(8).fillColor(tokens.steel || '#64748B').font(fonts.body)
               .text(label.toUpperCase(), x, y, { width: pdColWidth, lineBreak: false });
            doc.fontSize(PD_VALUE_FONT).fillColor(tokens.ink || '#0F172A').font(fonts.bodyBold)
               .text(String(value), x, y + PD_LABEL_H, { width: pdColWidth });
          }
          y += rowH + PD_ROW_PAD;
        }

        if (certList) {
          doc.fontSize(8).fillColor(tokens.steel || '#64748B').font(fonts.body)
             .text('CERTIFICATIONS', PAGE_MARGIN, y, { width: pageWidth, lineBreak: false });
          y += PD_LABEL_H;
          doc.fontSize(PD_VALUE_FONT).fillColor(tokens.ink || '#0F172A').font(fonts.bodyBold)
             .text(certList, PAGE_MARGIN, y, { width: pageWidth });
          y += doc.heightOfString(certList, { width: pageWidth }) + PD_ROW_PAD;
        }
      }

      // ── Items table
      y += 20;
      const tableTop = y;

      // Resolve which standard + custom columns to render. Both
      // hiddenColumns (which standard cols to skip) and columnDefinitions
      // (which custom cols to render) live on the PriceList row. Both
      // come back as DataTypes.JSON which can arrive stringified per
      // L-053; parse defensively.
      let hiddenList = priceList.hiddenColumns || priceList.hidden_columns || [];
      if (typeof hiddenList === 'string') {
        try { hiddenList = JSON.parse(hiddenList); } catch (_) { hiddenList = []; }
      }
      let customDefs = priceList.columnDefinitions || priceList.column_definitions || [];
      if (typeof customDefs === 'string') {
        try { customDefs = JSON.parse(customDefs); } catch (_) { customDefs = []; }
      }
      let columnLabels = priceList.columnLabels || priceList.column_labels || {};
      if (typeof columnLabels === 'string') {
        try { columnLabels = JSON.parse(columnLabels); } catch (_) { columnLabels = {}; }
      }
      let columnWidths = priceList.columnWidths || priceList.column_widths || {};
      if (typeof columnWidths === 'string') {
        try { columnWidths = JSON.parse(columnWidths); } catch (_) { columnWidths = {}; }
      }
      const visibleCols = resolveColumns(hiddenList, customDefs, columnLabels, columnWidths);

      // Precompute width + x for each column. Column object gets .width
      // and .x mutated in place so the rest of the rendering can read
      // either off the object.
      {
        let cx = PAGE_MARGIN;
        for (const c of visibleCols) {
          c.width = pageWidth * c.ratio;
          c.x = cx;
          cx += c.width;
        }
      }

      // Phase 4.28m: header row is now 30pt tall so the FOB PRICE column
      // can carry a port subline ("Port Klang" for FW, "Shanghai" for
      // HH) under the main label. Other columns still render the single
      // label vertically centred in the band.
      const HEADER_H = 30;
      const portSubline = originPortFor(resolution.brand);
      doc.rect(PAGE_MARGIN, tableTop, pageWidth, HEADER_H).fill(tokens.accentColor || '#F1F5F9');
      for (const c of visibleCols) {
        const opts = { width: c.width - 12 };
        if (c.align === 'right') opts.align = 'right';
        // Phase 4.28o (Alex 2026-05-19): on the price column specifically,
        // CENTER the FOB PRICE label so the port subline below it can sit
        // dead-under the label rather than against the right edge.
        const labelOpts = (c.kind === 'std' && c.key === 'price' && portSubline)
          ? { ...opts, align: 'center' }
          : opts;
        // Main label — primary brand colour, centred for the price column.
        doc.fillColor(tokens.primaryColor).fontSize(9).font(fonts.bodyBold);
        doc.text(c.header, c.x + 6, tableTop + 6, labelOpts);
        // Port subline under FOB PRICE only. Same colour weight as the
        // main label (Alex wants it black, matching FOB PRICE), bold, one
        // size smaller, centred under the label.
        if (c.kind === 'std' && c.key === 'price' && portSubline) {
          doc.fillColor(tokens.primaryColor).fontSize(8).font(fonts.bodyBold);
          doc.text(portSubline, c.x + 6, tableTop + 18, { ...opts, align: 'center' });
        }
      }

      // Rows. Phase 4.28d follow-up: each row's height is now derived
      // from the tallest cell's natural text height (productName or a
      // long custom value is usually the longest). All cells wrap
      // (lineBreak:true) so no truncation; the row rectangle grows to
      // fit. Minimum 18pt for single-line readability.
      y = tableTop + HEADER_H;
      const items = Array.isArray(priceList.items) ? priceList.items : [];
      const currency = priceList.currencyCode || 'USD';
      const MIN_ROW_HEIGHT = 18;
      const ROW_PAD_Y = 6;

      // Resolve a cell's display value for a given column object + item.
      // Returns null when the cell is meaningfully empty (no contribution
      // to row height; '—' will be rendered in its place).
      const cellValue = (col, item) => {
        if (col.kind === 'custom') {
          let cc = item.customColumns;
          if (typeof cc === 'string') {
            try { cc = JSON.parse(cc); } catch (_) { cc = {}; }
          }
          const raw = (cc && typeof cc === 'object') ? cc[col.customKey] : undefined;
          if (raw == null || raw === '') return null;
          if (col.type === 'boolean') return raw === true || raw === 'true' ? 'Yes' : 'No';
          return String(raw);
        }
        switch (col.key) {
          case 'sku':         return item.sku || null;
          case 'productName': return item.productName || null;
          // Phase 4.28m: display unit goes through the shared mapper
          // ('sqm' → 'M2', etc.). Raw db value stays 'sqm'.
          case 'unit':        return displayUnit(item.unit || 'sqm');
          case 'moq':         return item.minimumOrder != null ? String(item.minimumOrder) : null;
          case 'lead':        return item.leadTimeDays != null ? String(item.leadTimeDays) : null;
          // Phase 4.28m: price renders as "$9.10/M2" via the shared
          // helper. Unit on each item defaults to 'sqm' (the column
          // value), which displayUnit normalises to M2.
          case 'price':       return displayPrice(item.sellingPrice, currency, item.unit || 'sqm');
          default:            return null;
        }
      };

      const computeRowHeight = (item) => {
        doc.font(fonts.body).fontSize(9);
        let tallest = MIN_ROW_HEIGHT - ROW_PAD_Y;
        for (const c of visibleCols) {
          const v = cellValue(c, item);
          if (!v) continue;
          const h = doc.heightOfString(String(v), { width: c.width - 12 });
          if (h > tallest) tallest = h;
        }
        return Math.ceil(tallest + ROW_PAD_Y);
      };

      doc.font(fonts.body).fontSize(9).fillColor(tokens.ink || '#0F172A');
      if (items.length === 0) {
        doc.fillColor(tokens.steel || '#94A3B8').font(fonts.body)
           .text('No items in this price list.', PAGE_MARGIN, y + 10, { width: pageWidth, align: 'center' });
        y += MIN_ROW_HEIGHT + 10;
      } else {
        items.forEach((item, idx) => {
          const rh = computeRowHeight(item);
          // New page if this row won't fit. Leave room for the footer.
          if (y + rh > doc.page.height - PAGE_MARGIN - 50) {
            doc.addPage();
            y = PAGE_MARGIN;
          }
          if (idx % 2 === 1) {
            doc.rect(PAGE_MARGIN, y - 3, pageWidth, rh).fill('#F8FAFC');
          }
          for (const c of visibleCols) {
            const opts = { width: c.width - 12 };
            if (c.align === 'right') opts.align = 'right';
            // Price gets the brand accent color + bold; every other cell
            // renders in body weight.
            if (c.kind === 'std' && c.key === 'price') {
              doc.font(fonts.bodyBold).fillColor(tokens.primaryColor);
              doc.text(cellValue(c, item) || '—', c.x + 6, y, opts);
              doc.font(fonts.body).fillColor(tokens.ink || '#0F172A');
              continue;
            }
            doc.fillColor(tokens.ink || '#0F172A').font(fonts.body).fontSize(9);
            doc.text(cellValue(c, item) || '—', c.x + 6, y, opts);
          }
          y += rh;
        });
      }

      // ── Footer notes block (payment terms / duty breakdown / Incoterm
      // caveat / sample policy). Rendered above the brand footer. Plain
      // text; newlines preserved. Page-breaks if it doesn't fit; the
      // brand footer always sits on the last page (rendered after).
      //
      // Phase 4.28f — every FW/HH list auto-prepends a tariff-reconfirm
      // disclaimer. US/CN and US/MY duty rates are policy-volatile;
      // anything printed on a list dated more than a few days back is
      // not safe to quote without re-checking. Operator-entered
      // footerNotes append after the standard disclaimer.
      const STANDARD_TARIFF_DISCLAIMER =
        'Tariff and duty rates referenced on this list are indicative and based on '
        + 'factory notes current at the date of issue. US import duty on rigid-core flooring '
        + 'is policy-volatile. Tariff rates and applicable surcharges must be reconfirmed '
        + 'with the factory at the time the order is confirmed, before the buyer commits to '
        + 'landed-cost figures.';
      const brandForNotes = String(resolution.brand || '').toUpperCase();
      const includeStandardDisclaimer = brandForNotes === 'FW' || brandForNotes === 'HH';
      const operatorNotes = (priceList.footerNotes || priceList.footer_notes || '').toString().trim();
      const footerNotesRaw = includeStandardDisclaimer
        ? (operatorNotes ? `${STANDARD_TARIFF_DISCLAIMER}\n\n${operatorNotes}` : STANDARD_TARIFF_DISCLAIMER)
        : operatorNotes;
      if (footerNotesRaw && String(footerNotesRaw).trim()) {
        const notes = String(footerNotesRaw).trim();
        doc.font(fonts.body).fontSize(9);
        const notesHeight = doc.heightOfString(notes, { width: pageWidth });
        const labelHeight = 14;
        const blockHeight = labelHeight + notesHeight + 8;

        // Need room for the block + the brand footer below it (~50pt).
        if (y + 20 + blockHeight > doc.page.height - PAGE_MARGIN - 50) {
          doc.addPage();
          y = PAGE_MARGIN;
        } else {
          y += 16;
        }

        doc.fillColor(tokens.primaryColor).fontSize(9).font(fonts.bodyBold)
           .text('NOTES', PAGE_MARGIN, y, { width: pageWidth });
        y += labelHeight;
        doc.moveTo(PAGE_MARGIN, y - 2)
           .lineTo(PAGE_MARGIN + Math.min(60, pageWidth), y - 2)
           .strokeColor(tokens.primaryColor).lineWidth(0.8).stroke();
        doc.fillColor(tokens.ink || '#0F172A').fontSize(9).font(fonts.body)
           .text(notes, PAGE_MARGIN, y, { width: pageWidth });
        y += notesHeight + 8;
      }

      // ── Footer
      const footerY = doc.page.height - PAGE_MARGIN - 36;
      doc.moveTo(PAGE_MARGIN, footerY)
         .lineTo(PAGE_MARGIN + pageWidth, footerY)
         .strokeColor(tokens.primaryColor).lineWidth(0.8).stroke();
      doc.fillColor(tokens.steel || '#94A3B8').fontSize(8).font(fonts.body)
         .text(tokens.footerLegal || '', PAGE_MARGIN, footerY + 6, { width: pageWidth });
      doc.fontSize(7).fillColor(tokens.steel || '#CBD5E1')
         .text(
           `Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC · PriceList ${priceList.id} · Brand ${tokens.code}`,
           PAGE_MARGIN, footerY + 22, { width: pageWidth },
         );
      if (opts.note) {
        doc.text(opts.note, PAGE_MARGIN, footerY + 6, { width: pageWidth, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { renderPriceListPdf };
