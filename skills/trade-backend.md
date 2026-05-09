# Back-end Developer Reference — International Trade Platform

This reference is for AI agents reviewing or writing backend code for the trade platform. It covers B2B e-commerce patterns, international trade constraints, and production-grade implementations. **Read this before building or reviewing any backend feature.**

---

## Overview: The Stack We're Building

The platform spans:
- **Product catalog** with complex attributes, specs, certifications, tiered pricing
- **RFQ engine** (Request for Quote workflow) and **order management** (quotes → POs → invoices)
- **B2B portal** with company accounts, role-based access, contract pricing
- **Multi-currency** support (USD, EUR, CNY, etc.) with accurate rounding and historical exchange rates
- **Trade compliance** integrations (customs screening, sanctions checks, document management)
- **Integrations** with ERP/CRM, shipping APIs, and customs systems
- **Global operations** serving buyers and suppliers across multiple time zones and regulatory regimes

This is not B2C. Pricing, lead times, certifications, and compliance are non-negotiable.

---

## API Architecture

### Design Principles: REST First, GraphQL Later

Build REST APIs first. REST is synchronous, stateless, and easier to debug. GraphQL comes later when frontend complexity justifies it.

**API Versioning: URL Path Only**

```
GET /api/v1/products
GET /api/v1/rfqs
GET /api/v1/orders
```

- Version in the URL path, not headers or query params
- Never make breaking changes within a version (e.g., no field removals, type changes, or key renames)
- Additive changes (new optional fields, new endpoints) don't require a new version
- Maintain at least one prior version for 6–12 months during deprecation
- Clearly document when a version will sunset

**HTTP Methods and Status Codes**

```
POST   /api/v1/products           → 201 Created
GET    /api/v1/products/:id       → 200 OK
PUT    /api/v1/products/:id       → 200 OK (full replace) or 204 No Content
PATCH  /api/v1/products/:id       → 200 OK (partial update)
DELETE /api/v1/products/:id       → 204 No Content
GET    /api/v1/orders?status=open → 200 OK

400 Bad Request     — Input validation failed
401 Unauthorized    — Missing or invalid auth token
403 Forbidden       — Authenticated but not authorized for this resource
404 Not Found       — Resource does not exist
409 Conflict        — Constraint violation (e.g., duplicate SKU)
429 Too Many        — Rate limited; include Retry-After header
500 Internal Server — Unhandled error
```

**Error Response Format: Consistent Shape**

Every error response must use the same JSON structure. Clients expect this consistency.

```json
{
  "error": {
    "code": "INVALID_PRODUCT_SKU",
    "message": "SKU 'XYZ-001' already exists",
    "status": 409,
    "details": {
      "field": "sku",
      "value": "XYZ-001",
      "constraint": "unique"
    },
    "requestId": "req_789abc"
  }
}
```

Map business logic errors to codes. Examples:
- `INVALID_CURRENCY_PAIR` — Unsupported currency conversion
- `PRODUCT_NOT_FOUND` — SKU lookup failed
- `INSUFFICIENT_INVENTORY` — Stock unavailable
- `COMPLIANCE_SCREENING_FAILED` — Party is on sanctions list
- `INVALID_INCOTERM` — Incoterm not supported for origin/destination
- `DUPLICATE_COMPANY_REGISTRATION` — Company already in system

