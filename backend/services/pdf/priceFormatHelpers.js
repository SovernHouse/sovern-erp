/**
 * Shared display helpers for every buyer / factory-facing document.
 *
 * 2026-05-19 directive: the conventions decided on the PriceList renderer
 * (FOB PRICE column header + origin port subline, "M2" unit, "$N.NN/M2"
 * price formatting) must carry across PriceList, Quotation, ProformaInvoice,
 * SalesOrder, Invoice, PurchaseOrder, and any future PDF/email renderer.
 *
 * One source of truth lives here. Every renderer imports from this module;
 * any new convention added is centralised and rolls out everywhere on the
 * same commit.
 *
 * Shape contract:
 *   displayUnit(unit)             — UI-visible unit label. 'sqm' → 'M2'.
 *   displayPrice(value, currency, unit) — '$9.10/M2'. Currency code from
 *                                  the row's currency field; unit from
 *                                  the item or list default.
 *   originPortFor(brandCode, originCountry?) — primary export port for
 *                                  the given brand or origin. Used as the
 *                                  subline under the FOB PRICE column.
 *   fobPriceHeader(brandCode)     — main header label ('FOB PRICE') plus
 *                                  the port subline, returned as a tuple
 *                                  the renderer can use to draw two lines.
 */

const { formatCurrency } = require('../../utils/helpers');

// Unit normalisation. 'sqm' is the canonical column value on PriceListItem,
// Quotation line items, etc.; display layer surfaces "M2" because trade
// buyers expect the unit notation, not the database token.
const UNIT_DISPLAY_MAP = {
  sqm: 'M2',
  m2: 'M2',
  sq_m: 'M2',
  squaremeter: 'M2',
  sqft: 'SQFT',
  ft2: 'SQFT',
  piece: 'PC',
  pieces: 'PC',
  pcs: 'PC',
  pc: 'PC',
  box: 'BOX',
  pallet: 'PALLET',
  container: 'CONTAINER',
  roll: 'ROLL',
  kg: 'KG',
  ton: 'T',
  tons: 'T',
  lb: 'LB',
  lbs: 'LB',
};

function displayUnit(unit) {
  if (!unit) return 'M2';
  const key = String(unit).trim().toLowerCase();
  if (UNIT_DISPLAY_MAP[key]) return UNIT_DISPLAY_MAP[key];
  // Unknown unit: surface in upper-case so it looks intentional.
  return String(unit).trim().toUpperCase();
}

// Origin-port lookup. Used as the subline below the FOB PRICE column
// header so a buyer knows the loading port at a glance.
//
// FW (FlorWay, Malaysia) — Port Klang is the primary container port
//   serving the Matang/Taiping facility.
// HH (Anhui HanHua, China) — Shanghai is the closest deep-water port
//   for Anhui-province exports. Some Anhui factories also use Ningbo;
//   Alex confirmed Shanghai is canonical for HanHua.
// SH (Sovern House) — general trading, no fixed origin; falls back to
//   blank so renderers don't print a misleading port.
const BRAND_DEFAULT_PORT = {
  FW: 'Port Klang',
  HH: 'Shanghai',
  SH: '',
};

// Country-level fallback when brand isn't set but origin is known.
const COUNTRY_DEFAULT_PORT = {
  MY: 'Port Klang',
  Malaysia: 'Port Klang',
  CN: 'Shanghai',
  China: 'Shanghai',
};

function originPortFor(brandCode, originCountry) {
  if (brandCode && BRAND_DEFAULT_PORT[String(brandCode).toUpperCase()] !== undefined) {
    return BRAND_DEFAULT_PORT[String(brandCode).toUpperCase()];
  }
  if (originCountry && COUNTRY_DEFAULT_PORT[originCountry]) {
    return COUNTRY_DEFAULT_PORT[originCountry];
  }
  return '';
}

// Buyer-facing price string. Renderer-agnostic: returns a string the
// caller can drop into a cell text / HTML span. Pattern: "$9.10/M2".
// If unit is missing, default to /M2 since flooring is the primary
// vertical (Phase 4.28m convention).
function displayPrice(value, currency, unit) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  let money;
  try { money = formatCurrency(n, currency || 'USD'); }
  catch (_) { money = `${currency || 'USD'} ${n.toFixed(2)}`; }
  const u = displayUnit(unit);
  return u ? `${money}/${u}` : money;
}

// FOB PRICE header pair the renderer can lay out as two stacked text
// lines: the main label on top, the port subline below in a smaller /
// grey font. The caller decides positioning + style.
function fobPriceHeader(brandCode, originCountry) {
  return {
    label: 'FOB PRICE',
    subline: originPortFor(brandCode, originCountry),
  };
}

module.exports = {
  displayUnit,
  displayPrice,
  originPortFor,
  fobPriceHeader,
  UNIT_DISPLAY_MAP,
  BRAND_DEFAULT_PORT,
};
