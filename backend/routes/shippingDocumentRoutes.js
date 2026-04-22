const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const { getSuccessResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError } = require('../middleware/errorHandler');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { salesOrderId } = req.query;
    const where = {};
    if (salesOrderId) where.salesOrderId = salesOrderId;

    const documents = await db.ShippingDocument.findAll({
      where,
      include: [
        { model: db.SalesOrder, as: 'salesOrder', attributes: ['orderNumber'] },
        { model: db.User, as: 'uploader', attributes: ['firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(documents));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, uploadSingle('document'), async (req, res, next) => {
  try {
    const { salesOrderId, type, documentNumber, notes } = req.body;

    const so = await db.SalesOrder.findByPk(salesOrderId);
    if (!so) throw new NotFoundError('Sales Order not found');

    const doc = await db.ShippingDocument.create({
      id: uuidv4(),
      salesOrderId,
      type,
      documentNumber,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
      uploadedBy: req.user.id,
      notes,
      issuedDate: new Date()
    });

    res.status(201).json(getSuccessResponse(doc, 'Document uploaded'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.ShippingDocument.findByPk(req.params.id);
    if (!doc) throw new NotFoundError('Document not found');

    res.json(getSuccessResponse(doc));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const doc = await db.ShippingDocument.findByPk(req.params.id);
    if (!doc) throw new NotFoundError('Document not found');

    await doc.destroy();
    res.json(getSuccessResponse(null, 'Document deleted'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
