const { Op } = require('sequelize');
const db = require('../models');
const { sendOutreachEmail, applyEgyptBccIfNeeded } = require('../services/emailService');
const dayjs = require('dayjs');
const logger = require('../utils/logger.js');
const auditService = require('../services/auditService');
const { postSystemEvent } = require('./chatterController');

/**
 * Phase 4.17 — brand-safety guard for outreach send/render paths.
 * Per non-negotiable rule #9, refuse rather than fall back when the
 * brand context can't be resolved. Throws { httpStatus, message,
 * brandLeak } so callers can return the right status code without
 * needing to know the internal failure mode.
 */
async function resolveBrandForOutreachOrThrow(lead) {
  if (!lead) {
    const err = new Error('Lead unavailable for brand resolution');
    err.httpStatus = 400;
    err.brandLeak = true;
    throw err;
  }
  if (!lead.brandCode) {
    const err = new Error(`Lead ${lead.id} has no brandCode set. Refusing to send outreach without an explicit brand declaration.`);
    err.httpStatus = 422;
    err.brandLeak = true;
    throw err;
  }
  const brand = await db.Brand.findOne({ where: { code: lead.brandCode, active: true } });
  if (!brand) {
    const err = new Error(`Brand '${lead.brandCode}' not found or inactive. Refusing to send outreach without a valid brand row.`);
    err.httpStatus = 422;
    err.brandLeak = true;
    throw err;
  }
  return brand;
}

/**
 * Default follow-up schedule by touch number (in days)
 */
const FOLLOWUP_SCHEDULE = {
  1: 4,
  2: 10,
  3: 18,
  4: 25,
  5: null, // no follow-up after 5th touch
};

/**
 * GET /api/crm/leads/:id/outreach-emails
 * List all outreach emails for a lead (include sentBy user)
 */
