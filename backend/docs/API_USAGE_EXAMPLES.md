# Trading ERP API - Usage Examples

## Quick Start Guide

### 1. User Authentication

#### Register a New User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

Response:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  }
}
```

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "admin"
    }
  }
}
```

Save the token for subsequent requests:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Customer Management

#### Create a Customer
```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "companyName": "Acme Corporation",
    "email": "sales@acme.com",
    "phone": "+1-555-0123",
    "address": "123 Business St",
    "city": "New York",
    "state": "NY",
    "country": "USA",
    "paymentTerms": "Net 30",
    "creditLimit": 100000
  }'
```

#### List All Customers
```bash
curl -X GET "http://localhost:5000/api/customers?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Single Customer
```bash
curl -X GET http://localhost:5000/api/customers/{customerId} \
  -H "Authorization: Bearer $TOKEN"
```

#### Update Customer
```bash
curl -X PUT http://localhost:5000/api/customers/{customerId} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "companyName": "Acme Corporation Updated",
    "paymentTerms": "Net 45"
  }'
```

#### Get Customer Balance
```bash
curl -X GET http://localhost:5000/api/customers/{customerId}/balance \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Product Management

#### Create a Product
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Premium Flooring - Oak",
    "sku": "FLOOR-OAK-001",
    "categoryId": "category-uuid",
    "factoryId": "factory-uuid",
    "description": "High-quality oak flooring",
    "unit": "sqm",
    "basePrice": 45.50,
    "leadTime": 14
  }'
```

#### Search Products
```bash
curl -X GET "http://localhost:5000/api/products/search?q=flooring" \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Products by Category
```bash
curl -X GET http://localhost:5000/api/products/category/{categoryId} \
  -H "Authorization: Bearer $TOKEN"
```

#### Bulk Update Products
```bash
curl -X POST http://localhost:5000/api/products/bulk-update \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "products": [
      {
        "id": "product-uuid-1",
        "basePrice": 50.00
      },
      {
        "id": "product-uuid-2",
        "basePrice": 55.00
      }
    ]
  }'
```

### 4. Sales Process

#### Create an Inquiry
```bash
curl -X POST http://localhost:5000/api/inquiries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "customer-uuid",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 1000,
        "unit": "sqm"
      }
    ]
  }'
```

#### Convert Inquiry to Quotation
```bash
curl -X POST http://localhost:5000/api/inquiries/{inquiryId}/convert-to-quotation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 1000,
        "unitPrice": 45.50,
        "description": "Premium Oak Flooring"
      }
    ]
  }'
```

#### Create Quotation
```bash
curl -X POST http://localhost:5000/api/quotations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "customer-uuid",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 1000,
        "unitPrice": 45.50,
        "description": "Premium Oak Flooring"
      }
    ],
    "subtotal": 45500,
    "discount": 1000,
    "tax": 3600,
    "validUntil": "2026-04-16T23:59:59Z"
  }'
```

#### Send Quotation
```bash
curl -X POST http://localhost:5000/api/quotations/{quotationId}/send \
  -H "Authorization: Bearer $TOKEN"
```

#### Accept Quotation
```bash
curl -X PATCH http://localhost:5000/api/quotations/{quotationId}/accept \
  -H "Authorization: Bearer $TOKEN"
```

#### Generate Quotation PDF
```bash
curl -X GET http://localhost:5000/api/quotations/{quotationId}/pdf \
  -H "Authorization: Bearer $TOKEN" \
  -o quotation.pdf
```

### 5. Sales Order Management

#### Create Sales Order from Quotation
```bash
curl -X POST http://localhost:5000/api/sales-orders/create-from-quotation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "quotationId": "quotation-uuid",
    "factoryId": "factory-uuid",
    "estimatedDelivery": "2026-04-30",
    "shippingMethod": "FCL"
  }'
```

#### Create Direct Sales Order
```bash
curl -X POST http://localhost:5000/api/sales-orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "customerId": "customer-uuid",
    "factoryId": "factory-uuid",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 1000,
        "unitPrice": 45.50,
        "description": "Premium Oak Flooring"
      }
    ],
    "estimatedDelivery": "2026-04-30",
    "shippingMethod": "FCL",
    "notes": "Deliver to warehouse A"
  }'
```