**Rate Limiting Headers**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1617926400
```

Different endpoints have different limits:
- **Login/auth** endpoints: 5 requests/minute (brute-force protection)
- **Password reset**: 3 requests/hour
- **RFQ creation**: 100/hour (quota for bulk quote operations)
- **Product search**: 1000/hour
- **Order placement**: 50/hour per company account

---

## Database Design Patterns

### Core Tables: Products, Customers, Orders, Documents

Use PostgreSQL or MySQL 8+. Foreign keys are mandatory. Every table has `created_at`, `updated_at`, `deleted_at` (soft delete for audit trail).

**Products Table**

```sql
CREATE TABLE products (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id BIGINT NOT NULL REFERENCES categories(id),
  manufacturer VARCHAR(255),
  origin_country CHAR(2) NOT NULL,  -- ISO 3166 code
  hs_code VARCHAR(12),              -- Harmonized System code for tariff
  
  -- Dimensions & weight (stored as integers in base units for precision)
  weight_grams BIGINT,              -- Always metric
  length_mm BIGINT,
  width_mm BIGINT,
  height_mm BIGINT,
  
  -- Certifications and compliance (JSON array or separate table)
  certifications JSON,              -- e.g., ["CE", "RoHS", "FCC", "ISO9001"]
  dangerous_goods BOOLEAN DEFAULT FALSE,
  dangerous_goods_class VARCHAR(50), -- IMDG class, etc.
  
  -- Pricing & status
  base_price_cents BIGINT NOT NULL, -- See currency section below
  base_currency CHAR(3) NOT NULL,   -- "USD", "EUR", etc.
  status ENUM('active', 'discontinued', 'draft') DEFAULT 'draft',
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  INDEX idx_sku (sku),
  INDEX idx_category (category_id),
  INDEX idx_status (status),
  UNIQUE KEY uk_sku_deleted (sku, deleted_at)  -- Allow soft-deleted dupe SKUs
);
```

**Key Notes:**
- `sku` is unique and immutable (for international supply chains, SKU stability is critical)
- `origin_country` is mandatory (trade compliance + tariff classification)
- `hs_code` is tariff classification (must be verified; never assume)
- Store dimensions in metric units (mm, grams) even for US suppliers
- `certifications` is JSON for flexibility, but normalize to a `product_certifications` junction table if you need to filter by certification
- Soft delete (`deleted_at`) because you must never lose historical audit data in trade

**Product Attributes Table** (for complex spec variants)

```sql
CREATE TABLE product_attributes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attribute_name VARCHAR(255) NOT NULL,    -- "Color", "Material", "Voltage"
  attribute_value VARCHAR(255) NOT NULL,
  attribute_type ENUM('text', 'number', 'select', 'range'),
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_product (product_id),
  UNIQUE KEY uk_product_attr (product_id, attribute_name, attribute_value)
);
```

**Pricing Table** (for multi-tier, contract, and time-bound pricing)

```sql
CREATE TABLE product_pricing (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- Pricing scope
  price_tier ENUM('standard', 'volume', 'contract', 'promotional') NOT NULL,
  min_quantity INT DEFAULT 1,
  max_quantity INT,                       -- NULL = no upper limit
  
  -- Currency and value
  currency CHAR(3) NOT NULL,              -- "USD", "EUR", etc.
  price_cents BIGINT NOT NULL,            -- e.g., 12999 = $129.99
  
  -- Time bounds
  valid_from DATE NOT NULL,
  valid_to DATE,                          -- NULL = currently valid
  
  -- B2B context
  company_id BIGINT REFERENCES companies(id),  -- NULL = public pricing
  region VARCHAR(2),                      -- ISO 3166 code; NULL = global
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  INDEX idx_product (product_id),
  INDEX idx_company (company_id),
  INDEX idx_valid_dates (valid_from, valid_to),
  INDEX idx_quantity (min_quantity, max_quantity)
);
```

**Companies Table** (B2B account structure)

```sql
CREATE TABLE companies (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  
  -- Registration & compliance
  registration_number VARCHAR(50) UNIQUE,  -- Company registration or VAT
  country CHAR(2) NOT NULL,                -- HQ location (ISO 3166)
  
  -- Contact & billing
  primary_contact_name VARCHAR(255),
  primary_contact_email VARCHAR(255),
  billing_address_id BIGINT REFERENCES addresses(id),
  
  -- Trade compliance
  duns_number VARCHAR(9),                  -- DUNS for screening
  business_registration LONGTEXT,         -- Scanned docs or links
  signer_name VARCHAR(255),                -- Authorized signatory for contracts
  signer_title VARCHAR(255),
  
  -- B2B relationships
  parent_company_id BIGINT REFERENCES companies(id),  -- For subsidiaries
  customer_since DATE,
  status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  
  INDEX idx_country (country),
  INDEX idx_status (status),
  UNIQUE KEY uk_registration (registration_number, country, deleted_at)
);
```

**Users Table** (B2B portal users linked to companies)

```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  phone VARCHAR(20),
  
  password_hash VARCHAR(255) NOT NULL,    -- bcrypt or Argon2
  email_verified BOOLEAN DEFAULT FALSE,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  
  -- SSO / OAuth (optional later)
  sso_provider ENUM('google', 'microsoft', 'okta', 'saml') NULL,
  sso_id VARCHAR(255) NULL UNIQUE,
  
  last_login TIMESTAMP NULL,
  status ENUM('active', 'suspended', 'pending') DEFAULT 'pending',
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_company (company_id),
  INDEX idx_email (email),
  INDEX idx_status (status)
);
```

**User Roles and Permissions** (RBAC for B2B portal)

```sql
CREATE TABLE roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,  -- "buyer", "approver", "finance", "admin"
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_company_role (company_id, name)
);

CREATE TABLE role_permissions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,  -- "rfq:create", "order:approve", "invoice:view"
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_role_permission (role_id, permission)
);

CREATE TABLE user_roles (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY uk_user_role (user_id, role_id)
);
```

**RFQ and Quote Management**

```sql
CREATE TABLE rfqs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  rfq_number VARCHAR(50) UNIQUE NOT NULL,  -- "RFQ-2026-001"
  company_id BIGINT NOT NULL REFERENCES companies(id),
  created_by_user_id BIGINT NOT NULL REFERENCES users(id),
  
  title VARCHAR(255),
  description TEXT,
  
  -- Timeline
  issued_date DATE NOT NULL,
  due_date DATE NOT NULL,
  expected_delivery_date DATE,
  
  -- Status workflow
  status ENUM('draft', 'issued', 'pending', 'responded', 'awarded', 'closed') DEFAULT 'draft',
  
  -- Incoterm and terms
  incoterm VARCHAR(10) NOT NULL,  -- "FOB", "CIF", "DDP", etc.
  incoterm_location VARCHAR(255),  -- "Shanghai Port", "New York"
  payment_terms VARCHAR(100),      -- "Net 30", "LC at sight", etc.
  
  -- Compliance context
  destination_country CHAR(2),     -- Affects tariff, export controls
  end_use_category VARCHAR(100),   -- For export control screening
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_company (company_id),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date)
);

CREATE TABLE rfq_line_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  rfq_id BIGINT NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  
  quantity INT NOT NULL,
  unit ENUM('pcs', 'kg', 'tons', 'liters', 'm3') NOT NULL,
  
  notes TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_rfq (rfq_id),
  INDEX idx_product (product_id)
);

