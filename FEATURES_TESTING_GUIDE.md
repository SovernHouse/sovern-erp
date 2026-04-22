# Phase 8 Features - Testing Guide

## Quick Start Testing

### Feature 1: Room Visualizer

**Access**: http://localhost:5173/visualizer (Customer Portal)

#### Test Scenarios

1. **Basic Room Visualization**
   - [ ] Navigate to Room Visualizer
   - [ ] Default rectangle room should display
   - [ ] Tiles should render with grout lines
   - [ ] Dimensions should show on edges

2. **Room Shape Selection**
   - [ ] Change room shape to L-Shape
   - [ ] Verify L-shaped room renders correctly
   - [ ] Change room shape to U-Shape
   - [ ] Verify U-shaped room renders correctly
   - [ ] Change back to Rectangle

3. **Dimension Input**
   - [ ] Change length to 8 meters
   - [ ] Verify room scale updates
   - [ ] Change width to 6 meters
   - [ ] Verify calculations update
   - [ ] Test edge values (1m and 50m)

4. **Tile Selection**
   - [ ] Click on "Beige Marble" tile
   - [ ] Verify tile color changes in canvas
   - [ ] Select "Dark Gray" tile
   - [ ] Verify color updates
   - [ ] Verify selected tile shows in Product Details card

5. **Tile Sizes**
   - [ ] Test each tile size (30x30 through 120x120)
   - [ ] Verify grid pattern changes
   - [ ] Verify calculation updates for each size

6. **Layout Patterns**
   - [ ] Test "Straight" pattern
   - [ ] Test "Brick/Offset" pattern
   - [ ] Test "Diagonal" pattern
   - [ ] Test "Herringbone" pattern
   - [ ] Test "Checkerboard" pattern (should show 2 colors)

7. **Grout Customization**
   - [ ] Select different grout colors
   - [ ] Use color picker for custom grout color
   - [ ] Test grout widths: Thin (1mm), Medium (2mm), Thick (3mm)
   - [ ] Verify visual changes in canvas

8. **Zoom Controls**
   - [ ] Click "Zoom In" button multiple times
   - [ ] Verify percentage increases (max 200%)
   - [ ] Click "Zoom Out" button
   - [ ] Verify percentage decreases (min 50%)

9. **Calculations**
   - [ ] Verify Total Area calculation (length × width)
   - [ ] Verify Tiles Needed with 10% waste factor
   - [ ] Verify Estimated Cost calculation
   - [ ] Change room size and verify recalculation

10. **Save Layout**
    - [ ] Click "Save Layout as PNG" button
    - [ ] Verify PNG downloads to device
    - [ ] Open PNG and verify it matches canvas

11. **Get Quote**
    - [ ] Click "Get Quote" button
    - [ ] Should navigate to /quotations/request
    - [ ] Verify pre-filled data in quotation form

12. **Reset Button**
    - [ ] Make various changes
    - [ ] Click "Reset" button
    - [ ] Verify all values return to defaults

---

### Feature 2: Bank Integration API

**Base URL**: http://localhost:5000/api/bank
**Headers Required**: `Authorization: Bearer {token}`

#### Using Postman or cURL

1. **Test LC Application Submission**
   ```bash
   POST /api/bank/lc/apply

   Body:
   {
     "lcAmount": 100000,
     "currency": "USD",
     "buyerBankCode": "CHASE001",
     "applicantDetails": {
       "name": "ABC Trading Company",
       "address": "123 Main St, New York, NY",
       "contact": "john@abctrading.com"
     },
     "beneficiary": {
       "name": "XYZ Tile Suppliers",
       "address": "456 Trade Ave, Shanghai, China",
       "contact": "sales@xyztiles.com"
     },
     "validity": "2024-06-15",
     "port": "Port of Shanghai"
   }
   ```
   - [ ] Response should include `submissionId`, `bankReference`, `status: "pending"`
   - [ ] `estimatedProcessingDays` should be 5-7

2. **Test LC Status Check**
   ```bash
   GET /api/bank/lc/{bankReference}/status
   ```
   - [ ] Response includes current status
   - [ ] Status should progress: pending → under_review → approved/rejected
   - [ ] Includes `nextSteps` array

