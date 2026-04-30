/**
 * tooltipContent.js
 *
 * Central registry of all tooltip and field-help text for the admin portal.
 * Import the relevant section into the page component that needs it.
 *
 * Keeping content here (not inline) means:
 * - Editors/translators can update copy without touching component logic.
 * - Future i18n: swap this file for a locale-keyed version.
 *
 * Convention: SECTION.fieldName or SECTION.actionName
 */

// ─── CRM ──────────────────────────────────────────────────────────────────────

export const CRM = {
  lead: {
    source:        'Where this lead came from — e.g. LinkedIn, trade show, referral, or cold email.',
    stage:         'Current position in the sales pipeline. Move the lead forward as you qualify and engage.',
    score:         'Lead quality score (0–100). Higher = more likely to convert. Update after each interaction.',
    assignedTo:    'The sales rep responsible for this lead. They will receive follow-up reminders.',
    company:       'The lead\'s company name. Used for deduplication — check existing contacts before creating.',
    email:         'Primary contact email. Must be verified before sending outreach.',
    phone:         'Direct phone number including country code (e.g. +1 555 123 4567).',
    industry:      'Industry vertical. Used for campaign targeting and segment reporting.',
    estimatedValue:'Estimated deal value in USD. Used for pipeline forecasting.',
    nextFollowUp:  'Date to follow up with this lead. The scheduler sends reminders at 08:00 on this date.',
    notes:         'Internal notes — not visible to the lead. Record key facts from calls or emails.',
  },
  contact: {
    role:          'Job title at their company (e.g. Procurement Manager, Head of Buying).',
    isPrimary:     'Mark as primary if this is your main point of contact at this company.',
    linkedInUrl:   'LinkedIn profile URL. Used for connection tracking in the outreach pipeline.',
  },
  campaign: {
    type:          'Email sends a batch outreach; sequence is a multi-touch automated drip.',
    audience:      'The lead segment or list this campaign targets. Defined by tags or manual selection.',
    scheduledAt:   'When the first message in this campaign goes out. Leave blank to send immediately.',
  },
  activity: {
    type:          'Call, email, meeting, note, or task. Determines which icon and reporting bucket this appears in.',
    outcome:       'What happened — e.g. "Left voicemail", "Interested, send PI", "Not now".',
    dueDate:       'For tasks: the deadline. Overdue tasks trigger dashboard alerts.',
  },
}

// ─── Sales ────────────────────────────────────────────────────────────────────

export const INQUIRY = {
  product:       'The product the buyer is enquiring about. Link to an existing product or describe a custom requirement.',
  quantity:      'Requested quantity. This drives the factory unit price tier.',
  targetPrice:   'Buyer\'s target price in USD. Used as the negotiation benchmark — do not share with the factory.',
  incoterm:      'Delivery terms. FOB = factory loads, you arrange freight. CIF = you include freight + insurance.',
  destinationPort: 'The buyer\'s receiving port. Affects freight cost estimation.',
  paymentTerms:  'Agreed payment structure — e.g. 30% TT deposit, 70% before shipment.',
  requiredBy:    'The buyer\'s deadline. Work backwards from here when negotiating factory lead times.',
  certifications:'Required certifications (CE, RoHS, ASTM, etc.). Confirm with the factory before quoting.',
}

export const QUOTATION = {
  validUntil:    'Expiry date of this quotation. After this date, prices should be reconfirmed with the factory.',
  currency:      'All amounts are in this currency. Default USD. Change only if the buyer insists.',
  discount:      'Discount amount in currency units (not percent). Applied before tax.',
  tax:           'Tax amount if applicable — most B2B international trade is zero-rated.',
  paymentTerms:  'Confirmed payment terms for this deal. Should match what was agreed in the inquiry stage.',
  bankDetails:   'Bank account details for payment. Auto-populated from company settings; override if needed.',
  notes:         'Any special conditions, quality requirements, or additional agreements for this quotation.',
  lineItem_unitPrice: 'Price per unit in the quotation currency. This is your sell price — not the factory cost.',
  lineItem_unit:     'Unit of measure — pcs, sets, m², kg, cartons, etc.',
}

export const PROFORMA_INVOICE = {
  piNumber:       'Auto-generated PI number (format: PI-YYYYMMDD-XXXX). Do not change manually.',
  validUntil:     'Expiry date. PIs typically expire in 30 days. The buyer must confirm before this date.',
  bankDetails:    'Your bank account details for the deposit. The buyer needs these to send payment.',
  requestApproval:'Sends the buyer a secure link to review and formally approve this PI online — no login required.',
  convertToSO:    'Creates a Sales Order from this PI. Only available once the PI is confirmed by the buyer.',
  status_draft:   'Draft — not yet sent to the buyer.',
  status_sent:    'Sent to the buyer. Waiting for confirmation.',
  status_confirmed:'Buyer confirmed. You can now convert to a Sales Order.',
  status_cancelled:'PI cancelled. Generate a new PI if needed.',
}

