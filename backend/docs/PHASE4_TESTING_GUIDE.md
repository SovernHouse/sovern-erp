# Phase 4 Features Testing Guide

## Quick Start Testing

### 1. Email Notification Integration Testing

#### Prerequisites
- Ensure `.env` has email configuration (see .env.example)
- Set `ENABLE_EMAIL_NOTIFICATIONS=false` to test with console logging
- Or configure real SMTP if you want to test actual email sending

#### Test Email Sending (Console Logging Mode)

**Test 1: Order Confirmation Email**
```bash
# Create a sales order
POST /api/sales-orders
{
  "customerId": "customer-uuid",
  "factoryId": "factory-uuid",
  "items": [
    {
      "productId": "product-uuid",
      "quantity": 100,
      "unitPrice": 50,
      "unit": "sqm"
    }
  ]
}

# Expected: Console shows "[EMAIL] (disabled) To: customer@email.com, Subject: Order Confirmation..."
```

**Test 2: Invoice Email**
```bash
# Create an invoice first
POST /api/invoices
{
  "salesOrderId": "so-uuid",
  "customerId": "customer-uuid",
  "subtotal": 5000,
  "discount": 0,
  "tax": 500,
  "dueDate": "2026-04-16"
}

# Mark invoice as sent
PATCH /api/invoices/{invoiceId}/send

# Expected: Console shows "[EMAIL] (disabled) To: customer@email.com, Subject: Invoice..."
```

**Test 3: Payment Confirmation Email**
```bash
# Record payment
POST /api/invoices/{invoiceId}/record-payment
{
  "amount": 2500,
  "method": "bank_transfer",
  "reference": "TXN123456"
}

# Expected: Console shows "[EMAIL] (disabled) To: customer@email.com, Subject: Payment Confirmation..."
```

**Test 4: Purchase Order Email**
```bash
# Create a PO first
POST /api/purchase-orders
{
  "factoryId": "factory-uuid",
  "items": [
    {
      "productId": "product-uuid",
      "quantity": 100,
      "unitPrice": 40,
      "unit": "sqm"
    }
  ]
}

# Send the PO
POST /api/purchase-orders/{poId}/send

# Expected: Console shows "[EMAIL] (disabled) To: factory@email.com, Subject: Purchase Order..."
```

**Test 5: Shipment Email**
```bash
# Create a shipment
POST /api/shipments
{
  "salesOrderId": "so-uuid",
  "carrier": "DHL",
  "vesselName": "XYZ Ship",
  "containerNumber": "CONT123456",
  "containerType": "20ft",
  "portOfLoading": "Shanghai",
  "portOfDischarge": "Singapore"
}

# Expected: Console shows "[EMAIL] (disabled) To: customer@email.com, Subject: Shipment Notification..."
```

**Test 6: Shipment Tracking Update Email**
```bash
# Add tracking event
POST /api/shipments/{shipmentId}/tracking
{
  "status": "in_transit",
  "location": "Dubai Port",
  "description": "Shipment in transit"
}

# Expected: Console shows "[EMAIL] (disabled) To: customer@email.com, Subject: Shipment Update..."
```

**Test 7: Inspection Scheduled Email**
```bash
# Create an inspection (as inspector or admin)
POST /api/inspections
{
  "type": "pre_shipment",
  "factoryId": "factory-uuid",
  "scheduledDate": "2026-03-25",
  "items": [
    {
      "productId": "product-uuid",
      "checkPoint": "color_check",
      "criteria": "Match sample color"
    }
  ]
}

# Expected: Console shows "[EMAIL] (disabled) To: factory@email.com, Subject: Inspection Scheduled..."
```

**Test 8: Payment Reminder Batch Email**
```bash
# Send payment reminders for overdue invoices (as admin/finance)
POST /api/invoices/send-reminders

# Response should show:
# {
#   "success": true,
#   "data": {
#     "totalSent": 5,
#     "totalFailed": 0,
#     "reminders": [...]
#   }
# }

# Expected: Console shows multiple "[EMAIL]" entries for each overdue invoice
```

---

### 2. PDF Generation Testing

#### Test PDF Endpoints

**Test 1: Invoice PDF**
```bash
# Generate invoice PDF
GET /api/invoices/{invoiceId}/pdf

# Response:
# {
#   "success": true,
#   "data": {
#     "pdfFile": "inv-INV-12345-1710692400000.pdf"
#   }
# }

# Verify:
# 1. File exists in /uploads/invoices/
# 2. Contains customer name, invoice number, totals, payment terms
```

**Test 2: Shipment Document PDF**
```bash
# Generate shipment document PDF
GET /api/shipments/{shipmentId}/pdf

# Response:
# {
#   "success": true,
#   "data": {
#     "pdfFile": "shp-SHP-1710692400000-1710692400001.pdf"
#   }
# }

# Verify:
# 1. File exists in /uploads/shipment_documents/
# 2. Contains shipment details, carrier, vessel, container, ports, ETA
```

**Test 3: Inspection Certificate PDF**
```bash
# Generate inspection certificate PDF
GET /api/inspections/{inspectionId}/certificate

# Response:
# {
#   "success": true,
#   "data": {
#     "pdfFile": "cert-INSP-1710692400000-1710692400001.pdf"
#   }
# }

# Verify:
# 1. File exists in /uploads/inspection_certificates/
# 2. Contains inspection number, type, date, factory, overall result
```

---

### 3. Multi-Currency Support Testing

#### Test Currency API

