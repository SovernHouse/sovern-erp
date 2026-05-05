/**
 * Webhook Service
 * Handles webhook registration, delivery, and retry logic
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const db = require('../models');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger.js');

// Supported webhook events
const SUPPORTED_EVENTS = [
  'order.created',
  'order.statusChanged',
  'shipment.created',
  'shipment.updated',
  'invoice.created',
  'payment.received',
  'inspection.scheduled'
];

// Retry configuration
const RETRY_CONFIG = {
  maxAttempts: 4,
  delays: [1000, 5000, 30000], // Exponential backoff: 1s, 5s, 30s
  backoffMultiplier: 1 // Can be increased for more aggressive backoff
};

/**
 * Register a new webhook
 * @param {string} url - Webhook URL
 * @param {array} events - Array of event types to subscribe to
 * @param {string} secret - Secret key for HMAC signing
 * @param {object} options - Additional options (customerId, factoryId, description, createdBy)
 * @returns {Promise<object>} Created webhook
 */
const registerWebhook = async (url, events, secret, options = {}) => {
  try {
    // Validate URL
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('URL must be HTTP or HTTPS');
    }

    // Validate events
    const invalidEvents = events.filter(e => !SUPPORTED_EVENTS.includes(e));
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    if (events.length === 0) {
      throw new Error('At least one event must be specified');
    }

    // Generate secret if not provided
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    const webhook = await db.Webhook.create({
      id: uuidv4(),
      url,
      secret: webhookSecret,
      events,
      description: options.description || null,
      customerId: options.customerId || null,
      factoryId: options.factoryId || null,
      createdBy: options.createdBy,
      isActive: true
    });

    return webhook;
  } catch (error) {
    logger.error('Error registering webhook:', error);
    throw error;
  }
};

/**
 * Sign payload with HMAC-SHA256
 * @param {object} payload - Payload to sign
 * @param {string} secret - Secret key
 * @returns {string} HMAC signature
 */
const signPayload = (payload, secret) => {
  const payloadString = JSON.stringify(payload);
  return crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
};

/**
 * Verify webhook signature
 * @param {object} payload - Original payload
 * @param {string} signature - Provided signature
 * @param {string} secret - Secret key
 * @returns {boolean} True if signature is valid
 */
const verifyWebhookSignature = (payload, signature, secret) => {
  const expectedSignature = signPayload(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Deliver webhook payload to URL
 * @private
 */
const deliverWebhookPayload = (url, payload, secret, webhookId) => {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const signature = signPayload(payload, secret);
    const payloadString = JSON.stringify(payload);

    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadString),
        'X-Webhook-ID': webhookId,
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp,
        'User-Agent': 'Trading-ERP-Webhook/1.0'
      },
      timeout: 10000
    };

    const startTime = Date.now();

    const request = protocol.request(options, (response) => {
      let responseData = '';

      response.on('data', (chunk) => {
        responseData += chunk;
      });

      response.on('end', () => {
        const processingTime = Date.now() - startTime;
        const isSuccess = response.statusCode >= 200 && response.statusCode < 300;

        resolve({
          isSuccess,
          statusCode: response.statusCode,
          responseBody: responseData,
          processingTime,
          errorMessage: null
        });
      });
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Webhook delivery timeout'));
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.write(payloadString);
    request.end();
  });
};

/**
 * Trigger webhook for an event
 * @param {string} event - Event type
 * @param {object} payload - Event payload
 * @returns {Promise<array>} Array of delivery results
 */
const triggerWebhook = async (event, payload) => {
  try {
    // Find all active webhooks subscribed to this event
    const webhooks = await db.Webhook.findAll({
      where: {
        isActive: true
      }
    });

    const subscribedWebhooks = webhooks.filter(w =>
      w.events && Array.isArray(w.events) && w.events.includes(event)
    );

    if (subscribedWebhooks.length === 0) {
      return [];
    }

    // Fire-and-forget delivery for all subscribed webhooks
    const results = [];

    for (const webhook of subscribedWebhooks) {
      // Deliver asynchronously without waiting
      (async () => {
        try {
          const deliveryResult = await deliverWebhookPayload(
            webhook.url,
            payload,
            webhook.secret,
            webhook.id
          );

          // Record successful delivery
          await db.WebhookDelivery.create({
            id: uuidv4(),
            webhookId: webhook.id,
            event,
            payload,
            statusCode: deliveryResult.statusCode,
            responseBody: deliveryResult.responseBody,
            isSuccess: deliveryResult.isSuccess,
            errorMessage: null,
            attemptNumber: 1,
            processingTimeMs: deliveryResult.processingTime,
            deliveredAt: new Date()
          });

          // Reset failure count on success
          if (deliveryResult.isSuccess) {
            await webhook.update({
              failureCount: 0,
              lastTriggered: new Date()
            });
          }
        } catch (error) {
          // Record failed delivery and schedule retry
          const failureReason = error.message;

          const delivery = await db.WebhookDelivery.create({
            id: uuidv4(),
            webhookId: webhook.id,
            event,
            payload,
            isSuccess: false,
            errorMessage: failureReason,
            attemptNumber: 1,
            nextRetryAt: new Date(Date.now() + RETRY_CONFIG.delays[0])
          });

          // Update webhook failure count
          await webhook.update({
            failureCount: (webhook.failureCount || 0) + 1,
            lastFailureReason: failureReason
          });

          // Schedule retry
          scheduleRetry(webhook, delivery, event);
        }
      })().catch(err => logger.error('Webhook delivery error:', err));
    }

    return results;
  } catch (error) {
    logger.error('Error triggering webhooks:', error);
    // Don't throw - webhook failures shouldn't break main operations
    return [];
  }
};

