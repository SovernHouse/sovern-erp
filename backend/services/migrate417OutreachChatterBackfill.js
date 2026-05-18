/**
 * migrate417OutreachChatterBackfill — Phase 4.17 bugfix follow-up (2026-05-18).
 *
 * Companion to the Phase 4.17 chatter-on-send fix. Before the fix,
 * sendOutreachEmailToLead and the MCP send_outreach_email handler never
 * wrote a ChatterMessage on the Lead, so the Lead detail Chatter tab had
 * no trail for any historical send. This migration walks every
 * OutreachEmail with status='sent' that lacks a matching
 * "Outreach email sent to ..." chatter event on its Lead and writes a
 * single backdated chatter row using the OutreachEmail's sent_at /
 * sent_by_user_id metadata so the trail is intact when the operator
 * opens the Lead detail page after the fix.
 *
 * Idempotent via AuditLog sentinel
 * `phase4_17_outreach_chatter_backfilled`.
 *
 * Matches on entity_type='Lead', entity_id=lead.id, body prefix
 * 'Outreach email sent to <to_address>' — same prefix the forward fix
 * writes. Re-running the migration will skip any row that already has
 * a matching chatter line (idempotent regardless of how new rows
 * accumulated between runs).
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_17_outreach_chatter_backfilled';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

async function migrate417OutreachChatterBackfill(db) {
  if (!db?.sequelize) return { skipped: true };
  if (!db.AuditLog || !db.OutreachEmail || !db.ChatterMessage || !db.Lead) {
    logger.warn('[phase4_17_chatter] required models unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) return { skipped: true, reason: 'sentinel-present' };

  const stats = { sentRowsScanned: 0, chatterBackfilled: 0, skippedAlreadyChattered: 0 };

  const sentRows = await db.OutreachEmail.findAll({
    where: { status: 'sent' },
    include: [
      { model: db.Lead, as: 'lead', attributes: ['id', 'companyName', 'brandCode'] },
      { model: db.User, as: 'sentBy', attributes: ['id', 'firstName', 'lastName', 'email'] },
    ],
    order: [['sentAt', 'ASC']],
  });

  // Brand cache for the displayName lookup. Best-effort — falls back to
  // brand_code string if the Brand row is gone.
  const brandCache = new Map();
  async function brandLabel(code) {
    if (!code) return '';
    if (brandCache.has(code)) return brandCache.get(code);
    const b = await db.Brand.findOne({ where: { code } });
    const label = b?.displayName || code;
    brandCache.set(code, label);
    return label;
  }

  for (const row of sentRows) {
    stats.sentRowsScanned += 1;
    if (!row.lead) continue; // orphan — skip rather than guess
    const leadId = row.lead.id;

    const prefix = `Outreach email sent to ${row.toAddress}`;
    const { Op } = require('sequelize');
    const already = await db.ChatterMessage.findOne({
      where: {
        entityType: 'Lead',
        entityId: leadId,
        body: { [Op.like]: `${prefix}%` },
      },
    });
    if (already) {
      stats.skippedAlreadyChattered += 1;
      continue;
    }

    const brandName = await brandLabel(row.brandCode);
    const author = row.sentBy
      ? (`${row.sentBy.firstName || ''} ${row.sentBy.lastName || ''}`.trim() || row.sentBy.email)
      : 'System';
    const subjectPreview = (row.subject || '').slice(0, 120);
    const body = `${prefix} from ${row.fromAddress}${brandName ? ` (${brandName})` : ''}. Subject: "${subjectPreview}". Touch ${row.touchNumber || 1}.`;

    await db.ChatterMessage.create({
      entityType: 'Lead',
      entityId: leadId,
      messageType: 'event',
      body,
      userId: row.sentByUserId || null,
      authorName: author,
      metadata: {
        outreachEmailId: row.id,
        fromAddress: row.fromAddress,
        toAddress: row.toAddress,
        touchNumber: row.touchNumber || 1,
        smtpMessageId: row.smtpMessageId || null,
        brandCode: row.brandCode || null,
        backfilled: true,
      },
      attachments: [],
      createdAt: row.sentAt || row.createdAt || new Date(),
      updatedAt: row.sentAt || row.createdAt || new Date(),
    });
    stats.chatterBackfilled += 1;
  }

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: stats,
  });

  logger.info(`[phase4_17_chatter] complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { migrate417OutreachChatterBackfill, SENTINEL_ACTION };
