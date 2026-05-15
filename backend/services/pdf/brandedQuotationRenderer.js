/**
 * Brand-aware quotation PDF renderer (Phase 3, C9 + C10).
 *
 * Single entry point: dispatch(quotation, items, customer, salesPerson, brand).
 * Returns Promise<filename> — same contract as the legacy
 * documentGenerator.generateQuotationPDF so this is a drop-in override.
 *
 * Variant selector:
 *   brand.code === 'FW' → switch on customer.productBrandingMode
 *     'ironlite'      → renderFlorWayIronLite (full IronLite branding)
 *     'private_label' → renderFlorWayPrivateLabel (placeholder, defers full template)
 *     'generic'|null  → renderFlorWayGeneric (default for FW)
 *   brand.code === 'SH' → renderSovernHouseClassic
 *     (brand-styled SH layout with the forest/cream/ink palette as of C10)
 *   anything else      → renderSovernHouseClassic (safe fallback)
 *
 * File output path:
 *   uploads/quotations/{brandCode}/{variant}/quotation-{number}-{timestamp}.pdf
 * Per-brand and per-variant folders mean a renderer regression doesn't
 * clobber prior PDFs and we can diff between variants easily on the VM.
 *
 * No em dashes anywhere (L-015). Middot (U+00B7) only.
 * No JSON.stringify on JSON columns (L-023) — not relevant here but a
 * reminder when extending.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatCurrency } = require('../../utils/helpers');
const tokens = require('./brandStyleTokens');
const {
  sqmToSqft, mmToInch, pricePerSqmToPricePerSqft,
  AREA_LABEL, DIM_LABEL,
} = require('../../utils/unitConversion');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// ─── PUBLIC ENTRY ──────────────────────────────────────────────────────────

/**
 * Generate a quotation PDF, brand-aware.
 *
 * @param {object} quotation  Sequelize Quotation instance (or plain object).
 * @param {Array}  items      Quotation items (with .product include).
 * @param {object} customer   Customer record (with productBrandingMode).
 * @param {object} salesPerson  User record (firstName, lastName).
 * @param {object|null} brand   Brand record from db.Brand.findOne. If null,
 *                              the dispatcher fetches it. Pass it through
 *                              when the caller already has it (saves a query).
 * @returns {Promise<{filename:string, filepath:string}>}  Generated file
 *   info. `filename` is the basename for legacy response payloads.
 *   `filepath` is the absolute path used by generatePDF to stream binary
 *   back to the browser.
 */
async function dispatch(quotation, items, customer, salesPerson, brand = null) {
  // Resolve brand if caller didn't pass one
  if (!brand && quotation?.brandCode) {
    const db = require('../../models');
    brand = await db.Brand.findOne({
      where: { code: quotation.brandCode, active: true },
    });
  }

  const brandCode = brand?.code || 'SH';

  if (brandCode === 'FW') {
    const variant = tokens.resolveFlorWayVariant(customer);
    if (variant === 'ironlite') {
      return renderFlorWayIronLite(quotation, items, customer, salesPerson, brand);
    }
    if (variant === 'private_label') {
      return renderFlorWayPrivateLabel(quotation, items, customer, salesPerson, brand);
    }
    return renderFlorWayGeneric(quotation, items, customer, salesPerson, brand);
  }

  // SH path — delegates to legacy in C9, replaced in C10
  return renderSovernHouseClassic(quotation, items, customer, salesPerson, brand);
}

// ─── SH (Sovern House) NATIVE RENDERER (C10) ───────────────────────────────
// Replaces the C9 legacy delegate. Brand-styled SH layout with the forest/
// cream/ink palette and Sovern House wordmark. Reuses the shared draw
// helpers below (drawHeaderBand, drawCustomerAndMeta, drawItemsTable,
// drawTotals, drawTerms, drawSenderBlock, drawFooter) which take a tokens
// bag and are brand-agnostic. Output path is uploads/quotations/SH/classic/
// (the brand+variant sub-folder convention introduced for FW in C9).