3. **Test Document Submission**
   ```bash
   POST /api/bank/lc/{bankReference}/documents

   Body:
   {
     "documents": [
       {
         "type": "commercial_invoice",
         "filename": "invoice.pdf"
       },
       {
         "type": "bill_of_lading",
         "filename": "bol.pdf"
       },
       {
         "type": "packing_list",
         "filename": "packing.pdf"
       },
       {
         "type": "certificate_of_origin",
         "filename": "coo.pdf"
       },
       {
         "type": "insurance_certificate",
         "filename": "insurance.pdf"
       }
     ]
   }
   ```
   - [ ] Response should include `submissionId`
   - [ ] Should list any discrepancies (if docs missing)
   - [ ] Status should be "accepted" if all docs present

4. **Test Missing Documents**
   ```bash
   POST /api/bank/lc/{bankReference}/documents

   Body (missing insurance):
   {
     "documents": [
       { "type": "commercial_invoice", "filename": "invoice.pdf" },
       { "type": "bill_of_lading", "filename": "bol.pdf" },
       { "type": "packing_list", "filename": "packing.pdf" },
       { "type": "certificate_of_origin", "filename": "coo.pdf" }
     ]
   }
   ```
   - [ ] Response should include discrepancy for missing insurance
   - [ ] Status should be "pending_correction"

5. **Test LC Amendment**
   ```bash
   POST /api/bank/lc/{bankReference}/amend

   Body:
   {
     "amendments": {
       "type": "extension",
       "details": {
         "newValidityDate": "2024-07-15",
         "reason": "Delayed shipment"
       }
     }
   }
   ```
   - [ ] Response includes `amendmentRef`
   - [ ] Status should be "pending"
   - [ ] `estimatedDays` should be 3

6. **Test LC Advice**
   ```bash
   GET /api/bank/lc/{bankReference}/advice
   ```
   - [ ] Returns full LC details
   - [ ] Includes array of conditions
   - [ ] Includes shipment and document deadlines

7. **Test Charge Estimation**
   ```bash
   POST /api/bank/charges/estimate

   Body:
   {
     "lcAmount": 100000,
     "currency": "USD",
     "bankCode": "CHASE001"
   }
   ```
   - [ ] Response includes breakdown of fees:
     - [ ] LC Issuance Fee (0.3% = $300)
     - [ ] Amendment Fee ($150)
     - [ ] Negotiation Fee (0.2% = $200)
     - [ ] SWIFT Charges ($25)
   - [ ] Total should be $675

8. **Test Different LC Amounts**
   ```bash
   Test with: 50000, 500000, 1000000
   ```
   - [ ] Charge calculation scales correctly
   - [ ] Processing days increases with amount

9. **Test Error Handling**
   - [ ] Missing required field: Should return 400 Bad Request
   - [ ] Invalid bank reference: Should return 404 Not Found
   - [ ] Missing authentication: Should return 401 Unauthorized
   - [ ] Invalid LC amount (negative): Should return 400

---

### Feature 3: Barcode Scanner & Warehouse Operations

**Access**:
- Scan Receive: http://localhost:5173/warehouse/scan-receive (Factory Portal)
- Scan Inventory: http://localhost:5173/warehouse/scan-inventory (Factory Portal)

#### Test Scan Receive Page

1. **PO Loading**
   - [ ] Navigate to Scan Receive
   - [ ] Leave PO field empty, click "Load PO"
   - [ ] Should show error "Please enter a PO number"
   - [ ] Enter "PO-001" in the field
   - [ ] Click "Load PO"
   - [ ] Should display PO details (Supplier: ABC Tile Suppliers)
   - [ ] Should show 3 expected items

2. **Manual Barcode Entry**
   - [ ] Click "Scan" button
   - [ ] BarcodeScanner modal should open
   - [ ] Type "TILE-001" in manual entry field
   - [ ] Click "Submit"
   - [ ] Should close scanner and add item to received list
   - [ ] Item should show: Beige Marble 60x60, Expected: 100, Received: 1

