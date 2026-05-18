/**
 * migrate417LeadDraftBackfill — Phase 4.17.
 *
 * Converges the Draft Cold Email widget on OutreachEmail as the single
 * source of truth. Lead.draftEmailSubject + Lead.draftEmailBody are
 * deprecated columns kept readable for one phase; new code writes
 * OutreachEmail rows with status='draft' exclusively.
 *
 * This migration lifts the existing inline drafts into OutreachEmail
 * rows so the new widget surfaces them immediately. For every Lead
 * where draftEmailSubject OR draftEmailBody is non-empty AND no
 * OutreachEmail row with status='draft' already exists for that lead,
 * create the draft row with:
 *   - fromAddress = Brand.senderEmail for lead.brandCode (fallback
 *     alex@sovernhouse.co — the legacy default, only reached when the
 *     brand row is missing)
 *   - toAddress = lead.email, toName = lead.contactName
 *   - subject + bodyText from the inline columns (placeholders only
 *     when one side is blank, so the widget shows the partial draft)
 *   - touchNumber = 1, brandCode = lead.brandCode
 *
 * Idempotent via AuditLog sentinel `phase4_17_lead_draft_columns_backfilled`.
 * Each backfilled row also writes a `phase4_17_lead_draft_backfilled`
 * audit row keyed to the new OutreachEmail id (granular trace).
 *
 * Milliken Lead 79487b1c-07a2-47a8-9f15-2a163a34f0cd: the inline draft
 * was manually synced to OutreachEmail earlier today, so the
 * already-exists check will skip it cleanly.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_17_lead_draft_columns_backfilled';
const ROW_ACTION = 'phase4_17_lead_draft_backfilled';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function migrate417LeadDraftBackfill(db) {
  if (!db?.sequelize) {
    logger.warn('[phase4_17] sequelize unavailable; skipping');
    return { skipped: true };
  }
  if (!db.AuditLog || !db.Lead || !db.OutreachEmail) {
    logger.warn('[phase4_17] AuditLog/Lead/OutreachEmail unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) {
    return { skipped: true, reason: 'sentinel-present' };
  }

  const stats = {
    leadsScanned: 0,
    rowsCreated: 0,
    rowsSkippedAlreadyDraft: 0,
    rowsSkippedNoContent: 0,
  };

  // Cache brand sender lookups so we hit Brand once per code, not once per lead.
  const brandCache = new Map();
  async function senderForBrand(code) {
    if (!code) return 'alex@sovernhouse.co';
    if (brandCache.has(code)) return brandCache.get(code);
    const brand = await db.Brand.findOne({ where: { code, active: true } });
    const sender = brand?.senderEmail || 'alex@sovernhouse.co';
    brandCache.set(code, sender);
    return sender;
  }

  const { Op } = require('sequelize');
  const candidates = await db.Lead.findAll({
    where: {
      [Op.or]: [
        { draftEmailSubject: { [Op.ne]: null } },
        { draftEmailBody: { [Op.ne]: null } },
      ],
    },
    attributes: ['id', 'email', 'contactName', 'brandCode', 'draftEmailSubject', 'draftEmailBody'],
  });

  for (const lead of candidates) {
    stats.leadsScanned += 1;
    const rawSubject = (lead.draftEmailSubject || '').trim();
    const rawBody = (lead.draftEmailBody || '').trim();
    if (!rawSubject && !rawBody) {
      stats.rowsSkippedNoContent += 1;
      continue;
    }

    const existing = await db.OutreachEmail.findOne({
      where: { leadId: lead.id, status: 'draft' },
    });
    if (existing) {
      stats.rowsSkippedAlreadyDraft += 1;
      continue;
    }

    const fromAddress = await senderForBrand(lead.brandCode);
    const subject = rawSubject || '(draft subject — add before sending)';
    const bodyText = rawBody || '(draft body — add content before sending)';

    const row = await db.OutreachEmail.create({
      leadId: lead.id,
      sentByUserId: null,
      fromAddress,
      toAddress: lead.email,
      toName: lead.contactName || null,
      subject,
      bodyText,
      touchNumber: 1,
      status: 'draft',
      smtpMessageId: null,
      sentAt: null,
      followUpDueAt: null,
      followUpCompleted: false,
      brandCode: lead.brandCode || 'SH',
    });
    stats.rowsCreated += 1;

    await db.AuditLog.create({
      action: ROW_ACTION,
      entity: 'OutreachEmail',
      entityId: row.id,
      userId: null,
      changes: {
        leadId: lead.id,
        brandCode: lead.brandCode || 'SH',
        subjectPreview: subject.slice(0, 120),
        liftedFrom: 'Lead.inlineDraftColumns',
      },
    }).catch(() => {});
  }

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: stats,
  });

  logger.info(`[phase4_17] complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { migrate417LeadDraftBackfill, SENTINEL_ACTION, ROW_ACTION };
