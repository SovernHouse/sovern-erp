export const PO_STATUS = {
  DRAFT: 'draft',
  CONFIRMED: 'confirmed',
  IN_PRODUCTION: 'in_production',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

export const PRODUCTION_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  QUALITY_CHECK: 'quality_check',
};

export const SHIPMENT_STATUS = {
  PENDING: 'pending',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  DELAYED: 'delayed',
  CANCELLED: 'cancelled',
};

export const INSPECTION_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PASSED: 'passed',
};

export const DOCUMENT_TYPES = [
  { id: 'bill_of_lading', label: 'Bill of Lading', icon: 'file-text' },
  { id: 'certificate_of_origin', label: 'Certificate of Origin', icon: 'award' },
  { id: 'commercial_invoice', label: 'Commercial Invoice', icon: 'file-text' },
  { id: 'insurance_certificate', label: 'Insurance Certificate', icon: 'shield' },
  { id: 'packing_list', label: 'Packing List', icon: 'list' },
  { id: 'fumigation_certificate', label: 'Fumigation Certificate', icon: 'check-circle' },
  { id: 'customs_declaration', label: 'Customs Declaration', icon: 'file-text' },
  { id: 'other', label: 'Other', icon: 'file' },
];

export const API_BASE_URL = 'https://api.trading-erp.com';
export const API_TIMEOUT = 30000;

export const COLORS_STATUS = {
  [PO_STATUS.DRAFT]: '#F59E0B',
  [PO_STATUS.CONFIRMED]: '#3B82F6',
  [PO_STATUS.IN_PRODUCTION]: '#60A5FA',
  [PO_STATUS.READY_TO_SHIP]: '#34D399',
  [PO_STATUS.SHIPPED]: '#10B981',
  [PO_STATUS.DELIVERED]: '#059669',
  [PO_STATUS.CANCELLED]: '#6B7280',
  [PO_STATUS.REJECTED]: '#EF4444',
};

export const LABEL_STATUS = {
  [PO_STATUS.DRAFT]: 'Draft',
  [PO_STATUS.CONFIRMED]: 'Confirmed',
  [PO_STATUS.IN_PRODUCTION]: 'In Production',
  [PO_STATUS.READY_TO_SHIP]: 'Ready to Ship',
  [PO_STATUS.SHIPPED]: 'Shipped',
  [PO_STATUS.DELIVERED]: 'Delivered',
  [PO_STATUS.CANCELLED]: 'Cancelled',
  [PO_STATUS.REJECTED]: 'Rejected',
};
