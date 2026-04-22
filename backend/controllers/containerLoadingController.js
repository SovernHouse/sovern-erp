const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

// Container type specifications
const CONTAINER_SPECS = {
  '20ft': {
    internalLength: 5.90,
    internalWidth: 2.35,
    internalHeight: 2.38,
    maxPayloadWeight: 21700,
    volume: 33.2,
    standardPalletCapacity: 10,
    type: '20ft'
  },
  '40ft': {
    internalLength: 12.03,
    internalWidth: 2.35,
    internalHeight: 2.38,
    maxPayloadWeight: 26680,
    volume: 67.6,
    standardPalletCapacity: 20,
    type: '40ft'
  },
  '40ft_hc': {
    internalLength: 12.03,
    internalWidth: 2.35,
    internalHeight: 2.70,
    maxPayloadWeight: 26460,
    volume: 76.3,
    standardPalletCapacity: 22,
    type: '40ft_hc'
  }
};

// EUR Pallet dimensions: 1.2m x 1.0m x 0.144m (standard)
const PALLET_DIMS = { length: 1.2, width: 1.0, height: 0.144 };

const getContainerTypes = async (req, res, next) => {
  try {
    const configs = await db.ContainerConfiguration.findAll({
      where: { isActive: true },
      order: [['containerType', 'ASC']]
    });

    const types = configs.length > 0 ? configs : Object.values(CONTAINER_SPECS).map(spec => ({
      containerType: spec.type,
      internalLength: spec.internalLength,
      internalWidth: spec.internalWidth,
      internalHeight: spec.internalHeight,
      maxPayloadWeight: spec.maxPayloadWeight,
      volume: spec.volume,
      standardPalletCapacity: spec.standardPalletCapacity
    }));

    res.json(getSuccessResponse(types, 'Container types retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const getContainerTypeConfig = async (req, res, next) => {
  try {
    const { type } = req.params;

    if (!CONTAINER_SPECS[type]) {
      throw new ValidationError('Invalid container type');
    }

    const config = await db.ContainerConfiguration.findOne({
      where: { containerType: type }
    });

    const result = config || CONTAINER_SPECS[type];

    res.json(getSuccessResponse(result, 'Container type configuration retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const calculateLoading = async (req, res, next) => {
  try {
    const { containerType, items } = req.body;

    if (!CONTAINER_SPECS[containerType]) {
      throw new ValidationError('Invalid container type');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items array is required and must not be empty');
    }

    const specs = CONTAINER_SPECS[containerType];
    let totalWeight = 0;
    let totalVolume = 0;
    let totalPallets = 0;
    const loadingDetails = [];

    for (const item of items) {
      const { productBatchId, quantity } = item;

      const batch = await db.ProductBatch.findByPk(productBatchId);
      if (!batch) {
        throw new NotFoundError(`Batch ${productBatchId} not found`);
      }

      const product = await db.Product.findByPk(batch.productId);
      const spec = await db.ProductSpecification.findOne({
        where: { productId: batch.productId }
      });

      if (!spec) {
        throw new NotFoundError(`Specifications not found for product ${batch.productId}`);
      }

      // Tiles weight: 25-30 kg/sqm (assume middle value 27.5)
      const weightPerSqm = 27.5;
      const itemWeight = quantity * weightPerSqm;
      const itemVolume = quantity * (spec.length / 1000) * (spec.width / 1000) * (spec.thickness / 1000);

      totalWeight += itemWeight;
      totalVolume += itemVolume;

      // Calculate pallets for this item (2-3 pallets high typical for tiles)
      const sqmPerPallet = 1.2 * 1.0 / ((spec.length / 1000) * (spec.width / 1000));
      const palletsNeeded = Math.ceil(quantity / sqmPerPallet);

      loadingDetails.push({
        batchNumber: batch.batchNumber,
        productName: product.name,
        productSku: product.sku,
        quantity,
        unit: batch.unit,
        weight: itemWeight,
        volume: itemVolume,
        pallets: palletsNeeded,
        tileSize: `${spec.length}x${spec.width}x${spec.thickness}`
      });

      totalPallets += palletsNeeded;
    }

    const weightUtilization = (totalWeight / specs.maxPayloadWeight) * 100;
    const volumeUtilization = (totalVolume / specs.volume) * 100;
    const maxUtilization = Math.max(weightUtilization, volumeUtilization);

    const recommendation = maxUtilization > 100 ? 'EXCEEDS_CAPACITY' : 'OK';

    const result = {
      containerType,
      containerSpecs: specs,
      totalWeight: Math.round(totalWeight * 100) / 100,
      totalVolume: Math.round(totalVolume * 100) / 100,
      totalPallets,
      weightUtilizationPercent: Math.round(weightUtilization * 100) / 100,
      volumeUtilizationPercent: Math.round(volumeUtilization * 100) / 100,
      utilizationPercent: Math.round(maxUtilization * 100) / 100,
      limitingFactor: weightUtilization > volumeUtilization ? 'weight' : 'volume',
      recommendation,
      loadingDetails
    };

    res.json(getSuccessResponse(result, 'Loading calculation completed'));
  } catch (error) {
    next(error);
  }
};

const optimizeLoading = async (req, res, next) => {
  try {
    const { items, maxContainers } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items array is required');
    }

    // Calculate per item
    const itemDetails = [];
    let totalWeight = 0;
    let totalVolume = 0;

    for (const item of items) {
      const batch = await db.ProductBatch.findByPk(item.productBatchId);
      if (!batch) continue;

      const product = await db.Product.findByPk(batch.productId);
      const spec = await db.ProductSpecification.findOne({
        where: { productId: batch.productId }
      });

      if (!spec) continue;

      const weightPerSqm = 27.5;
      const weight = item.quantity * weightPerSqm;
      const volume = item.quantity * (spec.length / 1000) * (spec.width / 1000) * (spec.thickness / 1000);

      totalWeight += weight;
      totalVolume += volume;

      itemDetails.push({
        batchId: item.productBatchId,
        batchNumber: batch.batchNumber,
        productName: product.name,
        quantity: item.quantity,
        weight,
        volume
      });
    }

    // Recommend best container type
    let recommendedType = '40ft_hc';
    for (const [type, specs] of Object.entries(CONTAINER_SPECS)) {
      if (totalWeight <= specs.maxPayloadWeight && totalVolume <= specs.volume) {
        recommendedType = type;
        break;
      }
    }

    // Calculate number of containers needed
    const specs = CONTAINER_SPECS[recommendedType];
    const containersNeeded = Math.ceil(Math.max(
      totalWeight / specs.maxPayloadWeight,
      totalVolume / specs.volume
    ));

    const result = {
      recommendedContainerType: recommendedType,
      containerSpecs: specs,
      containerCountNeeded: containersNeeded,
      totalWeight: Math.round(totalWeight * 100) / 100,
      totalVolume: Math.round(totalVolume * 100) / 100,
      weightPerContainer: Math.round((totalWeight / containersNeeded) * 100) / 100,
      volumePerContainer: Math.round((totalVolume / containersNeeded) * 100) / 100,
      itemDetails
    };

    res.json(getSuccessResponse(result, 'Loading optimization completed'));
  } catch (error) {
    next(error);
  }
};

const createContainer = async (req, res, next) => {
  try {
    const { containerNumber, containerType, shipmentId, purchaseOrderId, destinationPort } = req.body;

    if (!CONTAINER_SPECS[containerType]) {
      throw new ValidationError('Invalid container type');
    }

    const existing = await db.Container.findOne({
      where: { containerNumber }
    });

    if (existing) {
      throw new ValidationError('Container number already exists');
    }

    const specs = CONTAINER_SPECS[containerType];

    const container = await db.Container.create({
      id: uuidv4(),
      containerNumber,
      containerType,
      containerStatus: 'available',
      shipmentId,
      purchaseOrderId,
      destinationPort,
      maxWeight: specs.maxPayloadWeight,
      cargoWeight: 0,
      usedCapacity: 0,
      palletCount: 0,
      createdBy: req.user?.id
    });

    const result = await db.Container.findByPk(container.id);

    res.status(201).json(getSuccessResponse(result, 'Container created successfully'));

    auditService.logAction(req.user?.id, 'CREATE', 'Container', container.id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getContainers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, type, search } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (status) where.containerStatus = status;
    if (type) where.containerType = type;

    if (search) {
      where[Op.or] = [
        { containerNumber: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await db.Container.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, page, limit));
  } catch (error) {
    next(error);
  }
};

const getContainerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const container = await db.Container.findByPk(id);

    if (!container) {
      throw new NotFoundError('Container not found');
    }

    res.json(getSuccessResponse(container, 'Container retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const updateContainer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const container = await db.Container.findByPk(id);

    if (!container) {
      throw new NotFoundError('Container not found');
    }

    const allowedUpdates = [
      'destinationPort',
      'etd',
      'eta',
      'cargoWeight',
      'usedCapacity',
      'palletCount',
      'loadingWarehouse',
      'notes',
      'carrier',
      'vessel',
      'voyage'
    ];

    const filteredUpdates = {};
    allowedUpdates.forEach(key => {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    });

    await container.update(filteredUpdates);

    const result = await db.Container.findByPk(id);

    res.json(getSuccessResponse(result, 'Container updated successfully'));

    auditService.logAction(req.user?.id, 'UPDATE', 'Container', id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const updateContainerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['available', 'planning', 'loading', 'loaded', 'in_transit', 'delivered', 'empty', 'maintenance'];

    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status value');
    }

    const container = await db.Container.findByPk(id);

    if (!container) {
      throw new NotFoundError('Container not found');
    }

    await container.update({ containerStatus: status });

    const result = await db.Container.findByPk(id);

    res.json(getSuccessResponse(result, 'Container status updated successfully'));

    auditService.logAction(req.user?.id, 'UPDATE', 'Container', id, { status }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const addItemsToContainer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    const container = await db.Container.findByPk(id);

    if (!container) {
      throw new NotFoundError('Container not found');
    }

    let totalWeight = 0;
    let totalPallets = 0;

    for (const item of items) {
      const batch = await db.ProductBatch.findByPk(item.productBatchId);
      if (batch) {
        const weightPerSqm = 27.5;
        totalWeight += item.quantity * weightPerSqm;
        totalPallets += Math.ceil(item.quantity / 10); // rough estimate
      }
    }

    const newWeight = container.cargoWeight + totalWeight;

    if (newWeight > container.maxWeight) {
      throw new ValidationError('Adding items would exceed container weight capacity');
    }

    const newCapacity = (newWeight / container.maxWeight) * 100;

    await container.update({
      cargoWeight: newWeight,
      usedCapacity: newCapacity,
      palletCount: container.palletCount + totalPallets
    });

    const result = await db.Container.findByPk(id);

    res.json(getSuccessResponse(result, 'Items added to container successfully'));

    auditService.logAction(req.user?.id, 'UPDATE', 'Container', id, { itemsAdded: items.length }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

const getManifest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const container = await db.Container.findByPk(id);

    if (!container) {
      throw new NotFoundError('Container not found');
    }

    const manifest = {
      containerNumber: container.containerNumber,
      containerType: container.containerType,
      status: container.containerStatus,
      cargoWeight: container.cargoWeight,
      maxWeight: container.maxWeight,
      usedCapacity: container.usedCapacity,
      palletCount: container.palletCount,
      destinationPort: container.destinationPort,
      etd: container.etd,
      eta: container.eta,
      seal1: container.seal1,
      seal2: container.seal2,
      carrier: container.carrier,
      vessel: container.vessel,
      voyage: container.voyage,
      notes: container.notes
    };

    res.json(getSuccessResponse(manifest, 'Container manifest retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const getLoadingRecommendations = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items array is required');
    }

    const recommendations = [];

    for (const [type, specs] of Object.entries(CONTAINER_SPECS)) {
      let totalWeight = 0;
      let totalVolume = 0;

      for (const item of items) {
        const batch = await db.ProductBatch.findByPk(item.productBatchId);
        if (!batch) continue;

        const spec = await db.ProductSpecification.findOne({
          where: { productId: batch.productId }
        });

        if (!spec) continue;

        const weightPerSqm = 27.5;
        const weight = item.quantity * weightPerSqm;
        const volume = item.quantity * (spec.length / 1000) * (spec.width / 1000) * (spec.thickness / 1000);

        totalWeight += weight;
        totalVolume += volume;
      }

      const weightUtil = (totalWeight / specs.maxPayloadWeight) * 100;
      const volumeUtil = (totalVolume / specs.volume) * 100;

      recommendations.push({
        containerType: type,
        containerSpecs: specs,
        weight: Math.round(totalWeight * 100) / 100,
        volume: Math.round(totalVolume * 100) / 100,
        weightUtilization: Math.round(weightUtil * 100) / 100,
        volumeUtilization: Math.round(volumeUtil * 100) / 100,
        isFeasible: totalWeight <= specs.maxPayloadWeight && totalVolume <= specs.volume
      });
    }

    const feasible = recommendations.filter(r => r.isFeasible).sort((a, b) => {
      const aUtil = Math.max(a.weightUtilization, a.volumeUtilization);
      const bUtil = Math.max(b.weightUtilization, b.volumeUtilization);
      return bUtil - aUtil; // Higher utilization first
    });

    res.json(getSuccessResponse(feasible, 'Loading recommendations retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

const calculateUtilization = async (req, res, next) => {
  try {
    const { containerType, items } = req.body;

    if (!CONTAINER_SPECS[containerType]) {
      throw new ValidationError('Invalid container type');
    }

    const specs = CONTAINER_SPECS[containerType];
    let totalWeight = 0;
    let totalVolume = 0;

    for (const item of items) {
      const batch = await db.ProductBatch.findByPk(item.productBatchId);
      if (!batch) continue;

      const spec = await db.ProductSpecification.findOne({
        where: { productId: batch.productId }
      });

      if (!spec) continue;

      const weightPerSqm = 27.5;
      const weight = item.quantity * weightPerSqm;
      const volume = item.quantity * (spec.length / 1000) * (spec.width / 1000) * (spec.thickness / 1000);

      totalWeight += weight;
      totalVolume += volume;
    }

    const result = {
      containerType,
      containerSpecs: specs,
      totalWeight: Math.round(totalWeight * 100) / 100,
      totalVolume: Math.round(totalVolume * 100) / 100,
      weightUtilizationPercent: Math.round((totalWeight / specs.maxPayloadWeight) * 10000) / 100,
      volumeUtilizationPercent: Math.round((totalVolume / specs.volume) * 10000) / 100,
      remainingWeight: Math.round((specs.maxPayloadWeight - totalWeight) * 100) / 100,
      remainingVolume: Math.round((specs.volume - totalVolume) * 100) / 100
    };

    res.json(getSuccessResponse(result, 'Utilization metrics calculated successfully'));
  } catch (error) {
    next(error);
  }
};

const getStatistics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const containers = await db.Container.findAll({ where });

    const stats = {
      totalContainers: containers.length,
      byType: {
        '20ft': containers.filter(c => c.containerType === '20ft').length,
        '40ft': containers.filter(c => c.containerType === '40ft').length,
        '40ft_hc': containers.filter(c => c.containerType === '40ft_hc').length
      },
      byStatus: {
        available: containers.filter(c => c.containerStatus === 'available').length,
        loading: containers.filter(c => c.containerStatus === 'loading').length,
        loaded: containers.filter(c => c.containerStatus === 'loaded').length,
        in_transit: containers.filter(c => c.containerStatus === 'in_transit').length,
        delivered: containers.filter(c => c.containerStatus === 'delivered').length
      },
      avgUtilization: containers.length > 0 ?
        Math.round((containers.reduce((sum, c) => sum + c.usedCapacity, 0) / containers.length) * 100) / 100 :
        0
    };

    res.json(getSuccessResponse(stats, 'Container statistics retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getContainerTypes,
  getContainerTypeConfig,
  calculateLoading,
  optimizeLoading,
  createContainer,
  getContainers,
  getContainerById,
  updateContainer,
  updateContainerStatus,
  addItemsToContainer,
  getManifest,
  getLoadingRecommendations,
  calculateUtilization,
  getStatistics
};