CREATE TABLE quotes (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  quote_number VARCHAR(50) UNIQUE NOT NULL,  -- "QT-2026-001"
  rfq_id BIGINT NOT NULL REFERENCES rfqs(id),
  company_id BIGINT NOT NULL REFERENCES companies(id),  -- Supplier
  
  issued_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  
  status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired') DEFAULT 'draft',
  
  -- Totals (stored for audit trail, not computed on query)
  total_amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_rfq (rfq_id),
  INDEX idx_company (company_id),
  INDEX idx_status (status)
);

CREATE TABLE quote_line_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  quote_id BIGINT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  rfq_line_item_id BIGINT NOT NULL REFERENCES rfq_line_items(id),
  
  quantity INT NOT NULL,
  unit_price_cents BIGINT NOT NULL,  -- Price per unit in quote currency
  line_total_cents BIGINT NOT NULL,  -- quantity × unit_price
  currency CHAR(3) NOT NULL,
  
  notes TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_quote (quote_id)
);
```

**Purchase Orders and Invoices**

```sql
CREATE TABLE purchase_orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  
  buyer_company_id BIGINT NOT NULL REFERENCES companies(id),
  supplier_company_id BIGINT NOT NULL REFERENCES companies(id),
  
  quote_id BIGINT REFERENCES quotes(id),
  created_by_user_id BIGINT REFERENCES users(id),
  
  po_date DATE NOT NULL,
  expected_delivery_date DATE,
  
  status ENUM('draft', 'issued', 'acknowledged', 'shipped', 'delivered', 'cancelled') DEFAULT 'draft',
  
  -- Shipping & terms
  incoterm VARCHAR(10) NOT NULL,
  incoterm_location VARCHAR(255),
  payment_terms VARCHAR(100),
  
  ship_from_address_id BIGINT REFERENCES addresses(id),
  ship_to_address_id BIGINT REFERENCES addresses(id),
  
  -- Totals
  subtotal_cents BIGINT,
  shipping_cents BIGINT,
  tax_cents BIGINT,
  total_cents BIGINT,
  currency CHAR(3),
  
  -- Trade compliance
  export_license_number VARCHAR(100),
  hs_tariff_codes JSON,  -- Array of applicable HS codes
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_buyer (buyer_company_id),
  INDEX idx_supplier (supplier_company_id),
  INDEX idx_status (status),
  INDEX idx_po_date (po_date)
);

CREATE TABLE po_line_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  po_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  
  quantity INT NOT NULL,
  unit ENUM('pcs', 'kg', 'tons', 'liters', 'm3') NOT NULL,
  unit_price_cents BIGINT NOT NULL,
  line_total_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_po (po_id)
);

CREATE TABLE invoices (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  po_id BIGINT NOT NULL REFERENCES purchase_orders(id),
  
  issued_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  status ENUM('draft', 'issued', 'paid', 'overdue', 'cancelled') DEFAULT 'draft',
  
  subtotal_cents BIGINT,
  tax_cents BIGINT,
  total_cents BIGINT,
  currency CHAR(3),
  
  payment_received_date DATE NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_po (po_id),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date)
);
```

**Trade Documents Table**

```sql
CREATE TABLE trade_documents (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  
  -- Association
  po_id BIGINT REFERENCES purchase_orders(id),
  invoice_id BIGINT REFERENCES invoices(id),
  product_id BIGINT REFERENCES products(id),
  
  -- Document type
  document_type ENUM('bill_of_lading', 'commercial_invoice', 'packing_list', 
                      'certificate_of_origin', 'certification', 'spec_sheet',
                      'insurance', 'export_license') NOT NULL,
  
  -- File storage
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,    -- S3 or similar; never store paths in code
  file_mime_type VARCHAR(100),
  file_size_bytes BIGINT,
  file_hash_sha256 VARCHAR(64),       -- For integrity verification
  
  -- Metadata
  document_date DATE,
  issuing_authority VARCHAR(255),
  valid_until DATE NULL,
  
  -- Status
  verified BOOLEAN DEFAULT FALSE,
  verified_by_user_id BIGINT REFERENCES users(id),
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_po (po_id),
  INDEX idx_invoice (invoice_id),
  INDEX idx_document_type (document_type),
  INDEX idx_valid_until (valid_until)
);
```

---

## Multi-Currency Handling

**The Rule: Store prices as integers representing the smallest currency unit.**

Why? Floating-point arithmetic causes rounding errors that compound in multi-currency trades. Use integers.

### Storage Pattern

```python
# Python example (translate to your language)
class Price:
    def __init__(self, amount_cents: int, currency: str):
        self.amount_cents = amount_cents  # 12999 = $129.99
        self.currency = currency          # "USD", "EUR", "CNY"
    
    def display(self) -> str:
        """Format for display."""
        decimal_places = get_decimal_places(self.currency)
        divisor = 10 ** decimal_places
        return f"{self.currency} {self.amount_cents / divisor:.2f}"
    
    def convert(self, target_currency: str, rate: Decimal) -> 'Price':
        """Convert to another currency using rate from exchange_rates table."""
        if self.currency == target_currency:
            return Price(self.amount_cents, self.currency)
        
        # Apply rate and round using Decimal for precision
        from decimal import Decimal, ROUND_HALF_UP
        
        decimal_places = get_decimal_places(target_currency)
        decimal_divisor = Decimal(10) ** decimal_places
        
        converted = (Decimal(self.amount_cents) * rate / Decimal(100)).quantize(
            Decimal(1) / decimal_divisor,
            rounding=ROUND_HALF_UP
        )
        return Price(int(converted * decimal_divisor), target_currency)
