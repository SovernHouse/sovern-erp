const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const db = require('../models');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const logger = require('../utils/logger.js');

const FANZEY_EMAIL = process.env.FANZEY_EMAIL || 'mohanadfanzey@gmail.com';
const FANZEY_NAME = process.env.FANZEY_NAME || 'Mohannad Fanzey';
const AUTO_ARCHIVE_DAYS = 7;

// ─── LIST ────────────────────────────────────────────────────────────────────

exports.listTriageItems = async (req, res) => {
  const { status = 'pending', page = 1, limit = 50, intentScore } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const where = {};

  if (status === 'pending') {
    // Exclude auto-expired items from the pending view
    where.status = 'pending';
    where.autoArchiveAt = { [Op.gt]: new Date() };
  } else if (status !== 'all') {
    where.status = status;
  }

  if (intentScore) where.intentScore = intentScore;

  const [count, rows] = await Promise.all([
    db.TriageItem.count({ where }),
    db.TriageItem.findAll({
      where,
      order: [
        // High intent first, then newest
        [db.sequelize.literal(`CASE intent_score WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'low' THEN 2 ELSE 3 END`), 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit: parseInt(limit),
      offset,
      include: [
        {
          model: db.OutreachEmail,
          as: 'matchedOutreachEmail',
          required: false,
          attributes: ['id', 'subject', 'toAddress', 'sentAt'],
        },
      ],
    }),
  ]);

  // Count pending + high-intent for notification badge
  const pendingCount = await db.TriageItem.count({
    where: {
      status: 'pending',
      autoArchiveAt: { [Op.gt]: new Date() },
    },
  });

  return res.json({
    success: true,
    data: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limit)),
      pageSize: parseInt(limit),
    },
    pendingCount,
  });
};

// ─── GET ONE ─────────────────────────────────────────────────────────────────

exports.getTriageItem = async (req, res) => {
  const item = await db.TriageItem.findByPk(req.params.id, {
    include: [
      { model: db.OutreachEmail, as: 'matchedOutreachEmail', required: false },
      { model: db.Lead, as: 'promotedLead', required: false },
    ],
  });
  if (!item) throw new NotFoundError('Triage item not found');
  return res.json({ success: true, data: item });
};

// ─── CREATE (called by Cowork task) ──────────────────────────────────────────

exports.createTriageItem = async (req, res) => {
  const {
    gmailMessageId,
    inReplyToMessageId,
    senderName,
    senderCompany,
    senderEmail,
    country,
    productInterest,
    intentScore,
    suggestedAction,
    detectedLanguage,
    subject,
    bodySnippet,
    rawEmailData,
    isReplyToOutreach,
    matchedOutreachEmailId,
  } = req.body;

  if (!gmailMessageId || !senderEmail) {
    throw new ValidationError('gmailMessageId and senderEmail are required');
  }

  // Idempotent: skip if already processed
  const existing = await db.TriageItem.findOne({ where: { gmailMessageId } });
  if (existing) {
    return res.status(200).json({ success: true, data: existing, skipped: true });
  }

  const autoArchiveAt = new Date();
  autoArchiveAt.setDate(autoArchiveAt.getDate() + AUTO_ARCHIVE_DAYS);

  const item = await db.TriageItem.create({
    gmailMessageId,
    inReplyToMessageId: inReplyToMessageId || null,
    senderName: senderName || null,
    senderCompany: senderCompany || null,
    senderEmail,
    country: country || null,
    productInterest: productInterest || null,
    intentScore: intentScore || null,
    suggestedAction: suggestedAction || null,
    detectedLanguage: detectedLanguage || null,
    subject: subject || null,
    bodySnippet: bodySnippet ? bodySnippet.slice(0, 500) : null,
    rawEmailData: rawEmailData || {},
    isReplyToOutreach: !!isReplyToOutreach,
    matchedOutreachEmailId: matchedOutreachEmailId || null,
    status: 'pending',
    autoArchiveAt,
  });

  // Fire notification to all admin users
  await _notifyAdmins(
    `New inbound email from ${senderCompany || senderEmail}`,
    `${intentScore ? `[${intentScore.toUpperCase()}] ` : ''}${subject || '(no subject)'} — ${senderEmail}`,
    item.id
  );

  return res.status(201).json({ success: true, data: item });
};

