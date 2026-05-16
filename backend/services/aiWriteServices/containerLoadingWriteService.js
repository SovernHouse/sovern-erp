/**
 * containerLoadingWriteService — Phase 4.15c-1.
 *
 * Wraps Container + ContainerConfiguration. Five tools:
 *   - createContainerLoad   — persist a Container row (status=planning)
 *   - optimizeContainerLoad — pure-math: given a list of {product_id,
 *                              quantity} + container_type, returns
 *                              {totalWeight, totalCube, weightUsedPct,
 *                              cubeUsedPct, fits, overweightBy?,
 *                              overcubeBy?, items: [...]}.
 *   - listContainerLoads
 *   - getContainerLoad
 *   - updateContainerLoad   — patches status / etd / eta / cargoWeight /
 *                              palletCount / boxCount / loadingDate /
 *                              departureDate / notes (matches what an
 *                              ops manager actually updates day-to-day).
 *
 * Container capacities (per the FAQ in trade-operations.md and the
 * standard ISO container dims):
 *   20ft     — maxWeight 21,000 kg, internal cube ~33 cbm
 *   40ft     — maxWeight 26,500 kg, internal cube ~67 cbm
 *   40ft_hc  — maxWeight 26,500 kg, internal cube ~76 cbm
 *
 * Optimizer is intentionally simple (sum of products × quantities,
 * compare to limits). It does NOT solve a 3D bin-packing problem — for
 * trade-document context the AI just needs "does it fit, with what
 * margin." A future phase can add stowage diagrams / orientation /
 * mixed-pallet logic if the operations team asks for it.
 */

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../../models');

function err(code, httpStatus, message) {
  return { ok: false, code, httpStatus, message };
}

const CONTAINER_LIMITS = {
  '20ft':    { maxWeight: 21000, maxCube: 33 },
  '40ft':    { maxWeight: 26500, maxCube: 67 },
  '40ft_hc': { maxWeight: 26500, maxCube: 76 },
};

// ── createContainerLoad ───────────────────────────────────────────────

async function createContainerLoad(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { containerType, containerNumber, shipmentId, purchaseOrderId, destinationPort, etd, eta, notes } = payload;
  if (!containerType) return err('validation', 400, 'containerType is required');
  if (!CONTAINER_LIMITS[containerType]) {
    return err('validation', 400,
      `Unknown containerType "${containerType}". Valid: ${Object.keys(CONTAINER_LIMITS).join(', ')}.`);
  }
  const limits = CONTAINER_LIMITS[containerType];

  // Auto-generate containerNumber when not supplied. Real-world container
  // numbers come from the carrier; the AI may not know yet at planning time.
  const cn = containerNumber || `PLAN-${containerType.toUpperCase()}-${Date.now()}`;

  const existing = await db.Container.findOne({ where: { containerNumber: cn } });
  if (existing) {
    return err('validation', 409,
      `Container "${cn}" already exists. Use erp_list_container_loads to find the existing row.`);
  }

  const container = await db.Container.create({
    id: uuidv4(),
    containerNumber: cn,
    containerType,
    containerStatus: 'planning',
    shipmentId: shipmentId || null,
    purchaseOrderId: purchaseOrderId || null,
    destinationPort: destinationPort || null,
    etd: etd ? new Date(etd) : null,
    eta: eta ? new Date(eta) : null,
    maxWeight: limits.maxWeight,
    notes: notes || null,
  });
  return { ok: true, container };
}

// ── optimizeContainerLoad (pure math, no DB write) ────────────────────

