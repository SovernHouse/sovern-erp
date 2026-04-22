const { Readable } = require('stream');
const db = require('../models');
const { Op } = require('sequelize');

/**
 * Data Export Service
 * Handles CSV, JSON, and analytics exports for BI tools
 */

/**
 * Get exportable entities
 */
const getExportableEntities = () => {
  return {
    salesOrders: 'Sales Orders',
    purchaseOrders: 'Purchase Orders',
    invoices: 'Invoices',
    payments: 'Payments',
    customers: 'Customers',
    factories: 'Factories',
    products: 'Products',
    shipments: 'Shipments',
    inspections: 'Inspections'
  };
};

/**
 * Build where clause from filters
 */
const buildWhereClause = (filters) => {
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      where.createdAt[Op.gte] = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.createdAt[Op.lte] = new Date(filters.endDate);
    }
  }

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  if (filters.factoryId) {
    where.factoryId = filters.factoryId;
  }

  return Object.keys(where).length > 0 ? where : null;
};

/**
 * Export entity to CSV format
 * Returns stream for large datasets
 */
const exportToCSV = async (entity, filters = {}, options = {}) => {
  const limit = parseInt(filters.limit) || 10000;
  const offset = parseInt(filters.offset) || 0;
  const where = buildWhereClause(filters);

  let data = [];
  let count = 0;

  try {
    switch (entity) {
      case 'salesOrders':
        data = await db.SalesOrder.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.Customer, attributes: ['id', 'companyName'] },
            { model: db.Invoice, attributes: ['id', 'invoiceNumber'] }
          ]
        });
        count = await db.SalesOrder.count({ where });
        break;

      case 'purchaseOrders':
        data = await db.PurchaseOrder.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.Factory, attributes: ['id', 'factoryName'] },
            { model: db.Supplier, attributes: ['id', 'supplierName'] }
          ]
        });
        count = await db.PurchaseOrder.count({ where });
        break;

      case 'invoices':
        data = await db.Invoice.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.Customer, attributes: ['id', 'companyName'] },
            { model: db.SalesOrder, attributes: ['id', 'orderNumber'] }
          ]
        });
        count = await db.Invoice.count({ where });
        break;

      case 'payments':
        data = await db.Payment.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.Invoice, attributes: ['id', 'invoiceNumber'] },
            { model: db.Customer, attributes: ['id', 'companyName'] }
          ]
        });
        count = await db.Payment.count({ where });
        break;

      case 'customers':
        data = await db.Customer.findAll({
          where,
          limit,
          offset,
          attributes: ['id', 'companyName', 'email', 'phone', 'city', 'country', 'status', 'createdAt']
        });
        count = await db.Customer.count({ where });
        break;

      case 'factories':
        data = await db.Factory.findAll({
          where,
          limit,
          offset,
          attributes: ['id', 'factoryName', 'email', 'phone', 'city', 'country', 'status', 'createdAt']
        });
        count = await db.Factory.count({ where });
        break;

      case 'products':
        data = await db.Product.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.Factory, attributes: ['id', 'factoryName'] }
          ]
        });
        count = await db.Product.count({ where });
        break;

      case 'shipments':
        data = await db.Shipment.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.SalesOrder, attributes: ['id', 'orderNumber'] },
            { model: db.Customer, attributes: ['id', 'companyName'] }
          ]
        });
        count = await db.Shipment.count({ where });
        break;

      case 'inspections':
        data = await db.Inspection.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.PurchaseOrder, attributes: ['id', 'orderNumber'] },
            { model: db.Factory, attributes: ['id', 'factoryName'] }
          ]
        });
        count = await db.Inspection.count({ where });
        break;

      default:
        throw new Error(`Unknown entity: ${entity}`);
    }

    // Convert to CSV format
    if (data.length === 0) {
      return {
        csv: 'No data found',
        count: 0,
        total: 0
      };
    }

    const headers = Object.keys(data[0].dataValues || data[0]);
    const csv = [headers.join(',')];

    data.forEach(row => {
      const values = row.dataValues || row;
      const csvRow = headers.map(h => {
        const val = values[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') return `"${val.replace(/"/g, '""')}"`;
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return val;
      });
      csv.push(csvRow.join(','));
    });

    return {
      csv: csv.join('\n'),
      count: data.length,
      total: count,
      hasMore: offset + limit < count
    };
  } catch (error) {
    throw new Error(`Failed to export ${entity} to CSV: ${error.message}`);
  }
};

