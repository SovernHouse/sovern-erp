# Trading ERP System - Database Schema

Complete database schema documentation for the Trading ERP System.

**Database**: PostgreSQL 15+
**ORM**: Sequelize or TypeORM

---

## Table of Contents

1. [User & Access Management](#user--access-management)
2. [Customer Management](#customer-management)
3. [Inquiry Management](#inquiry-management)
4. [Quotation Management](#quotation-management)
5. [Proforma Invoice](#proforma-invoice)
6. [Sales Order](#sales-order)
7. [Purchase Order](#purchase-order)
8. [Packing Management](#packing-management)
9. [Shipping & Logistics](#shipping--logistics)
10. [Documents](#documents)
11. [Invoice & Payment](#invoice--payment)
12. [Inspection & QC](#inspection--qc)
13. [Claims](#claims)
14. [Inventory](#inventory)
15. [Financial](#financial)
16. [ER Diagram](#er-diagram)

---

## User & Access Management

### users
Primary user table for authentication and authorization.

```sql
CREATE TABLE users (
  id VARCHAR(32) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  role_id VARCHAR(32) NOT NULL,
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret VARCHAR(255),
  password_reset_token VARCHAR(255),
  password_reset_expires_at TIMESTAMP NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_status ON users(status);
```

**Fields**:
- `id` - Unique user identifier (UUID/VARCHAR32)
- `email` - User email (unique)
- `password_hash` - Bcrypt hashed password
- `first_name`, `last_name` - User name
- `phone` - Contact phone number
- `role_id` - Reference to role
- `status` - Account status
- `last_login_at` - Timestamp of last login
- `login_attempts` - Failed login counter (for lockout)
- `locked_until` - Account lock expiration
- `two_factor_enabled` - 2FA status
- `email_verified` - Email verification status

---

### roles
User roles for RBAC.

```sql
CREATE TABLE roles (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  level INT NOT NULL DEFAULT 0,
  is_system_role BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Predefined Roles**:
- admin (level 100)
- sales_manager (level 80)
- operations_manager (level 60)
- finance_manager (level 50)
- inspector (level 40)
- customer (level 20)
- factory (level 20)

---

### permissions
System permissions.

```sql
CREATE TABLE permissions (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_system_permission BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### role_permissions
Junction table for role-permission mapping.

```sql
CREATE TABLE role_permissions (
  id VARCHAR(32) PRIMARY KEY,
  role_id VARCHAR(32) NOT NULL,
  permission_id VARCHAR(32) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);
```

---

### audit_logs
Activity logging for compliance.

```sql
CREATE TABLE audit_logs (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(32),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(32),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_logs_user_id (user_id),
  INDEX idx_audit_logs_entity (entity_type, entity_id),
  INDEX idx_audit_logs_created_at (created_at)
);
```

---

## Customer Management

### customers
Customer records.

```sql
CREATE TABLE customers (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  fax VARCHAR(20),
  website VARCHAR(255),
  business_type VARCHAR(100),
  industry VARCHAR(100),
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  status ENUM('active', 'inactive', 'suspended', 'prospect') DEFAULT 'active',
  payment_terms VARCHAR(100),
  credit_limit DECIMAL(18,2),
  tax_id VARCHAR(50),
  registration_number VARCHAR(100),
  notes TEXT,
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_customers_status (status),
  INDEX idx_customers_country (country)
);
```

---

### customer_contacts
Contact persons at customer organizations.

```sql
CREATE TABLE customer_contacts (
  id VARCHAR(32) PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  mobile VARCHAR(20),
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  INDEX idx_customer_contacts_customer_id (customer_id)
);
```

---

### customer_activities
Activity logging for customer interactions.

```sql
CREATE TABLE customer_activities (
  id VARCHAR(32) PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL,
  activity_type ENUM('call', 'email', 'meeting', 'note', 'proposal') NOT NULL,
  subject VARCHAR(255),
  description TEXT,
  assigned_to_id VARCHAR(32),
  scheduled_for TIMESTAMP,
  completed_at TIMESTAMP,
  status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_customer_activities_customer_id (customer_id),
  INDEX idx_customer_activities_status (status)
);
```

---

## Inquiry Management

### inquiries
Customer product inquiries.

```sql
CREATE TABLE inquiries (
  id VARCHAR(32) PRIMARY KEY,
  inquiry_no VARCHAR(50) UNIQUE NOT NULL,
  customer_id VARCHAR(32) NOT NULL,
  product_category VARCHAR(100),
  product_description TEXT,
  quantity DECIMAL(18,4) NOT NULL,
  unit VARCHAR(50),
  specifications TEXT,
  required_delivery_date DATE,
  status ENUM('pending', 'converted', 'rejected', 'expired') DEFAULT 'pending',
  assigned_to_id VARCHAR(32),
  notes TEXT,
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_inquiries_customer_id (customer_id),
  INDEX idx_inquiries_status (status),
  INDEX idx_inquiries_created_at (created_at)
);
```

---

### inquiry_attachments
File attachments for inquiries.

```sql
CREATE TABLE inquiry_attachments (
  id VARCHAR(32) PRIMARY KEY,
  inquiry_id VARCHAR(32) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## Quotation Management

### quotations
Quotation records.

```sql
CREATE TABLE quotations (
  id VARCHAR(32) PRIMARY KEY,
  quotation_no VARCHAR(50) UNIQUE NOT NULL,
  inquiry_id VARCHAR(32),
  customer_id VARCHAR(32) NOT NULL,
  status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired') DEFAULT 'draft',
  valid_until DATE NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  payment_terms VARCHAR(255),
  delivery_terms VARCHAR(255),
  notes TEXT,
  revision_no INT DEFAULT 1,
  sent_at TIMESTAMP NULL,
  accepted_at TIMESTAMP NULL,
  accepted_by_id VARCHAR(32),
  rejected_at TIMESTAMP NULL,
  rejection_reason VARCHAR(500),
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inquiry_id) REFERENCES inquiries(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (accepted_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_quotations_customer_id (customer_id),
  INDEX idx_quotations_status (status)
);
```

---

### quotation_items
Line items for quotations.

```sql
CREATE TABLE quotation_items (
  id VARCHAR(32) PRIMARY KEY,
  quotation_id VARCHAR(32) NOT NULL,
  product_id VARCHAR(32),
  product_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  unit VARCHAR(50),
  unit_price DECIMAL(18,4) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(18,2),
  total_amount DECIMAL(18,2) NOT NULL,
  line_no INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  INDEX idx_quotation_items_quotation_id (quotation_id)
);
```

---

### quotation_revisions
Version history for quotations.

```sql
CREATE TABLE quotation_revisions (
  id VARCHAR(32) PRIMARY KEY,
  quotation_id VARCHAR(32) NOT NULL,
  revision_no INT NOT NULL,
  changes_summary TEXT,
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(quotation_id, revision_no)
);
```

---

## Proforma Invoice

### proforma_invoices
Proforma invoices.

```sql
CREATE TABLE proforma_invoices (
  id VARCHAR(32) PRIMARY KEY,
  pi_no VARCHAR(50) UNIQUE NOT NULL,
  quotation_id VARCHAR(32) NOT NULL,
  customer_id VARCHAR(32) NOT NULL,
  status ENUM('draft', 'sent', 'confirmed', 'converted') DEFAULT 'draft',
  pi_date DATE NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  bank_name VARCHAR(255),
  bank_account_no VARCHAR(50),
  bank_swift_code VARCHAR(20),
  bank_iban VARCHAR(50),
  bank_address TEXT,
  payment_terms VARCHAR(255),
  notes TEXT,
  sent_at TIMESTAMP NULL,
  confirmed_at TIMESTAMP NULL,
  confirmed_by_id VARCHAR(32),
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmed_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_proforma_invoices_customer_id (customer_id),
  INDEX idx_proforma_invoices_status (status)
);
```

---

## Sales Order

### sales_orders
Sales orders.

```sql
CREATE TABLE sales_orders (
  id VARCHAR(32) PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL,
  proforma_invoice_id VARCHAR(32),
  customer_id VARCHAR(32) NOT NULL,
  status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  order_date DATE NOT NULL,
  delivery_date DATE,
  delivery_address VARCHAR(500),
  special_instructions TEXT,
  currency VARCHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  confirmed_at TIMESTAMP NULL,
  confirmed_by_id VARCHAR(32),
  shipped_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proforma_invoice_id) REFERENCES proforma_invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmed_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_sales_orders_customer_id (customer_id),
  INDEX idx_sales_orders_status (status),
  INDEX idx_sales_orders_order_date (order_date)
);
```

---

### sales_order_items
Line items for sales orders.

```sql
CREATE TABLE sales_order_items (
  id VARCHAR(32) PRIMARY KEY,
  sales_order_id VARCHAR(32) NOT NULL,
  product_id VARCHAR(32),
  product_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  quantity_delivered DECIMAL(18,4) DEFAULT 0,
  unit VARCHAR(50),
  unit_price DECIMAL(18,4) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(18,2),
  total_amount DECIMAL(18,2) NOT NULL,
  line_no INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  INDEX idx_sales_order_items_sales_order_id (sales_order_id)
);
```

---

### order_deliveries
Delivery tracking for sales orders.

```sql
CREATE TABLE order_deliveries (
  id VARCHAR(32) PRIMARY KEY,
  sales_order_id VARCHAR(32) NOT NULL,
  delivery_date DATE,
  quantity_delivered DECIMAL(18,4),
  reference_no VARCHAR(100),
  notes TEXT,
  recorded_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by_id) REFERENCES users(id) ON DELETE SET NULL
);
```

---

## Purchase Order

### purchase_orders
Purchase orders to suppliers/factories.

```sql
CREATE TABLE purchase_orders (
  id VARCHAR(32) PRIMARY KEY,
  po_no VARCHAR(50) UNIQUE NOT NULL,
  sales_order_id VARCHAR(32),
  factory_id VARCHAR(32) NOT NULL,
  status ENUM('draft', 'sent', 'confirmed', 'in_production', 'ready_for_shipment', 'shipped', 'cancelled') DEFAULT 'draft',
  po_date DATE NOT NULL,
  required_delivery_date DATE,
  currency VARCHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  payment_terms VARCHAR(255),
  special_instructions TEXT,
  sent_at TIMESTAMP NULL,
  confirmed_at TIMESTAMP NULL,
  confirmed_by_id VARCHAR(32),
  shipment_ready_at TIMESTAMP NULL,
  shipped_at TIMESTAMP NULL,
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (factory_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmed_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_purchase_orders_factory_id (factory_id),
  INDEX idx_purchase_orders_status (status),
  INDEX idx_purchase_orders_sales_order_id (sales_order_id)
);
```

---

### purchase_order_items
Line items for purchase orders.

```sql
CREATE TABLE purchase_order_items (
  id VARCHAR(32) PRIMARY KEY,
  purchase_order_id VARCHAR(32) NOT NULL,
  sales_order_item_id VARCHAR(32),
  product_id VARCHAR(32),
  product_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  quantity_received DECIMAL(18,4) DEFAULT 0,
  unit VARCHAR(50),
  unit_price DECIMAL(18,4) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(18,2),
  total_amount DECIMAL(18,2) NOT NULL,
  line_no INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE SET NULL,
  INDEX idx_purchase_order_items_purchase_order_id (purchase_order_id)
);
```

---

## Packing Management

### packing_lists
Packing lists for shipments.

```sql
CREATE TABLE packing_lists (
  id VARCHAR(32) PRIMARY KEY,
  packing_list_no VARCHAR(50) UNIQUE NOT NULL,
  sales_order_id VARCHAR(32) NOT NULL,
  po_id VARCHAR(32),
  status ENUM('draft', 'finalized', 'shipped') DEFAULT 'draft',
  total_weight DECIMAL(18,4),
  weight_unit VARCHAR(10),
  total_volume DECIMAL(18,4),
  volume_unit VARCHAR(10),
  package_count INT,
  notes TEXT,
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_packing_lists_sales_order_id (sales_order_id),
  INDEX idx_packing_lists_status (status)
);
```

---

### packages
Individual packages/cartons.

```sql
CREATE TABLE packages (
  id VARCHAR(32) PRIMARY KEY,
  packing_list_id VARCHAR(32) NOT NULL,
  package_no VARCHAR(50) NOT NULL,
  weight DECIMAL(18,4),
  weight_unit VARCHAR(10),
  length DECIMAL(18,4),
  width DECIMAL(18,4),
  height DECIMAL(18,4),
  dimension_unit VARCHAR(10),
  volume DECIMAL(18,4),
  hscode VARCHAR(20),
  hscode_description TEXT,
  barcode VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE CASCADE,
  UNIQUE(packing_list_id, package_no),
  INDEX idx_packages_packing_list_id (packing_list_id)
);
```

---

### package_items
Items in each package.

```sql
CREATE TABLE package_items (
  id VARCHAR(32) PRIMARY KEY,
  package_id VARCHAR(32) NOT NULL,
  sales_order_item_id VARCHAR(32),
  product_id VARCHAR(32),
  quantity DECIMAL(18,4) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE SET NULL
);
```

---

## Shipping & Logistics

### shipments
Shipment records.

```sql
CREATE TABLE shipments (
  id VARCHAR(32) PRIMARY KEY,
  shipment_no VARCHAR(50) UNIQUE NOT NULL,
  sales_order_id VARCHAR(32),
  packing_list_id VARCHAR(32),
  status ENUM('booked', 'shipped', 'in_transit', 'arrived', 'delivered', 'cancelled') DEFAULT 'booked',
  vessel_name VARCHAR(255),
  vessel_type VARCHAR(100),
  vessel_imo_no VARCHAR(20),
  container_no VARCHAR(50),
  container_type VARCHAR(20),
  departure_port VARCHAR(255),
  destination_port VARCHAR(255),
  departure_date DATE,
  eta DATE,
  current_location VARCHAR(255),
  status_last_updated TIMESTAMP,
  shipping_agent VARCHAR(255),
  shipping_agent_ref VARCHAR(100),
  notes TEXT,
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (packing_list_id) REFERENCES packing_lists(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_shipments_sales_order_id (sales_order_id),
  INDEX idx_shipments_status (status),
  INDEX idx_shipments_departure_date (departure_date)
);
```

---

### shipment_legs
Individual legs/stages of a shipment.

```sql
CREATE TABLE shipment_legs (
  id VARCHAR(32) PRIMARY KEY,
  shipment_id VARCHAR(32) NOT NULL,
  leg_no INT,
  origin_port VARCHAR(255),
  destination_port VARCHAR(255),
  vessel_name VARCHAR(255),
  scheduled_departure DATE,
  scheduled_arrival DATE,
  actual_departure TIMESTAMP NULL,
  actual_arrival TIMESTAMP NULL,
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
  UNIQUE(shipment_id, leg_no),
  INDEX idx_shipment_legs_shipment_id (shipment_id)
);
```

---

### bills_of_lading
Bill of Lading records.

```sql
CREATE TABLE bills_of_lading (
  id VARCHAR(32) PRIMARY KEY,
  bl_no VARCHAR(50) UNIQUE NOT NULL,
  shipment_id VARCHAR(32) NOT NULL,
  shipper_name VARCHAR(255),
  consignee_name VARCHAR(255),
  notify_party_name VARCHAR(255),
  issue_date DATE,
  issued_by VARCHAR(255),
  signed_by VARCHAR(255),
  signed_at TIMESTAMP NULL,
  freight_prepaid BOOLEAN DEFAULT FALSE,
  freight_amount DECIMAL(18,2),
  number_of_original_bl INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
  INDEX idx_bills_of_lading_shipment_id (shipment_id)
);
```

---

### shipment_tracking
Tracking events for shipments.

```sql
CREATE TABLE shipment_tracking (
  id VARCHAR(32) PRIMARY KEY,
  shipment_id VARCHAR(32) NOT NULL,
  event_date TIMESTAMP NOT NULL,
  event_type VARCHAR(100),
  location VARCHAR(255),
  status VARCHAR(100),
  description TEXT,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE,
  INDEX idx_shipment_tracking_shipment_id (shipment_id),
  INDEX idx_shipment_tracking_event_date (event_date)
);
```

---

## Documents

### documents
Centralized document management.

```sql
CREATE TABLE documents (
  id VARCHAR(32) PRIMARY KEY,
  document_type VARCHAR(100) NOT NULL,
  document_no VARCHAR(100),
  related_entity_type VARCHAR(100),
  related_entity_id VARCHAR(32),
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size BIGINT,
  mime_type VARCHAR(100),
  file_hash VARCHAR(255),
  is_signed BOOLEAN DEFAULT FALSE,
  signed_by_id VARCHAR(32),
  signed_at TIMESTAMP NULL,
  signature_valid BOOLEAN,
  access_level ENUM('private', 'internal', 'customer_visible') DEFAULT 'internal',
  uploaded_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (signed_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_documents_related_entity (related_entity_type, related_entity_id),
  INDEX idx_documents_document_type (document_type),
  INDEX idx_documents_created_at (created_at)
);
```

---

### document_access_log
Access log for documents.

```sql
CREATE TABLE document_access_log (
  id VARCHAR(32) PRIMARY KEY,
  document_id VARCHAR(32) NOT NULL,
  accessed_by_id VARCHAR(32),
  access_type ENUM('view', 'download', 'print') DEFAULT 'view',
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (accessed_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_document_access_log_document_id (document_id)
);
```

---

## Invoice & Payment

### invoices
Sales and purchase invoices.

```sql
CREATE TABLE invoices (
  id VARCHAR(32) PRIMARY KEY,
  invoice_no VARCHAR(50) UNIQUE NOT NULL,
  invoice_type ENUM('sales', 'purchase') NOT NULL,
  related_entity_type VARCHAR(100),
  related_entity_id VARCHAR(32),
  customer_id VARCHAR(32),
  vendor_id VARCHAR(32),
  invoice_date DATE NOT NULL,
  due_date DATE,
  status ENUM('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled') DEFAULT 'draft',
  currency VARCHAR(3) DEFAULT 'USD',
  subtotal DECIMAL(18,2) DEFAULT 0,
  tax_amount DECIMAL(18,2) DEFAULT 0,
  total_amount DECIMAL(18,2) DEFAULT 0,
  paid_amount DECIMAL(18,2) DEFAULT 0,
  balance_due DECIMAL(18,2),
  payment_terms VARCHAR(255),
  notes TEXT,
  issued_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (vendor_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (issued_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_invoices_invoice_type (invoice_type),
  INDEX idx_invoices_customer_id (customer_id),
  INDEX idx_invoices_due_date (due_date),
  INDEX idx_invoices_status (status)
);
```

---

### invoice_items
Line items for invoices.

```sql
CREATE TABLE invoice_items (
  id VARCHAR(32) PRIMARY KEY,
  invoice_id VARCHAR(32) NOT NULL,
  product_id VARCHAR(32),
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(18,4),
  unit VARCHAR(50),
  unit_price DECIMAL(18,4),
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(18,2),
  total_amount DECIMAL(18,2) NOT NULL,
  line_no INT,
  reference_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  INDEX idx_invoice_items_invoice_id (invoice_id)
);
```

---

### payments
Payment records.

```sql
CREATE TABLE payments (
  id VARCHAR(32) PRIMARY KEY,
  invoice_id VARCHAR(32) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method ENUM('bank_transfer', 'credit_card', 'check', 'cash', 'wire', 'other') NOT NULL,
  reference_no VARCHAR(100),
  payment_status ENUM('pending', 'confirmed', 'failed', 'refunded') DEFAULT 'pending',
  bank_name VARCHAR(255),
  transaction_id VARCHAR(100),
  notes TEXT,
  recorded_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_payments_invoice_id (invoice_id),
  INDEX idx_payments_payment_date (payment_date),
  INDEX idx_payments_status (payment_status)
);
```

---

## Inspection & QC

### inspections
Inspection records.

```sql
CREATE TABLE inspections (
  id VARCHAR(32) PRIMARY KEY,
  inspection_no VARCHAR(50) UNIQUE NOT NULL,
  purchase_order_id VARCHAR(32),
  sales_order_id VARCHAR(32),
  inspection_date DATE,
  inspector_id VARCHAR(32),
  location VARCHAR(255),
  inspection_type ENUM('pre_shipment', 'on_arrival', 'random', 'specific') DEFAULT 'pre_shipment',
  overall_status ENUM('pending', 'in_progress', 'pass', 'fail', 'conditional_pass') DEFAULT 'pending',
  defect_count INT DEFAULT 0,
  completed_at TIMESTAMP NULL,
  notes TEXT,
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_inspections_purchase_order_id (purchase_order_id),
  INDEX idx_inspections_overall_status (overall_status)
);
```

---

### inspection_results
Detailed inspection results and defects.

```sql
CREATE TABLE inspection_results (
  id VARCHAR(32) PRIMARY KEY,
  inspection_id VARCHAR(32) NOT NULL,
  sales_order_item_id VARCHAR(32),
  defect_type VARCHAR(100),
  severity ENUM('minor', 'major', 'critical') DEFAULT 'major',
  quantity_defective DECIMAL(18,4),
  description TEXT,
  photo_url VARCHAR(500),
  action_required VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_item_id) REFERENCES sales_order_items(id) ON DELETE SET NULL,
  INDEX idx_inspection_results_inspection_id (inspection_id)
);
```

---

## Claims

### claims
Claims and disputes.

```sql
CREATE TABLE claims (
  id VARCHAR(32) PRIMARY KEY,
  claim_no VARCHAR(50) UNIQUE NOT NULL,
  invoice_id VARCHAR(32),
  shipment_id VARCHAR(32),
  customer_id VARCHAR(32) NOT NULL,
  claim_type ENUM('quality', 'shortage', 'damage', 'late_delivery', 'other') NOT NULL,
  claim_amount DECIMAL(18,2),
  claim_date DATE NOT NULL,
  status ENUM('submitted', 'under_investigation', 'approved', 'rejected', 'resolved') DEFAULT 'submitted',
  description TEXT,
  resolution VARCHAR(500),
  resolved_at TIMESTAMP NULL,
  resolved_by_id VARCHAR(32),
  created_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_claims_customer_id (customer_id),
  INDEX idx_claims_status (status),
  INDEX idx_claims_claim_date (claim_date)
);
```

---

## Inventory

### inventory
Stock levels.

```sql
CREATE TABLE inventory (
  id VARCHAR(32) PRIMARY KEY,
  product_id VARCHAR(32) NOT NULL,
  warehouse_id VARCHAR(32),
  current_stock DECIMAL(18,4) DEFAULT 0,
  unit VARCHAR(50),
  reorder_point DECIMAL(18,4),
  reorder_quantity DECIMAL(18,4),
  last_stock_count DATE,
  last_movement_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, warehouse_id),
  INDEX idx_inventory_product_id (product_id),
  INDEX idx_inventory_warehouse_id (warehouse_id)
);
```

---

### inventory_movements
Stock movement history.

```sql
CREATE TABLE inventory_movements (
  id VARCHAR(32) PRIMARY KEY,
  product_id VARCHAR(32) NOT NULL,
  warehouse_id VARCHAR(32),
  movement_type ENUM('purchase', 'sales', 'adjustment', 'transfer', 'loss', 'return') NOT NULL,
  quantity DECIMAL(18,4) NOT NULL,
  reference_id VARCHAR(32),
  reference_type VARCHAR(100),
  notes TEXT,
  recorded_by_id VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recorded_by_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_inventory_movements_product_id (product_id),
  INDEX idx_inventory_movements_created_at (created_at)
);
```

---

## Financial

### exchange_rates
Currency exchange rates.

```sql
CREATE TABLE exchange_rates (
  id VARCHAR(32) PRIMARY KEY,
  base_currency VARCHAR(3) NOT NULL,
  target_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(18,6) NOT NULL,
  rate_date DATE NOT NULL,
  source VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(base_currency, target_currency, rate_date),
  INDEX idx_exchange_rates_rate_date (rate_date)
);
```

---

### tax_rates
Tax rate configuration.

```sql
CREATE TABLE tax_rates (
  id VARCHAR(32) PRIMARY KEY,
  country VARCHAR(100),
  state VARCHAR(100),
  tax_type VARCHAR(50),
  rate DECIMAL(5,2) NOT NULL,
  effective_from DATE,
  effective_to DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(country, state, tax_type, effective_from)
);
```

---

## ER Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Authentication                       │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐              │
│  │  users   │ │  roles   │ │ permissions │              │
│  └──────────┘ └──────────┘ └─────────────┘              │
│       │            │              │                     │
│       └────┬───────┴──────────────┘                     │
│            │ role_permissions                           │
└─────────────┼──────────────────────────────────────────┘
              │
              ├─────────────────────────────────────────┐
              │                                         │
        ┌─────▼──────┐                         ┌────────▼────────┐
        │  customers │                         │  inquiries      │
        └─────┬──────┘                         └────┬────────────┘
              │                                     │
              ├─ customer_contacts                  ├─ inquiry_attachments
              ├─ customer_activities                │
              │                                     ▼
              │                             ┌──────────────────┐
              │                             │  quotations      │
              │                             └────┬─────────────┘
              │                                   │
              │                                   ├─ quotation_items
              │                                   ├─ quotation_revisions
              │                                   │
              │                                   ▼
              │                         ┌──────────────────────────┐
              │                         │ proforma_invoices        │
              │                         └────┬───────────────────┘
              │                              │
              │                              ▼
              ├─────────────────────►┌──────────────────┐
              │                       │ sales_orders    │
              │                       └────┬────────────┘
              │                            │
              │                            ├─ sales_order_items
              │                            ├─ order_deliveries
              │                            │
              │                 ┌──────────┴────────────┐
              │                 │                       │
              │                 ▼                       ▼
              │         ┌──────────────────┐  ┌──────────────────┐
              │         │ packing_lists    │  │ shipments        │
              │         └────┬─────────────┘  └────┬─────────────┘
              │              │                      │
              │              ├─ packages            ├─ shipment_legs
              │              ├─ package_items       ├─ bills_of_lading
              │              │                      ├─ shipment_tracking
              │              │                      │
              │              └──────┬───────────────┘
              │                     │
              │                     ▼
              │         ┌──────────────────────┐
              │         │ purchase_orders      │
              └────────►└────┬─────────────────┘
                              │
                              ├─ purchase_order_items
                              │
                ┌─────────────┼──────────────────┐
                │             │                  │
                ▼             ▼                  ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ invoices     │ │ inspections  │ │ claims       │
        └────┬─────────┘ └────┬─────────┘ └──────────────┘
             │                │
             ├─ invoice_items └─ inspection_results
             ├─ payments
             │
        ┌────┴────────────────┐
        │   documents          │
        │ (centralized)        │
        │                      │
        └─ document_access_log │

        ┌─────────────────────┐
        │    inventory        │
        ├─ inventory_movements│
        └─────────────────────┘

        ┌─────────────────────┐
        │   exchange_rates    │
        │   tax_rates         │
        │   audit_logs        │
        └─────────────────────┘
```

---

**Last Updated**: March 16, 2024

**Database Statistics**:
- Total Tables: 45+
- Total Indexes: 100+
- Foreign Keys: 60+
- Relationships: Many-to-Many, One-to-Many, One-to-One