#### Update Sales Order Status
```bash
curl -X PATCH http://localhost:5000/api/sales-orders/{salesOrderId}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "shipped"
  }'
```

### 6. Shipping & Logistics

#### Create Shipment
```bash
curl -X POST http://localhost:5000/api/shipments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "salesOrderId": "salesorder-uuid",
    "carrier": "Maersk",
    "vesselName": "MSC Gülsün",
    "containerNumber": "MSKU1234567",
    "containerType": "40HC",
    "portOfLoading": "Shanghai",
    "portOfDischarge": "Los Angeles"
  }'
```

#### Add Shipment Tracking Event
```bash
curl -X POST http://localhost:5000/api/shipments/{shipmentId}/tracking \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "status": "in_transit",
    "location": "Pacific Ocean",
    "description": "Vessel departed from Shanghai port"
  }'
```

#### Create Packing List
```bash
curl -X POST http://localhost:5000/api/packing-lists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "salesOrderId": "salesorder-uuid",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 500,
        "unit": "sqm",
        "packageNumber": "PKG-001",
        "grossWeight": 2500,
        "netWeight": 2400,
        "dimensions": {
          "length": 2.4,
          "width": 1.2,
          "height": 1.0,
          "volume": 2.88
        },
        "marks": "FRAGILE - Handle with care"
      }
    ]
  }'
```

### 7. Quality Inspection

#### Schedule Inspection
```bash
curl -X POST http://localhost:5000/api/inspections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "final",
    "factoryId": "factory-uuid",
    "salesOrderId": "salesorder-uuid",
    "scheduledDate": "2026-04-15T10:00:00Z",
    "items": [
      {
        "productId": "product-uuid",
        "checkPoint": "Surface Quality",
        "criteria": "No scratches or defects visible"
      }
    ]
  }'
```

#### Start Inspection
```bash
curl -X PATCH http://localhost:5000/api/inspections/{inspectionId}/start \
  -H "Authorization: Bearer $TOKEN"
```

#### Complete Inspection
```bash
curl -X PATCH http://localhost:5000/api/inspections/{inspectionId}/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "overallResult": "pass",
    "findings": [
      "All items meet quality standards",
      "No defects found",
      "Ready for shipment"
    ]
  }'
```

### 8. Invoicing & Payments

#### Generate Invoice from Sales Order
```bash
curl -X POST http://localhost:5000/api/invoices/generate-from-sales-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "salesOrderId": "salesorder-uuid",
    "dueDate": "2026-05-15",
    "paymentTerms": "Net 30"
  }'
```

#### Record Payment
```bash
curl -X POST http://localhost:5000/api/invoices/{invoiceId}/record-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "amount": 10000,
    "method": "bank_transfer",
    "reference": "WIRE-20260316-001"
  }'
```

#### Get Aging Report
```bash
curl -X GET http://localhost:5000/api/invoices/aging-report \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Invoice Summary
```bash
curl -X GET http://localhost:5000/api/invoices/summary \
  -H "Authorization: Bearer $TOKEN"
```

### 9. Claims Management

#### Submit Claim
```bash
curl -X POST http://localhost:5000/api/claims \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "salesOrderId": "salesorder-uuid",
    "customerId": "customer-uuid",
    "type": "damage",
    "priority": "high",
    "description": "10 sqm of flooring arrived damaged due to improper packaging",
    "images": ["url-to-image-1", "url-to-image-2"]
  }'
```

#### Resolve Claim
```bash
curl -X PATCH http://localhost:5000/api/claims/{claimId}/resolve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "resolution": "Full replacement shipment sent",
    "compensationType": "replacement",
    "compensationAmount": 450
  }'
```

### 10. Dashboard & Analytics

#### Get Admin Dashboard
```bash
curl -X GET http://localhost:5000/api/dashboard/admin \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Sales Dashboard
```bash
curl -X GET http://localhost:5000/api/dashboard/sales \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Finance Dashboard
```bash
curl -X GET http://localhost:5000/api/dashboard/finance \
  -H "Authorization: Bearer $TOKEN"
