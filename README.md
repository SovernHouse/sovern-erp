# Trading ERP System - Complete Documentation

A comprehensive Enterprise Resource Planning (ERP) system designed specifically for trading companies. This system manages the complete supply chain from customer inquiries through to delivery and claims, with integrated document management, shipment tracking, and financial reporting.

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Features](#features)
4. [Tech Stack](#tech-stack)
5. [Prerequisites](#prerequisites)
6. [Quick Start](#quick-start)
7. [Project Structure](#project-structure)
8. [Module Documentation](#module-documentation)
9. [API Documentation](#api-documentation)
10. [Portals & Applications](#portals--applications)
11. [Document Flow](#document-flow)
12. [Configuration](#configuration)
13. [Deployment](#deployment)
14. [Support](#support)

---

## Project Overview

### Sovern House ERP System

The Trading ERP System is a full-featured enterprise resource planning solution built for modern trading companies. It streamlines operations across sales, purchasing, logistics, and finance with an intuitive user interface and powerful automation capabilities.

**Key Highlights:**
- Multi-tenant support with role-based access control
- Real-time shipment tracking with vessel integration
- Comprehensive document management for international trade
- Advanced customer relationship management
- Intelligent quotation-to-order pipeline
- Full audit trail and compliance reporting
- Multi-language and multi-currency support

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRADING ERP SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐      ┌──────────────────┐                │
│  │  Admin Portal    │      │   API Server     │                │
│  │  (localhost:3000)│◄────►│  (localhost:3001)│                │
│  └──────────────────┘      └────────┬─────────┘                │
│                                     │                           │
│  ┌──────────────────┐      ┌────────▼─────────┐                │
│  │Customer Portal   │      │   PostgreSQL     │                │
│  │(localhost:3002)  │      │  (Port: 5432)    │                │
│  └──────────────────┘      └──────────────────┘                │
│           ▲                                                     │
│           │              ┌──────────────────┐                  │
│           └─────────────►│     Redis        │                  │
│                          │  (Port: 6379)    │                  │
│  ┌──────────────────┐    └──────────────────┘                  │
│  │ Factory Portal   │                                          │
│  │(localhost:3003)  │    ┌──────────────────┐                  │
│  └──────────────────┘    │   Nginx Proxy    │                  │
│           ▲               │  (Port: 80/443)  │                  │
│           │              └──────────────────┘                  │
│           └──────────────────────────────────────┐             │
│                                                  │             │
│  ┌──────────────────────────────────────────────▼─┐            │
│  │          External Integrations                 │            │
│  │  - Email (SMTP)                               │            │
│  │  - SMS Gateway (Twilio)                       │            │
│  │  - Cloud Storage (AWS S3)                     │            │
│  │  - Payment Gateway (Stripe)                   │            │
│  │  - Document Generation                       │            │
│  └──────────────────────────────────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Data Flow:
  Customer App ◄────► API Server ◄────► Database
  Admin Portal ◄────► API Server ◄────► Database
  Factory App ◄────► API Server ◄────► Database
```

---

## Features

### 1. Customer Management & CRM
- Comprehensive customer profiles and contact information
- Lead management with conversion tracking
- Deal pipeline management with visual boards
- Activity tracking (calls, emails, meetings)
- Email marketing campaign management
- Customer segmentation and filtering

### 2. Inquiry Management
- Receive and track customer inquiries
- Automatic follow-up reminders
- Inquiry categorization and assignment
- Conversion tracking to quotation
- Inquiry analytics and reporting

### 3. Quotation Management
- Create detailed quotations from inquiries
- Auto-populate from inquiry details
- Version tracking and revision history
- Electronic signature for acceptance
- Quotation expiry date management
- Bulk quotation generation

### 4. Proforma Invoice (PI)
- Generate PIs from accepted quotations
- Bank details and payment terms
- PI confirmation and acceptance
- PI numbering and tracking
- Multi-currency support

### 5. Sales Order Management
- Full order lifecycle management
- Order confirmation and acknowledgment
- Delivery schedule management
- Order modification and version control
- Order status tracking
- Linked to shipping and invoicing

### 6. Purchase Order Management
- Auto-generate POs to factories
- Split order handling
- Supplier/factory management
- PO confirmation and acknowledgment
- Delivery tracking
- Variance analysis

### 7. Packing List
- Package allocation and management
- Weight and dimension tracking
- Package numbering and barcoding
- HSCode and description details
- Carton management
- Packing verification

### 8. Shipping & Logistics
- Shipment creation and tracking
- Vessel and container management
- Bill of Lading (B/L) generation
- Port details and dates
- Real-time tracking updates
- Multi-leg shipment support

### 9. Document Management
- Centralized document storage
- Trade document management:
  - Bill of Lading (B/L)
  - Certificate of Origin (COO)
  - Insurance certificates
  - Customs documents
  - Inspection reports
  - Invoices and receipts
- Document versioning
- Digital signature support

### 10. Inspection & QC
- Inspection scheduling
- Quality check result recording
- Defect tracking and documentation
- Inspection report generation
- Pass/Fail status management
- Inspector assignment

### 11. Claims Management
- Customer claim submission
- Claim investigation workflow
- Resolution tracking
- Claim documentation
- Status notifications
- Analytics and reporting

### 12. Invoice & Payment
- Sales invoice generation
- Purchase invoice recording
- Payment tracking and recording
- Multiple payment method support
- Aging analysis (AR/AP)
- Payment reconciliation
- Invoice numbering and customization

### 13. Inventory Management
- Stock level tracking
- Reorder point alerts
- Inventory adjustments
- Stock transfers
- Warehouse management
- FIFO tracking

### 14. Financial Reporting
- Profit & Loss (P&L) statements
- Accounts Receivable (AR) aging
- Accounts Payable (AP) aging
- Revenue analysis
- Expense tracking
- Custom report builder

### 15. User & Access Control
- Role-based access control (RBAC)
- User management and provisioning
- Permission assignment
- Activity logging
- Session management
- Two-factor authentication (optional)

### 16. Multilingual Support
- English
- Mandarin Chinese
- Spanish
- French
- German
- Portuguese

---

## Tech Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **ORM**: Sequelize or TypeORM
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Authentication**: JWT
- **Validation**: Joi/Zod
- **File Upload**: Multer/AWS S3
- **PDF Generation**: Puppeteer
- **Email**: Nodemailer
- **Task Queue**: Bull/RabbitMQ

### Frontend
- **Framework**: React 18+
- **Build Tool**: Vite
- **State Management**: Redux Toolkit or Zustand
- **UI Library**: Material-UI or Tailwind CSS
- **Charts**: Chart.js or Recharts
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **Routing**: React Router v6

### Mobile (React Native)
- **Customer Mobile App**: React Native
- **Factory Mobile App**: React Native
- **Platform**: iOS/Android

### DevOps
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx
- **Monitoring**: ELK Stack (optional)
- **CI/CD**: GitHub Actions/GitLab CI

---

## Prerequisites

### Minimum Requirements
- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **PostgreSQL**: 15.0 or higher (or Docker)
- **Redis**: 7.0 or higher (or Docker)
- **Disk Space**: 2GB minimum

### Recommended System Requirements
- **OS**: Linux, macOS, or Windows 10+
- **RAM**: 4GB minimum, 8GB recommended
- **Processor**: 2 cores minimum, 4+ cores recommended
- **Storage**: SSD for optimal performance

### Required Software
```bash
# Check Node.js version
node --version  # Should be v18.0.0 or higher

# Check npm version
npm --version   # Should be 9.0.0 or higher

# PostgreSQL (if not using Docker)
psql --version  # Should be 15.0 or higher
```

### Optional Software
- **Docker**: 20.10+ (for containerized setup)
- **Docker Compose**: 2.0+ (for multi-container orchestration)
- **Git**: 2.30+ (for version control)
- **VS Code**: Latest (recommended IDE)

---

## Quick Start

### Option 1: Local Development Setup

#### macOS/Linux

```bash
# 1. Clone the repository
git clone https://github.com/your-org/trading-erp.git
cd trading-erp

# 2. Run setup script
chmod +x scripts/setup.sh
./scripts/setup.sh

# 3. Start development servers
npm run dev
```

#### Windows

```bash
# 1. Clone the repository
git clone https://github.com/your-org/trading-erp.git
cd trading-erp

# 2. Run setup script
scripts/setup.bat

# 3. Start development servers
npm run dev
```

### Option 2: Docker Setup (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/trading-erp.git
cd trading-erp

# 2. Create .env file
cp .env.example .env

# 3. Start all services
npm run docker:up

# 4. View logs
npm run docker:logs

# 5. Stop services
npm run docker:down
```

### Access the System

Once setup is complete, access the portals at:

| Portal | URL | Username | Password |
|--------|-----|----------|----------|
| Admin | http://localhost:3000 | admin@floortrading.com | admin123 |
| Customer | http://localhost:3002 | customer@example.com | customer123 |
| Factory | http://localhost:3003 | factory@example.com | factory123 |
| API | http://localhost:3001 | - | - |

---

## Project Structure

```
trading-erp/
├── backend/                          # Node.js Backend
│   ├── src/
│   │   ├── config/                  # Configuration files
│   │   ├── controllers/             # Route controllers
│   │   ├── models/                  # Database models
│   │   ├── routes/                  # API routes
│   │   ├── middleware/              # Express middleware
│   │   ├── services/                # Business logic
│   │   ├── utils/                   # Utility functions
│   │   ├── seeders/                 # Database seeders
│   │   ├── migrations/              # Database migrations
│   │   ├── validators/              # Input validators
│   │   ├── templates/               # Email/Document templates
│   │   └── server.js                # Express app setup
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
│
├── portals/
│   ├── admin/                        # Admin Portal (React)
│   │   ├── src/
│   │   │   ├── components/          # React components
│   │   │   ├── pages/               # Page components
│   │   │   ├── hooks/               # Custom hooks
│   │   │   ├── store/               # Redux/Zustand store
│   │   │   ├── services/            # API services
│   │   │   ├── utils/               # Utilities
│   │   │   ├── styles/              # CSS/Styling
│   │   │   ├── App.jsx
│   │   │   └── main.jsx
│   │   ├── index.html
│   │   ├── vite.config.js
│   │   ├── package.json
│   │   └── .gitignore
│   │
│   ├── customer/                    # Customer Portal (React)
│   │   └── [Similar structure to admin]
│   │
│   └── factory/                     # Factory Portal (React)
│       └── [Similar structure to admin]
│
├── docker/
│   ├── nginx.conf                   # Nginx reverse proxy config
│   ├── Dockerfile.backend           # Backend Docker image
│   ├── Dockerfile.frontend          # Frontend Docker image
│   └── ssl/                         # SSL certificates (for production)
│
├── scripts/
│   ├── setup.sh                     # macOS/Linux setup script
│   ├── setup.bat                    # Windows setup script
│   ├── reset-db.sh                  # Database reset script
│   └── deploy.sh                    # Deployment script
│
├── docs/
│   ├── API_REFERENCE.md             # API endpoints documentation
│   ├── DATABASE_SCHEMA.md           # Database schema
│   ├── USER_GUIDE.md                # User guides
│   ├── DEVELOPER_GUIDE.md           # Developer documentation
│   ├── DEPLOYMENT.md                # Deployment guide
│   └── TROUBLESHOOTING.md           # Troubleshooting guide
│
├── uploads/                         # File uploads directory
├── logs/                            # Application logs
├── docker-compose.yml               # Docker Compose configuration
├── package.json                     # Root package.json
├── .env.example                     # Environment variables template
├── .gitignore                       # Git ignore rules
└── README.md                        # This file
```

---

## Module Documentation

### 1. Customer Management & CRM
**Location**: `backend/src/modules/customer`

Manages all customer-related data including profiles, contacts, interactions, and deals. Features include:
- Customer database with contact information
- Lead tracking from inquiry to customer
- Sales pipeline management
- Activity logging (calls, emails, meetings)
- Customer segmentation
- Email campaigns

**Key Tables**:
- customers
- contacts
- leads
- deals
- activities
- campaigns

---

### 2. Inquiry Management
**Location**: `backend/src/modules/inquiry`

Handles incoming customer inquiries and converts them to quotations.

**Key Tables**:
- inquiries
- inquiry_details
- inquiry_attachments

---

### 3. Quotation Management
**Location**: `backend/src/modules/quotation`

Manage quotations with versioning and digital signatures.

**Key Tables**:
- quotations
- quotation_items
- quotation_revisions

---

### 4. Proforma Invoice
**Location**: `backend/src/modules/proforma-invoice`

Generate PIs from accepted quotations.

**Key Tables**:
- proforma_invoices
- proforma_invoice_items

---

### 5. Sales Order Management
**Location**: `backend/src/modules/sales-order`

Complete sales order lifecycle management.

**Key Tables**:
- sales_orders
- sales_order_items
- order_deliveries

---

### 6. Purchase Order Management
**Location**: `backend/src/modules/purchase-order`

PO creation and management for factory orders.

**Key Tables**:
- purchase_orders
- purchase_order_items
- po_confirmations

---

### 7. Packing List
**Location**: `backend/src/modules/packing`

Package allocation and tracking.

**Key Tables**:
- packing_lists
- packages
- package_items

---

### 8. Shipping & Logistics
**Location**: `backend/src/modules/shipping`

Shipment tracking with vessel integration.

**Key Tables**:
- shipments
- shipment_legs
- vessels
- containers
- bills_of_lading

---

### 9. Document Management
**Location**: `backend/src/modules/documents`

Centralized document storage and retrieval.

**Key Tables**:
- documents
- document_attachments
- document_signatures

---

### 10. Inspection & QC
**Location**: `backend/src/modules/inspection`

Quality control and inspection management.

**Key Tables**:
- inspections
- inspection_results
- inspection_defects

---

### 11. Claims Management
**Location**: `backend/src/modules/claims`

Customer claim submission and resolution.

**Key Tables**:
- claims
- claim_details
- claim_resolutions

---

### 12. Invoice & Payment
**Location**: `backend/src/modules/invoice`

Sales and purchase invoicing with payment tracking.

**Key Tables**:
- invoices
- invoice_items
- payments
- payment_methods

---

### 13. Inventory Management
**Location**: `backend/src/modules/inventory`

Stock level tracking and management.

**Key Tables**:
- inventory
- warehouse_locations
- inventory_movements

---

### 14. Financial Reporting
**Location**: `backend/src/modules/reporting`

Financial statements and analysis.

**Key Reports**:
- Profit & Loss
- AR Aging
- AP Aging
- Revenue Analysis

---

### 15. User & Access Control
**Location**: `backend/src/modules/users`

User management and RBAC.

**Key Tables**:
- users
- roles
- permissions
- role_permissions

**Available Roles**:
- Admin - Full system access
- Sales Manager - Sales operations
- Operations Manager - Order fulfillment
- Finance Manager - Financial operations
- Inspector - Quality inspection
- Customer - Self-service customer portal
- Factory - Supplier portal access

---

### 16. Multilingual Support
**Location**: `backend/src/i18n`

Multi-language support across the system.

**Supported Languages**:
- English (en)
- Mandarin Chinese (zh)
- Spanish (es)
- French (fr)
- German (de)
- Portuguese (pt)

---

## API Documentation

### Authentication

All API endpoints (except login/register) require JWT authentication:

```bash
Authorization: Bearer <jwt_token>
```

### Authentication Endpoints

#### Login
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@floortrading.com",
  "password": "admin123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": {
    "id": "user_123",
    "email": "admin@floortrading.com",
    "role": "admin"
  }
}
```

#### Register
```
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Refresh Token
```
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "..."
}
```

#### Logout
```
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

---

### Customer Endpoints

#### List Customers
```
GET /api/v1/customers?page=1&limit=20&search=keyword
Authorization: Bearer <token>
```

#### Get Customer
```
GET /api/v1/customers/:id
Authorization: Bearer <token>
```

#### Create Customer
```
POST /api/v1/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Acme Corporation",
  "email": "contact@acme.com",
  "phone": "+1-555-0100",
  "address": "123 Trade Street",
  "city": "Commerce",
  "country": "USA"
}
```

#### Update Customer
```
PUT /api/v1/customers/:id
Authorization: Bearer <token>
Content-Type: application/json
```

#### Delete Customer
```
DELETE /api/v1/customers/:id
Authorization: Bearer <token>
```

---

### Inquiry Endpoints

#### List Inquiries
```
GET /api/v1/inquiries?page=1&limit=20&status=pending
Authorization: Bearer <token>
```

#### Get Inquiry
```
GET /api/v1/inquiries/:id
Authorization: Bearer <token>
```

#### Create Inquiry
```
POST /api/v1/inquiries
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "cust_123",
  "productCategory": "fabric",
  "quantity": 1000,
  "unit": "meters",
  "specifications": "100% cotton, color blue",
  "requiredDeliveryDate": "2024-04-30"
}
```

#### Convert Inquiry to Quotation
```
POST /api/v1/inquiries/:id/convert-to-quotation
Authorization: Bearer <token>
```

---

### Quotation Endpoints

#### List Quotations
```
GET /api/v1/quotations?page=1&limit=20&status=draft
Authorization: Bearer <token>
```

#### Get Quotation
```
GET /api/v1/quotations/:id
Authorization: Bearer <token>
```

#### Create Quotation
```
POST /api/v1/quotations
Authorization: Bearer <token>
Content-Type: application/json

{
  "inquiryId": "inq_123",
  "items": [
    {
      "productId": "prod_123",
      "quantity": 1000,
      "unitPrice": 2.50,
      "currency": "USD"
    }
  ],
  "paymentTerms": "Net 30",
  "expiryDate": "2024-03-31"
}
```

#### Send Quotation
```
POST /api/v1/quotations/:id/send
Authorization: Bearer <token>
```

#### Accept Quotation
```
POST /api/v1/quotations/:id/accept
Authorization: Bearer <token>
```

#### Reject Quotation
```
POST /api/v1/quotations/:id/reject
Authorization: Bearer <token>
```

---

### Sales Order Endpoints

#### List Sales Orders
```
GET /api/v1/sales-orders?page=1&limit=20&status=confirmed
Authorization: Bearer <token>
```

#### Get Sales Order
```
GET /api/v1/sales-orders/:id
Authorization: Bearer <token>
```

#### Create Sales Order
```
POST /api/v1/sales-orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "quotationId": "quo_123",
  "deliveryAddress": "456 Business Ave",
  "deliveryDate": "2024-04-30",
  "specialInstructions": "Handle with care"
}
```

#### Confirm Sales Order
```
POST /api/v1/sales-orders/:id/confirm
Authorization: Bearer <token>
```

#### Cancel Sales Order
```
POST /api/v1/sales-orders/:id/cancel
Authorization: Bearer <token>
```

---

### Purchase Order Endpoints

#### List Purchase Orders
```
GET /api/v1/purchase-orders?page=1&limit=20&status=pending
Authorization: Bearer <token>
```

#### Get Purchase Order
```
GET /api/v1/purchase-orders/:id
Authorization: Bearer <token>
```

#### Create Purchase Order
```
POST /api/v1/purchase-orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "salesOrderId": "so_123",
  "factoryId": "fact_123",
  "items": [
    {
      "salesOrderItemId": "soi_123",
      "quantity": 500,
      "unitPrice": 1.80
    }
  ],
  "deliveryDate": "2024-04-15"
}
```

---

### Shipment Endpoints

#### List Shipments
```
GET /api/v1/shipments?page=1&limit=20&status=in-transit
Authorization: Bearer <token>
```

#### Get Shipment
```
GET /api/v1/shipments/:id
Authorization: Bearer <token>
```

#### Create Shipment
```
POST /api/v1/shipments
Authorization: Bearer <token>
Content-Type: application/json

{
  "salesOrderId": "so_123",
  "vessel": "MV Ocean Express",
  "containerNo": "CONT123456",
  "departureDate": "2024-04-20",
  "eta": "2024-05-15"
}
```

#### Update Shipment Status
```
PATCH /api/v1/shipments/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "in-transit",
  "currentLocation": "Singapore",
  "eta": "2024-05-18"
}
```

---

### Invoice Endpoints

#### List Invoices
```
GET /api/v1/invoices?page=1&limit=20&type=sales
Authorization: Bearer <token>
```

#### Get Invoice
```
GET /api/v1/invoices/:id
Authorization: Bearer <token>
```

#### Create Invoice
```
POST /api/v1/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "salesOrderId": "so_123",
  "invoiceDate": "2024-03-16",
  "dueDate": "2024-04-15",
  "notes": "Payment via bank transfer"
}
```

#### Record Payment
```
POST /api/v1/invoices/:id/payments
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 5000.00,
  "paymentDate": "2024-03-20",
  "method": "bank_transfer",
  "reference": "TXN123456"
}
```

---

### Document Endpoints

#### List Documents
```
GET /api/v1/documents?page=1&limit=20&type=bill_of_lading
Authorization: Bearer <token>
```

#### Get Document
```
GET /api/v1/documents/:id
Authorization: Bearer <token>
```

#### Upload Document
```
POST /api/v1/documents
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "file": <binary>,
  "documentType": "bill_of_lading",
  "relatedId": "ship_123",
  "description": "Original B/L for shipment"
}
```

#### Download Document
```
GET /api/v1/documents/:id/download
Authorization: Bearer <token>
```

---

### Report Endpoints

#### P&L Report
```
GET /api/v1/reports/profit-loss?startDate=2024-01-01&endDate=2024-03-31
Authorization: Bearer <token>
```

#### AR Aging Report
```
GET /api/v1/reports/ar-aging
Authorization: Bearer <token>
```

#### AP Aging Report
```
GET /api/v1/reports/ap-aging
Authorization: Bearer <token>
```

#### Revenue Report
```
GET /api/v1/reports/revenue?period=monthly&startDate=2024-01-01
Authorization: Bearer <token>
```

---

## Portals & Applications

### Admin Portal (localhost:3000)

**Purpose**: Internal staff dashboard with full system management capabilities

**Features**:
- Complete customer, inquiry, and order management
- User and permission management
- Financial reporting and analysis
- System configuration
- Audit logs and activity tracking
- Data export and reporting

**Modules**:
- Dashboard with KPIs
- Customer Management
- Sales Management
- Operations
- Finance
- Inventory
- Settings & Configuration
- User Management
- Reports

**Access**: Admin role only

---

### Customer Portal (localhost:3002)

**Purpose**: Self-service portal for customers

**Features**:
- View personal profile and history
- Browse and create inquiries
- Track quotations
- Submit purchase orders
- Track order status and delivery
- Access order documents
- Submit and track claims
- View invoices and payment history
- Messaging with sales team

**Modules**:
- Dashboard with order summary
- Inquiries
- Quotations
- Orders
- Shipments
- Documents
- Claims
- Invoices
- Messages

**Access**: Customer role

---

### Factory Portal (localhost:3003)

**Purpose**: Supplier/factory management portal

**Features**:
- Receive and manage purchase orders
- Upload production updates
- Submit shipping documents
- Quality control and inspection
- Messaging with operations team
- Document management

**Modules**:
- Dashboard with PO summary
- Purchase Orders
- Production Updates
- Quality Control
- Shipping
- Documents
- Messages

**Access**: Factory role

---

### Customer Mobile App

**Platform**: iOS & Android (React Native)

**Features**:
- Order tracking with real-time updates
- Inquiry submission
- Document access
- Push notifications
- Offline capability (limited)
- Visual shipment tracking

---

### Factory Mobile App

**Platform**: iOS & Android (React Native)

**Features**:
- PO management
- Production updates
- Document upload
- Quality check recording
- Real-time notifications

---

## Document Flow

```
Customer Inquiry
      │
      ├─► Quotation Creation
      │        │
      │        ├─► Quotation Review (Customer)
      │        │
      │        └─► Quotation Acceptance
      │             │
      └─────────────┤
                    │
              Proforma Invoice (PI)
                    │
                    ├─► PI Confirmation
                    │
                    ├─► Sales Order Creation
                    │   (Internal)
                    │
                    ├─► Purchase Order Creation
                    │   (To Factory)
                    │
                    └─────┬────────────────┐
                          │                │
                    Packing List      Factory Receipt
                          │                │
                          └────────┬───────┘
                                   │
                          Bill of Lading
                                   │
                          Shipment Tracking
                                   │
                                   ├─► Port of Origin
                                   ├─► In Transit
                                   └─► Port of Destination
                                           │
                                    Inspection Report
                                           │
                                    Customer Delivery
                                           │
                                    Sales Invoice
                                           │
                                    Payment Recording
                                           │
                                    (Optional) Claims
```

---

## Configuration

### Company Branding

Edit `/backend/config/company.js`:
```javascript
module.exports = {
  name: 'Trading Company LLC',
  logo: 'https://example.com/logo.png',
  address: '123 Trade Street',
  phone: '+1-555-0100',
  email: 'info@tradingerp.com',
  website: 'https://tradingerp.com',
  taxId: 'XX-XXXXXXX'
};
```

### Email Templates

Located in `/backend/templates/emails/`

Customize:
- Invoice email templates
- Order confirmation
- Shipment updates
- Payment reminders
- System notifications

### Document Templates

Located in `/backend/templates/documents/`

Customize:
- Bill of Lading
- Proforma Invoice
- Sales Invoice
- Packing List
- Certificate of Origin

### Tax Rates

Edit `/backend/config/tax.js`:
```javascript
module.exports = {
  defaultRate: 0.10,
  currency: 'USD',
  rates: {
    'US': 0.10,
    'UK': 0.20,
    'DE': 0.19
  }
};
```

---

## Deployment

### Docker Deployment

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Update environment variables:
   - Database credentials
   - JWT secrets
   - Email configuration
   - AWS S3 credentials
   - API endpoints

### Database Backup & Restore

```bash
# Backup
pg_dump -h localhost -U postgres trading_erp > backup.sql

# Restore
psql -h localhost -U postgres trading_erp < backup.sql
```

### Production Checklist

- [ ] Set NODE_ENV=production
- [ ] Update JWT_SECRET with strong random value
- [ ] Configure SSL certificates
- [ ] Set up email provider (SMTP)
- [ ] Configure database backups
- [ ] Set up monitoring and alerts
- [ ] Enable audit logging
- [ ] Configure CORS properly
- [ ] Set up error tracking (Sentry)
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Test disaster recovery

---

## Support

### Documentation

- **API Reference**: See `docs/API_REFERENCE.md`
- **Database Schema**: See `docs/DATABASE_SCHEMA.md`
- **User Guide**: See `docs/USER_GUIDE.md`

### Support Channels

- **Email**: support@tradingerp.com
- **Documentation**: https://docs.tradingerp.com
- **Community Forum**: https://forum.tradingerp.com

### Reporting Issues

For bug reports, feature requests, and support:
1. Check existing issues
2. Provide detailed reproduction steps
3. Include system information and logs
4. Contact support team

---

## License

This software is proprietary and confidential. Unauthorized use is prohibited.

© 2024 Trading Company LLC. All rights reserved.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-03-16 | Initial release |

---

**Last Updated**: March 16, 2024
