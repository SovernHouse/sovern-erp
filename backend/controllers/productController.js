const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const { assertBrandWritable } = require('../middleware/brandScope');
const { isAccessibleByBrandCode } = require('../utils/notFoundOnWrongBrand');
const auditService = require('../services/auditService');

const create = async (req, res, next) => {
  try {
    const {
      name, sku, description, salesDescription, purchaseDescription,
      categoryId, factoryId, unit, specifications, images,
      minOrderQty, weight, hsCode,
      // Phase 4, C14: new brand-aware catalog fields
      productType, baseFobPrice, currency, moqUnit, leadTimeDays,
      certifications, originCountry,
      // Phase 4.9 C-1: multi-origin pricing
      originVariants,
    } = req.body;

    // Phase 4, C14: resolve brand (body wins, else user defaultBrand, else 'SH').
    const resolvedBrandCode = req.body.brandCode || req.brandScope?.defaultBrand || 'SH';
    if (!assertBrandWritable(req, res, resolvedBrandCode)) return;

    // SKU stays globally unique (legacy column-level UNIQUE on the table).
    // Plan deviation documented in the model. Brand-prefixed SKUs (FW-*/SH-*)
    // avoid collisions in practice.
    const existingSku = await db.Product.findOne({ where: { sku } });
    if (existingSku) {
      throw new ValidationError('SKU already exists');
    }

    const category = await db.ProductCategory.findByPk(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const factory = await db.Factory.findByPk(factoryId);
    if (!factory) {
      throw new NotFoundError('Factory not found');
    }

    const product = await db.Product.create({
      id: uuidv4(),
      name,
      sku,
      description,
      salesDescription,
      purchaseDescription,
      categoryId,
      factoryId,
      unit: unit || 'sqm',
      specifications: specifications || {},
      images: images || [],
      minOrderQty: minOrderQty || 1,
      weight,
      hsCode,
      isActive: true,
      // Phase 4, C14
      brandCode: resolvedBrandCode,
      productType: productType || null,
      baseFobPrice: baseFobPrice != null ? baseFobPrice : null,
      currency: currency || 'USD',
      moqUnit: moqUnit || null,
      leadTimeDays: leadTimeDays != null ? leadTimeDays : null,
      certifications: certifications || [],
      originCountry: originCountry || null,
      originVariants: Array.isArray(originVariants) ? originVariants : [],
    });

    const result = await db.Product.findByPk(product.id, {
      include: [
        { model: db.ProductCategory, as: 'category' },
        { model: db.Factory, as: 'factory' },
        { model: db.ProductPrice, as: 'prices' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Product created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Product', product.id, { data: result?.toJSON?.() || product.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, categoryId, factoryId, status, productType } = req.query;
    const { offset } = getPagination(page, limit);

    // Phase 4, C14: brand-scope every list response. brandWhere() returns
    // the partial where clause for the user's accessibleBrands (or the
    // ?brandCode override for multi-brand users).
    const { brandWhere } = require('../utils/brandFilterUtils');
    const where = { ...brandWhere(req), deletedAt: null };
    if (status) where.isActive = status === 'active';
    if (categoryId) where.categoryId = categoryId;
    if (factoryId) where.factoryId = factoryId;
    if (productType) where.productType = productType;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } }
      ];
    }

    // PERF: split count from data fetch.
    const [count, rows] = await Promise.all([
      db.Product.count({ where }),
      db.Product.findAll({
        where,
        include: [
          { model: db.ProductCategory, as: 'category' },
          { model: db.Factory, as: 'factory' },
          // Phase 4.9.2b renamed sellingPrice → sellingPriceUsdPerM2 on
          // ProductPrice. The legacy field on the controller include
          // returned 500 against the post-rename schema (no such column
          // sellingPrice). Phase 4.19 emergency: switched to the real
          // column name + included costPriceUsdPerM2 + the temporal window
          // fields so the list response remains usable on the catalog UI.
          { model: db.ProductPrice, as: 'prices', attributes: ['id', 'sellingPriceUsdPerM2', 'costPriceUsdPerM2', 'currency', 'origin', 'factoryId', 'validFrom', 'validTo'] }
        ],
        offset,
        limit: parseInt(limit),
        order: [['name', 'ASC']]
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
    const product = await db.Product.findByPk(id, {
      include: [
        { model: db.ProductCategory, as: 'category' },
        { model: db.Factory, as: 'factory' },
        { model: db.ProductPrice, as: 'prices' }
      ]
    });

    if (!product || product.deletedAt) {
      throw new NotFoundError('Product not found');
    }

    // Phase 4, C14: 404-on-wrong-brand. Don't leak existence outside the
    // user's accessible brands.
    if (!isAccessibleByBrandCode(req, product.brandCode)) {
      throw new NotFoundError('Product not found');
    }

    res.json(getSuccessResponse(product));
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name, description, salesDescription, purchaseDescription,
      unit, specifications, images, minOrderQty, weight, hsCode, isActive,
      // Phase 4, C14 — accept new fields. brandCode is NOT editable here
      // (use /admin/brand-override for that flow).
      productType, baseFobPrice, currency, moqUnit, leadTimeDays,
      certifications, originCountry,
      // Phase 4.9 C-1
      originVariants,
    } = req.body;

    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) {
      throw new NotFoundError('Product not found');
    }

    // Phase 4, C14: 404-on-wrong-brand on writes too — same as get-by-id.
    if (!isAccessibleByBrandCode(req, product.brandCode)) {
      throw new NotFoundError('Product not found');
    }
    if (!assertBrandWritable(req, res, product.brandCode)) return;

    const beforeSnapshot = product.toJSON();

    await product.update({
      name: name || product.name,
      description: description !== undefined ? description : product.description,
      salesDescription: salesDescription !== undefined ? salesDescription : product.salesDescription,
      purchaseDescription: purchaseDescription !== undefined ? purchaseDescription : product.purchaseDescription,
      unit: unit || product.unit,
      specifications: specifications || product.specifications,
      images: images || product.images,
      minOrderQty: minOrderQty !== undefined ? minOrderQty : product.minOrderQty,
      weight: weight !== undefined ? weight : product.weight,
      hsCode: hsCode !== undefined ? hsCode : product.hsCode,
      isActive: isActive !== undefined ? isActive : product.isActive,
      // Phase 4, C14
      productType: productType !== undefined ? productType : product.productType,
      baseFobPrice: baseFobPrice !== undefined ? baseFobPrice : product.baseFobPrice,
      currency: currency || product.currency,
      moqUnit: moqUnit !== undefined ? moqUnit : product.moqUnit,
      leadTimeDays: leadTimeDays !== undefined ? leadTimeDays : product.leadTimeDays,
      certifications: certifications !== undefined ? certifications : product.certifications,
      originCountry: originCountry !== undefined ? originCountry : product.originCountry,
      originVariants: Array.isArray(originVariants) ? originVariants : product.originVariants,
    });

    const result = await db.Product.findByPk(id, {
      include: [
        { model: db.ProductCategory, as: 'category' },
        { model: db.Factory, as: 'factory' }
      ]
    });

    res.json(getSuccessResponse(result, 'Product updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Product', id, { before: beforeSnapshot, after: result?.toJSON?.() || product.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getByCategory = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const category = await db.ProductCategory.findByPk(categoryId);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // PERF: split count from data fetch.
    const [count, rows] = await Promise.all([
      db.Product.count({ where: { categoryId, deletedAt: null } }),
      db.Product.findAll({
        where: { categoryId, deletedAt: null },
        include: [
          { model: db.Factory, as: 'factory' },
          { model: db.ProductPrice, as: 'prices' }
        ],
        offset,
        limit: parseInt(limit),
        order: [['name', 'ASC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

const createPrice = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Phase 4.9.2b: new shape. At least one of factoryId / origin
    // required. Cost is per m² explicit; sqft computed at read time.
    const {
      factoryId, origin,
      costPriceUsdPerM2, sellingPriceUsdPerM2, markupPercent,
      currency, tariffRate, tariffDestination,
      validFrom, validTo, sourceNote,
    } = req.body;

    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) throw new NotFoundError('Product not found');

    if (!factoryId && !origin) {
      throw new ValidationError('At least one of factoryId or origin is required');
    }
    if (factoryId) {
      const factory = await db.Factory.findByPk(factoryId);
      if (!factory) throw new NotFoundError('Factory not found');
    }
    if (costPriceUsdPerM2 == null || isNaN(parseFloat(costPriceUsdPerM2))) {
      throw new ValidationError('costPriceUsdPerM2 is required');
    }

    const price = await db.ProductPrice.create({
      id: uuidv4(),
      productId: id,
      factoryId: factoryId || null,
      origin: origin || null,
      costPriceUsdPerM2: parseFloat(costPriceUsdPerM2),
      sellingPriceUsdPerM2: sellingPriceUsdPerM2 != null ? parseFloat(sellingPriceUsdPerM2) : null,
      markupPercent: markupPercent != null ? parseFloat(markupPercent) : null,
      currency: currency || 'USD',
      tariffRate: tariffRate != null ? parseFloat(tariffRate) : null,
      tariffDestination: tariffDestination || null,
      validFrom: validFrom || new Date().toISOString().slice(0, 10),
      validTo: validTo || null,
      sourceNote: sourceNote || null,
      createdBy: req.user?.id || null,
    });

    const result = await db.ProductPrice.findByPk(price.id, {
      include: [{ model: db.Factory, as: 'factory', attributes: ['id', 'companyName'], required: false }],
    });

    res.status(201).json(getSuccessResponse(result, 'Price added successfully'));
    auditService.logAction(req.user.id, 'CREATE', 'ProductPrice', price.id, { productId: id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const updatePrice = async (req, res, next) => {
  try {
    const { id, priceId } = req.params;
    const {
      factoryId, origin,
      costPriceUsdPerM2, sellingPriceUsdPerM2, markupPercent,
      currency, tariffRate, tariffDestination,
      validTo, sourceNote,
    } = req.body;

    const price = await db.ProductPrice.findOne({ where: { id: priceId, productId: id } });
    if (!price) throw new NotFoundError('Price record not found');

    const patch = {};
    if (factoryId !== undefined)             patch.factoryId = factoryId || null;
    if (origin !== undefined)                patch.origin = origin || null;
    if (costPriceUsdPerM2 !== undefined)     patch.costPriceUsdPerM2 = parseFloat(costPriceUsdPerM2);
    if (sellingPriceUsdPerM2 !== undefined)  patch.sellingPriceUsdPerM2 = sellingPriceUsdPerM2 == null ? null : parseFloat(sellingPriceUsdPerM2);
    if (markupPercent !== undefined)         patch.markupPercent = markupPercent == null ? null : parseFloat(markupPercent);
    if (currency !== undefined)              patch.currency = currency;
    if (tariffRate !== undefined)            patch.tariffRate = tariffRate == null ? null : parseFloat(tariffRate);
    if (tariffDestination !== undefined)     patch.tariffDestination = tariffDestination || null;
    if (validTo !== undefined)               patch.validTo = validTo || null;
    if (sourceNote !== undefined)            patch.sourceNote = sourceNote || null;

    await price.update(patch);

    const result = await db.ProductPrice.findByPk(priceId, {
      include: [{ model: db.Factory, as: 'factory', attributes: ['id', 'companyName'], required: false }],
    });

    res.json(getSuccessResponse(result, 'Price updated successfully'));
    auditService.logAction(req.user.id, 'UPDATE', 'ProductPrice', priceId, { productId: id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const deletePrice = async (req, res, next) => {
  try {
    const { id, priceId } = req.params;
    const price = await db.ProductPrice.findOne({ where: { id: priceId, productId: id } });
    if (!price) throw new NotFoundError('Price record not found');

    await price.destroy();
    res.json(getSuccessResponse({ id: priceId }, 'Price deleted successfully'));
    auditService.logAction(req.user.id, 'DELETE', 'ProductPrice', priceId, { productId: id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getPriceHistory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) {
      throw new NotFoundError('Product not found');
    }

    const prices = await db.ProductPrice.findAll({
      where: { productId: id },
      include: [{ model: db.Factory, as: 'factory', attributes: ['companyName'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(prices));
  } catch (error) {
    next(error);
  }
};

const search = async (req, res, next) => {
  try {
    const { q, categoryId, factoryId } = req.query;

    const where = { deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    if (factoryId) where.factoryId = factoryId;
    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${q}%` } },
        { sku: { [Op.like]: `%${q}%` } },
        { description: { [Op.like]: `%${q}%` } }
      ];
    }

    const products = await db.Product.findAll({
      where,
      include: [
        { model: db.ProductPrice, as: 'prices', limit: 1, separate: true }
      ],
      limit: 20
    });

    res.json(getSuccessResponse(products));
  } catch (error) {
    next(error);
  }
};

const bulkUpdate = async (req, res, next) => {
  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      throw new ValidationError('Products array is required and must not be empty');
    }

    const updates = [];
    for (const product of products) {
      if (!product.id) {
        throw new ValidationError('Each product must have an id');
      }

      // Verify product exists and is not deleted
      const existingProduct = await db.Product.findByPk(product.id);
      if (!existingProduct || existingProduct.deletedAt) {
        throw new NotFoundError(`Product ${product.id} not found`);
      }

      const updated = await db.Product.update(product, { where: { id: product.id } });
      updates.push({
        id: product.id,
        status: 'updated'
      });
    }

    res.json(getSuccessResponse(updates, `${products.length} products updated successfully`));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'BULK_UPDATE', 'Product', 'batch', { count: products.length, productIds: products.map(p => p.id) }, null).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const softDelete = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await db.Product.findByPk(id);

    if (!product || product.deletedAt) {
      throw new NotFoundError('Product not found');
    }

    const beforeSnapshot = product.toJSON();

    await product.update({ deletedAt: new Date() });

    res.json(getSuccessResponse({ id: product.id }, 'Product deleted'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Product', id, { before: beforeSnapshot }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

// Phase 4.9.5: REST wrapper around services/productPriceService.getCurrentPrice.
// External callers (mobile, integrations, future read-side migrations) hit
// this instead of reading the Product.baseFobPrice cache column directly.
const getCurrentPriceEndpoint = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) throw new NotFoundError('Product not found');

    const { getCurrentPrice } = require('../services/productPriceService');
    const origin = (req.query.origin || product.originCountry || null) || null;
    const asOfDate = req.query.asOfDate || null;
    const current = await getCurrentPrice(id, origin, asOfDate);
    if (!current) {
      return res.json(getSuccessResponse(null, `No active ProductPrice row for ${product.sku || product.name}${origin ? ` (origin=${origin})` : ''}.`));
    }
    res.json(getSuccessResponse(current, 'Current price'));
  } catch (err) {
    next(err);
  }
};

// ── Phase 4.17 — Product approval workflow ──────────────────────────────────
//
// Three actions a super_admin can take on a Product that the AI assistant
// created in pending state (or any Product flagged for review):
//
//   approve         → isActive=true + cascade ProductPrice.isActive=true
//                      + mark the ScheduledActivity as done with the
//                      reviewer's comment in completedNote.
//   reject          → soft-delete the Product + cancel the activity. The
//                      reviewer's reason goes to completedNote on the
//                      cancelled activity. Cascades isActive=false on
//                      ProductPrice so the row can't be quoted from.
//   requestRevision → keep the Product inactive, mark the activity as
//                      done (with reviewer comment), spawn a follow-up
//                      ScheduledActivity (type='follow_up') assigned to
//                      whoever originally requested the create (the AI
//                      session user) so the comment loops back to the
//                      author for a second-pass edit.
//
// All three are super_admin-gated and audit-logged via auditService.
// The shared updateActivityFor() helper keeps the ScheduledActivity
// state-machine consistent so the dashboard activity banner clears
// correctly without manual dismiss.

async function updateActivityFor(productId, finalStatus, reviewerNote, reviewerId) {
  const where = {
    entityType: 'Product',
    entityId:   productId,
    type:       'approve',
    status:     'pending',
  };
  const [rowCount] = await db.ScheduledActivity.update(
    {
      status:        finalStatus,
      completedAt:   new Date(),
      completedNote: reviewerNote || (finalStatus === 'done' ? 'Approved' : 'Rejected'),
    },
    { where }
  );
  return rowCount;
}

const approve = async (req, res, next) => {
  try {
    const { id } = req.params;
    const note = (req.body && req.body.note) ? String(req.body.note).slice(0, 1000) : null;
    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) throw new NotFoundError('Product not found');

    const wasActive = product.isActive;
    await product.update({ isActive: true });

    // No price-cascade needed: ProductPrice uses temporal validTo, not
    // an isActive boolean. A price becomes quotable on the catalog when
    // its Product is active AND its validFrom/validTo window includes
    // today. Flipping Product.isActive is the only state change required.
    const pricesAffected = await db.ProductPrice.count({ where: { productId: id } });

    const activityRowsTouched = await updateActivityFor(id, 'done', note || 'Approved', req.user.id);

    res.json(getSuccessResponse({
      productId: id,
      sku:       product.sku,
      wasActive,
      pricesAffected,
      activitiesClosed: activityRowsTouched,
    }, `Product "${product.name}" approved`));

    auditService.logAction(
      req.user.id,
      'product_approve',
      'Product',
      id,
      { sku: product.sku, wasActive, pricesAffected, note },
      req.ip
    ).catch(() => {});
  } catch (err) {
    next(err);
  }
};

const reject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const reason = (req.body && req.body.reason) ? String(req.body.reason).slice(0, 1000) : null;
    if (!reason || !reason.trim()) {
      return res.status(400).json(getSuccessResponse({}, 'reason is required when rejecting a product'));
    }
    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) throw new NotFoundError('Product not found');

    const beforeSnapshot = product.toJSON();

    // Cascade: close any open ProductPrice windows by setting validTo
    // to today. Temporal-pricing model (Phase 4.9.2b) — there is no
    // isActive column on ProductPrice; the window is the source of
    // truth. validate:false skips the beforeValidate(factoryId|origin)
    // hook which fires on bulk payloads even when we're not touching
    // those columns.
    const today = new Date().toISOString().slice(0, 10);
    await db.ProductPrice.update(
      { validTo: today },
      {
        where: {
          productId: id,
          [require('sequelize').Op.or]: [
            { validTo: null },
            { validTo: { [require('sequelize').Op.gt]: today } },
          ],
        },
        validate: false,
      }
    );

    await product.update({ isActive: false, deletedAt: new Date() });

    const activityRowsTouched = await updateActivityFor(id, 'cancelled', `Rejected: ${reason}`, req.user.id);

    res.json(getSuccessResponse({
      productId: id,
      sku:       product.sku,
      activitiesCancelled: activityRowsTouched,
    }, `Product "${product.name}" rejected`));

    auditService.logAction(
      req.user.id,
      'product_reject',
      'Product',
      id,
      { sku: product.sku, before: beforeSnapshot, reason },
      req.ip
    ).catch(() => {});
  } catch (err) {
    next(err);
  }
};

const requestRevision = async (req, res, next) => {
  try {
    const { id } = req.params;
    const comment = (req.body && req.body.comment) ? String(req.body.comment).slice(0, 1000) : null;
    if (!comment || !comment.trim()) {
      return res.status(400).json(getSuccessResponse({}, 'comment is required when requesting a revision'));
    }
    const product = await db.Product.findByPk(id);
    if (!product || product.deletedAt) throw new NotFoundError('Product not found');

    // Close the existing approval activity with the reviewer's comment so
    // it clears off the dashboard banner.
    const closedCount = await updateActivityFor(id, 'done', `Revision requested: ${comment}`, req.user.id);

    // Look up the most recent existing approve-activity on this product
    // so we can route the follow-up back to the user who scheduled the
    // original create (typically the AI session user). Fallback to the
    // current reviewer when no prior activity exists.
    const existing = await db.ScheduledActivity.findOne({
      where: { entityType: 'Product', entityId: id, type: 'approve' },
      order: [['createdAt', 'DESC']],
    });
    const followUpAssignee = existing?.assignedById || req.user.id;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const followUp = await db.ScheduledActivity.create({
      type:         'follow_up',
      entityType:   'Product',
      entityId:     id,
      entityLabel:  `${product.name} (${product.sku}) — REVISION requested`,
      assignedToId: followUpAssignee,
      assignedById: req.user.id,
      dueDate:      tomorrow.toISOString().slice(0, 10),
      priority:     'high',
      note:         `Reviewer requested a revision on ${product.name} (${product.sku}):\n\n"${comment}"\n\nUpdate the Product, then schedule a new "approve" activity for super_admin to re-review.`,
      status:       'pending',
    });

    res.json(getSuccessResponse({
      productId: id,
      sku:       product.sku,
      closedActivities: closedCount,
      followUpActivityId: followUp.id,
      followUpAssignee,
    }, `Revision requested for "${product.name}"`));

    auditService.logAction(
      req.user.id,
      'product_request_revision',
      'Product',
      id,
      { sku: product.sku, comment, followUpActivityId: followUp.id, followUpAssignee },
      req.ip
    ).catch(() => {});
  } catch (err) {
    next(err);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  update,
  getByCategory,
  createPrice,
  updatePrice,
  deletePrice,
  getPriceHistory,
  search,
  bulkUpdate,
  softDelete,
  getCurrentPriceEndpoint,
  approve,
  reject,
  requestRevision,
};
