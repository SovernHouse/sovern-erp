const u = require('../../utils/unitConversion');

describe('unitConversion (Phase 4.9 C-3)', () => {
  test('sqm <-> sqft round-trips within 1e-9', () => {
    const v = 12.5;
    expect(Math.abs(u.sqftToSqm(u.sqmToSqft(v)) - v)).toBeLessThan(1e-9);
  });

  test('mm <-> inch round-trips within 1e-9', () => {
    const v = 1828.8;
    expect(Math.abs(u.inchToMm(u.mmToInch(v)) - v)).toBeLessThan(1e-9);
  });

  test('1 sqm equals about 10.7639 sqft', () => {
    expect(u.sqmToSqft(1)).toBeCloseTo(10.7639, 4);
  });

  test('25.4 mm equals exactly 1 inch', () => {
    expect(u.mmToInch(25.4)).toBeCloseTo(1.0, 9);
  });

  test('pricePerSqmToPricePerSqft halves cost when area unit grows by factor', () => {
    expect(u.pricePerSqmToPricePerSqft(10.7639104167097)).toBeCloseTo(1.0, 6);
  });

  test('displayArea passes through canonical when units match', () => {
    expect(u.displayArea(5, 'sqm')).toBe(5);
  });

  test('displayArea converts sqm to sqft when display unit differs', () => {
    expect(u.displayArea(1, 'sqft')).toBeCloseTo(10.7639, 4);
  });

  test('displayDimension passes through canonical mm when matching', () => {
    expect(u.displayDimension(1219.2, 'mm')).toBe(1219.2);
  });

  test('displayDimension converts mm to inch when display unit differs', () => {
    expect(u.displayDimension(25.4, 'inch')).toBeCloseTo(1.0, 9);
  });

  test('AREA_LABEL provides human suffixes', () => {
    expect(u.AREA_LABEL.sqm).toBe('m²');
    expect(u.AREA_LABEL.sqft).toBe('ft²');
  });

  test('null values pass through display helpers without error', () => {
    expect(u.displayArea(null, 'sqft')).toBeNull();
    expect(u.displayDimension(null, 'inch')).toBeNull();
    expect(u.displayPricePerArea(null, 'sqft')).toBeNull();
  });
});
