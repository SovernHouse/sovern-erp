/**
 * bootstrapMigrationsMeta — Phase 4.10.
 *
 * Closes the long-standing deferred follow-up around
 * `sync({alter:true})` (see L-046 / L-048 / L-049). Sequelize-cli is
 * already wired in this repo (.sequelizerc, npm run migrate scripts,
 * two baseline migrations in backend/migrations/). The only thing
 * missing is the bootstrap on environments that built their schema
 * via `sync()` (prod, dev installs predating the migration framework):
 * no `SequelizeMeta` table exists, so `npm run migrate` would attempt
 * to re-apply the baseline migrations and crash on "table already
 * exists".
 *
 * This helper:
 *   1. Creates `SequelizeMeta` if missing, matching the Sequelize CLI
 *      default schema (`name VARCHAR(255) PRIMARY KEY`).
 *   2. Reads every file from `backend/migrations/` and seeds the
 *      SequelizeMeta table with each filename. Idempotent — only
 *      inserts rows that aren't already there.
 *
 * Result: `npm run migrate:status` shows everything currently in
 * `migrations/` as APPLIED. Future migrations added via
 * `npm run migrate:generate` will show as PENDING and `npm run migrate`
 * applies them.
 *
 * The 7 existing service-style migrations (services/migrate*.js) are
 * intentionally NOT converted. They are sentinel-guarded via AuditLog
 * + idempotent + working in prod. Converting them is busy work that
 * adds no value. Going forward, NEW schema changes should use the
 * framework; existing services stay as-is.
 *
 * Sentinel: `phase4_10_sequelize_meta_bootstrapped`. Re-runs are a
 * no-op (the row insert is INSERT OR IGNORE anyway).
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_10_sequelize_meta_bootstrapped';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function tableExists(sequelize, name) {
  const [rows] = await sequelize.query(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = :name`,
    { replacements: { name } },
  );
  return rows.length > 0;
}

async function listMigrationFiles() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  try {
    const entries = await fs.promises.readdir(migrationsDir);
    return entries.filter(name => name.endsWith('.js')).sort();
  } catch (err) {
    if (err.code === 'ENOENT') {
      logger.warn(`[bootstrap-meta] migrations dir not found at ${migrationsDir}; nothing to seed`);
      return [];
    }
    throw err;
  }
}

async function bootstrapMigrationsMeta(db) {
  if (!db?.AuditLog || !db.sequelize) {
    logger.warn('[bootstrap-meta] required deps missing; skipping');
    return { skipped: true };
  }

  const result = { tableCreated: false, seeded: [], alreadySeeded: 0 };

  // Create SequelizeMeta if missing. Match the exact schema the CLI
  // uses so any subsequent `npm run migrate` call sees a compatible
  // table and doesn't try to recreate it.
  if (!(await tableExists(db.sequelize, 'SequelizeMeta'))) {
    await db.sequelize.query('CREATE TABLE SequelizeMeta (name VARCHAR(255) NOT NULL PRIMARY KEY)');
    logger.info('[bootstrap-meta] CREATED SequelizeMeta table');
    result.tableCreated = true;
  }

  // Read what's currently in SequelizeMeta + what's in migrations/.
  const [existingRows] = await db.sequelize.query('SELECT name FROM SequelizeMeta ORDER BY name ASC');
  const existing = new Set(existingRows.map(r => r.name));
  const fileNames = await listMigrationFiles();

  // Seed missing rows. INSERT OR IGNORE keeps idempotency rock-solid
  // even if the table was partially populated.
  for (const name of fileNames) {
    if (existing.has(name)) {
      result.alreadySeeded++;
      continue;
    }
    await db.sequelize.query(
      'INSERT OR IGNORE INTO SequelizeMeta (name) VALUES (:name)',
      { replacements: { name } },
    );
    result.seeded.push(name);
    logger.info(`[bootstrap-meta] SEEDED ${name}`);
  }

  // Record once per fresh bootstrap (not on every seed pass). Sentinel
  // is informational; the SequelizeMeta presence check above is the
  // real idempotency.
  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (!sentinel) {
    await db.AuditLog.create({
      action: SENTINEL_ACTION,
      entity: 'System',
      entityId: SYSTEM_ENTITY_ID,
      userId: null,
      changes: { tableCreated: result.tableCreated, seeded: result.seeded.length, fileNames },
    });
  }

  logger.info(`[bootstrap-meta] complete: tableCreated=${result.tableCreated}, seeded=${result.seeded.length}, alreadySeeded=${result.alreadySeeded}`);
  return result;
}

module.exports = { bootstrapMigrationsMeta, SENTINEL_ACTION };
