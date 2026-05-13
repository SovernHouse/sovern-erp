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


// DEAL CONTROLLERS
exports.getDeals = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, stage, assignedToId } = req.query;
    const offset = (page - 1) * limit;

    const where = { ...(req.brandScope?.where || {}) };
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { dealNumber: { [Op.like]: `%${search}%` } },
      ];
    }
    if (stage) where.stage = stage;
    if (assignedToId) where.assignedToId = assignedToId;

    // PERF: split count from data fetch.
    const [count, rows] = await Promise.all([
      db.Deal.count({ where }),
      db.Deal.findAll({
        where,
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']],
        include: [
          { model: db.Customer, attributes: ['id', 'companyName'] },
          { model: db.Contact, attributes: ['id', 'firstName', 'lastName'] },
          { model: db.User, as: 'assignedTo', attributes: ['id', 'firstName', 'lastName', 'email'] },
        ],
      }),
    ]);

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
