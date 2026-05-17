// Phase 4.13a — Jurisdiction screening tests.
//
// The required gating signal for this PR: create_lead({country:'Iran'})
// must return sanctions_block, NOT cleared. This file exists so that
// "4.13a CI green" means "the Iran false-negative cannot recur." Without
// this suite, the regression that Phase 4.12 verification surfaced
// could silently come back via a future refactor that doesn't realise
// jurisdiction screening is load-bearing.
//
// Coverage:
//   - Required: Iran positive (the exact false-negative we shipped 4.13a to fix)
//   - All 4 OFAC comprehensive jurisdictions (Iran, Cuba, DPRK, Syria)
//   - Country alias normalization (ISO-2, full names, lowercase, parentheticals)
//   - Negative cases: USA, China, Mexico, India, Germany, Japan (no false positives)
//   - Empty country: cleared (jurisdiction doesn't block on missing data)
//   - Composition with name screening: jurisdiction match wins even on a
//     name miss; on a name hit, jurisdiction hits append rather than replace
//   - Backfill: manual_db_override marker is preserved (Alex's prod override)

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const sanctionsService = require('../../services/sanctionsService');
const leadWriteService = require('../../services/aiWriteServices/leadWriteService');

const restScope = { accessibleBrands: ['SH', 'FW'], defaultBrand: 'SH', viewMode: 'single', isCrossBrand: false };

