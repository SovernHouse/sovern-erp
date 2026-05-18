const { PDFDocument, fs, path, formatCurrency, uploadDir,
  createDir, getCompanyHeader, getDocumentTitle, getDocumentDetails,
  createTable, addFooter, addFwInternalRecordBanner,
  pipeToBufferOrDisk, assertSalesDocBrandSafe } = require('./pdfHelpers');

// Phase 4.15a: opts.returnBuffer=true returns a Buffer instead of writing
// to disk. Default false keeps every existing caller unchanged.
//
// Phase 4.20 (2026-05-18): every generator resolves the entity's Brand
// row via brandSafetyGateway.resolveBrandOrThrow and threads it through
// getCompanyHeader + addFooter so FW/HH entities render with their own
// displayName, primaryColor, footerLegal, and senderEmail.

const generateInvoicePDF = (invoice, salesOrder, customer, opts = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Phase 4.19d: brand-safety gateway. Invoice is a legal payment
      // instrument — highest correctness bar. Refuses missing brandCode
      // and refuses SH + Resilient items (rule #9). Item slug walk uses
      // salesOrder.items if available.
      assertSalesDocBrandSafe(invoice, salesOrder?.items || [], 'Invoice');
      // Phase 4.20: resolve Brand row for brand-aware header/footer.
      const { resolveBrandOrThrow } = require('../brandSafetyGateway');
      const db = require('../../models');
      const { brand } = await resolveBrandOrThrow(db, invoice.brandCode);

      createDir(path.join(uploadDir, 'invoices'));
      const filename = `inv-${invoice.invoiceNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'invoices', filename);

      const doc = new PDFDocument();
      const sink = pipeToBufferOrDisk(doc, opts, filepath, filename);

      // Phase 4, C16: FW internal-record banner (no-op for non-FW).
      addFwInternalRecordBanner(doc, invoice);

      getCompanyHeader(doc, brand);
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

      addFooter(doc, brand);

      doc.end();
      sink.then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generateCreditNotePDF = (creditNote, customer, opts = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Phase 4.19d: brand-safety gateway. Credit notes inherit brand
      // from the parent invoice.
      assertSalesDocBrandSafe(creditNote, [], 'Credit Note');
      // Phase 4.20: resolve Brand row for brand-aware header/footer.
      const { resolveBrandOrThrow } = require('../brandSafetyGateway');
      const db = require('../../models');
      const { brand } = await resolveBrandOrThrow(db, creditNote.brandCode);

      createDir(path.join(uploadDir, 'credit_notes'));
      const filename = `cn-${creditNote.invoiceNumber || creditNote.id}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'credit_notes', filename);

      const doc = new PDFDocument();
      const sink = pipeToBufferOrDisk(doc, opts, filepath, filename);

      getCompanyHeader(doc, brand);
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

      addFooter(doc, brand);

      doc.end();
      sink.then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generateStatementOfAccountPDF = (customer, invoices, payments, opts = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Phase 4.19d: brand-safety gateway. Statements span multiple
      // invoices — refuse if invoices mix brands (one statement per
      // brand is required by rule #9). Single-brand statements are
      // permitted for any of SH/FW/HH thanks to Phase 4.20 brand-aware
      // header/footer.
      const { BrandLeakError, resolveBrandOrThrow } = require('../brandSafetyGateway');
      const brands = [...new Set((invoices || []).map(i => i.brandCode).filter(Boolean))];
      if (brands.length > 1) {
        throw new BrandLeakError(
          `Refusing to render Statement of Account for customer ${customer?.id || customer?.companyName}: ` +
          `mixed brands across invoices (${brands.join(', ')}). Generate one statement per brand.`,
          { entityId: customer?.id, leakField: 'mixed_brands_on_statement' }
        );
      }
      if (brands.length === 0) {
        throw new BrandLeakError(
          `Refusing to render Statement of Account for customer ${customer?.id || customer?.companyName}: ` +
          `no brandCode found on any invoice. Statements must be brand-explicit.`,
          { entityId: customer?.id, leakField: 'brandCode' }
        );
      }
      // Phase 4.20: resolve Brand row for brand-aware header/footer.
      const db = require('../../models');
      const { brand } = await resolveBrandOrThrow(db, brands[0]);

      createDir(path.join(uploadDir, 'statements'));
      const filename = `stmt-${customer.id}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'statements', filename);

      const doc = new PDFDocument();
      const sink = pipeToBufferOrDisk(doc, opts, filepath, filename);

      getCompanyHeader(doc, brand);
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

      addFooter(doc, brand);

      doc.end();
      sink.then(resolve).catch(reject);
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
