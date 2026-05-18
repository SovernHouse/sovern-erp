const { Op } = require('sequelize');
const db = require('../models');
const sequelize = db.sequelize;
const { v4: uuidv4 } = require('uuid');
const { assertSingleBrandMode, assertBrandWritable } = require('../middleware/brandScope');
const leadWriteService = require('../services/aiWriteServices/leadWriteService');
// Helper function to calculate lead score
const calculateLeadScore = (lead) => {
  let score = 0;

  if (lead.estimatedValue) {
    const value = parseFloat(lead.estimatedValue);
    if (value >= 50000) score += 40;
    else if (value >= 20000) score += 30;
    else if (value >= 5000) score += 20;
    else score += 10;
  }

  if (lead.probability) {
    score += Math.floor(lead.probability / 2.5);
  }

  const statusScores = {
    'new': 10,
    'contacted': 20,
    'qualified': 40,
    'proposal': 60,
    'negotiation': 80,
  };
  score += statusScores[lead.status] || 0;

  return Math.min(score, 100);
};


// LEAD CONTROLLERS
exports.getLeads = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, source, assignedToId, leadType } = req.query;
    const offset = (page - 1) * limit;

    // Phase 1 Commit 3: brand-scope filter. Single-brand callers see only
    // their accessibleBrands; super_admin with viewMode=cross-brand sees all.
    // brandScope middleware (mounted on /api/crm) attaches req.brandScope.
    const where = { ...(req.brandScope?.where || {}) };
    if (search) {
      where[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { contactName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    if (status) where.status = status;
    if (source) where.source = source;
    if (assignedToId) where.assignedToId = assignedToId;
    if (leadType) {
      where.leadType = leadType;
    } else {
      // Default: exclude supplier_contact-flagged rows from generic
      // /leads listings. The Leads page is for client prospects only;
      // factory/supplier people belong on Supplier Contacts.
      // Callers that explicitly want them must pass leadType='supplier_contact'.
      where.leadType = { [Op.ne]: 'supplier_contact' };
    }

    // PERF: split findAndCountAll into two parallel queries.
    // findAndCountAll with `include` makes Sequelize emit
    // SELECT COUNT(DISTINCT lead.id) FROM leads LEFT JOIN users ...
    // which on the e2-micro VM was the dominant cost on /leads (24s observed).
    // Counting without the JOIN is ~100x faster; we do not need the assignedTo
    // user to count rows.
    const [count, rows] = await Promise.all([
      db.Lead.count({ where }),
      db.Lead.findAll({
        where,
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']],
        include: [
          { model: db.User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
        ],
      }),
    ]);

    const leadsWithScore = rows.map(lead => ({
      ...lead.toJSON(),
      score: calculateLeadScore(lead),
    }));

    res.json({
      success: true,
      data: leadsWithScore,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeadById = async (req, res) => {
  try {
    const lead = await db.Lead.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: db.User, as: 'createdBy', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: db.Activity, as: 'activities' },
      ],
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Phase 1 Commit 3: brand-scope check. If the caller isn't in cross-brand
    // mode and this lead is on a brand they can't see, return 404 (don't leak
    // the row's existence by returning 403).
    if (req.brandScope
        && !req.brandScope.isCrossBrand
        && !req.brandScope.accessibleBrands.includes(lead.brandCode)) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const leadData = lead.toJSON();
    leadData.score = calculateLeadScore(lead);

    // Phase 4.17: surface the Draft Cold Email state on the lead detail
    // payload so the widget can render in one fetch. OutreachEmail is the
    // canonical source — Lead.draftEmailSubject/Body are deprecated.
    if (db.OutreachEmail) {
      const include = [{
        model: db.User,
        as: 'sentBy',
        attributes: ['id', 'firstName', 'lastName', 'email'],
      }];
      const [latestDraft, latestSent, latest] = await Promise.all([
        db.OutreachEmail.findOne({ where: { leadId: lead.id, status: 'draft' }, include, order: [['createdAt', 'DESC']] }),
        db.OutreachEmail.findOne({ where: { leadId: lead.id, status: 'sent' }, include, order: [['sentAt', 'DESC'], ['createdAt', 'DESC']] }),
        db.OutreachEmail.findOne({ where: { leadId: lead.id }, include, order: [['createdAt', 'DESC']] }),
      ]);
      leadData.outreachDraft = {
        draft: latestDraft,
        sent: latestSent,
        latest,
      };
    }

    res.json({ success: true, data: leadData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLead = async (req, res) => {
  try {
    const result = await leadWriteService.createLead(req.body || {}, {
      userId: req.user?.id || null,
      brandScope: req.brandScope || null,
      ip: req.ip || null,
      source: 'rest',
    });
    if (!result.ok) {
      const body = { success: false, message: result.message };
      if (result.sanctionsBlock) body.sanctionsBlock = result.sanctionsBlock;
      return res.status(result.httpStatus || 400).json(body);
    }
    res.status(201).json({
      success: true,
      data: result.lead,
      autoAddedBrand: result.autoAddedBrand,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const result = await leadWriteService.updateLead(req.params.id, req.body || {}, {
      userId: req.user?.id || null,
      userRole: req.user?.role || null,
      userName: req.user
        ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || null
        : null,
      brandScope: req.brandScope || null,
      ip: req.ip || null,
      source: 'rest',
    });
    if (!result.ok) {
      return res.status(result.httpStatus || 400).json({ success: false, message: result.message });
    }
    const updated = result.lead.toJSON();
    updated.score = calculateLeadScore(result.lead);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateLeadStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const lead = await db.Lead.findByPk(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const updateData = { status };

    if (status === 'won') {
      updateData.wonDate = new Date();
    } else if (status === 'lost') {
      updateData.lostDate = new Date();
    }

    await lead.update(updateData);
    res.json({ success: true, data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteLead = async (req, res) => {
  try {
    const result = await leadWriteService.deleteLead(req.params.id, {
      userId: req.user?.id || null,
      brandScope: req.brandScope || null,
      ip: req.ip || null,
      source: 'rest',
    });
    if (!result.ok) {
      return res.status(result.httpStatus || 500).json({ success: false, message: result.message });
    }
    res.json({ success: true, message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.convertLead = async (req, res) => {
  try {
    const { customerId, contactId } = req.body;
    const lead = await db.Lead.findByPk(req.params.id);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    await lead.update({
      status: 'won',
      convertedCustomerId: customerId,
      wonDate: new Date(),
    });

    res.json({ success: true, data: lead, message: 'Lead converted to customer' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getLeadsByStage = async (req, res) => {
  try {
    const { status } = req.params;

    const leads = await db.Lead.findAll({
      where: { status },
      order: [['createdAt', 'DESC']],
      include: [
        { model: db.User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeadsByAssignee = async (req, res) => {
  try {
    const { userId } = req.params;

    const leads = await db.Lead.findAll({
      where: { assignedToId: userId },
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getLeadTimeline = async (req, res) => {
  try {
    const { leadId } = req.params;

    const lead = await db.Lead.findByPk(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const activities = await db.Activity.findAll({
      where: { leadId },
      order: [['createdAt', 'DESC']],
    });

    const timeline = [
      {
        date: lead.createdAt,
        type: 'lead_created',
        description: `Lead created: ${lead.companyName}`,
      },
      ...activities.map(a => ({
        date: a.completedAt || a.scheduledAt,
        type: a.type,
        description: a.subject,
      })),
    ];

    res.json({ success: true, data: timeline.sort((a, b) => b.date - a.date) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
