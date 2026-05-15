/**
 * Unit conversion helpers for area (sqm/sqft) and dimension (mm/inch).
 *
 * Storage is always canonical: prices per sqm, dimensions in mm. The
 * helpers convert at the display / PDF render boundary so a quotation
 * can be presented to a US buyer in sqft + inches while the database
 * still holds one authoritative number.
 *
 * Conversion factors are exact ratios (no rounding). Round only at the
 * UI / PDF render layer (toFixed(2)) so successive convert-back-and-forth
 * does not drift.
 */

const SQFT_PER_SQM = 10.7639104167097;
const INCH_PER_MM  = 1 / 25.4;

function sqmToSqft(sqm)   { return Number(sqm) * SQFT_PER_SQM; }
function sqftToSqm(sqft)  { return Number(sqft) / SQFT_PER_SQM; }
function mmToInch(mm)     { return Number(mm) * INCH_PER_MM; }
function inchToMm(inch)   { return Number(inch) / INCH_PER_MM; }

// Price-per-area conversion. If the canonical FOB is USD per sqm and we
// want to display USD per sqft, divide by sqft-per-sqm.
function pricePerSqmToPricePerSqft(p) { return Number(p) / SQFT_PER_SQM; }
function pricePerSqftToPricePerSqm(p) { return Number(p) * SQFT_PER_SQM; }

// Generic display helpers. `value` is always the canonical number; the
// caller picks the unit it wants to render.
function displayArea(canonicalSqm, displayUnit) {
  if (canonicalSqm == null) return null;
  return displayUnit === 'sqft' ? sqmToSqft(canonicalSqm) : Number(canonicalSqm);
}
function displayDimension(canonicalMm, displayUnit) {
  if (canonicalMm == null) return null;
  return displayUnit === 'inch' ? mmToInch(canonicalMm) : Number(canonicalMm);
}
function displayPricePerArea(canonicalUsdPerSqm, displayUnit) {
  if (canonicalUsdPerSqm == null) return null;
  return displayUnit === 'sqft'
    ? pricePerSqmToPricePerSqft(canonicalUsdPerSqm)
    : Number(canonicalUsdPerSqm);
}

// User-facing unit suffixes.
const AREA_LABEL      = { sqm: 'm²', sqft: 'ft²' };
const DIM_LABEL       = { mm: 'mm',  inch: 'in'  };
const PRICE_PER_AREA  = { sqm: 'USD/m²', sqft: 'USD/ft²' };

module.exports = {
  SQFT_PER_SQM,
  INCH_PER_MM,
  sqmToSqft, sqftToSqm,
  mmToInch, inchToMm,
  pricePerSqmToPricePerSqft, pricePerSqftToPricePerSqm,
  displayArea, displayDimension, displayPricePerArea,
  AREA_LABEL, DIM_LABEL, PRICE_PER_AREA,
};
