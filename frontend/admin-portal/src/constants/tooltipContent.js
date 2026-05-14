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
    source:        'Where this lead came from, e.g. LinkedIn, trade show, referral, or cold email.',
    stage:         'Current position in the sales pipeline. Move the lead forward as you qualify and engage.',
    score:         'Lead quality score (0 to 100). Higher means more likely to convert. Update after each interaction.',
    assignedTo:    'The sales rep responsible for this lead. They will receive follow-up reminders.',
    company:       'The lead\'s company name. Used for deduplication, check existing contacts before creating.',
    email:         'Primary contact email. Must be verified before sending outreach.',
    phone:         'Direct phone number including country code (e.g. +1 555 123 4567).',
    industry:      'Industry vertical. Used for campaign targeting and segment reporting.',
    estimatedValue:'Estimated deal value in USD. Used for pipeline forecasting.',
    nextFollowUp:  'Date to follow up with this lead. The scheduler sends reminders at 08:00 on this date.',
    notes:         'Internal notes, not visible to the lead. Record key facts from calls or emails.',
    brand:         'Which brand this lead belongs to. Locked at creation. Changes require super-admin override.',
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
  brand:         'Which brand this inquiry belongs to. Locked at creation.',
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
  lineItem_unit:     'Unit of measure — pcs, sets, m\u00b2, kg, cartons, etc.',
  factoryId:     'The factory supplying the goods for this quotation. Links the buyer price to the source factory for full sourcing traceability.',
  leadId:        'The CRM lead this quotation originated from. Preserved for pipeline attribution: tracks which prospect became a deal.',
  brand:         'Which brand issues this quotation. Determines sender email, signature, footer legal text, and template. Locked at creation.',
  // Phase 3, C9 + C10: brand-aware quotation document tooltips
  documentPreview: 'Download a buyer-ready PDF. Sovern House quotations render with the forest/cream/ink palette and the NRIEC Taiwan legal footer. FlorWay quotations render with the iron-deep/cream palette and one of three variants picked automatically from the customer’s productBrandingMode.',
  florWayVariants: 'FlorWay variants. IronLite — full I-Beam wordmark + OEM badge + WPC construction diagram. Generic — FlorWay Sdn. Bhd. wordmark, no OEM imagery (default). Private Label — placeholder; full template ships when the first OEM private-label buyer signs.',
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
  brand:          'Which brand issues this proforma. Inherited from the parent quotation.',
}

export const SALES_ORDER = {
  orderNumber:      'Auto-generated SO number (format: SO-YYYYMMDD-XXXX).',
  factoryId:        'The factory fulfilling this order. Must be linked before production can begin.',
  estimatedDelivery:'Expected delivery date at buyer\'s destination. Used for scheduling and buyer communication.',
  shippingMethod:   'Sea freight (FCL/LCL), air freight, or courier. Affects cost and lead time significantly.',
  trackingNumber:   'Bill of lading number or AWB. Update once the shipment is booked.',
  paymentStatus:    'Unpaid = no payment received. Partial = deposit paid. Paid = fully settled.',
  createPackingList:'Generates a draft packing list from the line items of this order. Fill in weights and dimensions before sending to the warehouse.',
  brand:            'Which brand issues this sales order. Inherited from the parent quotation.',
}

// ─── Procurement ──────────────────────────────────────────────────────────────

export const FACTORY = {
  isConfidential:  'If enabled, only users in the Allowed Users list can view this factory. Use for sensitive supplier relationships.',
  allowedUserIds:  'Users who can view this factory when confidential mode is on. Add by user ID.',
  certifications:  'Factory quality certifications (ISO 9001, BSCI, etc.). Visible to QC inspectors.',
  specializations: 'What this factory is best at — e.g. SPC flooring, garments, electronics.',
  leadTimeDays:    'Typical factory lead time in days from PO confirmation to ready-to-ship.',
  paymentTerms:    'Your agreed payment terms with this factory — e.g. 30% deposit, 70% on shipment.',
  rating:          'Internal supplier rating (0\u20135). Updated after each completed order.',
  notes:           'Internal notes about this factory — negotiation history, quality issues, key contacts. Not visible to the factory.',
  logo:            'Factory or brand logo URL. Used on factory profile and sourcing documents.',
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
  brand:           'Which brand issues this purchase order. Inherited from the parent sales order.',
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
  brand:          'Which brand issues this invoice. Inherited from the parent sales order.',
}

