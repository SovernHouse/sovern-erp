const { Op } = require('sequelize');
const db = require('../models');
const sequelize = db.sequelize;
const { v4: uuidv4 } = require('uuid');
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

    // PERF: split count from data fetch — 4 joins on COUNT was the heaviest in CRM.
    const [count, rows] = await Promise.all([
      db.Activity.count({ where }),
      db.Activity.findAll({
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
