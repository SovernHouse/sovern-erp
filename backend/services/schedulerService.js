/**
 * schedulerService.js
 *
 * Background job scheduler using node-cron.
 * Handles recurring business automation that would otherwise require manual checks.
 *
 * Jobs defined here:
 *   1. [Every morning 08:00] Overdue activity reminder — flag CRM activities
 *      whose dueDate has passed and are still not completed; create an in-app
 *      notification for the assigned user.
 *
 *   2. [Every morning 08:00] Follow-up reminder — flag outreach emails whose
 *      followUpDueAt is today or past, not yet completed; notify the sender.
 *
 *   3. [Every hour] Invoice overdue auto-transition — move any Invoice whose
 *      dueDate has passed from status 'sent' / 'pending' → 'overdue'.
 *
 *   4. [Every morning 08:00] Sales order production reminders — notify assigned
 *      users when an order has been in 'in_production' status for more than the
 *      expected lead time (configurable via PRODUCTION_ALERT_DAYS, default 45).
 *
 *   5. [Every night 02:00] Data retention hard-delete — permanently remove
 *      soft-deleted records (paranoid models) whose deletedAt is older than
 *      DATA_RETENTION_DAYS (default 365). Covers: Customer, Factory, SalesOrder,
 *      PurchaseOrder, Invoice, Payment, SpecTemplate. Logs a summary of what
 *      was purged. Supports GDPR right-to-erasure workflows.
 *
 * All jobs are silent on success; errors are logged but never crash the server.
 *
 * To disable individual jobs, set the corresponding env var to 'false':
 *   SCHEDULER_ACTIVITY_REMINDERS=false
 *   SCHEDULER_FOLLOWUP_REMINDERS=false
 *   SCHEDULER_INVOICE_OVERDUE=false
 *   SCHEDULER_PRODUCTION_ALERTS=false
 *   SCHEDULER_DATA_RETENTION=false
 *
 * Data retention window:
 *   DATA_RETENTION_DAYS=365   (default — hard-delete after 1 year)
 *
 * Requires: npm install node-cron
 */

const cron = require('node-cron');
const dayjs = require('dayjs');
const { Op } = require('sequelize');

let db;
let notificationService;

// Lazy-load to avoid circular require issues at startup
function getDB() {
  if (!db) db = require('../models');
  return db;
}

function getNotificationService() {
  if (!notificationService) notificationService = require('./notificationService');
const logger = require('../utils/logger.js');
  return notificationService;
}

// ─── Job 1: Overdue activity reminders ────────────────────────────────────────
async function checkOverdueActivities() {
  const db = getDB();
  const ns = getNotificationService();
  try {
    const overdue = await db.Activity.findAll({
      where: {
        dueDate: { [Op.lt]: dayjs().startOf('day').toDate() },
        completed: false,
        reminderSent: { [Op.not]: true },
      },
      include: [{ model: db.Lead, attributes: ['id', 'companyName'] }],
    });

    for (const activity of overdue) {
      try {
        await ns.createNotification({
          userId: activity.assignedTo || activity.createdBy,
          type: 'activity_overdue',
          title: 'Overdue Activity',
          message: `Activity "${activity.title}" for ${activity.lead?.companyName || 'a lead'} was due ${dayjs(activity.dueDate).format('MMM D')} and is not yet completed.`,
          entityType: 'Activity',
          entityId: activity.id,
        });

        // Mark reminder sent so we don't spam daily
        await activity.update({ reminderSent: true });
      } catch (err) {
        logger.error(`[SCHEDULER] Failed to notify overdue activity ${activity.id}:`, err.message);
      }
    }

    if (overdue.length > 0) {
      logger.info(`[SCHEDULER] Overdue activity reminders sent: ${overdue.length}`);
    }
  } catch (err) {
    logger.error('[SCHEDULER] checkOverdueActivities error:', err.message);
  }
}

