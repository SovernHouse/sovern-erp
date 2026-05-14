/**
 * Phase 4, C15 migration — CommissionTracking + Brand.
 *
 * Idempotent. Sentinel-guarded so the migration runs once across boots,
 * even if pieces partially succeed.
 *
 * Three parts:
 *
 * 1. CommissionTracking status enum remap:
 *    - approved → accrued
 *    - cancelled → clawed_back
 *    - pending / paid / disputed unchanged
 *    SQLite stores ENUM as TEXT so the UPDATE works regardless of the
 *    Sequelize model's declared values; the model definition is the
 *    enforcement point for new rows.
 *
 * 2. CommissionTracking field backfill:
 *    - customerId / brandCode / accrualDate joined via salesOrderId
 *    - Defaults brandCode to 'FW' for legacy rows where the SO lookup
 *      doesn't resolve (commission rows existed in C11 for FW only).
 *
 * 3. Brand.commissionRate backfill:
 *    - SH → 0.0000
 *    - FW → 0.0500 (per the HanHua/FlorWay agreement)
 *    - Other brands → leave as model default (0.0500)
 *
 * Each piece writes an AuditLog row tagged with the action name so a
 * second boot finds the sentinel and skips. Failures log + continue;
 * boot is never crashed.
 */

const logger = require('../utils/logger');

async function hasSentinel(db, action) {
  if (!db.AuditLog) return false;
  const row = await db.AuditLog.findOne({ where: { action, entity: 'System' } });
  return !!row;
}

async function writeSentinel(db, action, changes = {}) {
  if (!db.AuditLog) return;
  await db.AuditLog.create({
    userId: null,
    action,
    entity: 'System',
    entityId: '00000000-0000-0000-0000-000000000000',
    changes,
    ipAddress: null,
  });
}

async function migrateStatusEnum(db) {
  const action = 'phase4_commission_status_migrated';
  if (await hasSentinel(db, action)) return { skipped: true };

  // Use raw query — Sequelize's ENUM check in .update() would reject the
  // legacy values before the model definition changes propagate.
  const [approvedRes] = await db.sequelize.query(
    `UPDATE CommissionTrackings SET status = 'accrued' WHERE status = 'approved'`
  );
  const [cancelledRes] = await db.sequelize.query(
    `UPDATE CommissionTrackings SET status = 'clawed_back' WHERE status = 'cancelled'`
  );

  await writeSentinel(db, action, {
    approvedRemapped: approvedRes?.changes ?? null,
    cancelledRemapped: cancelledRes?.changes ?? null,
  });
  logger.info('[migrateCommissionsC15] status enum remap done');
  return { skipped: false };
}

async function backfillCommissionFields(db) {
  const action = 'phase4_commission_fields_backfilled';
  if (await hasSentinel(db, action)) return { skipped: true };

  // For each row missing customerId/brandCode/accrualDate, fill from SO.
  const rows = await db.CommissionTracking.findAll({
    where: {
      [db.Sequelize.Op.or]: [
        { customerId: null },
        { brandCode: null },
        { accrualDate: null },
      ],
    },
  });

  let backfilled = 0;
  for (const row of rows) {
    const so = await db.SalesOrder.findByPk(row.salesOrderId);
    if (!so) {
      // Orphan tracking row; set safe defaults so the not-null brandCode
      // constraint doesn't trip on subsequent updates.
      await row.update({ brandCode: row.brandCode || 'FW' });
      continue;
    }
    await row.update({
      customerId: row.customerId || so.customerId,
      brandCode: row.brandCode || so.brandCode || 'FW',
      accrualDate: row.accrualDate || row.createdAt,
    });
    backfilled++;
  }

  await writeSentinel(db, action, { backfilled, totalCandidates: rows.length });
  logger.info(`[migrateCommissionsC15] commission fields backfilled: ${backfilled}/${rows.length}`);
  return { skipped: false, backfilled };
}

async function backfillBrandCommissionRate(db) {
  const action = 'phase4_brand_commission_rate_backfilled';
  if (await hasSentinel(db, action)) return { skipped: true };

  const sh = await db.Brand.findOne({ where: { code: 'SH' } });
  if (sh && (sh.commissionRate == null || parseFloat(sh.commissionRate) === 0.05)) {
    await sh.update({ commissionRate: 0.0000 });
  }

  const fw = await db.Brand.findOne({ where: { code: 'FW' } });
  if (fw && fw.commissionRate == null) {
    await fw.update({ commissionRate: 0.0500 });
  }

  await writeSentinel(db, action, {
    sh: sh?.commissionRate ?? null,
    fw: fw?.commissionRate ?? null,
  });
  logger.info('[migrateCommissionsC15] brand commissionRate backfill done');
  return { skipped: false };
}

async function migrateCommissionsC15(db) {
  if (!db || !db.CommissionTracking || !db.Brand) {
    logger.warn('[migrateCommissionsC15] db models not registered; skipping');
    return;
  }
  try { await migrateStatusEnum(db); } catch (e) {
    logger.error('[migrateCommissionsC15] status enum step failed:', e.message);
  }
  try { await backfillCommissionFields(db); } catch (e) {
    logger.error('[migrateCommissionsC15] fields backfill step failed:', e.message);
  }
  try { await backfillBrandCommissionRate(db); } catch (e) {
    logger.error('[migrateCommissionsC15] brand rate backfill step failed:', e.message);
  }
}

module.exports = { migrateCommissionsC15 };
