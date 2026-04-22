export const ORDER_STATUSES = {
  CONFIRMED: 'Confirmed',
  IN_PRODUCTION: 'In Production',
  READY: 'Ready',
  SHIPPED: 'Shipped',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export const ORDER_STATUS_COLORS = {
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-300',
  IN_PRODUCTION: 'bg-purple-100 text-purple-800 border-purple-300',
  READY: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  SHIPPED: 'bg-orange-100 text-orange-800 border-orange-300',
  IN_TRANSIT: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  DELIVERED: 'bg-green-100 text-green-800 border-green-300',
  CANCELLED: 'bg-red-100 text-red-800 border-red-300',
}

export const ORDER_STATUS_ICONS = {
  CONFIRMED: 'CheckCircle',
  IN_PRODUCTION: 'Wrench',
  READY: 'Package',
  SHIPPED: 'Truck',
  IN_TRANSIT: 'Ship',
  DELIVERED: 'Home',
  CANCELLED: 'XCircle',
}

export const QUOTATION_STATUSES = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  REVISION_REQUESTED: 'Revision Requested',
}

export const QUOTATION_STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  ACCEPTED: 'bg-green-100 text-green-800 border-green-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-300',
  EXPIRED: 'bg-gray-100 text-gray-800 border-gray-300',
  REVISION_REQUESTED: 'bg-orange-100 text-orange-800 border-orange-300',
}

export const CLAIM_STATUSES = {
  SUBMITTED: 'Submitted',
  ACKNOWLEDGED: 'Acknowledged',
  UNDER_INVESTIGATION: 'Under Investigation',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  PENDING_INFO: 'Pending Information',
}

export const CLAIM_STATUS_COLORS = {
  SUBMITTED: 'bg-blue-100 text-blue-800 border-blue-300',
  ACKNOWLEDGED: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  UNDER_INVESTIGATION: 'bg-orange-100 text-orange-800 border-orange-300',
  RESOLVED: 'bg-green-100 text-green-800 border-green-300',
  REJECTED: 'bg-red-100 text-red-800 border-red-300',
  PENDING_INFO: 'bg-yellow-100 text-yellow-800 border-yellow-300',
}

export const CLAIM_TYPES = [
  'Product Damage',
  'Wrong Product',
  'Quantity Mismatch',
  'Delivery Delay',
  'Quality Issue',
  'Other',
]

export const CLAIM_PRIORITIES = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

export const PRODUCT_CATEGORIES = [
  'Laminate Flooring',
  'Vinyl Flooring',
  'Hardwood Flooring',
  'Engineered Wood',
  'Tile & Stone',
  'Accessories',
]

export const SHIPMENT_EVENTS = {
  ORDER_CONFIRMED: 'Order Confirmed',
  PRODUCTION_STARTED: 'Production Started',
  QUALITY_CHECK: 'Quality Check',
  PACKAGING: 'Packaging',
  WAREHOUSE_DISPATCH: 'Dispatched from Warehouse',
  CUSTOMS_CLEARED: 'Customs Cleared',
  IN_TRANSIT: 'In Transit',
  PORT_ARRIVAL: 'Arrived at Port',
  FINAL_DELIVERY: 'Final Delivery',
  DELIVERED: 'Delivered',
}

export const PORTS = {
  SHANGHAI: { name: 'Shanghai', country: 'China', code: 'SHA', lat: 31.23, lng: 121.47 },
  SINGAPORE: { name: 'Singapore', country: 'Singapore', code: 'SIN', lat: 1.27, lng: 103.85 },
  HONG_KONG: { name: 'Hong Kong', country: 'Hong Kong', code: 'HKG', lat: 22.30, lng: 114.17 },
  DUBAI: { name: 'Dubai', country: 'UAE', code: 'DXB', lat: 25.27, lng: 55.36 },
  ROTTERDAM: { name: 'Rotterdam', country: 'Netherlands', code: 'RTM', lat: 51.92, lng: 4.16 },
  LOS_ANGELES: { name: 'Los Angeles', country: 'USA', code: 'LAX', lat: 33.74, lng: -118.21 },
  NEW_YORK: { name: 'New York', country: 'USA', code: 'JFK', lat: 40.64, lng: -74.01 },
}

export const PRODUCT_SPECS = [
  'Thickness',
  'Width',
  'Length',
  'Material',
  'Finish',
  'Color',
  'Pattern',
  'Grade',
  'Wear Layer',
  'AC Rating',
  'Warranty',
]

export const PAYMENT_STATUSES = {
  PENDING: 'Pending',
  PARTIAL: 'Partial',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
}

export const PAYMENT_STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PARTIAL: 'bg-orange-100 text-orange-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
}
