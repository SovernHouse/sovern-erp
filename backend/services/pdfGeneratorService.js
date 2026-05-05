const PDFDocument = require('pdfkit');
const db = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger.js');

/**
 * PDF Generation Service
 * Creates professional PDF documents for invoices, POs, quotations, proformas, and packing lists
 */

/**
 * Add company header to PDF
 */
function addHeader(doc, title, number, date) {
  // Company name as text-based header
  doc.fontSize(20).font('Helvetica-Bold').text('TRADING COMPANY', 50, 50);
  doc.fontSize(10).font('Helvetica').text('Global Trading Solutions', 50, 75);

  // Title and document number
  doc.fontSize(16).font('Helvetica-Bold').text(title, 350, 50);
  doc.fontSize(10).font('Helvetica').text(`Document #: ${number}`, 350, 75);
  doc.fontSize(10).font('Helvetica').text(`Date: ${date}`, 350, 95);

  // Horizontal line
  doc.moveTo(50, 115).lineTo(550, 115).stroke();
}

/**
 * Add addresses section
 */
function addAddressSection(doc, fromAddress, toAddress) {
  doc.fontSize(10).font('Helvetica-Bold').text('FROM:', 50, 130);
  doc.fontSize(9).font('Helvetica').text(fromAddress, 50, 147);

  doc.fontSize(10).font('Helvetica-Bold').text('TO:', 320, 130);
  doc.fontSize(9).font('Helvetica').text(toAddress, 320, 147);
}

/**
 * Add line items table
 */
function addLineItemsTable(doc, items, startY) {
  const tableTop = startY;
  const itemHeight = 30;
  const margin = 50;
  const col1 = margin;
  const col2 = 300;
  const col3 = 420;
  const col4 = 500;

  // Table header
  doc.fontSize(10).font('Helvetica-Bold');
  doc.fillColor('#f3f4f6').rect(col1 - 5, tableTop, 505, 25).fill();

  doc.fillColor('#000000').text('Description', col1, tableTop + 7);
  doc.text('Qty', col2, tableTop + 7);
  doc.text('Unit Price', col3, tableTop + 7);
  doc.text('Amount', col4, tableTop + 7);

  // Table rows
  doc.fontSize(9).font('Helvetica');
  let currentY = tableTop + 30;

  items.forEach((item) => {
    const description = item.description || 'N/A';
    const quantity = parseFloat(item.quantity || 0).toFixed(2);
    const unitPrice = parseFloat(item.unitPrice || 0).toFixed(2);
    const amount = parseFloat(item.total || 0).toFixed(2);

    // Wrap long descriptions
    const descWidth = col2 - col1 - 10;
    const lines = doc.heightOfString(description, { width: descWidth });

    if (currentY + lines > 700) {
      doc.addPage();
      currentY = 50;
    }

    doc.fillColor('#000000').text(description, col1, currentY, { width: descWidth });
    doc.text(quantity, col2, currentY);
    doc.text(`$${unitPrice}`, col3, currentY);
    doc.text(`$${amount}`, col4, currentY);

    currentY += Math.max(20, lines) + 10;
  });

  return currentY;
}

/**
 * Add totals section
 */
function addTotalsSection(doc, subtotal, discount, tax, total, currency = 'USD') {
  let currentY = doc.y + 20;

  const col1 = 400;
  const col2 = 480;

  doc.fontSize(9).font('Helvetica');

  const subtotalText = `Subtotal:`;
  const discountText = `Discount:`;
  const taxText = `Tax (${parseFloat(tax) === 0 ? '0' : '10'}%):`;
  const totalText = `TOTAL:`;

  doc.fillColor('#000000').text(subtotalText, col1, currentY);
  doc.text(`${currency} ${parseFloat(subtotal).toFixed(2)}`, col2, currentY);

  currentY += 20;
  doc.text(discountText, col1, currentY);
  doc.text(`${currency} ${parseFloat(discount).toFixed(2)}`, col2, currentY);

  currentY += 20;
  doc.fillColor('#666666').text(taxText, col1, currentY);
  doc.text(`${currency} ${parseFloat(tax).toFixed(2)}`, col2, currentY);

  currentY += 25;
  doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12);
  doc.fillColor('#1f2937').rect(col1 - 10, currentY - 10, 100, 25).fill();
  doc.fillColor('#ffffff').text(totalText, col1, currentY);
  doc.text(`${currency} ${parseFloat(total).toFixed(2)}`, col2, currentY);

  return currentY + 30;
}