export const SALES_ORDER = {
  orderNumber:      'Auto-generated SO number (format: SO-YYYYMMDD-XXXX).',
  factoryId:        'The factory fulfilling this order. Must be linked before production can begin.',
  estimatedDelivery:'Expected delivery date at buyer\'s destination. Used for scheduling and buyer communication.',
  shippingMethod:   'Sea freight (FCL/LCL), air freight, or courier. Affects cost and lead time significantly.',
  trackingNumber:   'Bill of lading number or AWB. Update once the shipment is booked.',
  paymentStatus:    'Unpaid = no payment received. Partial = deposit paid. Paid = fully settled.',
  createPackingList:'Generates a draft packing list from the line items of this order. Fill in weights and dimensions before sending to the warehouse.',
}

// ─── Procurement ──────────────────────────────────────────────────────────────

export const FACTORY = {
  isConfidential:  'If enabled, only users in the Allowed Users list can view this factory. Use for sensitive supplier relationships.',
  allowedUserIds:  'Users who can view this factory when confidential mode is on. Add by user ID.',
  certifications:  'Factory quality certifications (ISO 9001, BSCI, etc.). Visible to QC inspectors.',
  specializations: 'What this factory is best at — e.g. SPC flooring, garments, electronics.',
  leadTimeDays:    'Typical factory lead time in days from PO confirmation to ready-to-ship.',
  paymentTerms:    'Your agreed payment terms with this factory — e.g. 30% deposit, 70% on shipment.',
  rating:          'Internal supplier rating (0–5). Updated after each completed order.',
}

export const PURCHASE_ORDER = {
  poNumber:        'Auto-generated PO number (format: PO-YYYYMMDD-XXXX). Provide to the factory as the order reference.',
  salesOrderId:    'The sales order this PO is fulfilling. Links buyer side to supplier side.',
  factoryId:       'The factory this PO is sent to.',
  expectedDelivery:'The date you need goods ready at the factory. Build in buffer for inspections and shipping.',
  status_draft:    'Draft — factory has not yet received this PO.',
  status_sent:     'PO sent to the factory. Awaiting their confirmation.',
  status_confirmed:'Factory has confirmed they can fulfill this order.',
  status_in_production: 'Factory is actively producing.',
  status_ready:    'Production complete. Book inspection if required.',
  status_shipped:  'Goods shipped from the factory.',
  status_received: 'Goods received at our warehouse or forwarding agent.',
  status_completed:'PO fully closed.',
}

// ─── Document Approvals ───────────────────────────────────────────────────────

export const APPROVAL = {
  generate:       'Creates a unique, secure link you can send to the buyer. They can approve or reject the document without logging in.',
  token:          'One-time secure token embedded in the approval link. Expires after 30 days by default.',
  expiresAt:      'The link stops working after this date. Regenerate a new link if it expires.',
  clientIp:       'IP address recorded when the client opened the approval link. Audit trail only.',
  clientName:     'Name the client entered when approving or rejecting.',
  rejectionReason:'Reason the client provided when rejecting. Review this before revising the document.',
  status_pending: 'Waiting for the client to review and respond.',
  status_approved:'Client has approved. You can now proceed to convert or action this document.',
  status_rejected:'Client has rejected. Check the rejection reason and revise the document.',
  status_expired: 'Link expired before the client responded. Generate a new approval link.',
}

// ─── Logistics ────────────────────────────────────────────────────────────────

export const SHIPMENT = {
  containerNumber: 'Container ID (e.g. MSCU1234567). Needed for port tracking and customs declaration.',
  containerType:   '20ft ≈ 28 CBM / 22t. 40ft ≈ 58 CBM / 26t. 40HC (high cube) ≈ 67 CBM. LCL = shared container.',
  portOfLoading:   'The port where goods are loaded (usually near the factory — e.g. CNSHA, CNNGB).',
  portOfDischarge: 'The buyer\'s arrival port (e.g. USNYC, EGALY, AESBD).',
  etd:             'Estimated Time of Departure from the port of loading.',
  eta:             'Estimated Time of Arrival at the port of discharge.',
  vesselName:      'Carrier vessel name. Required for freight insurance and customs documentation.',
  voyageNumber:    'Carrier voyage reference number. Used to track the vessel.',
  trackingUrl:     'Link to the carrier\'s online tracking page. Share with the buyer for self-service updates.',
}