```

### Exchange Rates Table

```sql
CREATE TABLE exchange_rates (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  
  from_currency CHAR(3) NOT NULL,
  to_currency CHAR(3) NOT NULL,
  
  rate DECIMAL(18, 8) NOT NULL,  -- e.g., 0.92345678 (EUR/USD)
  
  -- Critical: Historical rates. Never delete or modify historical data.
  rate_date DATE NOT NULL,        -- Date the rate is valid for
  rate_source VARCHAR(100),       -- "ECB", "Bloomberg", "XE", etc.
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_currency_pair (from_currency, to_currency),
  INDEX idx_rate_date (rate_date),
  UNIQUE KEY uk_currency_date (from_currency, to_currency, rate_date)
);
```

### Currency Rules

1. **Always store both original and converted values in the database for transactions.**

```sql
INSERT INTO invoices (
  total_cents,              -- Original amount
  currency,                 -- Original currency
  total_usd_cents,          -- Converted to USD for reporting
  exchange_rate_used,       -- Historical rate applied
  rate_date                 -- Date rate was valid
) VALUES (82000, 'EUR', 89126, 1.08826, '2026-04-09');
```

2. **Never convert on the fly; always use a historical rate table row.**

3. **Apply rounding rules per-currency:**
   - USD, EUR, GBP: 2 decimal places (cents)
   - JPY, KRW, INR: 0 decimal places (no fractional units)
   - Some commodities (gold, oil): 3–4 decimal places

4. **For tax and invoicing, always round after conversion, not before.**

```python
# WRONG: Convert line items, then sum
line1_usd = convert_to_usd(eur_100)  # Rounds
line2_usd = convert_to_usd(eur_200)  # Rounds
total_wrong = line1_usd + line2_usd  # Compound rounding error

# CORRECT: Sum in original currency, convert once
total_eur = eur_100 + eur_200
total_usd = convert_to_usd(total_eur)  # Rounds once
```

---

## Order/RFQ Workflow Engine

### State Machine: Strict Transitions

Every RFQ, quote, and PO follows a rigid state machine. **Never allow invalid transitions.**

```
RFQ States:
  draft ──→ issued ──→ pending ──→ responded ──┐
                                               └──→ awarded ──→ closed
                    └──────────────────────────────→ closed (no response)

Quote States:
  draft ──→ sent ──→ accepted → (creates PO)
               └─→ rejected
               └─→ expired

PO States:
  draft ──→ issued ──→ acknowledged ──→ shipped ──→ delivered
                                             └─────→ cancelled

Invoice States:
  draft ──→ issued ──→ paid
              └─────→ overdue (auto-transition if past due_date)
```

### Implementation

```python
class OrderStateValidator:
    """Enforce state transitions. Called before every status update."""
    
    VALID_TRANSITIONS = {
        'draft': ['issued', 'cancelled'],
        'issued': ['acknowledged', 'cancelled'],
        'acknowledged': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'cancelled'],
        'delivered': [],  # Terminal
        'cancelled': [],  # Terminal
    }
    
    def can_transition(self, current_state: str, new_state: str) -> bool:
        return new_state in self.VALID_TRANSITIONS.get(current_state, [])
    
    def validate_or_raise(self, current_state: str, new_state: str):
        if not self.can_transition(current_state, new_state):
            raise ValueError(
                f"Invalid transition: {current_state} → {new_state}"
            )
```

### Workflow Events

Log every state transition with context:

```sql
CREATE TABLE order_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  po_id BIGINT NOT NULL REFERENCES purchase_orders(id),
  
  event_type VARCHAR(50),        -- "status_changed", "payment_received", "shipped"
  from_state VARCHAR(50),
  to_state VARCHAR(50),
  
  triggered_by_user_id BIGINT REFERENCES users(id),  -- NULL if system-triggered
  trigger_reason TEXT,           -- "Auto-transitioned to overdue"
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_po (po_id),
  INDEX idx_event_type (event_type)
);
```

---

## Authentication and Authorization

### JWT-Based Auth with B2B Roles

Issue JWTs on login. Include company_id and roles in claims for efficient authorization checks.

```json
{
  "sub": "user_12345",
  "email": "buyer@acmecorp.com",
  "company_id": "company_567",
  "roles": ["buyer", "approver"],
  "permissions": ["rfq:create", "order:approve", "invoice:view"],
  "iat": 1680000000,
  "exp": 1680003600,
  "iss": "trade-platform.example.com"
}
```

### Company-Scoped Access

Every API endpoint must validate company ownership:

```python
@app.get("/api/v1/orders/{order_id}")
def get_order(order_id: int, current_user: User):
    order = db.query(PurchaseOrder).filter(id == order_id).first()
    
    # Authorize: user's company must be buyer or supplier on this PO
    if order.buyer_company_id != current_user.company_id and \
       order.supplier_company_id != current_user.company_id:
        raise PermissionDenied("Not authorized")
    
    return order
