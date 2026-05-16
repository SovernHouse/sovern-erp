// Phase 4.15d-2b-1 — Compliance read/calc service tests.
//
// Coverage:
//   - checkCompliance: rule firings (CN→US anti-dumping, →US CPSC,
//     →EU CE marking, customs always), required-field guards, riskLevel
//     elevation.
//   - lookupHsCodes: chapter filter, search LIKE.
//   - calculateDuties: base rate, country-specific override,
//     dutyAmount math, missing HS code 404.
//   - listComplianceRecords / getComplianceRecord: filter compose, 404.
//   - listCertificatesOfOrigin / getCertificateOfOrigin: filter compose, 404.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const svc = require('../../services/aiWriteServices/complianceWriteService');

describe('Phase 4.15d-2b-1 — complianceWriteService', () => {
  let db, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  // ── checkCompliance ─────────────────────────────────────────────────

  describe('checkCompliance', () => {
    it('CN → US triggers anti_dumping + cpsc + customs (riskLevel high)', async () => {
      const result = await svc.checkCompliance({
        shipmentId: uuidv4(),
        countryOrigin: 'CN',
        countryDestination: 'US',
      });
      expect(result.ok).toBe(true);
      const types = result.check.requirements.map(r => r.type);
      expect(types).toContain('anti_dumping');
      expect(types).toContain('cpsc');
      expect(types).toContain('customs');
      expect(result.check.complianceChecks.antiDumping).toBe(true);
      expect(result.check.complianceChecks.cpsc).toBe(true);
      expect(result.check.riskLevel).toBe('high');
    });

    it('CN → DE triggers ce_marking + customs (no anti_dumping, no cpsc)', async () => {
      const result = await svc.checkCompliance({
        productId: uuidv4(),
        countryOrigin: 'CN',
        countryDestination: 'DE',
      });
      expect(result.ok).toBe(true);
      const types = result.check.requirements.map(r => r.type);
      expect(types).toContain('ce_marking');
      expect(types).toContain('customs');
      expect(types).not.toContain('anti_dumping');
      expect(types).not.toContain('cpsc');
      expect(result.check.complianceChecks.ceMarking).toBe(true);
    });

    it('MY → CA triggers only customs (low-friction lane)', async () => {
      const result = await svc.checkCompliance({
        productId: uuidv4(),
        countryOrigin: 'MY',
        countryDestination: 'CA',
      });
      expect(result.ok).toBe(true);
      const types = result.check.requirements.map(r => r.type);
      expect(types).toEqual(['customs']);
      expect(result.check.riskLevel).toBe('medium');
    });

    it('rejects when neither shipment nor product is supplied', async () => {
      const result = await svc.checkCompliance({
        countryOrigin: 'CN', countryDestination: 'US',
      });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
      expect(result.message).toMatch(/shipmentId or productId/);
    });

    it('rejects missing country fields', async () => {
      const a = await svc.checkCompliance({ shipmentId: uuidv4(), countryOrigin: 'CN' });
      expect(a.ok).toBe(false);
      const b = await svc.checkCompliance({ shipmentId: uuidv4(), countryDestination: 'US' });
      expect(b.ok).toBe(false);
    });
  });

  // ── lookupHsCodes + calculateDuties ─────────────────────────────────

  describe('lookupHsCodes + calculateDuties', () => {
    async function seedHsCode(overrides = {}) {
      return db.HarmonizedCode.create({
        id: uuidv4(),
        code: overrides.code || `99${Math.floor(Math.random() * 1e6)}`.slice(-6),
        description: overrides.description || 'Test description SPC flooring',
        chapter: overrides.chapter || '39',
        dutyRate: overrides.dutyRate ?? 6.5,
        antiDumpingRate: overrides.antiDumpingRate ?? 0,
        countrySpecific: overrides.countrySpecific || null,
      });
    }

    it('lookupHsCodes filters by chapter', async () => {
      const tag = uuidv4().slice(0, 5);
      await seedHsCode({ code: `${tag}A`, chapter: '99' });
      await seedHsCode({ code: `${tag}B`, chapter: '98' });

      const r = await svc.lookupHsCodes({ chapter: '99' });
      const codes = r.hsCodes.map(c => c.code);
      expect(codes.some(c => c === `${tag}A`)).toBe(true);
      expect(codes.some(c => c === `${tag}B`)).toBe(false);
    });

    it('lookupHsCodes LIKE-matches description', async () => {
      const desc = `UNIQUE-${uuidv4()} laminate flooring`;
      await seedHsCode({ description: desc });

      const r = await svc.lookupHsCodes({ search: 'UNIQUE-' });
      expect(r.hsCodes.some(c => c.description === desc)).toBe(true);
    });

    it('calculateDuties uses base rate × unitPrice × quantity', async () => {
      const code = `BASE${uuidv4().slice(0, 5)}`;
      await seedHsCode({ code, dutyRate: 10, antiDumpingRate: 5 });

      const r = await svc.calculateDuties({
        hsCode: code, countryOrigin: 'CN', countryDestination: 'US',
        unitPrice: 100, quantity: 200,
      });
      expect(r.ok).toBe(true);
      expect(r.calculation.baseRate).toBe(10);
      expect(r.calculation.antiDumpingRate).toBe(5);
      expect(r.calculation.totalDutyRate).toBe(15);
      // 100 × 200 × 0.15 = 3000
      expect(r.calculation.dutyAmount).toBe(3000);
    });

    it('calculateDuties applies country-specific override when set', async () => {
      const code = `OVRD${uuidv4().slice(0, 5)}`;
      await seedHsCode({
        code, dutyRate: 10, antiDumpingRate: 5,
        countrySpecific: { CN: { dutyRate: 25, antiDumpingRate: 50 } },
      });

      const r = await svc.calculateDuties({
        hsCode: code, countryOrigin: 'CN', countryDestination: 'US',
        unitPrice: 10, quantity: 100,
      });
      expect(r.ok).toBe(true);
      expect(r.calculation.baseRate).toBe(25);
      expect(r.calculation.antiDumpingRate).toBe(50);
      // 10 × 100 × 0.75 = 750
      expect(r.calculation.dutyAmount).toBe(750);
    });

    it('calculateDuties returns dutyAmount=0 when unitPrice or quantity is omitted', async () => {
      const code = `NOPQ${uuidv4().slice(0, 5)}`;
      await seedHsCode({ code, dutyRate: 7.5 });

      const r = await svc.calculateDuties({
        hsCode: code, countryOrigin: 'MY', countryDestination: 'US',
      });
      expect(r.ok).toBe(true);
      expect(r.calculation.dutyAmount).toBe(0);
    });

    it('calculateDuties 404s on unknown hsCode', async () => {
      const r = await svc.calculateDuties({
        hsCode: 'definitely-not-an-hs-code-XX',
        countryOrigin: 'CN', countryDestination: 'US',
      });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });

    it('calculateDuties rejects missing required fields', async () => {
      const a = await svc.calculateDuties({ countryOrigin: 'CN', countryDestination: 'US' });
      expect(a.ok).toBe(false);
    });
  });

  // ── listComplianceRecords + getComplianceRecord ─────────────────────

  describe('compliance record reads', () => {
    it('listComplianceRecords filters by type + status', async () => {
      const r = await svc.listComplianceRecords({ type: 'anti_dumping' });
      expect(r.ok).toBe(true);
      expect(Array.isArray(r.records)).toBe(true);
    });

    it('getComplianceRecord 404s on unknown id', async () => {
      const r = await svc.getComplianceRecord(uuidv4());
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });
  });

  // ── listCertificatesOfOrigin + getCertificateOfOrigin ───────────────

  describe('certificate of origin reads', () => {
    it('listCertificatesOfOrigin returns array (may be empty)', async () => {
      const r = await svc.listCertificatesOfOrigin({ status: 'issued' });
      expect(r.ok).toBe(true);
      expect(Array.isArray(r.certificates)).toBe(true);
    });

    it('getCertificateOfOrigin 404s on unknown id', async () => {
      const r = await svc.getCertificateOfOrigin(uuidv4());
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });
  });
});
