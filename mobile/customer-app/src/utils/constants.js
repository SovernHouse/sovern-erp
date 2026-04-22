export const API_BASE_URL = 'https://api.tradingerp.com/api';
export const SOCKET_URL = 'https://api.tradingerp.com';

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PRODUCTION: 'production',
  QUALITY_CHECK: 'quality_check',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in_transit',
  CUSTOMS: 'customs',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const SHIPMENT_STATUS = {
  PENDING: 'pending',
  PICKUP: 'pickup',
  IN_TRANSIT: 'in_transit',
  PORT: 'port',
  CUSTOMS: 'customs',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
};

export const CLAIM_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
};

export const CLAIM_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

export const QUOTATION_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

export const ORDER_TRACKER_STAGES = [
  { key: 'confirmed', label: 'Order Confirmed' },
  { key: 'production', label: 'In Production' },
  { key: 'quality_check', label: 'Quality Check' },
  { key: 'ready_to_ship', label: 'Ready to Ship' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'customs', label: 'Customs' },
  { key: 'delivered', label: 'Delivered' },
];

export const STORAGE_KEYS = {
  USER_TOKEN: 'userToken',
  USER_DATA: 'userData',
  COMPANY_DATA: 'companyData',
  NOTIFICATION_PREFERENCES: 'notificationPreferences',
};