/**
 * Add footer section
 */
function addFooter(doc, terms = 'Standard terms apply') {
  const pageHeight = doc.page.height;
  const footerY = pageHeight - 100;

  doc.fontSize(9).font('Helvetica');
  doc.moveTo(50, footerY).lineTo(550, footerY).stroke();

  doc.fontSize(8).font('Helvetica').fillColor('#666666');
  doc.text('Terms & Conditions:', 50, footerY + 10);
  doc.fontSize(7).text(terms, 50, footerY + 25, { width: 500 });

  // Page number
  doc.fontSize(8).fillColor('#999999');
  doc.text(`Page 1`, 50, pageHeight - 20);
}

/**
 * Generate Invoice PDF
 */
async function generateInvoicePDF(invoiceId) {
  try {
    const invoice = await db.Invoice.findByPk(invoiceId, {
      include: [
        { model: db.Customer, attributes: ['companyName', 'contactPerson', 'address', 'city', 'country', 'phone', 'currency'] },
        { model: db.SalesOrder, include: [{ model: db.SalesOrderItem, include: [{ model: db.Product, attributes: ['name', 'code'] }] }] }
      ]
    });

    if (!invoice) throw new Error('Invoice not found');

    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));

    // Header
    const invoiceDate = new Date(invoice.createdAt).toLocaleDateString();
    addHeader(doc, 'INVOICE', invoice.invoiceNumber, invoiceDate);

    // Address section
    const fromAddress = 'Trading Company\nGlobal Headquarters\nEmail: info@trading.com\nPhone: +1-800-TRADING';
    const customer = invoice.Customer;
    const toAddress = `${customer.companyName}\n${customer.contactPerson || ''}\n${customer.address || ''}\n${customer.city || ''}, ${customer.country || ''}\nPhone: ${customer.phone || ''}`;
    addAddressSection(doc, fromAddress, toAddress);

    // Invoice details
    doc.fontSize(9).font('Helvetica');
    doc.text(`Invoice Date: ${invoiceDate}`, 50, 210);
    doc.text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}`, 50, 230);
    doc.text(`Payment Terms: ${invoice.paymentTerms || 'Net 30'}`, 50, 250);

    // Line items
    let items = [];
    if (invoice.SalesOrder && invoice.SalesOrder.SalesOrderItems) {
      items = invoice.SalesOrder.SalesOrderItems.map(item => ({
        description: `${item.Product.name} (${item.Product.code})`,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total
      }));
    }

    const tableY = addLineItemsTable(doc, items, 280);

    // Totals
    addTotalsSection(doc, invoice.subtotal, invoice.discount, invoice.tax, invoice.total, invoice.currency);

    // Notes
    if (invoice.notes) {
      doc.fontSize(8).font('Helvetica');
      doc.text('Additional Notes:', 50, doc.y + 10);
      doc.fontSize(7).text(invoice.notes, 50, doc.y + 10, { width: 500 });
    }

    // Footer
    addFooter(doc, 'Payment must be received by due date. Bank transfer or credit card accepted.');

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating invoice PDF:', error);
    throw error;
  }
}

/**
 * Generate Purchase Order PDF
 */
async function generatePurchaseOrderPDF(poId) {
  try {
    const po = await db.PurchaseOrder.findByPk(poId, {
      include: [
        { model: db.Factory, attributes: ['companyName', 'contactPerson', 'address', 'city', 'country', 'phone', 'currency'] },
        { model: db.PurchaseOrderItem, include: [{ model: db.Product, attributes: ['name', 'code'] }] }
      ]
    });

    if (!po) throw new Error('Purchase Order not found');

    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));

    // Header
    const poDate = new Date(po.createdAt).toLocaleDateString();
    addHeader(doc, 'PURCHASE ORDER', po.poNumber, poDate);

    // Address section
    const fromAddress = 'Trading Company\nGlobal Headquarters\nEmail: procurement@trading.com\nPhone: +1-800-TRADING';
    const factory = po.Factory;
    const toAddress = `${factory.companyName}\n${factory.contactPerson || ''}\n${factory.address || ''}\n${factory.city || ''}, ${factory.country || ''}\nPhone: ${factory.phone || ''}`;
    addAddressSection(doc, fromAddress, toAddress);

    // PO details
    doc.fontSize(9).font('Helvetica');
    doc.text(`PO Date: ${poDate}`, 50, 210);
    doc.text(`Expected Delivery: ${po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : 'N/A'}`, 50, 230);
    doc.text(`Status: ${po.status}`, 50, 250);

    // Line items
    const items = (po.PurchaseOrderItems || []).map(item => ({
      description: `${item.Product.name} (${item.Product.code})`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total
    }));

    addLineItemsTable(doc, items, 280);

    // Totals
    addTotalsSection(doc, po.subtotal, 0, 0, po.total, po.currency);

    // Terms
    if (po.notes) {
      doc.fontSize(8).font('Helvetica');
      doc.text('Shipping & Payment Terms:', 50, doc.y + 10);
      doc.fontSize(7).text(po.notes, 50, doc.y + 10, { width: 500 });
    }

    // Footer
    addFooter(doc, 'Delivery terms: CIF. Payment on receipt of goods. All goods subject to inspection.');

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating purchase order PDF:', error);
    throw error;
  }
}

/**
 * Generate Quotation PDF
 */
async function generateQuotationPDF(quotationId) {
  try {
    const quotation = await db.Quotation.findByPk(quotationId, {
      include: [
        { model: db.Customer, attributes: ['companyName', 'contactPerson', 'address', 'city', 'country', 'phone', 'currency'] },
        { model: db.QuotationItem, include: [{ model: db.Product, attributes: ['name', 'code'] }] }
      ]
    });

    if (!quotation) throw new Error('Quotation not found');

    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));

    // Header
    const quoteDate = new Date(quotation.createdAt).toLocaleDateString();
    addHeader(doc, 'QUOTATION', quotation.quotationNumber, quoteDate);

    // Address section
    const fromAddress = 'Trading Company\nGlobal Headquarters\nEmail: sales@trading.com\nPhone: +1-800-TRADING';
    const customer = quotation.Customer;
    const toAddress = `${customer.companyName}\n${customer.contactPerson || ''}\n${customer.address || ''}\n${customer.city || ''}, ${customer.country || ''}`;
    addAddressSection(doc, fromAddress, toAddress);

    // Quotation details
    doc.fontSize(9).font('Helvetica');
    doc.text(`Quote Date: ${quoteDate}`, 50, 210);
    doc.text(`Valid Until: ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A'}`, 50, 230);
    doc.text(`Status: ${quotation.status}`, 50, 250);

    // Line items
    const items = (quotation.QuotationItems || []).map(item => ({
      description: `${item.Product.name} (${item.Product.code})`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total
    }));

    addLineItemsTable(doc, items, 280);

    // Totals
    addTotalsSection(doc, quotation.subtotal, quotation.discount, quotation.tax, quotation.total, quotation.currency);

    // Terms
    if (quotation.terms) {
      doc.fontSize(8).font('Helvetica');
      doc.text('Terms & Conditions:', 50, doc.y + 10);
      doc.fontSize(7).text(quotation.terms, 50, doc.y + 10, { width: 500 });
    }

    // Footer
    addFooter(doc, 'This quotation is valid for the period mentioned above. Prices subject to change without notice.');

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating quotation PDF:', error);
    throw error;
  }
}

