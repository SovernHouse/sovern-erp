/**
 * landedCostWriteService — Phase 4.15b-1.
 *
 * Wraps LandedCostTemplate + LandedCostCalculation models. Mirrors the
 * existing landedCostController.calculate logic so the MCP layer
 * produces the same persisted shape as the REST endpoint.
 *
 * Phase 4.15 spec requires a ProductPrice.validTo expiration check:
 *   "Calculation must respect ProductPrice.validTo — if expired, return
 *    error 'ProductPrice for <origin> expired <date>, refresh required
 *    before quoting.'"
 *
 * Implementation: when an origin is supplied + a current ProductPrice
 * row exists for that (product, origin), validate validTo. If expired
 * (validTo < now), fail with `price_expired`. If no ProductPrice row
 * for this (product, origin), fall through to the supplied productCost
 * — the caller is providing an ad-hoc cost outside the temporal table.
 *
 * Reference number: LCC-YYYYMMDD-NNN, same format as the existing
 * controller via generateNumberWithCounter('LCC', counter).
 */

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../../models');
const { generateNumberWithCounter, incrementCounter } = require('../numberGenerator');

function err(code, httpStatus, message, extra = {}) {
  return { ok: false, code, httpStatus, message, ...extra };
}

// ── createTemplate ────────────────────────────────────────────────────

async function createTemplate(payload, ctx) {
  if (!payload || !payload.name) {
    return err('validation', 400, 'name is required');
  }

  // Uniqueness: model has unique:true on name. Pre-check for a clearer
  // error than the Sequelize constraint violation.
  const existing = await db.LandedCostTemplate.findOne({ where: { name: payload.name } });
  if (existing) {
    return err('validation', 409,
      `LandedCostTemplate with name "${payload.name}" already exists. Use erp_list_landed_cost_templates to find the existing row.`);
  }

  if (payload.supplierId) {
    const factory = await db.Factory.findByPk(payload.supplierId);
    if (!factory) {
      return err('not_found', 404, `Factory ${payload.supplierId} not found.`);
    }
  }

  const template = await db.LandedCostTemplate.create({
    id: uuidv4(),
    name: payload.name,
    description: payload.description || null,
    supplierId: payload.supplierId || null,
    countryOfOrigin: payload.countryOfOrigin || null,
    destinationCountry: payload.destinationCountry || null,
    components: payload.components || {
      productCost: 0, freight: 0, insurance: 0,
      customsDuty: 0, handlingCharges: 0, localDelivery: 0,
    },
    defaultPercentages: payload.defaultPercentages || {
      freightPercent: 5, insurancePercent: 1, customsDutyPercent: 10,
      handlingChargesPercent: 2, localDeliveryPercent: 3,
    },
    currency: payload.currency || 'USD',
    isActive: payload.isActive !== false,
    notes: payload.notes || null,
    createdBy: ctx?.userId || null,
  });

  return { ok: true, template };
}

// ── listTemplates ─────────────────────────────────────────────────────

async function listTemplates(filters) {
  filters = filters || {};
  const where = {};
  if (filters.name) where.name = { [Op.like]: `%${filters.name}%` };
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.countryOfOrigin) where.countryOfOrigin = filters.countryOfOrigin;
  if (filters.destinationCountry) where.destinationCountry = filters.destinationCountry;
  if (filters.activeOnly !== false) where.isActive = true;

  const rows = await db.LandedCostTemplate.findAll({
    where,
    limit: Math.min(filters.limit || 25, 50),
    order: [['name', 'ASC']],
  });
  return { ok: true, templates: rows };
}

// ── persistCalculation ────────────────────────────────────────────────

