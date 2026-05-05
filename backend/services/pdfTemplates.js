/**
 * PDF Templates Service
 * Provides specialized PDF template generators for professional documents
 * Supplements the existing pdfGeneratorService with additional templates
 */

const PDFDocument = require('pdfkit');
const db = require('../models');
const dayjs = require('dayjs');
const logger = require('../utils/logger.js');

/**
 * Helper: Create PDF document with consistent formatting
 */
function createPDFDocument() {
  return new PDFDocument({ margin: 50, size: 'A4' });
}

/**
 * Helper: Add company letterhead
 */
function addLetterhead(doc) {
  // Company header
  doc.fontSize(24).font('Helvetica-Bold').fillColor('#1f2937');
  doc.text('TRADING ERP', 50, 30);

  // Subtitle
  doc.fontSize(10).font('Helvetica').fillColor('#666');
  doc.text('Global Trading Solutions', 50, 58);
  doc.text('Email: info@trading-erp.com | Phone: +1-800-TRADING', 50, 72);

  // Divider line
  doc.strokeColor('#e5e7eb').lineWidth(2);
  doc.moveTo(50, 95).lineTo(550, 95).stroke();
  doc.strokeColor('#000000').lineWidth(1);

  return 110; // Return Y position after header
}

/**
 * Helper: Add footer with page numbers and company info
 */
function addFooterInfo(doc, startY = null) {
  const pageHeight = doc.page.height;
  const footerY = pageHeight - 80;

  // Footer divider
  doc.strokeColor('#e5e7eb').lineWidth(1);
  doc.moveTo(50, footerY).lineTo(550, footerY).stroke();

  // Footer text
  doc.fontSize(8).font('Helvetica').fillColor('#666');
  doc.text('Trading ERP | Confidential', 50, footerY + 10);
  doc.text('© 2026 All Rights Reserved', 50, footerY + 22);

  // Page number
  const pageNum = `Page ${doc.bufferedPageSize().count}`;
  doc.text(pageNum, 500, footerY + 10, { align: 'right' });
}

/**
 * Generate Packing List PDF
 * Professional packing list with carton details and weights
 */
async function generatePackingListPDF(packingListId) {
  try {
    const packingList = await db.PackingList.findByPk(packingListId, {
      include: [
        {
          model: db.Shipment,
          include: [
            { model: db.SalesOrder, include: [{ model: db.Customer }] }
          ]
        },
        { model: db.PackingListItem, include: [{ model: db.Product }] }
      ]
    });

    if (!packingList) throw new Error('Packing list not found');

    const doc = createPDFDocument();
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));

    // Letterhead
    let currentY = addLetterhead(doc);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#1f2937');
    doc.text('PACKING LIST', { align: 'center' });
    currentY += 30;

    // Document info
    doc.fontSize(10).font('Helvetica').fillColor('#000');
    const infoX = 50;
    const infoX2 = 300;

    currentY += 10;
    doc.text(`Reference: ${packingList.referenceNumber || 'N/A'}`, infoX, currentY);
    doc.text(`Date: ${dayjs(packingList.createdAt).format('YYYY-MM-DD')}`, infoX2, currentY);

    currentY += 20;
    doc.text(`Shipment #: ${packingList.Shipment?.shipmentNumber || 'N/A'}`, infoX, currentY);
    doc.text(`Container: ${packingList.Shipment?.containerNumber || 'N/A'}`, infoX2, currentY);

    // Customer info
    const customer = packingList.Shipment?.SalesOrder?.Customer;
    if (customer) {
      currentY += 30;
      doc.fontSize(11).font('Helvetica-Bold').text('DESTINATION:', infoX, currentY);
      currentY += 18;
      doc.fontSize(9).font('Helvetica');
      doc.text(`${customer.companyName}`, infoX, currentY);
      doc.text(`${customer.address || ''}`, infoX, currentY + 15);
      doc.text(`${customer.city}, ${customer.country}`, infoX, currentY + 30);
    }

    // Items table
    currentY = 260;
    const tableTop = currentY;

    // Table header
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff');
    doc.fillColor('#1f2937').rect(50, tableTop, 500, 25).fill();
    doc.fillColor('#fff').text('Carton', 60, tableTop + 7);
    doc.text('Description', 120, tableTop + 7);
    doc.text('Qty', 320, tableTop + 7);
    doc.text('Weight (kg)', 380, tableTop + 7);
    doc.text('Total Wt', 480, tableTop + 7);

    // Table rows
    currentY = tableTop + 30;
    doc.fontSize(9).font('Helvetica').fillColor('#000');

    let totalWeight = 0;
    const items = packingList.PackingListItems || [];

    items.forEach((item, index) => {
      if (currentY > 680) {
        doc.addPage();
        currentY = 50;
      }

      const cartonNum = item.cartonNumber || `${index + 1}`;
      const description = item.Product?.name || 'Unknown Product';
      const quantity = item.quantity || 0;
      const weight = parseFloat(item.weight || 0);
      const totalWt = (quantity * weight).toFixed(2);
      totalWeight += parseFloat(totalWt);

      // Alternate row background
      if (index % 2 === 0) {
        doc.fillColor('#f9fafb').rect(50, currentY - 5, 500, 20).fill();
      }

      doc.fillColor('#000').text(cartonNum, 60, currentY);
      doc.text(description, 120, currentY);
      doc.text(quantity.toString(), 320, currentY);
      doc.text(weight.toFixed(2), 380, currentY);
      doc.text(totalWt, 480, currentY);

      currentY += 22;
    });

    // Totals
    currentY += 10;
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1f2937');
    doc.text(`Total Weight: ${totalWeight.toFixed(2)} kg`, infoX, currentY);
    doc.text(`Total Cartons: ${items.length}`, infoX, currentY + 20);

    // Notes section
    if (packingList.notes) {
      currentY += 50;
      doc.fontSize(10).font('Helvetica-Bold').text('Special Instructions:', infoX, currentY);
      currentY += 20;
      doc.fontSize(9).font('Helvetica').text(packingList.notes, infoX, currentY, { width: 450 });
    }

    // Footer
    addFooterInfo(doc);
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating packing list PDF:', error);
    throw error;
  }
}

