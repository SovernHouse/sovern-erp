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
const COL_RATIOS = {
  sku:          0.16,
  productName:  0.42,
  unit:         0.08,
  moq:          0.10,
  lead:         0.10,
  price:        0.14,
};

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
      const metaY = PAGE_MARGIN + 134;
      const colWidth = pageWidth / 2 - 10;
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
        if (col === 0 && idx > 0) y += 18;
        doc.fontSize(8).fillColor(tokens.steel || '#64748B').font(fonts.body).text(label.toUpperCase(), x, y);
        doc.fontSize(11).fillColor(tokens.ink || '#0F172A').font(fonts.bodyBold).text(String(value), x, y + 10);
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

      const colWidths = {
        sku:         pageWidth * COL_RATIOS.sku,
        productName: pageWidth * COL_RATIOS.productName,
        unit:        pageWidth * COL_RATIOS.unit,
        moq:         pageWidth * COL_RATIOS.moq,
        lead:        pageWidth * COL_RATIOS.lead,
        price:       pageWidth * COL_RATIOS.price,
      };
      const colX = (() => {
        let cx = PAGE_MARGIN;
        const out = {};
        for (const k of ['sku', 'productName', 'unit', 'moq', 'lead', 'price']) {
          out[k] = cx;
          cx += colWidths[k];
        }
        return out;
      })();

      // Header row — brand-tinted (cream / accent) with primary-color text.
      doc.rect(PAGE_MARGIN, tableTop, pageWidth, 22).fill(tokens.accentColor || '#F1F5F9');
      doc.fillColor(tokens.primaryColor).fontSize(9).font(fonts.bodyBold);
      doc.text('SKU',       colX.sku + 6, tableTop + 7);
      doc.text('PRODUCT',   colX.productName + 6, tableTop + 7);
      doc.text('UNIT',      colX.unit + 6, tableTop + 7);
      doc.text('MOQ',       colX.moq + 6, tableTop + 7, { width: colWidths.moq - 12, align: 'right' });
      doc.text('LEAD (D)',  colX.lead + 6, tableTop + 7, { width: colWidths.lead - 12, align: 'right' });
      doc.text('PRICE',     colX.price + 6, tableTop + 7, { width: colWidths.price - 12, align: 'right' });

      // Rows
      y = tableTop + 22;
      const rowHeight = 18;
      const items = Array.isArray(priceList.items) ? priceList.items : [];
      const currency = priceList.currencyCode || 'USD';

      doc.font(fonts.body).fontSize(9).fillColor(tokens.ink || '#0F172A');
      if (items.length === 0) {
        doc.fillColor(tokens.steel || '#94A3B8').font(fonts.body)
           .text('No items in this price list.', PAGE_MARGIN, y + 10, { width: pageWidth, align: 'center' });
        y += rowHeight + 10;
      } else {
        items.forEach((item, idx) => {
          // New page if we run out of room.
          if (y + rowHeight > doc.page.height - PAGE_MARGIN - 40) {
            doc.addPage();
            y = PAGE_MARGIN;
          }
          if (idx % 2 === 1) {
            doc.rect(PAGE_MARGIN, y - 4, pageWidth, rowHeight).fill('#F8FAFC');
          }
          doc.fillColor(tokens.ink || '#0F172A').font(fonts.body).fontSize(9);
          doc.text(item.sku || '—',           colX.sku + 6, y, { width: colWidths.sku - 12, ellipsis: true });
          doc.text(item.productName || '—',   colX.productName + 6, y, { width: colWidths.productName - 12, ellipsis: true });
          doc.text(item.unit || 'sqm',        colX.unit + 6, y, { width: colWidths.unit - 12 });
          doc.text(item.minimumOrder != null ? String(item.minimumOrder) : '—',
            colX.moq + 6, y, { width: colWidths.moq - 12, align: 'right' });
          doc.text(item.leadTimeDays != null ? String(item.leadTimeDays) : '—',
            colX.lead + 6, y, { width: colWidths.lead - 12, align: 'right' });
          doc.font(fonts.bodyBold).fillColor(tokens.primaryColor)
             .text(fmtMoney(item.sellingPrice, currency),
               colX.price + 6, y, { width: colWidths.price - 12, align: 'right' });
          doc.font(fonts.body).fillColor(tokens.ink || '#0F172A');
          y += rowHeight;
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
