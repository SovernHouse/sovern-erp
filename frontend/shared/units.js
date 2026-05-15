// Shared unit conversion helpers (Phase 4.9c). Mirrors backend/utils/unitConversion.js.
// Used by admin-portal + customer-portal + factory-portal for consistent area/dimension rendering.

export const SQFT_PER_SQM = 10.7639104167097;
export const INCH_PER_MM  = 1 / 25.4;

export const sqmToSqft  = (v) => Number(v) * SQFT_PER_SQM;
export const sqftToSqm  = (v) => Number(v) / SQFT_PER_SQM;
export const mmToInch   = (v) => Number(v) * INCH_PER_MM;
export const inchToMm   = (v) => Number(v) / INCH_PER_MM;

export const pricePerSqmToPricePerSqft = (v) => Number(v) / SQFT_PER_SQM;
export const pricePerSqftToPricePerSqm = (v) => Number(v) * SQFT_PER_SQM;

export const displayArea = (canonicalSqm, unit) => {
  if (canonicalSqm == null || canonicalSqm === '') return null;
  return unit === 'sqft' ? sqmToSqft(canonicalSqm) : Number(canonicalSqm);
};
export const displayDimension = (canonicalMm, unit) => {
  if (canonicalMm == null || canonicalMm === '') return null;
  return unit === 'inch' ? mmToInch(canonicalMm) : Number(canonicalMm);
};
export const displayPricePerArea = (canonicalUsdPerSqm, unit) => {
  if (canonicalUsdPerSqm == null || canonicalUsdPerSqm === '') return null;
  return unit === 'sqft' ? pricePerSqmToPricePerSqft(canonicalUsdPerSqm) : Number(canonicalUsdPerSqm);
};

export const AREA_LABEL     = { sqm: 'm²', sqft: 'ft²' };
export const DIM_LABEL      = { mm: 'mm',  inch: 'in'  };
export const PRICE_PER_AREA = { sqm: 'USD/m²', sqft: 'USD/ft²' };
