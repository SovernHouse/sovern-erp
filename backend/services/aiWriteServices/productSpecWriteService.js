/**
 * productSpecWriteService — Phase 4.15d-2a.
 *
 * Wraps the ProductSpecification model. The model is a TYPED WIDE-TABLE
 * (one row per Product, ~30 named columns covering flooringType,
 * dimensions, performance ratings, surface, wood specifics,
 * installation, packaging, warranty, certifications, origin). NOT the
 * attribute-value shape Alex's original 4.15d spec assumed — adapted
 * here to the schema reality.
 *
 * Single source of truth per product: `ProductSpecification.productId`
 * has a unique index. There is at most one spec row per product. The
 * MCP `upsert` is the natural shape — if the row exists, patch it;
 * otherwise create. No separate create / update path.
 *
 * QA lookup: takes a question shape `{ product_id_or_sku, attribute }`
 * and returns the value (or 'not yet recorded'). Attribute name is
 * normalised through an alias map ("AC rating" → acRating, "wear
 * layer" → wearLayerThickness or wearLayerMil, etc) so the AI can
 * pass user-friendly field names from chat.
 *
 * Search: walks the string-typed columns + checks for case-insensitive
 * `LIKE %q%` matches. Returns up to 25 rows with the matched product
 * + the matched attribute(s) for the AI to render.
 *
 * Brand scope: ProductSpecification has no brandCode. Brand check
 * goes through the joined Product.brandCode. Cross-brand reads are
 * allowed (specs are knowledge-base); writes follow the requester's
 * access via the Product they're attached to.
 */

const { Op } = require('sequelize');
const db = require('../../models');

function err(code, httpStatus, message, extra = {}) {
  return { ok: false, code, httpStatus, message, ...extra };
}

// Whitelisted columns the upsert accepts. Anything outside this set is
// silently dropped — matches the Phase 4.12 pattern.
const WRITABLE_FIELDS = new Set([
  'flooringType', 'coreType', 'construction',
  'length', 'width', 'thickness', 'wearLayerThickness', 'wearLayerMil',
  'acRating', 'waterproof', 'fireRating', 'slipRating',
  'surfaceFinish', 'surfaceTexture', 'colorPattern', 'edgeType',
  'woodSpecies', 'woodGrade',
  'installationMethod', 'clickSystem', 'underlaymentRequired', 'underlaymentType',
  'sqftPerBox', 'sqmPerBox', 'planksPerBox', 'boxWeight',
  'warrantyResidential', 'warrantyCommercial', 'certifications', 'origin',
  'format',
  'clientVisibleFields',
  'notes',
]);

// String columns the `search` tool walks. Boolean / numeric columns
// aren't searched textually — the AI should use `list` filters for
// those (e.g. waterproof=true).
const SEARCHABLE_STRING_FIELDS = [
  'flooringType', 'coreType', 'construction',
  'acRating', 'fireRating', 'slipRating',
  'surfaceFinish', 'surfaceTexture', 'colorPattern', 'edgeType',
  'woodSpecies', 'woodGrade',
  'installationMethod', 'clickSystem',
  'underlaymentRequired', 'underlaymentType',
  'warrantyResidential', 'warrantyCommercial',
  'origin', 'format', 'notes',
];

// Alias map for the QA tool. User-facing language → canonical column
// name. Keys are lowercased on lookup. Extend liberally — false
// negatives in QA are worse than ambiguity (the AI follows up to clarify).
const ATTRIBUTE_ALIASES = new Map([
  // Dimensions
  ['length', 'length'], ['plank length', 'length'], ['board length', 'length'],
  ['width', 'width'], ['plank width', 'width'], ['board width', 'width'],
  ['thickness', 'thickness'], ['total thickness', 'thickness'],
  ['wear layer', 'wearLayerThickness'], ['wear layer thickness', 'wearLayerThickness'], ['wear layer mm', 'wearLayerThickness'],
  ['wear layer mil', 'wearLayerMil'], ['mil', 'wearLayerMil'],
  // Ratings
  ['ac rating', 'acRating'], ['ac', 'acRating'],
  ['waterproof', 'waterproof'],
  ['fire rating', 'fireRating'], ['fire class', 'fireRating'],
  ['slip rating', 'slipRating'], ['slip resistance', 'slipRating'], ['cof', 'slipRating'],
  // Surface
  ['surface finish', 'surfaceFinish'], ['finish', 'surfaceFinish'],
  ['surface texture', 'surfaceTexture'], ['texture', 'surfaceTexture'],
  ['color', 'colorPattern'], ['colour', 'colorPattern'], ['pattern', 'colorPattern'], ['color pattern', 'colorPattern'],
  ['edge', 'edgeType'], ['edge type', 'edgeType'], ['bevel', 'edgeType'],
  // Construction
  ['flooring type', 'flooringType'], ['type', 'flooringType'],
  ['core', 'coreType'], ['core type', 'coreType'],
  ['construction', 'construction'],
  // Wood
  ['species', 'woodSpecies'], ['wood species', 'woodSpecies'], ['wood', 'woodSpecies'],
  ['grade', 'woodGrade'], ['wood grade', 'woodGrade'],
  // Installation
  ['installation', 'installationMethod'], ['install method', 'installationMethod'], ['installation method', 'installationMethod'],
  ['click', 'clickSystem'], ['click system', 'clickSystem'], ['locking', 'clickSystem'],
  ['underlayment', 'underlaymentType'], ['underlay', 'underlaymentType'],
  // Packaging
  ['sqm per box', 'sqmPerBox'], ['sqm/box', 'sqmPerBox'], ['m2 per box', 'sqmPerBox'],
  ['sqft per box', 'sqftPerBox'], ['sqft/box', 'sqftPerBox'], ['sf per box', 'sqftPerBox'],
  ['planks per box', 'planksPerBox'], ['pcs per box', 'planksPerBox'],
  ['box weight', 'boxWeight'], ['weight per box', 'boxWeight'],
  // Warranty / compliance
  ['residential warranty', 'warrantyResidential'], ['warranty residential', 'warrantyResidential'],
  ['commercial warranty', 'warrantyCommercial'], ['warranty commercial', 'warrantyCommercial'],
  ['certifications', 'certifications'], ['certs', 'certifications'],
  ['origin', 'origin'], ['country of origin', 'origin'], ['made in', 'origin'],
  ['format', 'format'],
  ['notes', 'notes'],
]);

