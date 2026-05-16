/**
 * sampleWriteService — Phase 4.15c-3.
 *
 * Wraps SampleRequest + SampleShipment + SampleFeedback. Six tools:
 *   - createSampleRequest      — customer + products[] + priority, status='pending'
 *   - approveSampleRequest     — pending → approved + approvedBy + approvalDate
 *   - createSampleShipment     — create a SampleShipment for an approved request,
 *                                 patches the parent request status when the
 *                                 request is still in approved/processing
 *   - recordSampleFeedback     — capture rating + multi-axis scores + issues
 *   - listSampleRequests       — filter by customer/status/priority/date range
 *   - getSampleRequest         — read by id with shipments + feedback eager-loaded
 *
 * State machine (SampleRequest.status):
 *   pending → approved → processing → shipped → delivered
 *               ↘ cancelled
 *   Creating a shipment promotes approved → shipped (with one shipment per
 *   row, multiple shipments allowed for split deliveries). Cancellation is
 *   not exposed via this service yet — Phase 4.15c-3 focuses on the happy
 *   path; cancellation can be a follow-up.
 *
 * Return shape mirrors the rest of aiWriteServices:
 *   { ok: true, ...data, before?, after? }
 *   { ok: false, code, httpStatus, message }
 */

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../../models');

function err(code, httpStatus, message) {
  return { ok: false, code, httpStatus, message };
}

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const VALID_REQUEST_STATUSES = new Set(['pending', 'approved', 'processing', 'shipped', 'delivered', 'cancelled']);
const VALID_SHIPPING_METHODS = new Set(['courier', 'air_freight', 'sea_freight', 'local_delivery']);
const VALID_SHIPMENT_STATUSES = new Set(['pending', 'shipped', 'in_transit', 'delivered', 'failed']);
const VALID_FEEDBACK_STATUSES = new Set(['pending_action', 'under_review', 'resolved', 'escalated']);

// ── createSampleRequest ──────────────────────────────────────────────

async function createSampleRequest(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { customerId, products, priority, requiredByDate, specialRequirements, notes, requestNumber } = payload;

  if (!customerId) return err('validation', 400, 'customerId is required');
  if (!Array.isArray(products) || products.length === 0) {
    return err('validation', 400, 'products must be a non-empty array of {productId, quantity, ...}.');
  }
  if (priority !== undefined && !VALID_PRIORITIES.has(priority)) {
    return err('validation', 400,
      `priority must be one of: ${[...VALID_PRIORITIES].join(', ')}.`);
  }

  const customer = await db.Customer.findByPk(customerId);
  if (!customer) return err('not_found', 404, `Customer ${customerId} not found.`);

  // Validate each product reference + sum totalQuantity.
  let totalQuantity = 0;
  for (const p of products) {
    const qty = Number(p.quantity || 0);
    if (qty <= 0) {
      return err('validation', 400,
        `Each product must have a positive quantity (got ${JSON.stringify(p)}).`);
    }
    totalQuantity += qty;
    if (p.productId) {
      const exists = await db.Product.findByPk(p.productId);
      if (!exists) {
        return err('not_found', 404, `Product ${p.productId} not found.`);
      }
    }
  }

  const number = requestNumber || `SR-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
  const dup = await db.SampleRequest.findOne({ where: { requestNumber: number } });
  if (dup) {
    return err('validation', 409,
      `SampleRequest "${number}" already exists. Use a unique requestNumber or omit to auto-generate.`);
  }

  const request = await db.SampleRequest.create({
    id: uuidv4(),
    requestNumber: number,
    customerId,
    products,
    totalQuantity,
    priority: priority || 'medium',
    requiredByDate: requiredByDate ? new Date(requiredByDate) : null,
    specialRequirements: specialRequirements || null,
    status: 'pending',
    notes: notes || null,
  });
  return { ok: true, request };
}

// ── approveSampleRequest ─────────────────────────────────────────────

async function approveSampleRequest(id, ctx) {
  if (!id) return err('validation', 400, 'id is required');
  const approverId = ctx?.userId;
  if (!approverId) return err('validation', 400, 'ctx.userId required (approver identity).');

  const request = await db.SampleRequest.findByPk(id);
  if (!request) return err('not_found', 404, `SampleRequest ${id} not found.`);
  if (request.status !== 'pending') {
    return err('validation', 400,
      `Cannot approve SampleRequest from status "${request.status}". Only "pending" requests can be approved.`);
  }

  const before = request.toJSON();
  await request.update({
    status: 'approved',
    approvedBy: approverId,
    approvalDate: new Date(),
  });
  return { ok: true, request, before, after: request.toJSON() };
}

// ── createSampleShipment ─────────────────────────────────────────────

async function createSampleShipment(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { sampleRequestId, quantity, shippingMethod, carrier, trackingNumber,
          shippedDate, expectedDeliveryDate, weight, weightUnit, shippingCost,
          currency, notes, shipmentNumber } = payload;

  if (!sampleRequestId) return err('validation', 400, 'sampleRequestId is required');
  if (quantity === undefined || quantity === null || Number(quantity) <= 0) {
    return err('validation', 400, 'quantity is required and must be > 0.');
  }
  if (shippingMethod !== undefined && !VALID_SHIPPING_METHODS.has(shippingMethod)) {
    return err('validation', 400,
      `shippingMethod must be one of: ${[...VALID_SHIPPING_METHODS].join(', ')}.`);
  }

  const request = await db.SampleRequest.findByPk(sampleRequestId);
  if (!request) return err('not_found', 404, `SampleRequest ${sampleRequestId} not found.`);
  if (request.status === 'pending' || request.status === 'cancelled') {
    return err('validation', 400,
      `Cannot create shipment for SampleRequest in status "${request.status}". Approve it first.`);
  }

  const number = shipmentNumber || `SS-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
  const dup = await db.SampleShipment.findOne({ where: { shipmentNumber: number } });
  if (dup) {
    return err('validation', 409,
      `SampleShipment "${number}" already exists. Use a unique shipmentNumber or omit to auto-generate.`);
  }

  const shipment = await db.SampleShipment.create({
    id: uuidv4(),
    sampleRequestId,
    shipmentNumber: number,
    quantity,
    shippingMethod: shippingMethod || 'courier',
    carrier: carrier || null,
    trackingNumber: trackingNumber || null,
    shippedDate: shippedDate ? new Date(shippedDate) : new Date(),
    expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
    weight: weight !== undefined ? weight : null,
    weightUnit: weightUnit || 'kg',
    shippingCost: shippingCost !== undefined ? shippingCost : null,
    currency: currency || 'USD',
    shippedBy: ctx?.userId || null,
    status: 'shipped',
    notes: notes || null,
  });

  // Promote parent request to 'shipped' when previously approved/processing.
  let requestBefore = null;
  let requestAfter = null;
  if (request.status === 'approved' || request.status === 'processing') {
    requestBefore = request.toJSON();
    await request.update({ status: 'shipped' });
    requestAfter = request.toJSON();
  }

  return { ok: true, shipment, requestBefore, requestAfter };
}