export const PAYMENT = {
  method:         'Bank Transfer (T/T), Cheque, Cash, Letter of Credit, or Credit Card.',
  reference:      'Bank transaction reference or cheque number. Required for audit trail.',
  date:           'Date payment was received or sent. Affects balance sheet reporting.',
  status_pending: 'Payment recorded but not yet confirmed in the bank.',
  status_confirmed:'Payment confirmed. Invoice balance updated.',
  status_rejected:'Payment failed or bounced. Follow up with the payer.',
}

// ─── Products ────────────────────────────────────────────────────────────────

export const PRODUCT = {
  name:                'Full product name as shown on quotations and purchase orders.',
  sku:                 'Stock-Keeping Unit — your unique internal product code. Set once and never changed. Matched during bulk import.',
  category:            'Product category for filtering and reporting. Managed in Settings > Product Taxonomy.',
  factory:             'Primary supplier for this product. Used as the default factory on purchase orders.',
  unit:                'Unit of measure — pcs, m², kg, cartons, sets, etc. Appears on all trade documents.',
  hsCode:              'Harmonised System tariff code (6–10 digits). Required for customs declarations and certificate of origin.',
  minOrderQty:         'Minimum quantity per order. Buyers ordering below this quantity should be flagged.',
  description:         'Internal product notes — not visible to buyers or factories. Record sourcing history, quality notes, or alternative suppliers.',
  salesDescription:    'Client-facing description shown on quotations, sales orders, and the customer portal. Write for the buyer — highlight benefits, specs, and certifications.',
  purchaseDescription: 'Supplier-facing description shown on purchase orders. Include tolerances, QC requirements, packaging specs, and certifications the factory must meet.',

  // Pricing tab
  priceType:           'The Incoterm that applies to the buy price — FOB (factory loads, you arrange freight), EXW (ex-works, at factory gate), CIF, CFR, or DDP.',
  costPrice:           'Your buy price from the factory, in the selected Incoterm. This is your landed cost basis before margin.',
  exwPrice:            'Ex-Works price — at the factory gate before any loading or freight. Record when the factory provides both EXW and FOB quotes.',
  markup:              'Gross margin percentage. Sovern formula: Sell = Buy / (1 − margin%). A 30% margin on a $10 FOB gives a $14.29 sell price.',
  sellingPrice:        'Your sell price to the buyer. Auto-calculated from the buy price and margin. This is the price that appears on quotations.',
  priceIsActive:       'Only one price per factory can be active at a time. The active price is used on new quotations. Inactive prices are archived for reference.',

  // Specs tabs
  clientVisibleFields: 'Check which specification fields appear on client-facing documents (quotations, sales orders, customer portal). All fields always appear on supplier purchase orders.',
  specs_notes:         'Internal notes for the factory — QC tolerances, packaging requirements, or production constraints. Not shown to buyers.',
}

// ─── Settings / Admin ─────────────────────────────────────────────────────────

export const SETTINGS = {
  roles:          'Roles control what each user can see and do. Admin has full access. Viewer has read-only reports.',
  emailTemplate:  'Reusable email templates for outreach campaigns. Use {{firstName}}, {{companyName}} as merge tags.',
  emailSignature: 'Your email signature block appended automatically to all outreach emails sent from the ERP.',
  bulkImport:     'Upload a CSV or Excel file to import leads, contacts, or products in bulk. Preview before confirming.',
  priceList:      'Customer or factory price lists. Link to a customer or factory to apply tiered pricing automatically.',
  productAttribute:'Custom specification attributes that appear on product spec sheets (e.g. Wear Layer, Surface Finish).',
  taxon:          'Product taxonomy node, categories and sub-categories used for filtering and reporting.',
}

// ─── Brand (multi-brand data model, Phase 1) ──────────────────────────────────