function normalizeAttribute(name) {
  if (!name) return null;
  const key = String(name).toLowerCase().trim();
  if (ATTRIBUTE_ALIASES.has(key)) return ATTRIBUTE_ALIASES.get(key);
  // Fall back to camelCase pass-through for callers who already know the
  // column name (e.g. 'flooringType').
  return key;
}

// ── Find product by id-or-sku ──────────────────────────────────────────

async function resolveProduct(productIdOrSku) {
  if (!productIdOrSku) return null;
  // Try UUID first.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productIdOrSku)) {
    const byId = await db.Product.findByPk(productIdOrSku);
    if (byId) return byId;
  }
  // Fall back to SKU exact match.
  return db.Product.findOne({ where: { sku: productIdOrSku } });
}

// ── upsertProductSpec ──────────────────────────────────────────────────

async function upsertProductSpec(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { productId, productSku, ...rawFields } = payload;
  const product = await resolveProduct(productId || productSku);
  if (!product) {
    return err('not_found', 404,
      `Product not found for ${productId ? `id=${productId}` : `sku=${productSku}`}.`);
  }

  // Filter to allowed columns only — anything else is silently dropped.
  const fields = {};
  for (const [k, v] of Object.entries(rawFields)) {
    if (WRITABLE_FIELDS.has(k)) fields[k] = v;
  }
  fields.updatedBy = ctx?.userId || null;
  fields.lastUpdated = new Date();

  // Upsert (one row per productId per the model's unique index).
  const existing = await db.ProductSpecification.findOne({ where: { productId: product.id } });
  if (existing) {
    const before = existing.toJSON();
    await existing.update(fields);
    return { ok: true, spec: existing, product, before, after: existing.toJSON(), created: false };
  }
  const created = await db.ProductSpecification.create({
    productId: product.id,
    ...fields,
  });
  return { ok: true, spec: created, product, created: true };
}

// ── getProductSpec ────────────────────────────────────────────────────

async function getProductSpec(productIdOrSku) {
  const product = await resolveProduct(productIdOrSku);
  if (!product) {
    return err('not_found', 404,
      `Product not found for "${productIdOrSku}".`);
  }
  const spec = await db.ProductSpecification.findOne({ where: { productId: product.id } });
  if (!spec) {
    return err('not_found', 404,
      `No specification row for product ${product.sku} (${product.id}). Use erp_upsert_product_spec to create one.`);
  }
  return { ok: true, spec, product };
}

// ── listProductSpecs ──────────────────────────────────────────────────

async function listProductSpecs(filters) {
  filters = filters || {};
  const where = {};
  if (filters.flooringType) where.flooringType = filters.flooringType;
  if (filters.coreType) where.coreType = filters.coreType;
  if (filters.waterproof !== undefined) where.waterproof = !!filters.waterproof;
  if (filters.acRating) where.acRating = filters.acRating;
  if (filters.fireRating) where.fireRating = filters.fireRating;
  if (filters.origin) where.origin = filters.origin;
  if (filters.format) where.format = filters.format;
  if (filters.hasValue) {
    // Only return rows where the named column is non-null (used by the
    // search tool when narrowing to "products that have an AC rating set").
    const col = normalizeAttribute(filters.hasValue);
    if (col) where[col] = { [Op.not]: null };
  }

  const productWhere = {};
  if (filters.brandCode) productWhere.brandCode = String(filters.brandCode).toUpperCase();

  const rows = await db.ProductSpecification.findAll({
    where,
    limit: Math.min(filters.limit || 25, 100),
    order: [['lastUpdated', 'DESC']],
    include: [{
      model: db.Product,
      as: 'product',
      where: Object.keys(productWhere).length ? productWhere : undefined,
      required: !!Object.keys(productWhere).length,
      attributes: ['id', 'sku', 'name', 'brandCode'],
    }],
  });

  return { ok: true, specs: rows };
}

