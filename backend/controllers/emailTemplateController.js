const db = require('../models');

/**
 * GET /api/crm/email-templates
 */
const getEmailTemplates = async (req, res) => {
  try {
    const templates = await db.EmailTemplate.findAll({
      order: [['name', 'ASC']],
    });
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/crm/email-templates
 * Body: { name, subject, bodyText, category }
 */
const createEmailTemplate = async (req, res) => {
  try {
    const { name, subject, bodyText, category } = req.body;
    if (!name || !subject || !bodyText) {
      return res.status(400).json({ success: false, message: 'name, subject, and bodyText are required' });
    }
    const template = await db.EmailTemplate.create({
      name,
      subject,
      bodyText,
      category: category || null,
      createdByUserId: req.user?.id || null,
    });
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/crm/email-templates/:id
 */
const updateEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, bodyText, category } = req.body;
    const template = await db.EmailTemplate.findByPk(id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    await template.update({ name, subject, bodyText, category });
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/crm/email-templates/:id
 */
const deleteEmailTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await db.EmailTemplate.findByPk(id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });
    await template.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate };
