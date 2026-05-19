/**
 * Phase 1 multi-brand migration helper.
 *
 * autoMigrateSchema() in server.js adds the brandCode / brandRelationships /
 * accessibleBrands / defaultBrand / productBrandingMode / privateLabelProductName
 * columns to existing tables when the corresponding model fields land.
 *
 * SQLite's ALTER TABLE ADD COLUMN does NOT apply Sequelize-level defaultValue
 * to existing rows — new columns come back as NULL. This helper does:
 *
 *   1) Backfill brandCode = 'SH' on every transactional row that's NULL.
 *   2) Backfill Customer.brandRelationships = ['SH'] on rows that are NULL.
 *   3) Backfill User.accessibleBrands = ['SH'], defaultBrand = 'SH' on NULLs.
 *      Then upgrade the super-admin user (or any user named in
 *      SUPER_ADMIN_EMAILS) to ['SH','FW'] so Alex has FW access from day one.
 *   4) Verify: re-query each transactional table for brandCode IS NULL.
 *      Logs offenders loudly so they show up in Sentry / pm2 logs, but
 *      does NOT crash boot. The brandScope middleware (Commit 3) treats
 *      NULL as a non-match, so under-filtering is the worst case — better
 *      than refusing to start on first deploy.
 *
 * Runs once per boot, idempotent: any row already non-NULL is left alone.
 */

const logger = require('../utils/logger');

// Every model that gets a single `brandCode` (Tier 1, 2, 3 of the plan).
// Customer + User get the multi-value treatment below.
const TX_MODELS = [
  'Lead', 'Deal', 'Quotation', 'Inquiry', 'SalesOrder', 'PurchaseOrder',
  'Invoice', 'ProformaInvoice',
  // Phase 4 C14 — Product catalog is brand-scoped.
  'Product',
  'Activity', 'OutreachEmail', 'TriageItem', 'ScheduledActivity',
  'Document', 'DocumentApproval',
  // Phase 1 Commit 3b-A — Expenses module is per-brand (SH offices
  // reimburse SH expenses, FW offices reimburse FW expenses; mixing
  // across the two legal entities is not allowed).
  'Expense', 'ReimbursementOffice', 'Trip', 'ExpenseSubmission',
];