// ─── Job 2: Follow-up reminders ───────────────────────────────────────────────
async function checkFollowups() {
  const db = getDB();
  const ns = getNotificationService();
  try {
    const today = dayjs().endOf('day').toDate();
    const due = await db.OutreachEmail.findAll({
      where: {
        followUpCompleted: false,
        followUpDueAt: { [Op.lte]: today, [Op.not]: null },
      },
      include: [
        { model: db.Lead, as: 'lead', attributes: ['id', 'companyName', 'contactName'] },
        { model: db.User, as: 'sentBy', attributes: ['id', 'firstName', 'lastName'] },
      ],
    });

    for (const email of due) {
      const userId = email.sentByUserId;
      if (!userId) continue;
      try {
        await ns.createNotification({
          userId,
          type: 'followup_due',
          title: 'Follow-up Due',
          message: `Follow-up for ${email.lead?.companyName || email.toAddress} (touch #${email.touchNumber}) is due today.`,
          entityType: 'OutreachEmail',
          entityId: email.id,
        });
      } catch (err) {
        logger.error(`[SCHEDULER] Failed to notify follow-up ${email.id}:`, err.message);
      }
    }

    if (due.length > 0) {
      logger.info(`[SCHEDULER] Follow-up reminders sent: ${due.length}`);
    }
  } catch (err) {
    logger.error('[SCHEDULER] checkFollowups error:', err.message);
  }
}

// ─── Job 3: Invoice overdue auto-transition ───────────────────────────────────
async function transitionOverdueInvoices() {
  const db = getDB();
  try {
    const now = new Date();
    const [updatedCount] = await db.Invoice.update(
      { status: 'overdue' },
      {
        where: {
          dueDate: { [Op.lt]: now },
          status: { [Op.in]: ['sent', 'pending'] },
        },
      }
    );

    if (updatedCount > 0) {
      logger.info(`[SCHEDULER] Invoices transitioned to overdue: ${updatedCount}`);
    }
  } catch (err) {
    // If Invoice model doesn't exist, skip silently
    if (err.name !== 'SequelizeDatabaseError') {
      logger.error('[SCHEDULER] transitionOverdueInvoices error:', err.message);
    }
  }
}

// ─── Job 4: Production delay alerts ──────────────────────────────────────────
async function checkProductionDelays() {
  const db = getDB();
  const ns = getNotificationService();
  const alertDays = parseInt(process.env.PRODUCTION_ALERT_DAYS || '45', 10);

  try {
    const cutoff = dayjs().subtract(alertDays, 'day').toDate();
    const delayed = await db.SalesOrder.findAll({
      where: {
        status: 'in_production',
        updatedAt: { [Op.lt]: cutoff },
      },
      include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }],
    });

    for (const so of delayed) {
      try {
        await ns.createNotification({
          type: 'production_delayed',
          title: 'Production Delay Alert',
          message: `Sales Order ${so.orderNumber} (${so.customer?.companyName || ''}) has been in production for over ${alertDays} days.`,
          entityType: 'SalesOrder',
          entityId: so.id,
        });
      } catch (err) {
        logger.error(`[SCHEDULER] Failed to alert production delay ${so.id}:`, err.message);
      }
    }

    if (delayed.length > 0) {
      logger.info(`[SCHEDULER] Production delay alerts sent: ${delayed.length}`);
    }
  } catch (err) {
    logger.error('[SCHEDULER] checkProductionDelays error:', err.message);
  }
}

// ─── Job 5: Data retention hard-delete ───────────────────────────────────────
/**
 * Permanently purge soft-deleted records that are older than DATA_RETENTION_DAYS.
 *
 * Why: paranoid:true keeps deletedAt rows indefinitely by default. Without a
 * hard-delete policy, the DB grows unbounded and GDPR right-to-erasure requests
 * cannot be fulfilled. This job runs nightly at 02:00 and permanently removes
 * any record whose deletedAt < (now - retentionDays).
 *
 * Paranoid models covered: Customer, Factory, SalesOrder, PurchaseOrder,
 * Invoice, Payment, SpecTemplate.
 *
 * To disable: SCHEDULER_DATA_RETENTION=false
 * To change window: DATA_RETENTION_DAYS=180  (default 365)
 */
