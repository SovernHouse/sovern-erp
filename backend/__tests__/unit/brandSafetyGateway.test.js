/**
 * brandSafetyGateway — rule #9 / L-068 central lock.
 *
 * Locks the per-brand marker regex shut. Two incidents in 36 hours
 * justified centralising the assertion. This suite enforces:
 *   - Foreign markers in any content field throw BrandLeakError.
 *   - Display name mismatches throw BrandLeakError.
 *   - Missing brandCode throws BrandLeakError.
 *   - Unknown brandCode throws BrandLeakError.
 *   - Resilient flooring under SH throws BrandLeakError.
 *   - Correctly-branded content passes silently.
 */

const {
  assertBrandSafe,
  assertNoForeignMarkers,
  assertResilientNotSH,
  isResilient,
  BrandLeakError,
} = require('../../services/brandSafetyGateway');

describe('brandSafetyGateway', () => {
  describe('assertNoForeignMarkers', () => {
    test('SH content under FW throws (Sovern House marker)', () => {
      expect(() => assertNoForeignMarkers('We are Sovern House', 'FW', 'body'))
        .toThrow(BrandLeakError);
    });

    test('SH URL under FW throws (sovernhouse.co)', () => {
      expect(() => assertNoForeignMarkers('Visit <a href="https://sovernhouse.co">us</a>', 'FW', 'body'))
        .toThrow(/Sovern House/i);
    });

    test('SH tagline under FW throws', () => {
      expect(() => assertNoForeignMarkers('Your buying office in Asia', 'FW', 'sig'))
        .toThrow(/Sovern House/i);
    });

    test('SH legal entity under HH throws', () => {
      expect(() => assertNoForeignMarkers('New Route International Exchange Co., Ltd.', 'HH', 'footer'))
        .toThrow(/Sovern House/i);
    });

    test('FW signature under SH throws', () => {
      expect(() => assertNoForeignMarkers('FlorWay Sdn. Bhd. (Malaysia)', 'SH', 'sig'))
        .toThrow(/FlorWay/i);
    });

    test('HH signature under SH throws', () => {
      expect(() => assertNoForeignMarkers('Anhui HanHua Building Materials Technology', 'SH', 'sig'))
        .toThrow(/HanHua/i);
    });

    test('FW content under FW does not throw', () => {
      expect(() => assertNoForeignMarkers('FlorWay Sdn. Bhd. — Malaysia', 'FW', 'sig')).not.toThrow();
    });

    test('FW <-> HH co-mention is allowed (Resilient family, seeded signatures cross-reference)', () => {
      // FW signature canonically mentions HH (both factories in the
      // operator's brand-deck-approved layout). Same for HH mentioning
      // FW. This co-mention is the rule #9 implementation of "FW + HH
      // are a Resilient family"; only SH must stay separated.
      expect(() => assertNoForeignMarkers(
        'FlorWay Sdn. Bhd. (Malaysia)\nAnhui HanHua Building Materials Technology Co., Ltd. (China)',
        'FW', 'sig'
      )).not.toThrow();
      expect(() => assertNoForeignMarkers(
        'Anhui HanHua Building Materials\nFlorWay Sdn. Bhd.',
        'HH', 'sig'
      )).not.toThrow();
    });

    test('SH content under SH does not throw', () => {
      expect(() => assertNoForeignMarkers('Sovern House — your buying office in Asia', 'SH', 'sig')).not.toThrow();
    });

    test('Plain neutral content does not throw for any brand', () => {
      const neutral = 'Hi team, we ship LVT and SPC into US distributors.';
      expect(() => assertNoForeignMarkers(neutral, 'SH', 'body')).not.toThrow();
      expect(() => assertNoForeignMarkers(neutral, 'FW', 'body')).not.toThrow();
      expect(() => assertNoForeignMarkers(neutral, 'HH', 'body')).not.toThrow();
    });

    test('Empty/null content is a no-op', () => {
      expect(() => assertNoForeignMarkers('', 'FW', 'body')).not.toThrow();
      expect(() => assertNoForeignMarkers(null, 'FW', 'body')).not.toThrow();
      expect(() => assertNoForeignMarkers(undefined, 'FW', 'body')).not.toThrow();
    });
  });

  describe('assertBrandSafe', () => {
    test('missing brandCode throws', () => {
      expect(() => assertBrandSafe({})).toThrow(/brandCode is required/);
    });

    test('unknown brandCode throws', () => {
      expect(() => assertBrandSafe({ brandCode: 'XX' })).toThrow(/unknown brandCode/i);
    });

    test('fromDisplayName mismatch throws (BPI incident exact scenario)', () => {
      expect(() => assertBrandSafe({
        brandCode: 'FW',
        expectedFromDisplayName: 'FlorWay | Alex',
        actualFromDisplayName: 'Sovern House | Alex',
      })).toThrow(/Sovern House.*does not match.*FW/);
    });

    test('contentFields with SH marker under FW throws', () => {
      expect(() => assertBrandSafe({
        brandCode: 'FW',
        contentFields: {
          signatureHtml: '<div>sovernhouse.co</div>',
        },
      })).toThrow(/signatureHtml.*FW.*Sovern House/i);
    });

    test('Correctly-branded FW passes silently', () => {
      expect(() => assertBrandSafe({
        brandCode: 'FW',
        expectedFromDisplayName: 'FlorWay | Alex',
        actualFromDisplayName: 'FlorWay | Alex',
        contentFields: {
          signatureHtml: '<div>FlorWay Sdn. Bhd. (Malaysia)</div>',
          bodyText: 'Hi team, our factory in Malaysia ships LVT and SPC.',
        },
      })).not.toThrow();
    });
  });

  describe('isResilient + assertResilientNotSH', () => {
    test('isResilient detects LVT, SPC, WPC, vinyl-sheet, rigid-core', () => {
      expect(isResilient(['lvt'])).toBe(true);
      expect(isResilient(['spc'])).toBe(true);
      expect(isResilient(['wpc'])).toBe(true);
      expect(isResilient(['vinyl-sheet'])).toBe(true);
      expect(isResilient(['rigid-core'])).toBe(true);
      expect(isResilient(['engineered-spc'])).toBe(true);
    });

    test('isResilient false for non-resilient', () => {
      expect(isResilient(['hardwood'])).toBe(false);
      expect(isResilient(['laminate'])).toBe(false);
      expect(isResilient(['ceramic-tile'])).toBe(false);
      expect(isResilient([])).toBe(false);
    });

    test('isResilient accepts comma-string or array', () => {
      expect(isResilient('lvt')).toBe(true);
      expect(isResilient(['hardwood', 'lvt'])).toBe(true);
    });

    test('assertResilientNotSH throws for SH + lvt', () => {
      expect(() => assertResilientNotSH({ brandCode: 'SH', productSlugs: ['lvt'] }))
        .toThrow(/Resilient flooring.*cannot be SH/);
    });

    test('assertResilientNotSH passes for FW + lvt', () => {
      expect(() => assertResilientNotSH({ brandCode: 'FW', productSlugs: ['lvt'] })).not.toThrow();
    });

    test('assertResilientNotSH passes for SH + non-resilient', () => {
      expect(() => assertResilientNotSH({ brandCode: 'SH', productSlugs: ['hardwood'] })).not.toThrow();
    });
  });

  describe('BrandLeakError shape', () => {
    test('carries entityId, brandCode, leakField, foreignBrand', () => {
      try {
        assertBrandSafe({
          brandCode: 'FW',
          contentFields: { sig: 'Sovern House is...' },
          entityId: 'oe-1234',
        });
      } catch (e) {
        expect(e).toBeInstanceOf(BrandLeakError);
        expect(e.entityId).toBe('oe-1234');
        expect(e.brandCode).toBe('FW');
        expect(e.leakField).toBe('sig');
        expect(e.foreignBrand).toBe('SH');
      }
    });
  });
});
