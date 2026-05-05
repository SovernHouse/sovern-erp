const { Op } = require('sequelize');
const db = require('../models');
const sequelize = db.sequelize;
const { v4: uuidv4 } = require('uuid');
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
