/**
 * Sales Module
 * Provides sales functionality: Inquiries, Quotations, Proforma Invoices, Sales Orders
 */

async function initSales(app, sequelize, models, registry) {
  // Register sales routes
  const inquiryRoutes = require('../../routes/inquiryRoutes');
  const quotationRoutes = require('../../routes/quotationRoutes');
  const proformaInvoiceRoutes = require('../../routes/proformaInvoiceRoutes');
  const salesOrderRoutes = require('../../routes/salesOrderRoutes');

  app.use('/api/inquiries', inquiryRoutes);
  app.use('/api/quotations', quotationRoutes);
  app.use('/api/proforma-invoices', proformaInvoiceRoutes);
  app.use('/api/sales-orders', salesOrderRoutes);

  // Register sales models
  registry.registerModel('sales', 'Inquiry', models.Inquiry);
  registry.registerModel('sales', 'InquiryItem', models.InquiryItem);
  registry.registerModel('sales', 'Quotation', models.Quotation);
  registry.registerModel('sales', 'QuotationItem', models.QuotationItem);
  registry.registerModel('sales', 'ProformaInvoice', models.ProformaInvoice);
  registry.registerModel('sales', 'ProformaInvoiceItem', models.ProformaInvoiceItem);
  registry.registerModel('sales', 'SalesOrder', models.SalesOrder);
  registry.registerModel('sales', 'SalesOrderItem', models.SalesOrderItem);
}

module.exports = initSales;