function renderSovernHouseClassic(quotation, items, customer, salesPerson, brand) {
  return new Promise((resolve, reject) => {
    try {
      const t = tokens.resolveTokens(brand || { code: 'SH' });
      const { filename, filepath } =
        buildOutputPath('SH', 'classic', quotation.quotationNumber);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const fonts = tokens.registerBrandFonts(doc);
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      let pageNum = 1;
      let y;

      // ── Header band with Sovern House wordmark ─────────────────────────
      y = drawFwHeaderBand(doc, t, 72);
      const logoPlaced = tryImage(doc, t.assets?.logoLight, 40, 18,
        { height: 38 });
      if (!logoPlaced) {
        doc.fillColor('#FFFFFF').font(fonts.display).fontSize(18)
           .text('SOVERN HOUSE', 40, 22, { characterSpacing: 1.4 });
        doc.fillColor(t.accentColor).font(fonts.body).fontSize(9)
           .text('INTERNATIONAL TRADE', 40, 48, { characterSpacing: 1.2 });
      }
      // Right-aligned QUOTATION title in the band
      doc.fillColor('#FFFFFF').font(fonts.display).fontSize(18)
         .text('QUOTATION', doc.page.width - 220, 22,
           { width: 180, align: 'right', characterSpacing: 1.4 });
      doc.fillColor(t.accentColor).font(fonts.body).fontSize(9)
         .text(quotation.quotationNumber || '', doc.page.width - 220, 50,
           { width: 180, align: 'right' });

      // ── Customer + meta ─────────────────────────────────────────────────
      y = drawFwCustomerAndMeta(doc, t, fonts, quotation, customer, salesPerson, y + 4);

      // ── Intro paragraph (SH trading-house tone) ─────────────────────────
      const intro = 'Thank you for the opportunity to quote. Sovern House sources from verified factories across Asia and ships under your preferred Incoterm. Pricing and commercial terms below.';
      doc.fillColor(t.ink).font(fonts.body).fontSize(10.5)
         .text(intro, 50, y, { width: doc.page.width - 100, lineGap: 2 });
      y += doc.heightOfString(intro, { width: doc.page.width - 100, lineGap: 2 }) + 18;

      // ── Items table ─────────────────────────────────────────────────────
      y = drawFwItemsTable(doc, t, fonts, items, quotation, y);

      // ── Totals ──────────────────────────────────────────────────────────
      y = drawFwTotals(doc, t, fonts, quotation, y + 6);

      // ── Phase 4.9 C-3: USA landed-cost breakdown (no-op when no snapshot) ─
      y = drawLandedCostBreakdown(doc, t, fonts, items, quotation.currency || 'USD', y + 4);

      // ── Terms ───────────────────────────────────────────────────────────
      y = drawFwTerms(doc, t, fonts, quotation.terms, y + 18);

      // ── Sender block ────────────────────────────────────────────────────
      if (y > doc.page.height - 180) {
        drawFwFooter(doc, t, fonts, pageNum);
        doc.addPage(); pageNum += 1;
        y = drawFwHeaderBand(doc, t, 50);
      }
      drawFwSenderBlock(doc, t, fonts, y + 12);

      // ── Footer ──────────────────────────────────────────────────────────
      drawFwFooter(doc, t, fonts, pageNum);

      doc.end();
      stream.on('finish', () => resolve({ filename, filepath: path.resolve(filepath) }));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// ─── FW SHARED HELPERS ─────────────────────────────────────────────────────

function buildOutputPath(brandCode, variant, quotationNumber) {
  const dir = path.join(UPLOAD_DIR, 'quotations', brandCode, variant);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filename = `quotation-${quotationNumber}-${Date.now()}.pdf`;
  return { filename, filepath: path.join(dir, filename) };
}

function fmtMoney(value, currency = 'USD') {
  if (value == null) return '-';
  return formatCurrency(value, currency);
}

function fmtDate(value) {
  if (!value) return 'N/A';
  // Per L-042 user-facing dates render in Asia/Taipei.
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    timeZone: 'Asia/Taipei',
  });
}

/**
 * Draw a single iron-deep band across the top of every FW page. Header
 * content (wordmark / title / quotation number) is left to the caller so
 * variants can pick image vs text.
 *
 * Returns the Y coordinate just below the band where body content can begin.
 */
function drawFwHeaderBand(doc, t, height = 78) {
  doc.save();
  doc.rect(0, 0, doc.page.width, height).fill(t.primaryColor);
  doc.restore();
  return height + 20;
}

/**
 * Draw the FW footer line on the current page. Legal entity copy on the
 * left, sender email + page number on the right.
 */
function drawFwFooter(doc, t, fonts, pageNum) {
  const bottomY = doc.page.height - 38;
  doc.save();
  doc.strokeColor(t.steel || '#94A3B8').lineWidth(0.5)
     .moveTo(40, bottomY - 8).lineTo(doc.page.width - 40, bottomY - 8).stroke();
  doc.fillColor(t.steel || '#94A3B8').font(fonts.body).fontSize(7.5);
  doc.text(t.footerLegal, 40, bottomY, {
    width: doc.page.width - 200, align: 'left',
  });
  doc.text(`${t.senderEmail}   ·   Page ${pageNum}`,
    doc.page.width - 200, bottomY, { width: 160, align: 'right' });
  doc.restore();
}

/**
 * Draw the FW sender / signature block at the given Y. Returns the Y after
 * the block. Caller is responsible for ensuring there's room on the page.
 */
function drawFwSenderBlock(doc, t, fonts, y) {
  const left = 50;
  doc.save();
  doc.strokeColor(t.primaryColor).lineWidth(1.5)
     .moveTo(left, y).lineTo(left + 60, y).stroke();
  y += 16;
  doc.fillColor(t.ink).font(fonts.bodyBold).fontSize(11).text(t.senderName, left, y);
  y += 14;
  doc.fillColor(t.steel || '#94A3B8').font(fonts.body).fontSize(8.5)
     .text(t.senderTitle.toUpperCase(), left, y, { characterSpacing: 0.8 });
  y += 14;
  doc.fillColor(t.primaryColor).font(fonts.body).fontSize(10).text(t.senderEmail, left, y);
  doc.restore();
  return y + 20;
}

/**
 * Draw the customer "Bill To" block and the quotation meta panel side by
 * side. Returns the Y after the larger of the two.
 */
function drawFwCustomerAndMeta(doc, t, fonts, quotation, customer, salesPerson, y) {
  const leftX = 50, rightX = 330;
  const labelSize = 8, valueSize = 10.5;

  doc.fillColor(t.steel || '#94A3B8').font(fonts.body).fontSize(labelSize)
     .text('BUYER', leftX, y, { characterSpacing: 1.2 });
  doc.text('QUOTATION', rightX, y, { characterSpacing: 1.2 });
  y += 14;

  doc.fillColor(t.ink).font(fonts.bodyBold).fontSize(valueSize)
     .text(customer?.companyName || '-', leftX, y, { width: 250 });
  doc.font(fonts.bodyBold).fillColor(t.primaryColor)
     .text(quotation.quotationNumber || '-', rightX, y, { width: 200 });
  y += 16;

  doc.font(fonts.body).fontSize(9.5).fillColor(t.ink);
  let leftY = y, rightY = y;
  if (customer?.contactPerson) {
    doc.text(customer.contactPerson, leftX, leftY, { width: 250 });
    leftY += 12;
  }
  if (customer?.email) {
    doc.text(customer.email, leftX, leftY, { width: 250 });
    leftY += 12;
  }
  const buyerAddr = [customer?.address, customer?.city, customer?.country].filter(Boolean).join(', ');
  if (buyerAddr) {
    doc.text(buyerAddr, leftX, leftY, { width: 260 });
    leftY += 12;
  }

  doc.text(`Date: ${fmtDate(quotation.createdAt)}`, rightX, rightY, { width: 200 });
  rightY += 12;
  doc.text(`Valid Until: ${fmtDate(quotation.validUntil)}`, rightX, rightY, { width: 200 });
  rightY += 12;
  if (salesPerson) {
    doc.text(`Prepared by: ${salesPerson.firstName || ''} ${salesPerson.lastName || ''}`.trim(),
      rightX, rightY, { width: 200 });
    rightY += 12;
  }

  return Math.max(leftY, rightY) + 12;
}

// Phase 4.9 C-3: convert a line's qty + unitPrice for display when the
// quotation's displayAreaUnit differs from the line's stored unit. Only
// applies to area-based units (sqm <-> sqft). Other units (box, piece,
// pallet, etc.) pass through unchanged.
function convertLineForDisplay(item, displayAreaUnit) {
  const lineUnit = (item.unit || '').toLowerCase();
  const isArea = lineUnit === 'sqm' || lineUnit === 'sqft';
  if (!isArea || !displayAreaUnit || displayAreaUnit === lineUnit) {
    return {
      qty: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      unitLabel: item.unit || 'unit',
    };
  }
  // Need to convert. Treat the stored values as canonical for `lineUnit`
  // and emit them in `displayAreaUnit`.
  if (lineUnit === 'sqm' && displayAreaUnit === 'sqft') {
    return {
      qty: sqmToSqft(item.quantity || 0),
      unitPrice: pricePerSqmToPricePerSqft(item.unitPrice || 0),
      unitLabel: 'sqft',
    };
  }
  if (lineUnit === 'sqft' && displayAreaUnit === 'sqm') {
    return {
      qty: (Number(item.quantity || 0)) / 10.7639104167097,
      unitPrice: (Number(item.unitPrice || 0)) * 10.7639104167097,
      unitLabel: 'sqm',
    };
  }
  return {
    qty: Number(item.quantity || 0),
    unitPrice: Number(item.unitPrice || 0),
    unitLabel: item.unit || 'unit',
  };
}

/**
 * Draw a minimal-grid line items table styled for FW. Returns the Y after
 * the last row.
 *
 * Phase 4.9 C-3: signature now takes the full `quotation` object so the
 * renderer can read `displayAreaUnit` for in-place unit conversion. Old
 * `currency` param is read from quotation.currency.
 */
function drawFwItemsTable(doc, t, fonts, items, quotation, y) {
  const currency = quotation?.currency || 'USD';
  const displayAreaUnit = quotation?.displayAreaUnit || null;
  const x = 50, tableWidth = doc.page.width - 100;
  // Description, Qty, Unit, Unit Price, Total
  const colW = [tableWidth * 0.40, tableWidth * 0.10, tableWidth * 0.12,
                tableWidth * 0.18, tableWidth * 0.20];
  const colX = colW.reduce((acc, w, i) => {
    acc.push(i === 0 ? x : acc[i - 1] + colW[i - 1]);
    return acc;
  }, []);

  // Header row
  doc.save();
  doc.rect(x, y, tableWidth, 22).fill(t.primaryColor);
  doc.fillColor('#FFFFFF').font(fonts.bodyBold).fontSize(8.5);
  const headers = ['DESCRIPTION', 'QTY', 'UNIT', 'UNIT PRICE', 'TOTAL'];
  const alignH  = ['left', 'right', 'left', 'right', 'right'];
  headers.forEach((h, i) => {
    doc.text(h, colX[i] + 8, y + 7, {
      width: colW[i] - 16, align: alignH[i], characterSpacing: 1.0,
    });
  });
  doc.restore();
  y += 22;

  doc.font(fonts.body).fontSize(10).fillColor(t.ink);
  (items || []).forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.save();
      doc.rect(x, y, tableWidth, 22).fill('#FAFAF7');
      doc.restore();
    }
    doc.fillColor(t.ink);
    const desc = item.description || item.product?.name || '-';
    // Phase 4.9 C-3: convert qty + unit-price into the quotation's
    // display area unit. Total stays in storage form (it's already in
    // the document's currency, no area-conversion ambiguity).
    const view = convertLineForDisplay(item, displayAreaUnit);
    const qtyLabel = view.qty >= 100
      ? view.qty.toFixed(0)
      : view.qty.toFixed(2);
    const cells = [
      desc,
      qtyLabel,
      view.unitLabel,
      fmtMoney(view.unitPrice, currency),
      fmtMoney(item.total, currency),
    ];
    cells.forEach((c, i) => {
      doc.text(c, colX[i] + 8, y + 6, {
        width: colW[i] - 16, align: alignH[i],
      });
    });
    y += 22;
  });

  return y + 4;
}