/**
 * Schedule webhook retry
 * @private
 */
const scheduleRetry = (webhook, delivery, event) => {
  const delay = RETRY_CONFIG.delays[Math.min(delivery.attemptNumber - 1, RETRY_CONFIG.delays.length - 1)];

  setTimeout(async () => {
    try {
      if (delivery.attemptNumber >= RETRY_CONFIG.maxAttempts) {
        logger.info(`Webhook ${webhook.id} exceeded max retries for event ${event}`);
        return;
      }

      const deliveryResult = await deliverWebhookPayload(
        webhook.url,
        delivery.payload,
        webhook.secret,
        webhook.id
      );

      // Record retry result
      const nextAttempt = delivery.attemptNumber + 1;
      const nextRetryAt = nextAttempt < RETRY_CONFIG.maxAttempts
        ? new Date(Date.now() + (RETRY_CONFIG.delays[Math.min(nextAttempt - 1, RETRY_CONFIG.delays.length - 1)] * RETRY_CONFIG.backoffMultiplier))
        : null;

      await delivery.update({
        statusCode: deliveryResult.statusCode,
        responseBody: deliveryResult.responseBody,
        isSuccess: deliveryResult.isSuccess,
        errorMessage: null,
        attemptNumber: nextAttempt,
        processingTimeMs: deliveryResult.processingTime,
        deliveredAt: deliveryResult.isSuccess ? new Date() : null,
        nextRetryAt: deliveryResult.isSuccess ? null : nextRetryAt
      });

      if (deliveryResult.isSuccess) {
        // Reset failure count on success
        await webhook.update({
          failureCount: 0,
          lastTriggered: new Date()
        });
      } else if (nextAttempt < RETRY_CONFIG.maxAttempts) {
        // Schedule next retry
        scheduleRetry(webhook, delivery, event);
      }
    } catch (error) {
      logger.error(`Webhook retry failed for ${webhook.id}:`, error);

      const nextAttempt = delivery.attemptNumber + 1;
      const nextRetryAt = nextAttempt < RETRY_CONFIG.maxAttempts
        ? new Date(Date.now() + RETRY_CONFIG.delays[Math.min(nextAttempt - 1, RETRY_CONFIG.delays.length - 1)])
        : null;

      await delivery.update({
        isSuccess: false,
        errorMessage: error.message,
        attemptNumber: nextAttempt,
        nextRetryAt
      });

      if (nextAttempt < RETRY_CONFIG.maxAttempts) {
        scheduleRetry(webhook, delivery, event);
      }
    }
  }, delay);
};

/**
 * Verify webhook is reachable
 * @param {string} webhookId - Webhook ID
 * @returns {Promise<object>} Verification result
 */
const verifyWebhook = async (webhookId) => {
  try {
    const webhook = await db.Webhook.findByPk(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const testPayload = {
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test webhook delivery' }
    };

    const result = await deliverWebhookPayload(
      webhook.url,
      testPayload,
      webhook.secret,
      webhook.id
    );

    // Record test delivery
    const delivery = await db.WebhookDelivery.create({
      id: uuidv4(),
      webhookId: webhook.id,
      event: 'webhook.test',
      payload: testPayload,
      statusCode: result.statusCode,
      responseBody: result.responseBody,
      isSuccess: result.isSuccess,
      errorMessage: result.isSuccess ? null : 'Test failed',
      attemptNumber: 1,
      processingTimeMs: result.processingTime,
      deliveredAt: new Date()
    });

    return {
      webhookId,
      isReachable: result.isSuccess,
      statusCode: result.statusCode,
      processingTime: result.processingTime,
      deliveryId: delivery.id
    };
  } catch (error) {
    logger.error('Webhook verification failed:', error);
    throw error;
  }
};

/**
 * Get delivery logs for a webhook
 * @param {string} webhookId - Webhook ID
 * @param {object} options - Query options (limit, offset, event, isSuccess)
 * @returns {Promise<object>} Delivery logs
 */
const getWebhookDeliveries = async (webhookId, options = {}) => {
  const { limit = 50, offset = 0, event = null, isSuccess = null } = options;

  const where = { webhookId };
  if (event) where.event = event;
  if (isSuccess !== null) where.isSuccess = isSuccess;

  const { count, r