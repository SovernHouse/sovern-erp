// Status constants
export const INQUIRY_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PENDING_RESPONSE: 'pending_response',
  RESPONDED: 'responded',
  CONVERTED: 'converted',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
}

export const QUOTATION_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONVERTED: 'converted',
  EXPIRED: 'expired',
}

export const PROFORMA_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  CONVERTED: 'converted',
  CANCELLED: 'cancelled',
}

export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PRODUCTION: 'in_production',
  READY_FOR_SHIPMENT: 'ready_for_shipment',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  HOLD: 'hold',
}

export const SHIPMENT_STATUS = {
  PENDING: 'pending',
  BOOKED: 'booked',
  IN_TRANSIT: 'in_transit',
  IN_PORT: 'in_port',
  CUSTOMS_CLEARANCE: 'customs_clearance',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
}

export const INVOICE_STATUS = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  OVERDUE: 'overdue',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  CANCELLED: 'cancelled',
}

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
}

export const CLAIM_STATUS = {
  OPEN: 'open',
  UNDER_INVESTIGATION: 'under_investigation',
  RESOLVED: 'resolved',
  PENDING_APPROVAL: 'pending_approval',
  CLOSED: 'closed',
  REJECTED: 'rejected',
}

export const INSPECTION_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  APPROVED: 'approved',
  FAILED: 'failed',
  PENDING_REVIEW: 'pending_review',
}

export const CUSTOMER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PROSPECT: 'prospect',
  BLACKLISTED: 'blacklisted',
}

export const FACTORY_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  UNDER_AUDIT: 'under_audit',
  SUSPENDED: 'suspended',
}

export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  SALES: 'sales',
  OPERATIONS: 'operations',
  FINANCE: 'finance',
  WAREHOUSE: 'warehouse',
  QUALITY: 'quality',
  VIEWER: 'viewer',
}

export const PAYMENT_TERMS = [
  'Prepayment',
  '30 Days',
  '60 Days',
  '90 Days',
  'Custom',
]

export const INCOTERMS = [
  'EXW',
  'FOB',
  'CIF',
  'CIP',
  'DAP',
  'DDP',
  'FCA',
  'CPT',
]

export const COUNTRIES = [
  'China',
  'Vietnam',
  'India',
  'Indonesia',
  'Malaysia',
  'Thailand',
  'USA',
  'Canada',
  'UK',
  'Germany',
  'France',
  'Australia',
  'Brazil',
  'Mexico',
  'UAE',
]

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CNY', 'INR', 'SGD', 'MYR']

export const STATUS_COLOR_MAP = {
  // Inquiry
  draft: 'gray',
  sent: 'blue',
  pending_response: 'yellow',
  responded: 'green',
  converted: 'purple',
  expired: 'red',
  cancelled: 'gray',

  // Order
  pending: 'yellow',
  confirmed: 'blue',
  in_production: 'orange',
  ready_for_shipment: 'purple',
  shipped: 'cyan',
  in_transit: 'indigo',
  delivered: 'green',
  completed: 'green',
  hold: 'red',

  // Shipment
  booked: 'blue',
  in_port: 'orange',
  customs_clearance: 'yellow',

  // Payment
  unpaid: 'red',
  partially_paid: 'yellow',
  paid: 'green',

  // General
  active: 'green',
  inactive: 'gray',
  suspended: 'red',
  prospect: 'blue',
  blacklisted: 'red',

  // Inspection
  scheduled: 'blue',
  in_progress: 'yellow',
  approved: 'green',
  failed: 'red',
  pending_review: 'orange',

  // Claims
  open: 'red',
  under_investigation: 'yellow',
  resolved: 'green',
  pending_approval: 'blue',
  closed: 'gray',
  rejected: 'red',
}

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
