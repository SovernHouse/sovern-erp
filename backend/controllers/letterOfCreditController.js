const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const { generateNumberWithCounter, incrementCounter } = require('../services/numberGenerator');

/**
 * Create a new Letter of Credit
 */
const create = async (req, res, next) => {
  try {
    const {
      lcNumber,
      supplierId,
      customerId,
      issuingBank,
      advisingBank,
      beneficiary,
      amount,
      currency,
      expiryDate,
      issueDate,
      type,
      paymentTerms,
      tolerance,
      toleranceType,
      partialShipment,
      transhipmentAllowed,
      incoterm,
      terms,
      notes
    } = req.body;

    // Verify supplier and customer exist
    const supplier = await db.Factory.findByPk(supplierId);
    if (!supplier) {
      throw new NotFoundError('Supplier not found');
    }

    const customer = await db.Customer.findByPk(customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Check if LC number already exists
    const existingLC = await db.LetterOfCredit.findOne({ where: { lcNumber } });
    if (existingLC) {
      throw new Error('LC number already exists');
    }

    const lc = await db.LetterOfCredit.create({
      id: uuidv4(),
      lcNumber,
      supplierId,
      customerId,
      issuingBank,
      advisingBank: advisingBank || null,
      beneficiary,
      amount,
      currency: currency || 'USD',
      issueDate: issueDate || new Date(),
      expiryDate,
      status: 'draft',
      type: type || 'sight',
      paymentTerms: paymentTerms || 'at_sight',
      tolerance: tolerance || 0,
      toleranceType: toleranceType || 'percentage',
      partialShipment: partialShipment || false,
      transhipmentAllowed: transhipmentAllowed || false,
      incoterm: incoterm || null,
      terms,
      notes
    });

    const result = await db.LetterOfCredit.findByPk(lc.id, {
      include: [
        { model: db.Factory, as: 'supplier' },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Letter of Credit created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'LetterOfCredit', lc.id, { data: result?.toJSON?.() || lc.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Letters of Credit with filters and pagination
 */
const getAll = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, supplierId, customerId, search, startDate, endDate } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (customerId) where.customerId = customerId;
    if (search) where.lcNumber = { [Op.like]: `%${search}%` };
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) where.issueDate[Op.gte] = new Date(startDate);
      if (endDate) where.issueDate[Op.lte] = new Date(endDate);
    }

    const { count, rows } = await db.LetterOfCredit.findAndCountAll({
      where,
      include: [
        { model: db.Factory, as: 'supplier', attributes: ['id', 'name'] },
        { model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] }
      ],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

/**
 * Get LC by ID with documents
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lc = await db.LetterOfCredit.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' },
        { model: db.Customer, as: 'customer' },
        { model: db.LetterOfCreditDocument, as: 'documents' }
      ]
    });

    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    res.json(getSuccessResponse(lc));
  } catch (error) {
    next(error);
  }
};

/**
 * Update LC details (only if draft/pending)
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, expiryDate, paymentTerms, tolerance, terms, notes } = req.body;

    const lc = await db.LetterOfCredit.findByPk(id);
    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    // Only allow editing draft status
    if (!['draft', 'submitted'].includes(lc.status)) {
      throw new Error('Can only edit LC in draft or submitted status');
    }

    const beforeSnapshot = lc.toJSON();

    await lc.update({
      amount: amount !== undefined ? amount : lc.amount,
      expiryDate: expiryDate || lc.expiryDate,
      paymentTerms: paymentTerms || lc.paymentTerms,
      tolerance: tolerance !== undefined ? tolerance : lc.tolerance,
      terms: terms || lc.terms,
      notes: notes || lc.notes
    });

    const result = await db.LetterOfCredit.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.json(getSuccessResponse(result, 'Letter of Credit updated successfully'));

    auditService.logAction(req.user.id, 'UPDATE', 'LetterOfCredit', id, { before: beforeSnapshot, after: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Update LC status with status transitions
 * Allowed transitions:
 * draft → submitted
 * submitted → approved
 * approved → active
 * active → presented
 * presented → paid
 * Any → cancelled/expired
 */
const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const lc = await db.LetterOfCredit.findByPk(id);
    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    const validStatuses = ['draft', 'submitted', 'approved', 'active', 'presented', 'paid', 'cancelled', 'expired'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Valid statuses are: ${validStatuses.join(', ')}`);
    }

    // Validate status transitions
    const transitionMap = {
      'draft': ['submitted', 'cancelled'],
      'submitted': ['approved', 'cancelled'],
      'approved': ['active', 'cancelled'],
      'active': ['presented', 'amended', 'cancelled', 'expired'],
      'presented': ['paid', 'cancelled'],
      'amended': ['active', 'cancelled'],
      'paid': ['expired'],
      'cancelled': [],
      'expired': []
    };

    if (!transitionMap[lc.status] || !transitionMap[lc.status].includes(status)) {
      throw new Error(`Cannot transition from ${lc.status} to ${status}`);
    }

    const beforeStatus = lc.status;
    await lc.update({ status });

    const result = await db.LetterOfCredit.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.json(getSuccessResponse(result, `Letter of Credit status updated to ${status}`));

    auditService.logAction(req.user.id, 'UPDATE', 'LetterOfCredit', id, { statusChange: { before: beforeStatus, after: status } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Amend LC - Create amendment record with version tracking
 */
const amend = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amendments, reason } = req.body;

    const lc = await db.LetterOfCredit.findByPk(id);
    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    if (!['active', 'presented'].includes(lc.status)) {
      throw new Error('Can only amend active or presented LCs');
    }

    // Create amendment document
    const amendment = await db.LetterOfCreditDocument.create({
      id: uuidv4(),
      letterOfCreditId: id,
      documentType: 'amendment',
      documentNumber: `AMD-${lc.lcNumber}-${Date.now()}`,
      fileName: `Amendment_${lc.lcNumber}.json`,
      fileUrl: `/documents/amendments/${lc.id}/amendment_${Date.now()}.json`,
      uploadedBy: req.user.id,
      status: 'pending',
      remarks: JSON.stringify({
        amendmentDetails: amendments,
        reason,
        amendmentDate: new Date(),
        version: 1
      })
    });

    // Update LC with amended status
    const beforeStatus = lc.status;
    await lc.update({ status: 'amended' });

    const result = await db.LetterOfCredit.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' },
        { model: db.Customer, as: 'customer' },
        { model: db.LetterOfCreditDocument, as: 'documents' }
      ]
    });

    res.json(getSuccessResponse(result, 'Amendment created and LC status updated'));

    auditService.logAction(req.user.id, 'UPDATE', 'LetterOfCredit', id, { action: 'amendment', amendments, documentId: amendment.id }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Submit LC for approval
 */
const submit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lc = await db.LetterOfCredit.findByPk(id);
    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    if (lc.status !== 'draft') {
      throw new Error('Can only submit draft LCs');
    }

    const beforeStatus = lc.status;
    await lc.update({ status: 'submitted' });

    const result = await db.LetterOfCredit.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.json(getSuccessResponse(result, 'Letter of Credit submitted for approval'));

    auditService.logAction(req.user.id, 'UPDATE', 'LetterOfCredit', id, { statusChange: { before: beforeStatus, after: 'submitted' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Present documents for LC
 */
const presentDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { documents } = req.body;

    const lc = await db.LetterOfCredit.findByPk(id);
    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    if (!['active', 'amended'].includes(lc.status)) {
      throw new Error('Can only present documents for active or amended LCs');
    }

    let totalPresentedAmount = 0;
    const createdDocs = [];

    for (const doc of documents) {
      const lcDoc = await db.LetterOfCreditDocument.create({
        id: uuidv4(),
        letterOfCreditId: id,
        documentType: doc.documentType,
        documentNumber: doc.documentNumber || null,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        uploadedBy: req.user.id,
        status: 'pending',
        remarks: doc.remarks || null
      });
      createdDocs.push(lcDoc);
    }

    const beforeStatus = lc.status;
    totalPresentedAmount = lc.amount;

    await lc.update({
      status: 'presented',
      presentedAmount: totalPresentedAmount,
      presentedDate: new Date()
    });

    const result = await db.LetterOfCredit.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' },
        { model: db.Customer, as: 'customer' },
        { model: db.LetterOfCreditDocument, as: 'documents' }
      ]
    });

    res.json(getSuccessResponse(result, 'Documents presented for LC'));

    auditService.logAction(req.user.id, 'UPDATE', 'LetterOfCredit', id, { action: 'presentDocuments', documentCount: createdDocs.length, statusChange: { before: beforeStatus, after: 'presented' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Settle/Pay LC
 */
const settle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    const lc = await db.LetterOfCredit.findByPk(id);
    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    if (lc.status !== 'presented') {
      throw new Error('Can only settle presented LCs');
    }

    // Check if settlement amount is within tolerance
    const toleranceAmount = lc.toleranceType === 'percentage'
      ? (lc.amount * lc.tolerance) / 100
      : lc.tolerance;

    const minAmount = lc.amount - toleranceAmount;
    const maxAmount = lc.amount + toleranceAmount;

    if (amount < minAmount || amount > maxAmount) {
      throw new Error(`Settlement amount must be between ${minAmount} and ${maxAmount}`);
    }

    const beforeStatus = lc.status;
    await lc.update({
      status: 'paid',
      paidAmount: amount,
      paidDate: new Date()
    });

    const result = await db.LetterOfCredit.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.json(getSuccessResponse(result, 'Letter of Credit settled successfully'));

    auditService.logAction(req.user.id, 'UPDATE', 'LetterOfCredit', id, { action: 'settlement', amount, statusChange: { before: beforeStatus, after: 'paid' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get LC documents
 */
const getDocuments = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lc = await db.LetterOfCredit.findByPk(id);
    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    const documents = await db.LetterOfCreditDocument.findAll({
      where: { letterOfCreditId: id },
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(documents));
  } catch (error) {
    next(error);
  }
};

/**
 * Upload/attach document to LC
 */
const uploadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { documentType, documentNumber, fileName, fileUrl, remarks } = req.body;

    const lc = await db.LetterOfCredit.findByPk(id);
    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    const validDocTypes = ['invoice', 'bill_of_lading', 'packing_list', 'certificate_of_origin', 'inspection_report', 'insurance_document', 'draft', 'amendment', 'other'];
    if (!validDocTypes.includes(documentType)) {
      throw new Error(`Invalid document type. Valid types are: ${validDocTypes.join(', ')}`);
    }

    const document = await db.LetterOfCreditDocument.create({
      id: uuidv4(),
      letterOfCreditId: id,
      documentType,
      documentNumber: documentNumber || null,
      fileName,
      fileUrl,
      uploadedBy: req.user.id,
      status: 'pending',
      remarks: remarks || null
    });

    const result = await db.LetterOfCreditDocument.findByPk(document.id);

    res.status(201).json(getSuccessResponse(result, 'Document uploaded successfully'));

    auditService.logAction(req.user.id, 'CREATE', 'LetterOfCreditDocument', document.id, { letterOfCreditId: id, documentType }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel LC
 */
const cancel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const lc = await db.LetterOfCredit.findByPk(id);
    if (!lc) {
      throw new NotFoundError('Letter of Credit not found');
    }

    if (lc.status === 'paid' || lc.status === 'cancelled') {
      throw new Error('Cannot cancel paid or already cancelled LCs');
    }

    const beforeStatus = lc.status;
    await lc.update({ status: 'cancelled' });

    // Create cancellation document for record
    await db.LetterOfCreditDocument.create({
      id: uuidv4(),
      letterOfCreditId: id,
      documentType: 'other',
      fileName: `Cancellation_${lc.lcNumber}.txt`,
      fileUrl: `/documents/cancellations/${lc.id}/cancellation_${Date.now()}.txt`,
      uploadedBy: req.user.id,
      status: 'verified',
      remarks: `Cancellation Reason: ${reason}`
    });

    const result = await db.LetterOfCredit.findByPk(id, {
      include: [
        { model: db.Factory, as: 'supplier' },
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.json(getSuccessResponse(result, 'Letter of Credit cancelled'));

    auditService.logAction(req.user.id, 'UPDATE', 'LetterOfCredit', id, { action: 'cancellation', reason, statusChange: { before: beforeStatus, after: 'cancelled' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  getAll,
  getById,
  update,
  updateStatus,
  amend,
  submit,
  presentDocuments,
  settle,
  getDocuments,
  uploadDocument,
  cancel
};