/**
 * Phase 4.9 C-3: landed-cost breakdown table. Drawn AFTER totals when one
 * or more items has a tariffSnapshot (i.e. the destination was tariff-
 * tracked and send() persisted the rate per line). Columns:
 * Description / Origin / Tariff% / FOB/unit / Landed/unit / Landed total.
 */
function drawLandedCostBreakdown(doc, t, fonts, items, currency, y) {
  const tracked = (items || []).filter(it => it.tariffSnapshot);
  if (!tracked.length) return y;

  const x = 50, tableWidth = doc.page.width - 100;

  // Section heading
  doc.fillColor(t.steel || '#94A3B8').font(fonts.bodyBold).fontSize(8.5)
     .text('LANDED COST  ·  USA DESTINATION (TARIFF APPLIED)', x, y, { characterSpacing: 1.2 });
  y += 14;

  // Column widths sum to tableWidth
  const colW = [
    tableWidth * 0.32, // Description
    tableWidth * 0.08, // Origin
    tableWidth * 0.10, // Tariff %
    tableWidth * 0.15, // FOB/unit
    tableWidth * 0.15, // Landed/unit
    tableWidth * 0.20, // Landed total
  ];
  const colX = colW.reduce((acc, w, i) => {
    acc.push(i === 0 ? x : acc[i - 1] + colW[i - 1]);
    return acc;
  }, []);
  const headers = ['DESCRIPTION', 'ORIGIN', 'TARIFF', 'FOB/UNIT', 'LANDED/UNIT', 'LANDED TOTAL'];
  const alignH  = ['left', 'left', 'right', 'right', 'right', 'right'];

  // Header row
  doc.save();
  doc.rect(x, y, tableWidth, 20).fill(t.primaryColor);
  doc.fillColor('#FFFFFF').font(fonts.bodyBold).fontSize(7.5);
  headers.forEach((h, i) => {
    doc.text(h, colX[i] + 6, y + 6, {
      width: colW[i] - 12, align: alignH[i], characterSpacing: 0.8,
    });
  });
  doc.restore();
  y += 20;

  doc.font(fonts.body).fontSize(9).fillColor(t.ink);
  tracked.forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.save();
      doc.rect(x, y, tableWidth, 20).fill('#FAFAF7');
      doc.restore();
    }
    doc.fillColor(t.ink);
    const snap = item.tariffSnapshot || {};
    const cells = [
      item.description || item.product?.name || '-',
      item.originCountry || '-',
      `${Number(snap.ratePercent || 0).toFixed(2)}%`,
      fmtMoney(item.fobPriceUsd, currency),
      fmtMoney(item.landedCostUnit, currency),
      fmtMoney(item.landedCostTotal, currency),
    ];
    cells.forEach((c, i) => {
      doc.text(c, colX[i] + 6, y + 5, { width: colW[i] - 12, align: alignH[i] });
    });
    y += 20;
  });

  // Footer note: tariff source + earliest expiry
  const earliestExpiry = tracked
    .map(it => it.tariffSnapshot?.effectiveUntil)
    .filter(Boolean)
    .sort()[0];
  if (earliestExpiry) {
    y += 4;
    doc.fillColor(t.steel || '#94A3B8').font(fonts.body).fontSize(7.5)
       .text(`Tariff rates snapshotted at send. Earliest source expiry: ${earliestExpiry}.`,
         x, y, { width: tableWidth, align: 'left' });
    y += 10;
  }

  return y + 6;
}

