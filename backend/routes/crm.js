const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const outreachController = require('../controllers/outreachController');
const emailTemplateController = require('../controllers/emailTemplateController');
const emailSignatureController = require('../controllers/emailSignatureController');
const { requireAuth } = require('../middleware/auth');
const { brandScope } = require('../middleware/brandScope');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../models');

// Multer config for lead import (temp storage, 5MB max)
const importUpload = multer({
  dest: path.join(__dirname, '../uploads/tmp/'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error('Only CSV and Excel files are accepted'));
  },
});

// Apply authentication middleware to all routes
router.use(requireAuth);
// Attach req.brandScope (Phase 1 Commit 3). Controllers consume
// req.brandScope.where for list filtering and the assert helpers for
// mutation gating.
router.use(brandScope);

// CONTACT ROUTES
router.get('/contacts', crmController.getContacts);
router.post('/contacts', crmController.createContact);
router.get('/contacts/:id', crmController.getContactById);
router.put('/contacts/:id', crmController.updateContact);
router.delete('/contacts/:id', crmController.deleteContact);

// LEAD ROUTES
// Static/prefixed paths MUST come before /:id to prevent shadowing
router.get('/leads', crmController.getLeads);
router.post('/leads', crmController.createLead);
router.get('/leads/stage/:status', crmController.getLeadsByStage);
router.get('/leads/assignee/:userId', crmController.getLeadsByAssignee);
router.get('/leads/:id', crmController.getLeadById);
router.put('/leads/:id', crmController.updateLead);
router.delete('/leads/:id', crmController.deleteLead);
router.put('/leads/:id/status', crmController.updateLeadStatus);
router.post('/leads/:id/convert', crmController.convertLead);
router.get('/leads/:leadId/timeline', crmController.getLeadTimeline);
// Convenience route — post a note/activity directly against a lead (used by Sovern Ops mobile app)
router.post('/leads/:id/activities', async (req, res, next) => {
  req.body.leadId = req.params.id;
  crmController.createActivity(req, res, next);
});

// ACTIVITY ROUTES
// Static paths MUST come before /:id to prevent shadowing
router.get('/activities', crmController.getActivities);
router.get('/activities/upcoming', crmController.getUpcomingActivities);
router.get('/activities/overdue', crmController.getOverdueActivities);
router.post('/activities', crmController.createActivity);
router.get('/activities/:id', crmController.getActivityById);
router.put('/activities/:id', crmController.updateActivity);
router.delete('/activities/:id', crmController.deleteActivity);
router.post('/activities/:id/complete', crmController.completeActivity);
router.post('/activities/:id/reschedule', crmController.rescheduleActivity);

// DEAL ROUTES
// Static/prefixed paths MUST come before /:id to prevent shadowing
router.get('/deals', crmController.getDeals);
router.post('/deals', crmController.createDeal);
router.get('/deals/stage/all', crmController.getDealsByStage);
router.get('/deals/assignee/:userId', crmController.getDealsByAssignee);
router.get('/deals/forecast', crmController.getDealForecast);
router.get('/deals/:id', crmController.getDealById);
router.put('/deals/:id', crmController.updateDeal);
router.delete('/deals/:id', crmController.deleteDeal);
router.put('/deals/:id/stage', crmController.updateDealStage);

// CAMPAIGN ROUTES
router.get('/campaigns', crmController.getCampaigns);
router.post('/campaigns', crmController.createCampaign);
router.get('/campaigns/:id', crmController.getCampaignById);
router.put('/campaigns/:id', crmController.updateCampaign);
router.delete('/campaigns/:id', crmController.deleteCampaign);
router.put('/campaigns/:id/status', crmController.updateCampaignStatus);
router.get('/campaigns/:campaignId/performance', crmController.getCampaignPerformance);

// DASHBOARD & PIPELINE ROUTES
router.get('/dashboard', crmController.getCRMDashboard);
// Phase 4.8 Commit 3b: both URLs hit the same handler. /pipeline kept as
// alias for one release per the audit doc; /lead-pipeline is the
// preferred name for new code referring to the Lead-grouped data.
router.get('/pipeline', crmController.getPipelineView);
router.get('/lead-pipeline', crmController.getPipelineView);

// OUTREACH EMAIL ROUTES
router.get('/outreach/followups', outreachController.getFollowups);
router.get('/leads/:id/outreach-emails', outreachController.getLeadOutreachEmails);
router.post('/leads/:id/outreach-emails', outreachController.sendOutreachEmailToLead);
router.patch('/leads/:id/outreach-emails/:emailId', outreachController.updateFollowup);
router.delete('/leads/:id/outreach-emails/:emailId', outreachController.deleteOutreachEmail);
router.delete('/outreach/emails/all', outreachController.deleteAllOutreachEmails);