```

### Permission Matrix

| Role | rfq:create | rfq:view_own | order:approve | invoice:pay | order:cancel |
|------|-----------|--------------|---------------|-------------|--------------|
| Buyer | ✓ | ✓ | ✓ | ✓ | ✓ |
| Approver | ✗ | ✓ | ✓ | ✗ | ✗ |
| Finance | ✗ | ✓ | ✗ | ✓ | ✗ |
| Viewer | ✗ | ✓ | ✗ | ✗ | ✗ |

Check this matrix at the API layer AND in the UI. Don't rely on frontend-only checks.

### SSO Support (Later Phase)

When adding SSO, support:
- **SAML 2.0** for enterprise customers (Okta, Azure AD, Google Workspace)
- **OAuth 2.0 / OpenID Connect** for Google and Microsoft accounts
- Map IdP groups/claims to internal roles

```python
@app.post("/api/v1/auth/saml/acs")
def saml_acs(saml_response: str):
    """SAML Assertion Consumer Service."""
    user_info = parse_saml_response(saml_response)
    # Lookup or create user, assign roles based on IdP groups
    user = get_or_create_user(user_info)
    return issue_jwt(user)
```

---

## Integration Architecture

### ERP / CRM Syncing

Syncing master data (products, customers, pricing) is the hardest part. **Get this right.**

**Problem:** ERP and ecommerce have different data models, different schemas, and time zones. A price change in the ERP shouldn't break an active RFQ.

**Pattern:**

```
ERP System (source of truth)
  ├─ Product changes → message queue
  ├─ Customer/pricing changes → message queue
  └─ PO/Invoice sync → bidirectional
        ↓
Message Broker (Kafka, RabbitMQ, AWS SQS)
        ↓
Sync Worker
  1. Validate data (schema, rules)
  2. Transform (map fields, normalize currency)
  3. Store with versioning (never overwrite without history)
  4. Trigger side effects (reindex catalog, notify customers)
```

**Critical Rules:**

1. **Product SKUs are immutable once assigned.** Soft-delete if discontinued; never reuse a SKU.

2. **Pricing is time-windowed.** Never allow pricing to change retroactively for issued RFQs/POs.

```sql
-- New pricing effective tomorrow; old pricing remains valid for existing RFQs
INSERT INTO product_pricing (product_id, price_cents, currency, valid_from, valid_to)
VALUES (123, 10500, 'USD', CURDATE() + INTERVAL 1 DAY, NULL);
```

3. **Company master data (DUNs, registration) requires verification before sync.**

```python
async def sync_customer_from_erp(erp_customer_data):
    # 1. Validate registration number
    if not validate_company_registration(erp_customer_data['registration']):
        log_error(f"Invalid registration: {erp_customer_data}")
        return
    
    # 2. Check against existing records to detect duplicates
    existing = find_similar_customers(erp_customer_data['name'])
    if existing:
        log_warning(f"Possible duplicate: {existing}")
    
    # 3. Sync
    customer = sync_or_create_customer(erp_customer_data)
```

### Shipping API Integration

Integrate with 2–3 carriers (DHL, FedEx, UPS). Use carrier APIs to:
- Get real-time rates
- Book shipments
- Generate labels with customs forms
- Track packages

```python
async def get_shipping_quote(po_id: int):
    """Fetch real-time rates from carriers."""
    po = get_po(po_id)
    
    shipment = {
        'origin': po.ship_from_address,
        'destination': po.ship_to_address,
        'weight_kg': calculate_weight(po),
        'dimensions': calculate_dimensions(po),
        'declared_value_cents': po.total_cents,
        'currency': po.currency,
        'incoterm': po.incoterm,
    }
    
    rates = []
    for carrier in ['dhl', 'fedex']:
        rate = await carrier_api.get_rate(shipment)
        rates.append({
            'carrier': carrier,
            'service': rate.service,
            'days': rate.delivery_days,
            'price_cents': rate.price,
            'currency': rate.currency,
        })
    
    return sorted(rates, key=lambda r: r['price_cents'])
```

### Customs & Compliance Screening

Before shipping, screen the order:

1. **Party screening:** Buyer and supplier against OFAC/BIS/EU sanctions lists
2. **Product screening:** HS code and end-use against export control lists
3. **Country validation:** Destination country embargoes, tariff trade agreements

```python
async def screen_order_for_compliance(po_id: int):
    """Run pre-shipment compliance checks."""
    po = get_po(po_id)
    
    # 1. Screen buyer and supplier
    buyer_risk = await compliance_api.screen_party(
        name=po.buyer.name,
        country=po.buyer.country,
        duns=po.buyer.duns_number
    )
    if buyer_risk.is_sanctioned:
        raise ComplianceError(f"Buyer is sanctioned: {buyer_risk.reason}")
    
    # 2. Screen products for export control
    for line_item in po.line_items:
        product_risk = await compliance_api.screen_product(
            hs_code=line_item.product.hs_code,
            destination_country=po.ship_to_address.country,
            end_use=po.end_use_category
        )
        if product_risk.requires_license:
            po.export_license_required = True
            log_warning(f"Export license required for {line_item.product.sku}")
    
    # 3. Check country restrictions
    destination = po.ship_to_address.country
    if is_embargoed(destination):
        raise ComplianceError(f"Shipment to {destination} is prohibited")
    
    # Store screening results
    store_compliance_record(po_id, buyer_risk, product_risk)