const getLeadOutreachEmails = async (req, res) => {
  try {
    const { id } = req.params;

    const lead = await db.Lead.findByPk(id, {
      include: [
        {
          model: db.OutreachEmail,
          as: 'outreachEmails',
          include: [
            {
              model: db.User,
              as: 'sentBy',
              attributes: ['id', 'firstName', 'lastName', 'email'],
            }
          ],
          order: [['createdAt', 'DESC']],
        }
      ],
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    res.json({
      success: true,
      data: {
        lead: {
          id: lead.id,
          companyName: lead.companyName,
          contactName: lead.contactName,
          email: lead.email,
        },
        outreachEmails: lead.outreachEmails || [],
      },
    });
  } catch (error) {
    logger.error('Error fetching outreach emails:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/crm/leads/:id/outreach-emails
 * Compose and send email to lead
 * Body: { fromAddress, toAddress, toName, subject, bodyText, touchNumber, followUpDays }
 */
const sendOutreachEmailToLead = async (req, res) => {
  try {
    const { id } = req.params;
    let { fromAddress, toAddress, toName, subject, bodyText, touchNumber = 1, followUpDays, cc, bcc, signatureId } = req.body;

    // Validate required fields (fromAddress may be omitted — derived from brand below)
    if (!toAddress || !subject || !bodyText) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: toAddress, subject, bodyText',
      });
    }

    const lead = await db.Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Phase 4.17 (non-negotiable rule #9): refuse to send without an
    // explicit, valid brand context. Catches the class of bug where
    // brandCode is unset or the Brand row is missing/inactive — those
    // used to fall back to alex@sovernhouse.co + SH signature, which
    // is the exact PriceList brand-leak pattern from 2026-05-17.
    let resolvedBrand;
    try {
      resolvedBrand = await resolveBrandForOutreachOrThrow(lead);
    } catch (brandErr) {
      if (brandErr.brandLeak) {
        auditService.logAction(
          req.user?.id || null,
          'brand_leak_refused',
          'OutreachEmail',
          lead.id,
          { context: 'outreach_send', brandCode: lead.brandCode || null, message: brandErr.message },
          req.ip,
        ).catch(() => {});
        return res.status(brandErr.httpStatus).json({ success: false, message: brandErr.message, brandLeak: true });
      }
      throw brandErr;
    }

    // Phase 4, C18: refuse to send outreach to a flagged lead unless
    // super-admin overrode the screening. Optionally re-screen if the
    // last screen is older than 7 days so a stale cleared lead can flip
    // to flagged before we email a sanctioned entity. 'override' bypasses.
    if (lead.screeningStatus !== 'override') {
      const sanctionsService = require('../services/sanctionsService');
      const auditService = require('../services/auditService');
      const stale = !lead.lastScreenedAt || (Date.now() - new Date(lead.lastScreenedAt).getTime()) > 7 * 24 * 3600 * 1000;
      if (stale) {
        const re = sanctionsService.screenName(lead.companyName, lead.country);
        await lead.update({
          screeningStatus: re.status,
          sanctionsScreenDetails: re.hits,
          lastScreenedAt: new Date(),
        });
      }
      if (lead.screeningStatus === 'flagged') {
        auditService.logAction(
          req.user?.id,
          'sanctions_block',
          'Lead',
          lead.id,
          {
            context: 'outreach_send',
            companyName: lead.companyName,
            hits: lead.sanctionsScreenDetails,
          },
          req.ip,
        ).catch(() => {});
        return res.status(403).json({
          success: false,
          message: `Lead "${lead.companyName}" is on a sanctions list. Outreach blocked. Super-admin override required.`,
          sanctionsBlock: { status: lead.screeningStatus, leadId: lead.id, hits: lead.sanctionsScreenDetails },
        });
      }
    }

    // Brand is the strict-resolved row from rule #9 above. No fallback path.
    const brand = resolvedBrand;

    // Default fromAddress to the brand's sender email when not explicitly provided.
    if (!fromAddress) {
      fromAddress = brand.senderEmail;
    }

    // Build the From display name: "<Brand displayName> | Alex"
    const fromDisplayName = brand ? `${brand.displayName} | Alex` : 'Sovern House | Alex';

    // Resolve signature HTML/text: explicit signatureId wins; otherwise fall
    // back to the brand's default signature (injected into buildOutreachContent).
    let resolvedSignatureHtml = null;
    let resolvedSignatureText = null;
    if (signatureId) {
      const { generateSignatureHtml, generateSignatureText } = require('./emailSignatureController');
      const sig = await db.EmailSignature.findByPk(signatureId);
      if (sig) {
        resolvedSignatureHtml = generateSignatureHtml(sig);
        resolvedSignatureText = generateSignatureText(sig);
      }
    } else if (brand?.signatureHtml) {
      resolvedSignatureHtml = brand.signatureHtml;
      resolvedSignatureText = brand.signatureText || null;
    }

    // Phase 4, C17: Egypt BCC rule via single source of truth in emailService.
    const finalBcc = applyEgyptBccIfNeeded(lead.brandCode, lead.country, bcc);

    // Send email via Gmail API (preferred) or SMTP fallback
    let messageId;
    let accepted;
    let rejected;
    try {
      const result = await sendOutreachEmail({
        fromAddress,
        toAddress,
        toName,
        subject,
        bodyText,
        replyTo: fromAddress,
        cc: cc || null,
        bcc: finalBcc.length > 0 ? finalBcc : null,
        signatureHtml: resolvedSignatureHtml,
        signatureText: resolvedSignatureText,
        fromDisplayName,
      });
      messageId = result.messageId;
      accepted = result.accepted;
      rejected = result.rejected;
    } catch (emailError) {
      // Email failed but we still record the attempt
      return res.status(500).json({
        success: false,
        message: emailError.message,
      });
    }

    // Compute follow-up due date
    const now = dayjs();
    const daysToAdd = followUpDays || FOLLOWUP_SCHEDULE[touchNumber] || null;
    const followUpDueAt = daysToAdd ? now.add(daysToAdd, 'day').toDate() : null;

    // Phase 4.17: flip the existing draft for this lead instead of creating
    // a parallel sent row. Preserves the draft row id so the audit trail
    // and any external references survive the transition. Falls back to
    // create() when no draft exists (e.g. direct send from a touch>1
    // follow-up that was authored via the legacy path).
    const existingDraft = await db.OutreachEmail.findOne({
      where: { leadId: id, status: 'draft' },
      order: [['createdAt', 'DESC']],
    });

    let outreachEmail;
    if (existingDraft) {
      await existingDraft.update({
        sentByUserId: req.user?.id || null,
        fromAddress,
        toAddress,
        toName: toName || null,
        subject,
        bodyText,
        touchNumber,
        status: 'sent',
        smtpMessageId: messageId,
        sentAt: now.toDate(),
        followUpDueAt,
        followUpCompleted: false,
        brandCode: lead.brandCode || existingDraft.brandCode,
      });
      outreachEmail = existingDraft;
    } else {
      outreachEmail = await db.OutreachEmail.create({
        leadId: id,
        sentByUserId: req.user?.id || null,
        fromAddress,
        toAddress,
        toName: toName || null,
        subject,
        bodyText,
        touchNumber,
        status: 'sent',
        smtpMessageId: messageId,
        sentAt: now.toDate(),
        followUpDueAt,
        followUpCompleted: false,
        brandCode: lead.brandCode || 'SH',
      });
    }

    // Update Lead status to 'contacted' if currently 'new'
    if (lead.status === 'new') {
      await lead.update({ status: 'contacted' });
    }

    // Phase 4.17 bugfix: log the send to the Lead's chatter so the trail
    // is visible on the detail page. Best-effort — failure must not abort
    // the send response. Mirrors the priceListRoutes chatter pattern.
    await postSystemEvent(
      'Lead',
      lead.id,
      'event',
      `Outreach email sent to ${toAddress} from ${fromAddress} (${resolvedBrand.displayName}). Subject: "${(subject || '').slice(0, 120)}". Touch ${touchNumber}.`,
      {
        outreachEmailId: outreachEmail.id,
        fromAddress,
        toAddress,
        touchNumber,
        smtpMessageId: messageId || null,
        brandCode: lead.brandCode,
      },
      req.user?.id || null,
      req.user
        ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'System'
        : 'System',
    ).catch(() => {});

    res.status(201).json({
      success: true,
      data: outreachEmail,
    });
  } catch (error) {
    logger.error('Error sending outreach email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/crm/leads/:id/outreach-emails/:emailId
 * Update follow-up (mark completed, add note)
 * Body: { followUpCompleted, followUpNote, followUpDueAt }
 */
const updateFollowup = async (req, res) => {
  try {
    const { id, emailId } = req.params;
    const { followUpCompleted, followUpNote, followUpDueAt } = req.body;

    const outreachEmail = await db.OutreachEmail.findByPk(emailId);
    if (!outreachEmail) {
      return res.status(404).json({ success: false, message: 'Outreach email not found' });
    }

    if (outreachEmail.leadId !== id) {
      return res.status(400).json({ success: false, message: 'Outreach email does not belong to this lead' });
    }

    // Partial update
    const updates = {};
    if (followUpCompleted !== undefined) updates.followUpCompleted = followUpCompleted;
    if (followUpNote !== undefined) updates.followUpNote = followUpNote;
    if (followUpDueAt !== undefined) updates.followUpDueAt = followUpDueAt;

    await outreachEmail.update(updates);

    res.json({
      success: true,
      data: outreachEmail,
    });
  } catch (error) {
    logger.error('Error updating follow-up:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/crm/outreach/followups
 * Upcoming unfollowed emails (followUpDueAt <= 7 days from now, not completed)
 * Include lead info (companyName, contactName, vertical)
 */
const getFollowups = async (req, res) => {
  try {
    const now = dayjs();
    const sevenDaysFromNow = now.add(7, 'day').toDate();

    // Phase 1 Commit 3b-B: brand-scope filter from middleware.
    const followups = await db.OutreachEmail.findAll({
      where: {
        ...(req.brandScope?.where || {}),
        followUpCompleted: false,
        followUpDueAt: {
          [Op.lte]: sevenDaysFromNow,
          [Op.gt]: null,
        },
      },
      include: [
        {
          model: db.Lead,
          as: 'lead',
          attributes: ['id', 'companyName', 'contactName', 'vertical', 'email', 'country'],
        },
        {
          model: db.User,
          as: 'sentBy',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        }
      ],
      order: [['followUpDueAt', 'ASC']],
    });

    res.json({
      success: true,
      data: followups,
      count: followups.length,
    });
  } catch (error) {
    logger.error('Error fetching followups:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/crm/leads/:id/outreach-emails/:emailId
 */
const deleteOutreachEmail = async (req, res) => {
  try {
    const { emailId } = req.params;
    const email = await db.OutreachEmail.findByPk(emailId);
    if (!email) return res.status(404).json({ success: false, message: 'Not found' });
    await email.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/crm/outreach/emails/all — wipe all outreach email records (admin cleanup)
 */
const deleteAllOutreachEmails = async (req, res) => {
  try {
    const count = await db.OutreachEmail.destroy({ where: {}, truncate: false });
    res.json({ success: true, deleted: count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Phase 4.17 — single source of truth for the Lead detail Draft Cold
 * Email widget. Three endpoints:
 *
 *   GET    /api/crm/leads/:id/outreach-draft  — read state
 *   PUT    /api/crm/leads/:id/outreach-draft  — upsert draft
 *   DELETE /api/crm/leads/:id/outreach-draft  — discard draft
 *
 * GET returns { latest, draft, sent } where:
 *   - latest = most recent OutreachEmail for the lead, regardless of status
 *   - draft  = most recent OutreachEmail with status='draft' (or null)
 *   - sent   = most recent OutreachEmail with status='sent'  (or null)
 *
 * The widget uses `latest.status` to pick mode (draft / sent / empty).
 */
const getLeadOutreachDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await db.Lead.findByPk(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const include = [{
      model: db.User,
      as: 'sentBy',
      attributes: ['id', 'firstName', 'lastName', 'email'],
    }];

    const [draft, sent, latest] = await Promise.all([
      db.OutreachEmail.findOne({ where: { leadId: id, status: 'draft' }, include, order: [['createdAt', 'DESC']] }),
      db.OutreachEmail.findOne({ where: { leadId: id, status: 'sent' }, include, order: [['sentAt', 'DESC'], ['createdAt', 'DESC']] }),
      db.OutreachEmail.findOne({ where: { leadId: id }, include, order: [['createdAt', 'DESC']] }),
    ]);

    res.json({ success: true, data: { draft, sent, latest } });
  } catch (error) {
    logger.error('Error fetching outreach draft:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/crm/leads/:id/outreach-draft
 * Body: { subject, bodyText, touchNumber? }
 *
 * Upserts the lead's draft. If a draft already exists, update subject +
 * bodyText (and brandCode + fromAddress if they have drifted). Otherwise
 * create a new draft row. Audit `lead_outreach_draft_saved` per write.
 *
 * Refuses (422) when the brand context is unresolved per rule #9. We
 * still allow whitespace-only payloads through validation so AI tools
 * can stage partial drafts; the widget enforces non-whitespace on its
 * Save/Send buttons.
 */
const saveLeadOutreachDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { subject, bodyText, touchNumber } = req.body || {};

    if (typeof subject !== 'string' || typeof bodyText !== 'string') {
      return res.status(400).json({ success: false, message: 'subject and bodyText are required strings' });
    }
    if (!subject.trim() && !bodyText.trim()) {
      return res.status(400).json({ success: false, message: 'subject and bodyText cannot both be blank' });
    }

    const lead = await db.Lead.findByPk(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    let brand;
    try {
      brand = await resolveBrandForOutreachOrThrow(lead);
    } catch (brandErr) {
      if (brandErr.brandLeak) {
        return res.status(brandErr.httpStatus).json({ success: false, message: brandErr.message, brandLeak: true });
      }
      throw brandErr;
    }

    const existing = await db.OutreachEmail.findOne({
      where: { leadId: id, status: 'draft' },
      order: [['createdAt', 'DESC']],
    });

    // Phase 4.18f: server-side voice rule linter. Title-case country
    // names, replace em-dashes, rewrite "powered by IronLite" phrasing.
    // Runs BEFORE the draft placeholders so the lint operates on the
    // user-provided text, not the placeholder strings.
    const { lintEmailParts } = require('../services/voiceRuleLinter');
    const linted = lintEmailParts({ subject: subject.trim(), bodyText: bodyText.trim() });
    const subjectToSave = linted.subject || '(draft subject - add before sending)';
    const bodyToSave = linted.bodyText || '(draft body - add content before sending)';
    const fromAddress = brand.senderEmail;
    let row;
    let created = false;

    if (existing) {
      await existing.update({
        subject: subjectToSave,
        bodyText: bodyToSave,
        fromAddress,
        toAddress: lead.email,
        toName: lead.contactName || null,
        brandCode: lead.brandCode,
        touchNumber: touchNumber || existing.touchNumber || 1,
      });
      row = existing;
    } else {
      row = await db.OutreachEmail.create({
        leadId: id,
        sentByUserId: req.user?.id || null,
        fromAddress,
        toAddress: lead.email,
        toName: lead.contactName || null,
        subject: subjectToSave,
        bodyText: bodyToSave,
        touchNumber: touchNumber || 1,
        status: 'draft',
        smtpMessageId: null,
        sentAt: null,
        followUpDueAt: null,
        followUpCompleted: false,
        brandCode: lead.brandCode,
      });
      created = true;
    }

    auditService.logAction(
      req.user?.id || null,
      'lead_outreach_draft_saved',
      'OutreachEmail',
      row.id,
      {
        leadId: id,
        created,
        brandCode: lead.brandCode,
        subjectPreview: subjectToSave.slice(0, 120),
        voiceLintCorrections: linted.corrections,
      },
      req.ip,
    ).catch(() => {});

    // Phase 4.18f: post a chatter note when the linter actually
    // changed text — operators can see what the server normalised.
    if (linted.corrections.length > 0) {
      const summary = linted.corrections
        .map(c => `${c.rule} (${c.count} on ${c.field})`)
        .join(', ');
      await postSystemEvent(
        'Lead',
        id,
        'event',
        `Voice lint applied: ${summary}.`,
        { outreachEmailId: row.id, corrections: linted.corrections },
        req.user?.id || null,
        req.user
      ).catch(() => {});
    }

    // Phase 4.17 bugfix: chatter event so the operator can see who edited
    // the draft and when. `created` differentiates "new draft" vs "edited
    // existing draft" in the message.
    await postSystemEvent(
      'Lead',
      id,
      'event',
      created
        ? `Drafted outreach email. Subject: "${subjectToSave.slice(0, 120)}".`
        : `Edited outreach draft. Subject: "${subjectToSave.slice(0, 120)}".`,
      {
        outreachEmailId: row.id,
        brandCode: lead.brandCode,
        created,
      },
      req.user?.id || null,
      req.user
        ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'System'
        : 'System',
    ).catch(() => {});

    res.status(created ? 201 : 200).json({ success: true, data: row });
  } catch (error) {
    logger.error('Error saving outreach draft:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/crm/leads/:id/outreach-draft
 * Discards the lead's active draft (status='draft' rows are hard-deleted).
 * Sent rows are NOT affected. Audit `user_discard_outreach_draft`.
 */
const discardLeadOutreachDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const lead = await db.Lead.findByPk(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const draft = await db.OutreachEmail.findOne({
      where: { leadId: id, status: 'draft' },
      order: [['createdAt', 'DESC']],
    });
    if (!draft) {
      return res.status(404).json({ success: false, message: 'No draft to discard' });
    }

    const snapshot = {
      id: draft.id,
      leadId: id,
      brandCode: draft.brandCode,
      subjectPreview: (draft.subject || '').slice(0, 120),
    };
    await draft.destroy();

    auditService.logAction(
      req.user?.id || null,
      'user_discard_outreach_draft',
      'OutreachEmail',
      snapshot.id,
      snapshot,
      req.ip,
    ).catch(() => {});

    // Phase 4.17 bugfix: chatter event so the discard is visible on the
    // Lead detail timeline (counter-balances the save event).
    await postSystemEvent(
      'Lead',
      id,
      'event',
      `Discarded outreach draft. Subject was: "${snapshot.subjectPreview}".`,
      {
        outreachEmailId: snapshot.id,
        brandCode: snapshot.brandCode,
      },
      req.user?.id || null,
      req.user
        ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'System'
        : 'System',
    ).catch(() => {});

    res.json({ success: true, data: snapshot });
  } catch (error) {
    logger.error('Error discarding outreach draft:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Resolve merge fields in a template string against a lead record.
 * Supported tokens: {{firstName}}, {{contactName}}, {{companyName}}, {{country}}, {{vertical}}
 */
const mergeTemplate = (template, lead) => {
  const firstName = (lead.contactName || '').split(' ')[0] || lead.contactName || '';
  return (template || '')
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{contactName\}\}/g, lead.contactName || '')
    .replace(/\{\{companyName\}\}/g, lead.companyName || '')
    .replace(/\{\{country\}\}/g, lead.country || '')
    .replace(/\{\{vertical\}\}/g, lead.vertical || '');
};

/**
 * POST /api/crm/campaigns/send
 * Create a named email campaign and immediately start staggered bulk send.
 * Body: { name, leadIds, fromAddress, subjectTemplate, bodyTemplate, touchNumber, followUpDays }
 * Returns 202 immediately; actual sends happen async in background.
 */
const sendCampaign = async (req, res) => {
  try {
    const {
      name,
      leadIds,
      fromAddress,
      subjectTemplate,
      bodyTemplate,
      touchNumber = 1,
      followUpDays,
      cc,
      bcc,
      signatureId,
    } = req.body;

    if (!leadIds?.length || !fromAddress || !subjectTemplate || !bodyTemplate) {
      return res.status(400).json({
        success: false,
        message: 'leadIds, fromAddress, subjectTemplate, and bodyTemplate are required',
      });
    }

    // Validate FROM address is one of the configured brand sender emails.
    // This replaces the old static domain list check and naturally includes
    // gmail.com senders (e.g. alexflorway@gmail.com for FW brand).
    const activeBrands = await db.Brand.findAll({ where: { active: true }, attributes: ['code', 'senderEmail', 'displayName', 'signatureHtml', 'signatureText'] });
    const brandSenderEmails = activeBrands.map(b => b.senderEmail.toLowerCase());
    if (!brandSenderEmails.includes((fromAddress || '').toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `fromAddress must be one of the configured brand sender emails: ${brandSenderEmails.join(', ')}`,
      });
    }

    // Resolve the brand for this campaign's fromAddress (for From header + signature).
    const campaignBrand = activeBrands.find(b => b.senderEmail.toLowerCase() === fromAddress.toLowerCase()) || null;
    const campaignFromDisplayName = campaignBrand ? `${campaignBrand.displayName} | Alex` : 'Sovern House | Alex';

    // Fetch leads (only those that actually exist)
    const leads = await db.Lead.findAll({ where: { id: leadIds } });
    if (leads.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid leads found for the given IDs' });
    }

    // Create campaign record
    const campaign = await db.Campaign.create({
      name: name || `Outreach ${dayjs().format('YYYY-MM-DD')}`,
      type: 'email',
      status: 'active',
      subjectTemplate,
      bodyTemplate,
      fromAddress,
      sendStatus: 'sending',
      totalRecipients: leads.length,
      sentCount: 0,
      failedCount: 0,
      startDate: new Date(),
    });

    const campaignId = campaign.id;
    const sentByUserId = req.user?.id || null;
    const daysToAdd = (followUpDays !== undefined && followUpDays !== null)
      ? followUpDays
      : (FOLLOWUP_SCHEDULE[touchNumber] ?? null);

    // Respond immediately — client will poll /campaigns/:id/status
    res.status(202).json({
      success: true,
      campaignId,
      totalRecipients: leads.length,
      message: `Sending started. Poll /api/crm/campaigns/${campaignId}/status for progress.`,
    });

    // ─── Background send loop ─────────────────────────────────────────────────
    (async () => {
      let sentCount = 0;
      let failedCount = 0;

      // Resolve signature once for the entire campaign.
      // Priority: explicit signatureId > brand's default signatureHtml.
      let campaignSignatureHtml = null;
      let campaignSignatureText = null;
      if (signatureId) {
        const { generateSignatureHtml, generateSignatureText } = require('./emailSignatureController');
        const sig = await db.EmailSignature.findByPk(signatureId);
        if (sig) {
          campaignSignatureHtml = generateSignatureHtml(sig);
          campaignSignatureText = generateSignatureText(sig);
        }
      } else if (campaignBrand?.signatureHtml) {
        campaignSignatureHtml = campaignBrand.signatureHtml;
        campaignSignatureText = campaignBrand.signatureText || null;
      }

      const sanctionsService = require('../services/sanctionsService');
      const auditService = require('../services/auditService');

      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];

        // Stagger: skip delay before first send, then 2–8 second random jitter
        if (i > 0) {
          const jitter = 2000 + Math.floor(Math.random() * 6000);
          await new Promise(r => setTimeout(r, jitter));
        }

        // Phase 4, C18: per-recipient sanctions check inside the campaign
        // loop. Stale leads (> 7d since last screen) are re-screened on the
        // fly so a list that just refreshed catches a previously-cleared
        // entity. 'override' bypasses. Flagged leads count as failed
        // sends; the rest of the campaign continues.
        if (lead.screeningStatus !== 'override') {
          const stale = !lead.lastScreenedAt || (Date.now() - new Date(lead.lastScreenedAt).getTime()) > 7 * 24 * 3600 * 1000;
          if (stale) {
            try {
              const re = sanctionsService.screenName(lead.companyName, lead.country);
              await lead.update({
                screeningStatus: re.status,
                sanctionsScreenDetails: re.hits,
                lastScreenedAt: new Date(),
              });
            } catch (e) {}
          }
          if (lead.screeningStatus === 'flagged') {
            auditService.logAction(
              sentByUserId,
              'sanctions_block',
              'Lead',
              lead.id,
              {
                context: 'campaign_send',
                campaignId,
                companyName: lead.companyName,
                hits: lead.sanctionsScreenDetails,
              },
              null,
            ).catch(() => {});
            failedCount++;
            await db.OutreachEmail.create({
              campaignId,
              leadId: lead.id,
              brandCode: lead.brandCode || null,
              touchNumber,
              subject: mergeTemplate(subjectTemplate, lead),
              bodyText: '(blocked by sanctions screen)',
              fromAddress: campaignBrand?.senderEmail || 'alex@sovernhouse.co',
              toAddress: lead.email,
              status: 'failed',
              errorMessage: `sanctions_block: matched ${
                (lead.sanctionsScreenDetails || []).map((h) => h.list).join(', ') || 'flagged'
              }`,
              sentByUserId,
            }).catch(() => {});
            continue;
          }
        }

        const mergedSubject = mergeTemplate(subjectTemplate, lead);
        const mergedBody = mergeTemplate(bodyTemplate, lead);
        const now = dayjs();
        const followUpDueAt = daysToAdd ? now.add(daysToAdd, 'day').toDate() : null;

        // Phase 4, C17: Egypt BCC rule via single source of truth in emailService.
        const finalCampaignBcc = applyEgyptBccIfNeeded(lead.brandCode, lead.country, bcc);

        let messageId = null;
        let status = 'failed';
        let errorMessage = null;

        try {
          const result = await sendOutreachEmail({
            fromAddress,
            toAddress: lead.email,
            toName: lead.contactName,
            subject: mergedSubject,
            bodyText: mergedBody,
            replyTo: fromAddress,
            cc: cc || null,
            bcc: finalCampaignBcc.length > 0 ? finalCampaignBcc : null,
            signatureHtml: campaignSignatureHtml,
            signatureText: campaignSignatureText,
            fromDisplayName: campaignFromDisplayName,
          });
          messageId = result.messageId;
          status = 'sent';
          sentCount++;

          // Advance lead status from 'new' → 'contacted'
          if (lead.status === 'new') {
            await lead.update({ status: 'contacted' });
          }
        } catch (err) {
          errorMessage = err.message;
          failedCount++;
          logger.error(`[CAMPAIGN ${campaignId}] Failed → ${lead.email}:`, err.message);
        }

        // Record individual OutreachEmail (appears in each lead's email history)
        await db.OutreachEmail.create({
          leadId: lead.id,
          campaignId,
          sentByUserId,
          fromAddress,
          toAddress: lead.email,
          toName: lead.contactName || null,
          subject: mergedSubject,
          bodyText: mergedBody,
          touchNumber,
          status,
          smtpMessageId: messageId,
          sentAt: status === 'sent' ? now.toDate() : null,
          followUpDueAt: status === 'sent' ? followUpDueAt : null,
          followUpCompleted: false,
          errorMessage,
        });

        // Live progress update on campaign record
        await campaign.update({
          sentCount,
          failedCount,
          lastSentAt: now.toDate(),
        });
      }

      // Mark campaign finished
      const finalStatus = failedCount === leads.length ? 'failed' : 'completed';
      await campaign.update({ sendStatus: finalStatus, status: 'completed' });
      logger.info(`[CAMPAIGN ${campaignId}] Complete — sent: ${sentCount}, failed: ${failedCount}`);
    })().catch(err => {
      logger.error(`[CAMPAIGN ${campaignId}] Fatal background error:`, err.message);
      campaign.update({ sendStatus: 'failed' }).catch(() => {});
    });

  } catch (error) {
    logger.error('Error starting campaign send:', error);
    // Response may already be sent if error occurred after res.status(202)
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

/**
 * GET /api/crm/campaigns/:id/status
 * Poll bulk campaign send progress.
 * Returns campaign metadata + per-prospect OutreachEmail records.
 */
const getCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await db.Campaign.findByPk(id, {
      include: [
        {
          model: db.OutreachEmail,
          as: 'outreachEmails',
          include: [
            {
              model: db.Lead,
              as: 'lead',
              attributes: ['id', 'companyName', 'contactName', 'email'],
            },
          ],
          order: [['createdAt', 'ASC']],
        },
      ],
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    res.json({
      success: true,
      data: {
        id: campaign.id,
        name: campaign.name,
        sendStatus: campaign.sendStatus,
        totalRecipients: campaign.totalRecipients,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        lastSentAt: campaign.lastSentAt,
        fromAddress: campaign.fromAddress,
        emails: campaign.outreachEmails || [],
      },
    });
  } catch (error) {
    logger.error('Error fetching campaign status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getLeadOutreachEmails,
  sendOutreachEmailToLead,
  updateFollowup,
  getFollowups,
  deleteOutreachEmail,
  deleteAllOutreachEmails,
  sendCampaign,
  getCampaignStatus,
  // Phase 4.17 draft endpoints.
  getLeadOutreachDraft,
  saveLeadOutreachDraft,
  discardLeadOutreachDraft,
  // Exported for unit tests + the lead controller include helper.
  resolveBrandForOutreachOrThrow,
};
