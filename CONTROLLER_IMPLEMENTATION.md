# Trading ERP Controllers Implementation

## Overview
This document describes the implementation of three core business logic controllers for the Trading ERP system:
1. Product Specifications Controller
2. Container Loading Optimization Controller
3. Batch & Shade Tracking Controller

All controllers follow the established conventions using SQLite with Sequelize, fire-and-forget audit logging, and consistent error handling patterns.

---

## 1. Product Specifications Controller
**File**: `/backend/controllers/productSpecsController.js`

### Purpose
Manages tile-specific product specifications including abrasion ratings, water absorption classifications, shade variations, slip resistance, and other technical tile properties.

### Endpoints & Functions

| Function | Route | Method | Purpose |
|----------|-------|--------|---------|
| `createSpecs` | `/api/products/:id/specs` | POST | Create product specifications with all tile technical data |
| `getSpecs` | `/api/products/:id/specs` | GET | Retrieve specs for a specific product |
| `updateSpecs` | `/api/products/:id/specs` | PUT | Update existing specifications |
| `filterBySpecs` | `/api/products/specs/filter` | GET | Search products by specification criteria |
| `compareSpecs` | `/api/products/specs/compare` | POST | Compare 2-4 products side by side |
| `getByPeiRating` | `/api/products/specs/by-pei/:rating` | GET | Get products by PEI rating (1-5) |
| `getByShadeVariation` | `/api/products/specs/by-shade/:variation` | GET | Get products by shade variation (V1-V4) |
| `getBySlipResistance` | `/api/products/specs/by-slip/:rating` | GET | Get products by slip resistance (R9-R13) |
| `getFrostResistant` | `/api/products/specs/frost-resistant` | GET | Get frost-resistant products |
| `getTemplate` | `/api/products/specs/template` | GET | Return specification template with all fields |

### Key Features
- **Specification Fields**:
  - PEI Rating (1-5)
  - Water Absorption (percentage, group classification)
  - Shade Variation (V1-V4)
  - Slip Resistance (R9-R13, DIN 51130)
  - Frost Resistance (boolean)
  - Chemical Resistance (class AA/A/B/C)
  - Breaking Strength (N)
  - Modulus of Rupture (N/mm²)
  - Surface Finish (matte, polished, lappato, structured, natural)
  - Dimensions (length, width, thickness in mm)
  - Weight per sqm calculation

- **Validation**:
  - One specification per product (unique constraint)
  - Prevents duplicate specifications
  - Validates tile dimensions and ratings

- **Audit Trail**:
  - Tracks specification changes with user attribution
  - Records last update timestamp and user

---

## 2. Container Loading Optimization Controller
**File**: `/backend/controllers/containerLoadingController.js`

### Purpose
Optimizes container loading for heavy tile shipments, calculating weight/volume utilization and recommending optimal container types.

### Container Specifications (Built-in)
```
20ft:  21,700 kg payload | 33.2 cbm | 10 EUR pallet capacity
40ft:  26,680 kg payload | 67.6 cbm | 20 EUR pallet capacity
40ft HC: 26,460 kg payload | 76.3 cbm | 22 EUR pallet capacity
```

### Endpoints & Functions

| Function | Route | Method | Purpose |
|----------|-------|--------|---------|
| `getContainerTypes` | `/api/container-loading/container-types` | GET | List all available container types |
| `getContainerTypeConfig` | `/api/container-loading/container-types/:type` | GET | Get configuration for specific type |
| `calculateLoading` | `/api/container-loading/calculate` | POST | Calculate detailed loading plan for items |
| `optimizeLoading` | `/api/container-loading/optimize` | POST | Recommend optimal container type |
| `createContainer` | `/api/container-loading/containers` | POST | Create container record |
| `getContainers` | `/api/container-loading/containers` | GET | List containers with filters |
| `getContainerById` | `/api/container-loading/containers/:id` | GET | Get container details |
| `updateContainer` | `/api/container-loading/containers/:id` | PUT | Update container info |
| `updateContainerStatus` | `/api/container-loading/containers/:id/status` | PATCH | Change container status |
| `addItemsToContainer` | `/api/container-loading/containers/:id/add-items` | POST | Add batch items to container |
| `getManifest` | `/api/container-loading/containers/:id/manifest` | GET | Get container manifest |
| `getLoadingRecommendations` | `/api/container-loading/recommendations` | POST | Get ranked container recommendations |
| `calculateUtilization` | `/api/container-loading/utilization` | POST | Calculate utilization metrics |
| `getStatistics` | `/api/container-loading/statistics` | GET | Get container usage statistics |

### Key Features
- **Weight Calculation**:
  - Tiles: 25-30 kg/sqm (default 27.5 kg/sqm)
  - Total weight = quantity × weight per sqm
  - Enforces weight capacity limits

