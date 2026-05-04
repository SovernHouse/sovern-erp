const { Op } = require('sequelize');
const db = require('../models');
const sequelize = db.sequelize;
const { v4: uuidv4 } = require('uuid');

// Helper function to generate deal number
const generateDealNumber = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `DL-${date}-${random}`;
};

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

// CONTACT CONTROLLERS
exports.getContacts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, customerId, factoryId, isActive } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
      ];
    }
    if (customerId) where.customerId = customerId;
    if (factoryId) where.factoryId = factoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const { count, rows } = await db.Contact.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.Factory, attributes: ['id', 'companyName'] },
      ],
    });

    res.json({
      success: true,
      data: rows,
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

exports.getContactById = async (req, res) => {
  try {
    const contact = await db.Contact.findByPk(req.params.id, {
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.Factory, attributes: ['id', 'companyName'] },
        { model: db.Activity, as: 'activities' },
      ],
    });

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createContact = async (req, res) => {
  try {
    const contact = await db.Contact.create(req.body);
    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateContact = async (req, res) => {
  try {
    const contact = await db.Contact.findByPk(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await contact.update(req.body);
    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const contact = await db.Contact.findByPk(req.params.id);
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }

    await contact.destroy();
    res.json({ success: true, message: 'Contact deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// LEAD CONTROLLERS
exports.getLeads = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, source, assignedToId, leadType } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
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
    if (leadType) where.leadType = leadType;

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
        { model: db.Activity, as: 'activities' },
      ],
    });

    if (!lead) {
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
    const lead = await db.Lead.create(req.body);
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateLead = async (req, res) => {
  try {
    const lead = await db.Lead.findByPk(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    await lead.update(req.body);
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
    const lead = await db.Lead.findByPk(req.params.id);
    if (!lead) {
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

// ACTIVITY CONTROLLERS
exports.getActivities = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, assignedToId, status } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (type) where.type = type;
    if (assignedToId) where.userId = assignedToId;
    if (status === 'upcoming') where.isCompleted = false;
    if (status === 'overdue') {
      where.isCompleted = false;
      where.scheduledAt = { [Op.lt]: new Date() };
    }

    const { count, rows } = await db.Activity.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['scheduledAt', 'ASC']],
      include: [
        { model: db.Contact, attributes: ['id', 'firstName', 'lastName'] },
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.Lead, attributes: ['id', 'companyName'] },
        { model: db.User, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    res.json({
      success: true,
      data: rows,
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

exports.getActivityById = async (req, res) => {
  try {
    const activity = await db.Activity.findByPk(req.params.id, {
      include: [
        { model: db.Contact },
        { model: db.Customer },
        { model: db.Lead },
        { model: db.User, as: 'assignedUser' },
      ],
    });

    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createActivity = async (req, res) => {
  try {
    const activity = await db.Activity.create(req.body);
    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const activity = await db.Activity.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    await activity.update(req.body);
    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    const activity = await db.Activity.findByPk(req.params.id);
    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    await activity.destroy();
    res.json({ success: true, message: 'Activity deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.completeActivity = async (req, res) => {
  try {
    const { outcome, duration } = req.body;
    const activity = await db.Activity.findByPk(req.params.id);

    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    await activity.update({
      isCompleted: true,
      completedAt: new Date(),
      outcome,
      duration,
    });

    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.rescheduleActivity = async (req, res) => {
  try {
    const { scheduledAt, reminder } = req.body;
    const activity = await db.Activity.findByPk(req.params.id);

    if (!activity) {
      return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    await activity.update({
      scheduledAt,
      reminder,
      isCompleted: false,
      completedAt: null,
    });

    res.json({ success: true, data: activity });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getUpcomingActivities = async (req, res) => {
  try {
    const { userId, days = 7 } = req.query;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + parseInt(days));

    const where = {
      isCompleted: false,
      scheduledAt: {
        [Op.between]: [new Date(), futureDate],
      },
    };

    if (userId) where.userId = userId;

    const activities = await db.Activity.findAll({
      where,
      order: [['scheduledAt', 'ASC']],
      limit: 50,
    });

    res.json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOverdueActivities = async (req, res) => {
  try {
    const { userId } = req.query;

    const where = {
      isCompleted: false,
      scheduledAt: { [Op.lt]: new Date() },
    };

    if (userId) where.userId = userId;

    const activities = await db.Activity.findAll({
      where,
      order: [['scheduledAt', 'ASC']],
    });

    res.json({ success: true, data: activities });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DEAL CONTROLLERS
exports.getDeals = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, stage, assignedToId } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { dealNumber: { [Op.like]: `%${search}%` } },
      ];
    }
    if (stage) where.stage = stage;
    if (assignedToId) where.assignedToId = assignedToId;

    const { count, rows } = await db.Deal.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.Contact, attributes: ['id', 'firstName', 'lastName'] },
        { model: db.User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    res.json({
      success: true,
      data: rows,
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

exports.getDealById = async (req, res) => {
  try {
    const deal = await db.Deal.findByPk(req.params.id, {
      include: [
        { model: db.Customer, attributes: ['id', 'companyName', 'email'] },
        { model: db.Contact, attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: db.User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: db.Activity, as: 'activities' },
      ],
    });

    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDeal = async (req, res) => {
  try {
    const dealData = {
      ...req.body,
      dealNumber: generateDealNumber(),
    };

    const deal = await db.Deal.create(dealData);
    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateDeal = async (req, res) => {
  try {
    const deal = await db.Deal.findByPk(req.params.id);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    await deal.update(req.body);
    res.json({ success: true, data: deal });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteDeal = async (req, res) => {
  try {
    const deal = await db.Deal.findByPk(req.params.id);
    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    await deal.destroy();
    res.json({ success: true, message: 'Deal deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDealStage = async (req, res) => {
  try {
    const { stage } = req.body;
    const deal = await db.Deal.findByPk(req.params.id);

    if (!deal) {
      return res.status(404).json({ success: false, message: 'Deal not found' });
    }

    const updateData = { stage };

    if (stage === 'closed_won') {
      updateData.actualCloseDate = new Date();
    } else if (stage === 'closed_lost') {
      updateData.actualCloseDate = new Date();
    }

    await deal.update(updateData);
    res.json({ success: true, data: deal });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getDealsByStage = async (req, res) => {
  try {
    const deals = await db.Deal.findAll({
      attributes: { include: ['stage'] },
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['stage', 'ASC'], ['createdAt', 'DESC']],
    });

    const dealsByStage = {
      prospecting: [],
      qualification: [],
      proposal: [],
      negotiation: [],
      closed_won: [],
      closed_lost: [],
    };

    deals.forEach(deal => {
      dealsByStage[deal.stage].push(deal);
    });

    res.json({ success: true, data: dealsByStage });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDealsByAssignee = async (req, res) => {
  try {
    const { userId } = req.params;

    const deals = await db.Deal.findAll({
      where: { assignedToId: userId },
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, data: deals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDealForecast = async (req, res) => {
  try {
    const deals = await db.Deal.findAll({
      where: {
        stage: {
          [Op.ne]: 'closed_lost',
        },
      },
    });

    let totalValue = 0;
    let weightedValue = 0;

    deals.forEach(deal => {
      const value = parseFloat(deal.value);
      const probability = deal.probability || 50;
      totalValue += value;
      weightedValue += (value * probability) / 100;
    });

    res.json({
      success: true,
      data: {
        totalValue,
        weightedValue,
        totalDeals: deals.length,
        forecast: {
          bestCase: totalValue,
          worstCase: weightedValue,
          mostLikely: weightedValue,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CAMPAIGN CONTROLLERS
exports.getCampaigns = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type } = req.query;
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;

    const { count, rows } = await db.Campaign.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    const campaignsWithROI = rows.map(campaign => {
      const roi = campaign.actualCost > 0
        ? (((campaign.actualRevenue - campaign.actualCost) / campaign.actualCost) * 100).toFixed(2)
        : 0;

      return {
        ...campaign.toJSON(),
        roi,
      };
    });

    res.json({
      success: true,
      data: campaignsWithROI,
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

exports.getCampaignById = async (req, res) => {
  try {
    const campaign = await db.Campaign.findByPk(req.params.id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const campaignData = campaign.toJSON();
    const roi = campaign.actualCost > 0
      ? (((campaign.actualRevenue - campaign.actualCost) / campaign.actualCost) * 100).toFixed(2)
      : 0;

    campaignData.roi = roi;

    res.json({ success: true, data: campaignData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const campaign = await db.Campaign.create(req.body);
    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await db.Campaign.findByPk(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    await campaign.update(req.body);
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const campaign = await db.Campaign.findByPk(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    await campaign.destroy();
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCampaignStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const campaign = await db.Campaign.findByPk(req.params.id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    await campaign.update({ status });
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getCampaignPerformance = async (req, res) => {
  try {
    const { campaignId } = req.params;

    const campaign = await db.Campaign.findByPk(campaignId);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const conversionRate = campaign.leadsCount > 0
      ? ((campaign.conversionsCount / campaign.leadsCount) * 100).toFixed(2)
      : 0;

    const roi = campaign.actualCost > 0
      ? (((campaign.actualRevenue - campaign.actualCost) / campaign.actualCost) * 100).toFixed(2)
      : 0;

    const performance = {
      campaignName: campaign.name,
      leadsGenerated: campaign.leadsCount,
      conversions: campaign.conversionsCount,
      conversionRate,
      budget: campaign.budget,
      actualCost: campaign.actualCost,
      expectedRevenue: campaign.expectedRevenue,
      actualRevenue: campaign.actualRevenue,
      roi,
      costPerLead: campaign.leadsCount > 0 ? (campaign.actualCost / campaign.leadsCount).toFixed(2) : 0,
      costPerConversion: campaign.conversionsCount > 0 ? (campaign.actualCost / campaign.conversionsCount).toFixed(2) : 0,
    };

    res.json({ success: true, data: performance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// CRM DASHBOARD
exports.getCRMDashboard = async (req, res) => {
  try {
    // Pipeline metrics
    const deals = await db.Deal.findAll();
    let totalPipelineValue = 0;
    let weightedPipelineValue = 0;

    deals.forEach(deal => {
      if (deal.stage !== 'closed_lost' && deal.stage !== 'closed_won') {
        const value = parseFloat(deal.value);
        const probability = deal.probability || 50;
        totalPipelineValue += value;
        weightedPipelineValue += (value * probability) / 100;
      }
    });

    // Win rate
    const wonDeals = await db.Deal.count({ where: { stage: 'closed_won' } });
    const lostDeals = await db.Deal.count({ where: { stage: 'closed_lost' } });
    const totalClosedDeals = wonDeals + lostDeals;
    const winRate = totalClosedDeals > 0 ? ((wonDeals / totalClosedDeals) * 100).toFixed(2) : 0;

    // Average deal size
    const closedWonDeals = await db.Deal.findAll({
      where: { stage: 'closed_won' },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('value')), 'avgValue'],
      ],
      raw: true,
    });
    const avgDealSize = closedWonDeals[0].avgValue ? parseFloat(closedWonDeals[0].avgValue).toFixed(2) : 0;

    // Activities due today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const activitiesToday = await db.Activity.count({
      where: {
        isCompleted: false,
        scheduledAt: {
          [Op.between]: [today, tomorrow],
        },
      },
    });

    // Leads by source
    const leadsBySource = await db.Lead.findAll({
      attributes: [
        'source',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['source'],
      raw: true,
    });

    // Deals by stage
    const dealsByStage = await db.Deal.findAll({
      attributes: [
        'stage',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('SUM', sequelize.col('value')), 'value'],
      ],
      group: ['stage'],
      raw: true,
    });

    // Recent activities
    const recentActivities = await db.Activity.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      include: [
        { model: db.Contact, attributes: ['firstName', 'lastName'] },
        { model: db.User, as: 'assignedUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    // Top deals
    const topDeals = await db.Deal.findAll({
      order: [['value', 'DESC']],
      limit: 5,
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    res.json({
      success: true,
      data: {
        pipelineValue: parseFloat(totalPipelineValue).toFixed(2),
        weightedPipelineValue: parseFloat(weightedPipelineValue).toFixed(2),
        winRate,
        avgDealSize,
        activitiesToday,
        leadsBySource: leadsBySource.map(item => ({
          source: item.source,
          count: parseInt(item.count),
        })),
        dealsByStage: dealsByStage.map(item => ({
          stage: item.stage,
          count: parseInt(item.count),
          value: parseFloat(item.value || 0).toFixed(2),
        })),
        recentActivities,
        topDeals,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PIPELINE VIEW
exports.getPipelineView = async (req, res) => {
  try {
    const deals = await db.Deal.findAll({
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
      order: [['stage', 'ASC'], ['value', 'DESC']],
    });

    const pipeline = {
      prospecting: [],
      qualification: [],
      proposal: [],
      negotiation: [],
      closed_won: [],
      closed_lost: [],
    };

    deals.forEach(deal => {
      pipeline[deal.stage].push(deal);
    });

    res.json({ success: true, data: pipeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
