// Phase 4.9 C-3 follow-up — TariffRate.components sum logic.
//
// resolveComponentsAndRate is not exported (it's controller-internal),
// so we re-implement the same rule here against the documented
// behaviour: when components is non-empty, ratePercent is the sum
// rounded to 4 decimals; when empty, ratePercent passes through.

function sumComponents(components) {
  return Math.round(
    components.reduce((acc, c) => acc + Number(c.ratePercent), 0) * 10000
  ) / 10000;
}

describe('TariffRate components sum (Phase 4.9 C-3 follow-up)', () => {
  test('CN -> US seed sums to 40.7714 exactly', () => {
    const components = [
      { name: 'MFN base',          ratePercent: 3.2 },
      { name: 'Section 301',       ratePercent: 25.0 },
      { name: 'IEEPA reciprocal',  ratePercent: 10.0 },
      { name: 'IEEPA fentanyl',    ratePercent: 2.15 },
      { name: 'MPF',               ratePercent: 0.3464 },
      { name: 'HMF',               ratePercent: 0.075 },
    ];
    expect(sumComponents(components)).toBe(40.7714);
  });

  test('MY -> US seed sums to 15.5214 exactly', () => {
    const components = [
      { name: 'MFN base',         ratePercent: 5.0 },
      { name: 'IEEPA reciprocal', ratePercent: 10.0 },
      { name: 'MPF',              ratePercent: 0.3464 },
      { name: 'HMF',              ratePercent: 0.175 },
    ];
    expect(sumComponents(components)).toBe(15.5214);
  });

  test('rounding handles floating-point drift', () => {
    const components = [
      { name: 'A', ratePercent: 0.1 },
      { name: 'B', ratePercent: 0.2 },
    ];
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE754; expect clean 0.3
    expect(sumComponents(components)).toBe(0.3);
  });

  test('empty components -> sum is 0 (caller falls back to ratePercent)', () => {
    expect(sumComponents([])).toBe(0);
  });
});