// ── recordSampleFeedback ─────────────────────────────────────────────

async function recordSampleFeedback(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { sampleRequestId, rating, quality, packaging, delivery,
          comments, issues, recommendations, sentByContactId,
          followUpDate, internalNotes, status } = payload;

  if (!sampleRequestId) return err('validation', 400, 'sampleRequestId is required');
  if (rating === undefined || rating === null) {
    return err('validation', 400, 'rating is required (1–5).');
  }
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) {
    return err('validation', 400, `rating must be an integer 1–5 (got ${rating}).`);
  }
  for (const [name, val] of [['quality', quality], ['packaging', packaging], ['delivery', delivery]]) {
    if (val !== undefined && val !== null) {
      const v = Number(val);
      if (!Number.isInteger(v) || v < 1 || v > 5) {
        return err('validation', 400, `${name} must be an integer 1–5 when provided (got ${val}).`);
      }
    }
  }
  if (status !== undefined && !VALID_FEEDBACK_STATUSES.has(status)) {
    return err('validation', 400,
      `status must be one of: ${[...VALID_FEEDBACK_STATUSES].join(', ')}.`);
  }

  const request = await db.SampleRequest.findByPk(sampleRequestId);
  if (!request) return err('not_found', 404, `SampleRequest ${sampleRequestId} not found.`);

  const feedback = await db.SampleFeedback.create({
    id: uuidv4(),
    sampleRequestId,
    rating: r,
    quality: quality !== undefined ? Number(quality) : null,
    packaging: packaging !== undefined ? Number(packaging) : null,
    delivery: delivery !== undefined ? Number(delivery) : null,
    comments: comments || null,
    issues: Array.isArray(issues) ? issues : [],
    recommendations: recommendations || null,
    sentByContactId: sentByContactId || null,
    handledBy: ctx?.userId || null,
    followUpDate: followUpDate ? new Date(followUpDate) : null,
    internalNotes: internalNotes || null,
    status: status || (r <= 2 ? 'escalated' : 'pending_action'),
  });
  return { ok: true, feedback };
}

// ── listSampleRequests ───────────────────────────────────────────────

async function listSampleRequests(filters) {
  filters = filters || {};
  const where = {};
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.status) {
    if (!VALID_REQUEST_STATUSES.has(filters.status)) {
      return err('validation', 400,
        `status must be one of: ${[...VALID_REQUEST_STATUSES].join(', ')}.`);
    }
    where.status = filters.status;
  }
  if (filters.priority) {
    if (!VALID_PRIORITIES.has(filters.priority)) {
      return err('validation', 400,
        `priority must be one of: ${[...VALID_PRIORITIES].join(', ')}.`);
    }
    where.priority = filters.priority;
  }
  if (filters.requestFrom || filters.requestTo) {
    where.requestDate = {};
    if (filters.requestFrom) where.requestDate[Op.gte] = new Date(filters.requestFrom);
    if (filters.requestTo) where.requestDate[Op.lte] = new Date(filters.requestTo);
  }
  if (filters.search) {
    where.requestNumber = { [Op.like]: `%${filters.search}%` };
  }
  const rows = await db.SampleRequest.findAll({
    where,
    limit: Math.min(filters.limit || 25, 100),
    order: [['requestDate', 'DESC'], ['createdAt', 'DESC']],
  });
  return { ok: true, requests: rows };
}

// ── getSampleRequest ─────────────────────────────────────────────────

async function getSampleRequest(id) {
  if (!id) return err('validation', 400, 'id is required');
  const request = await db.SampleRequest.findByPk(id, {
    include: [
      { model: db.SampleShipment, as: 'shipments' },
      { model: db.SampleFeedback, as: 'feedback' },
      { model: db.Customer, as: 'customer' },
    ],
  });
  if (!request) return err('not_found', 404, `SampleRequest ${id} not found.`);
  return { ok: true, request };
}

module.exports = {
  createSampleRequest,
  approveSampleRequest,
  createSampleShipment,
  recordSampleFeedback,
  listSampleRequests,
  getSampleRequest,
  VALID_PRIORITIES,
  VALID_REQUEST_STATUSES,
};