// Phase 4.17 — Lead detail Draft Cold Email widget. OutreachEmail is the
// canonical source of truth (Lead.draftEmailSubject/Body are deprecated).
router.get('/leads/:id/outreach-draft', outreachController.getLeadOutreachDraft);
router.put('/leads/:id/outreach-draft', outreachController.saveLeadOutreachDraft);
router.delete('/leads/:id/outreach-draft', outreachController.discardLeadOutreachDraft);

// EMAIL TEMPLATE ROUTES
router.get('/email-templates', emailTemplateController.getEmailTemplates);
router.post('/email-templates', emailTemplateController.createEmailTemplate);
router.put('/email-templates/:id', emailTemplateController.updateEmailTemplate);
router.delete('/email-templates/:id', emailTemplateController.deleteEmailTemplate);

// EMAIL SIGNATURE ROUTES
router.get('/email-signatures', emailSignatureController.getEmailSignatures);
router.post('/email-signatures', emailSignatureController.createEmailSignature);
router.put('/email-signatures/:id', emailSignatureController.updateEmailSignature);
router.delete('/email-signatures/:id', emailSignatureController.deleteEmailSignature);

// BULK CAMPAIGN SEND ROUTES
// POST /campaigns/send must be declared before GET /campaigns/:id to avoid route collision
router.post('/campaigns/send', outreachController.sendCampaign);
router.get('/campaigns/:id/status', outreachController.getCampaignStatus);

// LEADS BULK IMPORT
// POST /api/crm/leads/import  — parse CSV/Excel, return preview (no writes yet)
// POST /api/crm/leads/import/confirm — execute the actual import
// Static routes must be declared ABOVE the /:id handler (already is — leads/import is before leads/:id)

/**
 * Step 1: Upload and preview
 * Returns { headers, sampleRows, totalRows } without writing anything.
 * Client uses this to confirm column mapping before calling /confirm.
 */
router.post('/leads/import', importUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  const fs = require('fs').promises;
  try {
    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    let rows = [];
    let headers = [];

    if (ext === 'csv') {
      const { parse } = require('csv-parse/sync');
      const raw = await fs.readFile(req.file.path, 'utf8');
      const parsed = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
      if (parsed.length > 0) headers = Object.keys(parsed[0]);
      rows = parsed;
    } else {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(req.file.path);
      const ws = wb.worksheets[0];
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) {
          headers = row.values.slice(1).map(String);
        } else {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = row.values[i + 1] ?? ''; });
          rows.push(obj);
        }
      });
    }

    await fs.unlink(req.file.path).catch(() => {});

    res.json({
      success: true,
      data: {
        headers,
        sampleRows: rows.slice(0, 5),
        totalRows: rows.length,
        allRows: rows,  // client holds this and sends it back on confirm
      },
    });
  } catch (err) {
    await fs.unlink(req.file.path).catch(() => {});
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Step 2: Confirm import
 * Body: { rows: [...], columnMapping: { csvHeader: leadField, ... } }
 * columnMapping is optional — auto-detection fallback is used for common headers.
 */
router.post('/leads/import/confirm', async (req, res) => {
  const { rows, columnMapping = {} } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ success: false, message: 'rows is required' });
  }

  const AUTO_MAP = {
    companyname: 'companyName', company: 'companyName',
    contactname: 'contactName', contact: 'contactName', name: 'contactName',
    email: 'email', emailaddress: 'email',
    phone: 'phone', telephone: 'phone', mobile: 'phone',
    country: 'country', region: 'country',
    vertical: 'vertical', industry: 'vertical', sector: 'vertical',
    website: 'website', url: 'website',
    status: 'status', leadstatus: 'status',
    source: 'source',
    notes: 'notes', note: 'notes', comments: 'notes',
    linkedin: 'linkedinUrl', linkedinurl: 'linkedinUrl',
  };

  let created = 0, skipped = 0, errors = [];

  for (const row of rows) {
    const lead = {};

    for (const [header, value] of Object.entries(row)) {
      const target = columnMapping[header] || AUTO_MAP[header.toLowerCase().replace(/[^a-z]/g, '')];
      if (target) lead[target] = value ? String(value).trim() : null;
    }

    if (!lead.companyName || !lead.email) {
      skipped++;
      errors.push({ row: lead.email || lead.companyName || '(unknown)', reason: 'companyName and email are required' });
      continue;
    }

    // Set defaults
    lead.status = lead.status || 'new';
    lead.source = lead.source || 'other';
    lead.contactName = lead.contactName || lead.companyName;

    try {
      // Upsert by email — avoid duplicates
      const existing = await db.Lead.findOne({ where: { email: lead.email } });
      if (existing) {
        skipped++;
        errors.push({ row: lead.email, reason: 'duplicate email — skipped' });
      } else {
        await db.Lead.create({ id: uuidv4(), ...lead });
        created++;
      }
    } catch (err) {
      skipped++;
      errors.push({ row: lead.email || lead.companyName, reason: err.message });
    }
  }

  res.json({
    success: true,
    data: { created, skipped, errors: errors.slice(0, 50) },
    message: `Import complete: ${created} leads created, ${skipped} skipped`,
  });
});

module.exports = router;