/**
 * Generate Certificate of Origin PDF
 * Professional CoO document with HS codes and customs info
 */
async function generateCertificateOfOriginPDF(certId) {
  try {
    const cert = await db.CertificateOfOrigin.findByPk(certId, {
      include: [
        { model: db.SalesOrder, include: [{ model: db.Customer }, { model: db.Factory }] },
        { model: db.CertificateOfOriginItem, include: [{ model: db.Product }] }
      ]
    });

    if (!cert) throw new Error('Certificate of Origin not found');

    const doc = createPDFDocument();
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));

    // Letterhead
    let currentY = addLetterhead(doc);

    // Title
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#1f2937').text('CERTIFICATE OF ORIGIN', { align: 'center' });
    currentY += 30;

    // Certificate info
    doc.fontSize(10).font('Helvetica').fillColor('#000');
    doc.text(`Certificate #: ${cert.certificateNumber}`, 50, currentY);
    doc.text(`Date: ${dayjs(cert.createdAt).format('YYYY-MM-DD')}`, 50, currentY + 20);

    // Parties
    currentY += 50;
    doc.fontSize(11).font('Helvetica-Bold').text('EXPORTER/MANUFACTURER:', 50, currentY);
    currentY += 18;
    doc.fontSize(9).font('Helvetica');
    const factory = cert.SalesOrder?.Factory;
    if (factory) {
      doc.text(`Name: ${factory.companyName}`, 50, currentY);
      doc.text(`Address: ${factory.address}`, 50, currentY + 15);
      doc.text(`Country: ${factory.country}`, 50, currentY + 30);
    }

    // Consignee
    currentY += 60;
    doc.fontSize(11).font('Helvetica-Bold').text('CONSIGNEE:', 300, currentY - 55);
    currentY += 5;
    doc.fontSize(9).font('Helvetica');
    const customer = cert.SalesOrder?.Customer;
    if (customer) {
      doc.text(`Name: ${customer.companyName}`, 300, currentY - 37);
      doc.text(`Address: ${customer.address}`, 300, currentY - 22);
      doc.text(`Country: ${customer.country}`, 300, currentY - 7);
    }

    // Shipment details
    currentY += 60;
    doc.fontSize(10).font('Helvetica').text(`Country of Origin: ${cert.countryOfOrigin}`, 50, currentY);
    doc.text(`Destination Country: ${cert.destinationCountry}`, 300, currentY);

    // Items table
    currentY += 40;
    const tableTop = currentY;

    // Table header
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#fff');
    doc.fillColor('#1f2937').rect(50, tableTop, 500, 22).fill();
    doc.fillColor('#fff').text('HS Code', 60, tableTop + 5);
    doc.text('Product Description', 130, tableTop + 5);
    doc.text('Qty', 360, tableTop + 5);
    doc.text('Value (USD)', 420, tableTop + 5);

    currentY = tableTop + 27;
    doc.fontSize(8).font('Helvetica').fillColor('#000');

    let totalValue = 0;
    const items = cert.CertificateOfOriginItems || [];

    items.forEach((item, index) => {
      if (currentY > 700) {
        doc.addPage();
        currentY = 50;
      }

      const hsCode = item.Product?.hsCode || item.harmonizedCode || '0000000000';
      const description = item.Product?.name || '';
      const quantity = item.quantity || 0;
      const value = parseFloat(item.value || 0);
      totalValue += value;

      if (index % 2 === 0) {
        doc.fillColor('#f9fafb').rect(50, currentY - 3, 500, 18).fill();
      }

      doc.fillColor('#000');
      doc.text(hsCode, 60, currentY);
      doc.text(description.substring(0, 25), 130, currentY);
      doc.text(quantity.toString(), 360, currentY);
      doc.text(`$${value.toFixed(2)}`, 420, currentY);

      currentY += 18;
    });

    // Totals
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1f2937');
    currentY += 5;
    doc.text(`Total Value: $${totalValue.toFixed(2)}`, 350, currentY);

    // Certification statement
    currentY += 40;
    doc.fontSize(9).font('Helvetica').fillColor('#000');
    doc.text('I hereby certify that the goods described above have been produced/manufactured in and are a product of the country stated above.', 50, currentY, { width: 450 });

    // Signature area
    currentY += 60;
    doc.text('_____________________________', 50, currentY);
    doc.fontSize(8).text('Authorized Signature', 50, currentY + 15);

    doc.text('_____________________________', 300, currentY);
    doc.fontSize(8).text('Date', 300, currentY + 15);

    // Footer
    addFooterInfo(doc);
    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);
    });
  } catch (error) {
    logger.error('Error generating Certificate of Origin PDF:', error);
    throw error;
  }
}

