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
          /* 2026-05-18: system font stack — renders as San Francisco on
             Apple, Segoe UI on Windows / Outlook, Roboto on Android.
             Falls all the way back to Arial for Outlook 2007-2019 (no
             regression vs the prior value). Removes the template-y
             Arial-everywhere look while staying email-client-safe. */
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; color: #333; line-height: 1.6; font-size: 15px; }
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
    // 2026-05-18 brand-safety gateway: every transactional send funnels
    // through this function. Callers can pass `brandCode` in options
    // to opt into the rule #9 check. When brandCode is provided, the
    // gateway scans htmlContent + subject for foreign-brand identity
    // markers and refuses to ship if found. Existing callers that
    // don't pass brandCode keep their pre-fix behaviour (which today
    // is "fails silently because SMTP isn't configured anyway" — but
    // the gateway protects them the moment SMTP turns on).
    if (options.brandCode) {
      const { assertBrandSafe } = require('./brandSafetyGateway');
      assertBrandSafe({
        brandCode: options.brandCode,
        contentFields: {
          subject: subject,
          htmlContent: htmlContent,
        },
        entityId: options.entityId || null,
      });
    }

    // Allow disabling via env var (default is OFF for dev)
    if (process.env.EMAIL_ENABLED !== 'true') {
      logger.info(`[EMAIL] (disabled) To: ${to}, Subject: ${subject}`);
      return { success: true, disabled: true, message: 'Email delivery disabled' };
    }

    const transporterInstance = await getTransporter();

    // Strip the brand-safety-only fields before handing to nodemailer.
    const { brandCode: _bc, entityId: _eid, ...mailOpts } = options;

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@trading-erp.com',
      to: to,
      subject: subject,
      html: htmlContent,
      ...mailOpts
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
 * Build the Sovern House outreach HTML + plain-text body. Shared by both
 * the Gmail API path and the SMTP fallback so the rendered email is
 * byte-identical regardless of transport.
 */