/**
 * Generate Proforma Invoice PDF
 */
async function generateProformaInvoicePDF(proformaId) {
  try {
    const proforma = await db.ProformaInvoice.findByPk(proformaId, {
      include: [
        { model: db.Customer, attributes: ['companyName', 'contactPerson', 'address', 'city', 'country', 'phone', 'currency'] },
        { model: db.ProformaInvoiceItem, include: [{ model: db.Product, attributes: ['name', 'code'] }] }
      ]
    });

    if (!proforma) throw new Error('Proforma Invoice not found');

    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));

    // Header
    const piDate = new Date(proforma.createdAt).toLocaleDateString();
    addHeader(doc, 'PROFORMA INVOICE', proforma.piNumber, piDate);

    // Address section
    const fromAddress = 'Trading Company\nGlobal Headquarters\nEmail: billing@trading.com\nPhone: +1-800-TRADING';
    const customer = proforma.Customer;
    const toAddress = `${customer.companyName}\n${customer.contactPerson || ''}\n${customer.address || ''}\n${customer.city || ''}, ${customer.country || ''}`;
    addAddressSection(doc, fromAddress, toAddress);

    // Proforma details
    doc.fontSize(9).font('Helvetica');
    doc.text(`PI Date: ${piDate}`, 50, 210);
    doc.text(`Valid Until: ${proforma.validUntil ? new Date(proforma.validUntil).toLocaleDateString() : 'N/A'}`, 50, 230);
    doc.text(`Payment Terms: ${proforma.paymentTerms || 'Net 30'}`, 50, 250);

    // Bank details
    if (proforma.bankDetails && Object.keys(proforma.bankDetails).length > 0) {
      doc.fontSize(8).font('Helvetica-Bold');
      doc.text('Bank Details:', 50, 270);
      doc.fontSize(8).font('Helvetica');
      Object.entries(proforma.bankDetails).forEach(([key, value], index) => {
        doc.text(`${key}: ${value}`, 50, 287 + (index * 15));
      });
    }

    // Line items
    const items = (proforma.ProformaInvoiceItems || []).map(item => ({
      description: `${item.Product.name} (${item.Product.code})`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total
    }));

    addLineItemsTable(doc, items, 330);

    // Totals
    addTotalsSection(doc, proforma.subtotal, proforma.discount, proforma.tax, proforma.total, proforma.currency);

    // Notes
    if (proforma.notes) {
      doc.fontSize(8).font('Helvetica');
      doc.text('Notes:', 50, doc.y + 10);
      doc.fontSize(7).text(proforma.notes, 50, doc.y + 10, { width: 500 });
    }

    // Footer
    addFooter(doc, 'This is a proforma invoice and not a final invoice. Goods available subject to availability.');

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating proforma invoice PDF:', error);
    throw error;
  }
}

