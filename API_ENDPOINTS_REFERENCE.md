# Compliance & Warehouse API Endpoints

## COMPLIANCE MODULE
**Base Path:** `/api/compliance`

### Compliance Checks
- `POST /api/compliance/check` - Check compliance requirements for shipment/product
- `POST /api/compliance/anti-dumping/check` - Check anti-dumping applicability (Chinese tiles to US: 241-305%)

### Compliance Records Management
- `POST /api/compliance/records` - Create compliance record
- `GET /api/compliance/records` - List records (filters: status, type, shipmentId, dateRange)
- `GET /api/compliance/records/:id` - Get record by ID
- `PUT /api/compliance/records/:id` - Update record (status, expiryDate, notes)

### HS Code (Harmonized Tariff Code) Management
- `GET /api/compliance/hs-codes` - Search/list HS codes (filters: search, chapter)
- `POST /api/compliance/hs-codes` - Create HS code entry (ADMIN only)
- `POST /api/compliance/duties/calculate` - Calculate duties for origin/destination

### Certificate of Origin Management
- `POST /api/compliance/certificates` - Generate Certificate of Origin
- `GET /api/compliance/certificates` - List certificates (filters: status, shipmentId, countryOfOrigin)
- `GET /api/compliance/certificates/:id` - Get certificate by ID

### Dashboard & Reporting
- `GET /api/compliance/dashboard` - Compliance dashboard (expiring certs, flagged shipments, duty exposure)
- `GET /api/compliance/status` - Module health check

---

## WAREHOUSE MODULE
**Base Path:** `/api/warehouse`

### Warehouse Location Management
- `POST /api/warehouse/locations` - Create location (ADMIN only)
- `GET /api/warehouse/locations` - List locations (filters: warehouseId, zone, type, status)
- `GET /api/warehouse/locations/:id` - Get location with recent transactions
- `PUT /api/warehouse/locations/:id` - Update location (ADMIN only)

### Goods Receiving & Putaway
- `POST /api/warehouse/receive` - Record goods receipt into receiving zone
- `POST /api/warehouse/putaway` - Move goods to storage (FIFO suggestion)

### Order Picking & Packing
- `POST /api/warehouse/pick` - Generate FIFO pick list for order
- `POST /api/warehouse/pack` - Record packing of items

### Stock Operations
- `POST /api/warehouse/transfer` - Transfer stock between locations
- `POST /api/warehouse/adjust` - Manual stock adjustment (damage, returns, theft)

### Stock Count & Inventory
- `POST /api/warehouse/stock-count/start` - Start physical stock count
- `POST /api/warehouse/stock-count/:id/record` - Record count result
- `POST /api/warehouse/stock-count/:id/complete` - Complete count with variance report
- `GET /api/warehouse/inventory` - Get inventory by location with utilization

### Dashboard & Reporting
- `GET /api/warehouse/dashboard` - Warehouse dashboard (capacity, queues, transactions)
- `GET /api/warehouse/status` - Module health check

---

## REQUEST/RESPONSE EXAMPLES

### Compliance Check Example
```
POST /api/compliance/check
{
  "shipmentId": "uuid",
  "countryOrigin": "CN",
  "countryDestination": "US"
}

Response: {
  "success": true,
  "message": "Compliance check completed",
  "data": {
    "requirements": [
      {
        "type": "anti_dumping",
        "description": "Anti-dumping duties apply for Chinese origin products to US market",
        "dutyRate": 241,
        "antiDumpingRate": 305,
        "riskLevel": "high"
      },
      { "type": "cpsc", ... },
      { "type": "customs", ... }
    ],
    "riskLevel": "high"
  }
}
```

### Receive Goods Example
```
POST /api/warehouse/receive
{
  "productId": "uuid",
  "quantity": 1000,
  "reference": "PO-123456",
  "notes": "From Factory A"
}

Response: {
  "success": true,
  "message": "Goods received",
  "data": {
    "transaction": { ... },
    "location": { ... }
  }
}
```

### Warehouse Dashboard Example
```
GET /api/warehouse/dashboard?warehouseId=uuid

Response: {
  "success": true,
  "message": "Warehouse dashboard retrieved",
  "data": {
    "capacity": {
      "total": 500,
      "occupied": 375,
      "available": 125,
      "utilizationPct": "75.0"
    },
    "itemsInReceiving": 45,
    "pendingPutaway": 12,
    "pickQueueSize": 8,
    "transactionsSummary": [ ... ]
  }
}
```

---

## AUTHENTICATION
All endpoints require authentication via Bearer token (JWT) in Authorization header.
Role-based access control applied:
- Most endpoints: `requireAny('compliance')` or `requireAny('warehouse')`
- Admin operations: `requireRole('ADMIN')`

---

## DATA MODELS

### ComplianceRecord
- id (UUID)
- shipmentId (UUID, optional)
- productId (UUID, optional)
- type: anti_dumping | cpsc | ce_marking | customs
- status: pending | approved | flagged | expired
- countryOrigin (string, 2-char code)
- countryDestination (string, 2-char code)
- hsCode (string, up to 12 chars)
- dutyRate (decimal)
- antiDumpingRate (decimal)
- complianceDate (datetime)
- expiryDate (datetime, optional)
- certificateNumber (string, optional)

### WarehouseLocation
- id (UUID)
- warehouseId (UUID)
- zone, aisle, rack, shelf, bin (strings)
- type: bulk | picking | staging | receiving | returns
- maxPallets (integer)
- currentPallets (integer)
- status: active | full | maintenance | inactive

### WarehouseTransaction
- id (UUID)
- type: receive | putaway | pick | pack | transfer | adjust | count
- productId (UUID)
- batchId (UUID, optional)
- fromLocationId (UUID, optional)
- toLocationId (UUID, optional)
- quantity (decimal)
- performedBy (UUID, user)
- timestamp (datetime)

---

## BUSINESS RULES

### Compliance
- Anti-dumping applies to Chinese origin products to US market (241% base + 305% anti-dumping)
- CPSC certification required for all US market products
- CE marking required for EU market (DE, FR, IT, ES, NL, BE, AT, DK, FI, SE, NO)
- Country-specific HS codes override defaults

### Warehouse
- Auto-assigns receiving location when goods arrive
- Suggests optimal putaway location based on weight/size/availability
- FIFO allocation for pick lists
- Location status auto-updates (active ↔ full) based on pallet count
- Variance reporting on stock counts automatically generated
