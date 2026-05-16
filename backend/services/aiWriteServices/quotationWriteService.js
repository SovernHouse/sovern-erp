/**
 * quotationWriteService — Phase 4.12.
 *
 * Shared service for Quotation create. Mirrors quotationController.create
 * so the MCP create_quotation tool inherits sanctions screening (L-013),
 * brand-scope enforcement, the ProductPrice floor check, origin/FOB
 * resolution from Product.originVariants, and the commission-floor
 * validation — none of which the MCP handler did before Phase 4.12.
 *
 * Returns the same { ok, quotation?, autoAddedBrand?, code, httpStatus,
 * message, sanctionsBlock? } envelope as leadWriteService.
 *
 * Payload is camelCase and matches the REST request body:
 *   { customerId, items: [{ productId, quantity, unitPrice, ... }],
 *     inquiryId?, salesPersonId?, factoryId?, leadId?, brandCode?,
 *     commissionRateOverride?, discount?, discountType?, taxRate?, terms?,
 *     displayAreaUnit?, displayDimensionUnit?, validDays? }
 *
 * MCP callers do their own arg-shaping (snake_case → camelCase, and the
 * MCP-only lead→customer auto-conversion if lead_id is supplied without
 * a converted customer) before invoking this service.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../../models');
const auditService = require('../auditService');
const { validateFinancials } = require('../../utils/validateFinancials');
const { generateNumberWithCounter, incrementCounter } = require('../numberGenerator');
const { addBrandIfMissing } = require('../crossBrandAutoAdd');

function err(code, httpStatus, message, extra = {}) {
  return { ok: false, code, httpStatus, message, ...extra };
}

async function createQuotation(payload, ctx) {
  const { userId, brandScope, ip, source } = ctx || {};
  const callerRole = ctx?.role || null;

  if (brandScope && brandScope.isCrossBrand) {
    return err('cross_brand_mode', 403,
      'All Brands view is read-only. Switch to SH or FW to make changes.');
  }

  try {
    validateFinancials(payload);
  } catch (e) {
    return err('validation', 400, e.message);
  }

  const {
    customerId, inquiryId, salesPersonId, items, discount, discountType,
    taxRate, terms, factoryId, leadId, brandCode, commissionRateOverride,
    displayAreaUnit, displayDimensionUnit, validDays,
  } = payload || {};

  if (!customerId) {
    return err('validation', 400, 'customerId is required');
  }
  if (!Array.isArray(items) || items.length === 0) {
    return err('validation', 400, 'items array is required');
  }

  const customer = await db.Customer.findByPk(customerId);
  if (!customer) {
    return err('not_found', 404, 'Customer not found');
  }

  if (customer.screeningStatus === 'flagged') {
    auditService.logAction(
      userId || null,
      'sanctions_block',
      'Customer',
      customer.id,
      {
        context: 'quotation_create',
        companyName: customer.companyName,
        reason: customer.sanctionBlockReason,
        hits: customer.sanctionsScreenDetails,
        source: source || 'unknown',
      },
      ip || null,
    ).catch(() => {});
    return err(
      'sanctions_block',
      403,
      `Customer "${customer.companyName}" is on a sanctions list. Reason: ${customer.sanctionBlockReason || 'flagged'}. Super-admin override required.`,
      {
        sanctionsBlock: {
          status: customer.screeningStatus,
          customerId: customer.id,
          hits: customer.sanctionsScreenDetails,
        },
      },
    );
  }

  const resolvedBrandCode = brandCode || brandScope?.defaultBrand || 'SH';

  let resolvedOverride = null;
  if (commissionRateOverride != null && commissionRateOverride !== '') {
    const rate = parseFloat(commissionRateOverride);
    if (!Number.isFinite(rate)) {
      return err('validation', 400, 'commissionRateOverride must be a number');
    }
    const { COMMISSION_FLOOR_DECIMAL } = require('../commissionAccrual');
    if (rate < COMMISSION_FLOOR_DECIMAL) {
      return err('validation', 400,
        `commissionRateOverride must be >= ${COMMISSION_FLOOR_DECIMAL} (5% floor)`);
    }
    if (rate > 1) {
      return err('validation', 400,
        'commissionRateOverride must be a decimal between 0 and 1 (e.g. 0.07 = 7%)');
    }
    resolvedOverride = rate;
  }

  const lastQuotation = await db.Quotation.findOne({ order: [['createdAt', 'DESC']] });
  const counter = incrementCounter(lastQuotation?.quotationNumber);
  const quotationNumber = generateNumberWithCounter(
    process.env.DOC_PREFIX_QUOTATION || 'QOT', counter,
  );

  let subtotal = 0;
  const createdItems = [];
  const { getCurrentPrice } = require('../productPriceService');

  for (const item of items) {
    const product = await db.Product.findByPk(item.productId);
    if (!product) continue;

    if (product.brandCode && product.brandCode !== resolvedBrandCode) {
      return err('validation', 400,
        `Product ${product.sku} belongs to brand ${product.brandCode}; cannot quote under ${resolvedBrandCode}.`);
    }

    const reqOriginRaw = (item.originCountry || '').toUpperCase().trim();
    const lineOrigin = reqOriginRaw
      || (product.originCountry || '').toUpperCase().trim()
      || null;
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
        const isSuperAdmin = callerRole === 'super_admin';
        if (!isSuperAdmin) {
          return err('validation', 400,
            `Unit price ${unitPrice} for ${product.sku} is below floor ${floor.toFixed(2)}. Super-admin override required.`);
        }
        const reason = (item.belowFloorReason || '').trim();
        if (reason.length < 5) {
          return err('validation', 400,
            `belowFloorReason (>= 5 chars) is required when quoting ${product.sku} below floor ${floor.toFixed(2)}.`);
        }
        auditService.logAction(
          userId || null,
          'product_floor_override',
          'Product',
          product.id,
          { sku: product.sku, floor, quotedPrice: parseFloat(unitPrice), reason, source: currentPrice ? 'ProductPrice' : 'baseFobPriceFallback' },
          ip || null,
        ).catch(() => {});
      }
    }

    const lineTotal = item.quantity * unitPrice;
    subtotal += lineTotal;

    let resolvedOrigin = null;
    let resolvedFobUsd = null;
    if (reqOriginRaw) {
      const variants = Array.isArray(product.originVariants) ? product.originVariants : [];
      const match = variants.find(v => (v.originCountry || '').toUpperCase() === reqOriginRaw);
      if (match && match.fobPriceUsd != null) {
        resolvedOrigin = reqOriginRaw;
        resolvedFobUsd = parseFloat(match.fobPriceUsd);
      } else {
        resolvedOrigin = reqOriginRaw;
        resolvedFobUsd = parseFloat(unitPrice);
      }
    } else {
      resolvedOrigin = (product.originCountry || '').toUpperCase() || null;
      resolvedFobUsd = parseFloat(unitPrice);
    }

    createdItems.push({
      id: uuidv4(),
      productId: item.productId,
      description: item.description || product.name,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice,
      discount: item.discount || 0,
      total: lineTotal,
      notes: item.notes || '',
      originCountry: resolvedOrigin,
      fobPriceUsd: resolvedFobUsd,
      tariffSnapshot: null,
      landedCostUnit: null,
      landedCostTotal: null,
    });
  }

  const discountAmount = discountType === 'percentage'
    ? (subtotal * (discount || 0)) / 100
    : (discount || 0);
  const afterDiscount = subtotal - discountAmount;
  const tax = (afterDiscount * (taxRate || 0)) / 100;
  const total = afterDiscount + tax;

  const validAreaUnits = new Set(['sqm', 'sqft']);
  const validDimUnits = new Set(['mm', 'inch']);
  const resolvedAreaUnit = validAreaUnits.has(displayAreaUnit) ? displayAreaUnit : 'sqm';
  const resolvedDimUnit = validDimUnits.has(displayDimensionUnit) ? displayDimensionUnit : 'mm';

  const validityDays = parseInt(validDays || 30, 10);
  const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

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
    validUntil,
    terms: terms || null,
    displayAreaUnit: resolvedAreaUnit,
    displayDimensionUnit: resolvedDimUnit,
  });

  await Promise.all(createdItems.map(it =>
    db.QuotationItem.create({ ...it, quotationId: quotation.id }),
  ));

  const result = await db.Quotation.findByPk(quotation.id, {
    include: [
      { association: 'items', include: [{ model: db.Product, as: 'product' }] },
      { model: db.Customer, as: 'customer' },
      { model: db.User, as: 'salesPerson' },
      { model: db.Factory, as: 'factory', attributes: ['id', 'companyName', 'country'] },
      { model: db.Lead, as: 'lead', attributes: ['id', 'companyName', 'contactName'] },
    ],
  });

  let autoAddedBrand = null;
  try {
    autoAddedBrand = await addBrandIfMissing(db, customerId, resolvedBrandCode, {
      userId: userId || null,
      entity: 'Quotation',
      entityId: quotation.id,
      ip: ip || null,
    });
  } catch (_) { /* never block the create */ }

  auditService.logAction(
    userId || null,
    'CREATE',
    'Quotation',
    quotation.id,
    { source: source || 'unknown', data: result?.toJSON?.() || quotation.toJSON() },
    ip || null,
  ).catch(() => {});

  return { ok: true, quotation: result, autoAddedBrand };
}

