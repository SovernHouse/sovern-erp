const { PDFDocument, fs, path, formatCurrency, uploadDir,
  createDir, getCompanyHeader, getDocumentTitle, getDocumentDetails,
  createTable, addFooter } = require('./pdfHelpers');

const generateSalesOrderPDF = (salesOrder, items, customer, factory) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'sales_orders'));
      const filename = `so-${salesOrder.orderNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'sales_orders', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

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

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generatePurchaseOrderPDF = (purchaseOrder, items, factory) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'purchase_orders'));
      const filename = `po-${purchaseOrder.poNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'purchase_orders', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

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

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

const generatePackingListPDF = (packingList, items) => {
  return new Promise((resolve, reject) => {
    try {
      createDir(path.join(uploadDir, 'packing_lists'));
      const filename = `pl-${packingList.packingListNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadDir, 'packing_lists', filename);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

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

      stream.on('finish', () => resolve(filename));
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateSalesOrderPDF, generatePurchaseOrderPDF, generatePackingListPDF };