/**
 * Draw the totals stack (Subtotal / Discount / Tax / TOTAL) right-aligned.
 */
function drawFwTotals(doc, t, fonts, quotation, y) {
  const tableWidth = doc.page.width - 100;
  const rightX = 50 + tableWidth * 0.60;
  const rightW = tableWidth * 0.40;
  const currency = quotation.currency || 'USD';

  doc.font(fonts.body).fontSize(10).fillColor(t.ink);

  const rows = [];
  if (quotation.subtotal != null) {
    rows.push(['Subtotal', fmtMoney(quotation.subtotal, currency)]);
  }
  if (quotation.discount) {
    const label = quotation.discountType === 'percentage'
      ? `Discount (${quotation.discount}%)`
      : 'Discount';
    rows.push([label, '-' + fmtMoney(quotation.discountAmount || quotation.discount, currency)]);
  }
  if (quotation.tax) {
    const taxLabel = quotation.taxRate ? `Tax (${quotation.taxRate}%)` : 'Tax';
    rows.push([taxLabel, fmtMoney(quotation.tax, currency)]);
  }

  rows.forEach(([label, value]) => {
    doc.fillColor(t.steel || '#94A3B8').font(fonts.body).fontSize(9.5)
       .text(label, rightX, y, { width: rightW * 0.55, align: 'left' });
    doc.fillColor(t.ink).font(fonts.body).fontSize(9.5)
       .text(value, rightX + rightW * 0.55, y, { width: rightW * 0.45, align: 'right' });
    y += 14;
  });

  y += 6;
  doc.save();
  doc.rect(rightX, y, rightW, 28).fill(t.primaryColor);
  doc.fillColor('#FFFFFF').font(fonts.bodyBold).fontSize(11)
     .text('TOTAL', rightX + 14, y + 10, { width: rightW * 0.55 - 14, align: 'left', characterSpacing: 1.0 });
  doc.fillColor('#FFFFFF').font(fonts.bodyBold).fontSize(12)
     .text(fmtMoney(quotation.total, currency),
       rightX + rightW * 0.55, y + 9,
       { width: rightW * 0.45 - 14, align: 'right' });
  doc.restore();

  return y + 36;
}