```

---

## Document Management

### Storage: Cloud Object Store (S3 or equivalent)

Never store documents in the database. Use S3-compatible storage.

```python
import boto3

s3 = boto3.client('s3')

async def upload_trade_document(po_id: int, file: UploadFile) -> Document:
    """Upload a trade document (invoice, BoL, CoO, etc.)."""
    
    # Validate file type
    allowed_types = {
        'application/pdf': '.pdf',
        'image/jpeg': '.jpg',
        'image/png': '.png',
    }
    if file.content_type not in allowed_types:
        raise ValueError(f"Invalid file type: {file.content_type}")
    
    # Read and hash file
    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()
    
    # Generate S3 key (never reveal internal structure in filename)
    s3_key = f"trade-docs/{po_id}/{uuid.uuid4()}{allowed_types[file.content_type]}"
    
    # Upload with encryption
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=content,
        ContentType=file.content_type,
        ServerSideEncryption='AES256',
        Metadata={
            'po-id': str(po_id),
            'uploaded-by': str(current_user.id),
        }
    )
    
    # Record in database (metadata only, not the file)
    doc = TradeDocument(
        po_id=po_id,
        document_type='commercial_invoice',
        file_name=file.filename,
        file_path=s3_key,
        file_mime_type=file.content_type,
        file_size_bytes=len(content),
        file_hash_sha256=file_hash,
    )
    db.add(doc)
    db.commit()
    
    return doc
```

### Access Control

```python
async def download_trade_document(doc_id: int, current_user: User) -> bytes:
    """Download a trade document with authorization."""
    doc = db.query(TradeDocument).filter(id == doc_id).first()
    if not doc:
        raise NotFound()
    
    po = doc.po
    # Only buyer, supplier, and finance can download
    if current_user.company_id not in [po.buyer_company_id, po.supplier_company_id]:
        raise PermissionDenied()
    
    # Generate pre-signed URL (expires in 1 hour)
    url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': BUCKET_NAME, 'Key': doc.file_path},
        ExpiresIn=3600
    )
    return url
```

---

## Email and Notification System

### Transactional Email Service

Use a service (SendGrid, AWS SES, Mailgun) for reliability and deliverability.

```python
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

async def send_rfq_issued_notification(rfq_id: int):
    """Send email to all suppliers when RFQ is issued."""
    rfq = get_rfq(rfq_id)
    
    template_data = {
        'rfq_number': rfq.rfq_number,
        'buyer_name': rfq.company.name,
        'due_date': rfq.due_date.isoformat(),
        'line_items': [
            {
                'product_name': item.product.name,
                'quantity': item.quantity,
                'unit': item.unit,
            }
            for item in rfq.line_items
        ],
    }
    
    # Send to all suppliers who carry these products
    suppliers = find_suppliers_for_products(rfq.line_items)
    
    for supplier in suppliers:
        message = Mail(
            from_email='rfq@trade-platform.com',
            to_emails=supplier.primary_contact_email,
            subject=f'New RFQ: {rfq.rfq_number}',
            template_id='sendgrid-template-id-rfq',
        )
        message.dynamic_template_data = template_data
        message.add_custom_arg('rfq_id', str(rfq.id))
        message.add_custom_arg('supplier_id', str(supplier.id))
        
        try:
            SendGridAPIClient(SENDGRID_API_KEY).send(message)
        except Exception as e:
            log_error(f"Failed to send RFQ to {supplier.id}: {e}")
```

### Notification Queue

Long-running notifications (order confirmations, shipment tracking) go to a queue:

```python
async def send_order_confirmation(po_id: int):
    """Queue order confirmation email."""
    po = get_po(po_id)
    
    # Push to queue (e.g., Celery, Bull, AWS SQS)
    queue.enqueue(
        'send_email',
        template='order_confirmation',
        to=po.buyer.primary_contact_email,
        data={
            'po_number': po.po_number,
            'supplier_name': po.supplier.name,
            'total': po.total_cents / 100,
            'currency': po.currency,
            'expected_delivery': po.expected_delivery_date.isoformat(),
        },
        retry_count=3,
        retry_delay=300,  # Retry every 5 minutes
    )
```

### Status Webhooks (Optional)

For critical partners, offer webhooks so they can consume order/shipment updates in real time:

```python
async def trigger_webhook(po_id: int, event: str):
    """Send webhook to buyer's webhook endpoint."""
    po = get_po(po_id)
    buyer = po.buyer
    
    if not buyer.webhook_url:
        return  # Buyer hasn't configured webhooks
    
    payload = {
        'event': event,
        'po_number': po.po_number,
        'status': po.status,
        'timestamp': datetime.utcnow().isoformat(),
        'data': po.to_dict(),
    }
    
    # Sign payload with HMAC-SHA256 for security
    signature = hmac.new(
        key=buyer.webhook_secret.encode(),
        msg=json.dumps(payload).encode(),
        digestmod=hashlib.sha256
    ).hexdigest()
    
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                buyer.webhook_url,
                json=payload,
                headers={'X-Signature': signature},
                timeout=10.0,
            )
    except Exception as e:
        log_error(f"Webhook delivery failed for PO {po_id}: {e}")
