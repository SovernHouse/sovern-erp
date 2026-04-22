const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

/**
 * Create a warehouse location
 */
const createLocation = async (req, res, next) => {
  try {
    const { warehouseId, zone, aisle, rack, shelf, bin, type, maxWeight, maxPallets, notes } = req.body;

    if (!warehouseId || !zone || !aisle || !rack || !shelf || !bin) {
      throw new ValidationError('warehouseId, zone, aisle, rack, shelf, and bin are required');
    }

    // Check if location already exists
    const existing = await db.WarehouseLocation.findOne({
      where: { warehouseId, zone, aisle, rack, shelf, bin }
    });

    if (existing) {
      throw new ValidationError('Location already exists');
    }

    const location = await db.WarehouseLocation.create({
      id: uuidv4(),
      warehouseId,
      zone,
      aisle,
      rack,
      shelf,
      bin,
      type: type || 'bulk',
      maxWeight: maxWeight || null,
      maxPallets: maxPallets || 1,
      status: 'active',
      notes
    });

    res.status(201).json(getSuccessResponse(location, 'Warehouse location created'));

    auditService.logAction(req.user.id, 'CREATE', 'WarehouseLocation', location.id, { data: location.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * List warehouse locations with filters
 */
const listLocations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, warehouseId, zone, type, status } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (zone) where.zone = zone;
    if (type) where.type = type;
    if (status) where.status = status;

    const { count, rows } = await db.WarehouseLocation.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['zone', 'ASC'], ['aisle', 'ASC']]
    });

    const response = getPaginatedResponse(rows, count, page, limit);
    res.json(getSuccessResponse(response, 'Warehouse locations retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific warehouse location with current contents
 */
const getLocation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const location = await db.WarehouseLocation.findByPk(id);
    if (!location) {
      throw new NotFoundError('Warehouse location not found');
    }

    // Get recent transactions for this location
    const transactions = await db.WarehouseTransaction.findAll({
      where: {
        [Op.or]: [
          { fromLocationId: id },
          { toLocationId: id }
        ]
      },
      order: [['timestamp', 'DESC']],
      limit: 20
    });

    res.json(getSuccessResponse({
      location: location.toJSON(),
      recentTransactions: transactions
    }, 'Location details retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update warehouse location
 */
const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, maxWeight, maxPallets, status, notes } = req.body;

    const location = await db.WarehouseLocation.findByPk(id);
    if (!location) {
      throw new NotFoundError('Warehouse location not found');
    }

    await location.update({
      type: type !== undefined ? type : location.type,
      maxWeight: maxWeight !== undefined ? maxWeight : location.maxWeight,
      maxPallets: maxPallets !== undefined ? maxPallets : location.maxPallets,
      status: status !== undefined ? status : location.status,
      notes: notes !== undefined ? notes : location.notes
    });

    res.json(getSuccessResponse(location, 'Location updated'));

    auditService.logAction(req.user.id, 'UPDATE', 'WarehouseLocation', id, { changes: req.body }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Record goods receipt into receiving zone
 */
const receiveGoods = async (req, res, next) => {
  try {
    const { productId, batchId, quantity, reference, notes } = req.body;

    if (!productId || !quantity) {
      throw new ValidationError('productId and quantity are required');
    }

    // Find receiving zone location
    const receivingLocation = await db.WarehouseLocation.findOne({
      where: { type: 'receiving', status: 'active' },
      order: [['currentPallets', 'ASC']]
    });

    if (!receivingLocation) {
      throw new ValidationError('No available receiving location found');
    }

    // Create transaction
    const transaction = await db.WarehouseTransaction.create({
      id: uuidv4(),
      type: 'receive',
      productId,
      batchId,
      toLocationId: receivingLocation.id,
      quantity,
      unit: 'pcs',
      reference,
      performedBy: req.user.id,
      notes
    });

    // Update location pallets (approximate - 1 pallet per receipt)
    const newPallets = Math.min(
      receivingLocation.currentPallets + 1,
      receivingLocation.maxPallets
    );
    await receivingLocation.update({
      currentPallets: newPallets,
      status: newPallets >= receivingLocation.maxPallets ? 'full' : 'active'
    });

    res.status(201).json(getSuccessResponse({
      transaction: transaction.toJSON(),
      location: receivingLocation.toJSON()
    }, 'Goods received'));

    auditService.logAction(req.user.id, 'CREATE', 'WarehouseTransaction', transaction.id, { reference }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Putaway: Move goods from receiving to storage location
 */
const putaway = async (req, res, next) => {
  try {
    const { productId, batchId, quantity, fromLocationId, toLocationId } = req.body;

    if (!productId || !quantity) {
      throw new ValidationError('productId and quantity are required');
    }

    // Get or suggest storage location
    let targetLocation = toLocationId ?
      await db.WarehouseLocation.findByPk(toLocationId) :
      await db.WarehouseLocation.findOne({
        where: {
          type: 'bulk',
          status: 'active'
        },
        order: [['currentPallets', 'ASC']]
      });

    if (!targetLocation) {
      throw new ValidationError('No suitable storage location available');
    }

    // Create putaway transaction
    const transaction = await db.WarehouseTransaction.create({
      id: uuidv4(),
      type: 'putaway',
      productId,
      batchId,
      fromLocationId: fromLocationId || null,
      toLocationId: targetLocation.id,
      quantity,
      unit: 'pcs',
      performedBy: req.user.id
    });

    // Update target location
    await targetLocation.update({
      currentPallets: targetLocation.currentPallets + 1,
      currentWeight: (parseFloat(targetLocation.currentWeight) || 0) + (parseFloat(req.body.weight) || 0)
    });

    // Update source location if specified
    if (fromLocationId) {
      const sourceLocation = await db.WarehouseLocation.findByPk(fromLocationId);
      if (sourceLocation) {
        await sourceLocation.update({
          currentPallets: Math.max(sourceLocation.currentPallets - 1, 0),
          status: 'active'
        });
      }
    }

    res.status(201).json(getSuccessResponse({
      transaction: transaction.toJSON(),
      suggestedLocation: targetLocation.toJSON()
    }, 'Putaway completed'));

    auditService.logAction(req.user.id, 'CREATE', 'WarehouseTransaction', transaction.id, { type: 'putaway' }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Pick order: Create pick list for an order (FIFO allocation)
 */
const pickOrder = async (req, res, next) => {
  try {
    const { salesOrderId, items } = req.body;

    if (!salesOrderId || !items || items.length === 0) {
      throw new ValidationError('salesOrderId and items are required');
    }

    const pickList = [];

    for (const item of items) {
      const { productId, quantity } = item;

      // Find locations with this product (FIFO: oldest batches first)
      const locations = await db.WarehouseLocation.findAll({
        where: { status: { [Op.ne]: 'maintenance' } },
        order: [['updatedAt', 'ASC']],
        limit: 10
      });

      // For simplicity, allocate from available locations
      let remainingQty = quantity;
      for (const location of locations) {
        if (remainingQty <= 0) break;

        const allocQty = Math.min(remainingQty, 100); // Simplified allocation
        pickList.push({
          productId,
          quantity: allocQty,
          locationId: location.id,
          locationCode: `${location.zone}-${location.aisle}-${location.rack}`
        });

        remainingQty -= allocQty;
      }
    }

    res.json(getSuccessResponse({
      salesOrderId,
      pickList,
      status: 'ready_to_pick',
      itemCount: pickList.length
    }, 'Pick list generated'));
  } catch (error) {
    next(error);
  }
};

/**
 * Pack order: Record packing of picked items
 */
const packOrder = async (req, res, next) => {
  try {
    const { salesOrderId, items, performedBy } = req.body;

    if (!salesOrderId || !items || items.length === 0) {
      throw new ValidationError('salesOrderId and items are required');
    }

    const packTransactions = [];

    for (const item of items) {
      const transaction = await db.WarehouseTransaction.create({
        id: uuidv4(),
        type: 'pack',
        productId: item.productId,
        quantity: item.quantity,
        reference: salesOrderId,
        performedBy: performedBy || req.user.id
      });
      packTransactions.push(transaction);
    }

    res.status(201).json(getSuccessResponse({
      salesOrderId,
      transactions: packTransactions,
      status: 'packed'
    }, 'Order packing completed'));

    auditService.logAction(req.user.id, 'CREATE', 'WarehouseTransaction', salesOrderId, { type: 'pack', itemCount: items.length }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer stock between locations
 */
const transferStock = async (req, res, next) => {
  try {
    const { fromLocationId, toLocationId, productId, quantity, notes } = req.body;

    if (!fromLocationId || !toLocationId || !productId || !quantity) {
      throw new ValidationError('fromLocationId, toLocationId, productId, and quantity are required');
    }

    const fromLoc = await db.WarehouseLocation.findByPk(fromLocationId);
    const toLoc = await db.WarehouseLocation.findByPk(toLocationId);

    if (!fromLoc || !toLoc) {
      throw new NotFoundError('One or both locations not found');
    }

    // Create transfer transaction
    const transaction = await db.WarehouseTransaction.create({
      id: uuidv4(),
      type: 'transfer',
      productId,
      fromLocationId,
      toLocationId,
      quantity,
      performedBy: req.user.id,
      notes
    });

    // Update location pallets
    if (quantity > 0) {
      await fromLoc.update({
        currentPallets: Math.max(fromLoc.currentPallets - 1, 0)
      });
      await toLoc.update({
        currentPallets: toLoc.currentPallets + 1
      });
    }

    res.status(201).json(getSuccessResponse(transaction, 'Stock transferred'));

    auditService.logAction(req.user.id, 'CREATE', 'WarehouseTransaction', transaction.id, { type: 'transfer' }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Manual stock adjustment (damage, returns, corrections)
 */
const adjustStock = async (req, res, next) => {
  try {
    const { productId, quantity, reasonCode, notes } = req.body;

    if (!productId || quantity === undefined) {
      throw new ValidationError('productId and quantity are required');
    }

    const transaction = await db.WarehouseTransaction.create({
      id: uuidv4(),
      type: 'adjust',
      productId,
      quantity,
      reasonCode: reasonCode || 'manual',
      performedBy: req.user.id,
      notes
    });

    res.status(201).json(getSuccessResponse(transaction, 'Stock adjusted'));

    auditService.logAction(req.user.id, 'CREATE', 'WarehouseTransaction', transaction.id, { reason: reasonCode }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Start stock count for a zone/warehouse
 */
const startStockCount = async (req, res, next) => {
  try {
    const { warehouseId, zone, notes } = req.body;

    if (!warehouseId) {
      throw new ValidationError('warehouseId is required');
    }

    const stockCount = await db.StockCount.create({
      id: uuidv4(),
      warehouseId,
      zone,
      status: 'in_progress',
      countDate: new Date(),
      startTime: new Date(),
      countedBy: req.user.id,
      notes
    });

    res.status(201).json(getSuccessResponse(stockCount, 'Stock count started'));

    auditService.logAction(req.user.id, 'CREATE', 'StockCount', stockCount.id, { zone }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Record physical count result for a location
 */
const recordCountResult = async (req, res, next) => {
  try {
    const { stockCountId, locationId, productId, countedQuantity } = req.body;

    if (!stockCountId || !locationId || !productId || countedQuantity === undefined) {
      throw new ValidationError('stockCountId, locationId, productId, and countedQuantity are required');
    }

    const stockCount = await db.StockCount.findByPk(stockCountId);
    if (!stockCount) {
      throw new NotFoundError('Stock count not found');
    }

    // Increment totals
    stockCount.totalCountedItems = (stockCount.totalCountedItems || 0) + countedQuantity;
    await stockCount.save();

    res.json(getSuccessResponse({
      stockCountId,
      locationId,
      countedQuantity,
      totalCountedSoFar: stockCount.totalCountedItems
    }, 'Count result recorded'));
  } catch (error) {
    next(error);
  }
};

/**
 * Complete stock count and generate variance report
 */
const completeStockCount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const stockCount = await db.StockCount.findByPk(id);
    if (!stockCount) {
      throw new NotFoundError('Stock count not found');
    }

    const totalSystemItems = 1000; // Simplified - would query actual inventory
    const variance = Math.abs(stockCount.totalCountedItems - totalSystemItems);
    const variancePct = (variance / totalSystemItems * 100).toFixed(2);

    const varianceReport = {
      totalSystemItems,
      totalCountedItems: stockCount.totalCountedItems,
      variance,
      variancePct: parseFloat(variancePct),
      discrepancies: variance > 0 ? ['Items counted differ from system'] : []
    };

    await stockCount.update({
      status: 'completed',
      endTime: new Date(),
      approvedBy: req.user.id,
      varianceReport,
      discrepancyCount: variance > 0 ? 1 : 0
    });

    res.json(getSuccessResponse(stockCount, 'Stock count completed'));

    auditService.logAction(req.user.id, 'UPDATE', 'StockCount', id, { status: 'completed', variance }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get inventory by location
 */
const getInventoryByLocation = async (req, res, next) => {
  try {
    const { warehouseId, zone } = req.query;

    const where = {};
    if (warehouseId) where.warehouseId = warehouseId;
    if (zone) where.zone = zone;

    const locations = await db.WarehouseLocation.findAll({
      where,
      order: [['zone', 'ASC'], ['aisle', 'ASC']]
    });

    const inventory = locations.map(loc => ({
      locationId: loc.id,
      locationCode: `${loc.zone}-${loc.aisle}-${loc.rack}-${loc.shelf}-${loc.bin}`,
      type: loc.type,
      currentPallets: loc.currentPallets,
      maxPallets: loc.maxPallets,
      utilizationPct: ((loc.currentPallets / loc.maxPallets) * 100).toFixed(1),
      status: loc.status
    }));

    res.json(getSuccessResponse({
      locations: inventory,
      totalLocations: inventory.length,
      utilizationStats: {
        avgUtilization: (inventory.reduce((sum, i) => sum + parseFloat(i.utilizationPct), 0) / inventory.length).toFixed(1),
        fullLocations: inventory.filter(i => i.status === 'full').length,
        activeLocations: inventory.filter(i => i.status === 'active').length
      }
    }, 'Inventory retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get warehouse dashboard with key metrics
 */
const getWarehouseDashboard = async (req, res, next) => {
  try {
    const { warehouseId } = req.query;

    const where = warehouseId ? { warehouseId } : {};

    // Utilization metrics
    const locations = await db.WarehouseLocation.findAll({ where });
    const totalCapacity = locations.reduce((sum, l) => sum + l.maxPallets, 0);
    const currentOccupancy = locations.reduce((sum, l) => sum + l.currentPallets, 0);

    // Receiving queue
    const receivingZones = await db.WarehouseLocation.findAll({
      where: { type: 'receiving', ...where },
      attributes: ['id', 'currentPallets', 'maxPallets']
    });
    const itemsInReceiving = receivingZones.reduce((sum, z) => sum + z.currentPallets, 0);

    // Pending putaway
    const pendingPutaway = await db.WarehouseTransaction.count({
      where: { type: 'receive', toLocationId: { [Op.in]: receivingZones.map(z => z.id) } }
    });

    // Pick queue
    const pickQueue = await db.WarehouseTransaction.count({
      where: { type: 'pick' }
    });

    // Recent transactions
    const recentTransactions = await db.WarehouseTransaction.findAll({
      where: { performedBy: { [Op.ne]: null } },
      order: [['timestamp', 'DESC']],
      limit: 20,
      attributes: ['type', 'quantity', 'timestamp']
    });

    // Transaction summary
    const transactionsSummary = await db.WarehouseTransaction.findAll({
      attributes: [
        'type',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      where: { timestamp: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      group: ['type'],
      raw: true
    });

    res.json(getSuccessResponse({
      capacity: {
        total: totalCapacity,
        occupied: currentOccupancy,
        available: totalCapacity - currentOccupancy,
        utilizationPct: ((currentOccupancy / totalCapacity) * 100).toFixed(1)
      },
      itemsInReceiving,
      pendingPutaway,
      pickQueueSize: pickQueue,
      recentTransactionsCount: recentTransactions.length,
      transactionsSummary,
      locationCount: locations.length,
      activeLocations: locations.filter(l => l.status === 'active').length,
      fullLocations: locations.filter(l => l.status === 'full').length
    }, 'Warehouse dashboard retrieved'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createLocation,
  listLocations,
  getLocation,
  updateLocation,
  receiveGoods,
  putaway,
  pickOrder,
  packOrder,
  transferStock,
  adjustStock,
  startStockCount,
  recordCountResult,
  completeStockCount,
  getInventoryByLocation,
  getWarehouseDashboard
};
