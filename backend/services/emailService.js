const nodemailer = require('nodemailer');
const dayjs = require('dayjs');
const logger = require('../utils/logger.js');

/**
 * Create and configure nodemailer transporter
 * Uses SMTP from env vars, falls back to ethereal.email for dev mode
 */
const createTransporter = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const emailEnabled = process.env.EMAIL_ENABLED === 'true';

  // Production or configured SMTP
  if ((isProduction || emailEnabled) && process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // Development fallback to Ethereal Email (free test email service)
  if (process.env.NODE_ENV !== 'production') {
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
  }

  throw new Error('Email configuration missing (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)');
};

let transporter = null;

/**
 * Initialize transporter on first use
 */
const getTransporter = async () => {
  if (!transporter) {
    transporter = await createTransporter();
  }
  return transporter;
};

/**
 * Generate HTML email wrapper with company header and footer
 */
const generateEmailTemplate = (title, content, footer = null) => {
  const companyName = 'Trading ERP';
  const companyEmail = process.env.SMTP_FROM || 'noreply@trading-erp.com';
  const defaultFooter = footer || `
    <p style="margin-top: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px;">
      <strong>${companyName}</strong><br/>
      Email: ${companyEmail}<br/>
      © ${new Date().getFullYear()} ${companyName}. All rights reserved.
    </p>
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; color: #333; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #eee; border-radius: 0 0 5px 5px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          table, th, td { border: 1px solid #ddd; }
          th { background-color: #2c3e50; color: white; padding: 10px; text-align: left; }
          td { padding: 10px; }
          .footer { margin-top: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          <div class="content">
            ${content}
            <div class="footer">
              ${defaultFooter}
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

const sendEmail = async (to, subject, htmlContent, options = {}) => {
  try {
    // Allow disabling via env var (default is OFF for dev)
    if (process.env.EMAIL_ENABLED !== 'true') {
      logger.info(`[EMAIL] (disabled) To: ${to}, Subject: ${subject}`);
      return { success: true, disabled: true, message: 'Email delivery disabled' };
    }

    const transporterInstance = await getTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@trading-erp.com',
      to: to,
      subject: subject,
      html: htmlContent,
      ...options
    };

    const result = await transporterInstance.sendMail(mailOptions);
    logger.info(`[EMAIL] Sent to ${to}, Subject: ${subject}, MessageId: ${result.messageId}`);

    // Log Ethereal preview URL for dev mode
    if (process.env.NODE_ENV !== 'production' && result.response) {
      logger.info(`[EMAIL] Preview URL: ${nodemailer.getTestMessageUrl(result)}`);
    }

    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error(`[EMAIL] Error sending to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

const sendQuotationEmail = async (customer, quotation, expiryDays = 7) => {
  const subject = `New Quotation ${quotation.quotationNumber}`;
  const content = `
    <h2>Hi ${customer.contactPerson || customer.companyName},</h2>
    <p>We are pleased to provide you with the following quotation for your flooring needs:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Quotation Number</td>
        <td>${quotation.quotationNumber}</td>
      </tr>
      <tr>
        <td>Total Amount</td>
        <td>${quotation.currency} ${quotation.total}</td>
      </tr>
      <tr>
        <td>Valid Until</td>
        <td>${dayjs(quotation.validUntil).format('YYYY-MM-DD')}</td>
      </tr>
    </table>
    <p>Please review the quotation and let us know if you have any questions.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('New Quotation', content);
  return sendEmail(customer.email, subject, htmlContent);
};

const sendProformaInvoiceEmail = async (customer, pi) => {
  const subject = `Proforma Invoice ${pi.piNumber}`;
  const content = `
    <h2>Hi ${customer.contactPerson || customer.companyName},</h2>
    <p>Your proforma invoice is ready:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>PI Number</td>
        <td>${pi.piNumber}</td>
      </tr>
      <tr>
        <td>Total Amount</td>
        <td>${pi.currency} ${pi.total}</td>
      </tr>
      <tr>
        <td>Payment Terms</td>
        <td>${pi.paymentTerms}</td>
      </tr>
      <tr>
        <td>Valid Until</td>
        <td>${dayjs(pi.validUntil).format('YYYY-MM-DD')}</td>
      </tr>
    </table>
    <p>Please confirm to proceed with the order.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Proforma Invoice', content);
  return sendEmail(customer.email, subject, htmlContent);
};

const sendOrderConfirmationEmail = async (customer, salesOrder) => {
  const subject = `Order Confirmation ${salesOrder.orderNumber}`;
  const content = `
    <h2>Hi ${customer.contactPerson || customer.companyName},</h2>
    <p>Your order has been confirmed:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Order Number</td>
        <td>${salesOrder.orderNumber}</td>
      </tr>
      <tr>
        <td>Total Amount</td>
        <td>${salesOrder.currency} ${salesOrder.total}</td>
      </tr>
      <tr>
        <td>Status</td>
        <td>${salesOrder.status}</td>
      </tr>
      <tr>
        <td>Estimated Delivery</td>
        <td>${dayjs(salesOrder.estimatedDelivery).format('YYYY-MM-DD')}</td>
      </tr>
    </table>
    <p>We will keep you updated on your shipment status.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Order Confirmation', content);
  return sendEmail(customer.email, subject, htmlContent);
};

const sendShipmentNotificationEmail = async (customer, shipment) => {
  const subject = `Shipment Notification ${shipment.shipmentNumber}`;
  const content = `
    <h2>Hi ${customer.companyName},</h2>
    <p>Your shipment has been dispatched:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Shipment Number</td>
        <td>${shipment.shipmentNumber}</td>
      </tr>
      <tr>
        <td>Carrier</td>
        <td>${shipment.carrier || 'N/A'}</td>
      </tr>
      <tr>
        <td>Tracking Number</td>
        <td>${shipment.containerNumber || 'N/A'}</td>
      </tr>
      <tr>
        <td>Expected Arrival</td>
        <td>${dayjs(shipment.eta).format('YYYY-MM-DD')}</td>
      </tr>
    </table>
    <p>You can track your shipment using the tracking number above.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Shipment Update', content);
  return sendEmail(customer.email, subject, htmlContent);
};

const sendInspectionReportEmail = async (factory, inspection) => {
  const subject = `Inspection Report ${inspection.inspectionNumber}`;
  const content = `
    <h2>Hi ${factory.contactPerson || factory.companyName},</h2>
    <p>Inspection has been completed:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Inspection Number</td>
        <td>${inspection.inspectionNumber}</td>
      </tr>
      <tr>
        <td>Type</td>
        <td>${inspection.type}</td>
      </tr>
      <tr>
        <td>Result</td>
        <td>${inspection.overallResult}</td>
      </tr>
      <tr>
        <td>Completed Date</td>
        <td>${dayjs(inspection.completedDate).format('YYYY-MM-DD')}</td>
      </tr>
    </table>
    <p>Please review the detailed report attached.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Inspection Report', content);
  return sendEmail(factory.email, subject, htmlContent);
};

const sendClaimEmail = async (customer, claim) => {
  const subject = `Claim Acknowledgment ${claim.claimNumber}`;
  const content = `
    <h2>Hi ${customer.companyName},</h2>
    <p>We have received your claim:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Claim Number</td>
        <td>${claim.claimNumber}</td>
      </tr>
      <tr>
        <td>Type</td>
        <td>${claim.type}</td>
      </tr>
      <tr>
        <td>Priority</td>
        <td>${claim.priority}</td>
      </tr>
      <tr>
        <td>Status</td>
        <td>${claim.status}</td>
      </tr>
    </table>
    <p>We will investigate your claim and get back to you shortly.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Claim Acknowledgment', content);
  return sendEmail(customer.email, subject, htmlContent);
};

const sendPaymentReminderEmail = async (customer, invoice) => {
  const subject = `Payment Reminder - Invoice ${invoice.invoiceNumber}`;
  const daysOverdue = dayjs().diff(dayjs(invoice.dueDate), 'day');

  const content = `
    <h2>Hi ${customer.companyName},</h2>
    <p>This is a reminder that your invoice is due or overdue:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Invoice Number</td>
        <td>${invoice.invoiceNumber}</td>
      </tr>
      <tr>
        <td>Amount Due</td>
        <td>${invoice.currency} ${invoice.balance}</td>
      </tr>
      <tr>
        <td>Due Date</td>
        <td>${dayjs(invoice.dueDate).format('YYYY-MM-DD')}</td>
      </tr>
      <tr>
        <td>Days Overdue</td>
        <td>${Math.max(0, daysOverdue)}</td>
      </tr>
    </table>
    <p>Please arrange payment at your earliest convenience.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Payment Reminder', content);
  return sendEmail(customer.email, subject, htmlContent);
};

const sendInvoiceEmail = async (customer, invoice) => {
  const subject = `Invoice ${invoice.invoiceNumber}`;
  const content = `
    <h2>Hi ${customer.contactPerson || customer.companyName},</h2>
    <p>Your invoice is ready for review:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Invoice Number</td>
        <td>${invoice.invoiceNumber}</td>
      </tr>
      <tr>
        <td>Total Amount</td>
        <td>${invoice.currency} ${invoice.total}</td>
      </tr>
      <tr>
        <td>Due Date</td>
        <td>${dayjs(invoice.dueDate).format('YYYY-MM-DD')}</td>
      </tr>
      <tr>
        <td>Payment Terms</td>
        <td>${invoice.paymentTerms}</td>
      </tr>
    </table>
    <p>Please find the invoice attached and arrange payment by the due date.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Invoice', content);
  return sendEmail(customer.email, subject, htmlContent);
};

const sendPaymentConfirmationEmail = async (customer, invoice, payment) => {
  const subject = `Payment Confirmation - Invoice ${invoice.invoiceNumber}`;
  const content = `
    <h2>Hi ${customer.contactPerson || customer.companyName},</h2>
    <p>We have received your payment. Thank you!</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Invoice Number</td>
        <td>${invoice.invoiceNumber}</td>
      </tr>
      <tr>
        <td>Payment Amount</td>
        <td>${payment.currency} ${payment.amount}</td>
      </tr>
      <tr>
        <td>Payment Method</td>
        <td>${payment.method}</td>
      </tr>
      <tr>
        <td>Reference</td>
        <td>${payment.reference || 'N/A'}</td>
      </tr>
      <tr>
        <td>Remaining Balance</td>
        <td>${invoice.currency} ${invoice.balance}</td>
      </tr>
    </table>
    <p>Your payment has been processed. ${invoice.balance > 0 ? 'Please arrange payment for the remaining balance.' : 'Your invoice is now fully paid.'}</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Payment Confirmation', content);
  return sendEmail(customer.email, subject, htmlContent);
};

const sendPurchaseOrderEmail = async (factory, purchaseOrder) => {
  const subject = `Purchase Order ${purchaseOrder.poNumber}`;
  const content = `
    <h2>Hi ${factory.contactPerson || factory.companyName},</h2>
    <p>We have sent you a purchase order:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>PO Number</td>
        <td>${purchaseOrder.poNumber}</td>
      </tr>
      <tr>
        <td>Total Amount</td>
        <td>${purchaseOrder.currency} ${purchaseOrder.total}</td>
      </tr>
      <tr>
        <td>Status</td>
        <td>${purchaseOrder.status}</td>
      </tr>
      <tr>
        <td>Expected Delivery</td>
        <td>${dayjs(purchaseOrder.expectedDelivery).format('YYYY-MM-DD')}</td>
      </tr>
    </table>
    <p>Please review and confirm receipt of this purchase order.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Purchase Order', content);
  return sendEmail(factory.email, subject, htmlContent);
};

const sendShipmentUpdateEmail = async (customer, shipment, event) => {
  const subject = `Shipment Update - ${shipment.shipmentNumber}`;
  const content = `
    <h2>Hi ${customer.contactPerson || customer.companyName},</h2>
    <p>Your shipment has been updated:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Shipment Number</td>
        <td>${shipment.shipmentNumber}</td>
      </tr>
      <tr>
        <td>Tracking Event</td>
        <td>${event.status}</td>
      </tr>
      <tr>
        <td>Location</td>
        <td>${event.location || 'N/A'}</td>
      </tr>
      <tr>
        <td>Timestamp</td>
        <td>${dayjs(event.timestamp).format('YYYY-MM-DD HH:mm')}</td>
      </tr>
    </table>
    <p>You can track your shipment using the tracking number: ${shipment.containerNumber}</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Shipment Update', content);
  return sendEmail(customer.email, subject, htmlContent);
};

const sendInspectionScheduledEmail = async (factory, inspection) => {
  const subject = `Inspection Scheduled - ${inspection.inspectionNumber}`;
  const content = `
    <h2>Hi ${factory.contactPerson || factory.companyName},</h2>
    <p>An inspection has been scheduled for your facility:</p>
    <table>
      <tr>
        <th>Detail</th>
        <th>Value</th>
      </tr>
      <tr>
        <td>Inspection Number</td>
        <td>${inspection.inspectionNumber}</td>
      </tr>
      <tr>
        <td>Type</td>
        <td>${inspection.type}</td>
      </tr>
      <tr>
        <td>Scheduled Date</td>
        <td>${dayjs(inspection.scheduledDate).format('YYYY-MM-DD')}</td>
      </tr>
      <tr>
        <td>Status</td>
        <td>${inspection.status}</td>
      </tr>
    </table>
    <p>Please ensure your team is available for the inspection on the scheduled date.</p>
    <p>Best regards,<br/>Trading ERP Team</p>
  `;
  const htmlContent = generateEmailTemplate('Inspection Scheduled', content);
  return sendEmail(factory.email, subject, htmlContent);
};

/**
 * Send outreach email for cold prospecting
 * Plain text only, minimal HTML formatting (no company template wrapper)
 * SMTP must be configured (no Ethereal fallback)
 */
const sendOutreachEmail = async ({ fromAddress, toAddress, toName, subject, bodyText, replyTo, cc, bcc, signatureHtml: customSignatureHtml, signatureText: customSignatureText }) => {
  try {
    // Check SMTP is configured - no fallback for outreach
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP not configured for outreach emails — set SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    }

    const transporterInstance = await getTransporter();

    // Convert plain text body to HTML paragraphs
    const bodyHtml = bodyText
      .split(/\n/)
      .map(line => line.trim() === '' ? '<br>' : `<span>${line}</span><br>`)
      .join('\n');

    // Use custom signature if provided, otherwise fall back to default Alex/Sovern House signature
    const signatureHtml = customSignatureHtml || `
      <div style="margin-top: 36px; font-family: Arial, sans-serif; color: #0E0D0C; line-height: 1.5;">

        <!-- Forest green rule — brand separator -->
        <div style="height: 2px; background-color: #1D5A32; margin-bottom: 24px;"></div>

        <!-- Handwritten signature -->
        <div style="margin-bottom: 12px;">
          <img src="https://sovernhouse.co/images/alex-signature@2x.png" alt="" width="116" height="65" style="display: block; border: 0;">
        </div>

        <!-- Name -->
        <div style="font-size: 15px; font-weight: 700; letter-spacing: 0.02em; color: #0E0D0C; margin-bottom: 3px;">Alexander McConnell</div>

        <!-- Title -->
        <div style="font-size: 12px; color: #5A5855; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 14px;">Founder</div>

        <!-- Contact line -->
        <div style="font-size: 13px; margin-bottom: 24px;">
          <a href="https://sovernhouse.co" style="color: #1D5A32; text-decoration: none; font-weight: 600;">sovernhouse.co</a>
          <span style="color: #C8C4BC; margin: 0 8px;">&middot;</span>
          <span style="color: #5A5855;">+886 970 781 818</span>
        </div>

        <!-- Logo — official asset, light/transparent, no dark box -->
        <div style="margin-bottom: 14px;">
          <a href="https://sovernhouse.co" style="text-decoration: none; display: inline-block;">
            <img src="https://sovernhouse.co/logos/sovern-wordmark-email-light.png" alt="Sovern House" width="200" height="93" style="display: block; border: 0;">
          </a>
        </div>

        <!-- Tagline -->
        <div style="font-size: 12px; color: #5A5855; font-style: italic; letter-spacing: 0.01em; margin-bottom: 16px;">Your buying office in Asia.</div>

        <!-- Legal -->
        <div style="font-size: 10px; color: #B0ABA4; border-top: 1px solid #EBEBEB; padding-top: 10px;">Sovern House is a brand of New Route International Exchange Co., Ltd. &mdash; Taiwan.</div>

      </div>
    `;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #0E0D0C; line-height: 1.7; max-width: 600px;">
        <div style="margin-bottom: 24px;">${bodyHtml}</div>
        ${signatureHtml}
      </div>
    `;

    // Plain text fallback — use custom if provided, otherwise default Alex signature
    const textWithSig = customSignatureText
      ? `${bodyText}\n\n${customSignatureText}`
      : `${bodyText}\n\n--\nAlexander McConnell\nFounder · Sovern House\nsovernhouse.co · +886 970 781 818\n\nSovern House is a brand of New Route International Exchange Co., Ltd. — Taiwan.`;

    const mailOptions = {
      from: `Sovern House | Alex <${fromAddress || process.env.SMTP_USER}>`,
      to: toName ? `${toName} <${toAddress}>` : toAddress,
      subject: subject,
      text: textWithSig,
      html: htmlContent,
    };

    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    if (cc) {
      mailOptions.cc = cc;
    }

    if (bcc) {
      mailOptions.bcc = bcc;
    }

    const result = await transporterInstance.sendMail(mailOptions);

    logger.info(`[OUTREACH] Sent to ${toAddress}, Subject: ${subject}, MessageId: ${result.messageId}`);

    re