async function purgeExpiredSoftDeletes() {
  const db = getDB();
  const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS || '365', 10);
  const cutoff = dayjs().subtract(retentionDays, 'day').toDate();

  // All models that use paranoid:true — add any new ones here
  const PARANOID_MODELS = [
    'Customer',
    'Factory',
    'SalesOrder',
    'PurchaseOrder',
    'Invoice',
    'Payment',
    'SpecTemplate',
  ];

  const summary = [];

  for (const modelName of PARANOID_MODELS) {
    const model = db[modelName];
    if (!model) {
      logger.warn(`[SCHEDULER][RETENTION] Model "${modelName}" not found — skipping.`);
      continue;
    }

    try {
      // Disable FK constraints for the delete to avoid cascade errors on models
      // whose related tables may have mismatched names in the SQLite schema.
      // Re-enable immediately after regardless of success/failure.
      await db.sequelize.query('PRAGMA foreign_keys = OFF');
      let count = 0;
      try {
        count = await model.destroy({
          where: {
            deletedAt: { [Op.lt]: cutoff },
          },
          force: true, // hard delete — bypasses paranoid
        });
      } finally {
        await db.sequelize.query('PRAGMA foreign_keys = ON');
      }

      if (count > 0) {
        summary.push(`${modelName}: ${count}`);
      }
    } catch (err) {
      logger.error(`[SCHEDULER][RETENTION] Failed to purge ${modelName}:`, err.message);
    }
  }

  if (summary.length > 0) {
    logger.info(`[SCHEDULER][RETENTION] Hard-deleted expired records (>${retentionDays} days old): ${summary.join(', ')}`);
  } else {
    logger.info(`[SCHEDULER][RETENTION] No expired soft-deleted records found (retention window: ${retentionDays} days).`);
  }
}

// ─── Job 7: Sanctions list refresh (Phase 4, C18) ────────────────────────────
// Daily at 03:30 server time. Downloads the 4 sanctions lists; failures
// retain the last-known-good cache. Audited as sanctions_refresh.
async function refreshSanctionsLists() {
  try {
    const sanctionsService = require('./sanctionsService');
    const auditService = require('./auditService');
    const results = await sanctionsService.refreshSanctionsData();
    await auditService.logAction(
      null,
      'sanctions_refresh',
      'System',
      '00000000-0000-0000-0000-000000000000',
      { results, ranAt: new Date().toISOString() },
      null,
    ).catch(() => {});
    const ok = results.filter((r) => r.ok).length;
    const fail = results.length - ok;
    logger.info(`[SCHEDULER][SANCTIONS] Refresh complete: ${ok} ok, ${fail} failed`);

    // Phase 4.13.6: after every refresh, check whether any source has
    // been failing for 3+ consecutive runs. Fire a Notification (admin
    // dashboard) + email Alex when the streak alert trips.
    if (fail > 0) {
      try {
        await alertSanctionsRefreshFailureStreaks(sanctionsService);
      } catch (alertErr) {
        logger.warn('[SCHEDULER][SANCTIONS] streak alert error (non-fatal):', alertErr.message);
      }
    }
  } catch (err) {
    logger.error('[SCHEDULER][SANCTIONS] refresh error:', err.message);
  }
}

