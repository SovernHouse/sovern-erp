/**
 * Dashboard Routes
 * @module routes/dashboardRoutes
 * @description Endpoints for dashboard analytics and business intelligence reports
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 * @requires ../middleware/cacheMiddleware
 * @requires dayjs
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');
const { Op } = require('sequelize');
const dayjs = require('dayjs');
const { cacheRoute, invalidateCache } = require('../middleware/cacheMiddleware');

// Apply caching to dashboard GET endpoints (60 second TTL)
const dashboardCacheTTL = 60;

/**
 * GET /api/dashboard — Mobile consolidated summary
 * Single-call endpoint used by Sovern Ops mobile app.
 * Returns open leads, pending approvals, pending activities, and pipeline value.
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { Op } = require('sequelize');

    const [openLeads, pendingApprovals, pendingActivities, pipelineValue] = await Promise.all([
      db.Lead
        ? db.Lead.count({ where: { status: { [Op.notIn]: ['won', 'lost'] } } })
        : Promise.resolve(0),
      db.InternalApproval
        ? db.InternalApproval.count({ where: { status: 'pending' } })
        : Promise.resolve(0),
      db.Activity
        ? db.Activity.count({
            where: {
              completedAt: null,
              scheduledAt: { [Op.lte]: dayjs().endOf('day').toDate() },
            },
          })
        : Promise.resolve(0),
      db.Lead
        ? db.Lead.sum('estimatedValue', {
            where: { status: { [Op.notIn]: ['won', 'lost'] } },
          })
        : Promise.resolve(0),
    ]);

    res.json({
      success: true,
      data: {
        openLeads:        openLeads        || 0,
        pendingApprovals: pendingApprovals || 0,
        pendingActivities:pendingActivities|| 0,
        pipelineValueUSD: pipelineValue    || 0,
        lastUpdated:      new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get admin dashboard with key metrics
 * @route GET /api/dashboard/admin
 * @description Provides metrics including customer count, revenue, orders, and inventory status
 * @returns {Object} Dashboard metrics and KPIs
 */