/**
 * Export entity to JSON Lines format (one JSON object per line)
 */
const exportToJSON = async (entity, filters = {}, options = {}) => {
  const limit = parseInt(filters.limit) || 10000;
  const offset = parseInt(filters.offset) || 0;
  const where = buildWhereClause(filters);

  let data = [];
  let count = 0;

  try {
    switch (entity) {
      case 'salesOrders':
        data = await db.SalesOrder.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.Customer, attributes: ['id', 'companyName'] },
            { model: db.Invoice, attributes: ['id', 'invoiceNumber'] }
          ]
        });
        count = await db.SalesOrder.count({ where });
        break;

      case 'purchaseOrders':
        data = await db.PurchaseOrder.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.Factory, attributes: ['id', 'factoryName'] }
          ]
        });
        count = await db.PurchaseOrder.count({ where });
        break;

      case 'invoices':
        data = await db.Invoice.findAll({
          where,
          limit,
          offset,
          include: [
            { model: db.Customer, attributes: ['id', 'companyName'] }
          ]
        });
        count = await db.Invoice.count({ where });
        break;

      case 'payments':
        data = await db.Payment.findAll({
          where,
          limit,
          offset
        });
        count = await db.Payment.count({ where });
        break;

      case 'customers':
        data = await db.Customer.findAll({
          where,
          limit,
          offset
        });
        count = await db.Customer.count({ where });
        break;

      case 'factories':
        data = await db.Factory.findAll({
          where,
          limit,
          offset
        });
        count = await db.Factory.count({ where });
        break;

      case 'products':
        data = await db.Product.findAll({
          where,
          limit,
          offset
        });
        count = await db.Product.count({ where });
        break;

      case 'shipments':
        data = await db.Shipment.findAll({
          where,
          limit,
          offset
        });
        count = await db.Shipment.count({ where });
        break;

      case 'inspections':
        data = await db.Inspection.findAll({
          where,
          limit,
          offset
        });
        count = await db.Inspection.count({ where });
        break;

      default:
        throw new Error(`Unknown entity: ${entity}`);
    }

    // Convert to JSON Lines format
    const jsonl = data
      .map(row => JSON.stringify(row.toJSON ? row.toJSON() : row))
      .join('\n');

    return {
      jsonl,
      count: data.length,
      total: count,
      hasMore: offset + limit < count
    };
  } catch (error) {
    throw new Error(`Failed to export ${entity} to JSON: ${error.message}`);
  }
};

/**
 * Generate full analytics snapshot
 */