- **Volume Calculation**:
  - Volume = quantity × (length/1000) × (width/1000) × (thickness/1000)
  - Checks against container volume limits

- **Pallet Optimization**:
  - EUR pallet dimensions: 1.2m × 1.0m × 0.144m
  - Calculates optimal pallet arrangement
  - Supports 2-3 pallet stacking for tiles

- **Container Capacity**:
  - Fills by weight first (typically limiting factor)
  - Reports both weight and volume utilization
  - Recommends best-fit container type

- **Status Tracking**:
  - available, planning, loading, loaded, in_transit, delivered, empty, maintenance

### Response Format
```json
{
  "containerType": "40ft",
  "totalWeight": 13700.5,
  "totalVolume": 45.2,
  "weightUtilizationPercent": 51.3,
  "volumeUtilizationPercent": 66.8,
  "utilizationPercent": 66.8,
  "limitingFactor": "volume",
  "recommendation": "OK",
  "loadingDetails": [...]
}
```

---

## 3. Batch & Shade Tracking Controller
**File**: `/backend/controllers/batchTrackingController.js`

### Purpose
Manages production batch tracking with strict shade code consistency to ensure customers receive matching tiles.

### Endpoints & Functions

| Function | Route | Method | Purpose |
|----------|-------|--------|---------|
| `createBatch` | `/api/batches` | POST | Create production batch |
| `getBatches` | `/api/batches` | GET | List all batches with filters |
| `getBatchById` | `/api/batches/:id` | GET | Get batch with allocations |
| `updateBatch` | `/api/batches/:id` | PUT | Update batch details |
| `getBatchesByProduct` | `/api/batches/by-product/:productId` | GET | Get all batches for product |
| `getBatchesByShade` | `/api/batches/by-shade/:shadeCode` | GET | Get batches by shade code |
| `updateStatus` | `/api/batches/:id/status` | PATCH | Update batch status |
| `updateQualityStatus` | `/api/batches/:id/quality` | PATCH | Update quality inspection status |
| `allocateBatch` | `/api/batches/:id/allocate` | POST | Allocate batch to sales/purchase order |
| `getBatchAllocations` | `/api/batches/:id/allocations` | GET | Get all allocations for batch |
| `updateAllocationStatus` | `/api/batches/allocations/:allocationId/status` | PATCH | Track allocation through picked/shipped/delivered |
| `getInventorySummary` | `/api/batches/summary/inventory` | GET | Get inventory by product & shade |
| `getShadeAvailability` | `/api/batches/availability/shades` | GET | List available shades with quantities |

### Key Features
- **Batch Attributes**:
  - batchNumber (unique)
  - shadeCode (e.g., "A1", "B2") - critical for matching
  - shadeName (descriptive label)
  - caliberCode (exact size, e.g., "598x598" for nominal 600x600)
  - productionDate
  - manufacturingLocation
  - totalQuantity (sqm by default)

- **Quantity Tracking**:
  - totalQuantity: Initial received amount
  - quantityReceived: Confirmed received amount
  - quantityAllocated: Amount reserved for orders
  - quantityAvailable: Free stock (totalQuantity - quantityAllocated)

- **Status Lifecycle**:
  - pending → in_transit → received → stored → partially_allocated → fully_allocated
  - Special states: quarantined, expired

- **Quality Inspection**:
  - pending_inspection → approved/rejected/conditional_approval
  - Records inspection date and notes

- **Shade Consistency Enforcement**:
  - Warns when allocating different shade codes to same order
  - Allows allocation but logs warnings for business review
  - Enables end-to-end traceability

- **Allocation Tracking**:
  - allocated → reserved → picked → shipped → delivered
  - Tracks quantities at each stage
  - Records timestamps for audit trail

### Inventory Summary Example
```json
{
  "productId": "uuid",
  "productName": "Porcelain Tile 600x600",
  "shadeCode": "A1",
  "shadeName": "Warm White",
  "totalQuantity": 5000,
  "allocatedQuantity": 1250,
  "availableQuantity": 3750,
  "batches": [
    {
      "batchNumber": "BATCH-001",
      "available": 2500,
      "allocated": 500,
      "status": "partially_allocated"
    }
  ]
}
```

---

## Database Models

### ProductSpecification
- `id` (UUID, PK)
- `productId` (UUID, FK to Product, unique)
- `peiRating`, `waterAbsorption`, `shadeVariation`, `slipResistance`
- `length`, `width`, `thickness` (mm)
- `surfaceFinish`, `frostResistant`, `breakingStrength`
- `colorCode`, `origin`, `certifications`, `standardReference`
- `chemicalResistance` (JSON), `notes`
- `lastUpdated`, `updatedBy` (user audit)

