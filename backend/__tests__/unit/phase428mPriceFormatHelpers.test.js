// Phase 4.28m — shared display helpers for buyer/factory-facing PDFs.
//
// Locks the conventions Alex called out on 2026-05-19: 'sqm' → 'M2',
// price formatted as '$N.NN/M2', port subline lookup per brand
// (Port Klang for FW, Shanghai for HH).

const {
  displayUnit, displayPrice, originPortFor, fobPriceHeader,
} = require('../../services/pdf/priceFormatHelpers');

describe('Phase 4.28m — price format helpers', () => {
  describe('displayUnit', () => {
    test.each([
      ['sqm',           'M2'],
      ['SQM',           'M2'],
      ['m2',            'M2'],
      ['squaremeter',   'M2'],
      ['sqft',          'SQFT'],
      ['ft2',           'SQFT'],
      ['piece',         'PC'],
      ['pcs',           'PC'],
      ['box',           'BOX'],
      ['pallet',        'PALLET'],
      ['container',     'CONTAINER'],
      ['unit',          'UNIT'],
      ['',              'M2'],  // empty → flooring default
      [null,            'M2'],
      [undefined,       'M2'],
    ])('displayUnit(%j) → %j', (input, expected) => {
      expect(displayUnit(input)).toBe(expected);
    });
  });

  describe('displayPrice', () => {
    test('formats USD per m2', () => {
      expect(displayPrice(9.741, 'USD', 'sqm')).toMatch(/\$9\.74\/M2/);
    });
    test('formats USD per sqft', () => {
      expect(displayPrice(0.905, 'USD', 'sqft')).toMatch(/\$0\.91\/SQFT/);
    });
    test('empty value returns dash', () => {
      expect(displayPrice(null, 'USD', 'sqm')).toBe('—');
      expect(displayPrice('', 'USD', 'sqm')).toBe('—');
    });
    test('non-numeric returns dash', () => {
      expect(displayPrice('abc', 'USD', 'sqm')).toBe('—');
    });
    test('defaults unit to M2 when absent', () => {
      expect(displayPrice(10, 'USD')).toMatch(/\$10\.00\/M2/);
    });
  });

  describe('originPortFor', () => {
    test.each([
      ['FW',   null,        'Port Klang'],
      ['HH',   null,        'Shanghai'],
      ['SH',   null,        ''],
      [null,   'Malaysia',  'Port Klang'],
      [null,   'China',     'Shanghai'],
      [null,   'MY',        'Port Klang'],
      [null,   'CN',        'Shanghai'],
      ['fw',   null,        'Port Klang'],  // case-insensitive brand
      [null,   null,        ''],
    ])('originPortFor(%j, %j) → %j', (brand, country, expected) => {
      expect(originPortFor(brand, country)).toBe(expected);
    });
  });

  describe('fobPriceHeader', () => {
    test('FW returns FOB PRICE + Port Klang', () => {
      expect(fobPriceHeader('FW')).toEqual({ label: 'FOB PRICE', subline: 'Port Klang' });
    });
    test('HH returns FOB PRICE + Shanghai', () => {
      expect(fobPriceHeader('HH')).toEqual({ label: 'FOB PRICE', subline: 'Shanghai' });
    });
    test('SH returns FOB PRICE + empty subline', () => {
      expect(fobPriceHeader('SH')).toEqual({ label: 'FOB PRICE', subline: '' });
    });
  });
});