**Test 1: Get Supported Currencies**
```bash
GET /api/currencies

# Response:
# {
#   "success": true,
#   "data": [
#     {"code": "USD", "name": "US Dollar", "symbol": "$"},
#     {"code": "EUR", "name": "Euro", "symbol": "€"},
#     {"code": "GBP", "name": "British Pound", "symbol": "£"},
#     {"code": "CNY", "name": "Chinese Yuan", "symbol": "¥"},
#     {"code": "AED", "name": "UAE Dirham", "symbol": "د.إ"},
#     {"code": "INR", "name": "Indian Rupee", "symbol": "₹"},
#     {"code": "SAR", "name": "Saudi Riyal", "symbol": "ر.س"}
#   ]
# }
```

**Test 2: Get Current Exchange Rates**
```bash
GET /api/currencies/rates

# Response:
# {
#   "success": true,
#   "data": {
#     "rates": {
#       "USD": 1.0,
#       "EUR": 0.92,
#       "GBP": 0.79,
#       "CNY": 7.24,
#       "AED": 3.67,
#       "INR": 83.12,
#       "SAR": 3.75
#     },
#     "baseCurrency": "USD",
#     "lastUpdated": "2026-03-16T16:30:00.000Z",
#     "source": "manual"
#   }
# }
```

**Test 3: Convert Currency**
```bash
# Convert 100 USD to EUR
GET /api/currencies/convert?amount=100&from=USD&to=EUR

# Response:
# {
#   "success": true,
#   "data": {
#     "sourceAmount": 100,
#     "sourceCurrency": "USD",
#     "targetAmount": 92,
#     "targetCurrency": "EUR",
#     "exchangeRate": 0.92,
#     "formattedSource": "$ 100.00",
#     "formattedTarget": "€ 92.00"
#   }
# }
```

**Test 4: Update Exchange Rates (Admin/Finance Only)**
```bash
# Update rates (must be logged in as admin or finance user)
POST /api/currencies/rates
{
  "EUR": 0.95,
  "GBP": 0.82,
  "CNY": 7.30
}

# Response:
# {
#   "success": true,
#   "message": "Exchange rates updated successfully",
#   "data": {
#     "success": true,
#     "rates": {
#       "USD": 1.0,
#       "EUR": 0.95,
#       "GBP": 0.82,
#       "CNY": 7.30,
#       "AED": 3.67,
#       "INR": 83.12,
#       "SAR": 3.75
#     }
#   }
# }
```

**Test 5: Get Currency Details**
```bash
# Get details for EUR
GET /api/currencies/EUR

# Response:
# {
#   "success": true,
#   "data": {
#     "code": "EUR",
#     "name": "Euro",
#     "symbol": "€"
#   }
# }
```

---

## Integration Testing

### Test Multi-Currency Invoice Creation

```bash
# Create sales order in EUR
POST /api/sales-orders
{
  "customerId": "customer-uuid",
  "factoryId": "factory-uuid",
  "currency": "EUR",
  "items": [...]
}

# Create invoice from SO (inherits EUR)
POST /api/invoices/generate-from-sales-order
{
  "salesOrderId": "so-uuid"
}

# Convert invoice total to other currencies
GET /api/currencies/convert?amount=5000&from=EUR&to=USD
GET /api/currencies/convert?amount=5000&from=EUR&to=CNY

# Verify conversion calculations
```

---

## Automated Testing Commands

```bash
# Test all email templates with console logging
# (Requires ENABLE_EMAIL_NOTIFICATIONS=false in .env)

# Create test data
POST /api/customers (create test customer)
POST /api/factories (create test factory)
POST /api/products (create test product)

# Create test orders and verify emails
# - Sales Order → Order Confirmation
# - Invoice → Invoice Email
# - Payment → Payment Confirmation
# - PO → PO Email
# - Shipment → Shipment Notification
# - Tracking → Shipment Update
# - Inspection → Inspection Scheduled
# - Overdue Invoices → Batch Reminders

# Test all PDFs
GET /api/invoices/:id/pdf
GET /api/shipments/:id/pdf
GET /api/inspections/:id/certificate

# Test all currency endpoints
GET /api/currencies
GET /api/currencies/rates
GET /api/currencies/convert?amount=1000&from=USD&to=EUR
POST /api/currencies/rates (as admin)
GET /api/currencies/USD
```

---

## Troubleshooting

### Email Issues
- Check `.env` for ENABLE_EMAIL_NOTIFICATIONS setting
- Check console output for "[EMAIL]" logs
- Verify customer/factory email addresses exist and are valid
- Check nodemailer SMTP configuration if sending real emails

### PDF Issues
- Ensure `/uploads` directory exists and is writable
- Check that all required models are loaded in request context
- Verify customer/factory/sales order references exist
- Check PDF file creation in `/uploads/{type}/` subdirectories

### Currency Issues
- Ensure ExchangeRate model is registered in models/index.js
- Verify currencyRoutes is registered in server.js
- Check that conversion calculations use correct formula: (amount / fromRate) * toRate
- Verify authentication for POST /currencies/rates (requires admin/finance role)

---

## Manual Testing Checklist

- [ ] Email logs appear in console when creating documents
- [ ] PDFs generate without errors
- [ ] PDF files exist in correct upload directories
- [ ] PDF content matches expected document structure
- [ ] Currency conversion calculations are accurate
- [ ] Rate updates persist correctly
- [ ] Admin role restriction works for payment reminders
- [ ] Fire-and-forget emails don't block responses
- [ ] Batch email reminder works for multiple overdue invoices
