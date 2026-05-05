const { PDFDocument, fs, path, formatCurrency, uploadDir,
  createDir, getCompanyHeader, getDocumentTitle, getDocumentDetails,
  createTable, addFooter } = require('./pdfHelpers');

const generateQuotationPDF = (quotation, items, customer, salesPerson) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'quotations'));
      const filename = `quotation-${quotation.quotationNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'quotations', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      getCompanyHeader(doc);
      getDocumentTitle(doc, 'QUOTATION');

      const details = {
        'Quotation #': quotation.quotationNumber,
        'Date': new Date(quotation.createdAt).toLocaleDateString(),
        'Valid Until': quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : 'N/A',
        'Customer': customer.companyName,
        'Contact': customer.contactPerson || 'N/A',
        'Email': customer.email
      };

      if (salesPerson) {
        details['Sales Person'] = `${salesPerson.firstName} ${salesPerson.lastName}`;
      }

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('Quotation Items', 50, y);
      y += 20;

      const columns = ['Product', 'Qty', 'Unit', 'Price', 'Total'];
      const rows = items.map(item => [
        item.product?.name || 'N/A',
        item.quantity.toString(),
        item.unit,
        formatCurrency(item.unitPrice, quotation.currency),
        formatCurrency(item.total, quotation.currency)
      ]);

      y = createTable(doc, columns, rows, y);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Subtotal: ${formatCurrency(quotation.subtotal, quotation.currency)}`, 50, y);
      y += 15;
      doc.text(`Discount: ${formatCurrency(quotation.discount, quotation.currency)}`, 50, y);
      y += 15;
      doc.text(`Tax (${quotation.taxRate}%): ${formatCurrency(quotation.tax, quotation.currency)}`, 50, y);
      y += 20;
      doc.fontSize(12).text(`TOTAL: ${formatCurrency(quotation.total, quotation.currency)}`, 50, y);

      y += 30;
      if (quotation.terms) {
        doc.fontSize(10).font('Helvetica-Bold').text('Terms & Conditions:', 50, y);
        y += 15;
        doc.font('Helvetica').fontSize(9).text(quotation.terms, 50, y, { width: 500 });
      }

      addFooter(doc);

      doc.end();

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generateProformaInvoicePDF = (pi, items, customer) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'proforma_invoices'));
      const filename = `pi-${pi.piNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'proforma_invoices', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      getCompanyHeader(doc);
      getDocumentTitle(doc, 'PROFORMA INVOICE');

      const details = {
        'PI #': pi.piNumber,
        'Date': new Date(pi.createdAt).toLocaleDateString(),
        'Valid Until': pi.validUntil ? new Date(pi.validUntil).toLocaleDateString() : 'N/A',
        'Customer': customer.companyName,
        'Contact': customer.contactPerson || 'N/A',
        'Email': customer.email,
        'Payment Terms': pi.paymentTerms
      };

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('Items', 50, y);
      y += 20;

      const columns = ['Product', 'Qty', 'Unit', 'Price', 'Total'];
      const rows = items.map(item => [
        item.product?.name || 'N/A',
        item.quantity.toString(),
        item.unit,
        formatCurrency(item.unitPrice, pi.currency),
        formatCurrency(item.total, pi.currency)
      ]);

      y = createTable(doc, columns, rows, y);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Subtotal: ${formatCurrency(pi.subtotal, pi.currency)}`, 50, y);
      y += 15;
      doc.text(`Discount: ${formatCurrency(pi.discount, pi.currency)}`, 50, y);
      y += 15;
      doc.text(`Tax: ${formatCurrency(pi.tax, pi.currency)}`, 50, y);
      y += 20;
      doc.fontSize(12).text(`TOTAL: ${formatCurrency(pi.total, pi.currency)}`, 50, y);

      y += 30;
      doc.fontSize(10).font('Helvetica-Bold').text('Bank Details:', 50, y);
      y += 15;
      doc.font('Helvetica').fontSize(9);
      if (pi.bankDetails && Object.keys(pi.bankDetails).length > 0) {
        Object.entries(pi.bankDetails).forEach(([key, value]) => {
          doc.text(`${key}: ${value}`, 50, y);
          y += 12;
        });
      }

      addFooter(doc);

      doc.end();

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generateSalesNotePDF = (pi, items, customer, signedBy = {}) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'sales_notes'));
      const filename = `sales-note-${pi.piNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'sales_notes', filename);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // ── Header ──────────────────────────────────────────────────────────────
      doc.fontSize(16).font('Helvetica-Bold')
         .text(process.env.PDF_COMPANY_NAME || 'Sovern House', 50, 30);
      doc.fontSize(9).font('Helvetica')
         .text(process.env.PDF_COMPANY_ADDRESS || '', 50, 50)
         .text(`Tel: ${process.env.PDF_COMPANY_PHONE || ''}`, 50, 63)
         .text(`Email: ${process.env.PDF_COMPANY_EMAIL || ''}`, 50, 76);

      // Document title + number (right-aligned)
      doc.fontSize(18).font('Helvetica-Bold')
         .text('SALES NOTE', 300, 30, { align: 'right', width: 245 });
      doc.fontSize(10).font('Helvetica')
         .text(`Contract Ref: ${pi.piNumber}`, 300, 56, { align: 'right', width: 245 })
         .text(`Date: ${new Date(pi.createdAt || Date.now()).toLocaleDateString('en-GB')}`, 300, 70, { align: 'right', width: 245 });

      doc.moveTo(50, 100).lineTo(545, 100).stroke();

      // ── Parties ─────────────────────────────────────────────────────────────
      let y = 115;
      doc.fontSize(9).font('Helvetica-Bold').text('SELLER', 50, y);
      doc.text('BUYER', 300, y);

      y += 12;
      doc.font('Helvetica').fontSize(9)
         .text(process.env.PDF_COMPANY_NAME || 'Sovern House', 50, y)
         .text(customer.companyName || '', 300, y);

      y += 12;
      if (process.env.PDF_COMPANY_ADDRESS) {
        doc.text(process.env.PDF_COMPANY_ADDRESS, 50, y);
      }
      const buyerAddr = [customer.address, customer.city, customer.country].filter(Boolean).join(', ');
      doc.text(buyerAddr, 300, y);

      y += 12;
      doc.text(`Email: ${process.env.PDF_COMPANY_EMAIL || ''}`, 50, y)
         .text(`Contact: ${customer.contactPerson || ''}`, 300, y);

      y += 12;
      doc.text(`Tel: ${process.env.PDF_COMPANY_PHONE || ''}`, 50, y)
         .text(`Email: ${customer.email || ''}`, 300, y);

      y += 20;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 12;

      // ── Trade Terms ─────────────────────────────────────────────────────────
      doc.fontSize(9).font('Helvetica-Bold').text('TRADE TERMS', 50, y);
      y += 12;
      doc.font('Helvetica').fontSize(9);
      const tradeTerms = [
        ['Incoterm',        pi.incoterm || 'FOB'],
        ['Port of Loading',  pi.portOfLoading || '—'],
        ['Port of Discharge',pi.portOfDischarge || '—'],
        ['Payment Terms',   pi.paymentTerms || '—'],
        ['Estimated Delivery', pi.deliveryDate
          ? new Date(pi.deliveryDate).toLocaleDateString('en-GB') : '—'],
        ['Currency',        pi.currency || 'USD'],
      ];
      tradeTerms.forEach(([label, val]) => {
        doc.font('Helvetica-Bold').text(`${label}: `, 50, y, { continued: true })
           .font('Helvetica').text(val);
        y += 14;
      });

      y += 6;
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 12;

      // ── Line Items ──────────────────────────────────────────────────────────
      doc.fontSize(9).font('Helvetica-Bold').text('ORDER DETAILS', 50, y);
      y += 12;

      // Table header
      const colX = [50, 210, 300, 355, 400, 475];
      const colW = [155, 85, 50, 40, 70, 65];
      const headers = ['Product / Description', 'SKU', 'Qty', 'Unit', 'Unit Price', 'Total'];

      doc.rect(50, y, 495, 16).fillAndStroke('#f0f0f0', '#000');
      doc.fillColor('black').fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, colX[i] + 2, y + 3, { width: colW[i] - 4 });
      });
      y += 16;

      doc.font('Helvetica').fontSize(8);
      items.forEach((item, idx) => {
        const rowH = 18;
        if (idx % 2 === 0) doc.rect(50, y, 495, rowH).fill('#fafafa').stroke('#ccc');
        else doc.rect(50, y, 495, rowH).fill('#ffffff').stroke('#ccc');
        doc.fillColor('black');

        const productName = item.product?.name || item.description || 'N/A';
        const sku = item.product?.sku || item.sku || '—';
        doc.text(productName, colX[0] + 2, y + 4, { width: colW[0] - 4 });
        doc.text(sku, colX[1] + 2, y + 4, { width: colW[1] - 4 });
        doc.text(String(item.quantity || 0), colX[2] + 2, y + 4, { width: colW[2] - 4 });
        doc.text(item.unit || '—', colX[3] + 2, y + 4, { width: colW[3] - 4 });
        doc.text(formatCurrency(item.unitPrice, pi.currency), colX[4] + 2, y + 4, { width: colW[4] - 4 });
        doc.text(formatCurrency(item.total, pi.currency), colX[5] + 2, y + 4, { width: colW[5] - 4 });
        y += rowH;
      });

      // ── Totals ───────────────────────────────────────────────────────────────
      y += 6;
      const totalsX = 350;
      doc.fontSize(9).font('Helvetica');
      [
        ['Subtotal', formatCurrency(pi.subtotal, pi.currency)],
        ['Discount', formatCurrency(pi.discount || 0, pi.currency)],
        [`Tax`, formatCurrency(pi.tax || 0, pi.currency)],
      ].forEach(([label, val]) => {
        doc.text(label + ':', totalsX, y, { width: 100 })
           .text(val, totalsX + 100, y, { width: 95, align: 'right' });
        y += 14;
      });
      doc.moveTo(totalsX, y).lineTo(545, y).stroke();
      y += 4;
      doc.fontSize(11).font('Helvetica-Bold')
         .text('TOTAL:', totalsX, y, { width: 100 })
         .text(formatCurrency(pi.total, pi.currency), totalsX + 100, y, { width: 95, align: 'right' });
      y += 20;

      // ── Bank Details ─────────────────────────────────────────────────────────
      if (pi.bankDetails && Object.keys(pi.bankDetails).length > 0) {
        doc.moveTo(50, y).lineTo(545, y).stroke();
        y += 10;
        doc.fontSize(9).font('Helvetica-Bold').text('PAYMENT / BANK DETAILS', 50, y);
        y += 12;
        doc.font('Helvetica').fontSize(9);
        Object.entries(pi.bankDetails).forEach(([k, v]) => {
          doc.text(`${k}: ${v}`, 50, y);
          y += 12;
        });
        y += 4;
      }

      // ── Notes ────────────────────────────────────────────────────────────────
      if (pi.notes) {
        doc.moveTo(50, y).lineTo(545, y).stroke();
        y += 10;
        doc.fontSize(9).font('Helvetica-Bold').text('NOTES / SPECIAL INSTRUCTIONS', 50, y);
        y += 12;
        doc.font('Helvetica').fontSize(9).text(pi.notes, 50, y, { width: 495 });
        y += doc.heightOfString(pi.notes, { width: 495 }) + 8;
      }

      // ── Terms boilerplate ────────────────────────────────────────────────────
      doc.moveTo(50, y).lineTo(545, y).stroke();
      y += 10;
      doc.fontSize(8).font('Helvetica-Oblique')
         .text(
           'This Sales Note constitutes the binding purchase contract between Seller and Buyer upon signature by both parties. ' +
           'Delivery shall be made under the Incoterm stated above. Title and risk transfer as per the applicable Incoterm. ' +
           'Disputes shall be resolved by arbitration under ICC rules.',
           50, y, { width: 495 }
         );
      y += 32;

      // ── Signature Blocks ─────────────────────────────────────────────────────
      // Ensure signature blocks fit on page; add page if needed
      if (y > 680) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('FOR AND ON BEHALF OF SELLER:', 50, y);
      doc.text('FOR AND ON BEHALF OF BUYER:', 300, y);

      y += 40;
      doc.moveTo(50, y).lineTo(220, y).stroke();
      doc.moveTo(300, y).lineTo(470, y).stroke();

      y += 4;
      doc.font('Helvetica').fontSize(9);
      doc.text(signedBy.name || process.env.PDF_COMPANY_NAME || 'Authorised Signatory', 50, y);
      doc.text('Authorised Signatory', 300, y);

      y += 12;
      doc.text(`Title: ${signedBy.title || 'Director'}`, 50, y);
      doc.text('Title: ______________________', 300, y);

      y += 12;
      doc.text(`Date: ${signedBy.date || new Date().toLocaleDateString('en-GB')}`, 50, y);
      doc.text('Date: ______________________', 300, y);

      // ── Footer ───────────────────────────────────────────────────────────────
      addFooter(doc);
      doc.end();

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT SPEC SHEET  (per-SKU datasheet for sales & marketing)
// Arguments:
//   product      — Product record { name, sku, description, specifications,
//                  unit, minOrderQty, weight, hsCode }
//   category     — ProductCategory { name }
//   factory      — Factory { companyName, city, country, certifications }
//   price        — ProductPrice { sellingPrice, currency } (optional)
// ─────────────────────────────────────────────────────────────────────────────
module.exports = { generateQuotationPDF, generateProformaInvoicePDF, generateSalesNotePDF };
