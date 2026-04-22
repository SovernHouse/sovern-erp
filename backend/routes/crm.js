const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const outreachController = require('../controllers/outreachController');
const emailTemplateController = require('../controllers/emailTemplateController');
const emailSignatureController = require('../controllers/emailSignatureController');
const { requireAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(requireAuth);

// CONTACT ROUTES
router.get('/contacts', crmController.getContacts);
router.post('/contacts', crmController.createContact);
router.get('/contacts/:id', crmController.getContactById);
router.put('/contacts/:id', crmController.updateContact);
router.delete('/contacts/:id', crmController.deleteContact);

// LEAD ROUTES
router.get('/leads', crmController.getLeads);
router.post('/leads', crmController.createLead);
router.get('/leads/:id', crmController.getLeadById);
router.put('/leads/:id', crmController.updateLead);
router.delete('/leads/:id', crmController.deleteLead);
router.put('/leads/:id/status', crmController.updateLeadStatus);
router.post('/leads/:id/convert', crmController.convertLead);
router.get('/leads/stage/:status', crmController.getLeadsByStage);
router.get('/leads/assignee/:userId', crmController.getLeadsByAssignee);
router.get('/leads/:leadId/timeline', crmController.getLeadTimeline);

// ACTIVITY ROUTES
router.get('/activities', crmController.getActivities);
router.post('/activities', crmController.createActivity);
router.get('/activities/:id', crmController.getActivityById);
router.put('/activities/:id', crmController.updateActivity);
router.delete('/activities/:id', crmController.deleteActivity);
router.post('/activities/:id/complete', crmController.completeActivity);
router.post('/activities/:id/reschedule', crmController.rescheduleActivity);
router.get('/activities/upcoming', crmController.getUpcomingActivities);
router.get('/activities/overdue', crmController.getOverdueActivities);

// DEAL ROUTES
router.get('/deals', crmController.getDeals);
router.post('/deals', crmController.createDeal);
router.get('/deals/:id', crmController.getDealById);
router.put('/deals/:id', crmController.updateDeal);
router.delete('/deals/:id', crmController.deleteDeal);
router.put('/deals/:id/stage', crmController.updateDealStage);
router.get('/deals/stage/all', crmController.getDealsByStage);
router.get('/deals/assignee/:userId', crmController.getDealsByAssignee);
router.get('/deals/forecast', crmController.getDealForecast);

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
router.get('/pipeline', crmController.getPipelineView);

// OUTREACH EMAIL ROUTES
router.get('/outreach/followups', outreachController.getFollowups);
router.get('/leads/:id/outreach-emails', outreachController.getLeadOutreachEmails);
router.post('/leads/:id/outreach-emails', outreachController.sendOutreachEmailToLead);
router.patch('/leads/:id/outreach-emails/:emailId', outreachController.updateFollowup);
router.delete('/leads/:id/outreach-emails/:emailId', outreachController.deleteOutreachEmail);
router.delete('/outreach/emails/all', outreachController.deleteAllOutreachEmails);

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

module.exports = router;
