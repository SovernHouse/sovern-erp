const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');
const { generateNumberWithCounter, incrementCounter } = require('../services/numberGenerator');

/**
 * Create a new sample request
 */
const createRequest = async (req, res, next) => {
  try {
    const {
      customerId,
      products,
      requiredByDate,
      priority = 'medium',
      specialRequirements,
      notes
    } = req.body;

    // Validate customer
    const customer = await db.Customer.findByPk(customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Generate request number
    const lastRequest = await db.SampleRequest.findOne({
      order: [['createdAt', 'DESC']]
    });
    const counter = incrementCounter(lastRequest?.requestNumber);
    const requestNumber = generateNumberWithCounter('SR', counter);

    // Calculate total quantity
    let totalQuantity = 0;
    const productsWithDetails = [];

    for (const product of products) {
      const productRecord = await db.Product.findByPk(product.productId);
      if (productRecord) {
        totalQuantity += parseFloat(product.quantity) || 0;
        productsWithDetails.push({
          productId: product.productId,
          productName: productRecord.name,
          quantity: parseFloat(product.quantity),
          unit: product.unit || productRecord.unit || 'PCS',
          remarks: product.remarks || null
        });
      }
    }

    const sampleRequest = await db.SampleRequest.create({
      id: uuidv4(),
      requestNumber,
      customerId,
      requestDate: new Date(),
      requiredByDate: requiredByDate || null,
      status: 'pending',
      priority,
      products: productsWithDetails,
      totalQuantity,
      specialRequirements: specialRequirements || null,
      notes: notes || null
    });

    const result = await db.SampleRequest.findByPk(sampleRequest.id, {
      include: [
        { model: db.Customer, as: 'customer', attributes: ['id', 'companyName', 'email'] }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Sample request created successfully'));

    auditService.logAction(req.user.id, 'CREATE', 'SampleRequest', sampleRequest.id, { data: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get all sample requests with filters
 */
const getRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, customerId, status, priority, search, startDate, endDate } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) where.requestNumber = { [Op.like]: `%${search}%` };
    if (startDate || endDate) {
      where.requestDate = {};
      if (startDate) where.requestDate[Op.gte] = new Date(startDate);
      if (endDate) where.requestDate[Op.lte] = new Date(endDate);
    }

    const [count, rows] = await Promise.all([
      db.SampleRequest.count({ where }),
      db.SampleRequest.findAll({
        where,
        include: [
          { model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] }
        ],
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

/**
 * Get sample request by ID with shipment and feedback info
 */
const getRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sampleRequest = await db.SampleRequest.findByPk(id, {
      include: [
        { model: db.Customer, as: 'customer' },
        { model: db.SampleShipment, as: 'shipments' },
        { model: db.SampleFeedback, as: 'feedback' }
      ]
    });

    if (!sampleRequest) {
      throw new NotFoundError('Sample request not found');
    }

    res.json(getSuccessResponse(sampleRequest));
  } catch (error) {
    next(error);
  }
};

/**
 * Update sample request
 */
const updateRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      requiredByDate,
      priority,
      products,
      specialRequirements,
      notes
    } = req.body;

    const sampleRequest = await db.SampleRequest.findByPk(id);
    if (!sampleRequest) {
      throw new NotFoundError('Sample request not found');
    }

    if (!['pending', 'approved'].includes(sampleRequest.status)) {
      throw new Error('Can only edit sample requests in pending or approved status');
    }

    const beforeSnapshot = sampleRequest.toJSON();

    let totalQuantity = sampleRequest.totalQuantity;
    let updatedProducts = sampleRequest.products;

    if (products) {
      totalQuantity = 0;
      updatedProducts = [];

      for (const product of products) {
        const productRecord = await db.Product.findByPk(product.productId);
        if (productRecord) {
          totalQuantity += parseFloat(product.quantity) || 0;
          updatedProducts.push({
            productId: product.productId,
            productName: productRecord.name,
            quantity: parseFloat(product.quantity),
            unit: product.unit || productRecord.unit || 'PCS',
            remarks: product.remarks || null
          });
        }
      }
    }

    await sampleRequest.update({
      requiredByDate: requiredByDate || sampleRequest.requiredByDate,
      priority: priority || sampleRequest.priority,
      products: updatedProducts,
      totalQuantity,
      specialRequirements: specialRequirements !== undefined ? specialRequirements : sampleRequest.specialRequirements,
      notes: notes !== undefined ? notes : sampleRequest.notes
    });

    const result = await db.SampleRequest.findByPk(id, {
      include: [
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.json(getSuccessResponse(result, 'Sample request updated successfully'));

    auditService.logAction(req.user.id, 'UPDATE', 'SampleRequest', id, { before: beforeSnapshot, after: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Approve sample request
 */
const approveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;

    const sampleRequest = await db.SampleRequest.findByPk(id);
    if (!sampleRequest) {
      throw new NotFoundError('Sample request not found');
    }

    if (sampleRequest.status !== 'pending') {
      throw new Error('Only pending sample requests can be approved');
    }

    const beforeStatus = sampleRequest.status;
    await sampleRequest.update({
      status: 'approved',
      approvedBy: req.user.id,
      approvalDate: new Date()
    });

    const result = await db.SampleRequest.findByPk(id, {
      include: [
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.json(getSuccessResponse(result, 'Sample request approved'));

    auditService.logAction(req.user.id, 'UPDATE', 'SampleRequest', id, { action: 'approval', statusChange: { before: beforeStatus, after: 'approved' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel sample request
 */
const cancelRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const sampleRequest = await db.SampleRequest.findByPk(id);
    if (!sampleRequest) {
      throw new NotFoundError('Sample request not found');
    }

    if (['shipped', 'delivered', 'cancelled'].includes(sampleRequest.status)) {
      throw new Error('Cannot cancel sample request in current status');
    }

    const beforeStatus = sampleRequest.status;
    await sampleRequest.update({
      status: 'cancelled',
      notes: `Cancelled. Reason: ${reason}`
    });

    const result = await db.SampleRequest.findByPk(id, {
      include: [
        { model: db.Customer, as: 'customer' }
      ]
    });

    res.json(getSuccessResponse(result, 'Sample request cancelled'));

    auditService.logAction(req.user.id, 'UPDATE', 'SampleRequest', id, { action: 'cancellation', reason, statusChange: { before: beforeStatus, after: 'cancelled' } }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Create sample shipment and ship request
 */
const shipRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      carrier,
      trackingNumber,
      expectedDeliveryDate,
      shippingMethod = 'courier',
      weight,
      weightUnit = 'kg',
      shippingCost,
      notes
    } = req.body;

    const sampleRequest = await db.SampleRequest.findByPk(id);
    if (!sampleRequest) {
      throw new NotFoundError('Sample request not found');
    }

    if (sampleRequest.status !== 'approved') {
      throw new Error('Only approved sample requests can be shipped');
    }

    // Generate shipment number
    const lastShipment = await db.SampleShipment.findOne({
      order: [['createdAt', 'DESC']]
    });
    const counter = incrementCounter(lastShipment?.shipmentNumber);
    const shipmentNumber = generateNumberWithCounter('SHP', counter);

    const shipment = await db.SampleShipment.create({
      id: uuidv4(),
      sampleRequestId: id,
      shipmentNumber,
      shippedDate: new Date(),
      expectedDeliveryDate: expectedDeliveryDate || null,
      shippingMethod,
      carrier,
      trackingNumber,
      status: 'shipped',
      quantity: sampleRequest.totalQuantity,
      weight: weight || null,
      weightUnit,
      shippingCost: shippingCost || null,
      currency: 'USD',
      shippedBy: req.user.id,
      notes: notes || null
    });

    // Update sample request status
    const beforeStatus = sampleRequest.status;
    await sampleRequest.update({ status: 'shipped' });

    const result = await db.SampleShipment.findByPk(shipment.id, {
      include: [
        { model: db.SampleRequest, as: 'sampleRequest' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Sample shipped successfully'));

    auditService.logAction(req.user.id, 'CREATE', 'SampleShipment', shipment.id, { sampleRequestId: id, shipmentNumber }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get all shipments with filters
 */
const getShipments = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sampleRequestId, status, search } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (sampleRequestId) where.sampleRequestId = sampleRequestId;
    if (status) where.status = status;
    if (search) where.shipmentNumber = { [Op.like]: `%${search}%` };

    const [count, rows] = await Promise.all([
      db.SampleShipment.count({ where }),
      db.SampleShipment.findAll({
        where,
        include: [
          { model: db.SampleRequest, as: 'sampleRequest', attributes: ['requestNumber', 'customerId'] }
        ],
        offset,
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

/**
 * Get shipment by ID
 */
const getShipmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const shipment = await db.SampleShipment.findByPk(id, {
      include: [
        { model: db.SampleRequest, as: 'sampleRequest', include: [{ model: db.Customer, as: 'customer' }] }
      ]
    });

    if (!shipment) {
      throw new NotFoundError('Shipment not found');
    }

    res.json(getSuccessResponse(shipment));
  } catch (error) {
    next(error);
  }
};

/**
 * Update shipment tracking status
 */
const updateShipmentTracking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, deliveryDate } = req.body;

    const shipment = await db.SampleShipment.findByPk(id);
    if (!shipment) {
      throw new NotFoundError('Shipment not found');
    }

    const validStatuses = ['pending', 'shipped', 'in_transit', 'delivered', 'failed'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Valid statuses are: ${validStatuses.join(', ')}`);
    }

    const beforeSnapshot = shipment.toJSON();

    const updateData = { status };
    if (status === 'delivered') {
      updateData.actualDeliveryDate = deliveryDate || new Date();
    }

    await shipment.update(updateData);

    // Update sample request status if delivered
    if (status === 'delivered') {
      const sampleRequest = await db.SampleRequest.findByPk(shipment.sampleRequestId);
      if (sampleRequest && sampleRequest.status === 'shipped') {
        await sampleRequest.update({ status: 'delivered' });
      }
    }

    const result = await db.SampleShipment.findByPk(id, {
      include: [
        { model: db.SampleRequest, as: 'sampleRequest' }
      ]
    });

    res.json(getSuccessResponse(result, 'Shipment tracking updated'));

    auditService.logAction(req.user.id, 'UPDATE', 'SampleShipment', id, { before: beforeSnapshot, after: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Submit sample feedback
 */
const submitFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      rating,
      quality,
      packaging,
      delivery,
      comments,
      issues,
      recommendations
    } = req.body;

    const sampleRequest = await db.SampleRequest.findByPk(id);
    if (!sampleRequest) {
      throw new NotFoundError('Sample request not found');
    }

    if (!['delivered', 'shipped'].includes(sampleRequest.status)) {
      throw new Error('Feedback can only be submitted for delivered or shipped samples');
    }

    const feedback = await db.SampleFeedback.create({
      id: uuidv4(),
      sampleRequestId: id,
      feedbackDate: new Date(),
      rating: parseInt(rating),
      quality: quality ? parseInt(quality) : null,
      packaging: packaging ? parseInt(packaging) : null,
      delivery: delivery ? parseInt(delivery) : null,
      comments: comments || null,
      issues: issues || [],
      recommendations: recommendations || null,
      status: 'pending_action',
      followUpDate: null,
      sentByContactId: null,
      handledBy: req.user.id,
      internalNotes: null
    });

    const result = await db.SampleFeedback.findByPk(feedback.id, {
      include: [
        { model: db.SampleRequest, as: 'sampleRequest' }
      ]
    });

    res.status(201).json(getSuccessResponse(result, 'Feedback submitted successfully'));

    auditService.logAction(req.user.id, 'CREATE', 'SampleFeedback', feedback.id, { sampleRequestId: id, rating }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get all feedback with filters
 */
const getFeedback = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sampleRequestId, status } = req.query;
    const { offset } = getPagination(page, limit);

    const where = {};
    if (sampleRequestId) where.sampleRequestId = sampleRequestId;
    if (status) where.status = status;

    const [count, rows] = await Promise.all([
      db.SampleFeedback.count({ where }),
      db.SampleFeedback.findAll({
        where,
        include: [
          { model: db.SampleRequest, as: 'sampleRequest', attributes: ['requestNumber', 'customerId'] }
        ],
        offset,
        limit: parseInt(limit),
        order: [['feedbackDate', 'DESC']]
      }),
    ]);

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

/**
 * Get feedback by ID
 */
const getFeedbackById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const feedback = await db.SampleFeedback.findByPk(id, {
      include: [
        { model: db.SampleRequest, as: 'sampleRequest', include: [{ model: db.Customer, as: 'customer' }] }
      ]
    });

    if (!feedback) {
      throw new NotFoundError('Feedback not found');
    }

    res.json(getSuccessResponse(feedback));
  } catch (error) {
    next(error);
  }
};

/**
 * Update feedback status
 */
const updateFeedbackStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, internalNotes, followUpDate } = req.body;

    const feedback = await db.SampleFeedback.findByPk(id);
    if (!feedback) {
      throw new NotFoundError('Feedback not found');
    }

    const validStatuses = ['pending_action', 'under_review', 'resolved', 'escalated'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Valid statuses are: ${validStatuses.join(', ')}`);
    }

    const beforeSnapshot = feedback.toJSON();

    await feedback.update({
      status,
      internalNotes: internalNotes || feedback.internalNotes,
      followUpDate: followUpDate || feedback.followUpDate,
      handledBy: req.user.id
    });

    const result = await db.SampleFeedback.findByPk(id, {
      include: [
        { model: db.SampleRequest, as: 'sampleRequest' }
      ]
    });

    res.json(getSuccessResponse(result, 'Feedback status updated'));

    auditService.logAction(req.user.id, 'UPDATE', 'SampleFeedback', id, { before: beforeSnapshot, after: result?.toJSON?.() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get sample statistics
 */
const getStatistics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.requestDate = {};
      if (startDate) dateFilter.requestDate[Op.gte] = new Date(startDate);
      if (endDate) dateFilter.requestDate[Op.lte] = new Date(endDate);
    }

    // Total sample requests
    const totalRequests = await db.SampleRequest.count({ where: dateFilter });

    // Requests by status
    const requestsByStatus = await db.SampleRequest.findAll({
      attributes: ['status', [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'count']],
      where: dateFilter,
      group: ['status'],
      raw: true
    });

    // Delivered requests (converted)
    const deliveredCount = await db.SampleRequest.count({
      where: { ...dateFilter, status: 'delivered' }
    });

    // Conversion rate
    const conversionRate = totalRequests > 0 ? ((deliveredCount / totalRequests) * 100).toFixed(2) : 0;

    // Pending approvals
    const pendingApprovals = await db.SampleRequest.count({
      where: { status: 'pending' }
    });

    // Average lead time (in days)
    const shipments = await db.SampleShipment.findAll({
      attributes: [
        [db.sequelize.fn('AVG', db.sequelize.literal('JULIANDAY(actual_delivery_date) - JULIANDAY(shipped_date)')), 'avgLeadTime']
      ],
      where: { status: 'delivered' },
      raw: true
    });

    const avgLeadTime = shipments[0]?.avgLeadTime ? parseFloat(shipments[0].avgLeadTime).toFixed(2) : 0;

    // Feedback metrics
    const feedbackMetrics = await db.SampleFeedback.findAll({
      attributes: [
        [db.sequelize.fn('AVG', db.sequelize.col('rating')), 'avgRating'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'totalFeedback']
      ],
      raw: true
    });

    const stats = {
      totalRequests,
      requestsByStatus: requestsByStatus.reduce((acc, curr) => {
        acc[curr.status] = parseInt(curr.count);
        return acc;
      }, {}),
      deliveredCount,
      conversionRate: parseFloat(conversionRate),
      pendingApprovals,
      avgLeadTimeInDays: parseFloat(avgLeadTime),
      feedbackMetrics: {
        totalFeedback: feedbackMetrics[0]?.totalFeedback ? parseInt(feedbackMetrics[0].totalFeedback) : 0,
        averageRating: feedbackMetrics[0]?.avgRating ? parseFloat(feedbackMetrics[0].avgRating).toFixed(2) : 0
      }
    };

    res.json(getSuccessResponse(stats, 'Sample statistics retrieved'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRequest,
  getRequests,
  getRequestById,
  updateRequest,
  approveRequest,
  cancelRequest,
  shipRequest,
  getShipments,
  getShipmentById,
  updateShipmentTracking,
  submitFeedback,
  getFeedback,
  getFeedbackById,
  updateFeedbackStatus,
  getStatistics
};
