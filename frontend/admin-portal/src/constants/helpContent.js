/**
 * helpContent.js
 *
 * Page-level help content for the HelpPanel slide-in.
 * Each key is a URL path (or path prefix).
 * Content is plain JS so it renders fast and stays easy to update.
 *
 * Structure per page:
 *   title     — Panel header
 *   summary   — 1–2 sentence overview
 *   sections  — Array of { heading, steps?, items?, body? }
 *   tips      — Array of quick tip strings
 *   warnings  — Array of amber warning strings
 *   statuses  — Array of { label, description, color } for status glossaries
 *   links     — Array of { label, url } for external resources
 */

// ─── Global tips shown on every page ─────────────────────────────────────────

export const GLOBAL_TIPS = [
  'Press Escape or click outside to close any modal.',
  'All dates use your browser\'s local timezone.',
  'Soft-deleted records are hidden from lists but preserved in the database.',
  'Changes are saved when you click Save — there is no auto-save.',
  'Access is role-based. If you cannot see a menu item, ask your admin.',
]

// ─── Per-page content ─────────────────────────────────────────────────────────

export const HELP_CONTENT = {

  // ── Dashboard ──────────────────────────────────────────────────────────────
  '/': {
    title: 'Dashboard',
    summary: 'Your operational overview. Widgets update in real time and are configurable per user.',
    sections: [
      {
        heading: 'What you see here',
        items: [
          'Open orders and their current status',
          'Overdue invoices and follow-up actions required',
          'Pending document approvals awaiting client response',
          'Recent CRM activity across your team',
          'Revenue and pipeline metrics',
        ],
      },
      {
        heading: 'Customising your dashboard',
        steps: [
          'Click the Configure button (gear icon) in the top right of the dashboard.',
          'Drag widgets to reorder or toggle them on/off.',
          'Changes are saved per user — each person has their own layout.',
        ],
      },
    ],
    tips: [
      'Pending Approvals widget shows all open approval links — click through to the document.',
      'Overdue activities appear in red. Click to open the CRM lead and record an update.',
    ],
  },

  // ── Customers ──────────────────────────────────────────────────────────────
  '/customers': {
    title: 'Customers',
    summary: 'Buyers and trading partners. A customer can be linked to inquiries, quotations, orders, and invoices.',
    sections: [
      {
        heading: 'Creating a customer',
        steps: [
          'Click New Customer.',
          'Enter company name, email, phone, and country. These are required.',
          'Set payment terms (default Net 30) and credit limit.',
          'Save — the customer is now available to link to new documents.',
        ],
      },
      {
        heading: 'Credit management',
        items: [
          'Credit Limit: maximum outstanding balance allowed.',
          'Credit Used: sum of unpaid invoices linked to this customer.',
          'Credit Hold: blocks new orders when the balance exceeds the limit.',
          'Rating: internal score (0–5). Use it to prioritise follow-ups.',
        ],
      },
    ],
    tips: [
      'Search by company name or email. The list is paginated — use filters for large datasets.',
      'A customer on Credit Hold cannot have new PIs or SOs created for them.',
    ],
  },

  // ── Inquiries ──────────────────────────────────────────────────────────────
  '/inquiries': {
    title: 'Inquiries',
    summary: 'An inquiry is the start of the sales cycle — a buyer\'s request for a product or price.',
    sections: [
      {
        heading: 'Sales cycle overview',
        steps: [
          'Inquiry: buyer asks for a product or price.',
          'Quotation: you prepare a formal price quote.',
          'Proforma Invoice (PI): confirmed price and terms sent to the buyer.',
          'Sales Order (SO): confirmed deal, production begins.',
          'Invoice: payment document sent after goods are shipped.',
        ],
      },
      {
        heading: 'Key fields',
        items: [
          'Target Price: buyer\'s budget. Never share with the factory.',
          'Incoterm: delivery responsibility boundary (FOB, CIF, EXW, etc.).',
          'Required By: buyer\'s deadline. Use to set factory production schedule.',
          'Certifications: required product certifications — confirm with the factory before quoting.',
        ],
      },
    ],
    warnings: [
      'Never share the buyer\'s target price or budget with the factory. Negotiate from cost up, not from target down.',
    ],
  },

  // ── Quotations ─────────────────────────────────────────────────────────────
  '/quotations': {
    title: 'Quotations',
    summary: 'A formal price quote sent to the buyer. Valid until a specified expiry date.',
    sections: [
      {
        heading: 'Creating a quotation',
        steps: [
          'Open an inquiry and click Create Quotation.',
          'Add line items — select product, quantity, and unit price.',
          'Set payment terms, validity date, and incoterm.',
          'Review totals, then Save and Send to the buyer.',
        ],
      },
      {
        heading: 'Pricing guidance',
        items: [
          'Sell price = Factory FOB / (1 - gross margin %). Never multiply up.',
          'Include your freight estimate if quoting CIF or CFR.',
          'Discount field is in currency units, not percentage.',
          'Tax is usually 0 for international B2B trade — confirm for domestic sales.',
        ],
      },
      {
        heading: 'Sourcing trail',
        items: [
          'Link the Factory field to the supplier providing the goods for this quote.',
          'Link the Lead field to the CRM prospect this quote originated from.',
          'Both links are preserved on the Sales Order and Purchase Order for full pipeline traceability.',
          'Sourcing trail is visible in the quotation detail view and on the mobile app.',
        ],
      },
    ],
    tips: [
      'A quotation can be upgraded to a Proforma Invoice once the buyer agrees to terms.',
      'Valid Until date matters — expired quotations should not be converted without reconfirming prices.',
      'Use the Factory and Lead pickers to build a complete sourcing trail from prospect to supplier.',
    ],
  },

  // ── Proforma Invoices ──────────────────────────────────────────────────────
  '/proforma-invoices': {
    title: 'Proforma Invoices',
    summary: 'A PI is a pre-shipment invoice confirming price, quantity, and terms. The buyer uses it to arrange payment and import clearance.',
    sections: [
      {
        heading: 'PI workflow',
        steps: [
          'Create PI from a confirmed quotation.',
          'Review line items, payment terms, and bank details.',
          'Click Send for Approval to generate a secure client link.',
          'Buyer reviews and approves the PI online — no login required.',
          'Once confirmed, click Convert to Sales Order.',
        ],
      },
      {
        heading: 'Approval link',
        items: [
          'The link is unique and expires after 30 days.',
          'Copy and send via email or WhatsApp.',
          'The buyer can approve or reject — you get notified either way.',
          'If rejected, check the reason, revise the PI, and send a new link.',
          'Expired links must be regenerated — the old one cannot be reused.',
        ],
      },
    ],
    statuses: [
      { label: 'Draft',     color: 'bg-gray-100 text-gray-700',   description: 'Not yet sent to the buyer.' },
      { label: 'Sent',      color: 'bg-blue-100 text-blue-700',   description: 'Awaiting buyer confirmation.' },
      { label: 'Confirmed', color: 'bg-green-100 text-green-700', description: 'Buyer confirmed. Ready to convert to Sales Order.' },
      { label: 'Cancelled', color: 'bg-red-100 text-red-700',     description: 'PI cancelled. Create a new one if needed.' },
    ],
    warnings: [
      'Do not edit a PI after sending it for approval — generate a new PI instead.',
    ],
  },

  // ── Sales Orders ──────────────────────────────────────────────────────────
  '/orders': {
    title: 'Sales Orders',
    summary: 'A Sales Order confirms the deal with the buyer and triggers production. It links the buyer side to the factory side via a Purchase Order.',
    sections: [
      {
        heading: 'Order lifecycle',
        steps: [
          'SO created from a confirmed PI.',
          'Create a Purchase Order for the factory.',
          'Factory confirms: SO moves to In Production.',
          'Production complete: Ready status.',
          'Goods shipped: Shipped → In Transit → Delivered.',
          'Payment cleared: Completed.',
        ],
      },
      {
        heading: 'Actions on this page',
        items: [
          'Create Packing List: auto-generates a draft PL from line items.',
          'Convert to PO: creates the corresponding factory purchase order.',
          'Payment Status: tracks deposit and balance payments.',
        ],
      },
    ],
    statuses: [
      { label: 'Confirmed',    color: 'bg-blue-100 text-blue-700',    description: 'Order confirmed, waiting for production.' },
      { label: 'In Production',color: 'bg-purple-100 text-purple-700',description: 'Factory is manufacturing.' },
      { label: 'Ready',        color: 'bg-yellow-100 text-yellow-700',description: 'Production done. Ready to ship.' },
      { label: 'Shipped',      color: 'bg-indigo-100 text-indigo-700',description: 'Left the factory.' },
      { label: 'In Transit',   color: 'bg-cyan-100 text-cyan-700',    description: 'En route to destination.' },
      { label: 'Delivered',    color: 'bg-teal-100 text-teal-700',    description: 'Arrived at buyer\'s port or address.' },
      { label: 'Completed',    color: 'bg-green-100 text-green-700',  description: 'Fully closed. Payment confirmed.' },
      { label: 'Cancelled',    color: 'bg-red-100 text-red-700',      description: 'Cancelled. No further actions.' },
    ],
    tips: [
      'Status transitions are enforced — you cannot skip steps. If you need to fix a status, contact an admin.',
    ],
  },

  // ── Factories ─────────────────────────────────────────────────────────────
  '/factories': {
    title: 'Factories',
    summary: 'Your supplier database. Factories are linked to Purchase Orders, Products, and Shipments.',
    sections: [
      {
        heading: 'Confidential factories',
        body: 'Enable the Confidential toggle to restrict visibility to specific users. Use this for sensitive or exclusive supplier relationships you don\'t want all staff to see.',
      },
      {
        heading: 'Key information to maintain',
        items: [
          'Certifications: ISO 9001, BSCI, CE, etc. Needed for compliance checks.',
          'Lead Time Days: factory\'s typical production time. Critical for order scheduling.',
          'Payment Terms: agreed terms with this supplier.',
          'Rating: update after each completed order (1–5 stars).',
        ],
      },
    ],
    warnings: [
      'Confidential factories are only visible to users in the Allowed Users list. Verify this list before onboarding new staff.',
    ],
  },

  // ── Purchase Orders ────────────────────────────────────────────────────────
  '/purchase-orders': {
    title: 'Purchase Orders',
    summary: 'A PO is sent to the factory to kick off production. It mirrors the Sales Order on the buyer side.',
    sections: [
      {
        heading: 'PO lifecycle',
        steps: [
          'Draft: internal document, not yet sent to the factory.',
          'Send to factory — they confirm receipt and timeline.',
          'Track production: In Production → Ready.',
          'Book shipment once goods are Ready.',
          'Mark Received when goods arrive.',
          'Complete after full payment and document close-out.',
        ],
      },
      {
        heading: 'Linking to Sales Orders',
        body: 'Each PO should be linked to its corresponding Sales Order. This links the buyer side to the supplier side and enables end-to-end order tracking.',
      },
    ],
    statuses: [
      { label: 'Draft',         color: 'bg-gray-100 text-gray-700',    description: 'Not sent to factory yet.' },
      { label: 'Sent',          color: 'bg-blue-100 text-blue-700',    description: 'Awaiting factory confirmation.' },
      { label: 'Confirmed',     color: 'bg-indigo-100 text-indigo-700',description: 'Factory has confirmed.' },
      { label: 'In Production', color: 'bg-purple-100 text-purple-700',description: 'Factory is producing.' },
      { label: 'Ready',         color: 'bg-yellow-100 text-yellow-700',description: 'Production complete.' },
      { label: 'Shipped',       color: 'bg-cyan-100 text-cyan-700',    description: 'Goods shipped from factory.' },
      { label: 'Received',      color: 'bg-teal-100 text-teal-700',    description: 'Goods received at our side.' },
      { label: 'Completed',     color: 'bg-green-100 text-green-700',  description: 'Fully closed.' },
      { label: 'Cancelled',     color: 'bg-red-100 text-red-700',      description: 'Cancelled.' },
    ],
  },

  // ── Document Approvals ────────────────────────────────────────────────────
  '/approvals': {
    title: 'Document Approvals',
    summary: 'Track all approval requests sent to clients. Clients can approve or reject documents via a secure link — no login required on their side.',
    sections: [
      {
        heading: 'How approvals work',
        steps: [
          'Open a PI or Quotation and click Request Approval.',
          'Enter the client\'s name and email, then generate the link.',
          'Copy and send the link to your client (email, WhatsApp, etc.).',
          'The client opens the link and sees a document summary.',
          'They click Approve or Reject. Their name, email, and IP are recorded.',
          'You receive a notification and the status updates in the ERP.',
        ],
      },
      {
        heading: 'Managing expired links',
        body: 'Links expire after 30 days by default. If a client hasn\'t responded and the link has expired, open the original document and generate a new approval link.',
      },
    ],
    statuses: [
      { label: 'Pending',  color: 'bg-yellow-100 text-yellow-700', description: 'Sent — waiting for client response.' },
      { label: 'Approved', color: 'bg-green-100 text-green-700',   description: 'Client approved. Proceed with the document.' },
      { label: 'Rejected', color: 'bg-red-100 text-red-700',       description: 'Client rejected. Review reason, revise, and resend.' },
      { label: 'Expired',  color: 'bg-gray-100 text-gray-700',     description: 'Link expired. Generate a new one.' },
    ],
    warnings: [
      'Each approval link is single-use per document state. If you update the PI after sending the link, generate a new link.',
    ],
  },

  // ── Shipments ─────────────────────────────────────────────────────────────
  '/shipments': {
    title: 'Shipments',
    summary: 'Track sea or air freight from factory to buyer. Each shipment links to a Sales Order and generates the logistics paper trail.',
    sections: [
      {
        heading: 'Key fields to complete',
        items: [
          'Container Number: required for port tracking and customs.',
          'Port of Loading / Discharge: use UN/LOCODE format (e.g. CNSHA, USNYC).',
          'ETD / ETA: estimated departure and arrival. Update when the carrier confirms.',
          'Vessel / Voyage: provided by the freight forwarder after booking.',
          'Tracking URL: carrier\'s online tracker. Share with the buyer.',
        ],
      },
      {
        heading: 'Container sizing guide',
        items: [
          '20ft: ~28 CBM capacity, max 22 tonnes.',
          '40ft: ~58 CBM capacity, max 26 tonnes.',
          '40HC (high cube): ~67 CBM, extra 30cm height.',
          'LCL: shared container — charged per CBM.',
        ],
      },
    ],
    statuses: [
      { label: 'Booked',     color: 'bg-blue-100 text-blue-700',    description: 'Cargo space reserved with carrier.' },
      { label: 'Loaded',     color: 'bg-indigo-100 text-indigo-700',description: 'Goods loaded onto vessel or vehicle.' },
      { label: 'In Transit', color: 'bg-cyan-100 text-cyan-700',    description: 'En route.' },
      { label: 'At Port',    color: 'bg-yellow-100 text-yellow-700',description: 'Arrived at destination port.' },
      { label: 'Customs',    color: 'bg-orange-100 text-orange-700',description: 'Being cleared by customs.' },
      { label: 'Delivered',  color: 'bg-green-100 text-green-700',  description: 'Goods delivered.' },
    ],
  },

  // ── Inspections ───────────────────────────────────────────────────────────
  '/inspections': {
    title: 'Inspections',
    summary: 'Quality control checks performed before shipment. Always inspect before releasing final payment.',
    sections: [
      {
        heading: 'When to inspect',
        items: [
          'Pre-Shipment Inspection (PSI): most common. Performed when 80–100% of goods are packed.',
          'During Production (DUPRO): for large orders or new factories.',
          'Container Loading Supervision (CLS): ensures correct goods are loaded.',
        ],
      },
      {
        heading: 'AQL sampling',
        body: 'AQL 2.5 is the standard for most consumer goods — it accepts up to 2.5% defects in a statistical sample. For safety-critical products, use AQL 1.0.',
      },
    ],
    tips: [
      'Attach the inspection report PDF to the record for audit purposes.',
      'A Conditional Pass means the buyer must accept the deviations in writing before you ship.',
    ],
  },

  // ── Invoices ──────────────────────────────────────────────────────────────
  '/invoices': {
    title: 'Invoices',
    summary: 'Commercial invoices sent to buyers for payment. Sales invoices are receivables; purchase invoices are payables.',
    sections: [
      {
        heading: 'Invoice types',
        items: [
          'Sales Invoice: you are owed money by the buyer.',
          'Purchase Invoice: you owe money to a factory or supplier.',
          'Credit Note: reduces the amount owed (e.g. after a return or claim).',
          'Debit Note: increases the amount owed (e.g. for additional charges).',
        ],
      },
      {
        heading: 'Payment tracking',
        items: [
          'Record each payment received under Payments.',
          'Paid Amount and Balance update automatically.',
          'The scheduler marks invoices as Overdue at midnight on the due date.',
        ],
      },
    ],
    statuses: [
      { label: 'Draft',          color: 'bg-gray-100 text-gray-700',   description: 'Not yet sent.' },
      { label: 'Sent',           color: 'bg-blue-100 text-blue-700',   description: 'Sent, awaiting payment.' },
      { label: 'Partially Paid', color: 'bg-yellow-100 text-yellow-700',description: 'Partial payment received.' },
      { label: 'Paid',           color: 'bg-green-100 text-green-700', description: 'Fully paid.' },
      { label: 'Overdue',        color: 'bg-red-100 text-red-700',     description: 'Payment past due date.' },
      { label: 'Cancelled',      color: 'bg-gray-100 text-gray-600',   description: 'Cancelled.' },
    ],
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  '/payments': {
    title: 'Payments',
    summary: 'Record payments received from buyers or sent to factories. Each payment links to an invoice.',
    sections: [
      {
        heading: 'Recording a payment',
        steps: [
          'Open the invoice you received payment against.',
          'Click Record Payment.',
          'Enter amount, date, method, and your bank reference.',
          'Save — the invoice balance updates automatically.',
        ],
      },
      {
        heading: 'Payment methods',
        items: [
          'Bank Transfer (T/T): most common for international trade.',
          'Letter of Credit (LC): bank-guaranteed payment. High trust, high cost.',
          'Cheque: domestic or regional payments only.',
          'Cash: record with a reference for audit purposes.',
        ],
      },
    ],
    warnings: [
      'Always match the payment reference to the bank statement before confirming. Entering the wrong amount affects the buyer\'s balance.',
    ],
  },

  // ── CRM ───────────────────────────────────────────────────────────────────
  '/leads': {
    title: 'Leads',
    summary: 'Potential buyers who have not yet made a purchase. Leads move through pipeline stages as you qualify them.',
    sections: [
      {
        heading: 'Pipeline stages',
        items: [
          'New: just added, not yet contacted.',
          'Contacted: you have reached out — awaiting reply.',
          'Qualified: confirmed they buy the type of product you sell.',
          'Proposal: quotation or PI has been sent.',
          'Negotiation: in active price or terms discussion.',
          'Won: became a customer.',
          'Lost: did not convert.',
        ],
      },
      {
        heading: 'Best practices',
        items: [
          'Log every interaction as an Activity — calls, emails, meetings.',
          'Set a Next Follow-Up date on every lead so nothing falls through.',
          'Update the Lead Score after each contact — higher score = more attention.',
        ],
      },
    ],
    tips: [
      'Use Bulk Import to upload a lead list from a CSV or Excel file.',
      'Overdue follow-up tasks appear as alerts on the dashboard.',
    ],
  },

  // ── Outreach ──────────────────────────────────────────────────────────────
  '/client-contacts': {
    title: 'Outreach',
    summary: 'Send personalised email campaigns to leads directly from the ERP. All emails are logged and tracked.',
    sections: [
      {
        heading: 'Sending an email',
        steps: [
          'Open a lead and click Send Outreach Email.',
          'Select a template — merge tags are filled automatically.',
          'Review the personalised preview.',
          'Click Send. The email is logged on the lead timeline.',
        ],
      },
      {
        heading: 'Templates and signatures',
        items: [
          'Manage templates in Settings > Email Templates.',
          'Your signature is appended automatically — edit in Settings > Email Signatures.',
          'Merge tags: {{firstName}}, {{companyName}}, {{productInterest}}.',
        ],
      },
    ],
    warnings: [
      'Emails can only be sent from authorised domains configured in the server settings. Contact your admin if sending fails.',
    ],
  },

  // ── Products ──────────────────────────────────────────────────────────────
  '/products': {
    title: 'Product Catalog',
    summary: 'Your sourcing and pricing database. Each product holds buy prices from one or more factories, sell prices with margin, and dual specifications — a full technical spec for suppliers and a commercial spec for buyers.',
    sections: [
      {
        heading: 'Product structure',
        items: [
          'Basic Info: name, SKU, category, primary factory, unit, HS code, min order qty.',
          'Pricing: one or more supplier price cards — FOB buy, EXW, margin, sell price, and currency.',
          'Technical Specs: full specification used on supplier purchase orders.',
          'Commercial Specs: subset of specs shown to buyers on quotations and sales orders.',
        ],
      },
      {
        heading: 'Adding supplier prices',
        steps: [
          'Open the product and go to the Pricing tab.',
          'Click Add Supplier Price.',
          'Select the supplier factory and enter the Incoterm, buy price, and margin %.',
          'The sell price is calculated automatically: Sell = Buy ÷ (1 − Margin%).',
          'Mark the price as Active to use it on new quotations.',
          'Only one price per factory can be active at a time — activating a new price archives the old one.',
        ],
      },
      {
        heading: 'Dual specifications (Technical vs. Commercial)',
        body: 'Use the Technical Specs tab to enter the full product specification — all details go on factory purchase orders. Use the Commercial Specs tab to choose which fields buyers see on quotations and sales orders. This keeps sensitive production details (tolerances, tooling specs) off client documents while still including the commercial highlights.',
      },
      {
        heading: 'Descriptions',
        items: [
          'Sales Description: client-facing — shown on quotations, PIs, and sales orders. Write for the buyer.',
          'Purchase Description: supplier-facing — shown on purchase orders. Include QC requirements and packaging specs.',
          'Internal Description: private notes — never leaves the ERP.',
        ],
      },
    ],
    tips: [
      'Sell price = Factory FOB ÷ (1 − Margin%). Never multiply up — division gives gross margin, multiplication gives markup.',
      'Always set an HS Code — it is required on commercial invoices and certificates of origin.',
      'The primary factory field sets the default supplier on new purchase orders for this product.',
      'Commercial Specs are what buyers see on quotations. Keep them clean and client-friendly.',
    ],
    warnings: [
      'Changing an active sell price does not retroactively update existing quotations — those are locked at the price they were created at.',
      'SKU cannot be changed after the product is created. Choose carefully.',
    ],
  },

  // ── Inventory ─────────────────────────────────────────────────────────────
  '/inventory': {
    title: 'Inventory',
    summary: 'Stock levels for products in your warehouse or at forwarding agents.',
    sections: [
      {
        heading: 'Updating inventory',
        items: [
          'Stock increases when a Goods Receipt Note (GRN) is recorded.',
          'Stock decreases when a packing list is confirmed for shipment.',
          'Manual adjustments can be made with an audit reason.',
        ],
      },
    ],
    tips: [
      'Inventory is tracked per SKU. Make sure product codes match across POs and GRNs.',
    ],
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  '/settings': {
    title: 'Settings',
    summary: 'System configuration, user management, roles, and email setup.',
    sections: [
      {
        heading: 'Key settings areas',
        items: [
          'Users: add staff, assign roles, reset passwords.',
          'Role Permissions: view what each role can access.',
          'Email Templates: outreach email templates with merge tag support.',
          'Email Signatures: auto-appended signature blocks.',
          'Price Lists: customer or factory tiered pricing.',
          'Product Taxonomy: categories and attributes for product spec sheets.',
          'Bulk Import: upload leads, contacts, or products via CSV/Excel.',
        ],
      },
    ],
    warnings: [
      'Changing a user\'s role takes effect immediately on their next page load.',
      'Deleting a user is a soft delete — their records remain linked but they cannot log in.',
    ],
  },

  // ── Bulk Import ───────────────────────────────────────────────────────────
  '/settings/bulk-import': {
    title: 'Bulk Import',
    summary: 'Upload leads, contacts, or products in bulk via CSV or Excel. Uses a 4-step wizard with preview before committing.',
    sections: [
      {
        heading: 'Import steps',
        steps: [
          'Download the template file for the data type you\'re importing.',
          'Fill in your data. First row must be the column headers.',
          'Upload the file — CSV or Excel (.xlsx) accepted, max 2,000 rows.',
          'Map your columns to ERP fields. Unmapped columns are ignored.',
          'Review the preview — fix errors in your file and re-upload if needed.',
          'Click Confirm Import to commit the records.',
        ],
      },
      {
        heading: 'Deduplication',
        body: 'Leads are matched by email address. Existing records are updated; new ones are created. Products are matched by SKU.',
      },
    ],
    warnings: [
      'There is no undo for bulk import. Review the preview carefully before confirming.',
    ],
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  '/reports': {
    title: 'Reports',
    summary: 'Standard reports across sales, procurement, finance, and logistics.',
    sections: [
      {
        heading: 'Available reports',
        items: [
          'Sales Pipeline: lead stages, conversion rates, and forecast.',
          'Order Status Summary: open orders by status and factory.',
          'Invoice Aging: overdue invoices by age bucket.',
          'Payment Summary: payments received vs. expected.',
          'Shipment Status: active shipments and ETAs.',
        ],
      },
    ],
    tips: [
      'Export any report to CSV using the Download button.',
      'Use the Analytics page for deeper trend analysis and BI Dashboard for executive-level views.',
    ],
  },

  '/chat': {
    title: 'Team Chat',
    summary: 'Internal messaging for your team. Direct messages, group channels, and an omnichannel inbox for WhatsApp, WeChat, and Telegram conversations — all in one place.',
    sections: [
      {
        heading: 'Starting a conversation',
        items: [
          'Click the green chat bubble (bottom-right corner) to open the chat overlay from any ERP page.',
          'Go to Chat in the sidebar for the full-screen management view.',
          'Click the + icon in the sidebar to start a Direct Message or create a new channel.',
          'For a Direct Message: search for a team member and click their name.',
          'For a channel: give it a name, an optional description, and choose Private or Public.',
        ],
      },
      {
        heading: 'Sending messages',
        items: [
          'Type your message and press Enter to send. Shift+Enter adds a new line.',
          'Use @name to mention a team member — they will receive a notification badge.',
          'Messages can be edited (pencil icon on hover) or soft-deleted (trash icon).',
          'Hover a message to add emoji reactions.',
        ],
      },
      {
        heading: 'Linking ERP records',
        items: [
          'Paste or type an ERP reference like QT-0042, SO-0012, or PO-0008 in a message.',
          'The ERP reference will render as a clickable link that opens the record directly.',
          'This keeps deal discussions connected to the actual documents without switching tabs.',
        ],
      },
      {
        heading: 'Managing group channels',
        items: [
          'From the /chat page, open the gear icon on any channel to access settings.',
          'Add members by searching their name. Remove members with the X next to their name.',
          'Rename or update the description in channel settings.',
          'Archive a channel to freeze it — history is preserved but no new messages can be sent.',
          'Channel admins can promote members or remove them.',
        ],
      },
      {
        heading: 'External channels (WhatsApp, WeChat, Telegram)',
        items: [
          'External messages from WhatsApp, WeChat Work (WeCom), and Telegram appear as separate channels marked with a colored badge.',
          'You can reply to external contacts directly from the ERP — replies are routed back to the correct platform automatically.',
          'This requires a one-time webhook setup per platform by your system administrator.',
          'External sender names are shown even if the contact is not an ERP user.',
        ],
      },
      {
        heading: 'Read receipts and notifications',
        items: [
          'The unread count badge on the chat bubble updates in real time.',
          'Opening a conversation marks all messages as read.',
          'You can mute a channel to suppress notifications while still receiving messages.',
          '@mentions always generate a notification regardless of mute settings.',
        ],
      },
    ],
    tips: [
      'Use the floating chat bubble on any page so you never have to leave your current workflow.',
      'Create a dedicated channel for each major deal, customer, or factory to keep context together.',
      'Link ERP records in messages to keep conversations anchored to the actual documents.',
      'External channels (WhatsApp, WeChat, Telegram) let your team handle supplier and buyer communication without leaving the ERP.',
    ],
  },

  // ── Default (unknown page) ────────────────────────────────────────────────
  '__default__': {
    title: 'Help',
    summary: 'Welcome to Sovern ERP. Use the navigation on the left to access your modules.',
    sections: [
      {
        heading: 'Getting started',
        items: [
          'Your role determines which modules you can see.',
          'The sales cycle flows: Inquiry → Quotation → PI → Sales Order → Invoice.',
          'All document approvals can be tracked under Document Approvals.',
          'Questions? Contact your system administrator.',
        ],
      },
    ],
  },
}
