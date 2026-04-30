const { Sequelize } = require('sequelize');
const path = require('path');
const config = require('../config/database');

let sequelize;
if (config.dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: config.storage,
    logging: config.logging,
    define: config.define,
    pool: config.pool
  });
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

const db = {};

db.sequelize = sequelize;
db.Sequelize = Sequelize;

db.User = require('./User')(sequelize);
db.SSOAccount = require('./SSOAccount')(sequelize);
db.DocumentApproval = require('./DocumentApproval')(sequelize);
db.Customer = require('./Customer')(sequelize);
db.Factory = require('./Factory')(sequelize);
db.ProductCategory = require('./ProductCategory')(sequelize);
db.CategoryTemplate = require('./CategoryTemplate')(sequelize);
db.Product = require('./Product')(sequelize);
db.ProductPrice = require('./ProductPrice')(sequelize);
db.Inquiry = require('./Inquiry')(sequelize);
db.InquiryItem = require('./InquiryItem')(sequelize);
db.Quotation = require('./Quotation')(sequelize);
db.QuotationItem = require('./QuotationItem')(sequelize);
db.ProformaInvoice = require('./ProformaInvoice')(sequelize);
db.ProformaInvoiceItem = require('./ProformaInvoiceItem')(sequelize);
db.SalesOrder = require('./SalesOrder')(sequelize);
db.SalesOrderItem = require('./SalesOrderItem')(sequelize);
db.PurchaseOrder = require('./PurchaseOrder')(sequelize);
db.PurchaseOrderItem = require('./PurchaseOrderItem')(sequelize);
db.GoodsReceivedNote = require('./GoodsReceivedNote')(sequelize);
db.PackingList = require('./PackingList')(sequelize);
db.PackingListItem = require('./PackingListItem')(sequelize);
db.ShippingDocument = require('./ShippingDocument')(sequelize);
db.Shipment = require('./Shipment')(sequelize);
db.ShipmentTracking = require('./ShipmentTracking')(sequelize);
db.Inspection = require('./Inspection')(sequelize);
db.InspectionItem = require('./InspectionItem')(sequelize);
db.InspectionReport = require('./InspectionReport')(sequelize);
db.Claim = require('./Claim')(sequelize);
db.Invoice = require('./Invoice')(sequelize);
db.InvoiceItem = require('./InvoiceItem')(sequelize);
db.Payment = require('./Payment')(sequelize);
db.Notification = require('./Notification')(sequelize);
db.AuditLog = require('./AuditLog')(sequelize);
db.InventoryItem = require('./InventoryItem')(sequelize);
db.InventoryTransaction = require('./InventoryTransaction')(sequelize);
db.Document = require('./Document')(sequelize);
db.ProductSpecification = require('./ProductSpecification')(sequelize);
db.SpecTemplate = require('./SpecTemplate')(sequelize);
db.ProductBatch = require('./ProductBatch')(sequelize);
db.BatchAllocation = require('./BatchAllocation')(sequelize);
db.Container = require('./Container')(sequelize);
db.ContainerConfiguration = require('./ContainerConfiguration')(sequelize);

// Trade Finance models
db.LetterOfCredit = require('./LetterOfCredit')(sequelize);
db.LetterOfCreditDocument = require('./LetterOfCreditDocument')(sequelize);

// Landed Cost models
db.LandedCostTemplate = require('./LandedCostTemplate')(sequelize);
db.LandedCostCalculation = require('./LandedCostCalculation')(sequelize);

// Sample Management models
db.SampleRequest = require('./SampleRequest')(sequelize);
db.SampleShipment = require('./SampleShipment')(sequelize);
db.SampleFeedback = require('./SampleFeedback')(sequelize);

// Compliance & Regulatory models
db.ComplianceRecord = require('./ComplianceRecord')(sequelize);
db.HarmonizedCode = require('./HarmonizedCode')(sequelize);
db.CertificateOfOrigin = require('./CertificateOfOrigin')(sequelize);