// ─── PROMOTE TO LEAD (Q7-B) ───────────────────────────────────────────────────

exports.promoteToLead = async (req, res) => {
  const item = await db.TriageItem.findByPk(req.params.id);
  if (!item) throw new NotFoundError('Triage item not found');
  if (item.status !== 'pending') {
    throw new ValidationError(`Cannot promote item with status: ${item.status}`);
  }

  // High intent → Qualified; otherwise → New
  const leadStatus = item.intentScore === 'high' ? 'qualified' : 'new';

  const lead = await db.Lead.create({
    companyName: item.senderCompany || item.senderEmail.split('@')[1] || 'Unknown Company',
    contactName: item.senderName || item.senderEmail.split('@')[0],
    email: item.senderEmail,
    country: item.country || null,
    source: 'other',
    leadType: 'inbound',
    status: leadStatus,
    description: [
      `[Inbound Email Triage]`,
      item.productInterest ? `Product Interest: ${item.productInterest}` : null,
      item.subject ? `Subject: ${item.subject}` : null,
      item.bodySnippet ? `\nEmail Snippet:\n${item.bodySnippet}` : null,
      item.detectedLanguage && item.detectedLanguage !== 'en'
        ? `Detected Language: ${item.detectedLanguage}`
        : null,
    ].filter(Boolean).join('\n'),
    tags: ['inbound-email', 'triage'],
    assignedToId: req.user?.id || null,
  });

  await item.update({
    status: 'promoted',
    promotedLeadId: lead.id,
  });

  return res.json({
    success: true,
    data: { triageItem: item, lead },
    message: `Lead created with status: ${leadStatus}`,
  });
};

// ─── FORWARD TO FANZEY ────────────────────────────────────────────────────────

exports.forwardToFanzey = async (req, res) => {
  const item = await db.TriageItem.findByPk(req.params.id);
  if (!item) throw new NotFoundError('Triage item not found');
  if (item.status !== 'pending') {
    throw new ValidationError(`Cannot forward item with status: ${item.status}`);
  }

  // Send email via outreach controller logic
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const forwardSubject = `[Fwd - Egypt Lead] ${item.subject || 'Inbound inquiry'}`;
  const forwardBody = [
    `Hi Mohannad,`,
    ``,
    `Please follow up on the below inbound inquiry. It may be relevant for your territory.`,
    ``,
    `From: ${item.senderName || ''} <${item.senderEmail}>`,
    item.senderCompany ? `Company: ${item.senderCompany}` : null,
    item.country ? `Country: ${item.country}` : null,
    item.productInterest ? `Product Interest: ${item.productInterest}` : null,
    ``,
    `Original Subject: ${item.subject || '(none)'}`,
    ``,
    item.bodySnippet ? `Message Preview:\n${item.bodySnippet}` : null,
  ].filter(Boolean).join('\n');

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: `${FANZEY_NAME} <${FANZEY_EMAIL}>`,
      subject: forwardSubject,
      text: forwardBody,
    });
  } catch (emailErr) {
    // Log but do not fail the request — the status update is the important part
    logger.error('[triage] Failed to send Fanzey forward email:', emailErr.message);
  }

  const now = new Date();
  await item.update({
    status: 'forwarded',
    forwardedToFanzeyAt: now,
  });

  return res.json({
    success: true,
    data: item,
    message: `Forwarded to ${FANZEY_NAME} at ${now.toISOString()}`,
  });
};

// ─── MARK SPAM ───────────────────────────────────────────────────────────────

exports.markSpam = async (req, res) => {
  const item = await db.TriageItem.findByPk(req.params.id);
  if (!item) throw new NotFoundError('Triage item not found');
  await item.update({ status: 'spam' });
  return res.json({ success: true, data: item });
};

// ─── DISMISS ─────────────────────────────────────────────────────────────────

