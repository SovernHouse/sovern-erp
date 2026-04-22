/**
 * Report Generation Routes
 * @module routes/reportRoutes
 * @description Endpoints for generating business reports and analytics
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
 * Helper function to get date range based on period
 * @param {string} period - Period type (week, month, quarter, year)
 * @returns {Object} Start and end dates
 */
const getDateRange = (period) => {
  const endDate = dayjs();
  let startDate;

  switch (period) {
    case 'week':
      startDate = endDate.subtract(7, 'day');
      break;
    case 'month':
      startDate = endDate.subtract(1, 'month');
      break;
    case 'quarter':
      startDate = endDate.subtract(3, 'month');
      break;
    case 'year':
      startDate = endDate.subtract(1, 'year');
      break;
    default:
      startDate = endDate.subtract(1, 'month');
  }

  return {
    startDate: startDate.toDate(),
    endDate: endDate.toDate()
  };
};

router.get('/sales', requireAuth, requireRole('finance', 'admin', 'sales'), async (req, res, next) => {
  try {
    const { period = 'month', customerId, salesPersonId } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const where = { createdAt: { [Op.between]: [startDate, endDate] } };
    if (customerId) where.customerId = customerId;

    const orders = await db.SalesOrder.findAll({
      where,
      include: [
        { model: db.Customer, as: 'customer', attributes: ['companyName'] },
        { association: 'items' }
      ],
      order: [['createdAt', 'DESC']]
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
    const completedOrders = orders.filter(o => o.status === 'completed').length;

    res.json(getSuccessResponse({
      period,
      dateRange: { startDate, endDate },
      stats: {
        totalOrders,
        completedOrders,
        totalRevenue,
        avgOrderValue,
        completionRate: totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(2) : 0
      },
      orders
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/purchase', requireAuth, requireRole('finance', 'admin', 'operations'), async (req, res, next) => {
  try {
    const { period = 'month', factoryId } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const where = { createdAt: { [Op.between]: [startDate, endDate] } };
    if (factoryId) where.factoryId = factoryId;

    const orders = await db.PurchaseOrder.findAll({
      where,
      include: [
        { model: db.Factory, as: 'factory', attributes: ['companyName'] },
        { association: 'items' }
      ],
      order: [['createdAt', 'DESC']]
    });

    const totalOrders = orders.length;
    const totalCost = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const avgOrderValue = totalOrders > 0 ? (totalCost / totalOrders) : 0;
    const receivedOrders = orders.filter(o => o.status === 'received').length;

    res.json(getSuccessResponse({
      period,
      dateRange: { startDate, endDate },
      stats: {
        totalOrders,
        receivedOrders,
        totalCost,
        avgOrderValue
      },
      orders
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/inventory', requireAuth, requireRole('operations', 'admin'), async (req, res, next) => {
  try {
    const items = await db.InventoryItem.findAll({
      include: [
        { model: db.Product, as: 'product', attributes: ['name', 'sku', 'categoryId'] },
        { association: 'transactions', limit: 10, separate: true }
      ]
    });

    const lowStockItems = items.filter(i => i.availableQty <= i.reorderLevel);
    const totalValue = items.reduce((sum, i) => sum + (i.quantity * 100), 0);

    res.json(getSuccessResponse({
      totalItems: items.length,
      lowStockCount: lowStockItems.length,
      totalInventoryValue: totalValue,
      items,
      lowStockItems
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/financial', requireAuth, requireRole('finance', 'admin'), async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const revenue = await db.SalesOrder.sum('total', {
      where: { status: 'completed', createdAt: { [Op.between]: [startDate, endDate] } }
    });

    const costs = await db.PurchaseOrder.sum('total', {
      where: { status: 'completed', createdAt: { [Op.between]: [startDate, endDate] } }
    });

    const collectionsReceived = await db.Payment.sum('amount', {
      where: { status: 'confirmed', date: { [Op.between]: [startDate, endDate] } }
    });

    const pendingPayments = await db.Invoice.sum('balance', {
      where: { status: { [Op.in]: ['unpaid', 'partially_paid'] } }
    });

    const profit = (revenue || 0) - (costs || 0);

    res.json(getSuccessResponse({
      period,
      dateRange: { startDate, endDate },
      stats: {
        revenue: revenue || 0,
        costs: costs || 0,
        profit,
        profitMargin: revenue ? ((profit / revenue) * 100).toFixed(2) : 0,
        collectionsReceived: collectionsReceived || 0,
        pendingPayments: pendingPayments || 0
      }
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/customer/:customerId', requireAuth, async (req, res, next) => {
  try {
    const { period = 'year' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const orders = await db.SalesOrder.findAll({
      where: {
        customerId: req.params.customerId,
        createdAt: { [Op.between]: [startDate, endDate] }
      },
      include: [{ association: 'items' }]
    });

    const invoices = await db.Invoice.findAll({
      where: {
        customerId: req.params.customerId,
        createdAt: { [Op.between]: [startDate, endDate] }
      }
    });

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + parseFloat(i.total || 0), 0);
    const outstandingBalance = invoices.reduce((sum, i) => sum + parseFloat(i.balance || 0), 0);

    res.json(getSuccessResponse({
      customerId: req.params.customerId,
      period,
      stats: {
        totalOrders,
        totalSpent,
        totalPaid,
        outstandingBalance,
        avgOrderValue: totalOrders > 0 ? (totalSpent / totalOrders).toFixed(2) : 0
      },
      orders,
      invoices
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/factory/:factoryId', requireAuth, async (req, res, next) => {
  try {
    const { period = 'year' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const purchaseOrders = await db.PurchaseOrder.findAll({
      where: {
        factoryId: req.params.factoryId,
        createdAt: { [Op.between]: [startDate, endDate] }
      }
    });

    const inspections = await db.Inspection.findAll({
      where: {
        factoryId: req.params.factoryId,
        createdAt: { [Op.between]: [startDate, endDate] }
      }
    });

    const totalOrders = purchaseOrders.length;
    const totalCost = purchaseOrders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const completedOrders = purchaseOrders.filter(o => o.status === 'completed').length;
    const passedInspections = inspections.filter(i => i.overallResult === 'pass').length;

    res.json(getSuccessResponse({
      factoryId: req.params.factoryId,
      period,
      stats: {
        totalOrders,
        completedOrders,
        totalCost,
        completionRate: totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(2) : 0,
        totalInspections: inspections.length,
        passedInspections,
        qualityRate: inspections.length > 0 ? ((passedInspections / inspections.length) * 100).toFixed(2) : 0
      }
    }));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Advanced Reporting - Profit Margin Analysis
router.get('/profit-margin', requireAuth, requireRole('finance', 'admin', 'cfo'), async (req, res, next) => {
  try {
    const { period = 'month', customerId, productId, startDate: queryStart, endDate: queryEnd } = req.query;
    const { startDate, endDate } = queryStart && queryEnd
      ? { startDate: new Date(queryStart), endDate: new Date(queryEnd) }
      : getDateRange(period);

    const salesOrders = await db.SalesOrder.findAll({
      where: {
        status: 'completed',
        createdAt: { [Op.between]: [startDate, endDate] },
        ...(customerId && { customerId })
      },
      include: [
        { model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] },
        {
          association: 'items',
          include: [{ model: db.Product, as: 'product', attributes: ['id', 'name'] }]
        }
      ]
    });

    const purchaseOrders = await db.PurchaseOrder.findAll({
      where: {
        status: 'completed',
        createdAt: { [Op.between]: [startDate, endDate] }
      },
      include: [{ association: 'items' }]
    });

    // Map purchase costs by product
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

    // Calculate average cost per product
    const avgProductCosts = {};
    Object.keys(productCosts).forEach(productId => {
      const costs = productCosts[productId];
      avgProductCosts[productId] = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;
    });

    // Calculate margins by product, customer, and month
    const marginsByProduct = {};
    const marginsByCustomer = {};
    const marginsByMonth = {};
    let totalRevenue = 0;
    let totalCost = 0;

    salesOrders.forEach(so => {
      const month = dayjs(so.createdAt).format('YYYY-MM');
      if (!marginsByMonth[month]) marginsByMonth[month] = { revenue: 0, cost: 0, transactions: 0 };

      if (so.items) {
        so.items.forEach(item => {
          const productId = item.productId;
          const productName = item.product?.name || `Product ${productId}`;
          const revenue = parseFloat(item.lineTotal || item.total || 0);
          const cost = (avgProductCosts[productId] || 0) * (item.quantity || 0);
          const margin = revenue - cost;

          // By Product
          if (!marginsByProduct[productId]) {
            marginsByProduct[productId] = { name: productName, revenue: 0, cost: 0, transactions: 0 };
          }
          marginsByProduct[productId].revenue += revenue;
          marginsByProduct[productId].cost += cost;
          marginsByProduct[productId].transactions += 1;

          // By Customer
          const customerId = so.customerId;
          const customerName = so.customer?.companyName || `Customer ${customerId}`;
          if (!marginsByCustomer[customerId]) {
            marginsByCustomer[customerId] = { name: customerName, revenue: 0, cost: 0, transactions: 0 };
          }
          marginsByCustomer[customerId].revenue += revenue;
          marginsByCustomer[customerId].cost += cost;
          marginsByCustomer[customerId].transactions += 1;

          // By Month
          marginsByMonth[month].revenue += revenue;
          marginsByMonth[month].cost += cost;
          marginsByMonth[month].transactions += 1;

          totalRevenue += revenue;
          totalCost += cost;
        });
      }
    });

    // Calculate margin percentages
    const formatMarginData = (data) => {
      return Object.keys(data).map(key => {
        const item = data[key];
        const margin = item.revenue - item.cost;
        const marginPercent = item.revenue > 0 ? ((margin / item.revenue) * 100).toFixed(2) : 0;
        return {
          ...item,
          margin: parseFloat(margin).toFixed(2),
          marginPercent: parseFloat(marginPercent)
        };
      });
    };

    const monthlyMargins = Object.keys(marginsByMonth).sort().map(month => {
      const data = marginsByMonth[month];
      const margin = data.revenue - data.cost;
      const marginPercent = data.revenue > 0 ? ((margin / data.revenue) * 100).toFixed(2) : 0;
      return {
        month,
        ...data,
        margin: parseFloat(margin).toFixed(2),
        marginPercent: parseFloat(marginPercent)
      };
    });

    res.json(getSuccessResponse({
      period,
      dateRange: { startDate, endDate },
      summary: {
        totalRevenue: parseFloat(totalRevenue).toFixed(2),
        totalCost: parseFloat(totalCost).toFixed(2),
        totalMargin: parseFloat(totalRevenue - totalCost).toFixed(2),
        overallMarginPercent: totalRevenue > 0 ? ((((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(2)) : 0,
        totalTransactions: salesOrders.reduce((sum, so) => sum + (so.items?.length || 0), 0)
      },
      byProduct: formatMarginData(marginsByProduct).sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin)),
      byCustomer: formatMarginData(marginsByCustomer).sort((a, b) => parseFloat(b.margin) - parseFloat(a.margin)),
      byMonth: monthlyMargins
    }));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Sales Pipeline Analysis
router.get('/pipeline', requireAuth, requireRole('sales', 'cmo', 'admin'), async (req, res, next) => {
  try {
    const { startDate: queryStart, endDate: queryEnd } = req.query;
    const { startDate, endDate } = queryStart && queryEnd
      ? { startDate: new Date(queryStart), endDate: new Date(queryEnd) }
      : getDateRange('year');

    // Quotation status breakdown
    const quotationsByStatus = {};
    const quotationStatuses = ['draft', 'sent', 'accepted', 'rejected'];

    for (const status of quotationStatuses) {
      const count = await db.Quotation.count({ where: { status } });
      const totalAmount = await db.Quotation.sum('amount', { where: { status } });
      quotationsByStatus[status] = {
        count,
        totalValue: parseFloat(totalAmount || 0).toFixed(2)
      };
    }

    // Conversion metrics
    const totalQuotations = await db.Quotation.count({ where: { createdAt: { [Op.between]: [startDate, endDate] } } });
    const acceptedQuotations = await db.Quotation.count({ where: { status: 'accepted', createdAt: { [Op.between]: [startDate, endDate] } } });
    const quotationToSOConversionRate = totalQuotations > 0 ? ((acceptedQuotations / totalQuotations) * 100).toFixed(2) : 0;

    // SO to Invoice conversion
    const totalSalesOrders = await db.SalesOrder.count({ where: { createdAt: { [Op.between]: [startDate, endDate] } } });
    const invoicedOrders = await db.SalesOrder.count({
      where: {
        createdAt: { [Op.between]: [startDate, endDate] },
        status: { [Op.in]: ['completed', 'shipped'] }
      }
    });
    const soToInvoiceConversionRate = totalSalesOrders > 0 ? ((invoicedOrders / totalSalesOrders) * 100).toFixed(2) : 0;

    // Average deal cycle time
    const quotationsWithCycle = await db.sequelize.query(`
      SELECT
        q.id, q.created_at, q.updated_at,
        CASE
          WHEN q.status = 'accepted' THEN q.updated_at
          WHEN q.status = 'rejected' THEN q.updated_at
          ELSE q.updated_at
        END as completion_date
      FROM Quotation q
      WHERE q.created_at BETWEEN ? AND ?
    `, {
      replacements: [startDate, endDate],
      type: 'SELECT'
    });

    let totalCycleDays = 0;
    let completedDeals = 0;
    quotationsWithCycle.forEach(q => {
      const cycleTime = dayjs(q.completion_date).diff(dayjs(q.created_at), 'day');
      if (cycleTime >= 0) {
        totalCycleDays += cycleTime;
        completedDeals += 1;
      }
    });
    const avgCycleDays = completedDeals > 0 ? (totalCycleDays / completedDeals).toFixed(2) : 0;

    // Pipeline value by stage
    const pipelineStages = {
      quotation: await db.Quotation.sum('amount', { where: { status: 'sent' } }) || 0,
      accepted: await db.Quotation.sum('amount', { where: { status: 'accepted' } }) || 0,
      order: await db.SalesOrder.sum('total', { where: { status: { [Op.in]: ['confirmed', 'in_production'] } } }) || 0,
      ready: await db.SalesOrder.sum('total', { where: { status: 'ready' } }) || 0,
      shipped: await db.SalesOrder.sum('total', { where: { status: 'shipped' } }) || 0
    };

    res.json(getSuccessResponse({
      dateRange: { startDate, endDate },
      quotationsByStatus,
      conversions: {
        quotationToSORate: parseFloat(quotationToSOConversionRate),
        soToInvoiceRate: parseFloat(soToInvoiceConversionRate),
        avgCycleDays: parseFloat(avgCycleDays)
      },
      pipelineValue: {
        quotation: parseFloat(pipelineStages.quotation).toFixed(2),
        accepted: parseFloat(pipelineStages.accepted).toFixed(2),
        order: parseFloat(pipelineStages.order).toFixed(2),
        ready: parseFloat(pipelineStages.ready).toFixed(2),
        shipped: parseFloat(pipelineStages.shipped).toFixed(2),
        totalPipelineValue: parseFloat(
          Object.values(pipelineStages).reduce((a, b) => a + b, 0)
        ).toFixed(2)
      }
    }));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Aging Report - AR/AP Analysis
router.get('/aging', requireAuth, requireRole('finance', 'admin'), async (req, res, next) => {
  try {
    const { type = 'ar', startDate: queryStart, endDate: queryEnd } = req.query;
    const today = dayjs();
    const { startDate: prevStart, endDate: prevEnd } = getDateRange('month');

    if (type === 'ar') {
      // Accounts Receivable aging
      const invoices = await db.Invoice.findAll({
        where: { status: { [Op.in]: ['draft', 'sent'] } },
        include: [{ model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] }]
      });

      const agingBuckets = {
        current: { count: 0, total: 0, invoices: [] },
        '30': { count: 0, total: 0, invoices: [] },
        '60': { count: 0, total: 0, invoices: [] },
        '90': { count: 0, total: 0, invoices: [] },
        '120plus': { count: 0, total: 0, invoices: [] }
      };

      invoices.forEach(inv => {
        const daysOverdue = today.diff(dayjs(inv.dueDate), 'day');
        const balance = parseFloat(inv.balance || 0);
        const bucket = daysOverdue <= 0 ? 'current' : daysOverdue <= 30 ? '30' : daysOverdue <= 60 ? '60' : daysOverdue <= 90 ? '90' : '120plus';

        agingBuckets[bucket].count += 1;
        agingBuckets[bucket].total += balance;
        agingBuckets[bucket].invoices.push({
          id: inv.id,
          invoiceNo: inv.invoiceNo,
          customer: inv.customer?.companyName,
          amount: balance,
          dueDate: inv.dueDate,
          daysOverdue
        });
      });

      // Previous period for comparison
      const prevInvoices = await db.Invoice.findAll({
        where: {
          status: { [Op.in]: ['draft', 'sent'] },
          createdAt: { [Op.between]: [prevStart, prevEnd] }
        }
      });

      const prevBuckets = {
        current: 0, '30': 0, '60': 0, '90': 0, '120plus': 0
      };
      prevInvoices.forEach(inv => {
        const daysOverdue = dayjs(prevEnd).diff(dayjs(inv.dueDate), 'day');
        const bucket = daysOverdue <= 0 ? 'current' : daysOverdue <= 30 ? '30' : daysOverdue <= 60 ? '60' : daysOverdue <= 90 ? '90' : '120plus';
        prevBuckets[bucket] += parseFloat(inv.balance || 0);
      });

      res.json(getSuccessResponse({
        type: 'ar',
        current: agingBuckets,
        previousPeriod: prevBuckets,
        totals: {
          totalOutstanding: Object.values(agingBuckets).reduce((sum, b) => sum + b.total, 0).toFixed(2),
          overdue30plus: (agingBuckets['30'].total + agingBuckets['60'].total + agingBuckets['90'].total + agingBuckets['120plus'].total).toFixed(2)
        }
      }));
    } else {
      // Accounts Payable aging
      const purchaseOrders = await db.PurchaseOrder.findAll({
        where: { status: { [Op.in]: ['confirmed', 'in_production', 'ready'] } },
        include: [{ model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] }]
      });

      const agingBuckets = {
        current: { count: 0, total: 0, orders: [] },
        '30': { count: 0, total: 0, orders: [] },
        '60': { count: 0, total: 0, orders: [] },
        '90': { count: 0, total: 0, orders: [] },
        '120plus': { count: 0, total: 0, orders: [] }
      };

      purchaseOrders.forEach(po => {
        const daysOverdue = today.diff(dayjs(po.dueDate || po.createdAt), 'day');
        const amount = parseFloat(po.total || 0);
        const bucket = daysOverdue <= 0 ? 'current' : daysOverdue <= 30 ? '30' : daysOverdue <= 60 ? '60' : daysOverdue <= 90 ? '90' : '120plus';

        agingBuckets[bucket].count += 1;
        agingBuckets[bucket].total += amount;
        agingBuckets[bucket].orders.push({
          id: po.id,
          poNo: po.purchaseOrderNo,
          factory: po.factory?.companyName,
          amount,
          dueDate: po.dueDate,
          daysOverdue
        });
      });

      res.json(getSuccessResponse({
        type: 'ap',
        current: agingBuckets,
        totals: {
          totalPayable: Object.values(agingBuckets).reduce((sum, b) => sum + b.total, 0).toFixed(2),
          overdue30plus: (agingBuckets['30'].total + agingBuckets['60'].total + agingBuckets['90'].total + agingBuckets['120plus'].total).toFixed(2)
        }
      }));
    }
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Team Performance Metrics
router.get('/performance', requireAuth, requireRole('sales', 'cmo', 'admin'), async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const salesPeople = await db.User.findAll({
      where: { role: 'sales', isActive: true }
    });

    const performanceData = [];

    for (const person of salesPeople) {
      const orders = await db.SalesOrder.findAll({
        where: {
          createdAt: { [Op.between]: [startDate, endDate] }
        },
        include: [{
          model: db.Quotation,
          as: 'quotation',
          where: { salesPersonId: person.id },
          required: false
        }]
      });

      const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const completedOnTime = orders.filter(o =>
        o.status === 'completed' &&
        dayjs(o.updatedAt).isSameOrBefore(dayjs(o.expectedDeliveryDate))
      ).length;

      const quotations = await db.Quotation.count({ where: { salesPersonId: person.id, createdAt: { [Op.between]: [startDate, endDate] } } });

      const claims = await db.Claim.findAll({
        where: {
          createdAt: { [Op.between]: [startDate, endDate] }
        },
        include: [{
          model: db.SalesOrder,
          as: 'salesOrder',
          include: [{
            model: db.Quotation,
            as: 'quotation',
            where: { salesPersonId: person.id },
            required: false
          }]
        }]
      });

      const satisfactionScore = claims.length > 0
        ? ((totalOrders - claims.filter(c => c.salesOrder?.quotation).length) / totalOrders * 100).toFixed(2)
        : 100;

      performanceData.push({
        personId: person.id,
        personName: person.name,
        email: person.email,
        metrics: {
          totalRevenue: parseFloat(totalRevenue).toFixed(2),
          totalOrders,
          avgOrderValue: parseFloat(avgOrderValue).toFixed(2),
          onTimeCompletionRate: totalOrders > 0 ? ((completedOnTime / totalOrders) * 100).toFixed(2) : 0,
          quotationsGenerated: quotations,
          customerSatisfaction: parseFloat(satisfactionScore)
        }
      });
    }

    res.json(getSuccessResponse({
      period,
      dateRange: { startDate, endDate },
      teamSize: salesPeople.length,
      performance: performanceData.sort((a, b) => parseFloat(b.metrics.totalRevenue) - parseFloat(a.metrics.totalRevenue))
    }));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Logistics and Supply Chain Analytics
router.get('/logistics', requireAuth, requireRole('operations', 'admin'), async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    const shipments = await db.Shipment.findAll({
      where: { createdAt: { [Op.between]: [startDate, endDate] } },
      include: [
        { model: db.SalesOrder, as: 'salesOrder', required: false }
      ]
    });

    const inspections = await db.Inspection.findAll({
      where: { createdAt: { [Op.between]: [startDate, endDate] } },
      include: [{ model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] }]
    });

    // Shipping metrics
    let totalShippingDays = 0;
    let onTimeDeliveries = 0;
    const shippingTimes = [];

    shipments.forEach(s => {
      if (s.shippedDate && s.deliveryDate) {
        const days = dayjs(s.deliveryDate).diff(dayjs(s.shippedDate), 'day');
        totalShippingDays += days;
        shippingTimes.push(days);
        if (s.status === 'delivered' && dayjs(s.deliveryDate).isSameOrBefore(dayjs(s.expectedDeliveryDate))) {
          onTimeDeliveries += 1;
        }
      }
    });

    const avgShippingTime = shippingTimes.length > 0
      ? (shippingTimes.reduce((a, b) => a + b, 0) / shippingTimes.length).toFixed(2)
      : 0;

    const onTimeRate = shipments.length > 0
      ? ((onTimeDeliveries / shipments.length) * 100).toFixed(2)
      : 0;

    // Inspection metrics by factory
    const inspectionsByFactory = {};
    inspections.forEach(insp => {
      const factoryId = insp.factoryId;
      const factoryName = insp.factory?.companyName || `Factory ${factoryId}`;
      if (!inspectionsByFactory[factoryId]) {
        inspectionsByFactory[factoryId] = {
          name: factoryName,
          total: 0,
          passed: 0,
          failed: 0
        };
      }
      inspectionsByFactory[factoryId].total += 1;
      if (insp.overallResult === 'pass') {
        inspectionsByFactory[factoryId].passed += 1;
      } else {
        inspectionsByFactory[factoryId].failed += 1;
      }
    });

    const factoryInspectionStats = Object.keys(inspectionsByFactory).map(factoryId => {
      const stats = inspectionsByFactory[factoryId];
      return {
        ...stats,
        passRate: stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(2) : 0
      };
    });

    // Container utilization (estimated from shipment quantities)
    const containerStats = await db.sequelize.query(`
      SELECT
        s.id,
        COUNT(DISTINCT s.id) as shipments,
        SUM(so.total) as value
      FROM Shipment s
      LEFT JOIN SalesOrder so ON s.sales_order_id = so.id
      WHERE s.created_at BETWEEN ? AND ?
      GROUP BY s.id
    `, {
      replacements: [startDate, endDate],
      type: 'SELECT'
    });

    res.json(getSuccessResponse({
      period,
      dateRange: { startDate, endDate },
      shipping: {
        totalShipments: shipments.length,
        avgShippingTime: parseFloat(avgShippingTime),
        onTimeDeliveryRate: parseFloat(onTimeRate)
      },
      inspections: {
        totalInspections: inspections.length,
        totalPassed: inspections.filter(i => i.overallResult === 'pass').length,
        totalFailed: inspections.filter(i => i.overallResult === 'fail').length,
        byFactory: factoryInspectionStats
      },
      containers: {
        totalShipments: containerStats.length,
        avgValuePerShipment: containerStats.length > 0
          ? (containerStats.reduce((sum, c) => sum + parseFloat(c.value || 0), 0) / containerStats.length).toFixed(2)
          : 0
      }
    }));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Export Report to CSV
router.get('/export/:type', requireAuth, requireRole('finance', 'admin', 'operations', 'sales'), async (req, res, next) => {
  try {
    const { type } = req.params;
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    let data = [];
    let headers = [];
    let filename = '';

    if (type === 'sales') {
      headers = ['Order Number', 'Customer', 'Amount', 'Status', 'Created Date', 'Expected Delivery'];
      filename = `sales-report-${dayjs().format('YYYY-MM-DD')}.csv`;

      const orders = await db.SalesOrder.findAll({
        where: { createdAt: { [Op.between]: [startDate, endDate] } },
        include: [{ model: db.Customer, as: 'customer', attributes: ['companyName'] }]
      });

      data = orders.map(o => [
        o.salesOrderNo,
        o.customer?.companyName || 'N/A',
        o.total,
        o.status,
        dayjs(o.createdAt).format('YYYY-MM-DD'),
        dayjs(o.expectedDeliveryDate).format('YYYY-MM-DD')
      ]);
    } else if (type === 'purchase') {
      headers = ['PO Number', 'Factory', 'Amount', 'Status', 'Created Date'];
      filename = `purchase-report-${dayjs().format('YYYY-MM-DD')}.csv`;

      const orders = await db.PurchaseOrder.findAll({
        where: { createdAt: { [Op.between]: [startDate, endDate] } },
        include: [{ model: db.Factory, as: 'factory', attributes: ['companyName'] }]
      });

      data = orders.map(o => [
        o.purchaseOrderNo,
        o.factory?.companyName || 'N/A',
        o.total,
        o.status,
        dayjs(o.createdAt).format('YYYY-MM-DD')
      ]);
    } else if (type === 'financial') {
      headers = ['Period', 'Revenue', 'Costs', 'Profit', 'Profit Margin %', 'Collections', 'Outstanding'];
      filename = `financial-report-${dayjs().format('YYYY-MM-DD')}.csv`;

      const months = [];
      let current = dayjs(startDate);
      while (current.isSameOrBefore(dayjs(endDate))) {
        const monthStart = current.startOf('month').toDate();
        const monthEnd = current.endOf('month').toDate();
        const revenue = await db.SalesOrder.sum('total', { where: { status: 'completed', createdAt: { [Op.between]: [monthStart, monthEnd] } } }) || 0;
        const costs = await db.PurchaseOrder.sum('total', { where: { status: 'completed', createdAt: { [Op.between]: [monthStart, monthEnd] } } }) || 0;
        const profit = revenue - costs;
        const margin = revenue > 0 ? (profit / revenue * 100).toFixed(2) : 0;
        const collections = await db.Payment.sum('amount', { where: { status: 'confirmed', date: { [Op.between]: [monthStart, monthEnd] } } }) || 0;
        const outstanding = await db.Invoice.sum('balance', { where: { status: { [Op.in]: ['draft', 'sent'] }, createdAt: { [Op.lte]: monthEnd } } }) || 0;

        data.push([
          current.format('YYYY-MM'),
          revenue.toFixed(2),
          costs.toFixed(2),
          profit.toFixed(2),
          margin,
          collections.toFixed(2),
          outstanding.toFixed(2)
        ]);

        current = current.add(1, 'month');
      }
    } else if (type === 'aging') {
      headers = ['Customer/Factory', 'Current', '30+ Days', '60+ Days', '90+ Days', '120+ Days', 'Total Outstanding'];
      filename = `aging-report-${dayjs().format('YYYY-MM-DD')}.csv`;

      const invoices = await db.Invoice.findAll({
        where: { status: { [Op.in]: ['draft', 'sent'] } },
        include: [{ model: db.Customer, as: 'customer' }]
      });

      const today = dayjs();
      const agingData = {};

      invoices.forEach(inv => {
        const customerId = inv.customerId;
        if (!agingData[customerId]) {
          agingData[customerId] = {
            name: inv.customer?.companyName || 'N/A',
            current: 0,
            '30': 0,
            '60': 0,
            '90': 0,
            '120plus': 0
          };
        }
        const daysOverdue = today.diff(dayjs(inv.dueDate), 'day');
        const bucket = daysOverdue <= 0 ? 'current' : daysOverdue <= 30 ? '30' : daysOverdue <= 60 ? '60' : daysOverdue <= 90 ? '90' : '120plus';
        agingData[customerId][bucket] += parseFloat(inv.balance || 0);
      });

      data = Object.keys(agingData).map(key => {
        const a = agingData[key];
        const total = a.current + a['30'] + a['60'] + a['90'] + a['120plus'];
        return [
          a.name,
          a.current.toFixed(2),
          a['30'].toFixed(2),
          a['60'].toFixed(2),
          a['90'].toFixed(2),
          a['120plus'].toFixed(2),
          total.toFixed(2)
        ];
      });
    }

    // Generate CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => {
        const cellStr = String(cell || '');
        return cellStr.includes(',') ? `"${cellStr}"` : cellStr;
      }).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
