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

// Phase 4.9 C-3: countries we currently track US-style import tariffs for.
// Only USA today. Keeping it as a list so adding EU / UK / CA later is a
// one-line change.
const TARIFF_TRACKED_DESTINATIONS = new Set(['US', 'USA']);

const create = async (req, res, next) => {
  try {
    validateFinancials(req.body);
    const {
      customerId, inquiryId, salesPersonId, items, discount, discountType,
      taxRate, terms, factoryId, leadId, brandCode, commissionRateOverride,
      displayAreaUnit, displayDimensionUnit,
    } = req.body;

    const customer = await db.Customer.findByPk(customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Phase 4, C18: refuse to quote a sanctioned customer. 'override' is
    // the super-admin attestation path and DOES unblock; only 'flagged'
    // hard-blocks. 'requires_review' and 'pending' are not blocked here
    // (the UI shows a warning but lets the user proceed).
    if (customer.screeningStatus === 'flagged') {
      const auditService = require('../services/auditService');
      auditService.logAction(
        req.user?.id,
        'sanctions_block',
        'Customer',
        customer.id,
        {
          context: 'quotation_create',
          companyName: customer.companyName,
          reason: customer.sanctionBlockReason,
          hits: customer.sanctionsScreenDetails,
        },
        req.ip,
      ).catch(() => {});
      const err = new ValidationError(
        `Customer "${customer.companyName}" is on a sanctions list. Reason: ${customer.sanctionBlockReason || 'flagged'}. Super-admin override required.`
      );
      err.statusCode = 403;
      err.sanctionsBlock = {
        status: customer.screeningStatus,
        customerId: customer.id,
        hits: customer.sanctionsScreenDetails,
      };
      throw err;
    }

    // Phase 3, C13: resolve brandCode (body wins, else user defaultBrand, else 'SH').
    const resolvedBrandCode = brandCode || req.brandScope?.defaultBrand || 'SH';

    // Phase 4, C15: validate commissionRateOverride against the 5% floor.
    // Stored as decimal 0..1 (e.g. 0.07 = 7%). NULL = use brand default.
    let resolvedOverride = null;
    if (commissionRateOverride != null && commissionRateOverride !== '') {
      const rate = parseFloat(commissionRateOverride);
      if (!Number.isFinite(rate)) {
        throw new ValidationError('commissionRateOverride must be a number');
      }
      const { COMMISSION_FLOOR_DECIMAL } = require('../services/commissionAccrual');
      if (rate < COMMISSION_FLOOR_DECIMAL) {
        throw new ValidationError(
          `commissionRateOverride must be >= ${COMMISSION_FLOOR_DECIMAL} (5% floor)`
        );
      }
      if (rate > 1) {
        throw new ValidationError('commissionRateOverride must be a decimal between 0 and 1 (e.g. 0.07 = 7%)');
      }
      resolvedOverride = rate;
    }

    const lastQuotation = await db.Quotation.findOne({
      order: [['createdAt', 'DESC']]
    });

    const counter = incrementCounter(lastQuotation?.quotationNumber);
    const quotationNumber = generateNumberWithCounter(process.env.DOC_PREFIX_QUOTATION || 'QOT', counter);

    let subtotal = 0;
    const createdItems = [];

    // NO-MARKUP INVARIANT (Phase 4): baseFobPrice is the buyer-facing price
    // and ALREADY INCLUDES Alex's commission. The line-item math below is
    // a straight `quantity * unitPrice`. Do NOT multiply by (1 + rate)
    // anywhere; commission is tracked as a separate CommissionTracking row.
    for (const item of items) {
      const product = await db.Product.findByPk(item.productId);
      if (!product) continue;

      // Phase 4, C14: brand match — products of the current brand only.
      if (product.brandCode && product.brandCode !== resolvedBrandCode) {
        throw new ValidationError(
          `Product ${product.sku} belongs to brand ${product.brandCode}; cannot quote under ${resolvedBrandCode}.`
        );
      }

      // Phase 4, C14 (extended Phase 4.9.2b): floor check sources from
      // ProductPrice (the new temporal pricing layer) so per-origin
      // pricing windows are honoured. Falls back to product.baseFobPrice
      // (denormalized cache) when no ProductPrice row exists yet —
      // covers products created before the 4.9.2b backfill and any
      // future product whose ProductPrice insert lagged the Product
      // insert.
      const { getCurrentPrice } = require('../services/productPriceService');
      const reqOriginRaw = (item.originCountry || '').toUpperCase().trim();
      const lineOrigin = reqOriginRaw || (product.originCountry || '').toUpperCase().trim() || null;
      const currentPrice = await getCurrentPrice(product.id, lineOrigin);
      const floor = currentPrice
        ? Number(currentPrice.sellingPriceUsdPerM2)
        : (product.baseFobPrice != null ? parseFloat(product.baseFobPrice) : null);

      let unitPrice = item.unitPrice;
      if (unitPrice == null || unitPrice === '' || Number(unitPrice) === 0) {
        if (floor != null) unitPrice = floor;
      }
      if (floor != null) {
        if (parseFloat(unitPrice) < floor) {
          const isSuperAdmin = req.user?.role === 'super_admin';
          if (!isSuperAdmin) {
            throw new ValidationError(
              `Unit price ${unitPrice} for ${product.sku} is below floor ${floor.toFixed(2)}. Super-admin override required.`
            );
          }
          const reason = (item.belowFloorReason || '').trim();
          if (reason.length < 5) {
            throw new ValidationError(
              `belowFloorReason (>= 5 chars) is required when quoting ${product.sku} below floor ${floor.toFixed(2)}.`
            );
          }
          // Audit the override. Fire-and-forget.
          auditService.logAction(
            req.user.id,
            'product_floor_override',
            'Product',
            product.id,
            { sku: product.sku, floor, quotedPrice: parseFloat(unitPrice), reason, source: currentPrice ? 'ProductPrice' : 'baseFobPriceFallback' },
            req.ip,
          ).catch(() => {});
        }
      }

      const total = item.quantity * unitPrice;
      subtotal += total;

      // Phase 4.9 C-3: resolve origin. If the line specifies originCountry
      // and the product has a matching originVariants[] entry, prefer the
      // variant's FOB. Otherwise fobPriceUsd falls back to unitPrice.
      let resolvedOrigin = null;
      let resolvedFobUsd = null;
      const reqOrigin = (item.originCountry || '').toUpperCase().trim();
      if (reqOrigin) {
        const variants = Array.isArray(product.originVariants) ? product.originVariants : [];
        const match = variants.find(v => (v.originCountry || '').toUpperCase() === reqOrigin);
        if (match && match.fobPriceUsd != null) {
          resolvedOrigin = reqOrigin;
          resolvedFobUsd = parseFloat(match.fobPriceUsd);
        } else {
          // Origin was named but product has no variant for it. Don't fail —
          // accept the origin label, snapshot the line's unitPrice as FOB.
          resolvedOrigin = reqOrigin;
          resolvedFobUsd = parseFloat(unitPrice);
        }
      } else {
        // No origin chosen — default to product.originCountry if set.
        resolvedOrigin = (product.originCountry || '').toUpperCase() || null;
        resolvedFobUsd = parseFloat(unitPrice);
      }

      createdItems.push({
        id: uuidv4(),
        productId: item.productId,
        description: item.description || product.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: unitPrice,
        discount: item.discount || 0,
        total,
        notes: item.notes || '',
        originCountry: resolvedOrigin,
        fobPriceUsd: resolvedFobUsd,
        // Tariff snapshot + landed cost are populated on send() — left null
        // at draft so a customer/origin/destination change before send still
        // recomputes against the live rate.
        tariffSnapshot: null,
        landedCostUnit: null,
        landedCostTotal: null,
      });
    }

    const discountAmount = discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
    const afterDiscount = subtotal - discountAmount;
    const tax = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + tax;

    // Phase 4.9 C-3: validate display-unit toggles.
    const validAreaUnits = new Set(['sqm', 'sqft']);
    const validDimUnits  = new Set(['mm', 'inch']);
    const resolvedAreaUnit = validAreaUnits.has(displayAreaUnit) ? displayAreaUnit : 'sqm';
    const resolvedDimUnit  = validDimUnits.has(displayDimensionUnit) ? displayDimensionUnit : 'mm';

    const quotation = await db.Quotation.create({
      id: uuidv4(),
      quotationNumber,
      inquiryId: inquiryId || null,
      customerId,
      salesPersonId: salesPersonId || null,
      factoryId: factoryId || null,
      leadId: leadId || null,
      brandCode: resolvedBrandCode,
      commissionRateOverride: resolvedOverride,
      status: 'draft',
      subtotal,
      discount: discountAmount,
      discountType: discountType || 'fixed',
      tax,
      taxRate: taxRate || 0,
      total,
      currency: customer.currency || 'USD',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      terms,
      displayAreaUnit: resolvedAreaUnit,
      displayDimensionUnit: resolvedDimUnit,
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

    // Phase 3, C13: cross-brand auto-add to customer.brandRelationships.
    let autoAddedBrand = null;
    try {
      const { addBrandIfMissing } = require('../services/crossBrandAutoAdd');
      autoAddedBrand = await addBrandIfMissing(db, customerId, resolvedBrandCode, {
        userId: req.user?.id,
        entity: 'Quotation',
        entityId: quotation.id,
        ip: req.ip,
      });
    } catch (_) { /* never block the create */ }

    res.status(201).json(getSuccessResponse({ ...result.toJSON(), autoAddedBrand }, 'Quotation created successfully'));

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

    // Phase 3, C13: 404-on-wrong-brand. Don't leak the existence of a
    // quotation outside the user's accessible brands.
    const { isAccessibleByBrandCode } = require('../utils/notFoundOnWrongBrand');
    if (!isAccessibleByBrandCode(req, quotation.brandCode)) {
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
    const {
      items, discount, taxRate, terms, validUntil, factoryId, leadId,
      commissionRateOverride, displayAreaUnit, displayDimensionUnit,
    } = req.body;

    const quotation = await db.Quotation.findByPk(id);
    if (!quotation || quotation.deletedAt) {
      throw new NotFoundError('Quotation not found');
    }

    if (quotation.status !== 'draft') {
      throw new Error('Can only edit draft quotations');
    }

    const beforeSnapshot = quotation.toJSON();

    // Phase 4, C15: validate commissionRateOverride if present in body.
    // Same floor as create.
    let newOverride;
    if (commissionRateOverride !== undefined) {
      if (commissionRateOverride === null || commissionRateOverride === '') {
        newOverride = null;
      } else {
        const rate = parseFloat(commissionRateOverride);
        const { COMMISSION_FLOOR_DECIMAL } = require('../services/commissionAccrual');
        if (!Number.isFinite(rate)) {
          throw new ValidationError('commissionRateOverride must be a number');
        }
        if (rate < COMMISSION_FLOOR_DECIMAL || rate > 1) {
          throw new ValidationError(
            `commissionRateOverride must be between ${COMMISSION_FLOOR_DECIMAL} and 1`
          );
        }
        newOverride = rate;
      }
      // Apply the override change + audit.
      const prev = quotation.commissionRateOverride;
      if (String(prev || '') !== String(newOverride || '')) {
        await quotation.update({ commissionRateOverride: newOverride });
        auditService.logAction(
          req.user.id,
          'commission_rate_override',
          'Quotation',
          quotation.id,
          { previous: prev, next: newOverride },
          req.ip,
        ).catch(() => {});
      }
    }

    if (items) {
      let subtotal = 0;
      for (const item of items) {
        const total = item.quantity * item.unitPrice;
        subtotal += total;

        // Phase 4.9 C-3: resolve origin + fobPriceUsd per line on update too.
        let resolvedOrigin = null;
        let resolvedFobUsd = null;
        const reqOrigin = (item.originCountry || '').toUpperCase().trim();
        if (item.productId) {
          const product = await db.Product.findByPk(item.productId);
          if (product) {
            if (reqOrigin) {
              const variants = Array.isArray(product.originVariants) ? product.originVariants : [];
              const match = variants.find(v => (v.originCountry || '').toUpperCase() === reqOrigin);
              resolvedOrigin = reqOrigin;
              resolvedFobUsd = match && match.fobPriceUsd != null
                ? parseFloat(match.fobPriceUsd)
                : parseFloat(item.unitPrice);
            } else {
              resolvedOrigin = (product.originCountry || '').toUpperCase() || null;
              resolvedFobUsd = parseFloat(item.unitPrice);
            }
          }
        }

        const itemPatch = {
          ...item,
          total,
          originCountry: resolvedOrigin,
          fobPriceUsd: resolvedFobUsd,
          // Clear any prior snapshot; it gets rewritten at send().
          tariffSnapshot: null,
          landedCostUnit: null,
          landedCostTotal: null,
        };

        if (item.id) {
          await db.QuotationItem.update(itemPatch, { where: { id: item.id } });
        } else {
          await db.QuotationItem.create({
            id: uuidv4(),
            quotationId: id,
            ...itemPatch,
          });
        }
      }

      const discountAmount = quotation.discountType === 'percentage' ? (subtotal * discount) / 100 : discount;
      const tax = ((subtotal - discountAmount) * taxRate) / 100;
      const total = subtotal - discountAmount + tax;

      // Phase 4.9 C-3: allow toggling display units while still in draft.
      const validAreaUnits = new Set(['sqm', 'sqft']);
      const validDimUnits  = new Set(['mm', 'inch']);
      const quotationPatch = {
        subtotal,
        discount: discountAmount,
        tax,
        taxRate: taxRate || quotation.taxRate,
        total,
        terms,
        validUntil,
        factoryId: factoryId !== undefined ? factoryId : quotation.factoryId,
        leadId: leadId !== undefined ? leadId : quotation.leadId,
      };
      if (displayAreaUnit !== undefined && validAreaUnits.has(displayAreaUnit)) {
        quotationPatch.displayAreaUnit = displayAreaUnit;
      }
      if (displayDimensionUnit !== undefined && validDimUnits.has(displayDimensionUnit)) {
        quotationPatch.displayDimensionUnit = displayDimensionUnit;
      }
      await quotation.update(quotationPatch);
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

    // Phase 4.9 C-3: snapshot tariff per item when the destination is one we
    // track. Persisted on the QuotationItem so the PDF re-renders identically
    // even if the live TariffRate row is updated or expires after send.
    const destCountry = (quotation.customer?.country || '').toUpperCase().trim();
    if (TARIFF_TRACKED_DESTINATIONS.has(destCountry) && Array.isArray(quotation.items)) {
      const { getCurrentTariff } = require('./tariffRateController');
      const today = new Date().toISOString().slice(0, 10);
      for (const it of quotation.items) {
        const origin = (it.originCountry || '').toUpperCase().trim();
        if (!origin) continue;
        const tariff = await getCurrentTariff(origin, destCountry, quotation.brandCode, today);
        if (!tariff) continue;
        const ratePct = parseFloat(tariff.ratePercent);
        const fob = it.fobPriceUsd != null ? parseFloat(it.fobPriceUsd) : parseFloat(it.unitPrice);
        const qty = parseFloat(it.quantity || 0);
        const landedUnit = +(fob * (1 + ratePct / 100)).toFixed(2);
        const landedTotal = +(landedUnit * qty).toFixed(2);
        await it.update({
          tariffSnapshot: {
            ratePercent: ratePct,
            effectiveUntil: tariff.effectiveUntil,
            sourceTariffRateId: tariff.id,
            sourceNote: tariff.sourceNote || null,
            // Phase 4.9 C-3 follow-up: persist the component breakdown so
            // the PDF can render "here's the 40.7714% stack" instead of
            // an opaque single number, immutable for the document's life.
            components: Array.isArray(tariff.components) ? tariff.components : [],
            snapshottedAt: new Date().toISOString(),
          },
          landedCostUnit: landedUnit,
          landedCostTotal: landedTotal,
        });
      }
    }

    // Phase 3, C9: pass the brand record we already fetched above into the
    // PDF generator so the rendered document matches the email theme.
    // dispatch() will pick the FW variant (ironlite/generic/private_label)
    // from customer.productBrandingMode automatically.
    // Returns { filename, filepath } — keep the legacy response shape by
    // exposing just the filename below.
    const pdfResult = await documentGenerator.generateQuotationPDF(
      quotation,
      quotation.items,
      quotation.customer,
      quotation.salesPerson,
      brand
    );
    const pdfFile = pdfResult.filename;

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

    // Phase 3, C12: lock the customer's productBrandingMode on the FIRST
    // FW quotation sent under that mode. Idempotent (no-op if already
    // locked) and audited. We only lock when the customer actually has a
    // mode set — otherwise the FW PDF rendered with the 'generic' default
    // and there's nothing to freeze.
    if (
      quotation.brandCode === 'FW' &&
      quotation.customer &&
      quotation.customer.productBrandingMode &&
      !quotation.customer.productBrandingModeLockedAt
    ) {
      const lockedAt = new Date();
      await quotation.customer.update({ productBrandingModeLockedAt: lockedAt });
      auditService.logAction(
        req.user.id,
        'product_branding_mode_locked',
        'Customer',
        quotation.customer.id,
        {
          mode: quotation.customer.productBrandingMode,
          privateLabelProductName: quotation.customer.privateLabelProductName,
          lockedAt,
          triggeredBy: { entity: 'Quotation', id: quotation.id, quotationNumber: quotation.quotationNumber },
        },
        req.ip,
      ).catch(() => {});
    }

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

    // Phase 3, C9: brand-aware PDF generation. Fetch the brand once here
    // and pass it through so the renderer doesn't re-query inside dispatch.
    const brand = quotation.brandCode
      ? await db.Brand.findOne({ where: { code: quotation.brandCode, active: true } })
      : null;

    const pdfResult = await documentGenerator.generateQuotationPDF(
      quotation,
      quotation.items,
      quotation.customer,
      quotation.salesPerson,
      brand
    );

    // Phase 3, C9: frontend (quotationsAPI.getPDF) requests responseType:'blob'
    // and creates `new Blob([res.data])` for download. Stream the file as
    // application/pdf so the binary actually reaches the client. The legacy
    // code returned JSON here, which was inconsistent with the frontend
    // contract.
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition',
      `${disposition}; filename="${pdfResult.filename}"`);
    res.sendFile(pdfResult.filepath, (err) => {
      if (err) next(err);
    });
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
