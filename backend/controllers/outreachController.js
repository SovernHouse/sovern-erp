const { Op } = require('sequelize');
const db = require('../models');
const { sendOutreachEmail } = require('../services/emailService');
const dayjs = require('dayjs');
const tenant = require('../config/tenant');
const logger = require('../utils/logger.js');

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
    const { fromAddress, toAddress, toName, subject, bodyText, touchNumber = 1, followUpDays, cc, bcc, signatureId } = req.body;

    // Validate required fields
    if (!fromAddress || !toAddress || !subject || !bodyText) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: fromAddress, toAddress, subject, bodyText',
      });
    }

    const lead = await db.Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Resolve signature HTML/text if a signatureId was provided
    let resolvedSignatureHtml = null;
    let resolvedSignatureText = null;
    if (signatureId) {
      const { generateSignatureHtml, generateSignatureText } = require('./emailSignatureController');
      const sig = await db.EmailSignature.findByPk(signatureId);
      if (sig) {
        resolvedSignatureHtml = generateSignatureHtml(sig);
        resolvedSignatureText = generateSignatureText(sig);
      }
    }

    // Build final BCC — Egypt rule: always include Mohannad Fanzey
    let finalBcc = bcc ? (Array.isArray(bcc) ? [...bcc] : [bcc]) : [];
    if (
      lead.country &&
      lead.country.toLowerCase() === 'egypt' &&
      !finalBcc.map(e => e.toLowerCase()).includes('mohanadfanzey@gmail.com')
    ) {
      finalBcc.push('mohanadfanzey@gmail.com');
    }

    // Send email via SMTP
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

    // Create OutreachEmail record
    const outreachEmail = await db.OutreachEmail.create({
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
    });

    // Update Lead status to 'contacted' if currently 'new'
    if (lead.status === 'new') {
      await lead.update({ status: 'contacted' });
    }

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

    const followups = await db.OutreachEmail.findAll({
      where: {
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

    // Validate FROM address is an authorised sending domain
    const allowedDomains = tenant.allowedSendingDomains;
    const fromDomain = (fromAddress || '').split('@')[1];
    if (!allowedDomains.includes(fromDomain)) {
      return res.status(400).json({
        success: false,
        message: `fromAddress must use one of: ${allowedDomains.join(', ')}`,
      });
    }

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

      // Resolve signature once for the entire campaign
      let campaignSignatureHtml = null;
      let campaignSignatureText = null;
      if (signatureId) {
        const { generateSignatureHtml, generateSignatureText } = require('./emailSignatureController');
        const sig = await db.EmailSignature.findByPk(signatureId);
        if (sig) {
          campaignSignatureHtml = generateSignatureHtml(sig);
          campaignSignatureText = generateSignatureText(sig);
        }
      }

      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];

        // Stagger: skip delay before first send, then 2–8 second random jitter
        if (i > 0) {
          const jitter = 2000 + Math.floor(Math.random() * 6000);
          await new Promise(r => setTimeout(r, jitter));
        }

        const mergedSubject = mergeTemplate(subjectTemplate, lead);
        const mergedBody = mergeTemplate(bodyTemplate, lead);
        const now = dayjs();
        const followUpDueAt = daysToAdd ? now.add(daysToAdd, 'day').toDate() : null;

        // Build final BCC — Egypt rule: always include Mohannad Fanzey
        let finalCampaignBcc = bcc ? (Array.isArray(bcc) ? [...bcc] : [bcc]) : [];
        if (
          lead.country &&
          lead.country.toLowerCase() === 'egypt' &&
          !finalCampaignBcc.map(e => e.toLowerCase()).includes('mohanadfanzey@gmail.com')
        ) {
          finalCampaignBcc.push('mohanadfanzey@gmail.com');
        }

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
};
