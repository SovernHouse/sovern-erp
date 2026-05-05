const { Op } = require('sequelize');
const db = require('../models');
const sequelize = db.sequelize;
const { v4: uuidv4 } = require('uuid');
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