// Phase 4.13.6: fires a Notification + email to admins when a sanctions
// source has been failing for 3+ consecutive runs. Notification routes
// to every super_admin (and falls back to the first admin if no
// super_admin user is found). Email routes to ADMIN_NOTIFY_EMAIL or
// alex@sovernhouse.co as a hard-coded last resort.
async function alertSanctionsRefreshFailureStreaks(sanctionsService) {
  const db = getDB();
  if (!db?.AuditLog || !db?.User || !db?.Notification) return;

  const alerts = await sanctionsService.checkRefreshFailureStreaks(db, {
    thresholdDays: 3,
    lookbackDays: 7,
  });
  if (alerts.length === 0) return;

  // Route to super_admin users; fall back to any admin if none.
  let recipients = await db.User.findAll({
    where: { role: 'super_admin', isActive: true },
    attributes: ['id', 'email', 'firstName'],
    limit: 5,
  });
  if (recipients.length === 0) {
    recipients = await db.User.findAll({
      where: { role: 'admin', isActive: true },
      attributes: ['id', 'email', 'firstName'],
      limit: 1,
    });
  }
  if (recipients.length === 0) {
    logger.warn('[SCHEDULER][SANCTIONS] streak alert tripped but no admin recipients to notify');
    return;
  }

  const summary = alerts
    .map(a => `${a.label} (${a.key}): ${a.consecutiveFailures} consecutive failures, latest error: ${a.latestError || 'unknown'}`)
    .join('\n');
  const title = `Sanctions list refresh failing: ${alerts.length} source(s)`;
  const message = `The daily sanctions refresh has been failing for one or more sources.\n\n${summary}\n\nThe screening service is using cached data (last-known-good). Investigate the upstream sources and restore.`;

  // In-app notifications for every recipient.
  for (const u of recipients) {
    try {
      await db.Notification.create({
        userId: u.id,
        type: 'system',
        title,
        message,
        data: { kind: 'sanctions_refresh_failure_streak', alerts },
      });
    } catch (e) {
      logger.warn(`[SCHEDULER][SANCTIONS] notification create failed for ${u.email}: ${e.message}`);
    }
  }

  // Email Alex (or whoever is configured) — single mail to one address.
  // Skipping deliberately when EMAIL_ENABLED isn't set; sendEmail's own
  // disabled-mode guard handles dev/local cases cleanly.
  try {
    const emailService = require('./emailService');
    const to = process.env.ADMIN_NOTIFY_EMAIL || 'alex@sovernhouse.co';
    await emailService.sendEmail(
      to,
      `[Sovern ERP] ${title}`,
      `<p>${message.replace(/\n/g, '<br>')}</p>`,
    );
  } catch (e) {
    logger.warn(`[SCHEDULER][SANCTIONS] streak alert email failed: ${e.message}`);
  }

  logger.warn(`[SCHEDULER][SANCTIONS] streak alert fired for ${alerts.length} source(s): ${alerts.map(a => a.key).join(', ')}`);
}

// ─── Job 8: 90-day rescreen (Phase 4, C18) ───────────────────────────────────
// Daily at 04:00 server time. Re-screens active customers whose
// lastScreenedAt is older than 90 days (or NULL). Status updates persist;
// flagged customers are blocked at the 4 hard-block entry points until
// super-admin clears or overrides. Audited as sanctions_rescreen_batch.
async function rescreenCustomers90d() {
  const db = getDB();
  try {
    const sanctionsService = require('./sanctionsService');
    const auditService = require('./auditService');
    const cutoff = dayjs().subtract(90, 'day').toDate();
    const due = await db.Customer.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { lastScreenedAt: null },
          { lastScreenedAt: { [Op.lt]: cutoff } },
        ],
      },
      limit: 500,
    });
    let cleared = 0, flagged = 0, review = 0;
    for (const cust of due) {
      try {
        const result = sanctionsService.screenName(cust.companyName, cust.country);
        const updates = {
          screeningStatus: cust.screeningStatus === 'override' ? 'override' : result.status,
          sanctionsScreenDetails: result.hits,
          lastScreenedAt: new Date(),
        };
        if (result.status === 'flagged' && cust.screeningStatus !== 'override') {
          updates.sanctionBlockReason = `Matched on ${result.hits.map((h) => h.list).join(', ')}`;
        }
        await cust.update(updates);
        if (result.status === 'flagged') flagged++;
        else if (result.status === 'requires_review') review++;
        else cleared++;
      } catch (err) {
        logger.warn(`[SCHEDULER][SANCTIONS] rescreen failed for ${cust.id}: ${err.message}`);
      }
    }
    auditService.logAction(
      null,
      'sanctions_rescreen_batch',
      'System',
      '00000000-0000-0000-0000-000000000000',
      { total: due.length, cleared, flagged, review, ranAt: new Date().toISOString() },
      null,
    ).catch(() => {});
    if (due.length > 0) {
      logger.info(`[SCHEDULER][SANCTIONS] Rescreen batch: ${due.length} screened (${cleared} cleared, ${flagged} flagged, ${review} review)`);
    }
  } catch (err) {
    logger.error('[SCHEDULER][SANCTIONS] rescreen error:', err.message);
  }
}

