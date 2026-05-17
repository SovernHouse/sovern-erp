// ─── priceListEmailService — Phase 4.28b carry-over ──────────────────────────
//
// Single shared helper that:
//   1. Loads a PriceList with items + parent Customer/Factory
//   2. Resolves a recipient set from any combination of explicit
//      addresses + leadId + customerId
//   3. Renders the brand-aware PDF (via priceListRenderer)
//   4. Sends via emailService with the PDF attached
//   5. Writes an audit row tagged 'send_price_list_email'
//
// Both the REST route (/api/personalization/price-lists/:id/send-email)
// and the MCP tool (send_price_list_email) call this so behaviour stays
// in lockstep per L-045.

const db = require('../models');
const emailService = require('./emailService');
const auditService = require('./auditService');
const { renderPriceListPdf } = require('./pdf/priceListRenderer');

async function loadPriceList(priceListId) {
  // CRITICAL: use the shared include so brandCode / brandRelationships /
  // product brand fields are always loaded — forgetting these was the
  // root cause of the 2026-05-17 brand leak (non-negotiable #9).
  const { priceListIncludeForBrand } = require('./priceListBrandResolver');
  return db.PriceList.findByPk(priceListId, {
    include: priceListIncludeForBrand(db),
    order: [[{ model: db.PriceListItem, as: 'items' }, 'sku', 'ASC']],
  });
}

async function resolveRecipients({ to, leadId, customerId }) {
  const recipients = new Set();
  if (Array.isArray(to)) to.forEach((e) => e && recipients.add(String(e).trim()));
  else if (typeof to === 'string') to.split(',').forEach((e) => e && recipients.add(e.trim()));

  if (leadId) {
    const lead = await db.Lead.findByPk(leadId, { attributes: ['email', 'companyName'] });
    if (lead && lead.email) recipients.add(lead.email);
  }
  if (customerId) {
    const customer = await db.Customer.findByPk(customerId, { attributes: ['email', 'companyName'] });
    if (customer && customer.email) recipients.add(customer.email);
  }
  return Array.from(recipients);
}

/**
 * Send a PriceList as a PDF attachment.
 *
 * @param {string} priceListId
 * @param {object} options
 * @param {string|string[]} [options.to]       Explicit email addresses
 * @param {string} [options.leadId]            Lead UUID to resolve email from
 * @param {string} [options.customerId]        Customer UUID to resolve email from
 * @param {string} [options.subject]           Default: 'Price List · {name}'
 * @param {string} [options.message]           HTML body. Default copy provided.
 * @param {object} [options.ctx]               { userId, ip, source } for audit
 *
 * @returns {Promise<{ok, recipients, messageId, error?, code?}>}
 */
async function sendPriceListEmail(priceListId, options = {}) {
  const ctx = options.ctx || {};
  const priceList = await loadPriceList(priceListId);
  if (!priceList) {
    return { ok: false, code: 'not_found', message: `PriceList ${priceListId} not found.` };
  }

  const recipients = await resolveRecipients(options);
  if (recipients.length === 0) {
    return { ok: false, code: 'no_recipients', message: 'No recipients resolved — pass `to` and/or `leadId` / `customerId`.' };
  }

  // Render via the PDF helper; brand-leak guard fires here. Catch the
  // BrandLeakError up so we never quietly email an SH-branded PDF of
  // FW/HH goods.
  const { BrandLeakError } = require('./priceListBrandResolver');
  let pdfBuffer;
  try {
    pdfBuffer = await renderPriceListPdf(priceList);
  } catch (err) {
    if (err instanceof BrandLeakError) {
      return { ok: false, code: 'brand_leak', message: err.message };
    }
    throw err;
  }
  const slug = String(priceList.name || 'price-list').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
  const filename = `${slug}-${priceList.id.slice(0, 8)}.pdf`;

  const subject =
    (options.subject && String(options.subject).trim()) ||
    `Price List · ${priceList.name || 'Sovern House'}`;
  const messageHtml =
    String(options.message || '').trim() ||
    `<p>Please find the attached price list <strong>${priceList.name || ''}</strong>.</p>` +
    `<p>Valid: ${priceList.validFrom || 'open'} to ${priceList.validTo || 'open'}.</p>` +
    `<p>Reply to this email if you have any questions.</p>`;

  const sendResult = await emailService.sendEmail(
    recipients.join(', '),
    subject,
    messageHtml,
    {
      attachments: [{
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    },
  );

  // Fire-and-forget audit. The send result governs the ok flag.
  auditService.logAction(
    ctx.userId || null,
    'send_price_list_email',
    'PriceList',
    priceList.id,
    {
      recipients,
      subject,
      leadId: options.leadId || null,
      customerId: options.customerId || null,
      source: ctx.source || 'rest',
      delivered: sendResult && sendResult.success !== false,
      messageId: sendResult && sendResult.messageId ? sendResult.messageId : null,
    },
    ctx.ip || null,
  ).catch(() => {});

  if (sendResult && sendResult.success === false) {
    return { ok: false, code: 'send_failed', message: sendResult.error || 'Email send failed', recipients };
  }
  return {
    ok: true,
    recipients,
    subject,
    messageId: sendResult && sendResult.messageId ? sendResult.messageId : null,
    disabled: sendResult && sendResult.disabled === true,
  };
}

module.exports = {
  sendPriceListEmail,
  // Internal helpers exported for tests + the MCP tool that wants to
  // surface the recipient list before sending (preview flow).
  loadPriceList,
  resolveRecipients,
};
