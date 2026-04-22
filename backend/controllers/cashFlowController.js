const { Op } = require('sequelize');
const db = require('../models');
const { getSuccessResponse } = require('../utils/helpers');
const { ValidationError } = require('../middleware/errorHandler');
const dayjs = require('dayjs');

/**
 * Calculate cash flow forecast for next N days
 * Based on pending invoices, purchase orders, and payment terms
 */
const getForecast = async (req, res, next) => {
  try {
    const { days = 30, groupBy = 'daily' } = req.query; // daily, weekly, monthly
    const daysNum = parseInt(days);

    if (![30, 60, 90].includes(daysNum)) {
      throw new ValidationError('days must be 30, 60, or 90');
    }

    const today = dayjs().startOf('day');
    const forecastEnd = today.add(daysNum, 'day');

    // Get pending invoices (expected inflows)
    const pendingInvoices = await db.Invoice.findAll({
      where: {
        status: { [Op.in]: ['sent', 'partially_paid', 'overdue'] },
        dueDate: { [Op.between]: [today.toDate(), forecastEnd.toDate()] }
      },
      attributes: ['id', 'dueDate', 'balance', 'status']
    });

    // Get pending purchase orders (expected outflows)
    const pendingPOs = await db.PurchaseOrder.findAll({
      where: {
        status: { [Op.in]: ['confirmed', 'partially_received'] }
      },
      attributes: ['id', 'total', 'paidAmount', 'status', 'expectedDelivery'],
      include: [{ model: db.Factory, as: 'factory', attributes: ['paymentTerms'] }]
    });

    // Calculate expected payment dates for POs based on payment terms
    const poPayments = pendingPOs.map(po => {
      const deliveryDate = po.expectedDelivery ? dayjs(po.expectedDelivery) : today;
      // Parse payment terms (e.g., "Net 30") to get days
      const termMatch = (po.factory?.paymentTerms || 'Net 30').match(/\d+/);
      const termDays = termMatch ? parseInt(termMatch[0]) : 30;
      const paymentDate = deliveryDate.add(termDays, 'day');

      return {
        id: po.id,
        date: paymentDate,
        amount: parseFloat(po.total) - parseFloat(po.paidAmount),
        type: 'outflow',
        description: `PO Payment (Net ${termDays})`
      };
    });

    // Combine inflows and outflows
    const cashFlowItems = [
      ...pendingInvoices.map(inv => ({
        id: inv.id,
        date: dayjs(inv.dueDate),
        amount: parseFloat(inv.balance),
        type: 'inflow',
        description: `Invoice Payment Due`
      })),
      ...poPayments
    ];

    // Group by period
    const forecast = groupCashFlow(cashFlowItems, today, forecastEnd, groupBy);

    res.json(getSuccessResponse({
      period: `${daysNum} days`,
      groupBy,
      startDate: today.format('YYYY-MM-DD'),
      endDate: forecastEnd.format('YYYY-MM-DD'),
      forecast,
      summary: summarizeForecast(forecast)
    }, 'Cash flow forecast retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get aged receivables report
 */
const getAgedReceivables = async (req, res, next) => {
  try {
    const today = dayjs();

    const invoices = await db.Invoice.findAll({
      where: {
        status: { [Op.in]: ['sent', 'partially_paid', 'overdue'] }
      },
      include: [{ model: db.Customer, as: 'customer', attributes: ['id', 'companyName'] }],
      attributes: ['id', 'invoiceNumber', 'dueDate', 'balance', 'customerId', 'createdAt']
    });

    const agedReceivables = {
      current: { count: 0, amount: 0, invoices: [] },
      days_30: { count: 0, amount: 0, invoices: [] },
      days_60: { count: 0, amount: 0, invoices: [] },
      days_90_plus: { count: 0, amount: 0, invoices: [] }
    };

    invoices.forEach(invoice => {
      const daysPastDue = today.diff(dayjs(invoice.dueDate), 'day');
      const balance = parseFloat(invoice.balance);
      const bucket = getAgingBucket(daysPastDue);

      agedReceivables[bucket].count += 1;
      agedReceivables[bucket].amount += balance;
      agedReceivables[bucket].invoices.push({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.customer?.companyName,
        dueDate: invoice.dueDate,
        balance,
        daysPastDue: Math.max(0, daysPastDue)
      });
    });

    const summary = {
      totalReceivables: Object.values(agedReceivables).reduce((sum, bucket) => sum + bucket.amount, 0),
      byBucket: Object.entries(agedReceivables).reduce((acc, [key, val]) => {
        acc[key] = val.amount;
        return acc;
      }, {}),
      percentageByBucket: {}
    };

    const total = summary.totalReceivables;
    if (total > 0) {
      Object.entries(summary.byBucket).forEach(([key, amount]) => {
        summary.percentageByBucket[key] = ((amount / total) * 100).toFixed(2);
      });
    }

    res.json(getSuccessResponse({
      report: agedReceivables,
      summary
    }, 'Aged receivables report retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get aged payables report for factory payments
 */
const getAgedPayables = async (req, res, next) => {
  try {
    const today = dayjs();

    const purchaseOrders = await db.PurchaseOrder.findAll({
      where: {
        status: { [Op.in]: ['confirmed', 'partially_received', 'received'] }
      },
      include: [{ model: db.Factory, as: 'factory', attributes: ['id', 'companyName'] }],
      attributes: ['id', 'poNumber', 'expectedDelivery', 'balance', 'factoryId', 'createdAt', 'total', 'paidAmount']
    });

    const agedPayables = {
      current: { count: 0, amount: 0, orders: [] },
      days_30: { count: 0, amount: 0, orders: [] },
      days_60: { count: 0, amount: 0, orders: [] },
      days_90_plus: { count: 0, amount: 0, orders: [] }
    };

    purchaseOrders.forEach(po => {
      const paymentDueDate = dayjs(po.expectedDelivery).add(30, 'day'); // Assume Net 30 if not specified
      const daysPastDue = today.diff(paymentDueDate, 'day');
      const balance = parseFloat(po.total) - parseFloat(po.paidAmount);
      const bucket = getAgingBucket(daysPastDue);

      agedPayables[bucket].count += 1;
      agedPayables[bucket].amount += balance;
      agedPayables[bucket].orders.push({
        id: po.id,
        poNumber: po.poNumber,
        factory: po.factory?.companyName,
        expectedDelivery: po.expectedDelivery,
        balance,
        daysOutstanding: Math.max(0, daysPastDue)
      });
    });

    const summary = {
      totalPayables: Object.values(agedPayables).reduce((sum, bucket) => sum + bucket.amount, 0),
      byBucket: Object.entries(agedPayables).reduce((acc, [key, val]) => {
        acc[key] = val.amount;
        return acc;
      }, {}),
      percentageByBucket: {}
    };

    const total = summary.totalPayables;
    if (total > 0) {
      Object.entries(summary.byBucket).forEach(([key, amount]) => {
        summary.percentageByBucket[key] = ((amount / total) * 100).toFixed(2);
      });
    }

    res.json(getSuccessResponse({
      report: agedPayables,
      summary
    }, 'Aged payables report retrieved'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get high-level cash flow summary
 */
const getCashFlowSummary = async (req, res, next) => {
  try {
    // Total receivables (outstanding invoices)
    const receivablesResult = await db.Invoice.findAll({
      where: {
        status: { [Op.in]: ['sent', 'partially_paid', 'overdue'] }
      },
      attributes: [
        [db.sequelize.fn('SUM', db.sequelize.col('balance')), 'totalReceivables'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'invoiceCount']
      ],
      raw: true
    });

    // Total payables (outstanding PO payments)
    const payablesResult = await db.PurchaseOrder.findAll({
      where: {
        status: { [Op.in]: ['confirmed', 'partially_received', 'received'] }
      },
      attributes: [
        [db.sequelize.fn('SUM', db.sequelize.literal('(total - paid_amount)')), 'totalPayables'],
        [db.sequelize.fn('COUNT', db.sequelize.col('id')), 'poCount']
      ],
      raw: true
    });

    const totalReceivables = parseFloat(receivablesResult[0]?.totalReceivables || 0);
    const totalPayables = parseFloat(payablesResult[0]?.totalPayables || 0);
    const netCashPosition = totalReceivables - totalPayables;

    res.json(getSuccessResponse({
      totalReceivables: {
        amount: totalReceivables,
        invoiceCount: parseInt(receivablesResult[0]?.invoiceCount || 0)
      },
      totalPayables: {
        amount: totalPayables,
        poCount: parseInt(payablesResult[0]?.poCount || 0)
      },
      netCashPosition: {
        amount: netCashPosition,
        status: netCashPosition > 0 ? 'positive' : netCashPosition < 0 ? 'negative' : 'neutral'
      }
    }, 'Cash flow summary retrieved'));
  } catch (error) {
    next(error);
  }
};

// Helper functions

function getAgingBucket(daysPastDue) {
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return 'days_30';
  if (daysPastDue <= 60) return 'days_60';
  return 'days_90_plus';
}

function groupCashFlow(items, startDate, endDate, groupBy) {
  const grouped = {};
  let currentPeriod = startDate;

  while (currentPeriod.isBefore(endDate)) {
    let periodKey;
    let periodEnd;

    if (groupBy === 'weekly') {
      periodKey = currentPeriod.format('YYYY-[W]ww');
      periodEnd = currentPeriod.add(7, 'day');
    } else if (groupBy === 'monthly') {
      periodKey = currentPeriod.format('YYYY-MM');
      periodEnd = currentPeriod.add(1, 'month');
    } else {
      // daily
      periodKey = currentPeriod.format('YYYY-MM-DD');
      periodEnd = currentPeriod.add(1, 'day');
    }

    if (!grouped[periodKey]) {
      grouped[periodKey] = {
        period: periodKey,
        inflows: 0,
        outflows: 0,
        netFlow: 0,
        transactions: []
      };
    }

    items.forEach(item => {
      if (item.date.isSameOrAfter(currentPeriod) && item.date.isBefore(periodEnd)) {
        grouped[periodKey].transactions.push({
          id: item.id,
          type: item.type,
          amount: item.amount,
          description: item.description,
          date: item.date.format('YYYY-MM-DD')
        });

        if (item.type === 'inflow') {
          grouped[periodKey].inflows += item.amount;
        } else {
          grouped[periodKey].outflows += item.amount;
        }
      }
    });

    grouped[periodKey].netFlow = grouped[periodKey].inflows - grouped[periodKey].outflows;
    currentPeriod = periodEnd;
  }

  return Object.values(grouped);
}

function summarizeForecast(forecast) {
  return {
    totalInflows: forecast.reduce((sum, p) => sum + p.inflows, 0),
    totalOutflows: forecast.reduce((sum, p) => sum + p.outflows, 0),
    netFlow: forecast.reduce((sum, p) => sum + p.netFlow, 0),
    periods: forecast.length
  };
}

module.exports = {
  getForecast,
  getAgedReceivables,
  getAgedPayables,
  getCashFlowSummary
};
