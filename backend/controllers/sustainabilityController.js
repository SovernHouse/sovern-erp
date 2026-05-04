const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

/**
 * Create or update sustainability record for a product
 * @route POST /api/sustainability
 */
const create = async (req, res, next) => {
  try {
    const { productId, carbonFootprint, recycledContent, localMaterials, energyRating, waterUsage, certifications, factoryEnvironmentalRating, transportEmissions, lastAuditDate, notes } = req.body;

    if (!productId) {
      throw new ValidationError('productId is required');
    }

    // Check product exists
    const product = await db.Product.findByPk(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Check if record already exists - if so, update instead
    const existing = await db.SustainabilityRecord.findOne({ where: { productId } });
    if (existing) {
      const beforeSnapshot = existing.toJSON();
      await existing.update({
        carbonFootprint: carbonFootprint !== undefined ? carbonFootprint : existing.carbonFootprint,
        recycledContent: recycledContent !== undefined ? recycledContent : existing.recycledContent,
        localMaterials: localMaterials !== undefined ? localMaterials : existing.localMaterials,
        energyRating: energyRating || existing.energyRating,
        waterUsage: waterUsage !== undefined ? waterUsage : existing.waterUsage,
        certifications: certifications || existing.certifications,
        factoryEnvironmentalRating: factoryEnvironmentalRating !== undefined ? factoryEnvironmentalRating : existing.factoryEnvironmentalRating,
        transportEmissions: transportEmissions !== undefined ? transportEmissions : existing.transportEmissions,
        lastAuditDate: lastAuditDate ? new Date(lastAuditDate) : existing.lastAuditDate,
        notes: notes !== undefined ? notes : existing.notes
      });

      const updated = await db.SustainabilityRecord.findByPk(existing.id);
      res.json(getSuccessResponse(updated, 'Sustainability record updated'));
      auditService.logAction(req.user.id, 'UPDATE', 'SustainabilityRecord', existing.id, { before: beforeSnapshot, after: updated.toJSON() }, req.ip).catch(() => {});
      return;
    }

    // Create new record
    const record = await db.SustainabilityRecord.create({
      id: uuidv4(),
      productId,
      carbonFootprint: carbonFootprint || null,
      recycledContent: recycledContent || null,
      localMaterials: localMaterials || null,
      energyRating: energyRating || null,
      waterUsage: waterUsage || null,
      certifications: certifications || [],
      factoryEnvironmentalRating: factoryEnvironmentalRating || null,
      transportEmissions: transportEmissions || null,
      lastAuditDate: lastAuditDate ? new Date(lastAuditDate) : null,
      notes: notes || null,
      isActive: true
    });

    res.status(201).json(getSuccessResponse(record, 'Sustainability record created'));
    auditService.logAction(req.user.id, 'CREATE', 'SustainabilityRecord', record.id, { data: record.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get sustainability data for a product
 * @route GET /api/sustainability/product/:productId
 */
const getProductSustainability = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const product = await db.Product.findByPk(productId);
    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const record = await db.SustainabilityRecord.findOne({
      where: { productId },
      include: [{ model: db.Product, as: 'product', attributes: ['name', 'sku'] }]
    });

    if (!record) {
      throw new NotFoundError('No sustainability record found for this product');
    }

    res.json(getSuccessResponse(record, 'Product sustainability data retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get sustainability report across all products
 * @route GET /api/sustainability/report
 */
const getSustainabilityReport = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    const [count, rows] = await Promise.all([
      db.SustainabilityRecord.count({ where: { isActive: true } }),
      db.SustainabilityRecord.findAll({
        where: { isActive: true },
        include: [{ model: db.Product, as: 'product', attributes: ['name', 'sku', 'category'] }],
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']]
      }),
    ]);

    // Calculate summary statistics
    const summary = {
      totalProducts: count,
      averageCarbon: rows.length > 0 ? (rows.reduce((sum, r) => sum + (parseFloat(r.carbonFootprint) || 0), 0) / rows.length).toFixed(2) : 0,
      averageRecycledContent: rows.length > 0 ? (rows.reduce((sum, r) => sum + (parseFloat(r.recycledContent) || 0), 0) / rows.length).toFixed(2) : 0,
      averageWaterUsage: rows.length > 0 ? (rows.reduce((sum, r) => sum + (parseFloat(r.waterUsage) || 0), 0) / rows.length).toFixed(2) : 0,
      certificationCounts: countCertifications(rows)
    };

    res.json(getPaginatedResponse({ records: rows, summary }, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate carbon footprint for a shipment
 * Based on distance, weight, and transport mode
 * @route POST /api/sustainability/calculate-shipment-carbon
 */
const calculateShipmentCarbon = async (req, res, next) => {
  try {
    const { shipmentId, items, distanceKm, transportMode, weight } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('items array is required');
    }

    if (!distanceKm || !transportMode) {
      throw new ValidationError('distanceKm and transportMode are required');
    }

    // Validate transport mode
    const validModes = ['truck', 'ship', 'air', 'rail', 'mixed'];
    if (!validModes.includes(transportMode)) {
      throw new ValidationError(`transportMode must be one of: ${validModes.join(', ')}`);
    }

    // Emission factors (kg CO2 per ton-km)
    const emissionFactors = {
      truck: 0.120,
      ship: 0.010,
      air: 0.750,
      rail: 0.030,
      mixed: 0.100 // Default average
    };

    const emissionFactor = emissionFactors[transportMode];

    // Get product sustainability data
    const productIds = items.map(item => item.productId);
    const sustainabilityRecords = await db.SustainabilityRecord.findAll({
      where: { productId: { [Op.in]: productIds } }
    });

    const recordMap = {};
    sustainabilityRecords.forEach(record => {
      recordMap[record.productId] = record;
    });

    // Calculate total carbon
    let totalCarbon = 0;
    const itemDetails = items.map(item => {
      const record = recordMap[item.productId];
      const productCarbon = record ? parseFloat(record.transportEmissions) || 0 : 0;
      const quantity = parseFloat(item.quantity) || 1;
      const itemCarbon = productCarbon * quantity;
      totalCarbon += itemCarbon;

      return {
        productId: item.productId,
        quantity,
        productTransportEmissions: productCarbon,
        totalItemEmissions: itemCarbon
      };
    });

    // Calculate distance-based emissions
    const shipmentWeight = weight || items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
    const tonKm = (shipmentWeight / 1000) * distanceKm;
    const distanceEmissions = tonKm * emissionFactor;

    const report = {
      shipmentId: shipmentId || null,
      distanceKm,
      transportMode,
      weight: shipmentWeight,
      emissionFactor,
      itemDetails,
      productEmissions: totalCarbon,
      distanceEmissions,
      totalCarbon: totalCarbon + distanceEmissions,
      carbonPerKm: ((totalCarbon + distanceEmissions) / distanceKm).toFixed(4),
      carbonPerUnit: shipmentWeight > 0 ? ((totalCarbon + distanceEmissions) / shipmentWeight).toFixed(4) : 0,
      recommendation: generateCarbonRecommendation(transportMode, totalCarbon + distanceEmissions)
    };

    res.json(getSuccessResponse(report, 'Shipment carbon footprint calculated'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update a sustainability record
 * @route PUT /api/sustainability/:id
 */
const update = async (req, res, next) => {
  try {
    const record = await db.SustainabilityRecord.findByPk(req.params.id);

    if (!record) {
      throw new NotFoundError('Sustainability record not found');
    }

    const beforeSnapshot = record.toJSON();

    const { carbonFootprint, recycledContent, localMaterials, energyRating, waterUsage, certifications, factoryEnvironmentalRating, transportEmissions, lastAuditDate, notes, isActive } = req.body;

    await record.update({
      ...(carbonFootprint !== undefined && { carbonFootprint }),
      ...(recycledContent !== undefined && { recycledContent }),
      ...(localMaterials !== undefined && { localMaterials }),
      ...(energyRating && { energyRating }),
      ...(waterUsage !== undefined && { waterUsage }),
      ...(certifications && { certifications }),
      ...(factoryEnvironmentalRating !== undefined && { factoryEnvironmentalRating }),
      ...(transportEmissions !== undefined && { transportEmissions }),
      ...(lastAuditDate && { lastAuditDate: new Date(lastAuditDate) }),
      ...(notes !== undefined && { notes }),
      ...(isActive !== undefined && { isActive })
    });

    const updated = await db.SustainabilityRecord.findByPk(req.params.id);

    res.json(getSuccessResponse(updated, 'Sustainability record updated'));
    auditService.logAction(req.user.id, 'UPDATE', 'SustainabilityRecord', record.id, { before: beforeSnapshot, after: updated.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a sustainability record
 * @route DELETE /api/sustainability/:id
 */
const delete_ = async (req, res, next) => {
  try {
    const record = await db.SustainabilityRecord.findByPk(req.params.id);

    if (!record) {
      throw new NotFoundError('Sustainability record not found');
    }

    const beforeSnapshot = record.toJSON();
    await record.update({ isActive: false });

    res.json(getSuccessResponse({ id: record.id }, 'Sustainability record deleted'));
    auditService.logAction(req.user.id, 'DELETE', 'SustainabilityRecord', record.id, { before: beforeSnapshot }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

// Helper functions

function countCertifications(records) {
  const counts = {};
  const certList = ['LEED', 'Green Guard', 'FSC', 'EU Ecolabel', 'Carbon Trust'];

  certList.forEach(cert => {
    counts[cert] = records.filter(r =>
      r.certifications && Array.isArray(r.certifications) && r.certifications.includes(cert)
    ).length;
  });

  return counts;
}

function generateCarbonRecommendation(transportMode, totalCarbon) {
  if (transportMode === 'air') {
    return 'High emissions: Consider sea freight for cost and carbon savings';
  } else if (transportMode === 'truck') {
    return 'Moderate emissions: Consider consolidating shipments or switching to rail';
  } else if (transportMode === 'ship') {
    return 'Low emissions: Excellent choice for carbon footprint';
  }
  return 'Consider carbon offset programs';
}

module.exports = {
  create,
  getProductSustainability,
  getSustainabilityReport,
  calculateShipmentCarbon,
  update,
  delete: delete_
};