// Warehouse Management models
db.WarehouseLocation = require('./WarehouseLocation')(sequelize);
db.WarehouseTransaction = require('./WarehouseTransaction')(sequelize);
db.StockCount = require('./StockCount')(sequelize);

// Credit Approval model
db.CreditApproval = require('./CreditApproval')(sequelize);

// Settings models
db.EmailSignature = require('./EmailSignature')(sequelize);
db.EmailTemplate = require('./EmailTemplate')(sequelize);
db.RolePermission = require('./RolePermission')(sequelize);

// Load CRM models if they exist.
// Tolerate missing files (MODULE_NOT_FOUND, e.g. CRM module disabled),
// but surface any other error (syntax error, runtime throw inside the
// model factory) immediately. Previously this catch was a silent skip,
// which masked load-time failures and produced confusing downstream
// errors like "Cannot read properties of undefined (reading 'hasMany')"
// hundreds of lines later.
const _crmModels = {
  Lead: './Lead',
  Deal: './Deal',
  Contact: './Contact',
  Activity: './Activity',
  Campaign: './Campaign',
  OutreachEmail: './OutreachEmail',
};
for (const [name, modulePath] of Object.entries(_crmModels)) {
  try {
    db[name] = require(modulePath)(sequelize);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' && e.message.includes(modulePath)) {
      console.warn(`[models] CRM model ${name} (${modulePath}) not present — skipping.`);
      continue;
    }
    console.error(`[models] Failed to load CRM model ${name} from ${modulePath}:`);
    console.error(e);
    throw e;
  }
}

