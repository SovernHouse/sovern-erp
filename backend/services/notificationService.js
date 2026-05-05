const db = require('../models');
const logger = require('../utils/logger.js');

let io = null;

const setIO = (socketIO) => {
  io = socketIO;
};

const createNotification = async (userId, type, title, message, data = {}, link = null) => {
  try {
    const notification = await db.Notification.create({
      userId,
      type,
      title,
      message,
      data,
      link,
      isRead: false
    });

    if (process.env.ENABLE_SOCKET_IO === 'true' && io) {
      io.to(`user-${userId}`).emit('notification', {
        id: notification.id,
        type,
        title,
        message,
        data,
        link,
        createdAt: notification.createdAt
      });
    }

    return notification;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
};

const createInquiryNotification = async (inquiry, action = 'created') => {
  const messages = {
    created: `New inquiry INQ-${inquiry.inquiryNumber} received`,
    updated: `Inquiry INQ-${inquiry.inquiryNumber} has been updated`,
    status_changed: `Inquiry INQ-${inquiry.inquiryNumber} status changed to ${inquiry.status}`
  };

  return createNotification(
    inquiry.salesPersonId,
    'inquiry',
    'New Inquiry',
    messages[action],
    { inquiryId: inquiry.id },
    `/inquiries/${inquiry.id}`
  );
};

const createQuotationNotification = async (quotation, customerId, action = 'created') => {
  const messages = {
    created: `Quotation QOT-${quotation.quotationNumber} has been created`,
    sent: `Your quotation QOT-${quotation.quotationNumber} has been sent`,
    accepted: `Quotation QOT-${quotation.quotationNumber} has been accepted`,
    rejected: `Quotation QOT-${quotation.quotationNumber} has been rejected`
  };

  return createNotification(
    customerId,
    'quotation',
    'Quotation Update',
    messages[action],
    { quotationId: quotation.id },
    `/quotations/${quotation.id}`
  );
};

const createProformaInvoiceNotification = async (pi, customerId, action = 'created') => {
  const messages = {
    created: `Proforma Invoice PI-${pi.piNumber} has been created`,
    sent: `Your Proforma Invoice PI-${pi.piNumber} has been sent`,
    confirmed: `Proforma Invoice PI-${pi.piNumber} has been confirmed`
  };

  return createNotification(
    customerId,
    'quotation',
    'Proforma Invoice Update',
    messages[action],
    { piId: pi.id },
    `/proforma-invoices/${pi.id}`
  );
};

const createSalesOrderNotification = async (salesOrder, userId, action = 'created') => {
  const messages = {
    created: `Sales Order SO-${salesOrder.orderNumber} has been created`,
    confirmed: `Sales Order SO-${salesOrder.orderNumber} has been confirmed`,
    shipped: `Sales Order SO-${salesOrder.orderNumber} has been shipped`,
    delivered: `Sales Order SO-${salesOrder.orderNumber} has been delivered`
  };

  return createNotification(
    userId,
    'order',
    'Sales Order Update',
    messages[action],
    { salesOrderId: salesOrder.id },
    `/sales-orders/${salesOrder.id}`
  );
};

const createShipmentNotification = async (shipment, customerId, action = 'created') => {
  const messages = {
    created: `Shipment SHP-${shipment.shipmentNumber} has been created`,
    loaded: `Shipment SHP-${shipment.shipmentNumber} has been loaded`,
    in_transit: `Shipment SHP-${shipment.shipmentNumber} is in transit`,
    delivered: `Shipment SHP-${shipment.shipmentNumber} has been delivered`
  };

  return createNotification(
    customerId,
    'shipment',
    'Shipment Update',
    messages[action],
    { shipmentId: shipment.id },
    `/shipments/${shipment.id}`
  );
};

const createInspectionNotification = async (inspection, userId, action = 'created') => {
  const messages = {
    created: `Inspection INSP-${inspection.inspectionNumber} has been scheduled`,
    completed: `Inspection INSP-${inspection.inspectionNumber} has been completed`,
    passed: `Inspection INSP-${inspection.inspectionNumber} has passed`,
    failed: `Inspection INSP-${inspection.inspectionNumber} has failed`
  };

  return createNotification(
    userId,
    'inspection',
    'Inspection Update',
    messages[action],
    { inspectionId: inspection.id },
    `/inspections/${inspection.id}`
  );
};

const createClaimNotification = async (claim, userId, action = 'created') => {
  const messages = {
    created: `Claim CLM-${claim.claimNumber} has been submitted`,
    updated: `Claim CLM-${claim.claimNumber} status changed to ${claim.status}`,
    resolved: `Claim CLM-${claim.claimNumber} has been resolved`
  };

  return createNotification(
    userId,
    'claim',
    'Claim Update',
    messages[action],
    { claimId: claim.id },
    `/claims/${claim.id}`
  );
};

const createPaymentNotification = async (invoice, userId, action = 'created') => {
  const messages = {
    created: `Payment recorded for invoice INV-${invoice.invoiceNumber}`,
    pending: `Payment pending for invoice INV-${invoice.invoiceNumber}`,
    confirmed: `Payment confirmed for invoice INV-${invoice.invoiceNumber}`
  };

  return createNotification(
    userId,
    'payment',
    'Payment Update',
    messages[action],
    { invoiceId: invoice.id },
    `/invoices/${invoice.id}`
  );
};

const getNotifications = async (userId, limit = 20, offset = 0) => {
  try {
    const { count, rows } = await db.Notification.findAndCountAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    return { count, notifications: rows };
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    throw error;
  }
};

const markNotificationAsRead = async (notificationId) => {
  try {
    const notification = await db.Notification.findByPk(notificationId);
    if (notification) {
      await notification.update({ isRead: true });
      return notification;
    }
    return null;
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error;
  }
};

const markAllNotificationsAsRead = async (userId) => {
  try {
    await db.Notification.update(
      { isRead: true },
      { where: { userId, isRead: false } }
    );
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    throw error;
  }
};

const getUnreadCount = async (userId) => {
  try {
    return await db.Notification.count({
      where: { userId, isRead: false }
    });
  } catch (error) {
    logger.error('Error getting unread count:', error);
    throw error;
  }
};

// Real-time event emitters for WebSocket communication
const emitOrderStatusChange = async (orderId, newStatus, customerId, salesPersonId) => {
  if (!io || process.env.ENABLE_SOCKET_IO !== 'true') return;

  try {
    const eventPayload = {
      orderId,
      status: newStatus,
      timestamp: new Date()
    };

    // Emit to customer
    io.to(`user-${customerId}`).emit('order:statusChanged', eventPayload);

    // Emit to salesperson if different
    if (salesPersonId && salesPersonId !== customerId) {
      io.to(`user-${salesPersonId}`).emit('order:statusChanged', eventPayload);
    }
  } catch (error) {
    logger.error('Error emitting order status change:', error);
  }
};

const emitShipmentUpdate = async (shipmentId, status, trackingInfo, customerId) => {
  if (!io || process.env.ENABLE_SOCKET_IO !== 'true') return;

  try {
    const eventPayload = {
      shipmentId,
      status,
      trackingInfo,
      timestamp: new Date()
    };

    io.to(`user-${customerId}`).emit('shipment:updated', eventPayload);
  } catch (error) {
    logger.error('Error emitting shipment update:', error);
  }
};

const emitPaymentReceived = async (invoiceId, amount, customerId, adminIds = []) => {
  if (!io || process.env.ENABLE_SOCKET_IO !== 'true') return;

  try {
    const eventPayload = {
      invoiceId,
      amount,
      timestamp: new Date()
    };

    // Emit to customer
    io.to(`user-${customerId}`).emit('payment:received', eventPayload);

    // Emit to admins
    for (const adminId of adminIds) {
      io.to(`user-${adminId}`).emit('payment:received', eventPayload);
    }
  } catch (error) {
    logger.error('Error emitting payment received:', error);
  }
};

const emitPurchaseOrderUpdate = async (poId, status, factoryUserId) => {
  if (!io || process.env.ENABLE_SOCKET_IO !== 'true') return;

  try {
    const eventPayload = {
      poId,
      status,
      timestamp: new Date()
    };

    io.to(`user-${factoryUserId}`).emit('purchaseOrder:updated', eventPayload);
  } catch (error) {
    logger.error('Error emitting purchase order update:', error);
  }
};

const emitInspectionScheduled = async (inspectionId, factoryUserId, date) => {
  if (!io || process.env.ENABLE_SOCKET_IO !== 'true') return;

  try {
    const eventPayload = {
      inspectionId,
      scheduledDate: date,
      timestamp: new Date()
    };

    io.to(`user-${factoryUserId}`).emit('inspection:scheduled', eventPayload);
  } catch (error) {
    logger.error('Error emitting inspection scheduled:', error);
  }
};

const emitNewInquiry = async (inquiryId, salesPersonId) => {
  if (!io || process.env.ENABLE_SOCKET_IO !== 'true') return;

  try {
    const eventPayload = {
      inquiryId,
      timestamp: new Date()
    };

    io.to(`user-${salesPersonId}`).emit('inquiry:new', eventPayload);
  } catch (error) {
    logger.error('Error emitting new inquiry:', error);
  }
};

const emitDocumentUploaded = async (documentId, relatedUsers = []) => {
  if (!io || process.env.ENABLE_SOCKET_IO !== 'true') return;

  try {
    const eventPayload = {
      documentId,
      timestamp: new Date()
    };

    for (const userId of relatedUsers) {
      io.to(`user-${userId}`).emit('document:uploaded', eventPayload);
    }
  } catch (error) {
    logger.error('Error emitting document uploaded:', error);
  }
};

const emitDashboardRefresh = async (role) => {
  if (!io || process.env.ENABLE_SOCKET_IO !== 'true') return;

  try {
    const eventPayload = {
      role,
      timestamp: new Date()
    };

    io.to(`role-${role}`).emit('dashboard:refresh', eventPayload);
  } catch (error) {
    logger.error('Error emitting dashboard refresh:', error);
  }
};

module.exports = {
  setIO,
  createNotification,
  createInquiryNotification,
  createQuotationNotification,
  createProformaInvoiceNotification,
  createSalesOrderNotification,
  createShipmentNotification,
  createInspectionNotification,
  createClaimNotification,
  createPaymentNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
  // Real-time event emitters
  emitOrderStatusChange,
  emitShipmentUpdate,
  emitPaymentReceived,
  emitPurchaseOrderUpdate,
  emitInspectionScheduled,
  emitNewInquiry,
  emitDocumentUploaded,
  emitDashboardRefresh
};