/**
 * Generate Packing List PDF
 */
async function generatePackingListPDF(shipmentId) {
  try {
    const shipment = await db.Shipment.findByPk(shipmentId, {
      include: [
        {
          model: db.SalesOrder,
          include: [
            { model: db.Customer },
            { model: db.SalesOrderItem, include: [{ model: db.Product, attributes: ['name', 'code'] }] }
          ]
        }
      ]
    });

    if (!shipment) throw new Error('Shipment not found');

    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));

    // Header
    const shipmentDate = new Date(shipment.createdAt).toLocaleDateString();
    addHeader(doc, 'PACKING LIST', shipment.shipmentNumber, shipmentDate);

    // Shipment details
    const salesOrder = shipment.SalesOrder;
    doc.fontSize(9).font('Helvetica');
    doc.text(`Container: ${shipment.containerNumber || 'N/A'}`, 50, 130);
    doc.text(`Container Type: ${shipment.containerType || 'N/A'}`, 50, 150);
    doc.text(`Vessel: ${shipment.vesselName || 'N/A'}`, 50, 170);
    doc.text(`Voyage: ${shipment.voyageNumber || 'N/A'}`, 50, 190);
    doc.text(`Port of Loading: ${shipment.portOfLoading || 'N/A'}`, 50, 210);
    doc.text(`Port of Discharge: ${shipment.portOfDischarge || 'N/A'}`, 50, 230);

    // Line items
    const items = (salesOrder.SalesOrderItems || []).map(item => ({
      description: `${item.Product.name} (${item.Product.code})`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total
    }));

    addLineItemsTable(doc, items, 270);

    // Footer
    addFooter(doc, 'Please verify contents upon receipt and report any discrepancies immediately.');

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating packing list PDF:', error);
    throw error;
  }
}

module.exports = {
  generateInvoicePDF,
  generatePurchaseOrderPDF,
  generateQuotationPDF,
  generateProformaInvoicePDF,
  generatePackingListPDF
};
