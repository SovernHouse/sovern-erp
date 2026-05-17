// Phase 4.13.6 — sanctions source URL repair + failure-streak alert.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const svc = require('../../services/sanctionsService');

describe('Phase 4.13.6 — sanctions source URLs + streak detector', () => {
  let db;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    await seedTestData();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  // ── Source URL shape ───────────────────────────────────────────────

  describe('SOURCES config', () => {
    it('uses the SLS canonical SDN endpoint', () => {
      const src = svc.SOURCES.find(s => s.key === 'ofac_sdn');
      expect(src).toBeDefined();
      expect(src.url).toMatch(/^https:\/\/sanctionslistservice\.ofac\.treas\.gov\/api\/PublicationPreview\/exports\/SDN\.CSV$/);
    });

    it('uses the consolidated.csv filename (not legacy cons_prim.csv)', () => {
      const src = svc.SOURCES.find(s => s.key === 'ofac_consolidated');
      expect(src).toBeDefined();
      expect(src.url).toMatch(/consolidated\.csv$/);
      expect(src.url).not.toMatch(/cons_prim\.csv/);
    });

    it('EU URL has no base64 padding on the token', () => {
      const src = svc.SOURCES.find(s => s.key === 'eu_consolidated');
      expect(src).toBeDefined();
      // token must not end with the historical == padding
      expect(src.url).not.toMatch(/==$/);
      expect(src.url).toMatch(/token=dG9rZW4tMjAxNw$/);
    });

    it('UN URL is unchanged (still working upstream)', () => {
      const src = svc.SOURCES.find(s => s.key === 'un_consolidated');
      expect(src).toBeDefined();
      expect(src.url).toMatch(/^https:\/\/scsanctions\.un\.org\//);
    });
  });

  // ── checkRefreshFailureStreaks ─────────────────────────────────────

  describe('checkRefreshFailureStreaks', () => {
    beforeEach(async () => {
      // Wipe sanctions_refresh audit rows between tests to keep state predictable.
      await db.AuditLog.destroy({ where: { action: 'sanctions_refresh' } });
    });

    async function seedAuditRow({ daysAgo, results }) {
      const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const row = await db.AuditLog.create({
        action: 'sanctions_refresh',
        entity: 'System',
        entityId: '00000000-0000-0000-0000-000000000000',
        userId: null,
        changes: { results, ranAt: createdAt.toISOString() },
      });
      // Sequelize blocks createdAt overrides on .update() with managed
      // timestamps. Use silent + raw SQL fallback to back-date the row
      // so the streak detector's createdAt ordering / lookback window
      // actually exercises against simulated history.
      await db.sequelize.query(
        'UPDATE "AuditLog" SET created_at = :ts WHERE id = :id',
        { replacements: { ts: createdAt.toISOString(), id: row.id } }
      );
      return row;
    }

    it('returns empty when every source has succeeded recently', async () => {
      await seedAuditRow({
        daysAgo: 0,
        results: [
          { key: 'ofac_sdn', ok: true, bytes: 100 },
          { key: 'eu_consolidated', ok: true, bytes: 200 },
        ],
      });
      const alerts = await svc.checkRefreshFailureStreaks(db);
      expect(alerts).toEqual([]);
    });

    it('returns empty when latest run succeeded even if older runs failed', async () => {
      await seedAuditRow({ daysAgo: 0, results: [{ key: 'ofac_sdn', ok: true }] });
      await seedAuditRow({ daysAgo: 1, results: [{ key: 'ofac_sdn', ok: false, error: 'HTTP 403' }] });
      await seedAuditRow({ daysAgo: 2, results: [{ key: 'ofac_sdn', ok: false, error: 'HTTP 403' }] });
      await seedAuditRow({ daysAgo: 3, results: [{ key: 'ofac_sdn', ok: false, error: 'HTTP 403' }] });
      const alerts = await svc.checkRefreshFailureStreaks(db);
      expect(alerts).toEqual([]);
    });

    it('fires when a source has been failing 3 consecutive runs', async () => {
      await seedAuditRow({ daysAgo: 0, results: [{ key: 'eu_consolidated', ok: false, error: 'HTTP 500' }] });
      await seedAuditRow({ daysAgo: 1, results: [{ key: 'eu_consolidated', ok: false, error: 'HTTP 500' }] });
      await seedAuditRow({ daysAgo: 2, results: [{ key: 'eu_consolidated', ok: false, error: 'HTTP 500' }] });
      const alerts = await svc.checkRefreshFailureStreaks(db);
      expect(alerts.length).toBe(1);
      expect(alerts[0].key).toBe('eu_consolidated');
      expect(alerts[0].consecutiveFailures).toBe(3);
      expect(alerts[0].latestError).toBe('HTTP 500');
    });

    it('does NOT fire at 2 consecutive failures (threshold = 3)', async () => {
      await seedAuditRow({ daysAgo: 0, results: [{ key: 'eu_consolidated', ok: false, error: 'HTTP 500' }] });
      await seedAuditRow({ daysAgo: 1, results: [{ key: 'eu_consolidated', ok: false, error: 'HTTP 500' }] });
      const alerts = await svc.checkRefreshFailureStreaks(db);
      expect(alerts).toEqual([]);
    });

    it('only counts CONSECUTIVE failures from the newest backward', async () => {
      // newest fail, then a success, then fails — streak should be 1, not 3
      await seedAuditRow({ daysAgo: 0, results: [{ key: 'ofac_sdn', ok: false, error: 'HTTP 403' }] });
      await seedAuditRow({ daysAgo: 1, results: [{ key: 'ofac_sdn', ok: true }] });
      await seedAuditRow({ daysAgo: 2, results: [{ key: 'ofac_sdn', ok: false }] });
      await seedAuditRow({ daysAgo: 3, results: [{ key: 'ofac_sdn', ok: false }] });
      const alerts = await svc.checkRefreshFailureStreaks(db);
      expect(alerts).toEqual([]);  // only 1 consecutive at newest
    });

    it('reports multiple sources independently', async () => {
      const failResults = [
        { key: 'ofac_sdn', ok: false, error: 'HTTP 403' },
        { key: 'eu_consolidated', ok: false, error: 'HTTP 500' },
        { key: 'un_consolidated', ok: true, bytes: 9999 },
      ];
      await seedAuditRow({ daysAgo: 0, results: failResults });
      await seedAuditRow({ daysAgo: 1, results: failResults });
      await seedAuditRow({ daysAgo: 2, results: failResults });
      const alerts = await svc.checkRefreshFailureStreaks(db);
      const keys = alerts.map(a => a.key).sort();
      expect(keys).toEqual(['eu_consolidated', 'ofac_sdn']);
    });

    it('honours the lookbackDays cap (ignores rows beyond the window)', async () => {
      await seedAuditRow({ daysAgo: 0, results: [{ key: 'ofac_sdn', ok: false }] });
      await seedAuditRow({ daysAgo: 1, results: [{ key: 'ofac_sdn', ok: false }] });
      // This third failure is 30 days old — outside default lookbackDays=7.
      await seedAuditRow({ daysAgo: 30, results: [{ key: 'ofac_sdn', ok: false }] });
      const alerts = await svc.checkRefreshFailureStreaks(db);
      // Only 2 in-window failures → below threshold
      expect(alerts).toEqual([]);
    });

    it('respects a custom thresholdDays', async () => {
      await seedAuditRow({ daysAgo: 0, results: [{ key: 'ofac_sdn', ok: false }] });
      await seedAuditRow({ daysAgo: 1, results: [{ key: 'ofac_sdn', ok: false }] });
      const alerts = await svc.checkRefreshFailureStreaks(db, { thresholdDays: 2 });
      expect(alerts.length).toBe(1);
      expect(alerts[0].consecutiveFailures).toBe(2);
    });

    it('returns [] when AuditLog is unavailable on the db handle', async () => {
      const alerts = await svc.checkRefreshFailureStreaks({});
      expect(alerts).toEqual([]);
    });
  });
});

// ── Real-URL HEAD probe ──────────────────────────────────────────────
//
// Skipped by default — the suite shouldn't depend on external network.
// Run with RUN_SANCTIONS_URL_CHECK=true (env flag) on a weekly CI cron
// to detect upstream URL drift before it causes production refresh
// failures. Asserts every source URL returns 200, 302, or 304.

const RUN_URL_CHECK = process.env.RUN_SANCTIONS_URL_CHECK === 'true';
const urlCheckDescribe = RUN_URL_CHECK ? describe : describe.skip;

urlCheckDescribe('Phase 4.13.6 — real-URL HEAD probe (weekly)', () => {
  const https = require('https');
  const { URL } = require('url');

  function head(url) {
    return new Promise((resolve) => {
      const u = new URL(url);
      const opts = {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: 'HEAD',
        port: 443,
        timeout: 30_000,
        headers: {
          'User-Agent': 'SovernHouseERP/1.0 (+https://erp.sovernhouse.co; sanctions-url-check)',
          'Accept': '*/*',
        },
      };
      const req = https.request(opts, (res) => {
        resolve({ status: res.statusCode });
      });
      req.on('error', (err) => resolve({ status: 0, error: err.message }));
      req.on('timeout', () => {
        req.destroy(new Error('timeout'));
        resolve({ status: 0, error: 'timeout' });
      });
      req.end();
    });
  }

  it.each(svc.SOURCES)('$key URL responds 200/302/304', async (src) => {
    const r = await head(src.url);
    expect(
      [200, 301, 302, 304].includes(r.status),
      `${src.key} (${src.url}) → ${r.status} ${r.error || ''}`,
    ).toBe(true);
  });
});
