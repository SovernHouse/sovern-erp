export const PO_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  PARTIALLY_SHIPPED: 'partially_shipped',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export const PRODUCTION_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  QUALITY_CHECK: 'quality_check',
  READY_FOR_SHIPMENT: 'ready_for_shipment',
};

export const SHIPMENT_STATUS = {
  PREPARING: 'preparing',
  READY: 'ready',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

export const INSPECTION_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  PASSED: 'passed',
  FAILED: 'failed',
  REWORK_REQUIRED: 'rework_required',
  CANCELLED: 'cancelled',
};

export const DOCUMENT_TYPES = {
  BILL_OF_LADING: 'bill_of_lading',
  CERTIFICATE_OF_ORIGIN: 'certificate_of_origin',
  COMMERCIAL_INVOICE: 'commercial_invoice',
  PACKING_LIST: 'packing_list',
  INSURANCE_CERTIFICATE: 'insurance_certificate',
  CUSTOMS_DECLARATION: 'customs_declaration',
  FUMIGATION_CERTIFICATE: 'fumigation_certificate',
  QUALITY_INSPECTION_REPORT: 'quality_inspection_report',
  PRODUCT_SPECIFICATION: 'product_specification',
  OTHER: 'other',
};

export const DOCUMENT_LABELS = {
  bill_of_lading: 'Bill of Lading',
  certificate_of_origin: 'Certificate of Origin',
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  insurance_certificate: 'Insurance Certificate',
  customs_declaration: 'Customs Declaration',
  fumigation_certificate: 'Fumigation Certificate',
  quality_inspection_report: 'Quality Inspection Report',
  product_specification: 'Product Specification',
  other: 'Other Document',
};

export const PRODUCT_GRADES = ['Grade A', 'Grade B', 'Grade C', 'Premium', 'Standard'];

export const MATERIAL_TYPES = [
  'Laminate',
  'Vinyl',
  'Tile',
  'Wood',
  'Cork',
  'Bamboo',
  'Stone',
];

export const FINISHES = ['Glossy', 'Matte', 'Textured', 'Embossed', 'Hand-scraped'];

export const COLORS = [
  'Natural',
  'Honey',
  'Oak',
  'Walnut',
  'Cherry',
  'Espresso',
  'Grey',
  'Beige',
  'White',
  'Black',
];

export const INSPECTION_CHECKLIST = [
  { id: 1, label: 'Surface Quality Inspection', category: 'Quality' },
  { id: 2, label: 'Dimension Verification', category: 'Specification' },
  { id: 3, label: 'Color Match Verification', category: 'Quality' },
  { id: 4, label: 'Packaging Inspection', category: 'Packaging' },
  { id: 5, label: 'Documentation Review', category: 'Documents' },
  { id: 6, label: 'Sample Testing', category: 'Testing' },
  { id: 7, label: 'Quantity Verification', category: 'Quantity' },
  { id: 8, label: 'Defect Analysis', category: 'Quality' },
];

export const NOTIFICATION_TYPES = {
  PO_CREATED: 'po_created',
  PO_CONFIRMED: 'po_confirmed',
  PO_REJECTED: 'po_rejected',
  PRODUCTION_STARTED: 'production_started',
  PRODUCTION_COMPLETED: 'production_completed',
  SHIPMENT_CREATED: 'shipment_created',
  SHIPMENT_SHIPPED: 'shipment_shipped',
  INSPECTION_SCHEDULED: 'inspection_scheduled',
  INSPECTION_COMPLETED: 'inspection_completed',
  PRICE_UPDATED: 'price_updated',
  DOCUMENT_REQUIRED: 'document_required',
};

export const PRICE_UPDATE_FREQUENCY = [
  { value: 'one_time', label: 'One-time Update' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

export const PAGINATION_SIZES = [10, 25, 50, 100];

export const DATE_FORMATS = {
  SHORT: 'MMM dd, yyyy',
  LONG: 'MMMM dd, yyyy',
  FULL: 'EEEE, MMMM dd, yyyy',
  TIME: 'HH:mm:ss',
  DATE_TIME: 'MMM dd, yyyy HH:mm',
};