export const BRAND = {
  code:               'Short identifier for the brand (e.g. SH, FW). Used as the foreign-key handle on every transactional row.',
  displayName:        'Full brand name shown to staff. Used in headers, dropdowns, and report titles.',
  senderEmail:        'The Gmail address outbound emails for this brand are sent from. Must be a connected Google account.',
  signatureHtml:      'HTML email signature appended to every outbound message sent from this brand.',
  footerLegalText:    'One-line legal footer placed at the bottom of quotations, invoices, and PDF exports for this brand.',
  primaryColor:       'Background color of the brand badge. Pick a hex value that reads well against the accent color.',
  accentColor:        'Text color of the brand badge. Use a high-contrast hex value (cream against ink, etc.).',
  acceptedProductCategories: 'Optional category whitelist. When set, only products in these categories can appear on this brand\'s quotations. Leave blank for no constraint.',
  active:             'Inactive brands are hidden from new-entity pickers but existing transactions stay visible. Use to retire a brand without losing history.',
  relationships:      'Which brands have ever transacted with this customer. Adding a brand happens automatically when a new lead or quote is opened against the customer under that brand. Removal is a super-admin action.',
  defaultBrand:       'Pre-fills the brand picker on every new lead, quotation, and deal form. You can still override per record.',
  accessibleBrands:   'The brands this user can see and act on. Set per user. Super admin can read across brands via the All Brands view.',
  brandOverride:      'Force-change an entity\'s brand. Super-admin only, requires a written reason, writes a permanent audit log entry.',
  scanReceiptBrand:   'Receipts logged from your phone inherit the brand of the office you route them to. Pick an FW office for FW expenses, an SH office for SH.',
  productBrandingMode: 'How FlorWay-brand products appear on this customer\'s docs. Generic = no sub-brand. IronLite = FW\'s flagship badge. Private label = the customer\'s own brand name on packaging. Locks once a quotation has been sent under the current mode; super-admin can override with a written reason.',
  privateLabelProductName: 'Used only when product branding mode is Private label. The exact name printed on packaging and quoted in docs.',
  productBrandingModeLocked: 'Locked since the first FW quotation was sent under this mode. Switching mid-deal would create document inconsistency. Super-admin can clear the lock from the customer detail page with a reason; the override is audited.',
  // Phase 3, C13
  crossBrandAutoAdd: 'When you create a Lead/Quote/Deal against an existing customer under a brand they didn\'t yet have, the customer\'s brand relationships extend automatically. The change is logged in the audit trail and a toast confirms it.',
  brandPickerOnCreate: 'Pre-filled to your default brand. Lock at creation: once the entity is saved, super-admin override is required to change it.',
}

// ─── Entity-level brand field (referenced from many sections) ─────────────────