exports.dismissItem = async (req, res) => {
  const item = await db.TriageItem.findByPk(req.params.id);
  if (!item) throw new NotFoundError('Triage item not found');
  await item.update({ status: 'dismissed' });
  return res.json({ success: true, data: item });
};

// ─── MANUAL ARCHIVE ──────────────────────────────────────────────────────────

exports.archiveItem = async (req, res) => {
  const item = await db.TriageItem.findByPk(req.params.id);
  if (!item) throw new NotFoundError('Triage item not found');
  await item.update({ status: 'archived' });
  return res.json({ success: true, data: item });
};

// ─── SYNC NOW (Q4) ───────────────────────────────────────────────────────────
// Sets a flag the Cowork task checks; does not trigger inline processing.

exports.requestSync = async (req, res) => {
  // Singleton sentinel row — identified by gmailMessageId, not id.
  // findOrCreate avoids the SequelizeUniqueConstraintError that upsert(id: newUUID)
  // causes: Sequelize/SQLite sees it as a fresh INSERT and the unique constraint on
  // gmailMessageId fires because the sentinel already exists.
  const SYNC_SENTINEL = '__sync_requested__';
  const now = new Date();

  const [sentinel, created] = await db.TriageItem.findOrCreate({
    where: { gmailMessageId: SYNC_SENTINEL },
    defaults: {
      senderEmail: 'system@internal',
      status: 'dismissed', // never shows in UI
      syncRequestedAt: now,
      autoArchiveAt: new Date(now.getTime() + 86400000),
    },
  });

  if (!created) {
    await sentinel.update({ syncRequestedAt: now });
  }

  return res.json({
    success: true,
    message: 'Sync requested. The Cowork task will pick this up on its next run (within ~1 min if recent activity, or next scheduled interval).',
    requestedAt: now.toISOString(),
  });
};

// Returns current sync-request timestamp so the Cowork task can read + clear it
exports.getSyncStatus = async (req, res) => {
  const SYNC_SENTINEL = '__sync_requested__';
  const sentinel = await db.TriageItem.findOne({
    where: { gmailMessageId: SYNC_SENTINEL },
  });

  return res.json({
    success: true,
    syncRequested: !!sentinel?.syncRequestedAt,
    syncRequestedAt: sentinel?.syncRequestedAt || null,
  });
};

// Called by Cowork task after it processes a sync to clear the flag
exports.clearSyncRequest = async (req, res) => {
  const SYNC_SENTINEL = '__sync_requested__';
  await db.TriageItem.update(
    { syncRequestedAt: null },
    { where: { gmailMessageId: SYNC_SENTINEL } }
  );
  return res.json({ success: true });
};

// ─── BADGE COUNT (for nav bell) ──────────────────────────────────────────────

exports.getPendingCount = async (req, res) => {
  const count = await db.TriageItem.count({
    where: {
      status: 'pending',
      autoArchiveAt: { [Op.gt]: new Date() },
    },
  });
  return res.json({ success: true, count });
};

// ─── AUTO-ARCHIVE JOB (called by cron scheduler) ─────────────────────────────

exports.runAutoArchive = async () => {
  const expired = await db.TriageItem.update(
    { status: 'archived' },
    {
      where: {
        status: 'pending',
        autoArchiveAt: { [Op.lte]: new Date() },
      },
    }
  );
  const [count] = expired;
  if (count > 0) {
    logger.info(`[triage] Auto-archived ${count} expired triage item(s)`);
  }
  return count;
};

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

async function _notifyAdmins(title, message, triageItemId) {
  try {
    const admins = await db.User.findAll({
      where: { role: ['admin', 'super_admin'] },
      attributes: ['id'],
    });

    const notifications = admins.map((admin) => ({
      id: uuidv4(),
      userId: admin.id,
      type: 'triage',
      title,
      message,
      data: { triageItemId },
      link: `/crm/inbox`,
      isRead: false,
    }));

    if (notifications.length > 0) {
      await db.Notification.bulkCreate(notifications);
    }
  } catch (err) {
    // Never let notification failure break the main flow
    logger.error('[triage] Notification error:', err.message);
  }
}