3. **Multiple Item Scanning**
   - [ ] Click "Start Scanning Items"
   - [ ] Enter "TILE-002", Submit
   - [ ] Enter "TILE-003", Submit
   - [ ] Should show 3 items in received items table
   - [ ] All items should have variance = 0 except received vs expected

4. **Quantity Adjustment**
   - [ ] Click in "Received" column for TILE-001
   - [ ] Change 1 to 100
   - [ ] Item should no longer show as shortage
   - [ ] Update TILE-002 to 50 and TILE-003 to 75

5. **Discrepancy Detection**
   - [ ] Scroll down to Discrepancies card
   - [ ] Should show no discrepancies if all items match expected
   - [ ] Change TILE-001 received to 90
   - [ ] Should show shortage of 10 units (red, variance -10)
   - [ ] Change TILE-002 received to 60
   - [ ] Should show surplus of 10 units (orange, variance +10)

6. **Item Removal**
   - [ ] Click X button on any item
   - [ ] Item should be removed from received list
   - [ ] Discrepancies should update

7. **GRN Creation**
   - [ ] Ensure at least one item is scanned
   - [ ] Click "Create Goods Received Note (GRN)"
   - [ ] Should show success toast: "GRN created: GRN-{timestamp}"
   - [ ] Form should reset
   - [ ] Should return to PO selection step

8. **PO Change**
   - [ ] Load PO-002 instead
   - [ ] Should show 2 expected items (Flooring products)
   - [ ] Scan items and verify correct ones appear

#### Test Scan Inventory Page

1. **Zone Selection**
   - [ ] Navigate to Scan Inventory
   - [ ] Should see 3 zone buttons: ZONE-A, ZONE-B, ZONE-C
   - [ ] Click on "ZONE-A" button
   - [ ] Zone should highlight (blue border)
   - [ ] Click "Load Zone"
   - [ ] Should display zone details and scanning interface

2. **Product Counting**
   - [ ] Click "Scan Product"
   - [ ] BarcodeScanner modal opens
   - [ ] Enter "TILE-001" (first product in ZONE-A)
   - [ ] Should add to counted products with actualCount: 1
   - [ ] Scan same product again
   - [ ] Count should increment to 2
   - [ ] Scan "TILE-002" and "TILE-003"

3. **Manual Count Entry**
   - [ ] Update TILE-001 count to 485
   - [ ] ZONE-A expects 500, so variance should be -15
   - [ ] Background should be red (shortage)
   - [ ] Update TILE-002 to 375 (expects 350)
   - [ ] Background should be orange (surplus +25)
   - [ ] Update TILE-003 to 600 (expects 600)
   - [ ] Background should be green (no variance)

4. **Variance Highlighting**
   - [ ] Shortage items: Red background, negative variance
   - [ ] Surplus items: Orange background, positive variance
   - [ ] Perfect match: Green background
   - [ ] Percentage shown for each variance

5. **Finish Counting**
   - [ ] Click "Finish Counting"
   - [ ] All products should be counted
   - [ ] Variances card should show all discrepancies
   - [ ] Should list shortage, surplus, and variance percentages

6. **Missing Items Detection**
   - [ ] Remove one product from count
   - [ ] Click "Finish Counting"
   - [ ] Should show error about missing products
   - [ ] Rescan all products to complete

7. **Stock Count Submission**
   - [ ] After all products counted
   - [ ] Click "Submit Stock Count"
   - [ ] Should show success toast
   - [ ] Form should reset

8. **Zone Switching**
   - [ ] Click "Change Zone"
   - [ ] Select ZONE-B
   - [ ] Should show different products
   - [ ] Repeat counting process

#### Barcode Scanner Testing

1. **Camera Permission**
   - [ ] Click "Start Scanning Items" or "Scan Product"
   - [ ] Grant camera permission when prompted
   - [ ] Video feed should appear
   - [ ] Green scanning rectangle should be visible

2. **Manual Fallback**
   - [ ] If camera permission denied, manual input field should be available
   - [ ] Type barcode code manually
   - [ ] Submit should work without camera