router.get('/admin', cacheRoute(dashboardCacheTTL), requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const totalCustomers = await db.Customer.count();
    const activeCustomers = await db.Customer.count({ where: { isActive: true } });
    const totalFactories = await db.Factory.count({ where: { isActive: true } });
    const totalProducts = await db.Product.count({ where: { isActive: true } });

    const totalOrders = await db.SalesOrder.count();
    const completedOrders = await db.SalesOrder.count({ where: { status: 'completed' } });

    const totalRevenue = await db.SalesOrder.sum('total');
    const thisMonthRevenue = await db.SalesOrder.sum('total', {
      where: {
        createdAt: { [Op.gte]: dayjs().startOf('month').toDate() }
      }
    });

    const pendingInvoices = await db.Invoice.sum('balance', {
      where: { status: { [Op.in]: ['draft', 'sent'] } }
    });

    // Quotation -> Order conversion. A quotation counts as "converted"
    // when its status is 'accepted' (i.e. the buyer signed off and the
    // sale moved to a sales order). Cancelled quotations are excluded
    // from the denominator so they don't drag the rate down unfairly.
    const totalQuotations = await db.Quotation.count({
      where: { status: { [Op.notIn]: ['cancelled'] } }
    });
    const convertedQuotations = await db.Quotation.count({
      where: { status: 'accepted' }
    });

    const recentOrders = await db.SalesOrder.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }]
    });

    const topCustomers = await db.sequelize.query(`
      SELECT c.id, c.company_name, COUNT(so.id) as order_count, SUM(so.total) as total_spent
      FROM Customer c
      LEFT JOIN SalesOrder so ON c.id = so.customer_id
      GROUP BY c.id
      ORDER BY total_spent DESC
      LIMIT 5
    `, { type: 'SELECT' });

    res.json(getSuccessResponse({
      stats: {
        totalCustomers,
        activeCustomers,
        totalFactories,
        totalProducts,
        totalOrders,
        completedOrders,
        completionRate: totalOrders > 0
          ? ((completedOrders / totalOrders) * 100).toFixed(2)
          : '0.00',
        totalRevenue: totalRevenue || 0,
        thisMonthRevenue: thisMonthRevenue || 0,
        pendingInvoices: pendingInvoices || 0,
        totalQuotations,
        convertedQuotations,
        // Quote-to-order conversion rate as a percentage string,
        // matching completionRate's shape.
        quoteConversionRate: totalQuotations > 0
          ? ((convertedQuotations / totalQuotations) * 100).toFixed(2)
          : '0.00'
      },
      recentOrders,
      topCustomers
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/sales', cacheRoute(dashboardCacheTTL), requireAuth, requireRole('sales', 'admin'), async (req, res, next) => {
  try {
    const myInquiries = await db.Inquiry.count({ where: { salesPersonId: req.user.id } });
    const myQuotations = await db.Quotation.count({ where: { salesPersonId: req.user.id } });
    const myOrders = await db.SalesOrder.count({
      include: [
        { model: db.Quotation, as: 'quotation', where: { salesPersonId: req.user.id }, required: false }
      ]
    });

    const convertedQuotations = await db.Quotation.count({
      where: { salesPersonId: req.user.id, status: 'accepted' }
    });

    const pendingFollowUps = await db.Inquiry.findAll({
      where: {
        salesPersonId: req.user.id,
        followUpDate: { [Op.lte]: dayjs().endOf('day').toDate() },
        status: { [Op.ne]: 'converted' }
      },
      include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }]
    });

    const recentInquiries = await db.Inquiry.findAll({
      where: { salesPersonId: req.user.id },
      limit: 5,
      order: [['createdAt', 'DESC']],
      include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }]
    });

    res.json(getSuccessResponse({
      stats: {
        myInquiries,
        myQuotations,
        myOrders,
        conversionRate: myQuotations > 0 ? ((convertedQuotations / myQuotations) * 100).toFixed(2) : 0
      },
      pendingFollowUps,
      recentInquiries
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/operations', cacheRoute(dashboardCacheTTL), requireAuth, requireRole('operations', 'admin'), async (req, res, next) => {
  try {
    const activeOrders = await db.SalesOrder.count({
      where: { status: { [Op.in]: ['confirmed', 'in_production', 'ready', 'shipped'] } }
    });

    const shippedOrders = await db.Shipment.count({
      where: { status: { [Op.ne]: 'delivered' } }
    });

    const pendingInspections = await db.Inspection.count({
      where: { status: { [Op.in]: ['scheduled', 'in_progress'] } }
    });

    const failedInspections = await db.Inspection.count({
      where: { overallResult: 'fail' }
    });

    const lowStockItems = await db.InventoryItem.findAll({
      where: {
        availableQty: { [Op.lte]: db.sequelize.col('reorder_level') }
      },
      include: [{ model: db.Product, as: 'product', attributes: ['name', 'sku'] }],
      limit: 10
    });

    res.json(getSuccessResponse({
      stats: {
        activeOrders,
        shippedOrders,
        pendingInspections,
        failedInspections
      },
      lowStockItems
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/finance', cacheRoute(dashboardCacheTTL), requireAuth, requireRole('finance', 'admin'), async (req, res, next) => {
  try {
    const totalInvoices = await db.Invoice.count();
    const paidInvoices = await db.Invoice.count({ where: { status: 'paid' } });
    const overdue = await db.Invoice.count({
      where: {
        status: { [Op.in]: ['draft', 'sent'] },
        dueDate: { [Op.lt]: dayjs().startOf('day').toDate() }
      }
    });

    const totalBalance = await db.Invoice.sum('balance', {
      where: { status: { [Op.in]: ['draft', 'sent'] } }
    });

    const monthlyRevenue = await db.sequelize.query(`
      SELECT strftime('%Y-%m', created_at) as month, SUM(total) as revenue
      FROM SalesOrder
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
      LIMIT 12
    `, { type: 'SELECT' });

    res.json(getSuccessResponse({
      stats: {
        totalInvoices,
        paidInvoices,
        overdue,
        totalBalance: totalBalance || 0,
        collectionRate: totalInvoices > 0 ? ((paidInvoices / totalInvoices) * 100).toFixed(2) : 0
      },
      monthlyRevenue
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/customer/:customerId', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const customer = await db.Customer.findByPk(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const totalOrders = await db.SalesOrder.count({ where: { customerId: req.params.customerId } });
    const totalSpent = await db.SalesOrder.sum('total', { where: { customerId: req.params.customerId } });
    const pendingOrders = await db.SalesOrder.count({
      where: { customerId: req.params.customerId, status: { [Op.ne]: 'completed' } }
    });

    const invoiceBalance = await db.Invoice.sum('balance', {
      where: { customerId: req.params.customerId, status: { [Op.in]: ['draft', 'sent'] } }
    });

    const recentOrders = await db.SalesOrder.findAll({
      where: { customerId: req.params.customerId },
      limit: 5,
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse({
      customer,
      stats: {
        totalOrders,
        totalSpent: totalSpent || 0,
        pendingOrders,
        invoiceBalance: invoiceBalance || 0
      },
      recentOrders
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/personalization', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const user = await db.User.findByPk(req.user.id, {
      attributes: ['id', 'preferences']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const preferences = user.preferences || {
      dashboard: {
        layout: 'default',
        widgets: ['stats', 'recentOrders', 'topCustomers', 'monthlyRevenue'],
        widgetOrder: [],
        hiddenWidgets: []
      }
    };

    res.json(getSuccessResponse({ preferences }));
  } catch (error) {
    next(error);
  }
});

router.put('/personalization', requireAuth, async (req, res, next) => {
  try {
    const { layout, widgets, widgetOrder, hiddenWidgets } = req.body;

    if (!layout && !widgets && !widgetOrder && !hiddenWidgets) {
      return res.status(400).json({ error: 'At least one preference field is required' });
    }

    const user = await db.User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let currentPreferences = {};
    try {
      currentPreferences = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : (user.preferences || {});
    } catch (e) {
      currentPreferences = {};
    }

    const currentDashboard = currentPreferences.dashboard || {
      layout: 'default',
      widgets: ['stats', 'recentOrders', 'topCustomers', 'monthlyRevenue'],
      widgetOrder: [],
      hiddenWidgets: []
    };

    const updatedPreferences = {
      ...currentPreferences,
      dashboard: {
        layout: layout || currentDashboard.layout,
        widgets: widgets || currentDashboard.widgets,
        widgetOrder: widgetOrder || currentDashboard.widgetOrder || [],
        hiddenWidgets: hiddenWidgets || currentDashboard.hiddenWidgets || []
      }
    };

    await user.update({ preferences: JSON.stringify(updatedPreferences) });

    res.json(getSuccessResponse({ preferences: updatedPreferences }, 'Dashboard preferences saved successfully'));
  } catch (error) {
    next(error);
  }
});

router.post('/custom-chart', requireAuth, async (req, res, next) => {
  try {
    const { entity, metric, field, groupBy, dateRange, filters } = req.body;

    if (!entity || !metric || !groupBy) {
      return res.status(400).json({ error: 'entity, metric, and groupBy are required' });
    }

    const validEntities = ['salesOrders', 'invoices', 'quotations', 'customers', 'shipments', 'purchaseOrders'];
    const validMetrics = ['count', 'sum', 'average'];
    const validGroupBy = ['status', 'month', 'customer', 'factory', 'country'];

    if (!validEntities.includes(entity)) {
      return res.status(400).json({ error: `entity must be one of: ${validEntities.join(', ')}` });
    }
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({ error: `metric must be one of: ${validMetrics.join(', ')}` });
    }
    if (!validGroupBy.includes(groupBy)) {
      return res.status(400).json({ error: `groupBy must be one of: ${validGroupBy.join(', ')}` });
    }

    let model, groupByColumn, aggregateField;

    switch (entity) {
      case 'salesOrders':
        model = db.SalesOrder;
        aggregateField = field || 'total';
        break;
      case 'invoices':
        model = db.Invoice;
        aggregateField = field || 'total';
        break;
      case 'quotations':
        model = db.Quotation;
        aggregateField = field || 'amount';
        break;
      case 'customers':
        model = db.Customer;
        aggregateField = field || 'id';
        break;
      case 'shipments':
        model = db.Shipment;
        aggregateField = field || 'id';
        break;
      case 'purchaseOrders':
        model = db.PurchaseOrder;
        aggregateField = field || 'total';
        break;
    }

    switch (groupBy) {
      case 'month':
        groupByColumn = "strftime('%Y-%m', created_at)";
        break;
      case 'status':
        groupByColumn = 'status';
        break;
      case 'customer':
        groupByColumn = 'customer_id';
        break;
      case 'factory':
        groupByColumn = 'factory_id';
        break;
      case 'country':
        groupByColumn = 'country';
        break;
    }

    let whereClause = '';

    if (dateRange && dateRange.start && dateRange.end) {
      const startDate = new Date(dateRange.start).toISOString().split('T')[0];
      const endDate = new Date(dateRange.end).toISOString().split('T')[0];
      whereClause += ` WHERE created_at >= '${startDate}' AND created_at <= '${endDate}'`;
    }

    if (filters) {
      const filterEntries = Object.entries(filters);
      if (filterEntries.length > 0) {
        const filterConditions = filterEntries
          .map(([key, value]) => {
            if (typeof value === 'string') {
              return `${key} = '${value.replace(/'/g, "''")}'`;
            }
            return `${key} = ${value}`;
          })
          .join(' AND ');

        whereClause += whereClause ? ` AND ${filterConditions}` : ` WHERE ${filterConditions}`;
      }
    }

    let aggregateFunction;
    switch (metric) {
      case 'count':
        aggregateFunction = `COUNT(${aggregateField})`;
        break;
      case 'sum':
        aggregateFunction = `SUM(${aggregateField})`;
        break;
      case 'average':
        aggregateFunction = `AVG(${aggregateField})`;
        break;
    }

    const tableName = model.tableName;
    const query = `
      SELECT ${groupByColumn} as groupKey, ${aggregateFunction} as value
      FROM ${tableName}
      ${whereClause}
      GROUP BY ${groupByColumn}
      ORDER BY ${groupByColumn} DESC
    `;

    const chartData = await db.sequelize.query(query, { type: 'SELECT' });

    res.json(getSuccessResponse({
      entity,
      metric,
      groupBy,
      data: chartData
    }, 'Custom chart data generated successfully'));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Role-Based Dashboard Configuration
router.get('/role/:role', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const { role } = req.params;
    const validRoles = ['admin', 'ceo', 'cfo', 'coo', 'cmo', 'sales', 'operations', 'finance'];

    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
    }

    let dashboardConfig = {};

    switch (role) {
      case 'admin':
        dashboardConfig = {
          role: 'admin',
          title: 'Sovern Portal',
          widgets: [
            { id: 'revenue',        name: 'Revenue',            category: 'metrics',     size: 'medium', endpoint: '/api/reports/financial' },
            { id: 'pipeline',       name: 'Sales Pipeline',     category: 'sales',       size: 'large',  endpoint: '/api/reports/pipeline' },
            { id: 'kpis',           name: 'Company KPIs',       category: 'metrics',     size: 'large',  endpoint: '/api/dashboard/kpi' },
            { id: 'cashFlow',       name: 'Cash Flow',          category: 'finance',     size: 'medium', endpoint: '/api/dashboard/finance' },
            { id: 'recentInquiries',name: 'Recent Inquiries',   category: 'sales',       size: 'medium', endpoint: '/api/dashboard/recent-inquiries' },
            { id: 'shipments',      name: 'Upcoming Shipments', category: 'operations',  size: 'medium', endpoint: '/api/dashboard/upcoming-shipments' },
          ]
        };
        break;
      case 'ceo':
        dashboardConfig = {
          role: 'ceo',
          title: 'CEO Dashboard',
          widgets: [
            { id: 'revenue', name: 'Revenue', category: 'metrics', size: 'medium', endpoint: '/api/reports/financial' },
            { id: 'profit', name: 'Profit & Margin', category: 'metrics', size: 'medium', endpoint: '/api/reports/profit-margin' },
            { id: 'topCustomers', name: 'Top Customers', category: 'analytics', size: 'medium', endpoint: '/api/dashboard/admin' },
            { id: 'pipeline', name: 'Sales Pipeline', category: 'sales', size: 'large', endpoint: '/api/reports/pipeline' },
            { id: 'kpis', name: 'Company KPIs', category: 'metrics', size: 'large', endpoint: '/api/dashboard/kpi' }
          ]
        };
        break;
      case 'cfo':
        dashboardConfig = {
          role: 'cfo',
          title: 'CFO Dashboard',
          widgets: [
            { id: 'cashFlow', name: 'Cash Flow', category: 'finance', size: 'medium', endpoint: '/api/dashboard/finance' },
            { id: 'arAging', name: 'AR Aging', category: 'finance', size: 'medium', endpoint: '/api/reports/aging?type=ar' },
            { id: 'apAging', name: 'AP Aging', category: 'finance', size: 'medium', endpoint: '/api/reports/aging?type=ap' },
            { id: 'paymentCollection', name: 'Payment Collection', category: 'finance', size: 'medium', endpoint: '/api/dashboard/finance' },
            { id: 'financialSummary', name: 'Financial Summary', category: 'finance', size: 'large', endpoint: '/api/reports/financial' }
          ]
        };
        break;
      case 'coo':
        dashboardConfig = {
          role: 'coo',
          title: 'COO Dashboard',
          widgets: [
            { id: 'orderFulfillment', name: 'Order Fulfillment', category: 'operations', size: 'medium', endpoint: '/api/dashboard/operations' },
            { id: 'logistics', name: 'Logistics Analytics', category: 'operations', size: 'large', endpoint: '/api/reports/logistics' },
            { id: 'inspections', name: 'Inspection Stats', category: 'quality', size: 'medium', endpoint: '/api/reports/logistics' },
            { id: 'factoryPerformance', name: 'Factory Performance', category: 'operations', size: 'large', endpoint: '/api/reports/factory/:factoryId' }
          ]
        };
        break;
      case 'cmo':
        dashboardConfig = {
          role: 'cmo',
          title: 'CMO Dashboard',
          widgets: [
            { id: 'customerAcquisition', name: 'Customer Acquisition', category: 'marketing', size: 'medium', endpoint: '/api/dashboard/admin' },
            { id: 'quotationConversion', name: 'Quotation Conversion', category: 'sales', size: 'medium', endpoint: '/api/reports/pipeline' },
            { id: 'marketSegments', name: 'Market Segments', category: 'analytics', size: 'large', endpoint: '/api/dashboard/admin' },
            { id: 'teamPerformance', name: 'Team Performance', category: 'sales', size: 'large', endpoint: '/api/reports/performance' }
          ]
        };
        break;
      case 'sales':
        dashboardConfig = {
          role: 'sales',
          title: 'Sales Dashboard',
          widgets: [
            { id: 'myQuotations', name: 'My Quotations', category: 'sales', size: 'medium', endpoint: '/api/dashboard/sales' },
            { id: 'myPipeline', name: 'My Pipeline', category: 'sales', size: 'medium', endpoint: '/api/reports/pipeline' },
            { id: 'targets', name: 'Targets vs Actual', category: 'sales', size: 'large', endpoint: '/api/dashboard/sales' },
            { id: 'recentInquiries', name: 'Recent Inquiries', category: 'sales', size: 'medium', endpoint: '/api/dashboard/sales' }
          ]
        };
        break;
      case 'operations':
        dashboardConfig = {
          role: 'operations',
          title: 'Operations Dashboard',
          widgets: [
            { id: 'shipmentTracking', name: 'Shipment Tracking', category: 'operations', size: 'large', endpoint: '/api/reports/logistics' },
            { id: 'productionStatus', name: 'Production Status', category: 'operations', size: 'large', endpoint: '/api/dashboard/operations' },
            { id: 'pendingInspections', name: 'Pending Inspections', category: 'quality', size: 'medium', endpoint: '/api/dashboard/operations' }
          ]
        };
        break;
      case 'finance':
        dashboardConfig = {
          role: 'finance',
          title: 'Finance Dashboard',
          widgets: [
            { id: 'invoiceStatus', name: 'Invoice Status', category: 'finance', size: 'medium', endpoint: '/api/dashboard/finance' },
            { id: 'paymentTracking', name: 'Payment Tracking', category: 'finance', size: 'medium', endpoint: '/api/dashboard/finance' },
            { id: 'overdueAccounts', name: 'Overdue Accounts', category: 'finance', size: 'medium', endpoint: '/api/reports/aging' },
            { id: 'financialReport', name: 'Financial Report', category: 'finance', size: 'large', endpoint: '/api/reports/financial' }
          ]
        };
        break;
    }

    res.json(getSuccessResponse(dashboardConfig));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Available Widgets List
router.get('/widgets', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const widgets = [
      {
        id: 'revenue',
        name: 'Revenue',
        description: 'Monthly revenue trend',
        category: 'metrics',
        defaultSize: 'medium',
        requiredRole: ['finance', 'ceo', 'admin'],
        dataEndpoint: '/api/reports/financial'
      },
      {
        id: 'profit',
        name: 'Profit Margin',
        description: 'Profit margin analysis',
        category: 'metrics',
        defaultSize: 'medium',
        requiredRole: ['finance', 'ceo', 'cfo', 'admin'],
        dataEndpoint: '/api/reports/profit-margin'
      },
      {
        id: 'pipeline',
        name: 'Sales Pipeline',
        description: 'Pipeline value by stage',
        category: 'sales',
        defaultSize: 'large',
        requiredRole: ['sales', 'cmo', 'ceo', 'admin'],
        dataEndpoint: '/api/reports/pipeline'
      },
      {
        id: 'orders',
        name: 'Orders',
        description: 'Sales orders overview',
        category: 'sales',
        defaultSize: 'medium',
        requiredRole: ['sales', 'operations', 'admin'],
        dataEndpoint: '/api/reports/sales'
      },
      {
        id: 'logistics',
        name: 'Logistics',
        description: 'Shipping and delivery metrics',
        category: 'operations',
        defaultSize: 'large',
        requiredRole: ['operations', 'coo', 'admin'],
        dataEndpoint: '/api/reports/logistics'
      },
      {
        id: 'arAging',
        name: 'AR Aging',
        description: 'Accounts receivable aging',
        category: 'finance',
        defaultSize: 'medium',
        requiredRole: ['finance', 'cfo', 'admin'],
        dataEndpoint: '/api/reports/aging?type=ar'
      },
      {
        id: 'performance',
        name: 'Team Performance',
        description: 'Sales team metrics',
        category: 'sales',
        defaultSize: 'large',
        requiredRole: ['sales', 'cmo', 'admin'],
        dataEndpoint: '/api/reports/performance'
      }
    ];

    res.json(getSuccessResponse({ widgets }));
  } catch (error) {
    next(error);
  }
});

// Save user's dashboard layout
router.post('/layout', requireAuth, async (req, res, next) => {
  try {
    const { layout } = req.body;

    let dashLayout = await db.DashboardLayout.findOne({
      where: { userId: req.user.id }
    });

    if (dashLayout) {
      dashLayout = await dashLayout.update({ layout });
    } else {
      // DashboardLayout.role is a Sequelize ENUM that does not include
      // 'super_admin'. Coerce to 'admin' on persistence — the layout table
      // doesn't care about the distinction (it's a UI preference store).
      const persistRole = req.user.role === 'super_admin' ? 'admin' : req.user.role;
      dashLayout = await db.DashboardLayout.create({
        userId: req.user.id,
        role: persistRole,
        layout
      });
    }

    // Invalidate cache for user's dashboard
    await invalidateCache(`dashboard:user:${req.user.id}:*`);

    res.json(getSuccessResponse({
      message: 'Dashboard layout saved successfully',
      data: dashLayout
    }));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Get KPIs
router.get('/kpi', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const today = dayjs();
    const monthStart = today.startOf('month').toDate();
    const monthEnd = today.endOf('month').toDate();
    const prevMonthStart = today.subtract(1, 'month').startOf('month').toDate();
    const prevMonthEnd = today.subtract(1, 'month').endOf('month').toDate();
    const { Op } = require('sequelize');

    // Revenue Growth Rate
    const currentRevenue = await db.SalesOrder.sum('total', {
      where: { status: 'completed', createdAt: { [Op.between]: [monthStart, monthEnd] } }
    }) || 0;

    const prevRevenue = await db.SalesOrder.sum('total', {
      where: { status: 'completed', createdAt: { [Op.between]: [prevMonthStart, prevMonthEnd] } }
    }) || 0;

    const revenueGrowthRate = prevRevenue > 0
      ? (((currentRevenue - prevRevenue) / prevRevenue) * 100).toFixed(2)
      : 0;

    // Order Fulfillment Rate
    const currentOrders = await db.SalesOrder.count({
      where: { createdAt: { [Op.between]: [monthStart, monthEnd] } }
    });

    const fulfilledOrders = await db.SalesOrder.count({
      where: {
        status: 'completed',
        createdAt: { [Op.between]: [monthStart, monthEnd] }
      }
    });

    const fulfillmentRate = currentOrders > 0
      ? ((fulfilledOrders / currentOrders) * 100).toFixed(2)
      : 0;

    // Customer Satisfaction (based on claims ratio)
    const totalOrders = await db.SalesOrder.count();
    const claimedOrders = await db.sequelize.query(`
      SELECT COUNT(DISTINCT c.sales_order_id) as count
      FROM Claim c
      WHERE c.created_at BETWEEN ? AND ?
    `, {
      replacements: [monthStart, monthEnd],
      type: 'SELECT'
    });

    const satisfactionScore = totalOrders > 0
      ? ((1 - (claimedOrders[0]?.count || 0) / totalOrders) * 100).toFixed(2)
      : 100;

    // Average Delivery Time
    const shipments = await db.Shipment.findAll({
      where: {
        status: 'delivered',
        createdAt: { [Op.between]: [monthStart, monthEnd] }
      }
    });

    let totalDeliveryDays = 0;
    shipments.forEach(s => {
      if (s.shippedDate && s.deliveryDate) {
        totalDeliveryDays += dayjs(s.deliveryDate).diff(dayjs(s.shippedDate), 'day');
      }
    });

    const avgDeliveryTime = shipments.length > 0
      ? (totalDeliveryDays / shipments.length).toFixed(2)
      : 0;

    // Invoice Processing Rate
    const totalInvoices = await db.Invoice.count({
      where: { createdAt: { [Op.between]: [monthStart, monthEnd] } }
    });

    const paidInvoices = await db.Invoice.count({
      where: {
        status: 'paid',
        createdAt: { [Op.between]: [monthStart, monthEnd] }
      }
    });

    const invoiceProcessingRate = totalInvoices > 0
      ? ((paidInvoices / totalInvoices) * 100).toFixed(2)
      : 0;

    res.json(getSuccessResponse({
      period: { current: { start: monthStart, end: monthEnd }, previous: { start: prevMonthStart, end: prevMonthEnd } },
      kpis: {
        revenueGrowthRate: {
          value: parseFloat(revenueGrowthRate),
          unit: '%',
          label: 'Revenue Growth Rate',
          current: parseFloat(currentRevenue).toFixed(2),
          previous: parseFloat(prevRevenue).toFixed(2)
        },
        orderFulfillmentRate: {
          value: parseFloat(fulfillmentRate),
          unit: '%',
          label: 'Order Fulfillment Rate',
          fulfilled: fulfilledOrders,
          total: currentOrders
        },
        customerSatisfactionScore: {
          value: parseFloat(satisfactionScore),
          unit: '%',
          label: 'Customer Satisfaction Score'
        },
        avgDeliveryTime: {
          value: parseFloat(avgDeliveryTime),
          unit: 'days',
          label: 'Average Delivery Time',
          deliveredShipments: shipments.length
        },
        invoiceProcessingRate: {
          value: parseFloat(invoiceProcessingRate),
          unit: '%',
          label: 'Invoice Processing Rate',
          processed: paidInvoices,
          total: totalInvoices
        }
      }
    }));
  } catch (error) {
    next(error);
  }
});
router.get('/layout', requireAuth, async (req, res, next) => {
  try {
    let layout = await db.DashboardLayout.findOne({
      where: { userId: req.user.id }
    });

    if (!layout) {
      const persistRole = req.user.role === 'super_admin' ? 'admin' : req.user.role;
      layout = await db.DashboardLayout.create({
        userId: req.user.id,
        role: persistRole,
        layout: [],
        isDefault: false
      });
    }

    res.json(getSuccessResponse(layout));
  } catch (error) {
    next(error);
  }
});

router.get('/revenue', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const { period = '6months' } = req.query;
    const months = period === '12months' ? 12 : period === '3months' ? 3 : 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const orders = await db.SalesOrder.findAll({
      where: { createdAt: { [Op.gte]: startDate } },
      attributes: ['total', 'createdAt'],
      order: [['createdAt', 'ASC']]
    });

    // Group by month
    const monthlyData = {};
    orders.forEach(order => {
      const date = new Date(order.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData[key]) monthlyData[key] = { month: key, revenue: 0, orders: 0 };
      monthlyData[key].revenue += parseFloat(order.total || 0);
      monthlyData[key].orders += 1;
    });

    res.json(getSuccessResponse(Object.values(monthlyData)));
  } catch (error) {
    next(error);
  }
});

/**
 * Recent orders
 * @route GET /api/dashboard/recent-orders
 */
router.get('/recent-orders', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const orders = await db.SalesOrder.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }]
    });
    res.json(getSuccessResponse(orders));
  } catch (error) {
    next(error);
  }
});

/**
 * Top customers by order value
 * @route GET /api/dashboard/top-customers
 */
router.get('/top-customers', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const customers = await db.Customer.findAll({
      attributes: ['id', 'companyName', 'contactPerson', 'balance'],
      order: [['balance', 'DESC']],
      limit: 10,
      where: { isActive: true }
    });
    res.json(getSuccessResponse(customers));
  } catch (error) {
    next(error);
  }
});

/**
 * Recent inquiries
 * @route GET /api/dashboard/recent-inquiries
 */
router.get('/recent-inquiries', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const inquiries = await db.Inquiry.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }]
    });
    res.json(getSuccessResponse(inquiries));
  } catch (error) {
    next(error);
  }
});

/**
 * Upcoming shipments
 * @route GET /api/dashboard/upcoming-shipments
 */
router.get('/upcoming-shipments', cacheRoute(dashboardCacheTTL), requireAuth, async (req, res, next) => {
  try {
    const shipments = await db.Shipment.findAll({
      where: { status: { [Op.in]: ['pending', 'in_transit', 'booked'] } },
      limit: 10,
      order: [['eta', 'ASC']]
    });
    res.json(getSuccessResponse(shipments));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
