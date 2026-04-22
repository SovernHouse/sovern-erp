# Trading ERP System - API Reference

Complete API endpoint documentation for the Trading ERP System.

**Base URL**: `http://localhost:3001/api/v1`

**Authentication**: JWT Bearer Token (except for login/register endpoints)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Customers](#customers)
3. [Inquiries](#inquiries)
4. [Quotations](#quotations)
5. [Proforma Invoices](#proforma-invoices)
6. [Sales Orders](#sales-orders)
7. [Purchase Orders](#purchase-orders)
8. [Packing Lists](#packing-lists)
9. [Shipments](#shipments)
10. [Documents](#documents)
11. [Invoices](#invoices)
12. [Payments](#payments)
13. [Inspection](#inspection)
14. [Claims](#claims)
15. [Inventory](#inventory)
16. [Reports](#reports)
17. [Users](#users)
18. [Roles & Permissions](#roles--permissions)

---

## Authentication

### Login

**Endpoint**: `POST /auth/login`

**Description**: Authenticate user and receive JWT token

**Request Body**:
```json
{
  "email": "admin@floortrading.com",
  "password": "admin123"
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800,
  "user": {
    "id": "usr_123abc",
    "email": "admin@floortrading.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "admin",
    "status": "active"
  }
}
```

**Errors**:
- `400 Bad Request` - Invalid email or password
- `429 Too Many Requests` - Rate limit exceeded

---

### Register

**Endpoint**: `POST /auth/register`

**Description**: Create new user account

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "firstName": "Jane",
  "lastName": "Smith",
  "companyName": "Acme Corp"
}
```

**Response** (201 Created):
```json
{
  "id": "usr_456def",
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "status": "pending_verification"
}
```

---

### Refresh Token

**Endpoint**: `POST /auth/refresh`

**Description**: Refresh expired JWT token

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 604800
}
```

---

### Logout

**Endpoint**: `POST /auth/logout`

**Authentication**: Required

**Description**: Logout user and invalidate token

**Response** (200 OK):
```json
{
  "message": "Successfully logged out"
}
```

---

### Get Current User

**Endpoint**: `GET /auth/me`

**Authentication**: Required

**Description**: Get authenticated user profile

**Response** (200 OK):
```json
{
  "id": "usr_123abc",
  "email": "admin@floortrading.com",
  "firstName": "John",
  "lastName": "Doe",
  "role": "admin",
  "permissions": ["manage_users", "manage_settings", "view_reports"],
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

---

## Customers

### List Customers

**Endpoint**: `GET /customers`

**Authentication**: Required

**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 20, max: 100)
- `search` (string) - Search by name or email
- `status` (string) - active, inactive
- `sortBy` (string) - name, createdAt
- `sortOrder` (string) - asc, desc

**Example**: `GET /customers?page=1&limit=20&search=acme&status=active`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "cust_789ghi",
      "name": "Acme Corporation",
      "email": "contact@acme.com",
      "phone": "+1-555-0100",
      "address": "123 Trade Street",
      "city": "Commerce",
      "state": "CA",
      "country": "USA",
      "postalCode": "90040",
      "status": "active",
      "totalOrders": 15,
      "totalRevenue": 150000.00,
      "createdAt": "2024-01-10T08:00:00Z",
      "updatedAt": "2024-03-15T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

### Get Customer

**Endpoint**: `GET /customers/:id`

**Authentication**: Required

**Parameters**:
- `id` (string) - Customer ID

**Response** (200 OK):
```json
{
  "id": "cust_789ghi",
  "name": "Acme Corporation",
  "email": "contact@acme.com",
  "phone": "+1-555-0100",
  "fax": "+1-555-0101",
  "website": "https://acmecorp.com",
  "address": "123 Trade Street",
  "city": "Commerce",
  "state": "CA",
  "country": "USA",
  "postalCode": "90040",
  "status": "active",
  "paymentTerms": "Net 30",
  "creditLimit": 500000.00,
  "contacts": [
    {
      "id": "con_111jkl",
      "name": "John Smith",
      "position": "Procurement Manager",
      "email": "john@acme.com",
      "phone": "+1-555-0102"
    }
  ],
  "notes": "Key account",
  "totalOrders": 15,
  "totalRevenue": 150000.00,
  "outstandingBalance": 25000.00,
  "createdAt": "2024-01-10T08:00:00Z",
  "updatedAt": "2024-03-15T14:20:00Z"
}
```

---

### Create Customer

**Endpoint**: `POST /customers`

**Authentication**: Required

**Request Body**:
```json
{
  "name": "Beta Industries",
  "email": "contact@beta.com",
  "phone": "+1-555-0200",
  "fax": "+1-555-0201",
  "website": "https://betaindustries.com",
  "address": "456 Business Ave",
  "city": "New York",
  "state": "NY",
  "country": "USA",
  "postalCode": "10001",
  "paymentTerms": "Net 45",
  "creditLimit": 300000.00,
  "notes": "New customer"
}
```

**Response** (201 Created):
```json
{
  "id": "cust_101mno",
  "name": "Beta Industries",
  "email": "contact@beta.com",
  "status": "active",
  "createdAt": "2024-03-16T10:00:00Z"
}
```

---

### Update Customer

**Endpoint**: `PUT /customers/:id`

**Authentication**: Required

**Request Body**: Same fields as Create

**Response** (200 OK): Updated customer object

---

### Delete Customer

**Endpoint**: `DELETE /customers/:id`

**Authentication**: Required

**Response** (204 No Content)

---

## Inquiries

### List Inquiries

**Endpoint**: `GET /inquiries`

**Query Parameters**:
- `page`, `limit`, `search`
- `status` (pending, converted, rejected)
- `fromDate`, `toDate`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "inq_202pqr",
      "customerId": "cust_789ghi",
      "customerName": "Acme Corporation",
      "productCategory": "fabric",
      "quantity": 1000,
      "unit": "meters",
      "specifications": "100% cotton, color blue",
      "requiredDeliveryDate": "2024-04-30",
      "status": "pending",
      "assignedTo": "usr_123abc",
      "createdAt": "2024-03-15T09:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 10 }
}
```

---

### Get Inquiry

**Endpoint**: `GET /inquiries/:id`

**Response** (200 OK): Full inquiry details with attachments

---

### Create Inquiry

**Endpoint**: `POST /inquiries`

**Request Body**:
```json
{
  "customerId": "cust_789ghi",
  "productCategory": "fabric",
  "quantity": 1000,
  "unit": "meters",
  "specifications": "100% cotton, color blue",
  "requiredDeliveryDate": "2024-04-30",
  "notes": "Need GOTS certification"
}
```

**Response** (201 Created): Created inquiry object

---

### Convert to Quotation

**Endpoint**: `POST /inquiries/:id/convert-to-quotation`

**Request Body**:
```json
{
  "items": [
    {
      "productId": "prod_303stu",
      "quantity": 1000,
      "unitPrice": 2.50,
      "currency": "USD"
    }
  ],
  "paymentTerms": "Net 30",
  "expiryDate": "2024-03-31"
}
```

**Response** (201 Created): New quotation object with ID

---

## Quotations

### List Quotations

**Endpoint**: `GET /quotations`

**Query Parameters**:
- `status` (draft, sent, accepted, rejected)
- `customerId`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "quo_304vwx",
      "inquiryId": "inq_202pqr",
      "customerId": "cust_789ghi",
      "customerName": "Acme Corporation",
      "quotationNo": "QUO-2024-001",
      "status": "sent",
      "totalAmount": 2500.00,
      "currency": "USD",
      "validUntil": "2024-03-31",
      "sentDate": "2024-03-16T10:00:00Z",
      "createdAt": "2024-03-15T14:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

---

### Get Quotation

**Endpoint**: `GET /quotations/:id`

**Response** (200 OK):
```json
{
  "id": "quo_304vwx",
  "quotationNo": "QUO-2024-001",
  "inquiryId": "inq_202pqr",
  "customerId": "cust_789ghi",
  "customerName": "Acme Corporation",
  "status": "sent",
  "items": [
    {
      "id": "quoi_305yza",
      "productId": "prod_303stu",
      "productName": "Cotton Fabric",
      "quantity": 1000,
      "unit": "meters",
      "unitPrice": 2.50,
      "currency": "USD",
      "total": 2500.00
    }
  ],
  "subtotal": 2500.00,
  "tax": 0.00,
  "total": 2500.00,
  "paymentTerms": "Net 30",
  "validUntil": "2024-03-31",
  "notes": "Subject to confirmation",
  "createdBy": "usr_123abc",
  "sentDate": "2024-03-16T10:00:00Z",
  "acceptedDate": null,
  "createdAt": "2024-03-15T14:00:00Z"
}
```

---

### Create Quotation

**Endpoint**: `POST /quotations`

**Request Body**:
```json
{
  "customerId": "cust_789ghi",
  "items": [
    {
      "productId": "prod_303stu",
      "quantity": 1000,
      "unitPrice": 2.50,
      "currency": "USD"
    }
  ],
  "paymentTerms": "Net 30",
  "validUntil": "2024-03-31",
  "notes": "Subject to confirmation"
}
```

**Response** (201 Created): Created quotation

---

### Send Quotation

**Endpoint**: `POST /quotations/:id/send`

**Request Body**:
```json
{
  "recipientEmail": "john@acme.com",
  "message": "Please find attached our quotation"
}
```

**Response** (200 OK):
```json
{
  "message": "Quotation sent successfully",
  "sentAt": "2024-03-16T10:30:00Z"
}
```

---

### Accept Quotation

**Endpoint**: `POST /quotations/:id/accept`

**Authentication**: Customer can accept their own quotations

**Response** (200 OK):
```json
{
  "status": "accepted",
  "acceptedAt": "2024-03-16T11:00:00Z"
}
```

---

### Reject Quotation

**Endpoint**: `POST /quotations/:id/reject`

**Request Body**:
```json
{
  "reason": "Price too high"
}
```

**Response** (200 OK):
```json
{
  "status": "rejected",
  "rejectedAt": "2024-03-16T11:00:00Z"
}
```

---

## Proforma Invoices

### Create Proforma Invoice

**Endpoint**: `POST /proforma-invoices`

**Request Body**:
```json
{
  "quotationId": "quo_304vwx",
  "piDate": "2024-03-16",
  "bankDetails": {
    "bankName": "First National Bank",
    "accountNo": "123456789",
    "swiftCode": "FNBAUS33",
    "currency": "USD"
  },
  "notes": "Payment to be made upon shipment"
}
```

**Response** (201 Created):
```json
{
  "id": "pi_306bcd",
  "piNo": "PI-2024-001",
  "quotationId": "quo_304vwx",
  "customerId": "cust_789ghi",
  "status": "draft",
  "total": 2500.00,
  "createdAt": "2024-03-16T12:00:00Z"
}
```

---

### Confirm Proforma Invoice

**Endpoint**: `POST /proforma-invoices/:id/confirm`

**Response** (200 OK):
```json
{
  "status": "confirmed",
  "confirmedAt": "2024-03-16T12:30:00Z"
}
```

---

## Sales Orders

### List Sales Orders

**Endpoint**: `GET /sales-orders`

**Query Parameters**:
- `status` (pending, confirmed, shipped, delivered)
- `fromDate`, `toDate`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "so_307efg",
      "orderNo": "SO-2024-001",
      "customerId": "cust_789ghi",
      "customerName": "Acme Corporation",
      "piId": "pi_306bcd",
      "status": "confirmed",
      "totalAmount": 2500.00,
      "deliveryDate": "2024-04-30",
      "createdAt": "2024-03-16T13:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 3 }
}
```

---

### Get Sales Order

**Endpoint**: `GET /sales-orders/:id`

**Response** (200 OK):
```json
{
  "id": "so_307efg",
  "orderNo": "SO-2024-001",
  "customerId": "cust_789ghi",
  "customerName": "Acme Corporation",
  "piId": "pi_306bcd",
  "status": "confirmed",
  "items": [
    {
      "id": "soi_308hij",
      "productId": "prod_303stu",
      "productName": "Cotton Fabric",
      "quantity": 1000,
      "unit": "meters",
      "unitPrice": 2.50,
      "total": 2500.00
    }
  ],
  "deliveryAddress": "123 Trade Street, Commerce, CA 90040",
  "deliveryDate": "2024-04-30",
  "specialInstructions": "Handle with care",
  "totalAmount": 2500.00,
  "confirmedAt": "2024-03-16T13:30:00Z",
  "createdAt": "2024-03-16T13:00:00Z"
}
```

---

### Create Sales Order

**Endpoint**: `POST /sales-orders`

**Request Body**:
```json
{
  "piId": "pi_306bcd",
  "deliveryAddress": "123 Trade Street, Commerce, CA 90040",
  "deliveryDate": "2024-04-30",
  "specialInstructions": "Handle with care"
}
```

**Response** (201 Created): Created sales order

---

### Confirm Sales Order

**Endpoint**: `POST /sales-orders/:id/confirm`

**Response** (200 OK):
```json
{
  "status": "confirmed",
  "confirmedAt": "2024-03-16T13:30:00Z"
}
```

---

### Cancel Sales Order

**Endpoint**: `POST /sales-orders/:id/cancel`

**Request Body**:
```json
{
  "reason": "Customer request"
}
```

**Response** (200 OK):
```json
{
  "status": "cancelled",
  "cancelledAt": "2024-03-16T14:00:00Z"
}
```

---

## Purchase Orders

### Create Purchase Order

**Endpoint**: `POST /purchase-orders`

**Request Body**:
```json
{
  "salesOrderId": "so_307efg",
  "factoryId": "fact_309klm",
  "items": [
    {
      "salesOrderItemId": "soi_308hij",
      "quantity": 500,
      "unitPrice": 1.80
    }
  ],
  "deliveryDate": "2024-04-15",
  "notes": "First batch delivery"
}
```

**Response** (201 Created):
```json
{
  "id": "po_310nop",
  "poNo": "PO-2024-001",
  "salesOrderId": "so_307efg",
  "factoryId": "fact_309klm",
  "status": "draft",
  "createdAt": "2024-03-16T14:30:00Z"
}
```

---

### List Purchase Orders

**Endpoint**: `GET /purchase-orders`

**Response** (200 OK): List of purchase orders

---

### Confirm Purchase Order

**Endpoint**: `POST /purchase-orders/:id/confirm`

**Response** (200 OK):
```json
{
  "status": "confirmed",
  "confirmedAt": "2024-03-16T14:45:00Z"
}
```

---

## Packing Lists

### Create Packing List

**Endpoint**: `POST /packing-lists`

**Request Body**:
```json
{
  "salesOrderId": "so_307efg",
  "packages": [
    {
      "packageNo": "PKG-001",
      "weight": 25.5,
      "weightUnit": "kg",
      "length": 100,
      "width": 80,
      "height": 60,
      "dimensionUnit": "cm",
      "items": [
        {
          "salesOrderItemId": "soi_308hij",
          "quantity": 500
        }
      ]
    }
  ]
}
```

**Response** (201 Created): Created packing list

---

### List Packing Lists

**Endpoint**: `GET /packing-lists`

---

## Shipments

### Create Shipment

**Endpoint**: `POST /shipments`

**Request Body**:
```json
{
  "salesOrderId": "so_307efg",
  "packingListId": "pl_311qrs",
  "vessel": "MV Ocean Express",
  "vesselType": "container_ship",
  "containerNo": "CONT123456",
  "containerType": "40HC",
  "departurePort": "Shanghai",
  "destinationPort": "Rotterdam",
  "departureDate": "2024-04-20",
  "eta": "2024-05-15",
  "notes": "Direct shipment"
}
```

**Response** (201 Created):
```json
{
  "id": "ship_312tuv",
  "shipmentNo": "SHIP-2024-001",
  "status": "booked",
  "createdAt": "2024-03-16T15:00:00Z"
}
```

---

### List Shipments

**Endpoint**: `GET /shipments`

**Query Parameters**:
- `status` (booked, shipped, in_transit, arrived, delivered)

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "ship_312tuv",
      "shipmentNo": "SHIP-2024-001",
      "salesOrderId": "so_307efg",
      "customerName": "Acme Corporation",
      "vessel": "MV Ocean Express",
      "containerNo": "CONT123456",
      "departurePort": "Shanghai",
      "destinationPort": "Rotterdam",
      "status": "in_transit",
      "departureDate": "2024-04-20",
      "eta": "2024-05-15",
      "currentLocation": "Singapore",
      "createdAt": "2024-03-16T15:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8 }
}
```

---

### Get Shipment

**Endpoint**: `GET /shipments/:id`

**Response** (200 OK): Full shipment details with tracking history

---

### Update Shipment Status

**Endpoint**: `PATCH /shipments/:id`

**Request Body**:
```json
{
  "status": "in_transit",
  "currentLocation": "Suez Canal",
  "eta": "2024-05-13",
  "notes": "On schedule"
}
```

**Response** (200 OK): Updated shipment

---

## Documents

### List Documents

**Endpoint**: `GET /documents`

**Query Parameters**:
- `type` (bill_of_lading, certificate_of_origin, invoice, packing_list)
- `relatedId`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "doc_313wxy",
      "documentType": "bill_of_lading",
      "documentNo": "BL-2024-001",
      "relatedId": "ship_312tuv",
      "relatedType": "shipment",
      "fileName": "BL_SHIP_2024_001.pdf",
      "fileSize": 256000,
      "uploadedBy": "usr_123abc",
      "uploadedAt": "2024-03-16T15:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 15 }
}
```

---

### Upload Document

**Endpoint**: `POST /documents`

**Content-Type**: multipart/form-data

**Form Data**:
- `file` (binary) - PDF document
- `documentType` (string) - bill_of_lading, certificate_of_origin, invoice, packing_list, inspection_report, customs_document, insurance_certificate
- `relatedId` (string) - ID of related object
- `relatedType` (string) - shipment, sales_order, purchase_order
- `description` (string, optional)
- `referenceNo` (string, optional)

**Response** (201 Created):
```json
{
  "id": "doc_313wxy",
  "documentType": "bill_of_lading",
  "fileName": "BL_SHIP_2024_001.pdf",
  "uploadedAt": "2024-03-16T15:30:00Z"
}
```

---

### Download Document

**Endpoint**: `GET /documents/:id/download`

**Response**: Binary PDF file with appropriate Content-Disposition header

---

### Delete Document

**Endpoint**: `DELETE /documents/:id`

**Response** (204 No Content)

---

## Invoices

### Create Invoice

**Endpoint**: `POST /invoices`

**Request Body**:
```json
{
  "salesOrderId": "so_307efg",
  "invoiceDate": "2024-04-30",
  "dueDate": "2024-05-30",
  "invoiceType": "sales",
  "paymentTerms": "Net 30",
  "notes": "Payment due within 30 days"
}
```

**Response** (201 Created):
```json
{
  "id": "inv_314zab",
  "invoiceNo": "INV-2024-001",
  "salesOrderId": "so_307efg",
  "customerId": "cust_789ghi",
  "totalAmount": 2500.00,
  "createdAt": "2024-04-30T10:00:00Z"
}
```

---

### List Invoices

**Endpoint**: `GET /invoices`

**Query Parameters**:
- `type` (sales, purchase)
- `status` (draft, sent, paid, overdue)
- `fromDate`, `toDate`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "inv_314zab",
      "invoiceNo": "INV-2024-001",
      "customerId": "cust_789ghi",
      "customerName": "Acme Corporation",
      "invoiceDate": "2024-04-30",
      "dueDate": "2024-05-30",
      "totalAmount": 2500.00,
      "paidAmount": 0.00,
      "status": "sent",
      "createdAt": "2024-04-30T10:00:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12 }
}
```

---

### Get Invoice

**Endpoint**: `GET /invoices/:id`

**Response** (200 OK):
```json
{
  "id": "inv_314zab",
  "invoiceNo": "INV-2024-001",
  "invoiceType": "sales",
  "customerId": "cust_789ghi",
  "customerName": "Acme Corporation",
  "invoiceDate": "2024-04-30",
  "dueDate": "2024-05-30",
  "items": [
    {
      "salesOrderItemId": "soi_308hij",
      "description": "Cotton Fabric",
      "quantity": 1000,
      "unit": "meters",
      "unitPrice": 2.50,
      "total": 2500.00
    }
  ],
  "subtotal": 2500.00,
  "tax": 0.00,
  "totalAmount": 2500.00,
  "paidAmount": 0.00,
  "balanceDue": 2500.00,
  "status": "sent",
  "paymentTerms": "Net 30",
  "notes": "Payment due within 30 days",
  "createdAt": "2024-04-30T10:00:00Z"
}
```

---

## Payments

### Record Payment

**Endpoint**: `POST /invoices/:id/payments`

**Request Body**:
```json
{
  "amount": 2500.00,
  "paymentDate": "2024-05-15",
  "paymentMethod": "bank_transfer",
  "reference": "TXN20240515001",
  "notes": "Payment received"
}
```

**Response** (201 Created):
```json
{
  "id": "pym_315cde",
  "invoiceId": "inv_314zab",
  "amount": 2500.00,
  "paymentDate": "2024-05-15",
  "paymentMethod": "bank_transfer",
  "status": "confirmed",
  "recordedAt": "2024-05-15T10:30:00Z"
}
```

---

### List Payments

**Endpoint**: `GET /invoices/:id/payments`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "pym_315cde",
      "amount": 2500.00,
      "paymentDate": "2024-05-15",
      "paymentMethod": "bank_transfer",
      "reference": "TXN20240515001",
      "status": "confirmed"
    }
  ]
}
```

---

## Inspection

### Create Inspection

**Endpoint**: `POST /inspections`

**Request Body**:
```json
{
  "purchaseOrderId": "po_310nop",
  "inspectionDate": "2024-04-10",
  "inspectorId": "usr_316fgh",
  "location": "Factory",
  "notes": "Pre-shipment inspection"
}
```

**Response** (201 Created):
```json
{
  "id": "insp_317ijk",
  "purchaseOrderId": "po_310nop",
  "status": "in_progress",
  "createdAt": "2024-04-10T08:00:00Z"
}
```

---

### Record Inspection Results

**Endpoint**: `POST /inspections/:id/results`

**Request Body**:
```json
{
  "overallStatus": "pass",
  "defectCount": 2,
  "defects": [
    {
      "itemId": "soi_308hij",
      "defectType": "color_mismatch",
      "severity": "minor",
      "quantity": 10,
      "description": "5 units with slight color variation"
    }
  ],
  "comments": "Overall quality acceptable with minor defects"
}
```

**Response** (200 OK):
```json
{
  "status": "completed",
  "completedAt": "2024-04-10T16:00:00Z"
}
```

---

## Claims

### Create Claim

**Endpoint**: `POST /claims`

**Request Body**:
```json
{
  "invoiceId": "inv_314zab",
  "shipmentId": "ship_312tuv",
  "claimType": "quality_issue",
  "claimAmount": 500.00,
  "description": "Received damaged merchandise",
  "attachments": ["doc_318lmn"]
}
```

**Response** (201 Created):
```json
{
  "id": "claim_319opq",
  "claimNo": "CLM-2024-001",
  "status": "submitted",
  "createdAt": "2024-05-20T10:00:00Z"
}
```

---

### List Claims

**Endpoint**: `GET /claims`

**Query Parameters**:
- `status` (submitted, under_investigation, resolved, rejected)

---

### Get Claim

**Endpoint**: `GET /claims/:id`

---

## Inventory

### Get Stock Level

**Endpoint**: `GET /inventory/:productId`

**Response** (200 OK):
```json
{
  "productId": "prod_303stu",
  "productName": "Cotton Fabric",
  "warehouseId": "wh_320rst",
  "warehouseName": "Main Warehouse",
  "currentStock": 5000,
  "unit": "meters",
  "reorderPoint": 1000,
  "reorderQuantity": 3000,
  "lastStockCount": "2024-03-15",
  "lastMovementDate": "2024-03-16"
}
```

---

### List Inventory

**Endpoint**: `GET /inventory`

---

## Reports

### P&L Report

**Endpoint**: `GET /reports/profit-loss`

**Query Parameters**:
- `startDate` (ISO 8601)
- `endDate` (ISO 8601)

**Response** (200 OK):
```json
{
  "period": "2024-01-01 to 2024-03-31",
  "revenue": 150000.00,
  "costOfGoods": 90000.00,
  "grossProfit": 60000.00,
  "operatingExpenses": 20000.00,
  "netProfit": 40000.00,
  "profitMargin": 26.67
}
```

---

### AR Aging Report

**Endpoint**: `GET /reports/ar-aging`

**Response** (200 OK):
```json
{
  "generatedAt": "2024-03-16",
  "summary": {
    "currentAmount": 10000.00,
    "days30Amount": 15000.00,
    "days60Amount": 8000.00,
    "days90Amount": 5000.00,
    "over90Amount": 2000.00,
    "totalAmount": 40000.00
  },
  "details": [
    {
      "customerId": "cust_789ghi",
      "customerName": "Acme Corporation",
      "invoiceNo": "INV-2024-001",
      "invoiceDate": "2024-02-15",
      "dueDate": "2024-03-15",
      "amount": 2500.00,
      "paidAmount": 0.00,
      "daysOverdue": 1,
      "bucket": "current"
    }
  ]
}
```

---

### AP Aging Report

**Endpoint**: `GET /reports/ap-aging`

---

### Revenue Report

**Endpoint**: `GET /reports/revenue`

**Query Parameters**:
- `period` (daily, weekly, monthly, quarterly, yearly)
- `startDate`, `endDate`

---

## Users

### List Users

**Endpoint**: `GET /users`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "usr_123abc",
      "email": "admin@floortrading.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin",
      "status": "active",
      "lastLogin": "2024-03-16T10:00:00Z",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 5 }
}
```

---

### Create User

**Endpoint**: `POST /users`

**Request Body**:
```json
{
  "email": "newuser@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "roleId": "role_321uvw",
  "status": "active"
}
```

---

### Update User

**Endpoint**: `PUT /users/:id`

---

### Delete User

**Endpoint**: `DELETE /users/:id`

---

## Roles & Permissions

### List Roles

**Endpoint**: `GET /roles`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "role_321uvw",
      "name": "admin",
      "description": "Full system access",
      "permissions": ["manage_users", "manage_settings", "view_all_data"],
      "usersCount": 2
    }
  ]
}
```

---

### Get Permissions

**Endpoint**: `GET /permissions`

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "perm_322wxy",
      "name": "manage_users",
      "description": "Create, edit, delete users",
      "category": "user_management"
    }
  ]
}
```

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200 OK` - Successful GET/PUT request
- `201 Created` - Successful POST request
- `204 No Content` - Successful DELETE request
- `400 Bad Request` - Invalid request data
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

### Error Response Format

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Customer email is required",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

---

**Last Updated**: March 16, 2024
