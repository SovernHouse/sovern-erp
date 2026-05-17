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

const PAGE_MARGIN = 50;
// Phase 4.28d follow-up: per-PriceList column visibility. hidden_columns
// JSON column lists standard column keys to skip; remaining columns
// reflow to fill the row. SKU + productName + price are always shown
// (the minimum needed for a useful price list). The renderer normalizes
// the ratios so the remaining columns fill 100% of the row.
const ALWAYS_VISIBLE = new Set(['sku', 'productName', 'price']);
const DEFAULT_COL_RATIOS = {
  sku:          0.22,
  productName:  0.34,
  unit:         0.08,
  moq:          0.10,
  lead:         0.12,
  price:        0.14,
};
const COL_ORDER = ['sku', 'productName', 'unit', 'moq', 'lead', 'price'];
// "LEAD (D)" was overflowing the 0.10-ratio column (Alex feedback
// 2026-05-17, header rendered as "LEAD (D" with the closing paren
// cut). Bumped lead to 0.12 and stripped the parenthetical; the unit
// (days) is implicit on a trade price list.
const COL_HEADERS = {
  sku:         'SKU',
  productName: 'PRODUCT',
  unit:        'UNIT',
  moq:         'MOQ',
  lead:        'LEAD',
  price:       'PRICE',
};

function resolveColumns(hiddenList) {
  const hidden = new Set(
    (Array.isArray(hiddenList) ? hiddenList : []).map(s => String(s).toLowerCase()),
  );
  const visible = COL_ORDER.filter(k => ALWAYS_VISIBLE.has(k) || !hidden.has(k));
  const sumRatio = visible.reduce((s, k) => s + DEFAULT_COL_RATIOS[k], 0);
  // Normalize so the visible columns fill 100% of pageWidth.
  const ratios = {};
  for (const k of visible) ratios[k] = DEFAULT_COL_RATIOS[k] / sumRatio;
  return { visible, ratios };
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

      // ── Meta block (2 columns)
      //
      // Each entry is rendered as a stacked label + value pair. The
      // previous version used a fixed 18pt row advance and no width on
      // the value, so the value (font 11, line height ~14pt) bled into
      // the next row's label, and long values like "FlorWay SDN. BHD"
      // ran past the column boundary into the next cell. Alex feedback
      // 2026-05-17: meta rows are too small / running together.
      //
      // Fix: explicit width on label and value, ellipsis on overflow so
      // the value stays on one line, and a 30pt row advance so the
      // 22pt-tall label/value stack never overlaps the next row.
      const metaY = PAGE_MARGIN + 134;
      const colWidth = pageWidth / 2 - 10;
      const META_ROW_GAP = 30;
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

      let y = metaY;
      meta.forEach(([label, value], idx) => {
        const col = idx % 2;
        const x = PAGE_MARGIN + col * (colWidth + 20);
        if (col === 0 && idx > 0) y += META_ROW_GAP;
        doc.fontSize(8).fillColor(tokens.steel || '#64748B').font(fonts.body)
           .text(label.toUpperCase(), x, y, { width: colWidth, lineBreak: false });
        doc.fontSize(11).fillColor(tokens.ink || '#0F172A').font(fonts.bodyBold)
           .text(String(value), x, y + 11, { width: colWidth, lineBreak: false, ellipsis: true });
      });

      if (priceList.description) {
        y += 28;
        doc.fontSize(9).fillColor(tokens.steel || '#475569').font(fonts.body)
           .text(priceList.description, PAGE_MARGIN, y, { width: pageWidth });
        y += doc.heightOfString(priceList.description, { width: pageWidth });
      }

      // ── Items table
      y += 36;
      const tableTop = y;

      // Resolve which standard columns to render based on PriceList.hidden_columns.
      let hiddenList = priceList.hiddenColumns || priceList.hidden_columns || [];
      if (typeof hiddenList === 'string') {
        try { hiddenList = JSON.parse(hiddenList); } catch (_) { hiddenList = []; }
      }
      const { visible: visibleCols, ratios } = resolveColumns(hiddenList);

      const colWidths = {};
      for (const k of visibleCols) colWidths[k] = pageWidth * ratios[k];
      const colX = (() => {
        let cx = PAGE_MARGIN;
        const out = {};
        for (const k of visibleCols) {
          out[k] = cx;
          cx += colWidths[k];
        }
        return out;
      })();
      const RIGHT_ALIGN = new Set(['moq', 'lead', 'price']);

      // Header row — brand-tinted (cream / accent) with primary-color text.
      doc.rect(PAGE_MARGIN, tableTop, pageWidth, 22).fill(tokens.accentColor || '#F1F5F9');
      doc.fillColor(tokens.primaryColor).fontSize(9).font(fonts.bodyBold);
      for (const k of visibleCols) {
        const opts = { width: colWidths[k] - 12 };
        if (RIGHT_ALIGN.has(k)) opts.align = 'right';
        doc.text(COL_HEADERS[k], colX[k] + 6, tableTop + 7, opts);
      }

      // Rows. Phase 4.28d follow-up: each row's height is now derived
      // from the tallest cell's natural text height (productName is
      // usually the longest). All cells wrap (lineBreak:true) so no
      // truncation; the row rectangle grows to fit. Minimum 18pt for
      // single-line readability.
      y = tableTop + 22;
      const items = Array.isArray(priceList.items) ? priceList.items : [];
      const currency = priceList.currencyCode || 'USD';
      const MIN_ROW_HEIGHT = 18;
      const ROW_PAD_Y = 6;

      const computeRowHeight = (item) => {
        doc.font(fonts.body).fontSize(9);
        let tallest = MIN_ROW_HEIGHT - ROW_PAD_Y;
        for (const k of visibleCols) {
          const val = k === 'sku' ? (item.sku || '—')
                   : k === 'productName' ? (item.productName || '—')
                   : k === 'unit' ? (item.unit || 'sqm')
                   : '';
          if (!val) continue;
          const h = doc.heightOfString(String(val), { width: colWidths[k] - 12 });
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
          // Render only the visible columns. lineBreak:true (default)
          // lets each cell wrap into the row height we pre-computed;
          // nothing gets truncated.
          for (const k of visibleCols) {
            const opts = { width: colWidths[k] - 12 };
            let val;
            switch (k) {
              case 'sku':         val = item.sku || '—'; break;
              case 'productName': val = item.productName || '—'; break;
              case 'unit':        val = item.unit || 'sqm'; break;
              case 'moq':         val = item.minimumOrder != null ? String(item.minimumOrder) : '—'; opts.align = 'right'; break;
              case 'lead':        val = item.leadTimeDays != null ? String(item.leadTimeDays) : '—'; opts.align = 'right'; break;
              case 'price': {
                doc.font(fonts.bodyBold).fillColor(tokens.primaryColor);
                doc.text(fmtMoney(item.sellingPrice, currency), colX[k] + 6, y, { ...opts, align: 'right' });
                doc.font(fonts.body).fillColor(tokens.ink || '#0F172A');
                continue;
              }
              default: val = '—';
            }
            doc.fillColor(tokens.ink || '#0F172A').font(fonts.body).fontSize(9);
            doc.text(String(val), colX[k] + 6, y, opts);
          }
          y += rh;
        });
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
