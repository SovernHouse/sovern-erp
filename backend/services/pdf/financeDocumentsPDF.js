const { PDFDocument, fs, path, formatCurrency, uploadDir,
  createDir, getCompanyHeader, getDocumentTitle, getDocumentDetails,
  createTable, addFooter } = require('./pdfHelpers');

const generateInvoicePDF = (invoice, salesOrder, customer) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'invoices'));
      const filename = `inv-${invoice.invoiceNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'invoices', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      getCompanyHeader(doc);
      getDocumentTitle(doc, 'INVOICE');

      const details = {
        'Invoice #': invoice.invoiceNumber,
        'Date': new Date(invoice.createdAt).toLocaleDateString(),
        'Due Date': invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A',
        'Customer': customer.companyName,
        'Contact': customer.contactPerson || 'N/A',
        'Email': customer.email,
        'Status': invoice.status
      };

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('Invoice Details', 50, y);
      y += 20;

      const columns = ['Description', 'Amount', 'Currency'];
      const rows = [
        ['Subtotal', invoice.subtotal.toString(), invoice.currency],
        ['Discount', `-${invoice.discount}`, invoice.currency],
        ['Tax', invoice.tax.toString(), invoice.currency]
      ];

      y = createTable(doc, columns, rows, y);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`TOTAL: ${formatCurrency(invoice.total, invoice.currency)}`, 50, y);
      y += 20;
      doc.text(`Paid Amount: ${formatCurrency(invoice.paidAmount, invoice.currency)}`, 50, y);
      y += 15;
      doc.text(`Balance: ${formatCurrency(invoice.balance, invoice.currency)}`, 50, y);

      y += 30;
      doc.fontSize(10).font('Helvetica-Bold').text('Payment Terms:', 50, y);
      y += 15;
      doc.font('Helvetica').fontSize(9).text(invoice.paymentTerms || 'N/A', 50, y);

      y += 30;
      doc.fontSize(10).font('Helvetica-Bold').text('Bank Details:', 50, y);
      y += 15;
      doc.font('Helvetica').fontSize(9);
      doc.text('Please contact accounting for bank transfer details', 50, y);

      addFooter(doc);

      doc.end();

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generateCreditNotePDF = (creditNote, customer) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'credit_notes'));
      const filename = `cn-${creditNote.invoiceNumber || creditNote.id}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'credit_notes', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      getCompanyHeader(doc);
      getDocumentTitle(doc, 'CREDIT NOTE');

      const details = {
        'Credit Note #': creditNote.invoiceNumber || creditNote.id,
        'Date': new Date(creditNote.createdAt).toLocaleDateString(),
        'Customer': customer.companyName,
        'Contact': customer.contactPerson || 'N/A',
        'Email': customer.email
      };

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('Credit Details', 50, y);
      y += 20;

      const columns = ['Description', 'Amount', 'Currency'];
      const rows = [
        ['Subtotal', creditNote.subtotal?.toString() || '0', creditNote.currency || 'USD'],
        ['Tax Adjustment', (creditNote.tax || 0).toString(), creditNote.currency || 'USD']
      ];

      y = createTable(doc, columns, rows, y);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Credit Amount: ${formatCurrency(creditNote.total || 0, creditNote.currency || 'USD')}`, 50, y);

      y += 30;
      doc.font('Helvetica').fontSize(9);
      doc.text(creditNote.notes || 'Credit note for adjustment', 50, y, { width: 500 });

      addFooter(doc);

      doc.end();

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generateStatementOfAccountPDF = (customer, invoices, payments) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'statements'));
      const filename = `stmt-${customer.id}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'statements', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      getCompanyHeader(doc);
      getDocumentTitle(doc, 'STATEMENT OF ACCOUNT');

      const details = {
        'Customer': customer.companyName,
        'Contact': customer.contactPerson || 'N/A',
        'Email': customer.email,
        'Statement Date': new Date().toLocaleDateString()
      };

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('Account Summary', 50, y);
      y += 20;

      const totalInvoices = invoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);
      const totalPaid = payments.reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0);
      const balance = totalInvoices - totalPaid;

      const columns = ['Metric', 'Amount'];
      const rows = [
        ['Total Invoices', formatCurrency(totalInvoices, customer.currency || 'USD')],
        ['Total Paid', formatCurrency(totalPaid, customer.currency || 'USD')],
        ['Outstanding Balance', formatCurrency(balance, customer.currency || 'USD')]
      ];

      y = createTable(doc, columns, rows, y);

      y += 30;
      doc.fontSize(12).font('Helvetica-Bold').text('Recent Invoices', 50, y);
      y += 20;

      const invColumns = ['Invoice #', 'Date', 'Amount', 'Status'];
      const invRows = invoices.slice(0, 5).map(inv => [
        inv.invoiceNumber,
        new Date(inv.createdAt).toLocaleDateString(),
        formatCurrency(inv.total, inv.currency || 'USD'),
        inv.status
      ]);

      y = createTable(doc, invColumns, invRows, y);

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
// SALES NOTE  (Purchase Contract — signed ProformaInvoice)
// Arguments:
//   pi        — ProformaInvoice record (piNumber, createdAt, currency,
//               paymentTerms, incoterm, portOfLoading, portOfDischarge,
//               deliveryDate, subtotal, discount, tax, total, bankDetails,
//               notes)
//   items     — array of ProformaInvoiceItem { product, quantity, unit,
//               unitPrice, total, hsCode }
//   customer  — Customer { companyName, contactPerson, address, city, country,
//               email, phone }
//   signedBy  — optional { name, title, date } for seller signature block
// ─────────────────────────────────────────────────────────────────────────────
module.exports = { generateInvoicePDF, generateCreditNotePDF, generateStatementOfAccountPDF };
