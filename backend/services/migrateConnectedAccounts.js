/**
 * Phase 4, C17 — Backfill ConnectedGoogleAccount.brandCode from Brand.senderEmail.
 *
 * For every ConnectedGoogleAccount where brandCode IS NULL, look up the
 * Brand whose senderEmail matches (case-insensitive) and set brandCode
 * to that Brand.code. Rows without a matching brand are left NULL and
 * warned — Alex can fix the brand sender or remove the orphan account.
 *
 * Idempotent via AuditLog sentinel `phase4_connected_accounts_brand_backfilled`.
 * After the sentinel exists, the migration is a no-op so a re-boot is
 * cheap.
 *
 * Schema: ConnectedGoogleAccount.brandCode is STRING(8), constraints:false
 * (L-043) FK to Brand.code. The column itself is added by
 * autoMigrateSchema() at boot before this migration runs.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_connected_accounts_brand_backfilled';

async function hasSentinel(db) {
  if (!db.AuditLog) return false;
  const row = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION, entity: 'System' } });
  return !!row;
}

async function writeSentinel(db, changes) {
  if (!db.AuditLog) return;
  await db.AuditLog.create({
    userId: null,
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: '00000000-0000-0000-0000-000000000000',
    changes,
    ipAddress: null,
  });
}

async function migrateConnectedAccounts(db) {
  if (!db.ConnectedGoogleAccount || !db.Brand) {
    logger.info('[C17] ConnectedGoogleAccount or Brand model missing; skipping');
    return { skipped: true };
  }

  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  // Load all brands by senderEmail lowercased for O(1) lookups.
  const brands = await db.Brand.findAll();
  const byEmail = new Map();
  for (const b of brands) {
    if (b.senderEmail) byEmail.set(b.senderEmail.toLowerCase(), b.code);
  }

  const accounts = await db.ConnectedGoogleAccount.findAll({ where: { brandCode: null } });
  const tagged = [];
  const orphans = [];

  for (const acc of accounts) {
    const code = byEmail.get((acc.email || '').toLowerCase());
    if (code) {
      await acc.update({ brandCode: code });
      tagged.push({ accountId: acc.id, email: acc.email, brandCode: code });
    } else {
      orphans.push({ accountId: acc.id, email: acc.email });
      logger.warn(`[C17] ConnectedGoogleAccount ${acc.email} has no matching Brand.senderEmail; brandCode left NULL`);
    }
  }

  await writeSentinel(db, {
    taggedCount: tagged.length,
    orphanCount: orphans.length,
    tagged,
    orphans,
    runAt: new Date().toISOString(),
  });

  if (tagged.length || orphans.length) {
    logger.info(`[C17] ConnectedGoogleAccount backfill: ${tagged.length} tagged, ${orphans.length} orphan`);
  }
  return { tagged: tagged.length, orphans: orphans.length };
}

module.exports = { migrateConnectedAccounts };
