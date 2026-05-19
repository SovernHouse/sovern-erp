// Phase 4.28i — sensitive compensation vocabulary guard.
//
// 2026-05-19: the data-fix script wrote "Buyer-facing FOB inclusive of
// factory commissions" into PriceList.description on both new FW + HH
// lists. The string would have rendered onto every PDF for those lists,
// leaking Sovern's compensation model to buyers. Existing brand-safety
// gateway checked for FOREIGN brand markers but had no check for
// FORBIDDEN vocabulary (commission / markup / margin) regardless of
// brand.
//
// What this test locks:
//   1. Clean prose passes (no false positives on neutral copy).
//   2. Each forbidden term throws BrandLeakError with leakField set.
//   3. Plural / suffixed forms (commissions, markups, kickbacks) caught.
//   4. Case-insensitive.
//   5. The pattern set itself is exported so callers (and other tests)
//      can probe what's being matched.

const {
  assertNoSensitiveCompensationVocab,
  BrandLeakError,
  SENSITIVE_COMPENSATION_PATTERNS,
} = require('../../services/brandSafetyGateway');

describe('Phase 4.28i — sensitive compensation vocabulary guard', () => {
  describe('clean prose passes', () => {
    const cleanSamples = [
      'IronLite Core engineered SPC flooring, Malaysia origin via FlorWay Sdn. Bhd.',
      'Prices per FlorWay sales sheet dated 14 May 2026.',
      'US import duty on rigid-core flooring is approximately 15.5%.',
      'Final tariff amount must be confirmed with the factory at the time of placing the order.',
      'Standard payment terms: 30% deposit, 70% before shipment.',
      '180 mm x 1220 mm plank, 0.5 mm wear layer, 1 mm IXPE underlay.',
      '', // empty
      null, // null
      undefined, // undefined
    ];
    test.each(cleanSamples)('passes: %s', (sample) => {
      expect(() => assertNoSensitiveCompensationVocab(sample, 'TestField')).not.toThrow();
    });
  });

  describe('forbidden terms throw BrandLeakError', () => {
    const cases = [
      { word: 'commission',        text: 'Includes our 7% commission.' },
      { word: 'commissions',       text: 'Inclusive of factory commissions.' },
      { word: 'commissioned',      text: 'Sovern was commissioned by the factory.' },
      { word: 'markup',            text: 'Our markup is built in.' },
      { word: 'markups',           text: 'No additional markups apply.' },
      { word: 'mark-up',           text: 'A mark-up of 7% applies.' },
      { word: 'sourcing fee',      text: 'Sovern sourcing fee included.' },
      { word: 'buying commission', text: 'Our buying commission is 5%.' },
      { word: 'agency fee',        text: 'An agency fee of 3% applies.' },
      { word: 'Sales Rep Agreement', text: 'Per the Sales Rep Agreement signed 2025.' },
      { word: 'profit margin',     text: 'This protects our profit margin.' },
      { word: 'profit margins',    text: 'Healthy profit margins for everyone.' },
      { word: 'factory rebate',    text: 'A factory rebate flows back to Sovern.' },
      { word: 'supplier rebate',   text: 'Supplier rebate paid quarterly.' },
      { word: 'kickback',          text: 'No kickback to any party.' },
      { word: 'kick-back',         text: 'There is no kick-back arrangement.' },
    ];

    test.each(cases)('refuses "$word"', ({ word, text }) => {
      let caught;
      try {
        assertNoSensitiveCompensationVocab(text, 'PriceList.description', 'pl-123');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BrandLeakError);
      expect(caught.leakField).toBe('PriceList.description');
      expect(caught.entityId).toBe('pl-123');
      expect(caught.message).toMatch(/Sensitive vocabulary/i);
    });
  });

  test('case-insensitive (uppercase Commission also caught)', () => {
    expect(() => assertNoSensitiveCompensationVocab(
      'COMMISSION rate is confidential.', 'X'
    )).toThrow(BrandLeakError);
  });

  test('pattern set has every term we expect to forbid', () => {
    const names = SENSITIVE_COMPENSATION_PATTERNS.map(p => p.name);
    for (const expected of [
      'commission', 'markup', 'sourcing fee', 'buying commission',
      'agency fee', 'Sales Rep Agreement', 'profit margin',
      'factory rebate', 'kickback',
    ]) {
      expect(names).toContain(expected);
    }
  });

  test('non-string content silently passes (no throw)', () => {
    expect(() => assertNoSensitiveCompensationVocab(12345, 'X')).not.toThrow();
    expect(() => assertNoSensitiveCompensationVocab({}, 'X')).not.toThrow();
    expect(() => assertNoSensitiveCompensationVocab([], 'X')).not.toThrow();
  });

  test('does NOT false-positive on word substrings (e.g. "commissioned officer" ok? — actually we DO catch this; lock the behavior)', () => {
    // "commission" is the root; "commissioned" is the inflection and we
    // intentionally catch it. If you ever want to whitelist a sentence
    // mentioning a real-world military officer in factory-visible copy,
    // rephrase rather than weaken the regex.
    expect(() => assertNoSensitiveCompensationVocab(
      'A commissioned officer visited the factory.', 'X'
    )).toThrow(BrandLeakError);
  });

  test('the 2026-05-19 incident string would have been refused', () => {
    const leaked = 'Engineered three-layer SPC, ex-Anhui HanHua (China). Buyer-facing FOB inclusive of factory commissions per the FlorWay HanHua sales sheet dated May 2026.';
    expect(() => assertNoSensitiveCompensationVocab(leaked, 'PriceList.description'))
      .toThrow(BrandLeakError);
  });
});
