const { Op } = require('sequelize');
const db = require('../models');
const sequelize = db.sequelize;
const { v4: uuidv4 } = require('uuid');
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
    // Allow filtering for "all supplier contacts" (factoryId IS NOT NULL) or
    // "all customer contacts" (customerId IS NOT NULL) — used by the
    // Supplier Contacts and Customer Contacts page variants.
    if (req.query.factoryIdNotNull === 'true') where.factoryId = { [Op.ne]: null };
    if (req.query.customerIdNotNull === 'true') where.customerId = { [Op.ne]: null };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    // PERF: split count from data fetch — see getLeads for rationale.
    const [count, rows] = await Promise.all([
      db.Contact.count({ where }),
      db.Contact.findAll({
        where,
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']],
        include: [
          { model: db.Customer, attributes: ['id', 'companyName'] },
          { model: db.Factory, attributes: ['id', 'companyName'] },
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