/**
 * Generate Quotation PDF (Enhanced)
 * Professional quotation with terms and conditions
 */
async function generateQuotationPDFEnhanced(quotationId) {
  try {
    const quotation = await db.Quotation.findByPk(quotationId, {
      include: [
        { model: db.Customer },
        { model: db.QuotationItem, include: [{ model: db.Product }] }
      ]
    });

    if (!quotation) throw new Error('Quotation not found');

    const doc = createPDFDocument();
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));

    // Letterhead
    let currentY = addLetterhead(doc);

    // Title
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#1f2937').text('QUOTATION', { align: 'center' });
    currentY += 35;

    // Quotation header
    doc.fontSize(10).font('Helvetica').fillColor('#000');
    doc.text(`Quote #: ${quotation.quotationNumber}`, 50, currentY);
    doc.text(`Valid Until: ${dayjs(quotation.validUntil).format('YYYY-MM-DD')}`, 300, currentY);

    currentY += 20;
    doc.text(`Date: ${dayjs(quotation.createdAt).format('YYYY-MM-DD')}`, 50, currentY);
    doc.text(`Currency: ${quotation.currency}`, 300, currentY);

    // Customer details
    currentY += 40;
    doc.fontSize(11).font('Helvetica-Bold').text('BILL TO:', 50, currentY);
    currentY += 20;
    doc.fontSize(9).font('Helvetica');
    const customer = quotation.Customer;
    if (customer) {
      doc.text(`${customer.companyName}`, 50, currentY);
      doc.text(`${customer.contactPerson || ''}`, 50, currentY + 15);
      doc.text(`${customer.address || ''}`, 50, currentY + 30);
      doc.text(`${customer.city || ''}, ${customer.country || ''}`, 50, currentY + 45);
    }

    // Items table
    currentY += 80;
    const tableTop = currentY;

    // Header
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#fff');
    doc.fillColor('#1f2937').rect(50, tableTop, 500, 22).fill();
    doc.fillColor('#fff').text('Item', 60, tableTop + 5);
    doc.text('Description', 110, tableTop + 5);
    doc.text('Qty', 340, tableTop + 5);
    doc.text('Unit Price', 390, tableTop + 5);
    doc.text('Total', 480, tableTop + 5);

    currentY = tableTop + 27;
    doc.fontSize(9).font('Helvetica').fillColor('#000');

    let subtotal = 0;
    const items = quotation.QuotationItems || [];

    items.forEach((item, index) => {
      if (currentY > 650) {
        doc.addPage();
        currentY = 50;
      }

      const product = item.Product || {};
      const itemTotal = parseFloat(item.total || 0);
      subtotal += itemTotal;

      if (index % 2 === 0) {
        doc.fillColor('#f9fafb').rect(50, currentY - 3, 500, 18).fill();
      }

      doc.fillColor('#000');
      doc.text(`${index + 1}`, 60, currentY);
      doc.text(product.name || '', 110, currentY);
      doc.text(item.quantity || '0', 340, currentY);
      doc.text(`$${parseFloat(item.unitPrice || 0).toFixed(2)}`, 390, currentY);
      doc.text(`$${itemTotal.toFixed(2)}`, 480, currentY);

      currentY += 18;
    });

    // Totals section
    const tax = parseFloat(quotation.tax || 0);
    const total = parseFloat(quotation.total || subtotal + tax);

    currentY += 15;
    doc.fontSize(10).font('Helvetica').text(`Subtotal: $${subtotal.toFixed(2)}`, 380, currentY);
    currentY += 18;
    doc.text(`Tax (${quotation.taxRate || '0'}%): $${tax.toFixed(2)}`, 380, currentY);
    currentY += 18;
    doc.fontSize(12).font('Helvetica-Bold').text(`TOTAL: $${total.toFixed(2)}`, 380, currentY);

    // Notes
    if (quotation.notes) {
      currentY += 40;
      doc.fontSize(10).font('Helvetica-Bold').text('Notes:', 50, currentY);
      currentY += 18;
      doc.fontSize(9).font('Helvetica').text(quotation.notes, 50, currentY, { width: