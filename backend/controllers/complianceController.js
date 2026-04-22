const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

/**
 * Check compliance for a shipment/order
 * Returns applicable requirements (anti-dumping, CPSC, CE marking, customs)
 */
const checkCompliance = async (req, res, next) => {
  try {
    const { shipmentId, productId, countryOrigin, countryDestination } = req.body;

    if (!shipmentId && !productId) {
      throw new ValidationError('Either shipmentId or productId is required');
    }

    if (!countryOrigin || !countryDestination) {
      throw new ValidationError('countryOrigin and countryDestination are required');
    }

    const requirements = [];
    const complianceChecks = {
      antiDumping: false,
      cpsc: false,
      ceMarking: false,
      customs: true
    };

    // Anti-dumping check: Chinese tiles to US market
    if (countryOrigin.toUpperCase() === 'CN' && countryDestination.toUpperCase() === 'US') {
      complianceChecks.antiDumping = true;
      requirements.push({
        type: 'anti_dumping',
        description: 'Anti-dumping duties apply for Chinese origin products to US market',
        dutyRate: 241, // Base rate
        antiDumpingRate: 305, // Anti-dumping rate
        riskLevel: 'high'
      });
    }

    // CPSC check: US market consumer products
    if (countryDestination.toUpperCase() === 'US') {
      complianceChecks.cpsc = true;
      requirements.push({
        type: 'cpsc',
        description: 'CPSC certification required for US market',
        riskLevel: 'medium'
      });
    }

    // CE marking check: EU market
    if (['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'DK', 'FI', 'SE', 'NO'].includes(countryDestination.toUpperCase())) {
      complianceChecks.ceMarking = true;
      requirements.push({
        type: 'ce_marking',
        description: 'CE marking required for EU market',
        riskLevel: 'high'
      });
    }

    // Customs check: always required
    requirements.push({
      type: 'customs',
      description: 'Standard customs documentation required',
      riskLevel: 'medium'
    });

    res.json(getSuccessResponse({
      shipmentId,
      productId,
      countryOrigin,
      countryDestination,
      requirements,
      complianceChecks,
      riskLevel: requirements.some(r => r.riskLevel === 'high') ? 'high' : 'medium'
    }, 'Compliance check completed'));

    // Fire-and-forget audit
    auditService.logAction(req.user.id, 'READ', 'ComplianceCheck', shipmentId || productId, {}, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Create a compliance record
 */
const createComplianceRecord = async (req, res, next) => {
  try {
    const { shipmentId, productId, type, countryOrigin, countryDestination, hsCode, dutyRate, antiDumpingRate, certificateNumber, notes } = req.body;

    if (!type || !countryOrigin || !countryDestination) {
      throw new ValidationError('type, countryOrigin, and countryDestination are required');
    }

    const record = await db.ComplianceRecord.create({
      id: uuidv4(),
      shipmentId,
      productId,
      type,
      status: 'pending',
      countryOrigin,
      countryDestination,
      hsCode,
      dutyRate: dutyRate || 0,
      antiDumpingRate: antiDumpingRate || 0,
      complianceDate: new Date(),
      certificateNumber,
      notes
    });

    res.status(201).json(getSuccessResponse(record, 'Compliance record created'));

    auditService.logAction(req.user.id, 'CREATE', 'ComplianceRecord', record.id, { data: record.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * List compliance records with filters
 */
const listComplianceRecords = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, type, shipmentId, productId, countryOrigin, countryDestination, startDate, endDate } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (shipmentId) where.shipmentId = shipmentId;
    if (productId) where.productId = productId;
    if (countryOrigin) where.countryOrigin = countryOrigin;
    if (countryDestination) where.countryDestination = countryDestination;

    if (startDate || endDate) {
      where.complianceDate = {};
      if (startDate) where.complianceDate[Op.gte] = new Date(startDate);
      if (endDate) where.complianceDate[Op.lte] = new Date(endDate);
    }

    const { count, rows } = await db.ComplianceRecord.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']]
    });

    const response = getPaginatedResponse(rows, count, page, limit);
    res.json(getSuccessResponse(response, 'Compliance records retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get compliance record by ID
 */
const getComplianceRecord = async (req, res, next) => {
  try {
    const { id } = req.params;

    const record = await db.ComplianceRecord.findByPk(id);
    if (!record) {
      throw new NotFoundError('Compliance record not found');
    }

    res.json(getSuccessResponse(record, 'Compliance record retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update compliance record
 */
const updateComplianceRecord = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, expiryDate, notes } = req.body;

    const record = await db.ComplianceRecord.findByPk(id);
    if (!record) {
      throw new NotFoundError('Compliance record not found');
    }

    await record.update({
      status: status || record.status,
      expiryDate: expiryDate || record.expiryDate,
      notes: notes || record.notes
    });

    res.json(getSuccessResponse(record, 'Compliance record updated'));

    auditService.logAction(req.user.id, 'UPDATE', 'ComplianceRecord', id, { changes: req.body }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get HS codes (Harmonized Tariff Codes)
 */
const getHSCodes = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, chapter } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (chapter) where.chapter = chapter;
    if (search) {
      where[Op.or] = [
        { code: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await db.HarmonizedCode.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['code', 'ASC']]
    });

    const response = getPaginatedResponse(rows, count, page, limit);
    res.json(getSuccessResponse(response, 'HS codes retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Create HS code entry
 */
const createHSCode = async (req, res, next) => {
  try {
    const { code, description, chapter, heading, subheading, dutyRate, antiDumpingRate, countrySpecific, notes } = req.body;

    if (!code || !description) {
      throw new ValidationError('code and description are required');
    }

    // Check if code already exists
    const existing = await db.HarmonizedCode.findOne({ where: { code } });
    if (existing) {
      throw new ValidationError('HS code already exists');
    }

    const hsCode = await db.HarmonizedCode.create({
      id: uuidv4(),
      code,
      description,
      chapter,
      heading,
      subheading,
      dutyRate: dutyRate || 0,
      antiDumpingRate: antiDumpingRate || 0,
      countrySpecific,
      notes
    });

    res.status(201).json(getSuccessResponse(hsCode, 'HS code created'));

    auditService.logAction(req.user.id, 'CREATE', 'HarmonizedCode', hsCode.id, { data: hsCode.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate duties for a given HS code, origin, and destination
 */
const calculateDuties = async (req, res, next) => {
  try {
    const { hsCode, countryOrigin, countryDestination, unitPrice, quantity } = req.body;

    if (!hsCode || !countryOrigin || !countryDestination) {
      throw new ValidationError('hsCode, countryOrigin, and countryDestination are required');
    }

    const harmonizedCode = await db.HarmonizedCode.findOne({ where: { code: hsCode } });
    if (!harmonizedCode) {
      throw new NotFoundError('HS code not found');
    }

    let dutyRate = harmonizedCode.dutyRate;
    let antiDumpingRate = harmonizedCode.antiDumpingRate;

    // Check country-specific duties
    if (harmonizedCode.countrySpecific && harmonizedCode.countrySpecific[countryOrigin.toUpperCase()]) {
      const countryRates = harmonizedCode.countrySpecific[countryOrigin.toUpperCase()];
      dutyRate = countryRates.dutyRate || dutyRate;
      antiDumpingRate = countryRates.antiDumpingRate || antiDumpingRate;
    }

    const totalDutyRate = parseFloat(dutyRate) + parseFloat(antiDumpingRate);
    const dutyAmount = unitPrice && quantity ? (parseFloat(unitPrice) * parseInt(quantity) * totalDutyRate / 100) : 0;

    res.json(getSuccessResponse({
      hsCode,
      description: harmonizedCode.description,
      countryOrigin,
      countryDestination,
      baseRate: dutyRate,
      antiDumpingRate,
      totalDutyRate,
      unitPrice,
      quantity,
      dutyAmount: dutyAmount.toFixed(2)
    }, 'Duty calculation completed'));
  } catch (error) {
    next(error);
  }
};

/**
 * Generate Certificate of Origin
 */
const generateCertificateOfOrigin = async (req, res, next) => {
  try {
    const { shipmentId, exporterName, exporterAddress, importerName, countryOfOrigin, countryOfDestination, items, chamberOfCommerce, notes } = req.body;

    if (!shipmentId || !exporterName || !importerName || !countryOfOrigin || !countryOfDestination || !items) {
      throw new ValidationError('All required fields must be provided');
    }

    const certNumber = `COO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const coo = await db.CertificateOfOrigin.create({
      id: uuidv4(),
      shipmentId,
      exporterName,
      exporterAddress,
      importerName,
      countryOfOrigin,
      countryOfDestination,
      items,
      certNumber,
      issueDate: new Date(),
      chamberOfCommerce,
      status: 'issued',
      notes
    });

    res.status(201).json(getSuccessResponse(coo, 'Certificate of Origin generated'));

    auditService.logAction(req.user.id, 'CREATE', 'CertificateOfOrigin', coo.id, { certNumber }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get Certificate of Origin
 */
const getCertificateOfOrigin = async (req, res, next) => {
  try {
    const { id } = req.params;

    const coo = await db.CertificateOfOrigin.findByPk(id);
    if (!coo) {
      throw new NotFoundError('Certificate of Origin not found');
    }

    res.json(getSuccessResponse(coo, 'Certificate retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * List Certificates of Origin
 */
const listCertificates = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, shipmentId, countryOfOrigin } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (status) where.status = status;
    if (shipmentId) where.shipmentId = shipmentId;
    if (countryOfOrigin) where.countryOfOrigin = countryOfOrigin;

    const { count, rows } = await db.CertificateOfOrigin.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['issueDate', 'DESC']]
    });

    const response = getPaginatedResponse(rows, count, page, limit);
    res.json(getSuccessResponse(response, 'Certificates retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get compliance dashboard with key metrics
 */
const getComplianceDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Expiring certificates
    const expiringCerts = await db.CertificateOfOrigin.count({
      where: {
        status: { [Op.in]: ['issued', 'used'] },
        expiryDate: {
          [Op.between]: [now, thirtyDaysFromNow]
        }
      }
    });

    // Flagged compliance records
    const flaggedRecords = await db.ComplianceRecord.count({
      where: { status: 'flagged' }
    });

    // Pending approvals
    const pendingApprovals = await db.ComplianceRecord.count({
      where: { status: 'pending' }
    });

    // High-risk shipments (with anti-dumping)
    const highRiskShipments = await db.ComplianceRecord.count({
      where: { type: 'anti_dumping' }
    });

    // Compliance by type
    const complianceByType = await db.ComplianceRecord.findAll({
      attributes: [
        'type',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      group: ['type'],
      raw: true
    });

    // Countries with most shipments
    const topCountries = await db.ComplianceRecord.findAll({
      attributes: [
        'countryDestination',
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']
      ],
      group: ['country_destination'],
      order: [[db.sequelize.fn('COUNT', db.sequelize.col('id')), 'DESC']],
      limit: 5,
      raw: true
    });

    res.json(getSuccessResponse({
      expiringCertificatesIn30Days: expiringCerts,
      flaggedShipments: flaggedRecords,
      pendingApprovals,
      highRiskShipments,
      complianceByType,
      topDestinationCountries: topCountries
    }, 'Compliance dashboard retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Check anti-dumping applicability
 */
const checkAntiDumping = async (req, res, next) => {
  try {
    const { countryOrigin, countryDestination, productType } = req.body;

    if (!countryOrigin || !countryDestination) {
      throw new ValidationError('countryOrigin and countryDestination are required');
    }

    // Anti-dumping matrix (simplified)
    const antiDumpingMatrix = {
      CN: {
        US: { applicable: true, baseRate: 241, antiDumpingRate: 305, description: 'Chinese tiles to US' },
        CA: { applicable: true, baseRate: 10, antiDumpingRate: 15, description: 'Chinese products to Canada' }
      },
      IN: {
        US: { applicable: true, baseRate: 15, antiDumpingRate: 25, description: 'Indian products to US' }
      }
    };

    const origin = countryOrigin.toUpperCase();
    const destination = countryDestination.toUpperCase();

    const applicable = antiDumpingMatrix[origin] && antiDumpingMatrix[origin][destination];

    res.json(getSuccessResponse({
      countryOrigin,
      countryDestination,
      applicable: !!applicable,
      details: applicable ? antiDumpingMatrix[origin][destination] : { applicable: false, description: 'No anti-dumping duties applicable' }
    }, 'Anti-dumping check completed'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkCompliance,
  createComplianceRecord,
  listComplianceRecords,
  getComplianceRecord,
  updateComplianceRecord,
  getHSCodes,
  createHSCode,
  calculateDuties,
  generateCertificateOfOrigin,
  getCertificateOfOrigin,
  listCertificates,
  getComplianceDashboard,
  checkAntiDumping
};
