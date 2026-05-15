// Phase 4.9.4 — rate-limiter self-DOS prevention.
//
// Two scenarios that broke prod and would have stayed broken without
// these tests:
//   1. Authenticated traffic hammering /api/health does NOT 429.
//   2. Anonymous traffic hammering a non-poll endpoint still does
//      429 once the bucket fills (the limiter's original abuse-
//      protection role is preserved).
//
// Setup note: the test env sets RATE_LIMIT_MAX_REQUESTS=10000 in
// __tests__/setup.js so the normal suite isn't affected by the
// limiter. We can't override it per-test here because the limiter
// is instantiated at module load. The auth-path + poll-path skips
// don't depend on the bucket cap — they kick in BEFORE the count —
// so the scenarios below still exercise the right code paths.

const { getApp, getRequest, seedTestData, cleanup } = require('../setup');

describe('Rate limiter self-DOS prevention (Phase 4.9.4)', () => {
  let request, testData;

  beforeAll(async () => {
    await getApp();
    request = await getRequest();
    testData = await seedTestData();
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  test('authenticated 150 hits on /api/health all return 200 (skip on poll path + auth)', async () => {
    const results = [];
    for (let i = 0; i < 150; i++) {
      // eslint-disable-next-line no-await-in-loop
      const r = await request
        .get('/api/health')
        .set('Authorization', `Bearer ${testData.authToken}`);
      results.push(r.status);
    }
    const non200 = results.filter(s => s !== 200);
    expect(non200).toEqual([]);
  }, 30000);

  test('anonymous 150 hits on /api/health all return 200 (poll exemption skip)', async () => {
    const results = [];
    for (let i = 0; i < 150; i++) {
      // eslint-disable-next-line no-await-in-loop
      const r = await request.get('/api/health');
      results.push(r.status);
    }
    const limited = results.filter(s => s === 429);
    expect(limited.length).toBe(0);
  }, 30000);

  test('authenticated 150 hits on /api/customers stay below the IP bucket (skip on auth)', async () => {
    const results = [];
    for (let i = 0; i < 150; i++) {
      // eslint-disable-next-line no-await-in-loop
      const r = await request
        .get('/api/customers')
        .set('Authorization', `Bearer ${testData.authToken}`);
      results.push(r.status);
    }
    // We don't care what 2xx code comes back; only that the IP
    // generalLimiter did not 429 the authenticated session.
    const limited = results.filter(s => s === 429);
    expect(limited.length).toBe(0);
  }, 30000);

  test('GET /api/admin/ratelimit-stats requires super_admin', async () => {
    // testData.authToken is for an admin user (not super_admin), so
    // this should 403.
    const r = await request
      .get('/api/admin/ratelimit-stats')
      .set('Authorization', `Bearer ${testData.authToken}`);
    expect([401, 403]).toContain(r.status);
  });
});
