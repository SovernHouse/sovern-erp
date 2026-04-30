const db = require('../models');
const tenant = require('../config/tenant');

/**
 * Generate branded Sovern House signature HTML from a stored signature record
 */
const generateSignatureHtml = (sig) => `
  <div style="margin-top: 36px; font-family: Arial, sans-serif; color: #0E0D0C; line-height: 1.5;">
    <div style="height: 2px; background-color: #1D5A32; margin-bottom: 24px;"></div>
    ${sig.signatureImageUrl ? `<div style="margin-bottom: 12px;"><img src="${sig.signatureImageUrl}" alt="" width="116" height="65" style="display: block; border: 0;"></div>` : ''}
    <div style="font-size: 15px; font-weight: 700; letter-spacing: 0.02em; color: #0E0D0C; margin-bottom: 3px;">${sig.displayName}</div>
    <div style="font-size: 12px; color: #5A5855; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 14px;">${sig.title || ''}</div>
    ${(sig.website || sig.phone) ? `
    <div style="font-size: 13px; margin-bottom: 24px;">
      ${sig.website ? `<a href="https://${sig.website}" style="color: #1D5A32; text-decoration: none; font-weight: 600;">${sig.website}</a>` : ''}
      ${sig.website && sig.phone ? `<span style="color: #C8C4BC; margin: 0 8px;">&middot;</span>` : ''}
      ${sig.phone ? `<span style="color: #5A5855;">${sig.phone}</span>` : ''}
    </div>` : ''}
    ${sig.logoUrl ? `<div style="margin-bottom: 14px;"><a href="https://${sig.website || tenant.companyDomain}" style="text-decoration: none; display: inline-block;"><img src="${sig.logoUrl}" alt="${tenant.companyName}" width="200" style="display: block; border: 0;"></a></div>` : ''}
    ${sig.tagline ? `<div style="font-size: 12px; color: #5A5855; font-style: italic; letter-spacing: 0.01em; margin-bottom: 16px;">${sig.tagline}</div>` : ''}
    ${sig.legalText ? `<div style="font-size: 10px; color: #B0ABA4; border-top: 1px solid #EBEBEB; padding-top: 10px;">${sig.legalText}</div>` : ''}
  </div>
`;

const generateSignatureText = (sig) => [
  '--',
  sig.displayName,
  [sig.title, tenant.companyName].filter(Boolean).join(' · '),
  [sig.website, sig.phone].filter(Boolean).join(' · '),
  sig.legalText || '',
].filter(Boolean).join('\n');

/**
 * GET /api/crm/email-signatures
 */
const getEmailSignatures = async (req, res) => {
  try {
    const signatures = await db.EmailSignature.findAll({ order: [['isDefault', 'DESC'], ['name', 'ASC']] });
    res.json({ success: true, data: signatures });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/crm/email-signatures
 */
const createEmailSignature = async (req, res) => {
  try {
    const { name, displayName, title, phone, website, signatureImageUrl, logoUrl, tagline, legalText, isDefault } = req.body;
    if (!name || !displayName) {
      return res.status(400).json({ success: false, message: 'name and displayName are required' });
    }
    // If marking as default, unset all others first
    if (isDefault) {
      await db.EmailSignature.update({ isDefault: false }, { where: {} });
    }
    const sig = await db.EmailSignature.create({
      name, displayName, title, phone, website,
      signatureImageUrl, logoUrl, tagline, legalText,
      isDefault: isDefault || false,
      userId: req.user?.id || null,
    });
    res.status(201).json({ success: true, data: sig });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/crm/email-signatures/:id
 */
const updateEmailSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const sig = await db.EmailSignature.findByPk(id);
    if (!sig) return res.status(404).json({ success: false, message: 'Signature not found' });
    if (req.body.isDefault) {
      await db.EmailSignature.update({ isDefault: false }, { where: {} });
    }
    await sig.update(req.body);
    res.json({ success: true, data: sig });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/crm/email-signatures/:id
 */
const deleteEmailSignature = async (req, res) => {
  try {
    const { id } = req.params;
    const sig = await db.EmailSignature.findByPk(id);
    if (!sig) return res.status(404).json({ success: false, message: 'Signature not found' });
    await sig.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getEmailSignatures, createEmailSignature, updateEmailSignature, deleteEmailSignature, generateSignatureHtml, generateSignatureText };