export const ENTITY_BRAND = {
  brand:              'Which brand this record belongs to. Locked at creation. Changes require super-admin override with a written reason and are audited.',
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

// ─── AI Assistant ─────────────────────────────────────────────────────────────

export const AI = {
  chat:             'Type a message and press Enter (or tap ↑) to send. Shift+Enter adds a new line.',
  newConversation:  'Start a fresh conversation. Each conversation has its own context and message history.',
  conversationList: 'Your past conversations with the AI. Click any to resume. Long-press on mobile to delete.',
  deleteConversation: 'Delete this conversation and all its messages permanently. Cannot be undone.',
  clearConversation:  'Remove all messages in this conversation while keeping the conversation thread.',
  suggestions:      'Tap a suggested prompt to start. These are tuned to common Sovern House workflows.',
  thinking:         'The AI is reading the current ERP snapshot and composing a response — usually under 10 seconds.',
  context:          'The AI has read-only access to your live ERP data: lead pipeline, triage inbox, recent quotations, and connected accounts. It cannot make changes.',
  roleScope:        'Admins get the full ERP snapshot. Other roles receive a prompt scoped to their access level.',
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const CHAT = {
  bubble:           'Open the team chat. The number shows unread messages across all your conversations.',
  directMessage:    'Send a private message directly to another team member. Only the two of you can see it.',
  channel:          'A named group conversation. Add the right people and keep project discussions in one place.',
  privateChannel:   'Private channels are invite-only and hidden from the channel list. Use for sensitive topics.',
  newConversation:  'Start a direct message or create a new group channel.',
  addMembers:       'Add team members to this channel. They will see all previous messages once added.',
  removeMember:     'Remove this person from the channel. Their previous messages remain visible.',
  archiveChannel:   'Archive this channel. No new messages can be sent, but history is preserved.',
  markRead:         'Mark all messages in this channel as read.',
  erpLink:          'This message includes a link to an ERP record (e.g. a Quotation or Purchase Order). Click to open it.',
  mentions:         'Type @ followed by a name to notify a specific team member. They will see a badge on their chat icon.',
  externalChannel:  'This conversation is linked to an external messaging platform (WhatsApp, WeChat, Telegram). Messages sent here are routed back to that platform.',
  whatsapp:         'WhatsApp Business channel — messages from your WhatsApp contacts appear here. Replies are sent back via WhatsApp.',
  wechat:           'WeChat Work (WeCom) channel — messages from your WeChat contacts or groups appear here.',
  telegram:         'Telegram bot channel — messages sent to your Telegram bot appear here.',
  typingIndicator:  'Someone is currently typing a reply in this conversation.',
  readReceipt:      'Shows when each team member last read the conversation.',
  editMessage:      'Edit the content of a message you sent. Other members will see an "(edited)" label.',
  deleteMessage:    'Remove this message. It will show as "Message deleted." in the thread — permanent.',
  chatPage:         'The Chat page is the full management view. Create and configure group channels, manage members, and see all your conversations in one place.',
}

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

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const DASHBOARD = {
  revenue:        'Revenue Summary: monthly invoiced revenue vs. the prior month. Sourced from confirmed sales invoices.',
  orders:         'Order Status: live count of sales orders grouped by status (Confirmed, In Production, Shipped, etc.).',
  approvals:      'Pending Approvals: document approval requests (PIs, quotations) that clients have not yet responded to.',
  activity:       'Recent Activity: the latest CRM interactions — calls, emails, and meetings — across all active leads.',
  kpi:            'KPI Overview: a single tracked metric with current value, trend vs. prior period, and progress toward your target.',
  actions:        'Quick Actions: one-click shortcuts to the most frequent ERP operations for your role.',
  alerts:         'Alerts & Notifications: system warnings, overdue items, and low-stock thresholds that need attention.',
  customize:      'Pick which widgets appear on your dashboard. Toggle each on or off, choose its size, and click Apply. Drag to reorder. Resize from the bottom-right corner of any widget.',
  saveLayout:     'Save your current widget arrangement to the server. Layout is per-user — saving does not affect other users.',
  resetToDefault: 'Restore the default widget set for your role, overwriting your saved layout.',
  removeWidget:   'Remove this widget from your dashboard. Re-add it at any time via Customize.',
  // Phase 3, C11: brand-aware reporting
  brandFilter:    'Narrow dashboard data to one brand. Single-brand users see only their brand and the picker is hidden.',
  allBrands:      'Super-admin only. Combined SH + FW view; reports are read-only in this mode.',
  fwCommission:   'FlorWay commission accrued this Asia/Taipei month from SalesOrders tagged FW. Default 5%; per-order rate is adjustable inline (pending rows only).',
  brandRevenueComparison: 'Super-admin only. Side-by-side SH vs FW revenue + commission for the current month.',
}

// ─── Google Drive ─────────────────────────────────────────────────────────────

export const GOOGLE_DRIVE = {
  accountSelector: 'Switch between connected Google accounts. Add accounts in Settings → Connected Accounts.',
  search:          'Search across all files in this Google Drive account. Results update 500 ms after you stop typing.',
  breadcrumb:      'Your current folder path from root. Click any folder name to navigate back to that level.',
  openFile:        'Open this file in Google Drive (new tab). Requires an active Google session in your browser.',
  downloadFile:    'Download this file directly. Only available for files with a direct download link — Google Docs, Sheets, and Slides must be exported from Google Drive.',
  folderClick:     'Click a folder row to navigate into it.',
  backToFolder:    'Exit search results and return to your current folder view.',
  noAccounts:      'No Google account with Drive access is connected. Go to Settings → Connected Accounts to connect one.',
}
