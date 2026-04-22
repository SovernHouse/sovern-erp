/**
 * Advanced Analytics Routes
 * @module routes/analyticsRoutes
 * @description Endpoints for advanced analytics and chart data
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 * @requires dayjs
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

/**
 * GET /api/analytics/revenue-trend
 * Monthly revenue for last 12 months
 */
router.get('/revenue-trend', requireAuth, async (req, res, next) => {
  try {
    const months = 12;
    const endDate = dayjs().endOf('month').toDate();
    const startDate = dayjs(endDate).subtract(months - 1, 'month').startOf('month').toDate();

    const data = await db.sequelize.query(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue,
        COUNT(*) as orderCount
      FROM SalesOrder
      WHERE created_at BETWEEN ? AND ?
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
    `, {
      replacements: [startDate, endDate],
      type: 'SELECT'
    });

    // Fill in missing months with 0
    const monthMap = {};
    for (let i = 0; i < months; i++) {
      const m = dayjs(startDate).add(i, 'month').format('YYYY-MM');
      monthMap[m] = { month: m, revenue: 0, orderCount: 0 };
    }

    data.forEach(row => {
      if (monthMap[row.month]) {
        monthMap[row.month].revenue = parseFloat(row.revenue || 0);
        monthMap[row.month].orderCount = parseInt(row.orderCount || 0);
      }
    });

    const chartData = Object.values(monthMap);

    // Simple linear forecast for next 3 months
    const forecast = [];
    if (chartData.length > 0) {
      const recentData = chartData.slice(-3);
      const avgRevenue = recentData.reduce((sum, d) => sum + d.revenue, 0) / recentData.length;

      for (let i = 1; i <= 3; i++) {
        const forecastMonth = dayjs().add(i, 'month').format('YYYY-MM');
        forecast.push({
          month: forecastMonth,
          revenue: parseFloat(avgRevenue.toFixed(2)),
          forecast: true
        });
      }
    }

    res.json(getSuccessResponse({
      data: chartData,
      forecast,
      summary: {
        totalRevenue: chartData.reduce((sum, d) => sum + d.revenue, 0),
        avgRevenue: chartData.length > 0
          ? (chartData.reduce((sum, d) => sum + d.revenue, 0) / chartData.length).toFixed(2)
          : 0,
        totalOrders: chartData.reduce((sum, d) => sum + d.orderCount, 0)
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/order-funnel
 * Inquiry → Quotation → PI → Order conversion rates
 */
router.get('/order-funnel', requireAuth, async (req, res, next) => {
  try {
    const inquiries = await db.Inquiry.count();
    const quotations = await db.Quotation.count();
    const proformas = await db.ProformaInvoice.count();
    const salesOrders = await db.SalesOrder.count();
    const invoices = await db.Invoice.count();
    const paidInvoices = await db.Invoice.count({ where: { status: 'paid' } });

    const stages = [
      { name: 'Inquiry', value: inquiries },
      { name: 'Quotation', value: quotations },
      { name: 'PI', value: proformas },
      { name: 'Sales Order', value: salesOrders },
      { name: 'Invoice', value: invoices },
      { name: 'Paid', value: paidInvoices }
    ];

    const conversionRates = [];
    for (let i = 1; i < stages.length; i++) {
      const prevValue = stages[i - 1].value;
      const rate = prevValue > 0 ? ((stages[i].value / prevValue) * 100).toFixed(2) : 0;
      conversionRates.push({
        from: stages[i - 1].name,
        to: stages[i].name,
        rate: parseFloat(rate),
        fromCount: prevValue,
        toCount: stages[i].value
      });
    }

    res.json(getSuccessResponse({
      stages,
      conversionRates
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/top-products
 * Top 10 products by revenue
 */
router.get('/top-products', requireAuth, async (req, res, next) => {
  try {
    const topProducts = await db.sequelize.query(`
      SELECT
        p.id,
        p.name,
        p.sku,
        SUM(soi.quantity) as totalQuantity,
        SUM(soi.line_total) as totalRevenue,
        COUNT(DISTINCT so.id) as orderCount
      FROM Product p
      LEFT JOIN SalesOrderItem soi ON p.id = soi.product_id
      LEFT JOIN SalesOrder so ON soi.sales_order_id = so.id AND so.status = 'completed'
      WHERE so.id IS NOT NULL OR p.id IS NOT NULL
      GROUP BY p.id, p.name, p.sku
      ORDER BY totalRevenue DESC
      LIMIT 10
    `, { type: 'SELECT' });

    const total = topProducts.reduce((sum, p) => sum + parseFloat(p.totalRevenue || 0), 0);

    const data = topProducts.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      quantity: parseInt(p.totalQuantity || 0),
      revenue: parseFloat(p.totalRevenue || 0),
      orderCount: parseInt(p.orderCount || 0),
      percentage: total > 0 ? ((parseFloat(p.totalRevenue || 0) / total) * 100).toFixed(2) : 0
    }));

    res.json(getSuccessResponse({
      data,
      summary: {
        totalProducts: data.length,
        totalRevenue: parseFloat(total).toFixed(2),
        totalQuantity: data.reduce((sum, p) => sum + p.quantity, 0)
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/customer-segments
 * Customer segmentation by revenue tiers
 */
router.get('/customer-segments', requireAuth, async (req, res, next) => {
  try {
    const customerRevenue = await db.sequelize.query(`
      SELECT
        c.id,
        c.company_name,
        SUM(so.total) as totalRevenue,
        COUNT(so.id) as orderCount
      FROM Customer c
      LEFT JOIN SalesOrder so ON c.id = so.customer_id AND so.status = 'completed'
      GROUP BY c.id, c.company_name
      ORDER BY totalRevenue DESC
    `, { type: 'SELECT' });

    const segments = {
      'Tier A (>$100K)': [],
      'Tier B ($50K-$100K)': [],
      'Tier C ($10K-$50K)': [],
      'Tier D (<$10K)': []
    };

    const segmentCounts = {
      'Tier A (>$100K)': 0,
      'Tier B ($50K-$100K)': 0,
      'Tier C ($10K-$50K)': 0,
      'Tier D (<$10K)': 0
    };

    const segmentRevenue = {
      'Tier A (>$100K)': 0,
      'Tier B ($50K-$100K)': 0,
      'Tier C ($10K-$50K)': 0,
      'Tier D (<$10K)': 0
    };

    customerRevenue.forEach(c => {
      const revenue = parseFloat(c.totalRevenue || 0);
      let tier;
      if (revenue > 100000) tier = 'Tier A (>$100K)';
      else if (revenue >= 50000) tier = 'Tier B ($50K-$100K)';
      else if (revenue >= 10000) tier = 'Tier C ($10K-$50K)';
      else tier = 'Tier D (<$10K)';

      segments[tier].push({
        id: c.id,
        name: c.company_name,
        revenue: parseFloat(revenue).toFixed(2),
        orderCount: parseInt(c.orderCount || 0)
      });
      segmentCounts[tier]++;
      segmentRevenue[tier] += revenue;
    });

    const data = Object.keys(segments).map(tier => ({
      name: tier,
      count: segmentCounts[tier],
      revenue: parseFloat(segmentRevenue[tier]).toFixed(2),
      customers: segments[tier]
    }));

    res.json(getSuccessResponse({
      data,
      summary: {
        totalCustomers: customerRevenue.length,
        totalRevenue: customerRevenue.reduce((sum, c) => sum + parseFloat(c.totalRevenue || 0), 0).toFixed(2)
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/factory-performance
 * Factory comparison - quality, delivery, cost
 */
router.get('/factory-performance', requireAuth, async (req, res, next) => {
  try {
    const factories = await db.Factory.findAll({ attributes: ['id', 'companyName'] });

    const performanceData = [];

    for (const factory of factories) {
      const purchaseOrders = await db.PurchaseOrder.findAll({
        where: { factoryId: factory.id }
      });

      const inspections = await db.Inspection.findAll({
        where: { factoryId: factory.id }
      });

      const totalOrders = purchaseOrders.length;
      const completedOrders = purchaseOrders.filter(o => o.status === 'completed').length;
      const totalCost = purchaseOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
      const avgCost = totalOrders > 0 ? totalCost / totalOrders : 0;

      const deliveryOnTime = purchaseOrders.filter(o =>
        o.status === 'completed' &&
        dayjs(o.updatedAt).isSameOrBefore(dayjs(o.expectedDeliveryDate))
      ).length;

      const qualityPass = inspections.filter(i => i.overallResult === 'pass').length;
      const qualityRate = inspections.length > 0 ? ((qualityPass / inspections.length) * 100).toFixed(2) : 100;
      const deliveryRate = totalOrders > 0 ? ((deliveryOnTime / totalOrders) * 100).toFixed(2) : 0;

      performanceData.push({
        id: factory.id,
        name: factory.companyName,
        quality: parseFloat(qualityRate),
        delivery: parseFloat(deliveryRate),
        cost: parseFloat(avgCost).toFixed(2),
        communication: 80, // Placeholder
        capacity: 75, // Placeholder
        totalOrders,
        totalInspections: inspections.length
      });
    }

    res.json(getSuccessResponse({
      data: performanceData.sort((a, b) => (b.quality + b.delivery) / 2 - (a.quality + a.delivery) / 2)
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/payment-aging
 * Payment aging buckets
 */
router.get('/payment-aging', requireAuth, async (req, res, next) => {
  try {
    const today = dayjs();
    const invoices = await db.Invoice.findAll({
      where: { status: { [Op.in]: ['draft', 'sent', 'partially_paid'] } },
      include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }]
    });

    const agingBuckets = {
      current: { count: 0, amount: 0, percentage: 0 },
      '30': { count: 0, amount: 0, percentage: 0 },
      '60': { count: 0, amount: 0, percentage: 0 },
      '90': { count: 0, amount: 0, percentage: 0 },
      '120plus': { count: 0, amount: 0, percentage: 0 }
    };

    let totalAmount = 0;

    invoices.forEach(inv => {
      const daysOverdue = today.diff(dayjs(inv.dueDate), 'day');
      const balance = parseFloat(inv.balance || 0);
      totalAmount += balance;

      const bucket = daysOverdue <= 0 ? 'current' : daysOverdue <= 30 ? '30' : daysOverdue <= 60 ? '60' : daysOverdue <= 90 ? '90' : '120plus';
      agingBuckets[bucket].count += 1;
      agingBuckets[bucket].amount += balance;
    });

    // Calculate percentages
    Object.keys(agingBuckets).forEach(bucket => {
      agingBuckets[bucket].amount = parseFloat(agingBuckets[bucket].amount).toFixed(2);
      agingBuckets[bucket].percentage = totalAmount > 0
        ? ((parseFloat(agingBuckets[bucket].amount) / totalAmount) * 100).toFixed(2)
        : 0;
    });

    const chartData = [
      { name: 'Current', value: parseInt(agingBuckets.current.count), amount: parseFloat(agingBuckets.current.amount) },
      { name: '1-30d', value: parseInt(agingBuckets['30'].count), amount: parseFloat(agingBuckets['30'].amount) },
      { name: '31-60d', value: parseInt(agingBuckets['60'].count), amount: parseFloat(agingBuckets['60'].amount) },
      { name: '61-90d', value: parseInt(agingBuckets['90'].count), amount: parseFloat(agingBuckets['90'].amount) },
      { name: '90d+', value: parseInt(agingBuckets['120plus'].count), amount: parseFloat(agingBuckets['120plus'].amount) }
    ];

    res.json(getSuccessResponse({
      buckets: agingBuckets,
      chartData,
      summary: {
        totalOutstanding: parseFloat(totalAmount).toFixed(2),
        overdue30plus: (parseFloat(agingBuckets['30'].amount) + parseFloat(agingBuckets['60'].amount) + parseFloat(agingBuckets['90'].amount) + parseFloat(agingBuckets['120plus'].amount)).toFixed(2)
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/shipment-timeline
 * Shipment status over time
 */
router.get('/shipment-timeline', requireAuth, async (req, res, next) => {
  try {
    const months = 12;
    const endDate = dayjs().endOf('month').toDate();
    const startDate = dayjs(endDate).subtract(months - 1, 'month').startOf('month').toDate();

    const shipmentData = await db.sequelize.query(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        status,
        COUNT(*) as count
      FROM Shipment
      WHERE created_at BETWEEN ? AND ?
      GROUP BY strftime('%Y-%m', created_at), status
      ORDER BY month ASC, status ASC
    `, {
      replacements: [startDate, endDate],
      type: 'SELECT'
    });

    const monthMap = {};
    for (let i = 0; i < months; i++) {
      const m = dayjs(startDate).add(i, 'month').format('YYYY-MM');
      monthMap[m] = { month: m, pending: 0, shipped: 0, delivered: 0 };
    }

    shipmentData.forEach(row => {
      if (monthMap[row.month]) {
        const statusKey = row.status.toLowerCase();
        if (statusKey in monthMap[row.month]) {
          monthMap[row.month][statusKey] = parseInt(row.count || 0);
        }
      }
    });

    const chartData = Object.values(monthMap);

    res.json(getSuccessResponse({
      data: chartData,
      summary: {
        totalShipments: shipmentData.reduce((sum, s) => sum + parseInt(s.count || 0), 0)
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/profit-margins
 * Profit margins by product/customer/factory
 */
router.get('/profit-margins', requireAuth, async (req, res, next) => {
  try {
    const { groupBy = 'product' } = req.query;

    const salesOrders = await db.SalesOrder.findAll({
      where: { status: 'completed' },
      include: [
        { model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] },
        { association: 'items', include: [{ model: db.Product, as: 'product', attributes: ['id', 'name'] }] }
      ]
    });

    const purchaseOrders = await db.PurchaseOrder.findAll({
      where: { status: 'completed' },
      include: [{ association: 'items' }]
    });

    // Map costs by product
    const productCosts = {};
    purchaseOrders.forEach(po => {
      if (po.items) {
        po.items.forEach(item => {
          if (!productCosts[item.productId]) {
            productCosts[item.productId] = [];
          }
          productCosts[item.productId].push(parseFloat(item.unitCost || 0) * parseFloat(item.quantity || 0));
        });
      }
    });

    const avgProductCosts = {};
    Object.keys(productCosts).forEach(productId => {
      const costs = productCosts[productId];
      avgProductCosts[productId] = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    });

    const marginData = {};

    salesOrders.forEach(so => {
      if (so.items) {
        so.items.forEach(item => {
          const key = groupBy === 'product' ? item.product?.name : groupBy === 'customer' ? so.customer?.companyName : 'All';
          if (!marginData[key]) {
            marginData[key] = { revenue: 0, cost: 0, transactions: 0 };
          }
          const revenue = parseFloat(item.lineTotal || item.total || 0);
          const cost = (avgProductCosts[item.productId] || 0) * (item.quantity || 0);
          marginData[key].revenue += revenue;
          marginData[key].cost += cost;
          marginData[key].transactions += 1;
        });
      }
    });

    const chartData = Object.keys(marginData).map(key => {
      const data = marginData[key];
      const margin = data.revenue - data.cost;
      const marginPercent = data.revenue > 0 ? ((margin / data.revenue) * 100).toFixed(2) : 0;
      return {
        name: key,
        revenue: parseFloat(data.revenue).toFixed(2),
        cost: parseFloat(data.cost).toFixed(2),
        margin: parseFloat(margin).toFixed(2),
        marginPercent: parseFloat(marginPercent)
      };
    }).sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin));

    res.json(getSuccessResponse({
      data: chartData,
      groupBy,
      summary: {
        avgMarginPercent: chartData.length > 0
          ? (chartData.reduce((sum, d) => sum + parseFloat(d.marginPercent), 0) / chartData.length).toFixed(2)
          : 0
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/forecast
 * Simple linear forecast for next 3 months
 */
router.get('/forecast', requireAuth, async (req, res, next) => {
  try {
    const months = 6;
    const endDate = dayjs().endOf('month').toDate();
    const startDate = dayjs(endDate).subtract(months - 1, 'month').startOf('month').toDate();

    const historicalData = await db.sequelize.query(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END) as revenue
      FROM SalesOrder
      WHERE created_at BETWEEN ? AND ?
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month ASC
    `, {
      replacements: [startDate, endDate],
      type: 'SELECT'
    });

    const monthMap = {};
    for (let i = 0; i < months; i++) {
      const m = dayjs(startDate).add(i, 'month').format('YYYY-MM');
      monthMap[m] = { month: m, revenue: 0 };
    }

    historicalData.forEach(row => {
      if (monthMap[row.month]) {
        monthMap[row.month].revenue = parseFloat(row.revenue || 0);
      }
    });

    const historical = Object.values(monthMap);

    // Simple linear regression for forecast
    const values = historical.map(d => d.revenue);
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = values.reduce((sum, _, i) => sum + (i + 1) * (i + 1), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const forecast = [];
    for (let i = 1; i <= 3; i++) {
      const forecastMonth = dayjs().add(i, 'month').format('YYYY-MM');
      const forecastValue = Math.max(0, intercept + slope * (n + i));
      forecast.push({
        month: forecastMonth,
        revenue: parseFloat(forecastValue).toFixed(2),
        forecast: true
      });
    }

    res.json(getSuccessResponse({
      historical,
      forecast,
      trend: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable'
    }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