```

#### Generate Custom Chart
```bash
curl -X POST http://localhost:5000/api/dashboard/custom-chart \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "entity": "salesOrders",
    "metric": "sum",
    "field": "total",
    "groupBy": "customer",
    "dateRange": {
      "start": "2026-01-01",
      "end": "2026-03-31"
    }
  }'
```

### 11. Reports

#### Get Sales Report
```bash
curl -X GET "http://localhost:5000/api/reports/sales?period=month" \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Financial Report
```bash
curl -X GET "http://localhost:5000/api/reports/financial?period=quarter" \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Customer Report
```bash
curl -X GET http://localhost:5000/api/reports/customer/{customerId}?period=year \
  -H "Authorization: Bearer $TOKEN"
```

#### Get Factory Report
```bash
curl -X GET http://localhost:5000/api/reports/factory/{factoryId}?period=year \
  -H "Authorization: Bearer $TOKEN"
```

### 12. Document Management

#### Upload Document
```bash
curl -X POST http://localhost:5000/api/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/document.pdf" \
  -F "name=Bill of Lading" \
  -F "type=uploaded" \
  -F "category=shipping" \
  -F "entityType=salesOrder" \
  -F "entityId=salesorder-uuid"
```

#### Get Documents for Entity
```bash
curl -X GET http://localhost:5000/api/documents/entity/salesOrder/{salesOrderId} \
  -H "Authorization: Bearer $TOKEN"
```

#### Create Document Template
```bash
curl -X POST http://localhost:5000/api/documents/templates \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/template.docx" \
  -F "name=Standard Quotation Template" \
  -F "category=quotation" \
  -F "isDefault=true"
```

### 13. Notifications

#### Get Unread Count
```bash
curl -X GET http://localhost:5000/api/notifications/unread-count \
  -H "Authorization: Bearer $TOKEN"
```

#### Mark Notification as Read
```bash
curl -X PATCH http://localhost:5000/api/notifications/{notificationId}/read \
  -H "Authorization: Bearer $TOKEN"
```

#### Mark All as Read
```bash
curl -X PATCH http://localhost:5000/api/notifications/all/mark-read \
  -H "Authorization: Bearer $TOKEN"
```

## Common Workflows

### Complete Sales Workflow
1. **Create Customer** → Customer registered
2. **Create Inquiry** → Customer submits requirements
3. **Create Quotation** → Prepare and send quote
4. **Accept Quotation** → Customer accepts
5. **Create Sales Order** → Convert to formal order
6. **Create Purchase Order** → Order from factory
7. **Create Shipment** → Track shipment
8. **Create Packing List** → Prepare shipping
9. **Upload Documents** → Attach BOL, certificates
10. **Create Inspection** → Quality check
11. **Generate Invoice** → Create billing document
12. **Record Payment** → Track payment

### Customer Query Workflow
1. **Get Customer** → Retrieve customer details
2. **Get Balance** → Check outstanding balance
3. **Get Order History** → View past orders
4. **Get Dashboard** → View customer metrics
5. **Get Report** → Generate performance report

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "message": "Validation failed: email is invalid",
    "statusCode": 400
  }
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired token",
    "statusCode": 401
  }
}
```

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "message": "Insufficient permissions",
    "statusCode": 403
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "message": "Customer not found",
    "statusCode": 404
  }
}
```

#### 500 Server Error
```json
{
  "success": false,
  "error": {
    "message": "Internal server error",
    "statusCode": 500
  }
}
```

## Tips & Best Practices

1. **Always save JWT token** after login
2. **Use pagination** for large datasets
3. **Filter by status** to reduce response size
4. **Cache frequently accessed data** (customers, products)
5. **Implement error handling** for all requests
6. **Use date filters** for report endpoints
7. **Monitor API rate limits** - 100 requests/15 mins
8. **Keep tokens secure** - never expose in client code
9. **Use HTTPS in production**
10. **Test endpoints** in Swagger UI first

---

Last Updated: March 16, 2026
