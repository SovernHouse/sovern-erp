/**
 * Email Management Routes
 * Provides endpoints for sending test emails and managing email templates
 */

const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const { requireAuth: authenticate, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger.js');
const authorize = (roles) => requireRole(...roles);

/**
 * GET /api/emails/templates
 * List available email templates
 */
router.get('/templates', authenticate, (req, res) => {
  try {
    const templates = [
      {
        name: 'orderConfirmation',
        displayName: 'Order Confirmation',
        description: 'Sent when a new sales order is confirmed'
      },
      {
        name: 'invoiceCreated',
        displayName: 'Invoice Created',
        description: 'Sent when an invoice is generated'
      },
      {
        name: 'paymentReceived',
        displayName: 'Payment Received',
        description: 'Sent when a payment is received'
      },
      {
        name: 'shipmentUpdate',
        displayName: 'Shipment Update',
        description: 'Sent when shipment status changes'
      },
      {
        name: 'passwordReset',
        displayName: 'Password Reset',
        description: 'Sent for password reset requests'
      },
      {
        name: 'welcomeEmail',
        displayName: 'Welcome Email',
        description: 'Sent to new users'
      },
      {
        name: 'poCreated',
        displayName: 'Purchase Order Created',
        description: 'Sent when a PO is created'
      },
      {
        name: 'inspectionScheduled',
        displayName: 'Inspection Scheduled',
        description: 'Sent when an inspection is scheduled'
      },
      {
        name: 'lcExpiring',
        displayName: 'Letter of Credit Expiring',
        description: 'Sent as LC expiry warning'
      },
      {
        name: 'lowStockAlert',
        displayName: 'Low Stock Alert',
        description: 'Sent when product stock is low'
      }
    ];

    return res.json({
      success: true,
      message: 'Email templates retrieved',
      data: templates
    });
  } catch (error) {
    logger.error('Error retrieving templates:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve email templates',
        statusCode: 500
      }
    });
  }
});

/**
 * POST /api/emails/test
 * Send a test email to verify email configuration
 * Admin only
 */
router.post('/test', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Recipient email address is required',
          statusCode: 400
        }
      });
    }

    const subject = 'Trading ERP - Test Email';
    const htmlContent = emailService.generateEmailTemplate(
      'Test Email',
      `
        <p>This is a test email from Trading ERP system.</p>
        <p>If you received this email, your email configuration is working correctly.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `
    );

    const result = await emailService.sendEmail(to, subject, htmlContent);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Test email sent successfully',
        data: {
          to,
          subject,
          messageId: result.messageId,
          preview: result.previewUrl || null
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to send test email: ' + result.error,
          statusCode: 500
        }
      });
    }
  } catch (error) {
    logger.error('Error sending test email:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Error sending test email',
        statusCode: 500
      }
    });
  }
});

/**
 * POST /api/emails/send
 * Send a custom email
 * Admin only
 */
router.post('/send', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { to, subject, htmlContent, bcc, cc } = req.body;

    // Validation
    if (!to || !subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'to, subject, and htmlContent are required',
          statusCode: 400
        }
      });
    }

    const mailOptions = {};
    if (bcc) mailOptions.bcc = bcc;
    if (cc) mailOptions.cc = cc;

    const result = await emailService.sendEmail(to, subject, htmlContent, mailOptions);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Email sent successfully',
        data: {
          to,
          subject,
          messageId: result.messageId,
          preview: result.previewUrl || null
        }
      });
    } else {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to send email: ' + result.error,
          statusCode: 500
        }
      });
    }
  } catch (error) {
    logger.error('Error sending custom email:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Error sending email',
        statusCode: 500
      }
    });
  }
});

/**
 * POST /api/emails/send-bulk
 * Send email to multiple recipients
 * Admin only
 */
router.post('/send-bulk', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const { recipients, subject, htmlContent } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'recipients array is required and must contain at least one email',
          statusCode: 400
        }
      });
    }

    if (!subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'subject and htmlContent are required',
          statusCode: 400
        }
      });
    }

    const results = [];
    for (const recipient of recipients) {
      const result = await emailService.sendEmail(recipient, subject, htmlContent);
      results.push({
        to: recipient,
        success: result.success,
        messageId: result.messageId || null,
        error: result.error || null
      });
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return res.json({
      success: true,
      message: `Bulk email send completed: ${successCount} succeeded, ${failureCount} failed`,
      data: {
        totalSent: recipients.length,
        successCount,
        failureCount,
        results
      }
    });
  } ca