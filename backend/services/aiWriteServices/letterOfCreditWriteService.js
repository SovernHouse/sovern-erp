/**
 * letterOfCreditWriteService — Phase 4.15b-2.
 *
 * Wraps LetterOfCredit + LetterOfCreditDocument. Seven tools:
 *   - createLetterOfCredit    — draft LC (status='draft')
 *   - submitLetterOfCredit    — draft → submitted (records who submitted)
 *   - approveLetterOfCredit   — submitted → approved (super_admin gate,
 *                                self-approval blocked: approver !== creator
 *                                of the submission; matches the 4.15d-1
 *                                InternalApproval pattern for high-stakes
 *                                financial instruments)
 *   - attachLcDocument        — create LetterOfCreditDocument row
 *   - recordLcPayment         — capture presentedAmount/paidAmount + dates,
 *                                auto-promotes status: approved → presented
 *                                (after presentedAmount set) → paid (after
 *                                paidAmount set; matches the LC tolerance
 *                                rule when applicable)
 *   - listLettersOfCredit     — filter by status/customer/supplier/expiry
 *   - getLetterOfCredit       — eager-load documents + customer + supplier
 *
 * State machine (LetterOfCredit.status):
 *   draft → submitted → approved → active → presented → paid
 *                ↘ cancelled                ↘ expired (auto, set by expiry sweep)
 *
 * Tolerance check on payment: when toleranceType='percentage', the paid
 * amount must fall within amount ± tolerance%. When toleranceType='amount',
 * paid amount within amount ± tolerance USD. Outside tolerance returns
 * validation error pointing at discrepancy.
 *
 * Return shape mirrors aiWriteServices:
 *   { ok: true, ...data, before?, after? }
 *   { ok: false, code, httpStatus, message }
 *
 * Audit trail: callers are expected to record ai_assistant_* AuditLog rows
 * via auditAiWrite in the MCP handler (this service stays focused on the
 * business rules + Sequelize work, no AuditLog writes inside the service).
 *
 * The creator → approver tracking is done via the LC's notes field
 * appending `[submitted_by: <uuid>]` on submit; approveLetterOfCredit
 * parses that marker to enforce self-approval prevention. This matches
 * the pattern used in Phase 4.15d-1 for InternalApproval but adapts to
 * LetterOfCredit's existing schema (no requestedBy/approvedBy columns).
 */

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../../models');

function err(code, httpStatus, message) {
  return { ok: false, code, httpStatus, message };
}

const VALID_LC_TYPES = new Set(['sight', 'usance', 'revolving', 'standby']);
const VALID_LC_STATUSES = new Set(['draft', 'submitted', 'approved', 'active', 'presented', 'paid', 'cancelled', 'expired']);
const VALID_PAYMENT_TERMS = new Set(['at_sight', 'days_30', 'days_60', 'days_90', 'days_120']);
const VALID_TOLERANCE_TYPES = new Set(['percentage', 'amount']);
const VALID_DOCUMENT_TYPES = new Set(['invoice', 'bill_of_lading', 'packing_list', 'certificate_of_origin', 'inspection_report', 'insurance_document', 'draft', 'amendment', 'other']);
const VALID_DOCUMENT_STATUSES = new Set(['pending', 'verified', 'rejected', 'discrepancy_found']);

const SUBMITTED_BY_RE = /\[submitted_by:\s*([0-9a-fA-F-]{36})\]/;

function appendSubmissionMarker(notes, submitterId) {
  const marker = `[submitted_by: ${submitterId}]`;
  if (!notes) return marker;
  if (SUBMITTED_BY_RE.test(notes)) {
    return notes.replace(SUBMITTED_BY_RE, marker);
  }
  return `${notes}\n${marker}`;
}

function extractSubmitterId(notes) {
  if (!notes) return null;
  const match = notes.match(SUBMITTED_BY_RE);
  return match ? match[1] : null;
}

// ── createLetterOfCredit ─────────────────────────────────────────────