async function persistCalculation(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const {
    productId, supplierId, quantity, productCost,
    freight = 0, insurance = 0, customsDuty = 0,
    handlingCharges = 0, localDelivery = 0,
    currency = 'USD', exchangeRate = 1,
    purchaseOrderId, templateId, notes, origin,
  } = payload;

  if (!productId) return err('validation', 400, 'productId is required');
  if (!supplierId) return err('validation', 400, 'supplierId is required');
  if (quantity == null || Number(quantity) <= 0) {
    return err('validation', 400, 'quantity must be > 0');
  }
  if (productCost == null) {
    return err('validation', 400, 'productCost is required');
  }

  const product = await db.Product.findByPk(productId);
  if (!product) return err('not_found', 404, `Product ${productId} not found.`);
  const supplier = await db.Factory.findByPk(supplierId);
  if (!supplier) return err('not_found', 404, `Factory ${supplierId} not found.`);

  // ProductPrice.validTo expiration check (Alex's 4.15 spec). Only
  // fires when an origin is supplied — without an origin we don't know
  // which ProductPrice row would govern. ProductPrice has no isActive
  // column; "active" = most recent validFrom whose validTo is null OR
  // in the future. We fetch the most recent row by validFrom DESC and
  // check its validTo directly.
  if (origin) {
    const normOrigin = String(origin).toUpperCase();
    const productPrice = await db.ProductPrice.findOne({
      where: { productId, origin: normOrigin },
      order: [['validFrom', 'DESC']],
    });
    if (productPrice && productPrice.validTo) {
      const expiry = new Date(productPrice.validTo);
      if (expiry < new Date()) {
        return err('price_expired', 400,
          `ProductPrice for ${product.sku} origin=${normOrigin} expired ${expiry.toISOString().slice(0, 10)}. Refresh required before quoting — use erp_create_product_price to publish a new temporal row.`);
      }
    }
  }

  // Reference number: LCC-YYYYMMDD-NNN (matches controller convention).
  const last = await db.LandedCostCalculation.findOne({ order: [['createdAt', 'DESC']] });
  const counter = incrementCounter(last?.referenceNumber);
  const referenceNumber = generateNumberWithCounter('LCC', counter);

  // Compute totals exactly the same way the REST controller does.
  const qty = parseFloat(quantity);
  const totalProductCost = parseFloat(productCost) * qty;
  const totalFreight = parseFloat(freight);
  const totalInsurance = parseFloat(insurance);
  const totalCustomsDuty = parseFloat(customsDuty);
  const totalHandling = parseFloat(handlingCharges);
  const totalLocalDelivery = parseFloat(localDelivery);
  const totalLandedCost =
    totalProductCost + totalFreight + totalInsurance +
    totalCustomsDuty + totalHandling + totalLocalDelivery;
  const costPerUnit = totalLandedCost / qty;

  const calc = await db.LandedCostCalculation.create({
    id: uuidv4(),
    referenceNumber,
    productId,
    supplierId,
    quantity: qty,
    unit: product.unit || 'PCS',
    productCost: parseFloat(productCost),
    freight: totalFreight,
    insurance: totalInsurance,
    customsDuty: totalCustomsDuty,
    handlingCharges: totalHandling,
    localDelivery: totalLocalDelivery,
    totalLandedCost,
    costPerUnit,
    currency,
    exchangeRate: parseFloat(exchangeRate),
    purchaseOrderId: purchaseOrderId || null,
    templateId: templateId || null,
    notes: notes || null,
  });

  return { ok: true, calculation: calc, product, supplier };
}

// ── listCalculations ──────────────────────────────────────────────────

async function listCalculations(filters) {
  filters = filters || {};
  const where = {};
  if (filters.productId) where.productId = filters.productId;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.purchaseOrderId) where.purchaseOrderId = filters.purchaseOrderId;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt[Op.gte] = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt[Op.lte] = new Date(filters.dateTo);
  }
  if (filters.search) {
    where.referenceNumber = { [Op.like]: `%${filters.search}%` };
  }

  // No `include` — LandedCostCalculation has no defined `as: 'product'`
  // / `as: 'supplier'` associations in models/index.js (the existing
  // controller has the same gap; callers fetch Product/Factory separately).
  const rows = await db.LandedCostCalculation.findAll({
    where,
    limit: Math.min(filters.limit || 25, 100),
    order: [['createdAt', 'DESC']],
  });
  return { ok: true, calculations: rows };
}

// ── getCalculation ────────────────────────────────────────────────────

async function getCalculation(id) {
  if (!id) return err('validation', 400, 'id is required');
  // No `include` for the reasons documented in listCalculations.
  const calc = await db.LandedCostCalculation.findByPk(id);
  if (!calc) return err('not_found', 404, `LandedCostCalculation ${id} not found.`);
  return { ok: true, calculation: calc };
}

module.exports = {
  createTemplate,
  listTemplates,
  persistCalculation,
  listCalculations,
  getCalculation,
};
