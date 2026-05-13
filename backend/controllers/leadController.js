const { Op } = require('sequelize');
const db = require('../models');
const sequelize = db.sequelize;
const { v4: uuidv4 } = require('uuid');
const { assertSingleBrandMode, assertBrandWritable } = require('../middleware/brandScope');
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

    res.json({ success: true, data: leadData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createLead = async (req, res) => {
  try {
    // Phase 1 Commit 3: brand-scope enforcement on creation.
    // Reject in cross-brand mode (D-3: All Brands view is read-only).
    if (!assertSingleBrandMode(req, res)) return;

    const payload = { ...req.body };
    // Stamp the creator from the authenticated user; ignore any client-supplied value.
    if (req.user && req.user.id) payload.createdById = req.user.id;

    // Default brand to the user's defaultBrand if the client didn't send one.
    // Then assert the user has write access to whatever brand we ended up with.
    if (!payload.brandCode && req.brandScope) {
      payload.brandCode = req.brandScope.defaultBrand;
    }
    if (!assertBrandWritable(req, res, payload.brandCode)) return;

    const lead = await db.Lead.create(payload);
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    if (!assertSingleBrandMode(req, res)) return;

    const lead = await db.Lead.findByPk(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Caller must have access to the lead's current brand.
    if (req.brandScope
        && !req.brandScope.accessibleBrands.includes(lead.brandCode)) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // brandCode is immutable on the standard update path. Changes flow only
    // through PATCH /api/admin/brand-override (super_admin, audited). Strip
    // it from req.body silently rather than 400 — the field will arrive
    // attached whenever the frontend submits the whole form back.
    const { brandCode: _ignored, ...allowed } = req.body || {};

    await lead.update(allowed);
    const updated = lead.toJSON();
    updated.score = calculateLeadScore(lead);

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
    if (!assertSingleBrandMode(req, res)) return;

    const lead = await db.Lead.findByPk(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    if (req.brandScope
        && !req.brandScope.accessibleBrands.includes(lead.brandCode)) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Cascade delete related outreach emails before removing the lead
    if (db.OutreachEmail) {
      await db.OutreachEmail.destroy({ where: { leadId: lead.id } });
    }
    await lead.destroy();
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
