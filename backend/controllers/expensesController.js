/**
 * Expenses Controller — Item 4 backend.
 *
 * One controller, four resources:
 *   - ReimbursementOffice (where Alex claims expenses from; multiple per spec)
 *   - Trip                 (optional grouping for multi-day expense rows)
 *   - Expense              (the workhorse — multi-currency, attributed to clients)
 *   - ExpenseSubmission    (a batched report sent to one office)
 *
 * Routes are gated at the route layer to admin + super_admin (bare strings
 * per L-031). All JSON columns pass raw values through (L-023).
 *
 * Currency conversion: when an expense is created with a non-USD currency,
 * the controller looks up ExchangeRate (base=USD, target=originalCurrency)
 * and stamps a USD-equivalent + the rate used so reports stay stable even
 * if FX rates move later. If no rate row exists, usdAmount + fxRateUsed
 * are left NULL — admin can fill in manually or run a backfill later.
 */

const { Op } = require('sequelize');
const db = require('../models');
const logger = require('../utils/logger.js');

const VALID_SUBMISSION_STATUS = ['draft', 'submitted', 'paid', 'rejected', 'not_claimable'];
const VALID_FREQUENCIES = ['monthly', 'quarterly', 'ad_hoc'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

function notFound(res, what) {
  return res.status(404).json({ error: `${what} not found` });
}

// Look up the (USD → target) rate; return { rate, usdAmount } or { rate: null }
// if no row exists. originalCurrency is normalized to upper-case 3-char ISO.
async function convertToUsd(originalAmount, originalCurrency) {
  const ccy = String(originalCurrency || 'USD').toUpperCase().slice(0, 3);
  const amt = Number(originalAmount);
  if (!Number.isFinite(amt)) return { rate: null, usdAmount: null };
  if (ccy === 'USD') return { rate: 1, usdAmount: amt };
  if (!db.ExchangeRate) return { rate: null, usdAmount: null };
  const row = await db.ExchangeRate.findOne({
    where: { baseCurrency: 'USD', targetCurrency: ccy, isActive: true },
  });
  if (!row || !row.rate || Number(row.rate) === 0) return { rate: null, usdAmount: null };
  const rate = Number(row.rate);
  return { rate, usdAmount: Math.round((amt / rate) * 100) / 100 };
}

// ─── ReimbursementOffice ─────────────────────────────────────────────────────

exports.listOffices = async (req, res) => {
  try {
    const where = {};
    if (req.query.activeOnly !== 'false') where.isActive = true;
    let offices = await db.ReimbursementOffice.findAll({
      where,
      order: [['displayName', 'ASC']],
    });
    // Empty-table guard per spec: if Alex has no offices yet AND he's the
    // active user, auto-create a "Personal" placeholder so first-expense
    // flows don't block on setup.
    if (offices.length === 0) {
      const personal = await db.ReimbursementOffice.create({
        code: 'PERSONAL',
        displayName: 'Personal',
        defaultCurrency: 'USD',
        claimsFrequency: 'ad_hoc',
        acceptedCategories: [],
        exportTemplateKey: null,
        notes: 'Auto-created on first expense entry. Edit or delete in Settings if you don\'t need it.',
      });
      offices = [personal];
    }
    res.json({ success: true, data: offices });
  } catch (err) {
    logger.error('[expenses] listOffices error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getOffice = async (req, res) => {
  try {
    const office = await db.ReimbursementOffice.findByPk(req.params.id);
    if (!office) return notFound(res, 'Office');
    res.json({ success: true, data: office });
  } catch (err) {
    logger.error('[expenses] getOffice error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.createOffice = async (req, res) => {
  try {
    const { code, displayName, defaultCurrency, claimsFrequency, acceptedCategories, exportTemplateKey, notes } = req.body;
    if (!code || !code.trim()) return badRequest(res, 'code is required');
    if (!displayName || !displayName.trim()) return badRequest(res, 'displayName is required');
    if (claimsFrequency && !VALID_FREQUENCIES.includes(claimsFrequency)) {
      return badRequest(res, `claimsFrequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);
    }
    const office = await db.ReimbursementOffice.create({
      code: code.trim().toUpperCase(),
      displayName: displayName.trim(),
      defaultCurrency: (defaultCurrency || 'USD').toUpperCase(),
      claimsFrequency: claimsFrequency || 'ad_hoc',
      acceptedCategories: Array.isArray(acceptedCategories) ? acceptedCategories : [],
      exportTemplateKey: exportTemplateKey || null,
      notes: notes || null,
    });
    res.status(201).json({ success: true, data: office });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return badRequest(res, 'An office with that code already exists');
    }
    logger.error('[expenses] createOffice error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.updateOffice = async (req, res) => {
  try {
    const office = await db.ReimbursementOffice.findByPk(req.params.id);
    if (!office) return notFound(res, 'Office');
    const allowed = ['displayName', 'defaultCurrency', 'claimsFrequency', 'acceptedCategories', 'exportTemplateKey', 'notes', 'isActive'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    if (updates.claimsFrequency && !VALID_FREQUENCIES.includes(updates.claimsFrequency)) {
      return badRequest(res, `claimsFrequency must be one of: ${VALID_FREQUENCIES.join(', ')}`);
    }
    await office.update(updates);
    res.json({ success: true, data: office });
  } catch (err) {
    logger.error('[expenses] updateOffice error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteOffice = async (req, res) => {
  try {
    const office = await db.ReimbursementOffice.findByPk(req.params.id);
    if (!office) return notFound(res, 'Office');
    // Soft-block if there are still expenses pointing to it.
    const linked = await db.Expense.count({
      where: { [Op.or]: [{ submittingOfficeId: office.id }, { paidByOfficeId: office.id }] },
    });
    if (linked > 0) {
      return res.status(409).json({
        error: `Office is referenced by ${linked} expense row(s). Re-route or delete those first, or set isActive=false to retire without deleting.`,
      });
    }
    await office.destroy();
    res.json({ success: true });
  } catch (err) {
    logger.error('[expenses] deleteOffice error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Trip ────────────────────────────────────────────────────────────────────

exports.listTrips = async (req, res) => {
  try {
    const trips = await db.Trip.findAll({ order: [['startDate', 'DESC'], ['createdAt', 'DESC']] });
    res.json({ success: true, data: trips });
  } catch (err) {
    logger.error('[expenses] listTrips error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getTrip = async (req, res) => {
  try {
    const trip = await db.Trip.findByPk(req.params.id);
    if (!trip) return notFound(res, 'Trip');
    res.json({ success: true, data: trip });
  } catch (err) {
    logger.error('[expenses] getTrip error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.createTrip = async (req, res) => {
  try {
    const { name, startDate, endDate, purpose, primaryCustomerId, inspectorId } = req.body;
    if (!name || !name.trim()) return badRequest(res, 'name is required');
    const trip = await db.Trip.create({
      name: name.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      purpose: purpose || null,
      primaryCustomerId: primaryCustomerId || null,
      inspectorId: inspectorId || null,
    });
    res.status(201).json({ success: true, data: trip });
  } catch (err) {
    logger.error('[expenses] createTrip error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.updateTrip = async (req, res) => {
  try {
    const trip = await db.Trip.findByPk(req.params.id);
    if (!trip) return notFound(res, 'Trip');
    const allowed = ['name', 'startDate', 'endDate', 'purpose', 'primaryCustomerId', 'inspectorId'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    await trip.update(updates);
    res.json({ success: true, data: trip });
  } catch (err) {
    logger.error('[expenses] updateTrip error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTrip = async (req, res) => {
  try {
    const trip = await db.Trip.findByPk(req.params.id);
    if (!trip) return notFound(res, 'Trip');
    // Detach expenses rather than cascade-delete (data preservation).
    await db.Expense.update({ tripId: null }, { where: { tripId: trip.id } });
    await trip.destroy();
    res.json({ success: true });
  } catch (err) {
    logger.error('[expenses] deleteTrip error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── Expense ─────────────────────────────────────────────────────────────────

exports.listExpenses = async (req, res) => {
  try {
    const { status, customerId, factoryId, tripId, officeId, paid, search, limit, offset } = req.query;
    const where = {};
    if (status) where.submissionStatus = status;
    if (customerId) where.customerId = customerId;
    if (factoryId) where.factoryId = factoryId;
    if (tripId) where.tripId = tripId;
    if (officeId) where.submittingOfficeId = officeId;
    if (paid === 'true') where.paidAt = { [Op.ne]: null };
    if (paid === 'false') where.paidAt = null;
    if (search) {
      where[Op.or] = [
        { description: { [Op.like]: `%${search}%` } },
        { category:    { [Op.like]: `%${search}%` } },
        { notes:       { [Op.like]: `%${search}%` } },
      ];
    }
    const expenses = await db.Expense.findAll({
      where,
      order: [['entryDate', 'DESC'], ['createdAt', 'DESC']],
      limit: Math.min(parseInt(limit, 10) || 100, 500),
      offset: parseInt(offset, 10) || 0,
    });
    res.json({ success: true, data: expenses });
  } catch (err) {
    logger.error('[expenses] listExpenses error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getExpense = async (req, res) => {
  try {
    const expense = await db.Expense.findByPk(req.params.id);
    if (!expense) return notFound(res, 'Expense');
    res.json({ success: true, data: expense });
  } catch (err) {
    logger.error('[expenses] getExpense error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const {
      entryDate, category, description,
      originalCurrency, originalAmount, usdAmount, fxRateUsed,
      customerId, factoryId, quotationId, purchaseOrderId, tripId, inspectorId,
      submittingOfficeId, paidByOfficeId, paidAt, submissionStatus,
      receiptDriveFileIds, aiExtractedFromDriveFileId, aiExtractionConfidence,
      notes,
    } = req.body;

    if (!category || !category.trim()) return badRequest(res, 'category is required');
    if (originalAmount == null || isNaN(Number(originalAmount))) {
      return badRequest(res, 'originalAmount is required and must be numeric');
    }
    if (submissionStatus && !VALID_SUBMISSION_STATUS.includes(submissionStatus)) {
      return badRequest(res, `submissionStatus must be one of: ${VALID_SUBMISSION_STATUS.join(', ')}`);
    }

    const ccy = (originalCurrency || 'USD').toUpperCase();
    let usd = usdAmount;
    let rate = fxRateUsed;
    // Compute USD-equivalent if not provided.
    if (usd == null || rate == null) {
      const conv = await convertToUsd(originalAmount, ccy);
      if (usd == null) usd = conv.usdAmount;
      if (rate == null) rate = conv.rate;
    }

    const expense = await db.Expense.create({
      userId: req.user.id,
      entryDate: entryDate || new Date().toISOString().slice(0, 10),
      category: category.trim(),
      description: description || null,
      originalCurrency: ccy,
      originalAmount: Number(originalAmount),
      usdAmount: usd,
      fxRateUsed: rate,
      customerId: customerId || null,
      factoryId: factoryId || null,
      quotationId: quotationId || null,
      purchaseOrderId: purchaseOrderId || null,
      tripId: tripId || null,
      inspectorId: inspectorId || null,
      submittingOfficeId: submittingOfficeId || null,
      paidByOfficeId: paidByOfficeId || null,
      paidAt: paidAt || null,
      submissionStatus: submissionStatus || 'draft',
      receiptDriveFileIds: Array.isArray(receiptDriveFileIds) ? receiptDriveFileIds : [],
      aiExtractedFromDriveFileId: aiExtractedFromDriveFileId || null,
      aiExtractionConfidence: aiExtractionConfidence != null ? Number(aiExtractionConfidence) : null,
      notes: notes || null,
    });
    res.status(201).json({ success: true, data: expense });
  } catch (err) {
    logger.error('[expenses] createExpense error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.updateExpense = async (req, res) => {
  try {
    const expense = await db.Expense.findByPk(req.params.id);
    if (!expense) return notFound(res, 'Expense');
    const allowed = [
      'entryDate', 'category', 'description',
      'originalCurrency', 'originalAmount', 'usdAmount', 'fxRateUsed',
      'customerId', 'factoryId', 'quotationId', 'purchaseOrderId', 'tripId', 'inspectorId',
      'submittingOfficeId', 'paidByOfficeId', 'paidAt', 'submissionStatus',
      'receiptDriveFileIds', 'aiExtractedFromDriveFileId', 'aiExtractionConfidence',
      'notes',
    ];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    if (updates.submissionStatus && !VALID_SUBMISSION_STATUS.includes(updates.submissionStatus)) {
      return badRequest(res, `submissionStatus must be one of: ${VALID_SUBMISSION_STATUS.join(', ')}`);
    }
    if (updates.originalCurrency) updates.originalCurrency = updates.originalCurrency.toUpperCase();
    // If the amount or currency changes and the caller didn't override usd/rate,
    // recompute the USD snapshot. Otherwise honor the explicit values.
    if ((updates.originalAmount != null || updates.originalCurrency) &&
        updates.usdAmount === undefined && updates.fxRateUsed === undefined) {
      const conv = await convertToUsd(
        updates.originalAmount ?? expense.originalAmount,
        updates.originalCurrency ?? expense.originalCurrency,
      );
      updates.usdAmount = conv.usdAmount;
      updates.fxRateUsed = conv.rate;
    }
    await expense.update(updates);
    res.json({ success: true, data: expense });
  } catch (err) {
    logger.error('[expenses] updateExpense error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await db.Expense.findByPk(req.params.id);
    if (!expense) return notFound(res, 'Expense');
    if (expense.submissionStatus === 'submitted' || expense.submissionStatus === 'paid') {
      return res.status(409).json({
        error: 'Cannot delete a submitted or paid expense. Mark not_claimable instead.',
      });
    }
    await expense.destroy();
    res.json({ success: true });
  } catch (err) {
    logger.error('[expenses] deleteExpense error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ─── ExpenseSubmission ───────────────────────────────────────────────────────

exports.listSubmissions = async (req, res) => {
  try {
    const where = {};
    if (req.query.officeId) where.officeId = req.query.officeId;
    const subs = await db.ExpenseSubmission.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, data: subs });
  } catch (err) {
    logger.error('[expenses] listSubmissions error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getSubmission = async (req, res) => {
  try {
    const sub = await db.ExpenseSubmission.findByPk(req.params.id, {
      include: db.Expense ? [{ model: db.Expense, as: 'expenses' }] : undefined,
    });
    if (!sub) return notFound(res, 'Submission');
    res.json({ success: true, data: sub });
  } catch (err) {
    logger.error('[expenses] getSubmission error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// Create a submission by selecting expenses (either explicit IDs or by
// office + period). The endpoint snapshots per-currency totals at creation
// time so the report stays stable.
exports.createSubmission = async (req, res) => {
  try {
    const { officeId, periodStart, periodEnd, expenseIds, notes } = req.body;
    if (!officeId) return badRequest(res, 'officeId is required');
    const office = await db.ReimbursementOffice.findByPk(officeId);
    if (!office) return notFound(res, 'Office');

    let expenseRows;
    if (Array.isArray(expenseIds) && expenseIds.length > 0) {
      expenseRows = await db.Expense.findAll({ where: { id: { [Op.in]: expenseIds } } });
    } else {
      const where = { submittingOfficeId: officeId, submissionStatus: 'draft' };
      if (periodStart) where.entryDate = { ...(where.entryDate || {}), [Op.gte]: periodStart };
      if (periodEnd) where.entryDate = { ...(where.entryDate || {}), [Op.lte]: periodEnd };
      expenseRows = await db.Expense.findAll({ where });
    }
    if (expenseRows.length === 0) {
      return badRequest(res, 'No expenses match the selection. Create some first or widen the period.');
    }

    // Snapshot per-currency totals.
    const totalsByCurrency = {};
    for (const e of expenseRows) {
      const c = e.originalCurrency || 'USD';
      totalsByCurrency[c] = (totalsByCurrency[c] || 0) + Number(e.originalAmount || 0);
    }
    Object.keys(totalsByCurrency).forEach(c => {
      totalsByCurrency[c] = Math.round(totalsByCurrency[c] * 100) / 100;
    });

    const sub = await db.ExpenseSubmission.create({
      officeId,
      userId: req.user.id,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
      submittedAt: null,
      paidAt: null,
      exportFileDriveFileId: null,
      totalsByCurrency,
      notes: notes || null,
    });

    // Stamp each expense with the batch ID + flip to submitted.
    await db.Expense.update(
      { submissionBatchId: sub.id, submissionStatus: 'submitted' },
      { where: { id: { [Op.in]: expenseRows.map(e => e.id) } } },
    );
    await sub.update({ submittedAt: new Date() });

    res.status(201).json({
      success: true,
      data: sub,
      message: `Submission created with ${expenseRows.length} expense(s).`,
    });
  } catch (err) {
    logger.error('[expenses] createSubmission error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.updateSubmission = async (req, res) => {
  try {
    const sub = await db.ExpenseSubmission.findByPk(req.params.id);
    if (!sub) return notFound(res, 'Submission');
    const allowed = ['paidAt', 'exportFileDriveFileId', 'notes'];
    const updates = {};
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    await sub.update(updates);

    // If marked paid, propagate to all expense rows in the batch.
    if (updates.paidAt) {
      await db.Expense.update(
        { paidAt: updates.paidAt, submissionStatus: 'paid', paidByOfficeId: sub.officeId },
        { where: { submissionBatchId: sub.id } },
      );
    }
    res.json({ success: true, data: sub });
  } catch (err) {
    logger.error('[expenses] updateSubmission error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
