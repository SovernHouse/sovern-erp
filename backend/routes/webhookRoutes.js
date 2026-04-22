const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { ValidationError, NotFoundError } = require('../middleware/errorHandler');
const webhookService = require('../services/webhookService');
const auditService = require('../services/auditService');

/**
 * GET /api/webhooks
 * List all webhooks (admin sees all, others see their own)
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const { offset } = getPagination(page, limit);

    // Admin can see all webhooks, others see their own
    const where = req.user.role === 'admin' ? {} : { createdBy: req.user.id };

    const { count, rows } = await db.Webhook.findAndCountAll({
      where,
      include: [
        { model: db.User, as: 'creator', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] },
        { model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] }
      ],
      offset,
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['secret'] } // Don't return secrets in list
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/webhooks/:id
 * Get webhook details
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const webhook = await db.Webhook.findByPk(req.params.id, {
      include: [
        { model: db.User, as: 'creator', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] },
        { model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] }
      ],
      attributes: { exclude: ['secret'] }
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && webhook.createdBy !== req.user.id) {
      throw new NotFoundError('Webhook not found');
    }

    res.json(getSuccessResponse(webhook));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/webhooks
 * Create a new webhook
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { url, events, secret, description, customerId, factoryId } = req.body;

    if (!url) {
      throw new ValidationError('url is required');
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      throw new ValidationError('events array is required with at least one event');
    }

    // Validate events
    const invalidEvents = events.filter(e => !webhookService.SUPPORTED_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      throw new ValidationError(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    // Create webhook
    const webhook = await webhookService.registerWebhook(url, events, secret, {
      description,
      customerId,
      factoryId,
      createdBy: req.user.id
    });

    res.status(201).json(getSuccessResponse(webhook, 'Webhook created successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'CREATE', 'Webhook', webhook.id, { url, events }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/webhooks/:id
 * Update webhook
 */
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const webhook = await db.Webhook.findByPk(req.params.id);

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && webhook.createdBy !== req.user.id) {
      throw new NotFoundError('Webhook not found');
    }

    const { url, events, description, isActive } = req.body;

    // Validate events if provided
    if (events) {
      if (!Array.isArray(events) || events.length === 0) {
        throw new ValidationError('events must be an array with at least one event');
      }
      const invalidEvents = events.filter(e => !webhookService.SUPPORTED_EVENTS.includes(e));
      if (invalidEvents.length > 0) {
        throw new ValidationError(`Invalid events: ${invalidEvents.join(', ')}`);
      }
    }

    const updates = {};
    if (url !== undefined) updates.url = url;
    if (events !== undefined) updates.events = events;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;

    await webhook.update(updates);

    res.json(getSuccessResponse(webhook, 'Webhook updated successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'UPDATE', 'Webhook', webhook.id, updates, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/webhooks/:id
 * Delete webhook
 */
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const webhook = await db.Webhook.findByPk(req.params.id);

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && webhook.createdBy !== req.user.id) {
      throw new NotFoundError('Webhook not found');
    }

    const webhookId = webhook.id;
    await webhook.destroy();

    res.json(getSuccessResponse(null, 'Webhook deleted successfully'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'DELETE', 'Webhook', webhookId, {}, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/webhooks/:id/test
 * Test webhook connectivity
 */
router.post('/:id/test', requireAuth, async (req, res, next) => {
  try {
    const webhook = await db.Webhook.findByPk(req.params.id);

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && webhook.createdBy !== req.user.id) {
      throw new NotFoundError('Webhook not found');
    }

    const testResult = await webhookService.verifyWebhook(webhook.id);

    res.json(getSuccessResponse(testResult, 'Webhook test completed'));

    // Fire-and-forget audit log
    auditService.logAction(req.user.id, 'TEST', 'Webhook', webhook.id, testResult, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/webhooks/:id/deliveries
 * Get delivery log for a webhook
 */
router.get('/:id/deliveries', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, event, isSuccess } = req.query;
    const { offset } = getPagination(page, limit);

    const webhook = await db.Webhook.findByPk(req.params.id);

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    // Check authorization
    if (req.user.role !== 'admin' && webhook.createdBy !== req.user.id) {
      throw new NotFoundError('Webhook not found');
    }

    const options = {
      limit: parseInt(limit),
      offset,
      event: event || null,
      isSuccess: isSuccess !== undefined ? isSuccess === 'true' : null
    };

    const deliveries = await webhookService.getWebhookDeliveries(webhook.id, options);

    res.json(getPaginatedResponse(
      deliveries.deliveries,
      deliveries.total,
      parseInt(page),
      parseInt(limit)
    ));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/webhooks/events/supported
 * Get list of supported webhook events
 */
router.get('/events/supported', requireAuth, (req, res) => {
  res.json(getSuccessResponse({
    events: webhookService.SUPPORTED_EVENTS,
    description: 'Supported webhook event types'
  }));
});

module.exports = router;