3. **Camera Controls** (if supported)
   - [ ] "Switch" button should toggle front/back camera
   - [ ] "Torch" button should toggle flash (if device supports)
   - [ ] "Stop" button should close camera

4. **Supported Formats**
   - [ ] Test Code128: "TILE-001" (simulated)
   - [ ] Test EAN-13: Standard barcode format
   - [ ] Test QR codes: Should auto-detect and scan

---

## Accessibility Testing

### Screen Reader Testing
- [ ] All buttons have proper labels
- [ ] Form inputs have associated labels
- [ ] Error messages are announced
- [ ] Table headers are properly marked

### Keyboard Navigation
- [ ] Tab through all controls
- [ ] Enter key activates buttons
- [ ] Escape closes modals
- [ ] Can interact with all features via keyboard only

### Responsive Design
- [ ] Test on mobile (375px width)
- [ ] Test on tablet (768px width)
- [ ] Test on desktop (1920px width)
- [ ] All features accessible at each breakpoint

---

## Performance Testing

### Room Visualizer
- [ ] Canvas rendering smooth at 60 FPS
- [ ] No lag when changing patterns
- [ ] Zoom operation is responsive
- [ ] PNG export completes within 2 seconds

### Barcode Scanner
- [ ] Camera initialization within 1 second
- [ ] Barcode detection within 500ms
- [ ] Manual input response immediate

### Warehouse Pages
- [ ] Page load time < 2 seconds
- [ ] Table operations smooth with 20+ items
- [ ] Form submission within 1 second

---

## Browser Compatibility

- [ ] Chrome/Chromium 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Edge 90+

### Feature Support
- [ ] Canvas API: All modern browsers
- [ ] getUserMedia: Chrome, Firefox, Safari, Edge (HTTPS required)
- [ ] BarcodeDetector: Chrome 83+, Edge 83+ (not Safari/Firefox)
- [ ] localStorage: All modern browsers

---

## Data Integrity Testing

### Room Visualizer
- [ ] Calculations are mathematically accurate
- [ ] 10% waste factor correctly applied
- [ ] Pricing calculations match product rates
- [ ] PNG export captures current state

### Bank API
- [ ] LC reference numbers are unique
- [ ] Status changes are logical (no jumps)
- [ ] Charge calculations are accurate
- [ ] No data loss between requests

### Warehouse
- [ ] Scanned items persist correctly
- [ ] Quantities don't reset unexpectedly
- [ ] Discrepancies calculated correctly
- [ ] GRN/Stock Count data complete

---

## Error Scenario Testing

1. **Network Failures**
   - [ ] No internet: Display offline message
   - [ ] Slow connection: Show loading spinner
   - [ ] Server error 500: Display error message

2. **Invalid Input**
   - [ ] Negative dimensions: Prevent or show error
   - [ ] Negative quantities: Prevent or show error
   - [ ] Missing PO: Show clear error message
   - [ ] Invalid barcode: Show not found message

3. **Permission Denials**
   - [ ] Camera denied: Show fallback manual entry
   - [ ] Microphone denied: Should not affect scanning
   - [ ] Storage denied: Show error for save operations

4. **Session Expiry**
   - [ ] Logout: All authenticated features fail gracefully
   - [ ] Token expiry: Redirect to login
   - [ ] 401 error: Display auth error message

---

## Regression Testing (After Updates)

After any code changes, verify:
- [ ] All 3 features still load
- [ ] Routes still accessible
- [ ] Navigation items still visible
- [ ] No console errors
- [ ] Styling intact
- [ ] Calculations accurate
- [ ] API responses correct

---

## Sign-Off Checklist

- [ ] All test scenarios passed
- [ ] No critical bugs found
- [ ] Accessibility verified
- [ ] Performance acceptable
- [ ] Cross-browser tested
- [ ] Mobile responsive
- [ ] Error handling working
- [ ] Data integrity confirmed

---

**Test Date**: ________________
**Tested By**: ________________
**Status**: ☐ Pass ☐ Fail ☐ Pass with Notes

**Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