/**
 * Draw a terms block (if present) at the given Y. Returns Y after the block.
 */
function drawFwTerms(doc, t, fonts, terms, y) {
  if (!terms) return y;
  doc.fillColor(t.steel || '#94A3B8').font(fonts.bodyBold).fontSize(8.5)
     .text('TERMS & CONDITIONS', 50, y, { characterSpacing: 1.2 });
  y += 14;
  doc.fillColor(t.ink).font(fonts.body).fontSize(9.5)
     .text(terms, 50, y, { width: doc.page.width - 100 });
  y += doc.heightOfString(terms, { width: doc.page.width - 100 }) + 16;
  return y;
}

/**
 * Try to place an image. Falls through silently if the asset isn't present
 * (so a missing IronLite asset doesn't crash PDF generation).
 */
function tryImage(doc, assetPath, x, y, opts = {}) {
  try {
    if (fs.existsSync(assetPath)) {
      doc.image(assetPath, x, y, opts);
      return true;
    }
  } catch (_) {
    // ignore — image decode errors fall through to text fallback
  }
  return false;
}

// ─── FW: IRONLITE VARIANT ──────────────────────────────────────────────────

function renderFlorWayIronLite(quotation, items, customer, salesPerson, brand) {
  return new Promise((resolve, reject) => {
    try {
      const t = tokens.resolveTokens(brand);
      const { filename, filepath } =
        buildOutputPath('FW', 'ironlite', quotation.quotationNumber);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const fonts = tokens.registerBrandFonts(doc);
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      let pageNum = 1;
      let y;

      // ── Header band with IronLite I-Beam wordmark ──────────────────────
      y = drawFwHeaderBand(doc, t, 92);
      const wordmarkPlaced = tryImage(doc, t.assets.coreTechLight,
        40, 16, { height: 60 });
      if (!wordmarkPlaced) {
        // Text fallback when asset is absent
        doc.fillColor('#FFFFFF').font(fonts.display).fontSize(22)
           .text('IRONLITE', 40, 22, { characterSpacing: 2.0 });
        doc.fillColor(t.accentColor).font(fonts.body).fontSize(9)
           .text('CORE TECHNOLOGY', 40, 52, { characterSpacing: 1.5 });
      }
      // Right-aligned QUOTATION title (in the band)
      doc.fillColor('#FFFFFF').font(fonts.display).fontSize(20)
         .text('QUOTATION', doc.page.width - 220, 26,
           { width: 180, align: 'right', characterSpacing: 2.0 });
      doc.fillColor(t.accentColor).font(fonts.body).fontSize(9)
         .text(quotation.quotationNumber || '', doc.page.width - 220, 56,
           { width: 180, align: 'right' });

      // ── OEM Badge under the band, top right ─────────────────────────────
      tryImage(doc, t.assets.oemBadgeDark, doc.page.width - 110, 100,
        { width: 70 });

      // ── Customer + meta ─────────────────────────────────────────────────
      y = drawFwCustomerAndMeta(doc, t, fonts, quotation, customer, salesPerson, y + 8);

      // ── Intro paragraph (IronLite-specific tone) ────────────────────────
      doc.fillColor(t.ink).font(fonts.body).fontSize(10.5)
         .text(
           'Thank you for the opportunity to quote on our IronLite Core flooring. Engineered in Malaysia under our FlorWay manufacturing division, IronLite Core delivers a rigid limestone-composite construction with consistent dimensional stability. Pricing and terms below.',
           50, y, { width: doc.page.width - 100, lineGap: 2 });
      y += doc.heightOfString(
        'Thank you for the opportunity to quote on our IronLite Core flooring. Engineered in Malaysia under our FlorWay manufacturing division, IronLite Core delivers a rigid limestone-composite construction with consistent dimensional stability. Pricing and terms below.',
        { width: doc.page.width - 100, lineGap: 2 }) + 18;

      // ── Items table ─────────────────────────────────────────────────────
      y = drawFwItemsTable(doc, t, fonts, items, quotation, y);

      // ── Totals ──────────────────────────────────────────────────────────
      y = drawFwTotals(doc, t, fonts, quotation, y + 6);

      // ── Phase 4.9 C-3: USA landed-cost breakdown (no-op when no snapshot) ─
      y = drawLandedCostBreakdown(doc, t, fonts, items, quotation.currency || 'USD', y + 4);

      // ── Terms (if any) ──────────────────────────────────────────────────
      y = drawFwTerms(doc, t, fonts, quotation.terms, y + 18);

      // ── Sender block ────────────────────────────────────────────────────
      if (y > doc.page.height - 180) {
        drawFwFooter(doc, t, fonts, pageNum);
        doc.addPage(); pageNum += 1;
        y = drawFwHeaderBand(doc, t, 60);
      }
      drawFwSenderBlock(doc, t, fonts, y + 12);

      // ── Footer on the first page ────────────────────────────────────────
      drawFwFooter(doc, t, fonts, pageNum);

      // ── WPC: construction diagram addendum page ─────────────────────────
      if (tokens.isWpcQuotation(items)) {
        doc.addPage(); pageNum += 1;
        const headerY = drawFwHeaderBand(doc, t, 60);
        doc.fillColor('#FFFFFF').font(fonts.display).fontSize(16)
           .text('IRONLITE CORE CONSTRUCTION', 40, 22,
             { width: doc.page.width - 80, align: 'left', characterSpacing: 1.8 });

        const diagramY = headerY + 8;
        const placed = tryImage(doc, t.assets.diagram1600, 50, diagramY,
          { width: doc.page.width - 100 });
        if (!placed) {
          // Text fallback — describe the layer stack
          doc.fillColor(t.ink).font(fonts.body).fontSize(11);
          [
            '1. Wear layer  ·  commercial-grade urethane',
            '2. Decor film  ·  4K-printed photo layer',
            '3. IronLite Core  ·  rigid limestone composite',
            '4. Pre-attached underlay  ·  IXPE acoustic',
          ].forEach((line, i) => {
            doc.text(line, 50, diagramY + i * 22, { width: doc.page.width - 100 });
          });
        }

        drawFwFooter(doc, t, fonts, pageNum);
      }

      doc.end();
      stream.on('finish', () => resolve({ filename, filepath: path.resolve(filepath) }));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// ─── FW: GENERIC VARIANT (default) ─────────────────────────────────────────

function renderFlorWayGeneric(quotation, items, customer, salesPerson, brand) {
  return new Promise((resolve, reject) => {
    try {
      const t = tokens.resolveTokens(brand);
      const { filename, filepath } =
        buildOutputPath('FW', 'generic', quotation.quotationNumber);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const fonts = tokens.registerBrandFonts(doc);
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      let pageNum = 1;
      let y;

      // ── Header band with text wordmark (no IronLite imagery) ────────────
      y = drawFwHeaderBand(doc, t, 78);
      doc.fillColor('#FFFFFF').font(fonts.display).fontSize(22)
         .text('FLORWAY', 40, 22, { characterSpacing: 2.0 });
      doc.fillColor(t.accentColor).font(fonts.body).fontSize(9)
         .text('SDN. BHD.', 40, 52, { characterSpacing: 1.5 });
      doc.fillColor('#FFFFFF').font(fonts.display).fontSize(20)
         .text('QUOTATION', doc.page.width - 220, 22,
           { width: 180, align: 'right', characterSpacing: 2.0 });
      doc.fillColor(t.accentColor).font(fonts.body).fontSize(9)
         .text(quotation.quotationNumber || '', doc.page.width - 220, 52,
           { width: 180, align: 'right' });

      // ── Customer + meta ─────────────────────────────────────────────────
      y = drawFwCustomerAndMeta(doc, t, fonts, quotation, customer, salesPerson, y);

      // ── Intro paragraph (generic — WPC Hybrid Construction wording) ─────
      doc.fillColor(t.ink).font(fonts.body).fontSize(10.5)
         .text(
           'Thank you for the opportunity to quote on our WPC Hybrid Construction flooring, manufactured in Malaysia by FlorWay Sdn. Bhd. Pricing and commercial terms below.',
           50, y, { width: doc.page.width - 100, lineGap: 2 });
      y += doc.heightOfString(
        'Thank you for the opportunity to quote on our WPC Hybrid Construction flooring, manufactured in Malaysia by FlorWay Sdn. Bhd. Pricing and commercial terms below.',
        { width: doc.page.width - 100, lineGap: 2 }) + 18;

      // ── Items table ─────────────────────────────────────────────────────
      y = drawFwItemsTable(doc, t, fonts, items, quotation, y);

      // ── Totals ──────────────────────────────────────────────────────────
      y = drawFwTotals(doc, t, fonts, quotation, y + 6);

      // ── Phase 4.9 C-3: USA landed-cost breakdown (no-op when no snapshot) ─
      y = drawLandedCostBreakdown(doc, t, fonts, items, quotation.currency || 'USD', y + 4);

      // ── Terms ───────────────────────────────────────────────────────────
      y = drawFwTerms(doc, t, fonts, quotation.terms, y + 18);

      // ── Sender block ────────────────────────────────────────────────────
      if (y > doc.page.height - 180) {
        drawFwFooter(doc, t, fonts, pageNum);
        doc.addPage(); pageNum += 1;
        y = drawFwHeaderBand(doc, t, 50);
      }
      drawFwSenderBlock(doc, t, fonts, y + 12);

      drawFwFooter(doc, t, fonts, pageNum);

      doc.end();
      stream.on('finish', () => resolve({ filename, filepath: path.resolve(filepath) }));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// ─── FW: PRIVATE LABEL VARIANT (placeholder) ───────────────────────────────

function renderFlorWayPrivateLabel(quotation, items, customer, salesPerson, brand) {
  return new Promise((resolve, reject) => {
    try {
      const t = tokens.resolveTokens(brand);
      const { filename, filepath } =
        buildOutputPath('FW', 'private_label', quotation.quotationNumber);

      const buyerBrand = customer?.privateLabelProductName || customer?.companyName || 'Your Brand';

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const fonts = tokens.registerBrandFonts(doc);
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      let pageNum = 1;
      let y;

      // ── Header band ─────────────────────────────────────────────────────
      y = drawFwHeaderBand(doc, t, 78);
      doc.fillColor('#FFFFFF').font(fonts.display).fontSize(22)
         .text(buyerBrand.toUpperCase().slice(0, 24), 40, 22,
           { characterSpacing: 2.0 });
      doc.fillColor(t.accentColor).font(fonts.body).fontSize(9)
         .text('PRIVATE LABEL', 40, 52, { characterSpacing: 1.5 });
      doc.fillColor('#FFFFFF').font(fonts.display).fontSize(20)
         .text('QUOTATION', doc.page.width - 220, 22,
           { width: 180, align: 'right', characterSpacing: 2.0 });
      doc.fillColor(t.accentColor).font(fonts.body).fontSize(9)
         .text(quotation.quotationNumber || '', doc.page.width - 220, 52,
           { width: 180, align: 'right' });

      // ── Placeholder notice ──────────────────────────────────────────────
      doc.save();
      doc.rect(50, y, doc.page.width - 100, 64).fill('#FEF3C7'); // soft amber
      doc.fillColor('#92400E').font(fonts.bodyBold).fontSize(10)
         .text('PRIVATE LABEL TEMPLATE  ·  IN DEVELOPMENT', 64, y + 12,
           { characterSpacing: 1.5 });
      doc.fillColor('#78350F').font(fonts.body).fontSize(9.5)
         .text(
           `This quotation is being rendered with the FlorWay generic layout. The full private-label template, including "Manufactured exclusively for ${buyerBrand}" framing and ${buyerBrand}-labelled construction diagram, will ship once the first OEM private-label buyer signs.`,
           64, y + 32, { width: doc.page.width - 128, lineGap: 1 });
      doc.restore();
      y += 80;

      // ── Customer + meta ─────────────────────────────────────────────────
      y = drawFwCustomerAndMeta(doc, t, fonts, quotation, customer, salesPerson, y);

      // ── Intro paragraph ─────────────────────────────────────────────────
      doc.fillColor(t.ink).font(fonts.body).fontSize(10.5)
         .text(
           `Manufactured exclusively for ${buyerBrand} by FlorWay Sdn. Bhd. in Malaysia. Pricing and commercial terms below.`,
           50, y, { width: doc.page.width - 100, lineGap: 2 });
      y += doc.heightOfString(
        `Manufactured exclusively for ${buyerBrand} by FlorWay Sdn. Bhd. in Malaysia. Pricing and commercial terms below.`,
        { width: doc.page.width - 100, lineGap: 2 }) + 18;

      // ── Items / Totals / Terms / Sender (shared) ────────────────────────
      y = drawFwItemsTable(doc, t, fonts, items, quotation, y);
      y = drawFwTotals(doc, t, fonts, quotation, y + 6);
      y = drawLandedCostBreakdown(doc, t, fonts, items, quotation.currency || 'USD', y + 4);
      y = drawFwTerms(doc, t, fonts, quotation.terms, y + 18);

      if (y > doc.page.height - 180) {
        drawFwFooter(doc, t, fonts, pageNum);
        doc.addPage(); pageNum += 1;
        y = drawFwHeaderBand(doc, t, 50);
      }
      drawFwSenderBlock(doc, t, fonts, y + 12);

      drawFwFooter(doc, t, fonts, pageNum);

      doc.end();
      stream.on('finish', () => resolve({ filename, filepath: path.resolve(filepath) }));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  dispatch,
  // Exported for unit testing or callers that want to bypass dispatch
  renderFlorWayIronLite,
  renderFlorWayGeneric,
  renderFlorWayPrivateLabel,
  renderSovernHouseClassic,
};
