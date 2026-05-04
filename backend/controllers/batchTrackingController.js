const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

const createBatch = async (req, res, next) => {
  try {
    const {
      batchNumber,
      productId,
      shadeCode,
      shadeName,
      caliberCode,
      productionDate,
      expiryDate,
      manufacturingLocation,
      totalQuantity,
      unit,
      supplierId,
      notes
    } = req.body;

    const product = await db.Product.findByPk(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const existing = await db.ProductBatch.findOne({
      where: { batchNumber }
    });
    if (existing) {
      throw new ValidationError('Batch number already exists');
    }

    const batch = await db.ProductBatch.create({
      id: uuidv4(),
      batchNumber,
      productId,
      shadeCode,
      shadeName,
      caliberCode,
      productionDate: new Date(productionDate),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      manufacturingLocation,
      totalQuantity: parseFloat(totalQuantity),
      unit: unit || 'sqm',
      quantityReceived: 0,
      quantityAllocated: 0,
      quantityAvailable: parseFloat(totalQuantity),
      supplierId,
      status: 'pending',
      qualityStatus: 'pending_inspection',
      notes,
      createdBy: req.user?.id
    });

    const result = await db.ProductBatch.findByPk(batch.id, {
      include: [
        { model: db.Product, as: 'product' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Batch created successfully'));

    auditService.logAction(req.user?.id, 'CREATE', 'ProductBatch', batch.id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getBatches = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, productId, status, shadeCode, search, dateFrom, dateTo } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (productId) where.productId = productId;
    if (status) where.status = status;
    if (shadeCode) where.shadeCode = shadeCode;

    if (dateFrom || dateTo) {
      where.productionDate = {};
      if (dateFrom) where.productionDate[Op.gte] = new Date(dateFrom);
      if (dateTo) where.productionDate[Op.lte] = new Date(dateTo);
    }

    if (search) {
      where[Op.or] = [
        { batchNumber: { [Op.like]: `%${search}%` } },
        { shadeCode: { [Op.like]: `%${search}%` } }
      ];
    }

    const [count, rows] = await Promise.all([
      db.ProductBatch.count({ where }),
      db.ProductBatch.findAll({
        where,
        include: [
          { model: db.Product, as: 'product' }
        ],
        offset,
        limit: parseInt(limit),
        order: [['productionDate', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
};

const getBatchById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const batch = await db.ProductBatch.findByPk(id, {
      include: [
        { model: db.Product, as: 'product' },
        { model: db.Factory, as: 'supplier' },
        { model: db.BatchAllocation, as: 'allocations' }
      ]
    });

    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    res.json(getSuccessResponse(batch, 'Batch retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const updateBatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const batch = await db.ProductBatch.findByPk(id);

    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const allowedUpdates = [
      'shadeName',
      'caliberCode',
      'expiryDate',
      'manufacturingLocation',
      'warehouseLocation',
      'notes'
    ];

    const filteredUpdates = {};
    allowedUpdates.forEach(key => {
      if (updates[key] !== undefined) {
        if (key === 'expiryDate') {
          filteredUpdates[key] = updates[key] ? new Date(updates[key]) : null;
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    });

    await batch.update(filteredUpdates);

    const result = await db.ProductBatch.findByPk(id, {
      include: [
        { model: db.Product, as: 'product' }
      ]
    });

    res.json(getSuccessResponse(result, 'Batch updated successfully'));

    auditService.logAction(req.user?.id, 'UPDATE', 'ProductBatch', id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getBatchesByProduct = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10, status, shadeCode } = req.query;
    const { offset } = getPagination(page, limit);

    const product = await db.Product.findByPk(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const where = { productId };
    if (status) where.status = status;
    if (shadeCode) where.shadeCode = shadeCode;

    const [count, rows] = await Promise.all([
      db.ProductBatch.count({ where }),
      db.ProductBatch.findAll({
        where,
        include: [
          { model: db.Product, as: 'product' }
        ],
        offset,
        limit: parseInt(limit),
        order: [['productionDate', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
};

const getBatchesByShade = async (req, res, next) => {
  try {
    const { shadeCode } = req.params;
    const { page = 1, limit = 10, productId } = req.query;
    const { offset } = getPagination(page, limit);

    const where = { shadeCode };
    if (productId) where.productId = productId;

    const [count, rows] = await Promise.all([
      db.ProductBatch.count({ where }),
      db.ProductBatch.findAll({
        where,
        include: [
          { model: db.Product, as: 'product' }
        ],
        offset,
        limit: parseInt(limit),
        order: [['productionDate', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'in_transit', 'received', 'stored', 'partially_allocated', 'fully_allocated', 'quarantined', 'expired'];

    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status value');
    }

    const batch = await db.ProductBatch.findByPk(id);

    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    await batch.update({ status });

    const result = await db.ProductBatch.findByPk(id, {
      include: [
        { model: db.Product, as: 'product' }
      ]
    });

    res.json(getSuccessResponse(result, 'Batch status updated successfully'));

    auditService.logAction(req.user?.id, 'UPDATE', 'ProductBatch', id, { status }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const updateQualityStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { qualityStatus, inspectionNotes } = req.body;

    const validStatuses = ['pending_inspection', 'approved', 'rejected', 'conditional_approval'];

    if (!validStatuses.includes(qualityStatus)) {
      throw new ValidationError('Invalid quality status value');
    }

    const batch = await db.ProductBatch.findByPk(id);

    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const updates = {
      qualityStatus,
      inspectionDate: new Date(),
      inspectionNotes: inspectionNotes || batch.inspectionNotes
    };

    await batch.update(updates);

    const result = await db.ProductBatch.findByPk(id, {
      include: [
        { model: db.Product, as: 'product' }
      ]
    });

    res.json(getSuccessResponse(result, 'Batch quality status updated successfully'));

    auditService.logAction(req.user?.id, 'UPDATE', 'ProductBatch', id, { qualityStatus }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const allocateBatch = async (req, res, next) => {
  try {
    const { id: batchId } = req.params;
    const { orderId, quantity, orderType } = req.body;

    const batch = await db.ProductBatch.findByPk(batchId);

    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const allocatedQty = parseFloat(quantity);

    if (allocatedQty > batch.quantityAvailable) {
      throw new ValidationError(`Available quantity is ${batch.quantityAvailable}, cannot allocate ${allocatedQty}`);
    }

    // Check shade consistency: warn if this batch's shade is different from other batches already allocated to this order
    if (orderType === 'sales' || orderType === 'purchase') {
      const existingAllocations = await db.BatchAllocation.findAll({
        where: {
          [Op.or]: [
            { salesOrderId: orderType === 'sales' ? orderId : null },
            { purchaseOrderId: orderType === 'purchase' ? orderId : null }
          ]
        },
        include: [
          { model: db.ProductBatch, as: 'batch', attributes: ['shadeCode'] }
        ]
      });

      const differentShades = existingAllocations.filter(a => a.batch.shadeCode !== batch.shadeCode);
      if (differentShades.length > 0) {
        // Log warning but allow (business decision)
        console.warn(`SHADE_MISMATCH: Order has batches with shade codes: ${differentShades.map(a => a.batch.shadeCode).join(', ')}, but allocating batch with shade: ${batch.shadeCode}`);
      }
    }

    const allocation = await db.BatchAllocation.create({
      id: uuidv4(),
      productBatchId: batchId,
      salesOrderId: orderType === 'sales' ? orderId : null,
      purchaseOrderId: orderType === 'purchase' ? orderId : null,
      allocatedQuantity: allocatedQty,
      unit: batch.unit,
      status: 'allocated',
      allocatedBy: req.user?.id
    });

    // Update batch quantities
    await batch.update({
      quantityAllocated: batch.quantityAllocated + allocatedQty,
      quantityAvailable: batch.quantityAvailable - allocatedQty,
      status: (batch.quantityAvailable - allocatedQty) === 0 ? 'fully_allocated' : 'partially_allocated'
    });

    const result = await db.BatchAllocation.findByPk(allocation.id, {
      include: [
        { model: db.ProductBatch, as: 'productBatch' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Batch allocated successfully'));

    auditService.logAction(req.user?.id, 'CREATE', 'BatchAllocation', allocation.id, {
      batchId,
      orderId,
      orderType,
      quantity: allocatedQty
    }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getBatchAllocations = async (req, res, next) => {
  try {
    const { id: batchId } = req.params;

    const batch = await db.ProductBatch.findByPk(batchId);

    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    const allocations = await db.BatchAllocation.findAll({
      where: { productBatchId: batchId },
      order: [['allocationDate', 'DESC']]
    });

    res.json(getSuccessResponse(allocations, 'Batch allocations retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const updateAllocationStatus = async (req, res, next) => {
  try {
    const { allocationId } = req.params;
    const { status, quantity } = req.body;

    const validStatuses = ['allocated', 'reserved', 'picked', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status value');
    }

    const allocation = await db.BatchAllocation.findByPk(allocationId);

    if (!allocation) {
      throw new NotFoundError('Allocation not found');
    }

    const updates = { status };

    if (status === 'picked' && quantity) {
      updates.pickedQuantity = parseFloat(quantity);
      updates.pickedDate = new Date();
    } else if (status === 'shipped' && quantity) {
      updates.shippedQuantity = parseFloat(quantity);
      updates.shippedDate = new Date();
    } else if (status === 'delivered' && quantity) {
      updates.deliveredQuantity = parseFloat(quantity);
      updates.deliveredDate = new Date();
    }

    await allocation.update(updates);

    const result = await db.BatchAllocation.findByPk(allocationId);

    res.json(getSuccessResponse(result, 'Allocation status updated successfully'));

    auditService.logAction(req.user?.id, 'UPDATE', 'BatchAllocation', allocationId, { status }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getInventorySummary = async (req, res, next) => {
  try {
    const { productId, warehouseLocation } = req.query;

    const where = {};
    if (productId) where.productId = productId;
    if (warehouseLocation) where.warehouseLocation = warehouseLocation;

    const batches = await db.ProductBatch.findAll({
      where,
      include: [{ model: db.Product, as: 'product' }],
      order: [['productId', 'ASC'], ['shadeCode', 'ASC']]
    });

    const summary = {};

    batches.forEach(batch => {
      const key = `${batch.productId}-${batch.shadeCode}`;
      if (!summary[key]) {
        summary[key] = {
          productId: batch.productId,
          productName: batch.product?.name,
          shadeCode: batch.shadeCode,
          shadeName: batch.shadeName,
          totalQuantity: 0,
          allocatedQuantity: 0,
          availableQuantity: 0,
          batches: []
        };
      }

      summary[key].totalQuantity += batch.totalQuantity;
      summary[key].allocatedQuantity += batch.quantityAllocated;
      summary[key].availableQuantity += batch.quantityAvailable;
      summary[key].batches.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        available: batch.quantityAvailable,
        allocated: batch.quantityAllocated,
        status: batch.status
      });
    });

    res.json(getSuccessResponse(Object.values(summary), 'Inventory summary retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const getShadeAvailability = async (req, res, next) => {
  try {
    const { productId } = req.query;

    const where = {};
    if (productId) where.productId = productId;

    const batches = await db.ProductBatch.findAll({
      where,
      attributes: ['shadeCode', 'shadeName'],
      raw: true,
      order: [['shadeCode', 'ASC']]
    });

    const shadeMap = {};

    for (const batch of batches) {
      if (!shadeMap[batch.shadeCode]) {
        shadeMap[batch.shadeCode] = {
          shadeCode: batch.shadeCode,
          shadeName: batch.shadeName,
          totalQuantity: 0
        };
      }

      shadeMap[batch.shadeCode].totalQuantity += batch.quantityAvailable;
    }

    const shades = Object.values(shadeMap).sort((a, b) => a.shadeCode.localeCompare(b.shadeCode));

    res.json(getSuccessResponse(shades, 'Shade availability retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBatch,
  getBatches,
  getBatchById,
  updateBatch,
  getBatchesByProduct,
  getBatchesByShade,
  updateStatus,
  updateQualityStatus,
  allocateBatch,
  getBatchAllocations,
  updateAllocationStatus,
  getInventorySummary,
  getShadeAvailability
};