const generateAnalyticsSnapshot = async () => {
  try {
    const snapshot = {
      timestamp: new Date(),
      summary: {},
      details: {}
    };

    // Sales metrics
    const salesOrders = await db.SalesOrder.count();
    const totalSalesAmount = await db.SalesOrder.sum('totalAmount');
    snapshot.summary.salesOrders = salesOrders;
    snapshot.summary.totalSalesAmount = totalSalesAmount || 0;

    // Purchase metrics
    const purchaseOrders = await db.PurchaseOrder.count();
    const totalPurchaseAmount = await db.PurchaseOrder.sum('totalAmount');
    snapshot.summary.purchaseOrders = purchaseOrders;
    snapshot.summary.totalPurchaseAmount = totalPurchaseAmount || 0;

    // Invoice metrics
    const invoices = await db.Invoice.count();
    const totalInvoiceAmount = await db.Invoice.sum('totalAmount');
    const paidInvoices = await db.Invoice.count({ where: { status: 'paid' } });
    snapshot.summary.invoices = invoices;
    snapshot.summary.totalInvoiceAmount = totalInvoiceAmount || 0;
    snapshot.summary.paidInvoices = paidInvoices;

    // Payment metrics
    const payments = await db.Payment.count();
    const totalPaymentAmount = await db.Payment.sum('amount');
    snapshot.summary.payments = payments;
    snapshot.summary.totalPaymentAmount = totalPaymentAmount || 0;

    // Entity counts
    snapshot.summary.customers = await db.Customer.count();
    snapshot.summary.factories = await db.Factory.count();
    snapshot.summary.products = await db.Product.count();
    snapshot.summary.shipments = await db.Shipment.count();
    snapshot.summary.inspections = await db.Inspection.count();

    // Detailed exports
    snapshot.details.topCustomers = await db.Customer.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'companyName', 'email', 'phone']
    });

    snapshot.details.recentInvoices = await db.Invoice.findAll({
      limit: 20,
      order: [['createdAt', 'DESC']],
      include: [
        { model: db.Customer, attributes: ['companyName'] }
      ]
    });

    snapshot.details.recentPayments = await db.Payment.findAll({
      limit: 20,
      order: [['createdAt', 'DESC']]
    });

    return {
      success: true,
      snapshot
    };
  } catch (error) {
    throw new Error(`Failed to generate analytics snapshot: ${error.message}`);
  }
};

/**
 * Generate KPIs for BI tools
 */
const generateKPIs = async () => {
  try {
    const kpis = {};

    // Calculate date ranges
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Revenue KPIs
    kpis.revenue30Days = await db.Invoice.sum('totalAmount', {
      where: { createdAt: { [Op.gte]: thirtyDaysAgo }, status: 'paid' }
    }) || 0;

    kpis.revenue90Days = await db.Invoice.sum('totalAmount', {
      where: { createdAt: { [Op.gte]: ninetyDaysAgo }, status: 'paid' }
    }) || 0;

    // Order KPIs
    kpis.newOrders30Days = await db.SalesOrder.count({
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } }
    });

    kpis.newOrders90Days = await db.SalesOrder.count({
      where: { createdAt: { [Op.gte]: ninetyDaysAgo } }
    });

    // Customer KPIs
    kpis.newCustomers30Days = await db.Customer.count({
      where: { createdAt: { [Op.gte]: thirtyDaysAgo } }
    });

    kpis.totalCustomers = await db.Customer.count();

    // Payment KPIs
    kpis.outstandingInvoices = await db.Invoice.count({
      where: { status: ['draft', 'pending'] }
    });

    kpis.averagePaymentDays = await calculateAveragePaymentDays();

    // Inventory KPIs
    kpis.totalProducts = await db.Product.count();
    kpis.lowStockItems = await db.InventoryItem.count({
      where: { quantity: { [Op.lte]: db.sequelize.col('minimum_quantity') } }
    });

    return {
      success: true,
      kpis,
      timestamp: new Date()
    };
  } catch (error) {
    throw new Error(`Failed to generate KPIs: ${error.message}`);
  }
};

/**
 * Helper: Calculate average payment days
 */
const calculateAveragePaymentDays = async () => {
  try {
    const paidInvoices = await db.Invoice.findAll({
      where: { status: 'paid' },
      attributes: ['createdAt', 'paidAt'],
      limit: 100,
      order: [['createdAt', 'DESC']]
    });

    if (paidInvoices.length === 0) return 0;

    const totalDays = paidInvoices.reduce((sum, inv) => {
      if (!inv.paidAt) return sum;
      const days = Math.floor((new Date(inv.paidAt) - new Date(inv.createdAt)) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);

    return Math.round(totalDays / paidInvoices.length);
  } catch (err) {
    return 0;
  }
};

module.exports = {
  getExportableEntities,
  exportToCSV,
  exportToJSON,
  generateAnalyticsSnapshot,
  generateKPIs
};