async function createLetterOfCredit(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const {
    lcNumber, supplierId, customerId, issuingBank, advisingBank,
    beneficiary, amount, currency, issueDate, expiryDate,
    type, terms, paymentTerms, tolerance, toleranceType,
    partialShipment, transhipmentAllowed, incoterm, notes,
  } = payload;

  if (!supplierId) return err('validation', 400, 'supplierId is required');
  if (!customerId) return err('validation', 400, 'customerId is required');
  if (!issuingBank) return err('validation', 400, 'issuingBank is required');
  if (!beneficiary) return err('validation', 400, 'beneficiary is required');
  if (amount === undefined || amount === null || Number(amount) <= 0) {
    return err('validation', 400, 'amount is required and must be > 0.');
  }
  if (!issueDate) return err('validation', 400, 'issueDate is required');
  if (!expiryDate) return err('validation', 400, 'expiryDate is required');
  if (new Date(expiryDate) <= new Date(issueDate)) {
    return err('validation', 400, 'expiryDate must be after issueDate.');
  }
  if (type !== undefined && !VALID_LC_TYPES.has(type)) {
    return err('validation', 400, `type must be one of: ${[...VALID_LC_TYPES].join(', ')}.`);
  }
  if (paymentTerms !== undefined && !VALID_PAYMENT_TERMS.has(paymentTerms)) {
    return err('validation', 400,
      `paymentTerms must be one of: ${[...VALID_PAYMENT_TERMS].join(', ')}.`);
  }
  if (toleranceType !== undefined && !VALID_TOLERANCE_TYPES.has(toleranceType)) {
    return err('validation', 400,
      `toleranceType must be one of: ${[...VALID_TOLERANCE_TYPES].join(', ')}.`);
  }

  const [supplier, customer] = await Promise.all([
    db.Factory.findByPk(supplierId),
    db.Customer.findByPk(customerId),
  ]);
  if (!supplier) return err('not_found', 404, `Factory (supplier) ${supplierId} not found.`);
  if (!customer) return err('not_found', 404, `Customer ${customerId} not found.`);

  const number = lcNumber || `LC-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
  const dup = await db.LetterOfCredit.findOne({ where: { lcNumber: number } });
  if (dup) {
    return err('validation', 409,
      `LetterOfCredit "${number}" already exists. Use a unique lcNumber or omit to auto-generate.`);
  }

  const lc = await db.LetterOfCredit.create({
    id: uuidv4(),
    lcNumber: number,
    supplierId,
    customerId,
    issuingBank,
    advisingBank: advisingBank || null,
    beneficiary,
    amount,
    currency: currency || 'USD',
    issueDate: new Date(issueDate),
    expiryDate: new Date(expiryDate),
    status: 'draft',
    type: type || 'sight',
    terms: terms || null,
    paymentTerms: paymentTerms || 'at_sight',
    tolerance: tolerance !== undefined ? tolerance : 0,
    toleranceType: toleranceType || 'percentage',
    partialShipment: partialShipment === true,
    transhipmentAllowed: transhipmentAllowed === true,
    incoterm: incoterm || null,
    notes: notes || null,
  });
  return { ok: true, lc };
}

// ── submitLetterOfCredit ─────────────────────────────────────────────

async function submitLetterOfCredit(id, ctx) {
  if (!id) return err('validation', 400, 'id is required');
  const submitterId = ctx?.userId;
  if (!submitterId) return err('validation', 400, 'ctx.userId required (submitter identity).');

  const lc = await db.LetterOfCredit.findByPk(id);
  if (!lc) return err('not_found', 404, `LetterOfCredit ${id} not found.`);
  if (lc.status !== 'draft') {
    return err('validation', 400,
      `Cannot submit LC from status "${lc.status}". Only "draft" letters of credit can be submitted.`);
  }

  const before = lc.toJSON();
  await lc.update({
    status: 'submitted',
    notes: appendSubmissionMarker(lc.notes, submitterId),
  });
  return { ok: true, lc, before, after: lc.toJSON() };
}

// ── approveLetterOfCredit ────────────────────────────────────────────

async function approveLetterOfCredit(id, ctx) {
  if (!id) return err('validation', 400, 'id is required');
  const approverId = ctx?.userId;
  if (!approverId) return err('validation', 400, 'ctx.userId required (approver identity).');

  const lc = await db.LetterOfCredit.findByPk(id);
  if (!lc) return err('not_found', 404, `LetterOfCredit ${id} not found.`);
  if (lc.status !== 'submitted') {
    return err('validation', 400,
      `Cannot approve LC from status "${lc.status}". Only "submitted" letters of credit can be approved.`);
  }

  // Self-approval block (matches Phase 4.15d-1 InternalApproval pattern).
  const submitterId = extractSubmitterId(lc.notes);
  if (submitterId && submitterId === approverId) {
    return err('forbidden', 403,
      `Self-approval is not permitted. The user who submitted the LC (${submitterId}) cannot also approve it. A different user must approve.`);
  }

  // Super-admin role gate is enforced at the MCP layer; this service
  // accepts whoever the caller specifies and trusts the wrapper. We do
  // not require ctx.userRole here to keep the service independently
  // testable.
  const before = lc.toJSON();
  await lc.update({ status: 'approved' });
  return { ok: true, lc, before, after: lc.toJSON() };
}

// ── attachLcDocument ─────────────────────────────────────────────────

async function attachLcDocument(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { letterOfCreditId, documentType, fileName, fileUrl, documentNumber, status, remarks } = payload;
  if (!letterOfCreditId) return err('validation', 400, 'letterOfCreditId is required');
  if (!documentType || !VALID_DOCUMENT_TYPES.has(documentType)) {
    return err('validation', 400,
      `documentType must be one of: ${[...VALID_DOCUMENT_TYPES].join(', ')}.`);
  }
  if (!fileName) return err('validation', 400, 'fileName is required');
  if (!fileUrl) return err('validation', 400, 'fileUrl is required');
  if (status !== undefined && !VALID_DOCUMENT_STATUSES.has(status)) {
    return err('validation', 400,
      `status must be one of: ${[...VALID_DOCUMENT_STATUSES].join(', ')}.`);
  }

  const lc = await db.LetterOfCredit.findByPk(letterOfCreditId);
  if (!lc) return err('not_found', 404, `LetterOfCredit ${letterOfCreditId} not found.`);

  const doc = await db.LetterOfCreditDocument.create({
    id: uuidv4(),
    letterOfCreditId,
    documentType,
    documentNumber: documentNumber || null,
    fileName,
    fileUrl,
    uploadedBy: ctx?.userId || null,
    status: status || 'pending',
    remarks: remarks || null,
  });
  return { ok: true, document: doc };
}

// ── recordLcPayment ──────────────────────────────────────────────────

async function recordLcPayment(id, payload, ctx) {
  if (!id) return err('validation', 400, 'id is required');
  payload = payload || {};
  const { presentedAmount, presentedDate, paidAmount, paidDate } = payload;

  const lc = await db.LetterOfCredit.findByPk(id);
  if (!lc) return err('not_found', 404, `LetterOfCredit ${id} not found.`);
  if (!['approved', 'active', 'presented'].includes(lc.status)) {
    return err('validation', 400,
      `Cannot record payment on LC in status "${lc.status}". The LC must be approved/active/presented first.`);
  }

  const before = lc.toJSON();
  const patch = {};
  let nextStatus = lc.status;

  if (presentedAmount !== undefined && presentedAmount !== null) {
    if (Number(presentedAmount) <= 0) {
      return err('validation', 400, 'presentedAmount must be > 0.');
    }
    patch.presentedAmount = presentedAmount;
    patch.presentedDate = presentedDate ? new Date(presentedDate) : new Date();
    if (lc.status === 'approved' || lc.status === 'active') {
      nextStatus = 'presented';
    }
  }

  if (paidAmount !== undefined && paidAmount !== null) {
    if (Number(paidAmount) <= 0) {
      return err('validation', 400, 'paidAmount must be > 0.');
    }
    // Tolerance check against the LC amount.
    const baseAmount = Number(lc.amount);
    const tol = Number(lc.tolerance || 0);
    const diff = Math.abs(Number(paidAmount) - baseAmount);
    const allowedDiff = lc.toleranceType === 'percentage'
      ? (baseAmount * tol / 100)
      : tol;
    if (diff > allowedDiff + 0.001) {
      return err('validation', 400,
        `paidAmount ${paidAmount} is outside the LC tolerance window (base ${baseAmount}, allowed ± ${allowedDiff.toFixed(2)}, actual diff ${diff.toFixed(2)}). A discrepancy needs to be resolved before recording payment.`);
    }
    patch.paidAmount = paidAmount;
    patch.paidDate = paidDate ? new Date(paidDate) : new Date();
    nextStatus = 'paid';
  }

  patch.status = nextStatus;
  await lc.update(patch);
  return { ok: true, lc, before, after: lc.toJSON() };
}

// ── listLettersOfCredit ──────────────────────────────────────────────

async function listLettersOfCredit(filters) {
  filters = filters || {};
  const where = {};
  if (filters.status) {
    if (!VALID_LC_STATUSES.has(filters.status)) {
      return err('validation', 400,
        `status must be one of: ${[...VALID_LC_STATUSES].join(', ')}.`);
    }
    where.status = filters.status;
  }
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.type) where.type = filters.type;
  if (filters.issuingBank) where.issuingBank = { [Op.like]: `%${filters.issuingBank}%` };
  if (filters.expiringBefore) {
    where.expiryDate = { [Op.lte]: new Date(filters.expiringBefore) };
  }
  if (filters.search) {
    where[Op.or] = [
      { lcNumber: { [Op.like]: `%${filters.search}%` } },
      { beneficiary: { [Op.like]: `%${filters.search}%` } },
    ];
  }
  const rows = await db.LetterOfCredit.findAll({
    where,
    limit: Math.min(filters.limit || 25, 100),
    order: [['issueDate', 'DESC'], ['createdAt', 'DESC']],
  });
  return { ok: true, letters: rows };
}

// ── getLetterOfCredit ────────────────────────────────────────────────

async function getLetterOfCredit(id) {
  if (!id) return err('validation', 400, 'id is required');
  const lc = await db.LetterOfCredit.findByPk(id, {
    include: [
      { model: db.LetterOfCreditDocument, as: 'documents' },
      { model: db.Customer, as: 'customer' },
      { model: db.Factory, as: 'supplier' },
    ],
  });
  if (!lc) return err('not_found', 404, `LetterOfCredit ${id} not found.`);
  return { ok: true, lc };
}

module.exports = {
  createLetterOfCredit,
  submitLetterOfCredit,
  approveLetterOfCredit,
  attachLcDocument,
  recordLcPayment,
  listLettersOfCredit,
  getLetterOfCredit,
  VALID_LC_STATUSES,
  VALID_LC_TYPES,
  extractSubmitterId,
};