```

---

## Background Processing

### Job Queue Architecture

Use Redis-backed job queues (BullMQ, Celery) for async tasks:

```
┌─ Web Server
│  ├─ Accept RFQ
│  └─ Enqueue "process_rfq" job
│
├─ Job Queue (Redis)
│  └─ [job_1, job_2, job_3, ...]
│
└─ Worker Processes (N parallel)
   ├─ Worker 1 → Processing RFQ
   ├─ Worker 2 → Syncing prices from ERP
   └─ Worker 3 → Sending compliance screening
```

### Jobs to Queue

```python
class JobType:
    PROCESS_RFQ = "process_rfq"
    SYNC_PRODUCT_PRICING = "sync_product_pricing"
    SCREEN_ORDER_COMPLIANCE = "screen_order_compliance"
    GENERATE_INVOICE = "generate_invoice"
    SEND_ORDER_CONFIRMATION = "send_order_confirmation"
    SYNC_ERP_MASTER_DATA = "sync_erp_master_data"
    UPDATE_SHIPMENT_STATUS = "update_shipment_status"
    CALCULATE_LANDED_COSTS = "calculate_landed_costs"

async def process_rfq_job(rfq_id: int):
    """Background: Validate RFQ, notify suppliers, generate notifications."""
    rfq = get_rfq(rfq_id)
    
    # 1. Validate all line items
    for item in rfq.line_items:
        if not item.product:
            log_error(f"RFQ {rfq_id}: Product not found for line item {item.id}")
            return
    
    # 2. Find suppliers
    suppliers = find_suppliers_for_products(rfq.line_items)
    
    # 3. Send notifications
    for supplier in suppliers:
        queue.enqueue(
            'send_email',
            template='rfq_issued',
            to=supplier.primary_contact_email,
            data={'rfq_number': rfq.rfq_number},
        )
    
    # 4. Update RFQ status
    rfq.status = 'issued'
    db.commit()
    log_info(f"RFQ {rfq_id} issued to {len(suppliers)} suppliers")
```

---

## Caching Strategy

### Multi-Layer Cache

```
Client Browser (HTTP cache: hours)
         ↓
CDN (Cloudflare, CloudFront: minutes)
         ↓
Application Cache (Redis: seconds)
         ↓
Database (disk: always consistent)
```

### Redis Caching for Product Catalog

```python
from redis import Redis
import json

redis_client = Redis(host='localhost', port=6379, db=0)
CACHE_TTL = 3600  # 1 hour

async def get_product(product_id: int):
    """Get product with caching."""
    cache_key = f"product:{product_id}"
    
    # 1. Check cache
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # 2. Query database
    product = db.query(Product).filter(id == product_id).first()
    if not product:
        return None
    
    # 3. Store in cache
    redis_client.setex(
        cache_key,
        CACHE_TTL,
        json.dumps(product.to_dict())
    )
    
    return product.to_dict()

async def invalidate_product_cache(product_id: int):
    """Invalidate cache when product is updated."""
    redis_client.delete(f"product:{product_id}")
```

### Cache Invalidation Pattern

```python
async def update_product(product_id: int, updates: dict):
    """Update product and invalidate cache."""
    product = get_product(product_id)
    for key, value in updates.items():
        setattr(product, key, value)
    db.commit()
    
    # Invalidate cache
    invalidate_product_cache(product_id)
    
    # Also invalidate related caches
    redis_client.delete(f"products:category:{product.category_id}")
    redis_client.delete("products:search:*")  # Pattern delete
```

### Catalog Search Caching

```python
async def search_products(query: str, category_id: int = None, limit: int = 50):
    """Search with caching. Cache key includes all params."""
    cache_key = f"search:{query}:cat:{category_id}:limit:{limit}"
    
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Search (full-text in PostgreSQL or Elasticsearch)
    results = db.query(Product).filter(
        Product.name.ilike(f"%{query}%")
    )
    if category_id:
        results = results.filter(category_id == category_id)
    
    results = results.limit(limit).all()
    
    # Cache for 30 minutes
    redis_client.setex(cache_key, 1800, json.dumps([r.to_dict() for r in results]))
    
    return results
```

---

## Security Requirements

### Mandatory Controls

**1. Input Validation — Everywhere**

```python
from pydantic import BaseModel, Field, EmailStr
from decimal import Decimal

class CreateRFQRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    description: str = Field(..., max_length=2000)
    due_date: date
    destination_country: str = Field(..., regex=r'^[A-Z]{2}$')  # ISO 3166
    incoterm: str = Field(..., regex=r'^(FOB|CIF|DDP|EXW|CIP|FCA)$')
    line_items: list
    
    @validator('due_date')
    def validate_due_date(cls, v):
        if v <= date.today():
            raise ValueError('Due date must be in the future')
        return v
```

**2. Parameterized Queries — Always**

```python
# WRONG: String concatenation
sql = f"SELECT * FROM products WHERE sku = '{user_input}'"  # SQL injection!

# CORRECT: Parameterized
sql = "SELECT * FROM products WHERE sku = %s"
db.execute(sql, (user_input,))
```

**3. Rate Limiting — Per endpoint**

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/v1/auth/login")
@limiter.limit("5/minute")
async def login(credentials: LoginRequest):
    # Brute-force protection
    pass

@app.post("/api/v1/rfqs")
@limiter.limit("100/hour")
async def create_rfq(rfq: CreateRFQRequest, current_user: User):
    # Quota for RFQ creation
    pass
```

**4. HTTPS Only**

