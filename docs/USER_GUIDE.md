# Trading ERP System - User Guide

Comprehensive user guide for all portals of the Trading ERP System.

---

## Table of Contents

1. [Admin Portal Guide](#admin-portal-guide)
2. [Customer Portal Guide](#customer-portal-guide)
3. [Factory Portal Guide](#factory-portal-guide)
4. [Common Workflows](#common-workflows)
5. [FAQs](#faqs)
6. [Configurable Dashboard](#configurable-dashboard)
7. [Google Calendar](#google-calendar)
8. [Google Drive](#google-drive)

---

## Admin Portal Guide

### Overview

The Admin Portal is the central management interface for internal staff. It provides complete control over the entire trading operation including customer management, order processing, shipment tracking, and financial reporting.

**Access**: http://localhost:3000

**Default Credentials**:
- Email: admin@floortrading.com
- Password: admin123

### Dashboard

Upon login, you'll see the Admin Dashboard with key performance indicators:

**Dashboard Widgets**:
- **Total Orders**: Count and value of all orders
- **Pending Orders**: Orders awaiting confirmation
- **In-Transit Shipments**: Real-time shipment status
- **Outstanding Invoices**: AP/AR aging summary
- **Revenue This Month**: YTD revenue tracker
- **New Customers**: Recent customer additions

**Quick Actions**:
- Create new order
- View pending approvals
- Check shipment status
- Generate reports

**Brand Filter on Dashboards (Phase 3)**

Multi-brand users (you, today) see a Brand picker in the top right of the dashboard. Pick SH or FW to narrow every widget to that brand. Single-brand users (e.g. a future FW-only sales rep) don't see the picker; their view is always scoped to their brand.

In cross-brand mode, super-admin gets an additional "All Brands" option that shows a combined revenue widget and a side-by-side SH vs FW comparison chart. All Brands mode is read-only by design (per the Phase 1 architectural decision); switch back to a single brand before making any outbound action.

**FlorWay Commission Widget**

If you have FW access, the dashboard shows a FlorWay Commission card with three tiles: Accrued, Paid, Pending — all for the current Asia/Taipei month. Click "Show orders" to expand the contributing list; each pending row has an inline percentage input that re-calculates and saves on blur. Default rate is 5%; you can adjust any pending row up or down. Once a commission is approved or paid, the rate locks for that row.

### Navigation Menu

**1. Customer Management**
   - View all customers
   - Create new customer
   - Manage contacts
   - Track customer interactions
   - View customer history

**2. Sales Management**
   - Inquiries → Track incoming product requests
   - Quotations → Create and manage quotations
   - Orders → Full sales order management
   - Proforma Invoices → PI creation and tracking

**3. Operations**
   - Purchase Orders → Factory orders
   - Packing Lists → Package allocation
   - Shipments → Track shipments end-to-end
   - Inspection → QC results and reports

**4. Finance**
   - Invoices → Sales/Purchase invoicing
   - Payments → Payment recording and tracking
   - Aging Reports → AR/AP aging analysis
   - P&L Statements → Financial reporting

**5. Inventory**
   - Stock Levels → Current inventory status
   - Movements → Stock transaction history
   - Adjustments → Manual stock adjustments
   - Reorder Alerts → Low stock notifications

**6. Support**
   - Claims → Customer claim management
   - Documents → Centralized document storage
   - Communications → Messages and notifications

**7. Settings**
   - Users → User management
   - Roles → Role and permission management
   - Company Settings → Branding and configuration
   - API Keys → Integration settings

### Managing Customers

#### Creating a New Customer

1. Navigate to **Customer Management** → **New Customer**
2. Fill in customer information:
   - Company name (required)
   - Contact email and phone
   - Business address
   - Payment terms and credit limit
3. Add contact persons:
   - Click "Add Contact"
   - Enter name, position, email, phone
   - Mark as primary if needed
4. Click "Save Customer"

#### Tracking FlorWay Commission (Phase 4)

Open the **FlorWay commission** entry in the user menu (visible if you have FW access or are super-admin).

**KPIs at top:**
- MTD / QTD / YTD Accrued — total commission you've accrued in the current Taipei month, quarter, year.
- Pending payment — any commission stuck in `accrued` or `invoiced_to_factory` status, regardless of date.

**Pipeline forecast** — sum of every open FlorWay quotation multiplied by its commission rate (override if set, else brand default 5%). Upper-bound estimate assuming every open quote converts.

**Outstanding > 30 days** — commission rows stuck in `accrued` or `invoiced_to_factory` for more than 30 days. Chase the factory.

**Deals table** — every commission row under FlorWay with customer, date, rate, amount, status.

**Super-admin only actions** (visible only when you're super-admin):
- **Inline rate edit** on the deals table — click the percentage cell, type a new rate (≥ 5%), press blur. Saves immediately, audited.
- **Mark paid** — sets status to paid and stamps the date. Audited.
- **Claw back** — sets status to clawed_back. Requires a written reason (≥ 5 chars). Audited.

**Per-quotation commission rate override** — set on the quotation itself (NOT on the SO). The override applies when the resulting SO confirms and accrual fires. The 5% floor is locked (HanHua/FlorWay agreement, 2026-05-14) and cannot be overridden.

**Mobile** — the dashboard tab shows a commission widget for FW users. Tapping it opens the full read-only deals list. Rate edits and mark-paid stay desktop-only.

#### Managing the Product Catalog (Phase 4)

Open **Settings > Product catalog** to manage what shows up in the quotation product picker. Each product belongs to a brand: FlorWay products on FlorWay quotations, Sovern House products on SH quotations.

**Adding a product:**

1. Click **+ New Product**.
2. Pick the brand (locked at creation — to move a product to a different brand later you'd need a super-admin brand override).
3. Enter SKU (use a brand prefix like `FW-` or `SH-`), name, category, factory.
4. Enter the **Base FOB price**. This is the FLOOR — the price the buyer sees. It already includes any commission the factory bakes in, so the ERP never adds a percentage on top.
5. Set MOQ, MOQ unit, lead-time days, origin country.
6. Save.

**Editing an existing product:** click the pencil icon on the catalog row. Brand is locked. Other fields are editable.

**Deactivating:** click the power icon. Buyers can't pick a deactivated product on new quotations. Existing quotations referencing the product still work. Reactivate any time by clicking the power icon again.

**Product Taxonomy (Phase 4.9.1):** the flooring categories now sit under a `Flooring → Resilient` hierarchy. `Engineered SPC` is the newest sub-category, used for multi-layer rigid-core flooring with SPC outer wear layers sandwiching a WPC middle. The AI Assistant can create / update / archive / restore categories via natural-language chat under super-admin control (preview-confirm-save pattern, audited). Categories with active products bound cannot be archived from chat — those products must be re-categorised or archived first.

**Brand admin (Phase 4.9.1):** the Brand card editor adds two fields, `Commission rate` (decimal between 0 and 1, e.g. 0.07 = 7%) and an `Active` status checkbox. Deactivating a brand keeps every historical row intact but hides the brand from product/quotation pickers and the AI brand list. Both fields can also be edited via the AI assistant.

**Factory brand (Phase 4.9.2a):** factories now carry an optional brand context. Set it on the Factory form. Used by the AI assistant's match_factories_for_product tool to prefer same-brand suppliers when ranking matches, and by analytics to split portfolios. Leave blank for genuinely cross-brand suppliers.

**Price history (Phase 4.9.2b/c):** every Product has a Price History panel on its edit form (shown only after the product exists). Each price row pins a cost + selling combo to a (factory and/or origin) and a validity window. The quotation builder reads the current active row to set the floor price. Manual edits to the legacy `Base FOB price` field on the form are still honoured but the canonical source is now the Price History rows — the floor sees whichever you edited last. Future-dated rows are supported; the floor flips on `validFrom`. The AI assistant can create / update / get-current-price via natural-language chat under super-admin control.

**AI assistant onboarding flows (Phase 4.9.3):** chat mode can now create customers and products end-to-end. Two examples:

- `"Create a customer in FW context: Milliken Carpet, industry contract flooring, country US, source 'trade show — Domotex 2026'"` runs `create_customer` under brand FW with the structured extras (industry, source) saved to a Customer.metadata column. Returns the new id.
- `"Create a new product: brand FW, SKU IL-EPC-5MM-OAK, category Engineered SPC, name 'IronLite Engineered SPC 5mm Oak'. Add a HanHua price at 5.80 USD/m² from China"` runs `create_product` + `create_product_price` in two calls, returns both IDs.

Both flows show a preview before writing. All AI writes audit under the `ai_assistant_*` prefix in the audit trail.

**Outreach drafting via chat:** ask the assistant to "draft an outreach to lead {id} for review" and it calls `send_outreach_email` with `draftOnly=true`. The row appears in the lead's outreach panel with status `draft` for one-click manual send. Default behavior is still live send — only triggered when you explicitly approve the content first.

**Two Drive accounts:** the assistant routes Drive lookups by brand. Anything in FW context (HanHua, FlorWay, IronLite) automatically hits `alexflorway@gmail.com`; everything else hits `alex@sovernhouse.co`. You can also pass an explicit account selector if you need to override.

**How the catalog feeds the quotation form:**

When you create a quotation, the Product dropdown is filtered to the quotation's brand. Picking a product auto-fills the unit price with the base FOB. You can edit the price upward without approval. Editing below floor requires super-admin role plus a written reason (saved to the audit log).

**Mobile:** the Products tab on mobile shows the same brand-aware list with a brand filter at top. Single-brand users don't see the filter; super-admins see the picker.

#### Cross-Brand Auto-Add (Phase 3)

When you create a new Lead, Quotation, or Deal against an existing customer under a brand that customer didn't yet have, the brand is added to their relationships automatically. A confirmation toast appears: "Customer X is now also a [BRAND] relationship." The customer's detail page picks up the new brand badge on next load. The change is logged in the audit trail.

The Brand picker appears at the top of every create form (Lead, Quotation, Deal). It pre-fills to your default brand and locks once the record is saved (super-admin can override later via the brand-override flow).

**Brand isolation**: if a colleague who only has access to brand SH tries to open a FW quotation by URL or ID, they get a 404 (not a 403). The existence of the record isn't leaked to users outside the brand.

#### FlorWay Product Branding Mode (Phase 3)

For FlorWay customers, the customer detail page shows a **FW Product Branding Mode** card with three options:

- **IronLite Core**: Buyer's quotations render under the IronLite brand (I-Beam wordmark, OEM badge, plus a construction-diagram addendum page for WPC products).
- **Generic FlorWay** (default): Quotations render under the FlorWay Sdn. Bhd. wordmark with no IronLite imagery.
- **Private Label**: Buyer's own brand name appears on the document. You must enter the brand name (e.g. "OakCove Flooring"); the quotation says "Manufactured exclusively for [buyer]".

**Lock-after-sent**: The first time you send an FW quotation under the current mode, the mode locks. This prevents switching mid-deal, which would create document inconsistency between what the buyer received and what's on file. The locked-since timestamp is displayed on the card in Asia/Taipei time.

**Super-admin override**: If you need to change the mode after it's been locked (e.g. the buyer reconsiders IronLite vs Private Label between deals), click **Override lock** on the picker, enter a reason (min 3 chars), and confirm. The override is logged in the audit trail.

For SH-only customers the card doesn't appear (productBrandingMode is FW-specific).

#### Viewing Customer Details

1. Go to **Customer Management** → **Customers**
2. Search or browse the customer list
3. Click on customer name to view:
   - Full profile
   - Contact information
   - Order history
   - Activities
   - Outstanding balance
   - Communication history

#### Managing Customer Contacts

1. In customer profile, go to **Contacts** tab
2. Add new contact:
   - Click "Add Contact"
   - Fill in details
   - Mark primary contact if applicable
3. Edit or delete existing contacts
4. Track primary vs. secondary contacts

#### Tracking Customer Activities

1. In customer profile, go to **Activities** tab
2. Log activities:
   - Call (log date, time, notes)
   - Email (reference email content)
   - Meeting (date, attendees, discussion)
   - Note (internal notes)
3. Assign follow-ups
4. Set reminders for next action

### Managing Sales Orders

#### Creating a Sales Order (from Quotation)

1. Navigate to **Sales Management** → **Quotations**
2. Find quotation with status "Accepted"
3. Click "Convert to Sales Order"
4. Fill in order details:
   - Delivery address
   - Delivery date
   - Special instructions
5. Review items and pricing
6. Click "Create Sales Order"

#### Confirming a Sales Order

1. Go to **Sales Management** → **Orders**
2. Find order with status "Pending"
3. Click order to open details
4. Review all information:
   - Customer details
   - Order items and quantities
   - Total amount and payment terms
   - Delivery date
5. Click "Confirm Order"
6. System automatically creates purchase orders

#### Tracking Order Status

1. In **Orders**, orders show status:
   - **Pending**: Awaiting confirmation
   - **Confirmed**: Ready for production
   - **Processing**: Being produced
   - **Shipped**: In transit
   - **Delivered**: Received by customer
   - **Cancelled**: Order cancelled

2. Click order to see:
   - Related purchase orders
   - Packing lists
   - Shipment information
   - Invoice and payment status

### Managing Quotations

#### Creating a Quotation

1. Go to **Sales Management** → **Quotations**
2. Click "New Quotation"
3. Select customer
4. Add line items:
   - Product name
   - Quantity and unit
   - Unit price
   - Notes
5. Set commercial terms:
   - Payment terms
   - Valid until date
   - Currency
6. Add notes or terms & conditions
7. Save as draft or directly send to customer

#### Sending Quotation to Customer

1. Open quotation in Draft status
2. Click "Send to Customer"
3. Enter recipient email(s)
4. Add message (optional)
5. Click "Send"
6. Status changes to "Sent"
7. System sends email with PDF quotation

#### Managing Quotation Versions

1. Open quotation
2. Go to **Revisions** tab
3. View all previous versions
4. Create new revision:
   - Click "Create Revision"
   - Update items/pricing
   - Add change summary
   - Save
5. New revision becomes current version
6. Can revert to previous revision if needed

#### Brand-Aware Quotation Documents (Phase 3)

Quotations render with the layout of the brand that issues them:

- **Sovern House** quotations render with the Sovern House layout (ink and forest palette, NRIEC Taiwan legal footer, alex@sovernhouse.co sender block).
- **FlorWay** quotations render with the FlorWay iron-deep and cream palette, FLORWAY SDN. BHD. Malaysian legal footer, and alexflorway@gmail.com sender block.

For FlorWay, three sub-variants exist. The renderer picks one automatically based on the customer's **Product Branding Mode**:

| Mode | When to use | What the PDF looks like |
|---|---|---|
| **IronLite** | Buyer wants to sell under the IronLite Core brand | I-Beam wordmark header, OEM badge on cover and footer, and (when any line item is a WPC product) a construction diagram addendum page |
| **Generic** (default) | Buyer wants a neutral FlorWay quote with no sub-brand | FlorWay Sdn. Bhd. wordmark with no IronLite imagery |
| **Private Label** | Buyer wants their own brand on the document | Placeholder during development. The PDF currently uses the FlorWay generic layout with a banner naming the buyer's brand. The full template ships when the first OEM private-label buyer signs |

The variant is shown above the line items on the quotation detail page so you know what the buyer will receive before clicking **Send** or **Download PDF**. To switch a customer between IronLite and Generic, go to the customer detail page and update Product Branding Mode (this picker UI ships in C12).

#### Downloading and Previewing the PDF

- **Desktop**: click **PDF** in the quotation header. The brand-aware PDF downloads instantly.
- **Mobile**: open the quotation, tap **Preview PDF** (opens in the device's PDF viewer) or **Download PDF** (opens the share sheet so you can save to Files, Drive, or send to a buyer).

The same PDF is attached to the email when you click **Send via ERP**.

### Managing Shipments

#### Creating a Shipment

1. Go to **Operations** → **Shipments**
2. Click "New Shipment"
3. Select sales order
4. Enter shipment details:
   - Vessel name and type
   - Container number and type
   - Departure port
   - Destination port
   - Departure date
   - Expected arrival date (ETA)
5. Link packing list
6. Click "Create Shipment"

#### Tracking Shipment Status

1. Go to **Shipments**
2. View all shipments with current status:
   - **Booked**: Container booked, awaiting loading
   - **Shipped**: Loaded and departed
   - **In Transit**: On the way
   - **Arrived**: Arrived at destination port
   - **Delivered**: Delivered to customer

3. Click shipment for tracking details:
   - Full shipment route
   - Current location
   - Estimated arrival
   - Container and vessel info
   - Bill of Lading
   - All related documents

#### Updating Shipment Status

1. Open shipment
2. Click "Update Status"
3. Select new status
4. Add location and notes
5. Update ETA if changed
6. System sends customer notification
7. Historical tracking maintained

### Financial Management

#### Creating an Invoice

1. Go to **Finance** → **Invoices**
2. Click "New Invoice"
3. Select sales order or shipment
4. System auto-populates:
   - Customer information
   - Items and pricing
   - Total amount
5. Set invoice date and due date
6. Add payment terms
7. Click "Create Invoice"

#### Recording Payments

1. Open invoice with "Sent" status
2. Click "Record Payment"
3. Enter payment details:
   - Payment amount
   - Payment date
   - Payment method (bank transfer, check, etc.)
   - Reference number
   - Notes
4. Click "Record"
5. Invoice status updates to "Paid" if fully paid
6. Status changes to "Partially Paid" if partial payment

#### Running Financial Reports

1. Go to **Finance** → **Reports**
2. Select report type:
   - **P&L Statement**: Revenue and expenses
   - **AR Aging**: Customer payment aging
   - **AP Aging**: Vendor payment aging
   - **Revenue Analysis**: Sales trends

3. Set date range
4. Choose filters (customer, product category, etc.)
5. Click "Generate Report"
6. View, print, or export results

### User Management

#### Creating a New User

1. Go to **Settings** → **Users**
2. Click "New User"
3. Enter user details:
   - Email address
   - First and last name
   - Phone number
4. Assign role:
   - Admin
   - Sales Manager
   - Operations Manager
   - Finance Manager
   - Inspector
   - Other
5. Click "Create User"
6. System sends welcome email with temporary password
7. User must change password on first login

#### Managing User Permissions

1. Go to **Settings** → **Roles**
2. Select role to edit
3. View current permissions
4. Add/remove permissions:
   - Check box to grant permission
   - Uncheck to remove
5. Save changes
6. All users with that role immediately get new permissions

#### Deactivating Users

1. Go to **Settings** → **Users**
2. Find user to deactivate
3. Click user to open details
4. Click "Deactivate User"
5. User cannot login but data remains preserved
6. Can reactivate later if needed

---

## Customer Portal Guide

### Overview

The Customer Portal provides self-service access for customers to:
- Submit and track inquiries
- Review quotations
- Place orders
- Track shipments
- Manage invoices and payments
- Submit claims

**Access**: http://localhost:3002

**Navigation**:
- Dashboard
- Inquiries
- Quotations
- Orders
- Shipments
- Documents
- Invoices
- Claims
- Profile

### Dashboard

The customer dashboard shows:

**Summary Cards**:
- **Active Orders**: Count of undelivered orders
- **Pending Shipments**: Orders in transit
- **Outstanding Invoices**: Amount due
- **My Recent Activity**: Latest transactions

**Quick Actions**:
- Submit new inquiry
- View pending quotations
- Track shipments
- Pay invoices

### Submitting an Inquiry

1. Click **Inquiries** in navigation
2. Click "New Inquiry"
3. Fill in product details:
   - Product category
   - Product description
   - Quantity and unit (meters, tons, etc.)
   - Specifications
   - Required delivery date
4. Add attachments (sample images, detailed specs)
5. Click "Submit Inquiry"
6. You'll receive confirmation email

### Reviewing Quotations

1. Go to **Quotations**
2. View all quotations received from sales team
3. Each quotation shows:
   - Quotation number
   - Items and quantities
   - Unit prices
   - Total amount
   - Valid until date
   - Status (Draft, Sent, Accepted, Rejected)

4. To review details:
   - Click quotation to open
   - See all line items with pricing
   - Download PDF version
5. To accept quotation:
   - Click "Accept"
   - Confirm acceptance
   - Confirmation sent to sales team
6. To reject quotation:
   - Click "Reject"
   - Add rejection reason (optional)

### Placing Orders

1. Go to **Orders**
2. Click "New Order"
3. Select accepted quotation
4. Review order details:
   - Items and quantities
   - Pricing
   - Total amount
5. Enter delivery details:
   - Delivery address
   - Delivery date preference
   - Special instructions
6. Click "Place Order"
7. Order sent to internal team for confirmation

### Tracking Shipments

1. Go to **Shipments**
2. View all shipments for your orders
3. Each shipment shows:
   - Shipment number
   - Current status
   - Vessel name (if available)
   - Current location
   - Expected arrival date (ETA)
   - Departure date

4. Click shipment for detailed tracking:
   - Complete route information
   - Real-time location updates
   - Container/vessel details
   - Estimated time of arrival
   - Port of origin and destination
   - Bill of Lading
   - Other shipping documents

### Managing Invoices

1. Go to **Invoices**
2. View all sales invoices
3. Each invoice shows:
   - Invoice number
   - Invoice date
   - Due date
   - Amount due
   - Status (Sent, Partially Paid, Paid, Overdue)

4. To view invoice details:
   - Click invoice number
   - See all items and pricing
   - Download PDF invoice
5. To pay invoice:
   - Click "Pay Now"
   - Select payment method
   - Enter payment details
   - Confirm payment
6. To view payment history:
   - Go to "Payment History" tab
   - See all previous payments

### Accessing Documents

1. Go to **Documents**
2. Browse all documents:
   - Bill of Lading
   - Certificate of Origin
   - Invoices
   - Packing Lists
   - Other shipping docs
3. Filter by document type or date range
4. Click to view or download

### Submitting Claims

1. Go to **Claims**
2. Click "Submit New Claim"
3. Select claim type:
   - Quality issue
   - Shortage
   - Damage
   - Late delivery
   - Other
4. Select related shipment or invoice
5. Enter claim details:
   - Description of issue
   - Claimed amount (if applicable)
   - Supporting documentation
6. Upload photos/evidence
7. Click "Submit Claim"
8. Claim sent to operations team for investigation

### Managing Profile

1. Click profile icon (top right)
2. Go to **My Profile**
3. View/edit company information:
   - Company name
   - Contact details
   - Billing address
   - Primary contact person
4. Update personal information:
   - Name
   - Phone
   - Email
5. Change password:
   - Click "Change Password"
   - Enter current password
   - Enter new password twice
   - Click "Update Password"
6. Manage notification preferences:
   - Email notifications (orders, shipments, invoices)
   - SMS alerts (optional)
   - Frequency preferences

---

## Factory Portal Guide

### Overview

The Factory Portal is designed for suppliers and factories to:
- Receive purchase orders
- Provide production updates
- Submit shipping documents
- Record quality inspection results
- Manage communication with operations team

**Access**: http://localhost:3003

### Dashboard

Factory dashboard provides:

**Summary Cards**:
- **Open POs**: Active purchase orders
- **In Production**: Orders currently being manufactured
- **Ready for Shipment**: Completed orders awaiting pickup
- **Overdue Orders**: Orders past delivery date

**Quick Actions**:
- View new purchase orders
- Submit production update
- Upload shipping documents
- Report quality issues

### Managing Purchase Orders

#### Viewing Purchase Orders

1. Go to **Purchase Orders**
2. View all POs assigned to your factory
3. Each PO shows:
   - PO number
   - Sales order reference
   - Order date
   - Required delivery date
   - Items and quantities
   - Status (Draft, Sent, Confirmed, In Production, Ready, Shipped)

#### Confirming Purchase Order

1. Open PO with "Sent" status
2. Review:
   - Items and quantities
   - Unit prices and total
   - Delivery date and address
   - Any special instructions
3. Click "Confirm Receipt"
4. PO status changes to "Confirmed"
5. Confirmation sent to operations team

#### Providing Production Updates

1. Open confirmed PO
2. Go to **Production Updates** tab
3. Click "Add Update"
4. Select update type:
   - Production started
   - Work in progress (% complete)
   - Quality check completed
   - Ready for shipment
   - Other milestone
5. Enter details and upload photos if needed
6. Click "Submit Update"
7. Operations team receives notification

### Quality Control

#### Recording Inspection Results

1. Go to **Quality Control**
2. Find PO requiring inspection
3. Click "Record Inspection"
4. Select inspection type:
   - In-process (during manufacturing)
   - Final inspection (before shipment)
5. For each item:
   - Mark quantity inspected
   - Record pass/fail
   - Note any defects
   - Attach photos of defects
6. Enter overall assessment
7. Click "Submit Inspection"

#### Handling Defects

1. If defects found during inspection:
2. Go to **Defect Report**
3. Enter defect details:
   - Item affected
   - Defect type and severity
   - Quantity affected
   - Photos
   - Proposed solution
4. Submit report
5. Operations team reviews and decides:
   - Rework required
   - Accept with discount
   - Reject and return

### Shipping Management

#### Preparing Shipment

1. Go to **Shipments**
2. Find PO marked "Ready for Shipment"
3. Click "Prepare Shipment"
4. Enter shipment details:
   - Shipment date
   - Carrier/freight forwarder
   - Estimated delivery date
5. Confirm quantities for each item
6. Click "Confirm Shipment"

#### Uploading Shipping Documents

1. Go to **Documents**
2. Click "Upload Document"
3. Select document type:
   - Packing List
   - Bill of Lading
   - Commercial Invoice
   - Certificate of Origin
   - Inspection Certificate
   - Other
4. Upload PDF document
5. Add reference information
6. Click "Upload"
7. Documents available for customer download

#### Tracking Shipment Status

1. Go to **Shipments** → **My Shipments**
2. View all shipments sent from your factory
3. See current status:
   - Shipped: Departed factory
   - In Transit: On the way
   - Arrived: At destination
4. Click shipment to see:
   - Carrier tracking number
   - Current location
   - Expected arrival
   - Linked customer order

### Communication

#### Messaging with Operations Team

1. Click **Messages** (or notification bell icon)
2. View all messages from operations team
3. To send message:
   - Click "New Message"
   - Select recipient (e.g., Operations Manager)
   - Type message
   - Attach file if needed (e.g., document, photo)
   - Click "Send"
4. Messages are timestamped and logged

#### Viewing PO Comments

1. Open purchase order
2. Go to **Comments** tab
3. View any notes from operations team
4. Add your response if needed
5. All communication is recorded

### Profile Management

1. Click profile icon (top right)
2. Go to **Factory Profile**
3. View/edit factory information:
   - Factory name
   - Contact person
   - Phone and email
   - Factory address
   - Website
4. Update production capabilities
5. Change password if needed

---

## Common Workflows

### Complete Order Workflow: From Inquiry to Delivery

This is the typical end-to-end process for a trading order.

**Step 1: Customer Submits Inquiry (Customer Portal)**
1. Customer logs in to portal
2. Goes to Inquiries → New Inquiry
3. Fills in product details
4. Submits inquiry
5. Operations team receives notification

**Step 2: Sales Team Creates Quotation (Admin Portal)**
1. Admin views inquiry in system
2. Goes to Sales → Quotations → New
3. Links to inquiry
4. Adds product items with pricing
5. Sets validity period
6. Sends quotation to customer via email

**Step 3: Customer Reviews & Accepts (Customer Portal)**
1. Customer receives quotation email
2. Logs in to portal
3. Reviews quotation details
4. Clicks "Accept Quotation"
5. Confirmation sent to sales team

**Step 4: Sales Order Creation (Admin Portal)**
1. Admin confirms quotation acceptance
2. Creates Sales Order from quotation
3. Confirms delivery date and address
4. Confirms sales order

### Converting a Quotation to a Sales Order (Phase 4, C16)

Once a buyer has accepted a quotation, you can spin up a Sales Order directly from the quotation detail page.

**Desktop**
1. Open the quotation detail page in the admin portal.
2. Confirm the status is "Accepted". The "Convert to SO" button only appears on accepted quotations.
3. Click "Convert to SO". A dialog opens with: Factory (defaulted from the quotation), Estimated Delivery, Shipping Method, and Notes.
4. Adjust if needed and click "Create Sales Order".
5. You are redirected to the new SO, which is created with status "Confirmed".

For FlorWay quotations, the dialog warns you that the resulting Sales Order is an ERP-internal record (the factory sends the buyer-facing document directly).

**Mobile**
1. Open the quotation in the mobile app.
2. If the quotation is Accepted and you have access to its brand, tap "Convert to Sales Order".
3. Confirm the prompt. The mobile app uses the quotation's source factory automatically; if no factory is on file you'll be asked to set one in the desktop ERP first.
4. After conversion the app returns to the Sales Orders tab.

**Permissions**
- Brand-scoped users can only convert quotations under brands in their access list.
- Super-admin can convert across brands.
- Server re-validates brand access on every request, so bypassing the UI returns 403.

### Sanctions screening (Phase 4, C18)

Every Customer and Lead is screened against four public sanctions lists (OFAC SDN, OFAC Consolidated, EU Consolidated, UN SC Consolidated). Screening is automatic at creation, on demand, and on a 90-day rolling basis for active customers.

**What you'll see**
- A green "Cleared" badge on customers with no hits.
- A yellow "Requires review" badge if the screen found a partial match (fuzzy similarity OR exact name with mismatching country). This is a warning, not a block.
- A red "Sanctions hit" badge if the screen found an exact match with country overlap. Downstream actions are blocked until super-admin overrides.
- An orange "Override on file" badge if super-admin attested that the match does not block transacting. The match remains visible on the record.

**Where the block fires**
- Creating a Lead with a flagged company name is rejected with HTTP 403; the Lead is NOT saved.
- Creating a Customer with a flagged name creates the row but marks it inactive; transactions are blocked until super-admin overrides.
- Creating a Quotation against a flagged customer is rejected with HTTP 403.
- Sending outreach (per-lead or campaign) to a flagged lead is rejected. Campaign loops skip flagged leads and continue with the rest.

**Super-admin override**
1. Open the flagged customer's detail page.
2. Click the red Override button next to the sanctions badge.
3. Enter a written reason of at least 10 characters explaining why the match should not block transacting.
4. The status moves to Override; the flag details stay on the record for audit. The override reason becomes the auditable justification.

**Manual screening**
- POST /api/compliance/screen with `{ name, country }` returns a screen result without persisting.
- POST /api/compliance/screen/:customerId re-screens a specific customer and persists the result.
- POST /api/compliance/sanctions/refresh (super-admin only) pulls fresh data from all four sources.
- GET /api/compliance/sanctions/status shows the last refresh timestamp, per-source byte counts, and whether the scheduled jobs are enabled.

**Audit trail**
- Every block writes a sanctions_block audit entry with the entity, hits, and context (lead_create, customer_create, quotation_create, outreach_send, campaign_send).
- Every override writes a sanctions_override entry with the prior status, hits, reason, and user.
- Daily refresh and rescreen cron jobs each write a single summary entry.

### Replying to inbox emails (Phase 4, C17)

Inbox threads are brand-tagged so a reply to a Sovern House conversation can't accidentally be sent from a FlorWay account, and the Egypt BCC rule fires only when it should.

**What you'll see**
- Every triage card carries a brand badge (SH or FW) next to the sender name.
- Opening Reply shows a "From (brand-matched accounts only)" picker. Only accounts of the same brand as the thread are enabled; mismatched accounts are visible but greyed out so you understand why they can't be used.
- The default sender is the seeded brand address (alex@sovernhouse.co for SH, alexflorway@gmail.com for FW).

**Cross-brand inbox (super-admin)**
1. From the global brand picker, choose All brands.
2. The inbox banner switches to "Cross-brand view" and the list merges SH + FW threads chronologically.
3. Each card keeps its own brand badge. Clicking a card opens a single-brand context where replies and actions are scoped to that thread's brand.

**Egypt-Fanzey BCC**
- For SH threads where the customer/lead country is Egypt, every outgoing email automatically BCCs Mohannad Fanzey at mohanadfanzey@gmail.com.
- FlorWay threads NEVER BCC Fanzey, regardless of country.
- The rule applies to outreach sends, campaign sends, and triage replies (one helper in the backend keeps the three paths in sync).

**Audit trail**
- Every successful reply writes a reply_sent audit entry with the brand, From address, BCC count, and country.
- Every blocked cross-brand attempt writes a brand_account_mismatch_block entry.
- Both are visible to super-admin via the AuditLog table.

### FlorWay internal documents

For FlorWay (`FW`) Sales Orders, Proforma Invoices, and Invoices, the ERP treats the document as an internal record only. The factory sends the buyer-facing version directly.

What you'll see:
- A black "FACTORY WILL SEND TO BUYER. INTERNAL RECORD" banner above the workflow status bar on SO, PI, and Invoice detail pages.
- The Send button on the FlorWay Proforma Invoice page is disabled. Hovering shows "FlorWay invoices are sent to the buyer by the factory. This document is for internal records only."
- The generated PDF carries the same banner across the top of the page in the FlorWay iron-deep palette.

If someone tries to bypass the UI and trigger Send via API, the server hard-blocks with a 400 and writes an `fw_send_blocked` entry to the audit log so the attempt is traceable.

Sovern House documents are unaffected. The Send flow on SH PIs, SOs, and Invoices still emails the buyer from `alex@sovernhouse.co` (or the brand's seeded sender) as it always has.

**Step 5: Purchase Order to Factory (Admin Portal)**
1. System automatically creates purchase order
2. Admin selects appropriate factory
3. Confirms purchase order details
4. Sends PO to factory

**Step 6: Factory Production (Factory Portal)**
1. Factory receives PO notification
2. Confirms receipt of PO
3. Provides production updates
4. Conducts quality inspection
5. Reports ready for shipment

**Step 7: Packing & Shipment (Admin Portal)**
1. Admin creates packing list
2. Allocates products to packages
3. Records weight and dimensions
4. Creates shipment
5. Assigns carrier/vessel
6. Marks as shipped

**Step 8: In-Transit Tracking (Both Portals)**
1. System tracks shipment location
2. Admin receives tracking updates
3. Customer can view status in portal
4. ETA updated as shipment progresses

**Step 9: Delivery & Invoicing (Admin Portal)**
1. Shipment arrives at destination
2. Customer confirms delivery
3. Admin creates invoice
4. Invoice sent to customer

**Step 10: Payment (Customer Portal)**
1. Customer receives invoice
2. Reviews payment terms and due date
3. Records payment in portal
4. Provides reference number
5. Invoice marked as paid

**Optional Step 11: Claims (If Issues)**
1. If quality or delivery issues:
2. Customer submits claim in portal
3. Provides photos and description
4. Operations team investigates
5. Resolution negotiated
6. Claim closed

---

## FAQs

### General Questions

**Q: How do I reset my password?**

A:
1. Click "Forgot Password" on login page
2. Enter your email address
3. Click "Send Reset Link"
4. Check your email for reset link
5. Click link and enter new password

**Q: How do I change the language?**

A: Click the language selector icon (usually top right) and select your preferred language from:
- English
- 中文 (Mandarin)
- Español (Spanish)
- Français (French)
- Deutsch (German)
- Português (Portuguese)

**Q: Can I export data to Excel?**

A: Yes, most list views have an "Export" button that downloads data as Excel file.

### Admin Portal Questions

**Q: How do I create multiple purchase orders for one sales order?**

A:
1. Open sales order
2. Go to "Purchase Orders" tab
3. Click "New Purchase Order"
4. Select subset of items and factory
5. Create PO for split
6. Repeat for other factories

**Q: How do I handle partial shipments?**

A:
1. Create first shipment with partial quantities
2. Mark sales order as "Partially Shipped"
3. Create second shipment for remaining items
4. Both shipments link to same sales order
5. Invoice after all shipments received

**Q: Can I modify an order after confirming it?**

A: Confirmed orders have limited modification. If needed:
1. Go to order
2. Click "Amend Order"
3. Make changes
4. System creates amendment record
5. Customer notified of changes

### Customer Portal Questions

**Q: Why can't I download an invoice?**

A:
- Invoice must have "Sent" status or later
- Check your user permissions
- Contact admin if you lack access

**Q: How do I know my shipment is arriving?**

A:
1. Go to Shipments
2. Find shipment with status "In Transit"
3. Click shipment for tracking details
4. Check current location and ETA
5. System sends email notification when arriving

**Q: Can I modify my order after placing it?**

A: Orders can't be modified after confirmation. If needed:
1. Submit claim for quantity issue
2. Create new inquiry for additional items
3. Contact sales team directly

### Factory Portal Questions

**Q: How do I indicate production is delayed?**

A:
1. Go to Production Updates
2. Click "Add Update"
3. Select "Delay Report"
4. Enter new expected date
5. Explain reason
6. Submit report
7. Operations team notified immediately

**Q: What if quality inspection fails?**

A:
1. Go to Quality Control
2. Report defects with photos
3. Specify severity
4. Wait for operations team instructions
5. Either rework, accept with discount, or full rejection

**Q: How do I upload shipping documents?**

A:
1. Go to Documents
2. Click "Upload Document"
3. Select document type
4. Choose PDF file
5. Add reference info
6. Upload and confirm

---

## Troubleshooting

### I can't login

**Check**:
1. Correct email address
2. Correct password (case-sensitive)
3. Account is active (not suspended)
4. Browser cookies enabled
5. No 2FA lock

**Solution**:
1. Try "Forgot Password"
2. Reset password
3. Contact IT if issue persists

### Shipment status not updating

**Check**:
1. Refresh page (F5)
2. Check internet connection
3. Clear browser cache
4. Try different browser

**If still not updating**:
1. Contact tracking provider
2. Verify shipment details
3. Check with operations team

### Invoice not showing payment

**Check**:
1. Payment was recorded
2. Payment date matches actual date
3. Amount matches invoice amount
4. Currency is correct

**If payment still not showing**:
1. Submit support ticket
2. Provide invoice and payment reference
3. Admin will investigate

### Document not downloading

**Check**:
1. Document exists and is uploaded
2. You have permission to view
3. File is not corrupted
4. Try different browser
5. Disable popup blockers

---

## Configurable Dashboard

### What It Is

The dashboard is fully personalised. Each user has their own widget layout. You choose which widgets to show, how large each one is, and how they are arranged. Your layout is saved to the server, so it persists across devices and sessions.

### Widgets Available

| Widget | What It Shows |
|---|---|
| Revenue Summary | Monthly invoiced revenue vs. the prior month |
| Order Status | Live count of sales orders grouped by status |
| Pending Approvals | Documents awaiting client confirmation |
| Recent Activity | Latest CRM interactions across all leads |
| KPI Overview | A tracked metric with trend and progress toward target |
| Quick Actions | One-click shortcuts for the most frequent operations |
| Alerts | System warnings, overdue items, and low-stock thresholds |

Not all widgets are visible by default. Your initial layout is set by your role.

### Customising Your Layout

1. Click the **Customize** button (+ icon) in the top-right corner of the dashboard.
2. The Customize panel slides in from the right.
3. Toggle each widget **on** or **off** using the switch next to its name.
4. Choose a **size** for each widget: Small, Medium, Wide, Full, or Tall.
5. Click **Apply** to update the dashboard.
6. **Drag** any widget by its title bar to reorder.
7. **Resize** a widget by dragging the handle at its bottom-right corner.

### Saving Your Layout

Your layout **auto-saves** 2 seconds after every drag or resize. You can also click **Save Layout** in the Customize panel to save immediately.

To go back to the default layout for your role, click **Reset to Default** in the Customize panel.

### Removing a Widget

Click the **x** icon in the top-right corner of any widget to remove it from the dashboard. Re-add it at any time via the Customize panel.

---

## Google Calendar

### What It Is

Sovern ERP syncs events from your connected Google Calendar accounts every 15 minutes. This keeps your calendar visible alongside your trade operations without switching tabs.

### Viewing Calendar Events

Calendar events from connected Google accounts are available to the AI Assistant and to the Calendar section of the ERP. The AI Assistant can answer questions like "What meetings do I have today?" using your synced calendar data.

### Connecting a Google Account

1. Go to **Settings > Connected Accounts**.
2. Click **Connect Google Account**.
3. Authorise the ERP to access your Google Calendar.
4. Once connected, the sync runs automatically in the background.

### How Sync Works

- The ERP syncs every 15 minutes using Google's incremental sync protocol.
- Only new and changed events are fetched after the first full sync — this is fast and low on quota.
- If your account token expires, the sync pauses until you reconnect the account in Settings.

### Linking Calendar Events to Leads

From the Calendar events view, you can link any event to a CRM lead. This attaches the meeting or call to the lead timeline, keeping your deal history complete.

### Tips

- Calendar data is read-only in the ERP. Create and edit events directly in Google Calendar.
- If events are missing, the sync may not have run yet. Wait up to 15 minutes or check Settings > Connected Accounts to confirm the account is active.
- Each connected Google account syncs its own calendar independently.

---

## Google Drive

### What It Is

The Google Drive browser lets you browse, open, and download files from your connected Google Drive accounts without leaving the ERP.

### Navigating Files

1. Go to **Documents > Google Drive** in the left navigation menu.
2. Select a connected Google account from the account selector at the top.
3. Your Drive opens at the root level. Click any **folder** to open it.
4. Use the **breadcrumb trail** at the top to navigate back. Click any folder name in the breadcrumb to jump to that level.

### Opening Files

Click the **external link icon** on any file row to open it in Google Drive in a new browser tab.

You need to be signed in to the correct Google account in your browser for the file to open. If the file does not load, sign in to Google in another tab first.

### Downloading Files

Click the **download icon** on any file row to download it directly.

Google Docs, Sheets, and Slides cannot be downloaded directly from the ERP. Open them in Google Drive and use **File > Download** from within Google Drive instead.

### Searching Files

Type in the **Search** bar at the top of the Drive page. Results update automatically as you type and search across all files in the selected account, not just the current folder.

Click **Clear** or press Escape to exit search and return to your current folder view.

### Multiple Google Accounts

If more than one Google account is connected, use the account selector to switch between them. Each account shows its own Drive independently. To add an account, go to **Settings > Connected Accounts**.

### Tips

- The breadcrumb shows your full path from root. Use it to orient yourself in deep folder structures.
- Search scans the entire Drive for the selected account, not just the folder you are currently in.
- Drive data is live, not cached. Results always reflect the current state of your Google Drive.

---

**For additional support, contact**: support@tradingerp.com

**Last Updated**: 2026-05-07
