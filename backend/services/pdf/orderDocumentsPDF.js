const { PDFDocument, fs, path, formatCurrency, uploadDir,
  createDir, getCompanyHeader, getDocumentTitle, getDocumentDetails,
  createTable, addFooter, addFwInternalRecordBanner,
  pipeToBufferOrDisk, assertSalesDocBrandSafe } = require('./pdfHelpers');

// Phase 4.15a: opts.returnBuffer=true returns a Buffer instead of writing
// to disk. Default false keeps every existing caller unchanged.

const generateSalesOrderPDF = (salesOrder, items, customer, factory, opts = {}) => {
  return new Promise((resolve, reject) => {
    try {
      // Phase 4.19c: brand-safety gateway.
      assertSalesDocBrandSafe(salesOrder, items, 'Sales Order');
      createDir(path.join(uploadDir, 'sales_orders'));
      const filename = `so-${salesOrder.orderNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'sales_orders', filename);

      const doc = new PDFDocument();
      const sink = pipeToBufferOrDisk(doc, opts, filepath, filename);

      // Phase 4, C16: FW internal-record banner (no-op for non-FW).
      addFwInternalRecordBanner(doc, salesOrder);

      getCompanyHeader(doc);
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
        item.unit,
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

      addFooter(doc);

      doc.end();
      sink.then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generatePurchaseOrderPDF = (purchaseOrder, items, factory, opts = {}) => {
  return new Promise((resolve, reject) => {
    try {
      // Phase 4.19g: brand-safety gateway. PurchaseOrders go to the
      // factory (which already knows both brands), so leak risk is
      // reversed vs the buyer-facing docs — but rule #9 still applies:
      // an SH PO must not have Resilient items, an FW/HH PO must not
      // render through this generic SH-styled renderer.
      assertSalesDocBrandSafe(purchaseOrder, items, 'Purchase Order');
      createDir(path.join(uploadDir, 'purchase_orders'));
      const filename = `po-${purchaseOrder.poNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'purchase_orders', filename);

      const doc = new PDFDocument();
      const sink = pipeToBufferOrDisk(doc, opts, filepath, filename);

      getCompanyHeader(doc);
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
        item.unit,
        formatCurrency(item.unitPrice, purchaseOrder.currency),
        formatCurrency(item.total, purchaseOrder.currency)
      ]);

      y = createTable(doc, columns, rows, y);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Subtotal: ${formatCurrency(purchaseOrder.subtotal, purchaseOrder.currency)}`, 50, y);
      y += 15;
      doc.fontSize(12).text(`TOTAL: ${formatCurrency(purchaseOrder.total, purchaseOrder.currency)}`, 50, y);

      addFooter(doc);

      doc.end();
      sink.then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generatePackingListPDF = (packingList, items, opts = {}) => {
  return new Promise((resolve, reject) => {
    try {
      // Phase 4.19e: brand-safety gateway.
      assertSalesDocBrandSafe(packingList, items, 'Packing List');
      createDir(path.join(uploadDir, 'packing_lists'));
      const filename = `pl-${packingList.packingListNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'packing_lists', filename);

      const doc = new PDFDocument();
      const sink = pipeToBufferOrDisk(doc, opts, filepath, filename);

      getCompanyHeader(doc);
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
        item.unit,
        item.packageNumber || 'N/A',
        `${item.grossWeight || 0} kg`
      ]);

      y = createTable(doc, columns, rows, y);

      addFooter(doc);

      doc.end();
      sink.then(resolve).catch(reject);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateSalesOrderPDF, generatePurchaseOrderPDF, generatePackingListPDF };