function buildOutreachContent({ bodyText, customSignatureHtml, customSignatureText }) {
  const bodyHtml = bodyText
    .split(/\n/)
    .map(line => line.trim() === '' ? '<br>' : `<span>${line}</span><br>`)
    .join('\n');

  const signatureHtml = customSignatureHtml || `
    <div style="margin-top: 36px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0E0D0C; line-height: 1.5;">
      <div style="height: 2px; background-color: #1D5A32; margin-bottom: 24px;"></div>
      <div style="margin-bottom: 12px;">
        <img src="https://sovernhouse.co/images/alex-signature@2x.png" alt="" width="116" height="65" style="display: block; border: 0;">
      </div>
      <div style="font-size: 15px; font-weight: 700; letter-spacing: 0.02em; color: #0E0D0C; margin-bottom: 3px;">Alexander McConnell</div>
      <div style="font-size: 12px; color: #5A5855; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 14px;">Founder</div>
      <div style="font-size: 13px; margin-bottom: 24px;">
        <a href="https://sovernhouse.co" style="color: #1D5A32; text-decoration: none; font-weight: 600;">sovernhouse.co</a>
        <span style="color: #C8C4BC; margin: 0 8px;">&middot;</span>
        <span style="color: #5A5855;">+886 970 781 818</span>
      </div>
      <div style="margin-bottom: 14px;">
        <a href="https://sovernhouse.co" style="text-decoration: none; display: inline-block;">
          <img src="https://sovernhouse.co/logos/sovern-wordmark-email-light.png" alt="Sovern House" width="200" height="93" style="display: block; border: 0;">
        </a>
      </div>
      <div style="font-size: 12px; color: #5A5855; font-style: italic; letter-spacing: 0.01em; margin-bottom: 16px;">Your buying office in Asia.</div>
      <div style="font-size: 10px; color: #B0ABA4; border-top: 1px solid #EBEBEB; padding-top: 10px;">Sovern House is a brand of New Route International Exchange Co., Ltd. &mdash; Taiwan.</div>
    </div>
  `;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; color: #0E0D0C; line-height: 1.6; max-width: 600px;">
      <div style="margin-bottom: 24px;">${bodyHtml}</div>
      ${signatureHtml}
    </div>
  `;

  const textContent = customSignatureText
    ? `${bodyText}\n\n${customSignatureText}`
    : `${bodyText}\n\n--\nAlexander McConnell\nFounder . Sovern House\nsovernhouse.co . +886 970 781 818\n\nSovern House is a brand of New Route International Exchange Co., Ltd. - Taiwan.`;

  return { htmlContent, textContent };
}

/**
 * RFC 2047 encode a header value if it contains non-ASCII chars.
 * Required because Subject lines / display names with international
 * characters need MIME encoded-word format.
 */
function encodeHeader(value) {
  if (!value) return '';
  // 2026-05-18 bugfix: a plain comma in an ASCII display-name made Gmail
  // parse the To header as TWO recipients per RFC 2822 — "Ofer Dardashti,
  // Founder <info@ultimatefloors.net>" parsed as "Ofer Dardashti" (no
  // email) + "Founder <info@ultimatefloors.net>", which Gmail rejected
  // with "Invalid To header". Wrap any ASCII string that contains RFC
  // 2822 "specials" in a quoted-string. RFC 2047 (=?UTF-8?B?...?=)
  // covers non-ASCII as before.
  // eslint-disable-next-line no-control-regex
  const isAscii = /^[\x00-\x7F]+$/.test(value);
  if (isAscii) {
    // Quote only the RFC 2822 specials that real-world parsers (Gmail
    // most strict) actually break on. Skipping parens + dots: Gmail
    // treats parens as RFC 2822 "comments" and dots are universally
    // accepted in display-names ("Mr. Ben", "J. Smith"). Quoting them
    // would just add noise on common contact names like
    // "John Cerisano (President)" which already sent successfully.
    if (/[,;<>@:\\"]/.test(value)) {
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      return `"${escaped}"`;
    }
    return value;
  }
  return '=?UTF-8?B?' + Buffer.from(value, 'utf8').toString('base64') + '?=';
}

/**
 * Send outreach email via Gmail API using the active connected Google
 * account. Preferred over SMTP because:
 *  - Single OAuth surface (same scope set as gmail-sync receive)
 *  - No App Password to rotate / leak
 *  - Sent messages land in the user's Gmail Sent folder by default
 *  - No SMTP host/port/TLS configuration to maintain
 *
 * Returns { messageId, threadId, via: 'gmail-api', accountEmail }.
 * Throws if no active connected account exists; the caller (sendOutreachEmail)
 * decides whether to fall through to SMTP.
 *
 * fromDisplayName: optional override for the From header display name.
 *   Defaults to 'Sovern House | Alex'. Pass the brand's displayName + ' | Alex'
 *   for FW and future brands (e.g. 'FlorWay | Alex').
 */
const sendOutreachEmailViaGmailAPI = async ({ fromAddress, toAddress, toName, subject, bodyText, replyTo, cc, bcc, signatureHtml: customSignatureHtml, signatureText: customSignatureText, fromDisplayName }) => {
  const db = require('../models');
  const { google } = require('googleapis');
  const { getAuthClientForAccount } = require('../controllers/googleAccountController');

  // Pick the connected account: prefer one matching fromAddress if specified,
  // otherwise fall back to any active account. Outreach typically comes from
  // a single configured sender, so this is fine in practice.
  let account = null;
  if (fromAddress) {
    account = await db.ConnectedGoogleAccount.findOne({
      where: { email: fromAddress, isActive: true },
    });
  }
  if (!account) {
    account = await db.ConnectedGoogleAccount.findOne({ where: { isActive: true } });
  }
  if (!account) {
    throw new Error('No active connected Google account. Connect one in /settings/connected-accounts.');
  }

  const auth = await getAuthClientForAccount(account);
  const gmail = google.gmail({ version: 'v1', auth });

  const { htmlContent, textContent } = buildOutreachContent({ bodyText, customSignatureHtml, customSignatureText });

  // Build RFC 2822 multipart/alternative message
  // Use the provided display name (brand-aware) or fall back to SH default.
  // Pass display names through encodeHeader so RFC 2822 specials (comma,
  // semicolon, parens, etc.) get properly quoted — see 2026-05-18 fix
  // for "Ofer Dardashti, Founder" header rejection.
  const senderDisplayName = fromDisplayName || 'Sovern House | Alex';
  const fromHeader = `${encodeHeader(senderDisplayName)} <${account.email}>`;
  const toHeader = toName ? `${encodeHeader(toName)} <${toAddress}>` : toAddress;
  const boundary = '----=_Part_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now();

  const headers = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);

  const rfc2822 = [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    textContent,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlContent,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  // URL-safe base64 encode (Gmail API requires this variant)
  const raw = Buffer.from(rfc2822, 'utf8').toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  logger.info(`[OUTREACH] Sent via Gmail API to ${toAddress}, gmailId=${result.data.id}, account=${account.email}`);

  return {
    messageId: result.data.id,
    threadId: result.data.threadId,
    via: 'gmail-api',
    accountEmail: account.email,
  };
};

/**
 * Send outreach email for cold prospecting.
 *
 * PRIMARY PATH: Gmail API via the connected Google account (OAuth).
 * FALLBACK: nodemailer SMTP (only if Gmail API path is unavailable AND
 * SMTP env vars are configured). The fallback exists for:
 *   - Setups that haven't connected a Google account yet
 *   - Token-refresh failures (very rare; gmail-sync would also be down)
 *   - Test environments
 *
 * Set OUTREACH_FORCE_SMTP=1 to disable Gmail API entirely (debugging only).
 */
const sendOutreachEmail = async ({ fromAddress, toAddress, toName, subject, bodyText, replyTo, cc, bcc, signatureHtml: customSignatureHtml, signatureText: customSignatureText, fromDisplayName, brandCode, brandDisplayName }) => {
  // 2026-05-18 brand-leak gateway (rule #9 / L-068 class). Delegates to
  // the shared services/brandSafetyGateway so every renderer in the
  // codebase uses the same marker regex + assertion logic. See
  // brand-safety.md for the contract.
  if (brandCode && brandDisplayName) {
    const { assertBrandSafe } = require('./brandSafetyGateway');
    assertBrandSafe({
      brandCode,
      expectedFromDisplayName: `${brandDisplayName} | Alex`,
      actualFromDisplayName: fromDisplayName || null,
      contentFields: {
        signatureHtml: customSignatureHtml,
        signatureText: customSignatureText,
        bodyText: bodyText,
      },
    });
  } else if (fromAddress) {
    // Legacy caller without brandCode. Refuse if from_address is the
    // FW/HH sender but fromDisplayName is missing or contains "Sovern
    // House". This protects un-migrated callers without requiring them
    // to pass brandCode immediately.
    const isFwHhSender = /alexflorway@gmail\.com/i.test(fromAddress);
    if (isFwHhSender && (!fromDisplayName || /Sovern\s*House/i.test(fromDisplayName))) {
      throw new Error(
        `Brand-leak refused: sending from ${fromAddress} but fromDisplayName missing or contains "Sovern House". ` +
        `Pass brandCode + brandDisplayName so the gateway can verify, or set fromDisplayName explicitly to the FW/HH display name.`
      );
    }
  }

  // Try Gmail API first unless explicitly disabled
  if (process.env.OUTREACH_FORCE_SMTP !== '1') {
    try {
      return await sendOutreachEmailViaGmailAPI({
        fromAddress, toAddress, toName, subject, bodyText, replyTo, cc, bcc,
        signatureHtml: customSignatureHtml, signatureText: customSignatureText,
        fromDisplayName,
      });
    } catch (gmailErr) {
      logger.warn(`[OUTREACH] Gmail API send failed (${gmailErr.message}); falling back to SMTP if configured.`);
    }
  }

  // SMTP fallback path
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('Outreach send failed: Gmail API path unavailable AND SMTP not configured (need either a connected Google account or SMTP_HOST/SMTP_USER/SMTP_PASS).');
    }

    const transporterInstance = await getTransporter();

    // Reuse the shared content builder so SMTP and Gmail-API renders match byte-for-byte
    const { htmlContent, textContent } = buildOutreachContent({ bodyText, customSignatureHtml, customSignatureText });

    const mailOptions = {
      from: `${fromDisplayName || 'Sovern House | Alex'} <${fromAddress || process.env.SMTP_USER}>`,
      to: toName ? `${toName} <${toAddress}>` : toAddress,
      subject: subject,
      text: textContent,
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

    logger.info(`[OUTREACH] Sent via SMTP to ${toAddress}, Subject: ${subject}, MessageId: ${result.messageId}`);

    return {
      messageId: result.messageId,
      accepted: result.accepted,
      rejected: result.rejected,
      via: 'smtp',
    };
  } catch (error) {
    logger.error(`[OUTREACH] Error sending to ${toAddress}:`, error.message);
    throw error;
  }
};

/**
 * Send a transactional email (quotation, PI, invoice, etc.) via Gmail API.
 * Unlike sendOutreachEmail, this accepts pre-built htmlContent + textContent
 * so the caller controls the full layout (tables, brand colors, etc.).
 *
 * Reuses the same connected-account lookup as outreach so all sends come
 * from the correct brand Gmail account.
 */
const sendTransactionalEmail = async ({ fromAddress, fromDisplayName, toAddress, toName, subject, htmlContent, textContent, replyTo, cc, bcc }) => {
  const db = require('../models');
  const { google } = require('googleapis');
  const { getAuthClientForAccount } = require('../controllers/googleAccountController');

  let account = null;
  if (fromAddress) {
    account = await db.ConnectedGoogleAccount.findOne({
      where: { email: fromAddress, isActive: true },
    });
  }
  if (!account) {
    account = await db.ConnectedGoogleAccount.findOne({ where: { isActive: true } });
  }
  if (!account) {
    throw new Error('No active connected Google account. Connect one in /settings/connected-accounts.');
  }

  const auth = await getAuthClientForAccount(account);
  const gmail = google.gmail({ version: 'v1', auth });

  const senderDisplayName = fromDisplayName || 'Sovern House | Alex';
  const fromHeader = `${senderDisplayName} <${account.email}>`;
  const toHeader = toName ? `${encodeHeader(toName)} <${toAddress}>` : toAddress;
  const boundary = '----=_Part_' + Math.random().toString(36).slice(2, 12) + '_' + Date.now();

  const headers = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);
  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);

  const rfc2822 = [
    headers.join('\r\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    textContent,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlContent,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const raw = Buffer.from(rfc2822, 'utf8').toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const result = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  logger.info(`[TRANSACTIONAL] Sent via Gmail API to ${toAddress}, Subject: ${subject}, gmailId=${result.data.id}, account=${account.email}`);

  return {
    messageId: result.data.id,
    threadId: result.data.threadId,
    via: 'gmail-api',
    accountEmail: account.email,
  };
};

/**
 * sendTransactionalEmail with SMTP fallback. Same pattern as sendOutreachEmail.
 */
const sendTransactionalEmailWithFallback = async (params) => {
  if (process.env.OUTREACH_FORCE_SMTP !== '1') {
    try {
      return await sendTransactionalEmail(params);
    } catch (gmailErr) {
      logger.warn(`[TRANSACTIONAL] Gmail API send failed (${gmailErr.message}); falling back to SMTP if configured.`);
    }
  }

  const { fromAddress, fromDisplayName, toAddress, toName, subject, htmlContent, textContent, replyTo, cc, bcc } = params;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Transactional send failed: Gmail API path unavailable AND SMTP not configured.');
  }

  const transporterInstance = await getTransporter();

  const mailOptions = {
    from: `${fromDisplayName || 'Sovern House | Alex'} <${fromAddress || process.env.SMTP_USER}>`,
    to: toName ? `${toName} <${toAddress}>` : toAddress,
    subject,
    text: textContent,
    html: htmlContent,
  };

  if (replyTo) mailOptions.replyTo = replyTo;
  if (cc) mailOptions.cc = cc;
  if (bcc) mailOptions.bcc = bcc;

  const result = await transporterInstance.sendMail(mailOptions);
  logger.info(`[TRANSACTIONAL] Sent via SMTP to ${toAddress}, Subject: ${subject}, MessageId: ${result.messageId}`);

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    via: 'smtp',
  };
};

/**
 * Phase 4, C17: single source of truth for the Egypt-Fanzey BCC rule.
 *
 * SH-brand Egypt customers/leads BCC mohanadfanzey@gmail.com on every
 * outgoing email (outreach, campaign, triage reply). FW-brand never does,
 * regardless of country. All other (brand, country) combinations leave
 * the BCC list untouched.
 *
 * Returns a new array (does not mutate the input). Tolerates missing
 * arguments — a missing brandCode, country, or list just means no Egypt
 * BCC is added.
 *
 * @param {string} brandCode  Resolved brand code on the entity being emailed.
 * @param {string} country    Country on the customer/lead.
 * @param {string[]} bccList  Existing BCC recipients (may be empty/undefined).
 * @returns {string[]}        New BCC list with Fanzey appended if eligible.
 */
function applyEgyptBccIfNeeded(brandCode, country, bccList) {
  const list = Array.isArray(bccList) ? [...bccList] : (bccList ? [bccList] : []);
  const FANZEY = 'mohanadfanzey@gmail.com';
  if (brandCode === 'SH'
      && country
      && country.toLowerCase() === 'egypt'
      && !list.map((e) => (e || '').toLowerCase()).includes(FANZEY)) {
    list.push(FANZEY);
  }
  return list;
}

module.exports = {
  sendEmail,
  sendOutreachEmailViaGmailAPI,
  generateEmailTemplate,
  sendQuotationEmail,
  sendProformaInvoiceEmail,
  sendOrderConfirmationEmail,
  sendShipmentNotificationEmail,
  sendInspectionReportEmail,
  sendClaimEmail,
  sendPaymentReminderEmail,
  sendInvoiceEmail,
  sendPaymentConfirmationEmail,
  sendPurchaseOrderEmail,
  sendShipmentUpdateEmail,
  sendInspectionScheduledEmail,
  sendOutreachEmail,
  sendTransactionalEmail,
  sendTransactionalEmailWithFallback,
  applyEgyptBccIfNeeded,
  // Exported for unit testing of the 2026-05-18 RFC 2822 quoting fix.
  encodeHeader,
};