async function optimizeContainerLoad(payload) {
  if (!payload) return err('validation', 400, 'payload required');
  const { containerType, items } = payload;
  if (!containerType || !CONTAINER_LIMITS[containerType]) {
    return err('validation', 400,
      `containerType must be one of ${Object.keys(CONTAINER_LIMITS).join(', ')}.`);
  }
  if (!Array.isArray(items) || items.length === 0) {
    return err('validation', 400, 'items must be a non-empty array of {product_id, quantity}.');
  }
  const limits = CONTAINER_LIMITS[containerType];

  // Fetch every product in one query.
  const productIds = items.map(i => i.product_id || i.productId).filter(Boolean);
  const products = await db.Product.findAll({ where: { id: { [Op.in]: productIds } } });
  const byId = new Map(products.map(p => [p.id, p]));

  const annotated = [];
  let totalWeight = 0;
  let totalCube = 0;
  for (const it of items) {
    const id = it.product_id || it.productId;
    const qty = Number(it.quantity || 0);
    const product = byId.get(id);
    if (!product) {
      annotated.push({ productId: id, quantity: qty, error: 'product_not_found' });
      continue;
    }
    // weight is per-unit kg; cube is approximated from m² × thickness when
    // available. Falls back to 0 + flag when neither is set, so the AI
    // sees which products lack spec data.
    const unitWeight = parseFloat(product.weight || 0);
    const unitCube = parseFloat(product.cubicMeters || 0);
    const lineWeight = unitWeight * qty;
    const lineCube = unitCube * qty;
    totalWeight += lineWeight;
    totalCube += lineCube;
    annotated.push({
      productId: id,
      sku: product.sku,
      name: product.name,
      quantity: qty,
      unitWeightKg: unitWeight,
      unitCubeCbm: unitCube,
      lineWeightKg: lineWeight,
      lineCubeCbm: lineCube,
      hasSpecData: unitWeight > 0 || unitCube > 0,
    });
  }

  const weightUsedPct = (totalWeight / limits.maxWeight) * 100;
  const cubeUsedPct = limits.maxCube > 0 ? (totalCube / limits.maxCube) * 100 : 0;
  const fits = totalWeight <= limits.maxWeight && totalCube <= limits.maxCube;

  return {
    ok: true,
    plan: {
      containerType,
      containerLimits: limits,
      totalWeightKg: Number(totalWeight.toFixed(2)),
      totalCubeCbm: Number(totalCube.toFixed(2)),
      weightUsedPct: Number(weightUsedPct.toFixed(1)),
      cubeUsedPct: Number(cubeUsedPct.toFixed(1)),
      fits,
      overweightBy: fits ? 0 : Number(Math.max(0, totalWeight - limits.maxWeight).toFixed(2)),
      overcubeBy: fits ? 0 : Number(Math.max(0, totalCube - limits.maxCube).toFixed(2)),
      items: annotated,
    },
  };
}

// ── listContainerLoads ────────────────────────────────────────────────

async function listContainerLoads(filters) {
  filters = filters || {};
  const where = {};
  if (filters.containerType) where.containerType = filters.containerType;
  if (filters.containerStatus) where.containerStatus = filters.containerStatus;
  if (filters.shipmentId) where.shipmentId = filters.shipmentId;
  if (filters.purchaseOrderId) where.purchaseOrderId = filters.purchaseOrderId;
  if (filters.search) {
    where.containerNumber = { [Op.like]: `%${filters.search}%` };
  }
  const rows = await db.Container.findAll({
    where,
    limit: Math.min(filters.limit || 25, 100),
    order: [['createdAt', 'DESC']],
  });
  return { ok: true, containers: rows };
}

// ── getContainerLoad ──────────────────────────────────────────────────

async function getContainerLoad(id) {
  if (!id) return err('validation', 400, 'id is required');
  const container = await db.Container.findByPk(id);
  if (!container) return err('not_found', 404, `Container ${id} not found.`);
  return { ok: true, container };
}

// ── updateContainerLoad ───────────────────────────────────────────────

async function updateContainerLoad(id, patch, ctx) {
  const container = await db.Container.findByPk(id);
  if (!container) return err('not_found', 404, `Container ${id} not found.`);
  const before = container.toJSON();
  const allowed = {};
  const editableFields = [
    'containerStatus', 'destinationPort', 'etd', 'eta',
    'cargoWeight', 'usedCapacity', 'palletCount', 'boxCount',
    'loadingDate', 'departureDate', 'notes',
  ];
  for (const key of editableFields) {
    if (patch[key] !== undefined) {
      allowed[key] = (key.endsWith('Date') || key === 'etd' || key === 'eta')
        ? (patch[key] ? new Date(patch[key]) : null)
        : patch[key];
    }
  }
  await container.update(allowed);
  return { ok: true, container, before, after: container.toJSON() };
}

module.exports = {
  createContainerLoad,
  optimizeContainerLoad,
  listContainerLoads,
  getContainerLoad,
  updateContainerLoad,
  CONTAINER_LIMITS,
};