// ── searchProductSpecs ────────────────────────────────────────────────

async function searchProductSpecs(query) {
  if (!query || String(query).trim().length < 2) {
    return err('validation', 400, 'query must be at least 2 characters');
  }
  const q = `%${String(query).trim()}%`;

  // Walk every searchable string column with LIKE %q%. SQLite's LIKE is
  // case-insensitive for ASCII by default.
  const orClauses = SEARCHABLE_STRING_FIELDS.map(field => ({ [field]: { [Op.like]: q } }));

  const rows = await db.ProductSpecification.findAll({
    where: { [Op.or]: orClauses },
    limit: 25,
    order: [['lastUpdated', 'DESC']],
    include: [{
      model: db.Product,
      as: 'product',
      attributes: ['id', 'sku', 'name', 'brandCode'],
    }],
  });

  // For each row, identify which field(s) matched the query so the AI
  // can render context. Useful when the same query matches different
  // fields across different rows.
  const lowerQ = String(query).toLowerCase();
  const annotated = rows.map(r => {
    const matchedFields = [];
    for (const field of SEARCHABLE_STRING_FIELDS) {
      const v = r[field];
      if (v != null && String(v).toLowerCase().includes(lowerQ)) {
        matchedFields.push({ field, value: v });
      }
    }
    return { spec: r, matchedFields };
  });

  return { ok: true, results: annotated, resultCount: annotated.length, query };
}

// ── lookupSpecQa ──────────────────────────────────────────────────────

async function lookupSpecQa(payload) {
  const { product, attribute } = payload || {};
  if (!product) return err('validation', 400, 'product (id or SKU) is required');
  if (!attribute) return err('validation', 400, 'attribute is required');

  const productRow = await resolveProduct(product);
  if (!productRow) {
    return err('not_found', 404, `Product not found for "${product}".`);
  }
  const spec = await db.ProductSpecification.findOne({ where: { productId: productRow.id } });
  if (!spec) {
    return {
      ok: true,
      answer: 'not_yet_recorded',
      message: `No specification row exists for ${productRow.sku} (${productRow.name}). Use erp_upsert_product_spec to record one.`,
      product: { id: productRow.id, sku: productRow.sku, name: productRow.name },
      attribute,
    };
  }

  const column = normalizeAttribute(attribute);
  // Verify it's actually a column on the model — protects against typos
  // returning misleading "null" values.
  if (!WRITABLE_FIELDS.has(column) && column !== 'lastUpdated' && column !== 'updatedBy') {
    return {
      ok: true,
      answer: 'unknown_attribute',
      message: `Attribute "${attribute}" (normalised to "${column}") is not a recognised ProductSpecification field. Valid attributes include: ${Array.from(WRITABLE_FIELDS).slice(0, 20).join(', ')}, ... Use erp_get_product_spec to see every field on this product.`,
      product: { id: productRow.id, sku: productRow.sku, name: productRow.name },
      attribute,
      normalised: column,
    };
  }

  const value = spec[column];
  if (value === null || value === undefined || value === '') {
    return {
      ok: true,
      answer: 'not_yet_recorded',
      message: `${productRow.sku}: ${attribute} (${column}) is not yet recorded.`,
      product: { id: productRow.id, sku: productRow.sku, name: productRow.name },
      attribute,
      normalised: column,
      value: null,
    };
  }

  return {
    ok: true,
    answer: 'found',
    product: { id: productRow.id, sku: productRow.sku, name: productRow.name },
    attribute,
    normalised: column,
    value,
  };
}

// ── archiveProductSpec ────────────────────────────────────────────────

async function archiveProductSpec(productIdOrSku, ctx) {
  const product = await resolveProduct(productIdOrSku);
  if (!product) return err('not_found', 404, `Product not found for "${productIdOrSku}".`);
  const spec = await db.ProductSpecification.findOne({ where: { productId: product.id } });
  if (!spec) {
    return err('not_found', 404,
      `No specification row to archive for product ${product.sku}.`);
  }
  const before = spec.toJSON();
  // ProductSpecification has no paranoid soft-delete; do a hard delete.
  // The model comment notes NULL productId = template, but unlinking
  // rather than deleting would leave orphan rows. Hard delete is the
  // cleaner contract.
  await spec.destroy();
  return { ok: true, deleted: before, product };
}

module.exports = {
  upsertProductSpec,
  getProductSpec,
  listProductSpecs,
  searchProductSpecs,
  lookupSpecQa,
  archiveProductSpec,
  resolveProduct,
  normalizeAttribute,
  WRITABLE_FIELDS,
  SEARCHABLE_STRING_FIELDS,
  ATTRIBUTE_ALIASES,
};
