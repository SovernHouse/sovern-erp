const { PDFDocument, fs, path, formatCurrency, uploadDir,
  createDir, getCompanyHeader, getDocumentTitle, getDocumentDetails,
  createTable, addFooter, addFwInternalRecordBanner,
  pipeToBufferOrDisk, assertSalesDocBrandSafe } = require('./pdfHelpers');

// Phase 4.15a: opts.returnBuffer=true returns a Buffer instead of writing
// to disk. Default false keeps every existing caller unchanged.
//
// Phase 4.20 (2026-05-18): every generator now resolves the entity's Brand
// row via brandSafetyGateway.resolveBrandOrThrow and threads it through
// getCompanyHeader + addFooter so FW/HH entities render with their own
// displayName, primaryColor, footerLegal, and senderEmail. SH entities
// still resolve a Brand row — no env-var fallback in the hot path.

const generateSalesOrderPDF = (salesOrder, items, customer, factory, opts = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Phase 4.19c: brand-safety gateway (rule #9 + brandCode required).
      assertSalesDocBrandSafe(salesOrder, items, 'Sales Order');
      // Phase 4.20: resolve Brand row so header/footer print the right
      // displayName/color/legal text. Throws if brand row missing.
      const { resolveBrandOrThrow } = require('../brandSafetyGateway');
      const db = require('../../models');
      const { brand } = await resolveBrandOrThrow(db, salesOrder.brandCode);

      createDir(path.join(uploadDir, 'sales_orders'));
      const filename = `so-${salesOrder.orderNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'sales_orders', filename);

      const doc = new PDFDocument();
      const sink = pipeToBufferOrDisk(doc, opts, filepath, filename);

      // Phase 4, C16: FW internal-record banner (no-op for non-FW).
      addFwInternalRecordBanner(doc, salesOrder);

      getCompanyHeader(doc, brand);
      getDocumentTitle(doc, 'SALES ORDER');

      const details = {
        'Order #': salesOrder.orderNumber,
        'Date': new Date(salesOrder.createdAt).toLocaleDateString(),
        'Status': salesOrder.status,
        'Customer': customer.companyName,
        'Factory': factory.companyName,
        'Delivery': salesOrder.estimatedDelivery ? new Date(salesOrder.estimatedDelivery).toLocaleDateString() : 'N/A'
      };

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('Order Items', 50, y);
      y += 20;

      const columns = ['Product', 'Qty', 'Unit', 'Price', 'Total'];
      const rows = items.map(item => [
        item.product?.name || 'N/A',
        item.quantity.toString(),
        require('./priceFormatHelpers').displayUnit(item.unit),
        formatCurrency(item.unitPrice, salesOrder.currency),
        formatCurrency(item.total, salesOrder.currency)
      ]);

      y = createTable(doc, columns, rows, y);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Subtotal: ${formatCurrency(salesOrder.subtotal, salesOrder.currency)}`, 50, y);
      y += 15;
      doc.text(`Discount: ${formatCurrency(salesOrder.discount, salesOrder.currency)}`, 50, y);
      y += 15;
      doc.text(`Tax: ${formatCurrency(salesOrder.tax, salesOrder.currency)}`, 50, y);
      y += 20;
      doc.fontSize(12).text(`TOTAL: ${formatCurrency(salesOrder.total, salesOrder.currency)}`, 50, y);

      addFooter(doc, brand);

      doc.end();
      sink.then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generatePurchaseOrderPDF = (purchaseOrder, items, factory, opts = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Phase 4.19g: brand-safety gateway. PurchaseOrders go to the
      // factory (which already knows both brands), so leak risk is
      // reversed vs the buyer-facing docs — but rule #9 still applies:
      // an SH PO must not have Resilient items.
      assertSalesDocBrandSafe(purchaseOrder, items, 'Purchase Order');
      // Phase 4.20: resolve Brand row for brand-aware header/footer.
      const { resolveBrandOrThrow } = require('../brandSafetyGateway');
      const db = require('../../models');
      const { brand } = await resolveBrandOrThrow(db, purchaseOrder.brandCode);

      createDir(path.join(uploadDir, 'purchase_orders'));
      const filename = `po-${purchaseOrder.poNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'purchase_orders', filename);

      const doc = new PDFDocument();
      const sink = pipeToBufferOrDisk(doc, opts, filepath, filename);

      getCompanyHeader(doc, brand);
      getDocumentTitle(doc, 'PURCHASE ORDER');

      const details = {
        'PO #': purchaseOrder.poNumber,
        'Date': new Date(purchaseOrder.createdAt).toLocaleDateString(),
        'Status': purchaseOrder.status,
        'Factory': factory.companyName,
        'Contact': factory.contactPerson || 'N/A',
        'Expected Delivery': purchaseOrder.expectedDelivery ? new Date(purchaseOrder.expectedDelivery).toLocaleDateString() : 'N/A'
      };

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('PO Items', 50, y);
      y += 20;

      const columns = ['Product', 'Qty', 'Unit', 'Price', 'Total'];
      const rows = items.map(item => [
        item.product?.name || 'N/A',
        item.quantity.toString(),
        require('./priceFormatHelpers').displayUnit(item.unit),
        formatCurrency(item.unitPrice, purchaseOrder.currency),
        formatCurrency(item.total, purchaseOrder.currency)
      ]);

      y = createTable(doc, columns, rows, y);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Subtotal: ${formatCurrency(purchaseOrder.subtotal, purchaseOrder.currency)}`, 50, y);
      y += 15;
      doc.fontSize(12).text(`TOTAL: ${formatCurrency(purchaseOrder.total, purchaseOrder.currency)}`, 50, y);

      addFooter(doc, brand);

      doc.end();
      sink.then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generatePackingListPDF = (packingList, items, opts = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Phase 4.19e: brand-safety gateway.
      assertSalesDocBrandSafe(packingList, items, 'Packing List');
      // Phase 4.20: resolve Brand row for brand-aware header/footer.
      const { resolveBrandOrThrow } = require('../brandSafetyGateway');
      const db = require('../../models');
      const { brand } = await resolveBrandOrThrow(db, packingList.brandCode);

      createDir(path.join(uploadDir, 'packing_lists'));
      const filename = `pl-${packingList.packingListNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'packing_lists', filename);

      const doc = new PDFDocument();
      const sink = pipeToBufferOrDisk(doc, opts, filepath, filename);

      getCompanyHeader(doc, brand);
      getDocumentTitle(doc, 'PACKING LIST');

      const details = {
        'PL #': packingList.packingListNumber,
        'Date': new Date(packingList.createdAt).toLocaleDateString(),
        'Total Packages': packingList.totalPackages,
        'Gross Weight': `${packingList.totalGrossWeight} kg`,
        'Net Weight': `${packingList.totalNetWeight} kg`,
        'Volume': `${packingList.totalVolume} cbm`
      };

      let y = getDocumentDetails(doc, details);

      doc.fontSize(12).font('Helvetica-Bold').text('Items', 50, y);
      y += 20;

      const columns = ['Product', 'Qty', 'Unit', 'Package #', 'Weight'];
      const rows = items.map(item => [
        item.product?.name || 'N/A',
        item.quantity.toString(),
        require('./priceFormatHelpers').displayUnit(item.unit),
        item.packageNumber || 'N/A',
        `${item.grossWeight || 0} kg`
      ]);

      y = createTable(doc, columns, rows, y);

      addFooter(doc, brand);

      doc.end();
      sink.then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateSalesOrderPDF, generatePurchaseOrderPDF, generatePackingListPDF };
