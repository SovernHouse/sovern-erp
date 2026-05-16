/**
 * inspectionWriteService — Phase 4.15c-2.
 *
 * Wraps Inspection + InspectionItem + InspectionReport. Nine tools:
 *   - scheduleInspection      — create Inspection (status='scheduled')
 *   - startInspection         — transition scheduled → in_progress
 *   - completeInspection      — transition in_progress → passed/failed/
 *                                conditional + overallResult +
 *                                completedDate
 *   - addInspectionItem       — create InspectionItem (checkpoint line)
 *   - updateInspectionItem    — patch a line item (result, value, notes, images)
 *   - listInspections         — filter by status, type, factoryId,
 *                                salesOrderId, purchaseOrderId, dateRange
 *   - getInspection           — read by id (includes items + report)
 *   - generateInspectionReport — create InspectionReport with auto-derived
 *                                findings (pass/fail counts per checkpoint)
 *   - getInspectionReport     — read by reportNumber OR inspectionId
 *
 * State machine (Inspection.status):
 *   scheduled → in_progress → (passed | failed | conditional)
 *   Cannot start an inspection that has already been started.
 *   Cannot complete an inspection that hasn't been started (must call
 *   startInspection first; the AI workflow benefits from the explicit
 *   transition because it forces an in-the-loop moment to attach items).
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

const VALID_TYPES = new Set(['pre_production', 'during_production', 'pre_shipment', 'loading']);
const VALID_OVERALL_RESULTS = new Set(['pass', 'fail', 'conditional']);
const VALID_ITEM_RESULTS = new Set(['pass', 'fail', 'na']);
const FINAL_STATUSES = new Set(['passed', 'failed', 'conditional']);

// Map completion overallResult → inspection.status.
const RESULT_TO_STATUS = {
  pass: 'passed',
  fail: 'failed',
  conditional: 'conditional',
};

// ── scheduleInspection ───────────────────────────────────────────────

async function scheduleInspection(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { type, factoryId, inspectorId, salesOrderId, purchaseOrderId, scheduledDate, notes, inspectionNumber } = payload;

  if (!type || !VALID_TYPES.has(type)) {
    return err('validation', 400,
      `type is required and must be one of: ${[...VALID_TYPES].join(', ')}.`);
  }
  if (!factoryId) return err('validation', 400, 'factoryId is required');
  if (!inspectorId) return err('validation', 400, 'inspectorId is required');

  const [factory, inspector] = await Promise.all([
    db.Factory.findByPk(factoryId),
    db.User.findByPk(inspectorId),
  ]);
  if (!factory) return err('not_found', 404, `Factory ${factoryId} not found.`);
  if (!inspector) return err('not_found', 404, `Inspector (User) ${inspectorId} not found.`);

  const number = inspectionNumber || `INS-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
  const dup = await db.Inspection.findOne({ where: { inspectionNumber: number } });
  if (dup) {
    return err('validation', 409,
      `Inspection "${number}" already exists. Use a unique inspectionNumber or omit to auto-generate.`);
  }

  const inspection = await db.Inspection.create({
    id: uuidv4(),
    inspectionNumber: number,
    type,
    factoryId,
    inspectorId,
    salesOrderId: salesOrderId || null,
    purchaseOrderId: purchaseOrderId || null,
    scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
    status: 'scheduled',
    notes: notes || null,
  });
  return { ok: true, inspection };
}

// ── startInspection ──────────────────────────────────────────────────

async function startInspection(id, ctx) {
  if (!id) return err('validation', 400, 'id is required');
  const inspection = await db.Inspection.findByPk(id);
  if (!inspection) return err('not_found', 404, `Inspection ${id} not found.`);
  if (inspection.status !== 'scheduled') {
    return err('validation', 400,
      `Cannot start inspection from status "${inspection.status}". Only "scheduled" inspections can be started.`);
  }
  const before = inspection.toJSON();
  await inspection.update({ status: 'in_progress' });
  return { ok: true, inspection, before, after: inspection.toJSON() };
}

// ── completeInspection ───────────────────────────────────────────────

async function completeInspection(id, payload, ctx) {
  if (!id) return err('validation', 400, 'id is required');
  payload = payload || {};
  const { overallResult, notes, completedDate } = payload;

  if (!overallResult || !VALID_OVERALL_RESULTS.has(overallResult)) {
    return err('validation', 400,
      `overallResult is required and must be one of: ${[...VALID_OVERALL_RESULTS].join(', ')}.`);
  }

  const inspection = await db.Inspection.findByPk(id);
  if (!inspection) return err('not_found', 404, `Inspection ${id} not found.`);
  if (inspection.status !== 'in_progress') {
    return err('validation', 400,
      `Cannot complete inspection from status "${inspection.status}". Call startInspection first.`);
  }

  const before = inspection.toJSON();
  await inspection.update({
    status: RESULT_TO_STATUS[overallResult],
    overallResult,
    completedDate: completedDate ? new Date(completedDate) : new Date(),
    notes: notes !== undefined ? notes : inspection.notes,
  });
  return { ok: true, inspection, before, after: inspection.toJSON() };
}

// ── addInspectionItem ────────────────────────────────────────────────

async function addInspectionItem(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { inspectionId, productId, checkPoint, criteria, result, value, notes, images } = payload;
  if (!inspectionId) return err('validation', 400, 'inspectionId is required');
  if (!productId) return err('validation', 400, 'productId is required');
  if (!checkPoint) return err('validation', 400, 'checkPoint is required');
  if (!criteria) return err('validation', 400, 'criteria is required');
  if (result !== undefined && result !== null && !VALID_ITEM_RESULTS.has(result)) {
    return err('validation', 400,
      `result must be one of: ${[...VALID_ITEM_RESULTS].join(', ')} (got "${result}").`);
  }

  const [inspection, product] = await Promise.all([
    db.Inspection.findByPk(inspectionId),
    db.Product.findByPk(productId),
  ]);
  if (!inspection) return err('not_found', 404, `Inspection ${inspectionId} not found.`);
  if (!product) return err('not_found', 404, `Product ${productId} not found.`);
  if (FINAL_STATUSES.has(inspection.status)) {
    return err('validation', 400,
      `Cannot add items to a finalized inspection (status="${inspection.status}").`);
  }

  const item = await db.InspectionItem.create({
    id: uuidv4(),
    inspectionId,
    productId,
    checkPoint,
    criteria,
    result: result || null,
    value: value || null,
    notes: notes || null,
    images: Array.isArray(images) ? images : [],
  });
  return { ok: true, item };
}

// ── updateInspectionItem ─────────────────────────────────────────────

async function updateInspectionItem(itemId, patch, ctx) {
  if (!itemId) return err('validation', 400, 'itemId is required');
  patch = patch || {};
  const item = await db.InspectionItem.findByPk(itemId);
  if (!item) return err('not_found', 404, `InspectionItem ${itemId} not found.`);

  if (patch.result !== undefined && patch.result !== null && !VALID_ITEM_RESULTS.has(patch.result)) {
    return err('validation', 400,
      `result must be one of: ${[...VALID_ITEM_RESULTS].join(', ')} (got "${patch.result}").`);
  }

  const inspection = await db.Inspection.findByPk(item.inspectionId);
  if (inspection && FINAL_STATUSES.has(inspection.status)) {
    return err('validation', 400,
      `Cannot edit items on a finalized inspection (status="${inspection.status}").`);
  }

  const before = item.toJSON();
  const allowed = {};
  for (const k of ['result', 'value', 'notes', 'checkPoint', 'criteria', 'images']) {
    if (patch[k] !== undefined) allowed[k] = patch[k];
  }
  await item.update(allowed);
  return { ok: true, item, before, after: item.toJSON() };
}

// ── listInspections ──────────────────────────────────────────────────

async function listInspections(filters) {
  filters = filters || {};
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.factoryId) where.factoryId = filters.factoryId;
  if (filters.inspectorId) where.inspectorId = filters.inspectorId;
  if (filters.salesOrderId) where.salesOrderId = filters.salesOrderId;
  if (filters.purchaseOrderId) where.purchaseOrderId = filters.purchaseOrderId;
  if (filters.scheduledFrom || filters.scheduledTo) {
    where.scheduledDate = {};
    if (filters.scheduledFrom) where.scheduledDate[Op.gte] = new Date(filters.scheduledFrom);
    if (filters.scheduledTo) where.scheduledDate[Op.lte] = new Date(filters.scheduledTo);
  }
  if (filters.search) {
    where.inspectionNumber = { [Op.like]: `%${filters.search}%` };
  }

  const rows = await db.Inspection.findAll({
    where,
    limit: Math.min(filters.limit || 25, 100),
    order: [['scheduledDate', 'DESC'], ['createdAt', 'DESC']],
  });
  return { ok: true, inspections: rows };
}

// ── getInspection ────────────────────────────────────────────────────

async function getInspection(id) {
  if (!id) return err('validation', 400, 'id is required');
  const inspection = await db.Inspection.findByPk(id, {
    include: [
      { model: db.InspectionItem, as: 'items', include: [{ model: db.Product, as: 'product' }] },
      { model: db.InspectionReport, as: 'report' },
      { model: db.Factory, as: 'factory' },
      { model: db.User, as: 'inspector', attributes: ['id', 'firstName', 'lastName', 'email'] },
    ],
  });
  if (!inspection) return err('not_found', 404, `Inspection ${id} not found.`);
  return { ok: true, inspection };
}

// ── generateInspectionReport ─────────────────────────────────────────

async function generateInspectionReport(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { inspectionId, summary, recommendations, fileUrl, extraFindings } = payload;
  if (!inspectionId) return err('validation', 400, 'inspectionId is required');

  const inspection = await db.Inspection.findByPk(inspectionId, {
    include: [{ model: db.InspectionItem, as: 'items' }],
  });
  if (!inspection) return err('not_found', 404, `Inspection ${inspectionId} not found.`);

  const existing = await db.InspectionReport.findOne({ where: { inspectionId } });
  if (existing) {
    return err('validation', 409,
      `Inspection ${inspectionId} already has a report (reportNumber=${existing.reportNumber}). Use getInspectionReport to read it.`);
  }

  // Auto-derive findings shape from items (pass/fail counts per checkpoint).
  const findings = (Array.isArray(extraFindings) && extraFindings.length > 0)
    ? extraFindings.slice()
    : [];
  const items = inspection.items || [];
  const counts = { total: items.length, pass: 0, fail: 0, na: 0, pending: 0 };
  const perCheckpoint = {};
  for (const it of items) {
    if (it.result === 'pass') counts.pass++;
    else if (it.result === 'fail') counts.fail++;
    else if (it.result === 'na') counts.na++;
    else counts.pending++;

    perCheckpoint[it.checkPoint] = perCheckpoint[it.checkPoint] || { pass: 0, fail: 0, na: 0, pending: 0 };
    if (it.result === 'pass') perCheckpoint[it.checkPoint].pass++;
    else if (it.result === 'fail') perCheckpoint[it.checkPoint].fail++;
    else if (it.result === 'na') perCheckpoint[it.checkPoint].na++;
    else perCheckpoint[it.checkPoint].pending++;
  }
  findings.push({ kind: 'counts', ...counts });
  findings.push({ kind: 'per_checkpoint', breakdown: perCheckpoint });

  const reportNumber = `IR-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
  const report = await db.InspectionReport.create({
    id: uuidv4(),
    inspectionId,
    reportNumber,
    summary: summary || `Inspection ${inspection.inspectionNumber}: ${counts.pass}/${counts.total} checks passed, ${counts.fail} failed, ${counts.na} N/A.`,
    findings,
    recommendations: recommendations || null,
    fileUrl: fileUrl || null,
    generatedAt: new Date(),
  });
  return { ok: true, report };
}

// ── getInspectionReport ──────────────────────────────────────────────

async function getInspectionReport(query) {
  query = query || {};
  let report = null;
  if (query.reportId) {
    report = await db.InspectionReport.findByPk(query.reportId);
  } else if (query.reportNumber) {
    report = await db.InspectionReport.findOne({ where: { reportNumber: query.reportNumber } });
  } else if (query.inspectionId) {
    report = await db.InspectionReport.findOne({ where: { inspectionId: query.inspectionId } });
  } else {
    return err('validation', 400, 'Provide one of: reportId, reportNumber, inspectionId.');
  }
  if (!report) return err('not_found', 404, 'Inspection report not found.');
  return { ok: true, report };
}

module.exports = {
  scheduleInspection,
  startInspection,
  completeInspection,
  addInspectionItem,
  updateInspectionItem,
  listInspections,
  getInspection,
  generateInspectionReport,
  getInspectionReport,
  VALID_TYPES,
  VALID_OVERALL_RESULTS,
};