export const INSPECTION = {
  inspector:      'The QC inspector assigned to this inspection — internal staff or third-party agency.',
  result:         'Pass = goods meet spec. Conditional = minor issues, buyer must approve. Fail = rework or reject.',
  aqiLevel:       'AQL (Acceptable Quality Level) sampling plan used. AQL 2.5 is standard for most trade goods.',
  defectReport:   'Attach the inspection report PDF here. Buyer may request a copy before approving shipment.',
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export const INVOICE = {
  invoiceNumber:  'Auto-generated invoice number. Provide to the buyer as the payment reference.',
  dueDate:        'Payment due date. The scheduler auto-marks invoices as Overdue if unpaid past this date.',
  paidAmount:     'Total payments received so far. Updated automatically when payments are recorded.',
  balance:        'Outstanding amount = Total - Paid Amount.',
  type:           'Sales invoice = receivable from buyer. Purchase invoice = payable to factory. Credit/debit notes adjust balances.',
}

export const PAYMENT = {
  method:         'Bank Transfer (T/T), Cheque, Cash, Letter of Credit, or Credit Card.',
  reference:      'Bank transaction reference or cheque number. Required for audit trail.',
  date:           'Date payment was received or sent. Affects balance sheet reporting.',
  status_pending: 'Payment recorded but not yet confirmed in the bank.',
  status_confirmed:'Payment confirmed. Invoice balance updated.',
  status_rejected:'Payment failed or bounced. Follow up with the payer.',
}

// ─── Settings / Admin ─────────────────────────────────────────────────────────

export const SETTINGS = {
  roles:          'Roles control what each user can see and do. Admin has full access. Viewer has read-only reports.',
  emailTemplate:  'Reusable email templates for outreach campaigns. Use {{firstName}}, {{companyName}} as merge tags.',
  emailSignature: 'Your email signature block appended automatically to all outreach emails sent from the ERP.',
  bulkImport:     'Upload a CSV or Excel file to import leads, contacts, or products in bulk. Preview before confirming.',
  priceList:      'Customer or factory price lists. Link to a customer or factory to apply tiered pricing automatically.',
  productAttribute:'Custom specification attributes that appear on product spec sheets (e.g. Wear Layer, Surface Finish).',
  taxon:          'Product taxonomy node — categories and sub-categories used for filtering and reporting.',
}

// ─── Outreach ─────────────────────────────────────────────────────────────────

export const OUTREACH = {
  sendEmail:      'Send a personalised outreach email to this lead using a template. The email is logged automatically.',
  template:       'Pick an email template. Merge tags like {{firstName}} are replaced with the lead\'s actual data.',
  signature:      'Your email signature is appended automatically. Edit it in Settings > Email Signatures.',
  bcc:            'Optional BCC address. Use for territory managers who need a copy of all outreach in their region.',
  allowedDomains: 'Emails can only be sent from domains authorised in the server config (ALLOWED_SENDING_DOMAINS).',
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export const BULK_IMPORT = {
  fileFormat:     'CSV or Excel (.xlsx) accepted. First row must be column headers. Max 2,000 rows per import.',
  columnMapping:  'Match your file\'s columns to the ERP fields. Unmapped columns are ignored.',
  duplicateRule:  'Leads are deduplicated by email address. Existing records will be updated; new ones will be created.',
  preview:        'Review the first 20 rows before committing. Fix errors in your file and re-upload if needed.',
}

// ─── RBAC roles (for the Role Permissions page) ───────────────────────────────

export const ROLE_TIPS = {
  admin:               'Full access to everything including user management, settings, and system configuration.',
  manager:             'Access to all operational modules. No settings or user management.',
  sales:               'Sales pipeline, CRM, quotations, PIs, and outreach. No factory costs or finance.',
  operations:          'Factories, purchase orders, shipments, inspections, and inventory.',
  finance:             'Invoices, payments, claims, and financial reports.',
  warehouse:           'Inventory and shipments only.',
  quality:             'Inspections, claims, factory profiles. No financial data.',
  viewer:              'Read-only access to dashboard and reports.',
  ceo:                 'Full operational access without system administration.',
  coo:                 'Same as CEO with additional document template access.',
  sales_rep:           'Sales pipeline and outreach. Factory costs, invoices, and payments are hidden.',
  project_manager:     'Cross-functional: orders, procurement, logistics, and documents.',
  accountant:          'Finance module, orders, reports, and analytics.',
  cashier:             'Payments and invoices only.',
  office_manager:      'Sales pipeline, products, and documents.',
  procurement_officer: 'Factories, products, purchase orders, logistics.',
  logistics_coordinator:'Shipments, packing lists, inspections, inventory.',
  qc_inspector:        'Inspections, claims, factory and product data.',
  customer_service:    'Customers, inquiries, orders, and claims.',
  compliance_officer:  'Factory compliance, inspections, shipments, claims, documents.',
}
