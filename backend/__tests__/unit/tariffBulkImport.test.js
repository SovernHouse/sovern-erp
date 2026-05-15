// Phase 4.9 C-4 — bulk-import CSV row → tariff payload.
//
// csvRowToTariffPayload is controller-internal so we re-implement the
// same rule here against the documented behaviour. If you change the
// controller's helper, mirror the change here.

const COMPONENT_COLUMNS = [
  { col: 'mfnBase',         name: 'MFN base (HTS column 1)' },
  { col: 'section301',      name: 'Section 301' },
  { col: 'section232',      name: 'Section 232' },
  { col: 'ieepaReciprocal', name: 'IEEPA reciprocal' },
  { col: 'ieepaFentanyl',   name: 'IEEPA fentanyl' },
  { col: 'adCvd',           name: 'AD/CVD' },
  { col: 'mpf',             name: 'MPF (merchandise fee)' },
  { col: 'hmf',             name: 'HMF (harbor maintenance)' },
];

function rowToPayload(row) {
  const components = [];
  for (const { col, name } of COMPONENT_COLUMNS) {
    const raw = (row[col] || '').trim();
    if (!raw) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) throw new Error(`${col}=${raw} is not numeric`);
    if (v === 0) continue;
    components.push({ name, ratePercent: v });
  }
  for (let i = 1; i <= 2; i++) {
    const name = (row[`otherName${i}`] || '').trim();
    const rateRaw = (row[`otherRate${i}`] || '').trim();
    if (!name && !rateRaw) continue;
    if (!name || !rateRaw) throw new Error(`otherName${i} and otherRate${i} must both be filled when used`);
    const v = Number(rateRaw);
    if (!Number.isFinite(v)) throw new Error(`otherRate${i}=${rateRaw} is not numeric`);
    components.push({ name, ratePercent: v });
  }
  let ratePercent;
  if (components.length > 0) {
    ratePercent = Math.round(components.reduce((s, c) => s + c.ratePercent, 0) * 10000) / 10000;
  } else {
    const totalRaw = (row.totalRate || '').trim();
    if (!totalRaw) throw new Error('Must supply at least one component column OR a totalRate');
    ratePercent = Number(totalRaw);
  }
  return { components, ratePercent };
}

describe('Tariff CSV bulk-import row mapping (Phase 4.9 C-4)', () => {
  test('CN -> US seed row sums components to 40.7714', () => {
    const out = rowToPayload({
      originCountry: 'CN', destinationCountry: 'US',
      effectiveFrom: '2026-05-14', effectiveUntil: '2026-06-14',
      mfnBase: '3.2', section301: '25.0', ieepaReciprocal: '10.0',
      ieepaFentanyl: '2.15', mpf: '0.3464', hmf: '0.075',
    });
    expect(out.ratePercent).toBe(40.7714);
    expect(out.components).toHaveLength(6);
    expect(out.components[0]).toEqual({ name: 'MFN base (HTS column 1)', ratePercent: 3.2 });
  });

  test('row with only totalRate accepts the explicit number', () => {
    const out = rowToPayload({ totalRate: '12.5' });
    expect(out.ratePercent).toBe(12.5);
    expect(out.components).toEqual([]);
  });

  test('empty cells are skipped (no spurious components)', () => {
    const out = rowToPayload({
      mfnBase: '3.2',
      section301: '',
      section232: '   ',
      ieepaReciprocal: '0', // zero is skipped per the rule
      adCvd: '5.0',
    });
    expect(out.components).toEqual([
      { name: 'MFN base (HTS column 1)', ratePercent: 3.2 },
      { name: 'AD/CVD', ratePercent: 5.0 },
    ]);
    expect(out.ratePercent).toBe(8.2);
  });

  test('otherNameN/otherRateN pair must both be filled together', () => {
    expect(() => rowToPayload({ otherName1: 'CBP fee', otherRate1: '' }))
      .toThrow(/both be filled/);
  });

  test('non-numeric component cell raises an error', () => {
    expect(() => rowToPayload({ mfnBase: 'three-point-two' }))
      .toThrow(/mfnBase=three-point-two is not numeric/);
  });

  test('empty row with no components and no totalRate raises an error', () => {
    expect(() => rowToPayload({}))
      .toThrow(/at least one component column OR a totalRate/);
  });
});