### Container
- `id` (UUID, PK)
- `containerNumber` (unique)
- `containerType` (enum: 20ft, 40ft, 40ft_hc)
- `containerStatus` (enum: available, planning, loading, loaded, in_transit, delivered, empty, maintenance)
- `shipmentId`, `purchaseOrderId` (FK)
- `cargoWeight`, `maxWeight`, `usedCapacity`
- `palletCount`, `boxCount`
- `etd`, `eta`, `seal1`, `seal2`
- `carrier`, `vessel`, `voyage`
- `loadingWarehouse`, `notes`

### ProductBatch
- `id` (UUID, PK)
- `batchNumber` (unique)
- `productId` (FK)
- `shadeCode` (critical for matching)
- `caliberCode`, `productionDate`
- `totalQuantity`, `quantityReceived`, `quantityAllocated`, `quantityAvailable`
- `status`, `qualityStatus`
- `inspectionDate`, `inspectionNotes`
- `warehouseLocation`

### BatchAllocation
- `id` (UUID, PK)
- `productBatchId` (FK)
- `salesOrderId` or `purchaseOrderId` (FK)
- `allocatedQuantity`, `allocationDate`
- `status` (enum: allocated, reserved, picked, shipped, delivered, cancelled)
- `pickedQuantity`, `pickedDate`
- `shippedQuantity`, `shippedDate`
- `deliveredQuantity`, `deliveredDate`

---

## Model Associations (in models/index.js)

```javascript
// Product Specifications
db.Product.hasOne(db.ProductSpecification, { as: 'specification' });
db.ProductSpecification.belongsTo(db.Product, { as: 'product' });

// Product Batches
db.Product.hasMany(db.ProductBatch, { as: 'batches' });
db.ProductBatch.belongsTo(db.Product, { as: 'product' });

// Batch Allocations
db.ProductBatch.hasMany(db.BatchAllocation, { as: 'allocations' });
db.BatchAllocation.belongsTo(db.ProductBatch, { as: 'productBatch' });
db.SalesOrder.hasMany(db.BatchAllocation, { as: 'allocations' });
db.PurchaseOrder.hasMany(db.BatchAllocation, { as: 'allocations' });

// Containers
db.Shipment.hasMany(db.Container, { as: 'containers' });
db.PurchaseOrder.hasMany(db.Container, { as: 'containers' });
```

---

## Error Handling

All controllers follow standard conventions:

**Success Response**:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* entity data */ }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400
  }
}
```

**Common Errors**:
- 400: ValidationError (invalid input, capacity exceeded)
- 404: NotFoundError (product/batch/container not found)
- Automatic middleware error handling via `next(error)`

---

## Audit Logging

All create/update operations fire async audit logs:
```javascript
auditService.logAction(
  userId,
  'CREATE|UPDATE|DELETE',
  'EntityName',
  entityId,
  { data: serializedData },
  ipAddress
).catch(() => {}); // Fire-and-forget
```

---

## Testing

Comprehensive integration tests provided:

1. **productSpecs.test.js** (8 test suites, 20+ test cases)
   - CRUD operations
   - Specifications filtering
   - Product comparison
   - Template retrieval

2. **containerLoading.test.js** (10 test suites, 25+ test cases)
   - Container type management
   - Loading calculations
   - Optimization recommendations
   - Utilization metrics
   - Statistics

3. **batchTracking.test.js** (15 test suites, 30+ test cases)
   - Batch creation and listing
   - Status transitions
   - Quality inspection
   - Batch allocation with shade matching
   - Inventory summaries
   - Shade availability reports

**Run tests**:
```bash
npm test -- productSpecs.test.js
npm test -- containerLoading.test.js
npm test -- batchTracking.test.js
```

---

## Implementation Notes

### Route File Integration
All routes are already defined and reference these controllers:
- `/backend/routes/productSpecsRoutes.js`
- `/backend/routes/containerLoadingRoutes.js`
- `/backend/routes/batchTrackingRoutes.js`

Function names in routes match controller exports exactly.

### Database Conventions
- SQLite with `underscored: true` configuration
- camelCase in JavaScript → snake_case in database
- UUIDs for primary keys
- Timestamps for audit trails

### Business Logic Highlights
1. **Shade Consistency**: Warnings on mixed shades in orders (not blocking)
2. **Container Optimization**: Weight-first calculation (typically limiting)
3. **Inventory Accuracy**: Real-time quantity tracking across allocations
4. **Audit Ready**: All changes logged for compliance

---

## Future Enhancements
- Machine learning for optimal pallet stacking patterns
- Integration with warehouse management systems
- Real-time shipping cost estimation by route
- Automated quality control notifications
- Historical batch comparison analytics

