/**
 * migrate418eAiMemory — Phase 4.18e.
 *
 * Creates the AiMemory table on first boot after this commit. Sentinel
 * guarded via AuditLog row `phase4_18e_ai_memory_table_created`.
 *
 * The model itself declares the schema; sync({ alter: false }) is the
 * runtime-safe way to bring a new model into existence on SQLite
 * without rewriting unrelated tables. Idempotent — second boot finds
 * the sentinel and returns early.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_18e_ai_memory_table_created';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function migrate418eAiMemory(db) {
  if (!db?.sequelize) {
    logger.warn('[phase4_18e] sequelize unavailable; skipping');
    return { skipped: true };
  }
  if (!db.AiMemory || !db.AuditLog) {
    logger.warn('[phase4_18e] AiMemory/AuditLog model unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { skipped: true, reason: 'sentinel-present' };
  }

  // Create the table if it doesn't already exist. force:false leaves
  // any prior rows in place (defence against the sentinel being
  // manually deleted in dev).
  await db.AiMemory.sync({ alter: false });

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: { phase: '4.18e', createdAt: new Date().toISOString() },
  });

  logger.info('[phase4_18e] AiMemory table ensured');
  return { created: true };
}

module.exports = { migrate418eAiMemory, SENTINEL_ACTION };