// ── Phase 4.15a: Quotation update + archive (CRUD completion) ─────────

/**
 * updateQuotation — Phase 4.15a.
 *
 * Patches a draft Quotation. Hard-blocks updates on quotations whose
 * status has moved past 'draft' (sent / accepted / rejected) — once
 * sent to a buyer, edits go through a new revision, not in-place
 * mutation. brandCode is immutable here (mirrors leadWriteService);
 * brand changes flow through the super-admin override path.
 */
async function updateQuotation(id, patch, ctx) {
  const { brandScope } = ctx || {};
  if (brandScope && brandScope.isCrossBrand) {
    return err('cross_brand_mode', 403, 'All Brands view is read-only. Switch to SH or FW to make changes.');
  }
  const quotation = await db.Quotation.findByPk(id);
  if (!quotation) return err('not_found', 404, 'Quotation not found');

  if (brandScope
      && !brandScope.isCrossBrand
      && Array.isArray(brandScope.accessibleBrands)
      && !brandScope.accessibleBrands.includes(quotation.brandCode)) {
    return err('not_found', 404, 'Quotation not found');
  }

  if (quotation.status && quotation.status !== 'draft') {
    return err('validation', 400,
      `Quotation ${quotation.quotationNumber} is in status "${quotation.status}"; only draft quotations are editable. Create a revision instead.`);
  }

  // brandCode is immutable on the standard update path (mirrors leadWriteService).
  const { brandCode: _ignored, id: _idIgnored, quotationNumber: _qnIgnored, ...allowed } = patch || {};

  const before = quotation.toJSON();
  await quotation.update(allowed);
  return { ok: true, quotation, before, after: quotation.toJSON() };
}

/**
 * archiveQuotation — Phase 4.15a. Soft-delete via the existing paranoid
 * model behavior. Same brand-scope check as update.
 */
async function archiveQuotation(id, ctx) {
  const { brandScope } = ctx || {};
  if (brandScope && brandScope.isCrossBrand) {
    return err('cross_brand_mode', 403, 'All Brands view is read-only. Switch to SH or FW to make changes.');
  }
  const quotation = await db.Quotation.findByPk(id);
  if (!quotation) return err('not_found', 404, 'Quotation not found');

  if (brandScope
      && !brandScope.isCrossBrand
      && Array.isArray(brandScope.accessibleBrands)
      && !brandScope.accessibleBrands.includes(quotation.brandCode)) {
    return err('not_found', 404, 'Quotation not found');
  }

  const snapshot = quotation.toJSON();
  await quotation.destroy();  // paranoid: sets deletedAt
  return { ok: true, deleted: snapshot };
}

module.exports = {
  createQuotation,
  updateQuotation,
  archiveQuotation,
};