// ─── Job 6: Triage auto-archive ───────────────────────────────────────────────
// Runs every hour. Archives pending TriageItems whose autoArchiveAt has passed.
async function autoArchiveTriageItems() {
  try {
    const triageController = require('../controllers/triageController');
    await triageController.runAutoArchive();
  } catch (err) {
    logger.error('[SCHEDULER][TRIAGE-ARCHIVE] Error:', err.message);
  }
}

// ─── Scheduler bootstrap ──────────────────────────────────────────────────────
function startScheduler() {
  const enabled = {
    activityReminders: process.env.SCHEDULER_ACTIVITY_REMINDERS !== 'false',
    followupReminders: process.env.SCHEDULER_FOLLOWUP_REMINDERS !== 'false',
    invoiceOverdue:    process.env.SCHEDULER_INVOICE_OVERDUE    !== 'false',
    productionAlerts:  process.env.SCHEDULER_PRODUCTION_ALERTS  !== 'false',
    dataRetention:     process.env.SCHEDULER_DATA_RETENTION     !== 'false',
    triageAutoArchive: process.env.SCHEDULER_TRIAGE_ARCHIVE     !== 'false',
    sanctionsRefresh:  process.env.SCHEDULER_SANCTIONS_REFRESH  !== 'false',
    sanctionsRescreen: process.env.SCHEDULER_SANCTIONS_RESCREEN !== 'false',
  };

  // Jobs that run every morning at 08:00 server time
  if (enabled.activityReminders) {
    cron.schedule('0 8 * * *', checkOverdueActivities, { name: 'activity-reminders' });
  }

  if (enabled.followupReminders) {
    cron.schedule('0 8 * * *', checkFollowups, { name: 'followup-reminders' });
  }

  if (enabled.productionAlerts) {
    cron.schedule('0 8 * * *', checkProductionDelays, { name: 'production-alerts' });
  }

  // Invoice overdue transition runs every hour
  if (enabled.invoiceOverdue) {
    cron.schedule('0 * * * *', transitionOverdueInvoices, { name: 'invoice-overdue' });
  }

  // Data retention hard-delete runs nightly at 02:00 — off-peak to avoid query contention
  if (enabled.dataRetention) {
    cron.schedule('0 2 * * *', purgeExpiredSoftDeletes, { name: 'data-retention' });
  }

  // Triage auto-archive runs every hour alongside invoice overdue check
  if (enabled.triageAutoArchive) {
    cron.schedule('0 * * * *', autoArchiveTriageItems, { name: 'triage-auto-archive' });
  }

  // Phase 4, C18: sanctions list refresh at 03:30 and customer rescreen
  // at 04:00. Server-local time, off-peak after data retention.
  if (enabled.sanctionsRefresh) {
    cron.schedule('30 3 * * *', refreshSanctionsLists, { name: 'sanctions-refresh' });
  }
  if (enabled.sanctionsRescreen) {
    cron.schedule('0 4 * * *', rescreenCustomers90d, { name: 'sanctions-rescreen' });
  }

  const activeJobs = Object.entries(enabled)
    .filter(([, v]) => v)
    .map(([k]) => k);

  logger.info(`[SCHEDULER] Started. Active jobs: ${activeJobs.join(', ')}`);

  return { enabled, activeJobs };
}

module.exports = {
  startScheduler,
  // Exported individually so unit tests can call them directly
  checkOverdueActivities,
  checkFollowups,
  transitionOverdueInvoices,
  checkProductionDelays,
  purgeExpiredSoftDeletes,
  autoArchiveTriageItems,
  refreshSanctionsLists,
  rescreenCustomers90d,
};