describe('Phase 4.13a — Jurisdiction screening', () => {
  let db, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();
    for (const code of ['SH', 'FW']) {
      const existing = await db.Brand.findOne({ where: { code } });
      if (!existing) {
        await db.Brand.create({
          code,
          displayName: code === 'SH' ? 'Sovern House' : 'FlorWay',
          senderEmail: code === 'SH' ? 'alex@sovernhouse.co' : 'alexflorway@gmail.com',
          primaryColor: '#000000',
          accentColor: '#ffffff',
          active: true,
          commissionRate: 0.05,
        });
      }
    }
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  // ── REQUIRED — the gating Iran-positive test (don't delete) ──────────

  describe('REQUIRED CI gate — Iran false-negative cannot recur', () => {
    it('createLead({country:"Iran"}) returns sanctions_block, no Lead row created', async () => {
      const email = `iran-positive-${uuidv4()}@example.com`;
      const result = await leadWriteService.createLead({
        companyName: 'Iran Positive Test Co',
        contactName: 'Test',
        email,
        country: 'Iran',
      }, { userId: testData.admin.id, brandScope: restScope, ip: null, source: 'mcp' });

      // The exact contract: ok=false, sanctions_block, AuditLog row written.
      expect(result.ok).toBe(false);
      expect(result.code).toBe('sanctions_block');
      expect(result.httpStatus).toBe(403);
      expect(result.sanctionsBlock).toBeTruthy();
      expect(result.sanctionsBlock.hits.some(h => h.rule === 'jurisdiction')).toBe(true);

      const leadCount = await db.Lead.count({ where: { email } });
      expect(leadCount).toBe(0);

      await new Promise(r => setTimeout(r, 50));
      const auditRows = await db.AuditLog.findAll({
        where: { action: 'sanctions_block', entity: 'Lead' },
        order: [['createdAt', 'DESC']],
        limit: 5,
      });
      // The Iran-positive audit row should be there with the basis citation.
      const iranRow = auditRows.find(r =>
        r.changes && r.changes.country === 'Iran' &&
        Array.isArray(r.changes.hits) && r.changes.hits.some(h => h.rule === 'jurisdiction'),
      );
      expect(iranRow).toBeTruthy();
      const iranHit = iranRow.changes.hits.find(h => h.rule === 'jurisdiction');
      expect(iranHit.authority).toBe('OFAC');
      expect(iranHit.basis).toMatch(/Iran/);
      expect(iranHit.basis).toMatch(/31 CFR Part 560/);
    });
  });

  // ── Jurisdiction screen — direct unit-style tests ────────────────────

  describe('screenJurisdiction — all 4 OFAC comprehensive jurisdictions', () => {
    it.each([
      ['Iran', /Iran/],
      ['Cuba', /Cuba/],
      ['North Korea', /DPRK/],
      ['Syria', /Syria/],
    ])('flags %s with the correct basis citation', (country, basisMatch) => {
      const result = sanctionsService.screenJurisdiction(country);
      expect(result.status).toBe('flagged');
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.hits[0].rule).toBe('jurisdiction');
      expect(result.hits[0].authority).toBe('OFAC');
      expect(result.hits[0].basis).toMatch(basisMatch);
    });
  });

  describe('screenJurisdiction — country alias normalization', () => {
    it.each([
      'Iran', 'iran', 'IRAN', 'IR', 'ir', 'Islamic Republic of Iran',
      'The Islamic Republic of Iran', 'Iran (Islamic Republic of)', 'Persia',
    ])('flags Iran alias "%s"', (alias) => {
      const result = sanctionsService.screenJurisdiction(alias);
      expect(result.status).toBe('flagged');
      expect(result.hits[0].basis).toMatch(/Iran/);
    });

    it.each([
      'CU', 'Cuba', 'cuba', 'Republic of Cuba',
    ])('flags Cuba alias "%s"', (alias) => {
      const result = sanctionsService.screenJurisdiction(alias);
      expect(result.status).toBe('flagged');
      expect(result.hits[0].basis).toMatch(/Cuba/);
    });

    it.each([
      'KP', 'North Korea', 'DPRK', "Democratic People's Republic of Korea",
    ])('flags DPRK alias "%s"', (alias) => {
      const result = sanctionsService.screenJurisdiction(alias);
      expect(result.status).toBe('flagged');
      expect(result.hits[0].basis).toMatch(/DPRK/);
    });

    it.each([
      'SY', 'Syria', 'Syrian Arab Republic',
    ])('flags Syria alias "%s"', (alias) => {
      const result = sanctionsService.screenJurisdiction(alias);
      expect(result.status).toBe('flagged');
      expect(result.hits[0].basis).toMatch(/Syria/);
    });
  });

  describe('screenJurisdiction — negative cases (no false positives on legitimate counterparties)', () => {
    it.each(['United States', 'USA', 'US', 'China', 'Mexico', 'India', 'Germany', 'Japan', 'Malaysia', 'Vietnam', 'Taiwan'])(
      'clears %s',
      (country) => {
        const result = sanctionsService.screenJurisdiction(country);
        expect(result.status).toBe('cleared');
        expect(result.hits.length).toBe(0);
      },
    );

    it('empty country returns cleared (does not block on missing data)', () => {
      expect(sanctionsService.screenJurisdiction('').status).toBe('cleared');
      expect(sanctionsService.screenJurisdiction(null).status).toBe('cleared');
      expect(sanctionsService.screenJurisdiction(undefined).status).toBe('cleared');
    });
  });

  // ── screenName composition ───────────────────────────────────────────

  describe('screenName composition — jurisdiction + name screens together', () => {
    it('flags an empty name with a blocked country (pre-4.13a this returned cleared)', () => {
      const result = sanctionsService.screenName('', 'Iran');
      expect(result.status).toBe('flagged');
      expect(result.hits.some(h => h.rule === 'jurisdiction')).toBe(true);
    });

    it('does not flag a legitimate name with a clean country (status is cleared or pending — never flagged)', () => {
      // Test env may not have SDN list data loaded, in which case
      // screenName returns 'pending' for the name-screen side and the
      // jurisdiction side returns 'cleared'. Either way, the result
      // must not be 'flagged' — that's the whole point of this test
      // (no false positives on legitimate counterparties).
      const result = sanctionsService.screenName('Acme Flooring Distributors', 'United States');
      expect(['cleared', 'pending']).toContain(result.status);
      expect(result.hits.some(h => h.rule === 'jurisdiction')).toBe(false);
    });

    it('flags a legitimate-looking name with a blocked country', () => {
      const result = sanctionsService.screenName('Tehran Imports Ltd', 'Iran');
      expect(result.status).toBe('flagged');
      const jHit = result.hits.find(h => h.rule === 'jurisdiction');
      expect(jHit).toBeTruthy();
      expect(jHit.matched).toBe('country=Iran');
    });
  });

  // ── Backfill: manual override preservation ───────────────────────────

  describe('migrate413aJurisdictionBackfill — preserves manual overrides', () => {
    it('does NOT clobber a Lead with reviewer:manual_db_override in sanctions_screen_details', async () => {
      // Seed a Lead that mimics the prod state: country=Iran, manually
      // blocked with the override marker that signals "human reviewed".
      const lead = await db.Lead.create({
        companyName: 'Manually Overridden Iran Co',
        contactName: 'Human Reviewed',
        email: `manual-override-${uuidv4()}@example.com`,
        country: 'Iran',
        brandCode: 'SH',
        screeningStatus: 'blocked',
        sanctionsScreenDetails: [{
          rule: 'jurisdiction',
          basis: 'OFAC comprehensive sanctions — Iran (ITSR 31 CFR Part 560 / EO 13599)',
          authority: 'OFAC',
          matched: 'country=Iran',
          reviewer: 'manual_db_override',
          timestamp: new Date().toISOString(),
          note: 'Phase 4.12 sanctions screener false-negative; manually blocked.',
        }],
        lastScreenedAt: new Date(),
        status: 'new',
        source: 'other',
        leadType: 'outbound_prospect',
      });

      // Clear any prior sentinel so the migration runs.
      await db.AuditLog.destroy({ where: { action: 'phase4_13a_jurisdiction_backfilled' } });

      const { migrate413aJurisdictionBackfill } = require('../../services/migrate413aJurisdictionBackfill');
      const result = await migrate413aJurisdictionBackfill(db);

      await lead.reload();
      // Status stays 'blocked' (manual decision wins) — not overwritten to 'flagged'.
      expect(lead.screeningStatus).toBe('blocked');
      // Stats reflect the skip.
      expect(result.manualOverrideSkipped).toBeGreaterThan(0);
    });
  });
});
