const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { v4: uuidv4 } = require('uuid');
const { NotFoundError } = require('../middleware/errorHandler');
const documentGenerator = require('../services/documentGenerator');

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, salesOrderId } = req.query;
    const { offset } = getPagination(page, limit);
    const where = { deletedAt: null };
    if (status) where.status = status;
    if (salesOrderId) where.salesOrderId = salesOrderId;

    const { count, rows } = await db.PackingList.findAndCountAll({
      where,
      include: [
        { model: db.SalesOrder, as: 'salesOrder', attributes: ['orderNumber'] }
      ],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const pl = await db.PackingList.findByPk(req.params.id, {
      include: [
        { association: 'items', include: [{ model: db.Product, as: 'product' }] },
        { model: db.SalesOrder, as: 'salesOrder' }
      ]
    });

    if (!pl || pl.deletedAt) throw new NotFoundError('Packing List not found');
    res.json(getSuccessResponse(pl));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { salesOrderId, items } = req.body;

    const so = await db.SalesOrder.findByPk(salesOrderId);
    if (!so) throw new NotFoundError('Sales Order not found');

    let totalPackages = 0;
    let totalGrossWeight = 0;
    let totalNetWeight = 0;
    let totalVolume = 0;

    const pl = await db.PackingList.create({
      id: uuidv4(),
      packingListNumber: `PL-${Date.now()}`,
      salesOrderId,
      status: 'draft',
      totalPackages: 0,
      totalGrossWeight: 0,
      totalNetWeight: 0,
      totalVolume: 0
    });

    for (const item of items) {
      const product = await db.Product.findByPk(item.productId);
      totalPackages += 1;
      totalGrossWeight += parseFloat(item.grossWeight || 0);
      totalNetWeight += parseFloat(item.netWeight || 0);
      totalVolume += parseFloat(item.dimensions?.volume || 0);

      await db.PackingListItem.create({
        id: uuidv4(),
        packingListId: pl.id,
        productId: item.productId,
        description: product?.name || item.description,
        quantity: item.quantity,
        unit: item.unit,
        packageNumber: item.packageNumber,
        grossWeight: item.grossWeight,
        netWeight: item.netWeight,
        dimensions: item.dimensions || {},
        marks: item.marks
      });
    }

    await pl.update({
      totalPackages,
      totalGrossWeight,
      totalNetWeight,
      totalVolume
    });

    res.status(201).json(getSuccessResponse(pl, 'Packing List created'));
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/confirm', requireAuth, async (req, res, next) => {
  try {
    const pl = await db.PackingList.findByPk(req.params.id);
    if (!pl || pl.deletedAt) throw new NotFoundError('Packing List not found');

    await pl.update({ status: 'confirmed' });
    res.json(getSuccessResponse(pl, 'Packing List confirmed'));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    const pl = await db.PackingList.findByPk(req.params.id, {
      include: [{ association: 'items', include: [{ model: db.Product, as: 'product' }] }]
    });

    if (!pl || pl.deletedAt) throw new NotFoundError('Packing List not found');

    const pdfFile = await documentGenerator.generatePackingListPDF(pl, pl.items);
    res.json(getSuccessResponse({ pdfFile }));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const pl = await db.PackingList.findByPk(req.params.id);
    if (!pl || pl.deletedAt) throw new NotFoundError('Packing List not found');

    const beforeSnapshot = pl.toJSON();

    await pl.update({ deletedAt: new Date() });

    res.json(getSuccessResponse({ id: pl.id }, 'Packing List deleted'));

    // Fire-and-forget audit log
    const auditService = require('../services/auditService');
    auditService.logAction(req.user.id, 'DELETE', 'PackingList', pl.id, { before: beforeSnapshot }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

module.exports = router;
