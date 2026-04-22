# Trading Company ERP System - Backend

A complete, production-ready backend for a flooring trading business ERP system built with Node.js, Express, PostgreSQL, and Socket.IO.

## Features

### Core Business Functions
- **Customer Management**: Create, manage, and track customers with credit limits and balance tracking
- **Factory Management**: Manage suppliers with performance metrics and certifications
- **Product Catalog**: Comprehensive product database with specifications and pricing
- **Inquiry Management**: Track customer inquiries with conversion to quotations
- **Quotation System**: Create professional quotations with automatic PDF generation
- **Proforma Invoices**: Generate PIs with automatic sales order creation
- **Sales Orders**: Complete order management with status tracking
- **Purchase Orders**: Auto-generated POs linked to sales orders
- **Inventory Management**: Track stock levels, reorder points, and stock movements
- **Shipping & Logistics**: Complete shipment tracking with real-time updates
- **Quality Inspections**: Pre-production, during-production, and pre-shipment inspections
- **Claims Management**: Track and resolve customer quality and delivery claims
- **Financial Management**: Invoice generation, payment tracking, and financial reporting

### Technical Features
- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Admin, Sales, Operations, Finance, Inspector, Customer, Factory roles
- **Real-time Notifications**: Socket.IO integration for live updates
- **Email Notifications**: Automated email alerts for key business events
- **PDF Generation**: Professional document generation for quotations, invoices, and orders
- **File Upload**: Secure file upload handling for documents and images
- **Rate Limiting**: API rate limiting to prevent abuse
- **Error Handling**: Comprehensive error handling with custom error classes
- **Database Validation**: Sequelize model validation and constraints
- **Audit Logging**: Track all user actions and changes
- **Comprehensive Reports**: Sales, purchase, inventory, financial, and customer reports

## Quick Start

### Prerequisites
- Node.js 14+
- PostgreSQL 12+
- npm or yarn

### Installation

1. Clone the repository
```bash
cd backend
npm install
```

2. Configure environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Create database
```bash
createdb trading_erp
```

4. Run migrations and seed data
```bash
npm run seed
```

5. Start the server
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Environment Configuration

Create a `.env` file based on `.env.example`:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trading_erp
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRY=7d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRY=30d

# Server
PORT=5000
NODE_ENV=development

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@tradingErp.com

# File Upload
MAX_FILE_SIZE=52428800
UPLOAD_DIR=./uploads

# Features
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SOCKET_IO=true
ENABLE_PDF_GENERATION=true
```

## Default Credentials

After running seed:
- **Email**: admin@floortrading.com
- **Password**: admin123

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password

### Customers
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Deactivate customer
- `GET /api/customers/:id/balance` - Get customer balance
- `GET /api/customers/:id/order-history` - Get order history
- `GET /api/customers/:id/dashboard` - Get customer dashboard

### Factories
- `GET /api/factories` - List factories
- `POST /api/factories` - Create factory
- `GET /api/factories/:id` - Get factory details
- `PUT /api/factories/:id` - Update factory
- `GET /api/factories/:id/products` - Get factory products
- `POST /api/factories/:id/update-prices` - Update product prices
- `GET /api/factories/:id/performance` - Get performance metrics

### Products
- `GET /api/products` - List products
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product
- `GET /api/products/search` - Search products
- `GET /api/products/:id/price-history` - Get price history
- `GET /api/products/category/:categoryId` - Get products by category
- `POST /api/products/bulk-update` - Bulk update products

### Inquiries
- `GET /api/inquiries` - List inquiries
- `POST /api/inquiries` - Create inquiry
- `GET /api/inquiries/:id` - Get inquiry details
- `PATCH /api/inquiries/:id/status` - Update inquiry status
- `POST /api/inquiries/:id/follow-up` - Schedule follow-up
- `POST /api/inquiries/:id/convert-to-quotation` - Convert to quotation
- `GET /api/inquiries/:id/timeline` - Get timeline

### Quotations
- `GET /api/quotations` - List quotations
- `POST /api/quotations` - Create quotation
- `GET /api/quotations/:id` - Get quotation details
- `PUT /api/quotations/:id` - Update quotation
- `POST /api/quotations/:id/send` - Send quotation
- `PATCH /api/quotations/:id/accept` - Accept quotation
- `PATCH /api/quotations/:id/reject` - Reject quotation
- `POST /api/quotations/:id/duplicate` - Duplicate quotation
- `POST /api/quotations/:id/convert-to-pi` - Convert to PI
- `GET /api/quotations/:id/pdf` - Generate PDF

### Sales Orders
- `GET /api/sales-orders` - List sales orders
- `GET /api/sales-orders/:id` - Get order details
- `PATCH /api/sales-orders/:id/status` - Update order status
- `GET /api/sales-orders/:id/timeline` - Get timeline
- `GET /api/sales-orders/:id/documents` - Get shipping documents

### Purchase Orders
- `GET /api/purchase-orders` - List purchase orders
- `GET /api/purchase-orders/:id` - Get PO details
- `PATCH /api/purchase-orders/:id/status` - Update status
- `POST /api/purchase-orders/:id/send` - Send PO
- `GET /api/purchase-orders/:id/pdf` - Generate PDF

### Shipments
- `GET /api/shipments` - List shipments
- `GET /api/shipments/:id` - Get shipment details
- `POST /api/shipments` - Create shipment
- `POST /api/shipments/:id/tracking` - Add tracking event
- `GET /api/shipments/:id/tracking-history` - Get tracking history

### Inspections
- `GET /api/inspections` - List inspections
- `POST /api/inspections` - Create inspection
- `GET /api/inspections/:id` - Get inspection details
- `PATCH /api/inspections/:id/start` - Start inspection
- `PATCH /api/inspections/:id/complete` - Complete inspection
- `POST /api/inspections/:id/items/:itemId` - Update inspection item
- `GET /api/inspections/:id/report` - Get inspection report

### Invoices & Payments
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice details
- `POST /api/invoices/:id/record-payment` - Record payment
- `GET /api/invoices/:id/aging` - Get aging report
- `GET /api/invoices/:id/overdue` - Get overdue invoices
- `GET /api/payments` - List payments
- `PATCH /api/payments/:id/confirm` - Confirm payment
- `PATCH /api/payments/:id/reject` - Reject payment

### Claims
- `GET /api/claims` - List claims
- `POST /api/claims` - Create claim
- `GET /api/claims/:id` - Get claim details
- `PATCH /api/claims/:id/status` - Update claim status
- `PATCH /api/claims/:id/resolve` - Resolve claim

### Notifications
- `GET /api/notifications` - Get notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/all/mark-read` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification

### Dashboard & Reports
- `GET /api/dashboard/admin` - Admin dashboard
- `GET /api/dashboard/sales` - Sales dashboard
- `GET /api/dashboard/operations` - Operations dashboard
- `GET /api/dashboard/finance` - Finance dashboard
- `GET /api/dashboard/customer/:customerId` - Customer dashboard
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/purchase` - Purchase report
- `GET /api/reports/inventory` - Inventory report
- `GET /api/reports/financial` - Financial report
- `GET /api/reports/customer/:customerId` - Customer report
- `GET /api/reports/factory/:factoryId` - Factory report

## Database Models

### Core Models
- **User**: System users with roles and permissions
- **Customer**: Customer/buyer information
- **Factory**: Supplier/manufacturer information
- **Product**: Product catalog with specifications
- **ProductCategory**: Product categorization
- **ProductPrice**: Price history and management

### Sales Process
- **Inquiry**: Customer inquiries
- **InquiryItem**: Line items in inquiries
- **Quotation**: Sales quotations
- **QuotationItem**: Line items in quotations
- **ProformaInvoice**: Proforma invoices
- **ProformaInvoiceItem**: Line items in PI
- **SalesOrder**: Customer orders
- **SalesOrderItem**: Line items in sales orders

### Purchase Process
- **PurchaseOrder**: Factory orders
- **PurchaseOrderItem**: Line items in PO

### Logistics
- **PackingList**: Shipment packing details
- **PackingListItem**: Items in packing list
- **Shipment**: Shipment information
- **ShipmentTracking**: Real-time tracking events
- **ShippingDocument**: BL, COO, etc.

### Quality & Claims
- **Inspection**: Quality inspections
- **InspectionItem**: Inspection check points
- **InspectionReport**: Inspection reports
- **Claim**: Customer claims

### Financial
- **Invoice**: Sales and purchase invoices
- **Payment**: Payment records

### Other
- **Notification**: System notifications
- **AuditLog**: User action audit trail
- **InventoryItem**: Stock levels
- **InventoryTransaction**: Stock movements

## Project Structure

```
backend/
├── models/              # Sequelize models
├── controllers/         # Route handlers
├── routes/             # API routes
├── services/           # Business logic
├── middleware/         # Express middleware
├── utils/              # Utility functions
├── seeds/              # Database seeders
├── config/             # Configuration files
├── uploads/            # File uploads directory
├── server.js           # Main server file
├── package.json        # Dependencies
└── README.md          # This file
```

## Security Features

- **Password Hashing**: Bcrypt for secure password storage
- **JWT Tokens**: Secure stateless authentication
- **Rate Limiting**: Prevent brute force attacks
- **CORS**: Cross-origin resource sharing configuration
- **Helmet**: Security headers middleware
- **Input Validation**: Express-validator for request validation
- **Role-Based Access Control**: Fine-grained permission control
- **Audit Logging**: Track all changes
- **SQL Injection Protection**: Parameterized queries via Sequelize

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
Make sure PostgreSQL is running and credentials are correct in .env

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
Change PORT in .env or kill the process using the port

### Authentication Failed
```
Error: Invalid token
```
Make sure JWT_SECRET in .env is set correctly

## License

MIT

## Support

For issues and questions, contact the development team.