```python
@app.middleware("http")
async def force_https(request: Request, call_next):
    if request.url.scheme != "https":
        raise HTTPException(status_code=400, detail="HTTPS required")
    return await call_next(request)
```

**5. CORS & CSRF Protection**

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],  # Whitelist only your domain
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)
```

**6. Secret Management**

Never hardcode API keys, database passwords, or secrets. Use environment variables or a secrets manager:

```python
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL')
SENDGRID_API_KEY = os.getenv('SENDGRID_API_KEY')
JWT_SECRET = os.getenv('JWT_SECRET')

if not all([DATABASE_URL, SENDGRID_API_KEY, JWT_SECRET]):
    raise RuntimeError("Missing required secrets in .env")
```

**7. Logging & Monitoring**

```python
import logging

logger = logging.getLogger(__name__)

try:
    process_payment(po_id)
except Exception as e:
    logger.error(
        f"Payment processing failed",
        exc_info=True,
        extra={'po_id': po_id, 'user_id': current_user.id}
    )
    raise
```

---

## What the Back-end Dev Blocks

These changes **require review and approval** before coding:

1. **Any change to pricing logic or rounding rules.** Margins on international trade are thin; a bug here costs real money.

2. **Changes to the RFQ/PO/Invoice state machine.** State machines must be bulletproof; once shipped, you can't un-ship.

3. **Currency conversion or exchange rate logic.** Verify the math against a financial auditor's checklist.

4. **Compliance screening integration.** Never skip or weaken screening. Flag to the Trade Compliance Officer.

5. **Changes to who can access what data.** All permission changes must be reviewed against the permission matrix.

6. **Modifications to trade document storage or retrieval.** Documents are evidence; they must never be lost or modified.

7. **Authentication/authorization rewrites.** B2B security is not an afterthought.

8. **ERP/CRM sync logic.** A bad sync can corrupt master data across systems.

9. **Shipping or customs API integrations.** These touch real shipments; changes must be tested against live (or sandbox) APIs first.

10. **Database schema changes.** Schema is the contract between services; breaking it breaks everything.

---

## Common Pitfalls

**Pitfall 1: Not storing historical data**
- Trade is audited. Never delete. Use soft deletes and immutable change logs.

**Pitfall 2: Assuming SKUs are unique globally**
- They're not. Always scope SKUs by company or normalize them first.

**Pitfall 3: Computing prices on the fly**
- Always store unit price and line total. Query patterns will demand it.

**Pitfall 4: Ignoring time zones**
- International. Dates must be stored as UTC. Convert to user's time zone on display.

**Pitfall 5: Skipping validation at the API**
- Validate JSON schema, business logic, and authorization at every entry point.

**Pitfall 6: Using floating-point for money**
- Causes rounding errors that compound. Use integers (cents).

**Pitfall 7: Syncing without versioning**
- When you update a product in the ERP, the old version must remain queryable for historical orders.

**Pitfall 8: Trusting external APIs without fallbacks**
- Shipping APIs, compliance services, exchange rate feeds go down. Have a fallback or queue the job for retry.

---

## Research Sources

This reference draws on current B2B e-commerce architecture patterns, multi-currency handling standards, and international trade compliance practices as of 2025–2026:

- [How B2B Ecommerce Software Architecture Supports Enterprise Growth (2025) - Shopify](https://www.shopify.com/enterprise/blog/b2b-ecommerce-software-architecture)
- [Multi-currency database handling best practices - Cardinal](https://cardinalby.github.io/blog/post/best-practices/storing-currency-values-data-types/)
- [REST API design best practices for 2026 - Postman](https://blog.postman.com/rest-api-best-practices/)
- [Product catalog API design with complex attributes - Google Shopping Content API](https://developers.google.com/shopping-content/reference/rest/v2.1/products)
- [B2B Order Management System design - BigCommerce](https://www.bigcommerce.com/articles/b2b-ecommerce/b2b-order-management-software/)
- [B2B Portal authentication and authorization - SSOJet](https://ssojet.com/blog/b2b-authentication-provider-comparison-features-pricing-sso-support)
- [ERP and CRM integration patterns - Endowance](https://www.endowance.com/post/crm-erp-integration-in-the-era-of-global-trade-turbulence-why-it-s-now-a-strategic-imperative)
- [Caching strategies for product catalogs - Medium](https://codefarm0.medium.com/caching-strategies-tools-redis-cdn-f8f86f986c26)
- [Background job processing with Redis - BullMQ](https://bullmq.io/)
- [API security best practices - Security Compass](https://www.securitycompass.com/blog/best-api-security-practices/)
- [REST API error handling and versioning - Speakeasy](https://www.speakeasy.com/api-design/errors)

---

## Questions Before You Code

Before starting any backend feature, ask:

1. **Is there a compliance or regulatory implication?** (Export control, sanctions, tariffs)
2. **Does this touch pricing, currency, or payment logic?** (Requires CFO review)
3. **Does this change who can access what?** (Authorization layer)
4. **Is there an external dependency (API, ERP, shipping)?** (Needs fallback plan)
5. **Does historical data matter here?** (Never hard-delete)
6. **What happens if this fails?** (Error handling, retry logic, monitoring)
7. **Will the database schema scale to 10x current volume?** (Indexes, partitioning)

When in doubt, ask. The cost of a 5-minute review is cheaper than a 5-day production fire.
