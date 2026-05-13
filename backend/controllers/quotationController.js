const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError } = require('../middleware/errorHandler');
const documentGenerator = require('../services/documentGenerator');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const { generateNumberWithCounter, incrementCounter } = require('../services/numberGenerator');
const auditService = require('../services/auditService');
const { validateFinancials } = require('../utils/validateFinancials');

const create = async (req, res, next) => {
  try {
    validateFinancials(req.body);
    const { customerId, inquiryId, salesPersonId, items, discount, discountType, taxRate, terms, factoryId, leadId } = req.body;

    const customer = await db.Customer.findByPk(customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const lastQuotation = await db.Quotation.findOne({
      order: [['createdAt', 'DESC']]
    });

    const counter = incrementCounter(lastQuotation?.quotationNumber);
    const quotationNumber = generateNumberWithCounter(process.env.DOC_PREFIX_QUOTATION || 'QOT', counter);

    let subtotal = 0;
    const createdItems = [];

    for (const item of items) {
      const product = await db.Product.findByPk(item.productId);
      if (!product) continue;

      const total = item.quantity * item.unitPrice;
      subtotal += total;

      createdItems.push({
        id: uuidv4(),
        productId: item.productId,
        description: item.description || product.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        total,
        notes: item.notes || ''
      });
    }

    const discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
    const afterDiscount = subtotal - discountAmount;
    const tax = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + tax;

    const quotation = await db.Quotation.create({
      id: uuidv4(),
      quotationNumber,
      inquiryId: inquiryId || null,
      customerId,
      salesPersonId: salesPersonId || null,
      factoryId: factoryId || null,
      leadId: leadId || null,
      status: 'draft',
      subtotal,
      discount: discountAmount,
      discountType: discountType || 'fixed',
      tax,
      taxRate: taxRate || 0,
      total,
      currency: customer.currency || 'USD',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      terms
    });

    await Promise.all(createdItems.map(item =>
      db.QuotationItem.create({ ...item, quotationId: quotation.id })
    ));

    const result = await db.Quotation.findByPk(quotation.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.User, as: 'salesPerson' },
        { model: db.Factory, as: 'factory', attributes: ['id', 'companyName', 'country'] },
        { model: db.Lead, as: 'lead', attributes: ['id', 'companyName', 'contactName'] }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Quotation created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Quotation', quotation.id, { data: result?.toJSON?.() || quotation.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status, customerId } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { ...(req.brandScope?.where || {}), deletedAt: null };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;
    if (req.query.factoryId) where.factoryId = req.query.factoryId;
    if (req.query.leadId) where.leadId = req.query.leadId;
    if (search) where.quotationNumber = { [Op.like]: `%${search}%` };

    const [count, rows] = await Promise.all([
      db.Quotation.count({ where }),
      db.Quotation.findAll({
        where,
        include: [
          { model: db.Customer, as: 'customer', attributes: ['companyName'] },
          { model: db.User, as: 'salesPerson', attributes: ['firstName', 'lastName'] },
          { model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] },
          { model: db.Lead, as: 'lead', attributes: ['id', 'companyName', 'contactName'] }
        ],
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.User, as: 'salesPerson' },
        { model: db.Inquiry, as: 'inquiry' },
        { model: db.Factory, as: 'factory' },
        { model: db.Lead, as: 'lead' }
      ]
    });

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    res.json(getSuccessResponse(quotation));
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items, discount, taxRate, terms, validUntil, factoryId, leadId } = req.body;

    const quotation = await db.Quotation.findByPk(id);
    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    if (quotation.status !== 'draft') {
      throw new Error('Can only edit draft quotations');
    }

    const beforeSnapshot = quotation.toJSON();

    if (items) {
      let subtotal = 0;
      for (const item of items) {
        const total = item.quantity * item.unitPrice;
        subtotal += total;

        if (item.id) {
          await db.QuotationItem.update(item, { where: { id: item.id } });
        } else {
          await db.QuotationItem.create({
            id: uuidv4(),
            quotationId: id,
            ...item
          });
        }
      }

      const discountAmount = quotation.discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
      const tax = ((subtotal - discountAmount) * taxRate) / 100;
      const total = subtotal - discountAmount + tax;

      await quotation.update({
        subtotal,
        discount: discountAmount,
        tax,
        taxRate: taxRate || quotation.taxRate,
        total,
        terms,
        validUntil,
        factoryId: factoryId !== undefined ? factoryId : quotation.factoryId,
        leadId: leadId !== undefined ? leadId : quotation.leadId,
      });
    }

    // Allow editing factoryId/leadId/terms/validUntil even when items
    // weren't sent — the items-only path skipped these otherwise.
    if (!items && (factoryId !== undefined || leadId !== undefined || terms !== undefined || validUntil !== undefined)) {
      const patch = {};
      if (factoryId !== undefined) patch.factoryId = factoryId;
      if (leadId !== undefined) patch.leadId = leadId;
      if (terms !== undefined) patch.terms = terms;
      if (validUntil !== undefined) patch.validUntil = validUntil;
      await quotation.update(patch);
    }

    const result = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.Factory, as: 'factory', attributes: ['id', 'companyName', 'country'] },
        { model: db.Lead, as: 'lead', attributes: ['id', 'companyName', 'contactName'] }
      ]
    });

    res.json(getSuccessResponse(result, 'Quotation updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Quotation', id, { before: beforeSnapshot, after: result?.toJSON?.() || quotation.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

function buildQuotationEmailHtml(quotation, brand) {
  const primaryColor = brand?.primaryColor || '#1D5A32';
  const displayName = brand?.displayName || 'Sovern House';
  const currency = quotation.currency || 'USD';

  const fmt = (value) => {
    if (value == null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value));
  };

  const items = quotation.items || [];
  const itemRows = items.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #F0EDE8;font-size:13px;color:#0E0D0C;">${item.description || item.product?.name || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #F0EDE8;font-size:13px;color:#0E0D0C;text-align:right;">${Number(item.quantity || 0).toFixed(2)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #F0EDE8;font-size:13px;color:#0E0D0C;">${item.unit || 'unit'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #F0EDE8;font-size:13px;color:#0E0D0C;text-align:right;">${fmt(item.unitPrice)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #F0EDE8;font-size:13px;color:#0E0D0C;text-align:right;font-weight:600;">${fmt(item.total)}</td>
    </tr>
  `).join('');

  const signatureHtml = brand?.signatureHtml || `
    <div style="margin-top:36px;font-family:Arial,sans-serif;color:#0E0D0C;line-height:1.5;">
      <div style="height:2px;background-color:#1D5A32;margin-bottom:24px;"></div>
      <div style="font-size:15px;font-weight:700;letter-spacing:0.02em;margin-bottom:3px;">Alexander McConnell</div>
      <div style="font-size:12px;color:#5A5855;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:14px;">Founder</div>
      <div style="font-size:13px;margin-bottom:24px;">
        <a href="https://sovernhouse.co" style="color:#1D5A32;text-decoration:none;font-weight:600;">sovernhouse.co</a>
        <span style="color:#C8C4BC;margin:0 8px;">&middot;</span>
        <span style="color:#5A5855;">+886 970 781 818</span>
      </div>
      <div style="font-size:10px;color:#B0ABA4;border-top:1px solid #EBEBEB;padding-top:10px;">Sovern House is a brand of New Route International Exchange Co., Ltd. — Taiwan.</div>
    </div>
  `;

  const validUntilLine = quotation.validUntil
    ? `<p style="font-size:13px;color:#5A5855;">This quotation is valid until <strong>${new Date(quotation.validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>`
    : '';

  const discountRow = quotation.discount
    ? `<tr><td style="padding:6px 12px;font-size:13px;color:#5A5855;">Discount${quotation.discountType === 'percentage' ? ` (${quotation.discount}%)` : ''}</td><td style="padding:6px 12px;font-size:13px;color:#C0392B;text-align:right;">−${fmt(quotation.discountAmount || quotation.discount)}</td></tr>`
    : '';
  const taxRow = quotation.tax
    ? `<tr><td style="padding:6px 12px;font-size:13px;color:#5A5855;">Tax${quotation.taxRate ? ` (${quotation.taxRate}%)` : ''}</td><td style="padding:6px 12px;font-size:13px;color:#0E0D0C;text-align:right;">${fmt(quotation.tax)}</td></tr>`
    : '';
  const subtotalRow = quotation.subtotal != null
    ? `<tr><td style="padding:6px 12px;font-size:13px;color:#5A5855;">Subtotal</td><td style="padding:6px 12px;font-size:13px;color:#0E0D0C;text-align:right;">${fmt(quotation.subtotal)}</td></tr>`
    : '';
  const termsSection = quotation.terms
    ? `<div style="margin-top:24px;padding:16px;background-color:#F7F5F2;border-radius:6px;"><div style="font-size:11px;font-weight:700;color:#5A5855;text-transform:uppercase;margin-bottom:8px;">Terms &amp; Conditions</div><p style="font-size:12px;color:#3A3835;white-space:pre-wrap;">${quotation.terms}</p></div>`
    : '';

  return `
<div style="font-family:Arial,sans-serif;font-size:14px;color:#0E0D0C;line-height:1.7;max-width:640px;">
  <div style="background-color:${primaryColor};padding:20px 28px;border-radius:8px 8px 0 0;">
    <div style="font-size:20px;font-weight:700;color:#FFFFFF;">${displayName}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.75);margin-top:2px;">Quotation</div>
  </div>
  <div style="background-color:#FFFFFF;padding:28px;border:1px solid #EBEBEB;border-top:none;">
    <p style="font-size:15px;font-weight:600;color:#0E0D0C;">Dear ${quotation.customer?.companyName || 'Valued Customer'},</p>
    <p style="font-size:14px;color:#3A3835;">Please find below our quotation <strong>${quotation.quotationNumber}</strong> for your review.</p>
    ${validUntilLine}
    <table style="width:100%;border-collapse:collapse;margin:24px 0;">
      <thead>
        <tr style="background-color:#F7F5F2;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#5A5855;text-transform:uppercase;border-bottom:2px solid #E0DDD9;">Description</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#5A5855;text-transform:uppercase;border-bottom:2px solid #E0DDD9;">Qty</th>
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#5A5855;text-transform:uppercase;border-bottom:2px solid #E0DDD9;">Unit</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#5A5855;text-transform:uppercase;border-bottom:2px solid #E0DDD9;">Unit Price</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#5A5855;text-transform:uppercase;border-bottom:2px solid #E0DDD9;">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows || '<tr><td colspan="5" style="padding:10px 12px;color:#B0ABA4;font-size:13px;">No items</td></tr>'}</tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;">
      ${subtotalRow}${discountRow}${taxRow}
      <tr style="border-top:2px solid #E0DDD9;">
        <td style="padding:10px 12px;font-size:15px;font-weight:700;color:#0E0D0C;">Total</td>
        <td style="padding:10px 12px;font-size:15px;font-weight:700;color:${primaryColor};text-align:right;">${fmt(quotation.total)}</td>
      </tr>
    </table>
    ${termsSection}
    ${signatureHtml}
  </div>
</div>`;
}

function buildQuotationEmailText(quotation, brand) {
  const currency = quotation.currency || 'USD';
  const fmt = (v) => v != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(v)) : '—';

  const items = (quotation.items || [])
    .map(item => `  ${item.description || item.product?.name || '—'}  x${item.quantity} ${item.unit || 'unit'}  ${fmt(item.unitPrice)} = ${fmt(item.total)}`)
    .join('\n');

  const validLine = quotation.validUntil
    ? `Valid until: ${new Date(quotation.validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
    : '';

  const signatureText = brand?.signatureText || '--\nAlexander McConnell\nFounder . Sovern House\nsovernhouse.co . +886 970 781 818\n\nSovern House is a brand of New Route International Exchange Co., Ltd. - Taiwan.';

  return [
    `Dear ${quotation.customer?.companyName || 'Valued Customer'},`,
    '',
    `Please find below our quotation ${quotation.quotationNumber} for your review.`,
    validLine,
    '',
    '--- LINE ITEMS ---',
    items || '  No items',
    '',
    '--- TOTALS ---',
    quotation.subtotal != null ? `  Subtotal: ${fmt(quotation.subtotal)}` : '',
    quotation.discount ? `  Discount: -${fmt(quotation.discountAmount || quotation.discount)}` : '',
    quotation.tax ? `  Tax: ${fmt(quotation.tax)}` : '',
    `  Total: ${fmt(quotation.total)}`,
    '',
    quotation.terms ? `--- TERMS ---\n${quotation.terms}\n` : '',
    signatureText,
  ].filter(line => line !== null && line !== undefined).join('\n');
}

const send = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.User, as: 'salesPerson' }
      ]
    });

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const toAddress = quotation.customer?.email;
    if (!toAddress) {
      throw new Error('Customer email is required to send quotation');
    }

    const brand = quotation.brandCode
      ? await db.Brand.findOne({ where: { code: quotation.brandCode, active: true } })
      : null;
    const fromAddress = brand?.senderEmail || 'alex@sovernhouse.co';
    const fromDisplayName = brand ? `${brand.displayName} | Alex` : 'Sovern House | Alex';

    const pdfFile = await documentGenerator.generateQuotationPDF(
      quotation,
      quotation.items,
      quotation.customer,
      quotation.salesPerson
    );

    const subject = `Quotation ${quotation.quotationNumber} from ${brand?.displayName || 'Sovern House'}`;
    const htmlContent = buildQuotationEmailHtml(quotation, brand);
    const textContent = buildQuotationEmailText(quotation, brand);

    await emailService.sendTransactionalEmailWithFallback({
      fromAddress,
      fromDisplayName,
      toAddress,
      toName: quotation.customer?.companyName,
      subject,
      htmlContent,
      textContent,
    });

    const beforeStatus = quotation.status;
    await quotation.update({ status: 'sent' });

    await notificationService.createQuotationNotification(quotation, quotation.customer.id, 'sent');

    res.json(getSuccessResponse({ quotation, pdfFile }, 'Quotation sent successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Quotation', id, { statusChange: { before: beforeStatus, after: 'sent' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const accept = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id);

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const beforeStatus = quotation.status;
    await quotation.update({ status: 'accepted' });
    await notificationService.createQuotationNotification(quotation, quotation.customerId, 'accepted');

    res.json(getSuccessResponse(quotation, 'Quotation accepted'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Quotation', id, { statusChange: { before: beforeStatus, after: 'accepted' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const reject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id);

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const beforeStatus = quotation.status;
    await quotation.update({ status: 'rejected' });
    await notificationService.createQuotationNotification(quotation, quotation.customerId, 'rejected');

    res.json(getSuccessResponse(quotation, 'Quotation rejected'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Quotation', id, { statusChange: { before: beforeStatus, after: 'rejected' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const duplicate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const original = await db.Quotation.findByPk(id, {
      include: [{ association: 'items' }]
    });

    if (!original || original.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const lastQuotation = await db.Quotation.findOne({
      order: [['createdAt', 'DESC']]
    });

    const counter = incrementCounter(lastQuotation?.quotationNumber);
    const quotationNumber = generateNumberWithCounter(process.env.DOC_PREFIX_QUOTATION || 'QOT', counter);

    const newQuotation = await db.Quotation.create({
      ...original.toJSON(),
      id: uuidv4(),
      quotationNumber,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    for (const item of original.items) {
      await db.QuotationItem.create({
        ...item.toJSON(),
        id: uuidv4(),
        quotationId: newQuotation.id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const result = await db.Quotation.findByPk(newQuotation.id, {
      include: [{ association: 'items' }]
    });

    res.status(201).json(getSuccessResponse(result, 'Quotation duplicated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Quotation', newQuotation.id, { data: result?.toJSON?.() || newQuotation.toJSON(), sourceQuotationId: id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const convertToProformaInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentTerms } = req.body;

    const quotation = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const lastPI = await db.ProformaInvoice.findOne({
      order: [['createdAt', 'DESC']]
    });

    const counter = incrementCounter(lastPI?.piNumber);
    const piNumber = generateNumberWithCounter(process.env.DOC_PREFIX_PI || 'PI', counter);

    const pi = await db.ProformaInvoice.create({
      id: uuidv4(),
      piNumber,
      quotationId: id,
      customerId: quotation.customerId,
      status: 'draft',
      subtotal: quotation.subtotal,
      discount: quotation.discount,
      tax: quotation.tax,
      total: quotation.total,
      currency: quotation.currency,
      paymentTerms: paymentTerms || 'Net 30',
      validUntil: quotation.validUntil
    });

    for (const item of quotation.items) {
      await db.ProformaInvoiceItem.create({
        id: uuidv4(),
        proformaInvoiceId: pi.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total
      });
    }

    const result = await db.ProformaInvoice.findByPk(pi.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Proforma Invoice created from quotation'));
  } catch (error) {
    next(error);
  }
};

const generatePDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.Customer, as: 'customer' },
        { model: db.User, as: 'salesPerson' }
      ]
    });

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const pdfFile = await documentGenerator.generateQuotationPDF(
      quotation,
      quotation.items,
      quotation.customer,
      quotation.salesPerson
    );

    res.json(getSuccessResponse({ pdfFile }, 'PDF generated successfully'));
  } catch (error) {
    next(error);
  }
};

const softDelete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quotation = await db.Quotation.findByPk(id);

    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    const beforeSnapshot = quotation.toJSON();

    await quotation.update({ deletedAt: new Date() });

    res.json(getSuccessResponse({ id: quotation.id }, 'Quotation deleted'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Quotation', id, { before: beforeSnapshot }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  update,
  send,
  accept,
  reject,
  duplicate,
  convertToProformaInvoice,
  generatePDF,
  softDelete
};