Object.keys(db).forEach(modelName => {
  if (db[modelName] && db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.User.hasMany(db.Inquiry, { as: 'inquiries', foreignKey: 'salesPersonId' });
db.Inquiry.belongsTo(db.User, { as: 'salesPerson', foreignKey: 'salesPersonId' });

db.Customer.hasMany(db.Inquiry, { as: 'inquiries', foreignKey: 'customerId' });
db.Inquiry.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

db.Inquiry.hasMany(db.InquiryItem, { as: 'items', foreignKey: 'inquiryId', onDelete: 'CASCADE' });
db.InquiryItem.belongsTo(db.Inquiry, { foreignKey: 'inquiryId' });

db.Product.hasMany(db.InquiryItem, { as: 'inquiryItems', foreignKey: 'productId' });
db.InquiryItem.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.User.hasMany(db.Quotation, { as: 'quotations', foreignKey: 'salesPersonId' });
db.Quotation.belongsTo(db.User, { as: 'salesPerson', foreignKey: 'salesPersonId' });

db.Customer.hasMany(db.Quotation, { as: 'quotations', foreignKey: 'customerId' });
db.Quotation.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

db.Inquiry.hasMany(db.Quotation, { as: 'quotations', foreignKey: 'inquiryId' });
db.Quotation.belongsTo(db.Inquiry, { as: 'inquiry', foreignKey: 'inquiryId' });

db.Quotation.hasMany(db.QuotationItem, { as: 'items', foreignKey: 'quotationId', onDelete: 'CASCADE' });
db.QuotationItem.belongsTo(db.Quotation, { foreignKey: 'quotationId' });

db.Product.hasMany(db.QuotationItem, { as: 'quotationItems', foreignKey: 'productId' });
db.QuotationItem.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.Quotation.hasMany(db.Quotation, { as: 'revisions', foreignKey: 'parentQuotationId' });
db.Quotation.belongsTo(db.Quotation, { as: 'parent', foreignKey: 'parentQuotationId' });

db.Quotation.hasMany(db.ProformaInvoice, { as: 'proformaInvoices', foreignKey: 'quotationId' });
db.ProformaInvoice.belongsTo(db.Quotation, { as: 'quotation', foreignKey: 'quotationId' });

db.Customer.hasMany(db.ProformaInvoice, { as: 'proformaInvoices', foreignKey: 'customerId' });
db.ProformaInvoice.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

db.ProformaInvoice.hasMany(db.ProformaInvoiceItem, { as: 'items', foreignKey: 'proformaInvoiceId', onDelete: 'CASCADE' });
db.ProformaInvoiceItem.belongsTo(db.ProformaInvoice, { foreignKey: 'proformaInvoiceId' });

db.Product.hasMany(db.ProformaInvoiceItem, { as: 'piItems', foreignKey: 'productId' });
db.ProformaInvoiceItem.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.ProformaInvoice.hasMany(db.SalesOrder, { as: 'salesOrders', foreignKey: 'proformaInvoiceId' });
db.SalesOrder.belongsTo(db.ProformaInvoice, { as: 'proformaInvoice', foreignKey: 'proformaInvoiceId' });

db.Customer.hasMany(db.SalesOrder, { as: 'salesOrders', foreignKey: 'customerId' });
db.SalesOrder.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

db.Factory.hasMany(db.SalesOrder, { as: 'salesOrders', foreignKey: 'factoryId' });
db.SalesOrder.belongsTo(db.Factory, { as: 'factory', foreignKey: 'factoryId' });

db.SalesOrder.hasMany(db.SalesOrderItem, { as: 'items', foreignKey: 'salesOrderId', onDelete: 'CASCADE' });
db.SalesOrderItem.belongsTo(db.SalesOrder, { foreignKey: 'salesOrderId' });

db.Product.hasMany(db.SalesOrderItem, { as: 'soItems', foreignKey: 'productId' });
db.SalesOrderItem.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.Factory.hasMany(db.PurchaseOrder, { as: 'purchaseOrders', foreignKey: 'factoryId' });
db.PurchaseOrder.belongsTo(db.Factory, { as: 'factory', foreignKey: 'factoryId' });

db.SalesOrder.hasMany(db.PurchaseOrder, { as: 'purchaseOrders', foreignKey: 'salesOrderId' });
db.PurchaseOrder.belongsTo(db.SalesOrder, { as: 'salesOrder', foreignKey: 'salesOrderId' });

db.PurchaseOrder.hasMany(db.PurchaseOrderItem, { as: 'items', foreignKey: 'purchaseOrderId', onDelete: 'CASCADE' });
db.PurchaseOrderItem.belongsTo(db.PurchaseOrder, { foreignKey: 'purchaseOrderId' });

db.Product.hasMany(db.PurchaseOrderItem, { as: 'poItems', foreignKey: 'productId' });
db.PurchaseOrderItem.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.SalesOrder.hasMany(db.PackingList, { as: 'packingLists', foreignKey: 'salesOrderId' });
db.PackingList.belongsTo(db.SalesOrder, { as: 'salesOrder', foreignKey: 'salesOrderId' });

db.PackingList.hasMany(db.PackingListItem, { as: 'items', foreignKey: 'packingListId', onDelete: 'CASCADE' });
db.PackingListItem.belongsTo(db.PackingList, { foreignKey: 'packingListId' });

db.Product.hasMany(db.PackingListItem, { as: 'packingItems', foreignKey: 'productId' });
db.PackingListItem.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.SalesOrder.hasMany(db.ShippingDocument, { as: 'shippingDocuments', foreignKey: 'salesOrderId' });
db.ShippingDocument.belongsTo(db.SalesOrder, { as: 'salesOrder', foreignKey: 'salesOrderId' });

db.User.hasMany(db.ShippingDocument, { as: 'uploadedDocuments', foreignKey: 'uploadedBy' });
db.ShippingDocument.belongsTo(db.User, { as: 'uploader', foreignKey: 'uploadedBy' });

db.SalesOrder.hasMany(db.Shipment, { as: 'shipments', foreignKey: 'salesOrderId' });
db.Shipment.belongsTo(db.SalesOrder, { as: 'salesOrder', foreignKey: 'salesOrderId' });

db.Shipment.hasMany(db.ShipmentTracking, { as: 'trackingEvents', foreignKey: 'shipmentId', onDelete: 'CASCADE' });
db.ShipmentTracking.belongsTo(db.Shipment, { foreignKey: 'shipmentId' });

db.User.hasMany(db.ShipmentTracking, { as: 'trackingUpdates', foreignKey: 'updatedBy' });
db.ShipmentTracking.belongsTo(db.User, { as: 'updatedByUser', foreignKey: 'updatedBy' });

db.Factory.hasMany(db.Inspection, { as: 'inspections', foreignKey: 'factoryId' });
db.Inspection.belongsTo(db.Factory, { as: 'factory', foreignKey: 'factoryId' });

db.User.hasMany(db.Inspection, { as: 'inspections', foreignKey: 'inspectorId' });
db.Inspection.belongsTo(db.User, { as: 'inspector', foreignKey: 'inspectorId' });

db.SalesOrder.hasMany(db.Inspection, { as: 'inspections', foreignKey: 'salesOrderId' });
db.Inspection.belongsTo(db.SalesOrder, { as: 'salesOrder', foreignKey: 'salesOrderId' });

db.PurchaseOrder.hasMany(db.Inspection, { as: 'inspections', foreignKey: 'purchaseOrderId' });
db.Inspection.belongsTo(db.PurchaseOrder, { as: 'purchaseOrder', foreignKey: 'purchaseOrderId' });

db.Inspection.hasMany(db.InspectionItem, { as: 'items', foreignKey: 'inspectionId', onDelete: 'CASCADE' });
db.InspectionItem.belongsTo(db.Inspection, { foreignKey: 'inspectionId' });

db.Product.hasMany(db.InspectionItem, { as: 'inspectionItems', foreignKey: 'productId' });
db.InspectionItem.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.Inspection.hasOne(db.InspectionReport, { as: 'report', foreignKey: 'inspectionId', onDelete: 'CASCADE' });
db.InspectionReport.belongsTo(db.Inspection, { foreignKey: 'inspectionId' });

db.SalesOrder.hasMany(db.Claim, { as: 'claims', foreignKey: 'salesOrderId' });
db.Claim.belongsTo(db.SalesOrder, { as: 'salesOrder', foreignKey: 'salesOrderId' });

db.Customer.hasMany(db.Claim, { as: 'claims', foreignKey: 'customerId' });
db.Claim.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

db.SalesOrder.hasMany(db.Invoice, { as: 'invoices', foreignKey: 'salesOrderId' });
db.Invoice.belongsTo(db.SalesOrder, { as: 'salesOrder', foreignKey: 'salesOrderId' });

db.Customer.hasMany(db.Invoice, { as: 'invoices', foreignKey: 'customerId' });
db.Invoice.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

db.Invoice.hasMany(db.InvoiceItem, { as: 'items', foreignKey: 'invoiceId', onDelete: 'CASCADE' });
db.InvoiceItem.belongsTo(db.Invoice, { foreignKey: 'invoiceId' });

db.Product.hasMany(db.InvoiceItem, { as: 'invoiceItems', foreignKey: 'productId' });
db.InvoiceItem.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.Invoice.hasMany(db.Payment, { as: 'payments', foreignKey: 'invoiceId' });
db.Payment.belongsTo(db.Invoice, { foreignKey: 'invoiceId' });

db.User.hasMany(db.Notification, { as: 'notifications', foreignKey: 'userId', onDelete: 'CASCADE' });
db.Notification.belongsTo(db.User, { foreignKey: 'userId' });

db.User.hasMany(db.AuditLog, { as: 'auditLogs', foreignKey: 'userId' });
db.AuditLog.belongsTo(db.User, { as: 'user', foreignKey: 'userId' });

db.ProductCategory.hasMany(db.Product, { as: 'products', foreignKey: 'categoryId' });
db.Product.belongsTo(db.ProductCategory, { as: 'category', foreignKey: 'categoryId' });

db.ProductCategory.hasMany(db.ProductCategory, { as: 'children', foreignKey: 'parentId' });
db.ProductCategory.belongsTo(db.ProductCategory, { as: 'parent', foreignKey: 'parentId' });

db.Factory.hasMany(db.Product, { as: 'products', foreignKey: 'factoryId' });
db.Product.belongsTo(db.Factory, { as: 'factory', foreignKey: 'factoryId' });

db.Factory.hasMany(db.ProductPrice, { as: 'productPrices', foreignKey: 'factoryId' });
db.ProductPrice.belongsTo(db.Factory, { as: 'factory', foreignKey: 'factoryId' });

db.Product.hasMany(db.ProductPrice, { as: 'prices', foreignKey: 'productId' });
db.ProductPrice.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.Product.hasMany(db.InventoryItem, { as: 'inventoryItems', foreignKey: 'productId' });
db.InventoryItem.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.InventoryItem.hasMany(db.InventoryTransaction, { as: 'transactions', foreignKey: 'inventoryItemId', onDelete: 'CASCADE' });
db.InventoryTransaction.belongsTo(db.InventoryItem, { foreignKey: 'inventoryItemId' });

db.User.hasMany(db.InventoryTransaction, { as: 'inventoryTransactions', foreignKey: 'performedBy' });
db.InventoryTransaction.belongsTo(db.User, { as: 'performedByUser', foreignKey: 'performedBy' });

db.User.hasMany(db.Document, { as: 'documents', foreignKey: 'createdBy' });
db.Document.belongsTo(db.User, { as: 'creator', foreignKey: 'createdBy' });

db.CustomerAddress = require('./CustomerAddress')(sequelize);
db.SustainabilityRecord = require('./SustainabilityRecord')(sequelize);
db.DocumentVersion = require('./DocumentVersion')(sequelize);

db.PurchaseOrder.hasMany(db.GoodsReceivedNote, { as: 'goodsReceivedNotes', foreignKey: 'poId', onDelete: 'CASCADE' });
db.GoodsReceivedNote.belongsTo(db.PurchaseOrder, { as: 'purchaseOrder', foreignKey: 'poId' });

db.User.hasMany(db.GoodsReceivedNote, { as: 'goodsReceivedNotes', foreignKey: 'receivedBy' });
db.GoodsReceivedNote.belongsTo(db.User, { as: 'receivedByUser', foreignKey: 'receivedBy' });

db.ExchangeRate = require('./ExchangeRate')(sequelize);
db.Webhook = require('./Webhook')(sequelize);
db.WebhookDelivery = require('./WebhookDelivery')(sequelize);

// Personalization models
db.DashboardLayout = require('./DashboardLayout')(sequelize);
db.NotificationPreference = require('./NotificationPreference')(sequelize);
db.CommissionRule = require('./CommissionRule')(sequelize);
db.CommissionTracking = require('./CommissionTracking')(sequelize);
db.FilterPreset = require('./FilterPreset')(sequelize);

// Document Template & Customization models
db.DocumentTemplate = require('./DocumentTemplate')(sequelize);
db.TemplateGeneration = require('./TemplateGeneration')(sequelize);
db.ProductAttribute = require('./ProductAttribute')(sequelize);
db.PriceList = require('./PriceList')(sequelize);
db.PriceListItem = require('./PriceListItem')(sequelize);

// Personalization relationships
db.User.hasMany(db.DashboardLayout, { as: 'dashboardLayouts', foreignKey: 'userId', onDelete: 'CASCADE' });
db.DashboardLayout.belongsTo(db.User, { foreignKey: 'userId' });

db.User.hasOne(db.NotificationPreference, { as: 'notificationPreferences', foreignKey: 'userId', onDelete: 'CASCADE' });
db.NotificationPreference.belongsTo(db.User, { foreignKey: 'userId' });

db.User.hasMany(db.CommissionTracking, { as: 'commissions', foreignKey: 'userId', onDelete: 'CASCADE' });
db.CommissionTracking.belongsTo(db.User, { foreignKey: 'userId' });

db.CommissionRule.hasMany(db.CommissionTracking, { as: 'trackings', foreignKey: 'commissionRuleId' });
db.CommissionTracking.belongsTo(db.CommissionRule, { foreignKey: 'commissionRuleId' });

db.SalesOrder.hasMany(db.CommissionTracking, { as: 'commissions', foreignKey: 'salesOrderId' });
db.CommissionTracking.belongsTo(db.SalesOrder, { foreignKey: 'salesOrderId' });

db.User.hasMany(db.FilterPreset, { as: 'filterPresets', foreignKey: 'userId', onDelete: 'CASCADE' });
db.FilterPreset.belongsTo(db.User, { foreignKey: 'userId' });

// Product Specifications relationships
db.Product.hasOne(db.ProductSpecification, { as: 'specification', foreignKey: 'productId', onDelete: 'CASCADE' });
db.ProductSpecification.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.User.hasMany(db.ProductSpecification, { as: 'specUpdates', foreignKey: 'updatedBy' });
db.ProductSpecification.belongsTo(db.User, { as: 'updatedByUser', foreignKey: 'updatedBy' });

// Product Batch relationships
db.Product.hasMany(db.ProductBatch, { as: 'batches', foreignKey: 'productId', onDelete: 'CASCADE' });
db.ProductBatch.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.User.hasMany(db.ProductBatch, { as: 'createdBatches', foreignKey: 'createdBy' });
db.ProductBatch.belongsTo(db.User, { as: 'createdByUser', foreignKey: 'createdBy' });

// Batch Allocation relationships
db.ProductBatch.hasMany(db.BatchAllocation, { as: 'allocations', foreignKey: 'productBatchId', onDelete: 'CASCADE' });
db.BatchAllocation.belongsTo(db.ProductBatch, { as: 'productBatch', foreignKey: 'productBatchId' });

db.SalesOrder.hasMany(db.BatchAllocation, { as: 'allocations', foreignKey: 'salesOrderId' });
db.BatchAllocation.belongsTo(db.SalesOrder, { as: 'salesOrder', foreignKey: 'salesOrderId' });

db.PurchaseOrder.hasMany(db.BatchAllocation, { as: 'allocations', foreignKey: 'purchaseOrderId' });
db.BatchAllocation.belongsTo(db.PurchaseOrder, { as: 'purchaseOrder', foreignKey: 'purchaseOrderId' });

db.User.hasMany(db.BatchAllocation, { as: 'allocations', foreignKey: 'allocatedBy' });
db.BatchAllocation.belongsTo(db.User, { as: 'allocatedByUser', foreignKey: 'allocatedBy' });

// Container relationships
db.Shipment.hasMany(db.Container, { as: 'containers', foreignKey: 'shipmentId' });
db.Container.belongsTo(db.Shipment, { as: 'shipment', foreignKey: 'shipmentId' });

db.PurchaseOrder.hasMany(db.Container, { as: 'containers', foreignKey: 'purchaseOrderId' });
db.Container.belongsTo(db.PurchaseOrder, { as: 'purchaseOrder', foreignKey: 'purchaseOrderId' });

db.User.hasMany(db.Container, { as: 'createdContainers', foreignKey: 'createdBy' });
db.Container.belongsTo(db.User, { as: 'createdByUser', foreignKey: 'createdBy' });

// Compliance & Regulatory relationships
db.Shipment.hasMany(db.ComplianceRecord, { as: 'complianceRecords', foreignKey: 'shipmentId', onDelete: 'CASCADE' });
db.ComplianceRecord.belongsTo(db.Shipment, { as: 'shipment', foreignKey: 'shipmentId' });

db.Product.hasMany(db.ComplianceRecord, { as: 'complianceRecords', foreignKey: 'productId' });
db.ComplianceRecord.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.Shipment.hasMany(db.CertificateOfOrigin, { as: 'certificatesOfOrigin', foreignKey: 'shipmentId', onDelete: 'CASCADE' });
db.CertificateOfOrigin.belongsTo(db.Shipment, { as: 'shipment', foreignKey: 'shipmentId' });

// Warehouse Management relationships
db.WarehouseLocation.hasMany(db.WarehouseTransaction, { as: 'fromTransactions', foreignKey: 'fromLocationId', onDelete: 'SET NULL' });
db.WarehouseTransaction.belongsTo(db.WarehouseLocation, { as: 'fromLocation', foreignKey: 'fromLocationId' });

db.WarehouseLocation.hasMany(db.WarehouseTransaction, { as: 'toTransactions', foreignKey: 'toLocationId', onDelete: 'SET NULL' });
db.WarehouseTransaction.belongsTo(db.WarehouseLocation, { as: 'toLocation', foreignKey: 'toLocationId' });

db.Product.hasMany(db.WarehouseTransaction, { as: 'warehouseTransactions', foreignKey: 'productId' });
db.WarehouseTransaction.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

db.ProductBatch.hasMany(db.WarehouseTransaction, { as: 'transactions', foreignKey: 'batchId' });
db.WarehouseTransaction.belongsTo(db.ProductBatch, { as: 'batch', foreignKey: 'batchId' });

db.User.hasMany(db.WarehouseTransaction, { as: 'performedTransactions', foreignKey: 'performedBy' });
db.WarehouseTransaction.belongsTo(db.User, { as: 'performedByUser', foreignKey: 'performedBy' });

db.User.hasMany(db.StockCount, { as: 'countedByMe', foreignKey: 'countedBy' });
db.StockCount.belongsTo(db.User, { as: 'countedByUser', foreignKey: 'countedBy' });

db.User.hasMany(db.StockCount, { as: 'approvedCounts', foreignKey: 'approvedBy' });
db.StockCount.belongsTo(db.User, { as: 'approvedByUser', foreignKey: 'approvedBy' });

// Customer Address relationships
db.Customer.hasMany(db.CustomerAddress, { as: 'addresses', foreignKey: 'customerId', onDelete: 'CASCADE' });
db.CustomerAddress.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

// Sustainability relationships
db.Product.hasOne(db.SustainabilityRecord, { as: 'sustainability', foreignKey: 'productId', onDelete: 'CASCADE' });
db.SustainabilityRecord.belongsTo(db.Product, { as: 'product', foreignKey: 'productId' });

// Document Version relationships
db.Document.hasMany(db.DocumentVersion, { as: 'versions', foreignKey: 'documentId', onDelete: 'CASCADE' });
db.DocumentVersion.belongsTo(db.Document, { as: 'document', foreignKey: 'documentId' });

db.User.hasMany(db.DocumentVersion, { as: 'uploadedVersions', foreignKey: 'uploadedBy' });
db.DocumentVersion.belongsTo(db.User, { as: 'uploader', foreignKey: 'uploadedBy' });

// Credit Approval relationships
db.Customer.hasMany(db.CreditApproval, { as: 'creditApprovals', foreignKey: 'customerId', onDelete: 'CASCADE' });
db.CreditApproval.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

db.User.hasMany(db.CreditApproval, { as: 'creditApprovalsRequested', foreignKey: 'requestedBy' });
db.CreditApproval.belongsTo(db.User, { as: 'requester', foreignKey: 'requestedBy' });

db.User.hasMany(db.CreditApproval, { as: 'creditApprovalsApproved', foreignKey: 'approvedBy' });
db.CreditApproval.belongsTo(db.User, { as: 'approver', foreignKey: 'approvedBy' });

// Trade Finance relationships
db.Customer.hasMany(db.LetterOfCredit, { as: 'lettersOfCredit', foreignKey: 'customerId' });
db.LetterOfCredit.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

db.Factory.hasMany(db.LetterOfCredit, { as: 'lettersOfCredit', foreignKey: 'supplierId' });
db.LetterOfCredit.belongsTo(db.Factory, { as: 'supplier', foreignKey: 'supplierId' });

db.LetterOfCredit.hasMany(db.LetterOfCreditDocument, { as: 'documents', foreignKey: 'letterOfCreditId', onDelete: 'CASCADE' });
db.LetterOfCreditDocument.belongsTo(db.LetterOfCredit, { foreignKey: 'letterOfCreditId' });

// Landed Cost relationships
db.Customer.hasMany(db.LandedCostCalculation, { as: 'landedCostCalcs', foreignKey: 'customerId' });
db.LandedCostCalculation.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

// Sample Management relationships
db.Customer.hasMany(db.SampleRequest, { as: 'sampleRequests', foreignKey: 'customerId' });
db.SampleRequest.belongsTo(db.Customer, { as: 'customer', foreignKey: 'customerId' });

db.SampleRequest.hasMany(db.SampleShipment, { as: 'shipments', foreignKey: 'sampleRequestId', onDelete: 'CASCADE' });
db.SampleShipment.belongsTo(db.SampleRequest, { as: 'sampleRequest', foreignKey: 'sampleRequestId' });

db.SampleRequest.hasMany(db.SampleFeedback, { as: 'feedback', foreignKey: 'sampleRequestId', onDelete: 'CASCADE' });
db.SampleFeedback.belongsTo(db.SampleRequest, { as: 'sampleRequest', foreignKey: 'sampleRequestId' });

// Document Template relationships
db.User.hasMany(db.DocumentTemplate, { as: 'documentTemplates', foreignKey: 'createdBy' });
db.DocumentTemplate.belongsTo(db.User, { foreignKey: 'createdBy', as: 'creator' });

db.DocumentTemplate.hasMany(db.TemplateGeneration, { as: 'generations', foreignKey: 'templateId' });
db.TemplateGeneration.belongsTo(db.DocumentTemplate, { foreignKey: 'templateId', as: 'template' });

db.User.hasMany(db.TemplateGeneration, { as: 'templateGenerations', foreignKey: 'generatedBy' });
db.TemplateGeneration.belongsTo(db.User, { foreignKey: 'generatedBy', as: 'generator' });

// Product Attribute relationships
db.ProductCategory.hasMany(db.ProductAttribute, { as: 'attributes', foreignKey: 'categoryId' });
db.ProductAttribute.belongsTo(db.ProductCategory, { foreignKey: 'categoryId' });
db.User.hasMany(db.ProductAttribute, { as: 'createdAttributes', foreignKey: 'createdBy' });
db.ProductAttribute.belongsTo(db.User, { foreignKey: 'createdBy', as: 'creator' });

// Price List relationships
db.Customer.hasMany(db.PriceList, { as: 'priceLists', foreignKey: 'customerId' });
db.PriceList.belongsTo(db.Customer, { foreignKey: 'customerId' });
db.Factory.hasMany(db.PriceList, { as: 'priceLists', foreignKey: 'factoryId' });
db.PriceList.belongsTo(db.Factory, { foreignKey: 'factoryId' });
db.User.hasMany(db.PriceList, { as: 'createdPriceLists', foreignKey: 'createdBy' });
db.PriceList.belongsTo(db.User, { foreignKey: 'createdBy', as: 'creator' });

db.PriceList.hasMany(db.PriceListItem, { as: 'items', foreignKey: 'priceListId', onDelete: 'CASCADE' });
db.PriceListItem.belongsTo(db.PriceList, { foreignKey: 'priceListId' });
db.Product.hasMany(db.PriceListItem, { as: 'priceListItems', foreignKey: 'productId' });
db.PriceListItem.belongsTo(db.Product, { foreignKey: 'productId' });

// OutreachEmail relationships
db.Lead.hasMany(db.OutreachEmail, { foreignKey: 'leadId', as: 'outreachEmails' });

// DocumentApproval relationships
// NOTE: DocumentApproval.belongsTo(User, { as: 'requestedBy' }) is defined in
// DocumentApproval.associate() and called above — do NOT redefine it here.
db.User.hasMany(db.DocumentApproval, { as: 'documentApprovals', foreignKey: 'requestedByUserId' });

module.exports = db;