// Users who should default to multi-brand access. Read from env so it's
// configurable per deployment (whitelabel-friendly) but falls back to the
// known Sovern super-admin.
function getMultiBrandUserEmails() {
  const raw = process.env.SUPER_ADMIN_EMAILS || 'alex@sovernhouse.co';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

async function backfillBrandsIfNeeded(db) {
  if (!db || !db.sequelize) {
    logger.warn('[migrateBrands] db not ready; skipping backfill');
    return;
  }
  const { Op } = db.Sequelize || require('sequelize');

  let updated = 0;

  // (1) brandCode on transactional tables — set 'SH' wherever NULL.
  for (const name of TX_MODELS) {
    const Model = db[name];
    if (!Model) continue;
    if (!Model.rawAttributes.brandCode) {
      // Model doesn't have the field yet (e.g. CRM module disabled mid-rollout)
      continue;
    }
    try {
      const [count] = await Model.update(
        { brandCode: 'SH' },
        { where: { brandCode: null }, validate: false, hooks: false, silent: true },
      );
      if (count > 0) {
        logger.info(`[migrateBrands] Backfilled ${count} ${name} row(s) to brandCode='SH'`);
        updated += count;
      }
    } catch (e) {
      logger.warn(`[migrateBrands] Backfill ${name}.brandCode failed: ${e.message}`);
    }
  }

  // (2) Customer.brandRelationships — set ['SH'] wherever NULL.
  if (db.Customer && db.Customer.rawAttributes.brandRelationships) {
    try {
      const [count] = await db.Customer.update(
        { brandRelationships: ['SH'] },
        { where: { brandRelationships: null }, validate: false, hooks: false, silent: true },
      );
      if (count > 0) {
        logger.info(`[migrateBrands] Backfilled ${count} Customer row(s) to brandRelationships=['SH']`);
        updated += count;
      }
    } catch (e) {
      logger.warn(`[migrateBrands] Backfill Customer.brandRelationships failed: ${e.message}`);
    }
  }

  // (3a) User.accessibleBrands / defaultBrand — set defaults wherever NULL.
  if (db.User && db.User.rawAttributes.accessibleBrands) {
    try {
      const [count] = await db.User.update(
        { accessibleBrands: ['SH'], defaultBrand: 'SH' },
        { where: { accessibleBrands: null }, validate: false, hooks: false, silent: true },
      );
      if (count > 0) {
        logger.info(`[migrateBrands] Backfilled ${count} User row(s) to accessibleBrands=['SH']`);
        updated += count;
      }
    } catch (e) {
      logger.warn(`[migrateBrands] Backfill User.accessibleBrands failed: ${e.message}`);
    }
  }

  // (3b) Promote configured super-admin users to multi-brand access.
  //
  // Phase 4.28y (2026-05-19): two bugs fixed at once.
  //
  //   1. L-047 recurrence — Sequelize returned u.accessibleBrands as a
  //      stringified JSON array on some query paths. Array.isArray(string)
  //      is false, so the prior version believed current=[], ran the
  //      merge, and silently overwrote the existing value with
  //      ['SH','FW'] every boot. For Alex specifically this stripped
  //      'HH' every pm2 restart, causing the recurring
  //      'Failed to load product' on ILCN-* clicks. Parse-on-read.
  //
  //   2. HH is now an active brand (Phase 4.28l SKU split). Every
  //      super-admin needs SH + FW + HH coverage by default. The merge
  //      now adds all three; existing brands on the row are preserved.
  if (db.User && db.User.rawAttributes.accessibleBrands) {
    const emails = getMultiBrandUserEmails();
    if (emails.length) {
      try {
        const users = await db.User.findAll({
          where: { email: { [Op.in]: emails } },
        });
        const REQUIRED_BRANDS = ['SH', 'FW', 'HH'];
        for (const u of users) {
          let raw = u.accessibleBrands;
          if (typeof raw === 'string') {
            try { raw = JSON.parse(raw); } catch (_) { raw = null; }
          }
          const current = Array.isArray(raw) ? raw : [];
          // Compute what's missing; only update when at least one
          // required brand is absent so re-boots are a no-op once
          // every super-admin is fully provisioned.
          const missing = REQUIRED_BRANDS.filter(b => !current.includes(b));
          if (missing.length > 0) {
            const merged = Array.from(new Set([...current, ...REQUIRED_BRANDS]));
            await u.update(
              { accessibleBrands: merged },
              { validate: false, hooks: false, silent: true },
            );
            logger.info(`[migrateBrands] Upgraded ${u.email} accessibleBrands → ${JSON.stringify(merged)} (added: ${missing.join(', ')})`);
            updated++;
          }
        }
      } catch (e) {
        logger.warn(`[migrateBrands] Super-admin upgrade failed: ${e.message}`);
      }
    }
  }

  // (4) Fail-fast verification — every transactional table must be brand-tagged.
  const offenders = [];
  for (const name of TX_MODELS) {
    const Model = db[name];
    if (!Model || !Model.rawAttributes.brandCode) continue;
    try {
      const nullCount = await Model.count({ where: { brandCode: null } });
      if (nullCount > 0) offenders.push(`${name}=${nullCount}`);
    } catch (e) {
      // If a table is missing entirely (e.g. fresh deploy before sync), skip.
      if (!/no such table/i.test(e.message)) {
        logger.warn(`[migrateBrands] Verify ${name} failed: ${e.message}`);
      }
    }
  }
  if (offenders.length > 0) {
    // Warn-and-continue: brandScope (Commit 3) treats NULL as a non-match,
    // which under-filters but is preferable to refusing boot on first deploy.
    // The offending tables/counts are logged here so a follow-up pass can
    // hand-fix them.
    logger.warn(`[migrateBrands] brandCode NULL after backfill: ${offenders.join(', ')} — investigate and re-run backfill manually if persistent`);
    return;
  }

  if (updated > 0) {
    logger.info(`[migrateBrands] Done — ${updated} row(s) updated`);
  }
}

module.exports = { backfillBrandsIfNeeded, TX_MODELS };
