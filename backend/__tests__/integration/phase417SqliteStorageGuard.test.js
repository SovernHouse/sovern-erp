/**
 * Phase 4.17 — SQLITE_STORAGE-out-of-.env defense in depth (regression).
 *
 * Locks in the L-061 guard installed after the 2026-05-17 production DB
 * wipe incident. Three things must hold simultaneously:
 *
 *   1. backend/.env must NOT carry SQLITE_STORAGE. If someone adds it
 *      back, prod-pathed values can leak into test boots.
 *   2. backend/__tests__/setup.js must explicitly empty
 *      process.env.SQLITE_STORAGE BEFORE requiring sequelize (so any
 *      shell-level SQLITE_STORAGE export doesn't survive into the
 *      config-resolution path).
 *   3. backend/config/database.js in NODE_ENV=test must REFUSE any
 *      SQLITE_STORAGE that is not :memory: or a path under os.tmpdir(),
 *      and force :memory:. Defense in depth — even if (1) and (2) leak,
 *      the config layer is the last line.
 *
 * Together these prevent the prod-DB-wipe class of bug where
 * sequelize.sync({force:true}) inside a test boot pointed at the
 * production SQLite file because SQLITE_STORAGE drifted in from .env.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Phase 4.17 — SQLITE_STORAGE defense-in-depth (L-061)', () => {
  it('1. backend/.env does NOT contain SQLITE_STORAGE', () => {
    const envPath = path.resolve(__dirname, '../../.env');
    if (!fs.existsSync(envPath)) {
      // No .env at all is the safest possible state — the test passes by
      // omission. CI commonly runs without one.
      return;
    }
    const content = fs.readFileSync(envPath, 'utf8');
    const offending = content
      .split(/\r?\n/)
      .filter((l) => /^\s*SQLITE_STORAGE\s*=/.test(l) && !/^\s*#/.test(l));
    expect(offending).toEqual([]);
  });

  it('2. __tests__/setup.js clears SQLITE_STORAGE before any sequelize require', () => {
    const setupPath = path.resolve(__dirname, '../setup.js');
    const content = fs.readFileSync(setupPath, 'utf8');

    // The setup file must touch SQLITE_STORAGE before requiring supertest
    // (which is the proxy for "before requiring server.js which requires
    // sequelize"). We assert ordering: the clearing line appears before
    // the supertest require.
    const clearIdx = content.search(/process\.env\.SQLITE_STORAGE\s*=\s*['"]\s*['"]/);
    const supertestIdx = content.indexOf("require('supertest')");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(supertestIdx).toBeGreaterThan(-1);
    expect(clearIdx).toBeLessThan(supertestIdx);
  });

  it('3. config/database.js refuses SQLITE_STORAGE outside os.tmpdir() in NODE_ENV=test', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalStorage = process.env.SQLITE_STORAGE;
    // Silence the expected console.warn from the guard so test output stays clean.
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      // jest.isolateModules gives each require a fresh module registry,
      // which lets us hit the require-time getConfig() resolution path
      // multiple times in the same test without fighting Jest's caching.
      process.env.NODE_ENV = 'test';
      process.env.SQLITE_STORAGE = '/home/alex/sovern-erp/data/erp.db';
      let hostileConfig;
      jest.isolateModules(() => {
        hostileConfig = require('../../config/database.js');
      });
      expect(hostileConfig.storage).toBe(':memory:');

      // Sanity: an under-tmp path is allowed.
      const safe = path.join(os.tmpdir(), 'guard-allowed.sqlite');
      process.env.SQLITE_STORAGE = safe;
      let safeConfig;
      jest.isolateModules(() => {
        safeConfig = require('../../config/database.js');
      });
      expect(safeConfig.storage).toBe(safe);
    } finally {
      warnSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
      if (originalStorage === undefined) {
        delete process.env.SQLITE_STORAGE;
      } else {
        process.env.SQLITE_STORAGE = originalStorage;
      }
    }
  });
});
