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
          'Click the Customize button (+ icon) in the top right.',
          'Toggle widgets on or off and choose a size for each, then click Apply.',
          'Drag widgets to reorder. Resize from the bottom-right corner of any widget.',
          'Layout auto-saves 2 seconds after every drag or resize. Use Save Layout to save immediately.',
          'Click Reset to Default to restore the preset layout for your role.',
        ],
      },
      {
        heading: 'FlorWay commission tracking (Phase 4)',
        items: [
          'Open the FlorWay Commission page from the user menu (visible only when you have FW access or are super-admin).',
          'Rate floor is 5% (HanHua/FlorWay agreement, locked 2026-05-14). Per-quotation override on the quotation itself; the dashboard surfaces "Your commission rate: X%".',
          'Rate resolution order: quotation.commissionRateOverride → Brand.commissionRate → legacy CommissionRule.',
          'Statuses: accrued → invoiced_to_factory → paid. Disputed or clawed_back are off-flow.',
          'Accrual fires when a SalesOrder transitions to "confirmed". Idempotent — a second status flip does not re-accrue.',
          'Super-admin can Mark paid (sets paidDate + status=paid) and Claw back (status=clawed_back, requires a written reason). Both audited.',
          'Outstanding tracker surfaces deals stuck in accrued / invoiced_to_factory for over 30 days — chase the factory.',
        ],
      },
      {
        heading: 'Brand-filtered reporting (Phase 3)',
        items: [
          'Top-right Brand picker narrows every dashboard widget to one brand. Hidden for single-brand users.',
          'Multi-brand users see SH and FW pills; selection persists across sessions via localStorage.',
          'Super-admin in cross-brand mode gets an "All Brands" option that shows aggregated revenue and a side-by-side SH vs FW comparison widget.',
          'FlorWay Commission widget shows month-to-date accrued / paid / pending tiles. Default rate 5%. Click "Show orders" to expand the per-order list and adjust any pending row\'s percentage inline.',
          'Per-order edits are restricted to pending rows for the row owner; super-admin can edit any row.',
        ],
      },
    ],
    tips: [
      'Pending Approvals widget shows all open approval links — click through to the document.',
      'Overdue activities appear in red. Click to open the CRM lead and record an update.',
      'FlorWay commission is auto-accrued at SalesOrder creation. If you change the percentage on a pending row, the amount recalculates immediately.',
    ],
  },

  // ── Customers ──────────────────────────────────────────────────────────────
  '/customers': {
    title: 'Customers',
    summary: 'Buyers and trading partners. A customer can be linked to inquiries, quotations, orders, and invoices, and may relate to more than one brand.',
    sections: [
      {
        heading: 'Creating a customer',
        steps: [
          'Click New Customer.',
          'Enter company name, email, phone, and country. These are required.',
          'Set payment terms (default Net 30) and credit limit.',
          'Save. The customer is now available to link to new documents.',
        ],
      },
      {
        heading: 'Credit management',
        items: [
          'Credit Limit: maximum outstanding balance allowed.',
          'Credit Used: sum of unpaid invoices linked to this customer.',
          'Credit Hold: blocks new orders when the balance exceeds the limit.',
          'Rating: internal score (0 to 5). Use it to prioritise follow-ups.',
        ],
      },
      {
        heading: 'FlorWay product branding mode (Phase 3)',
        items: [
          'For FlorWay customers, the FW Product Branding Mode card on the customer detail page picks which quotation variant is rendered: IronLite, Generic, or Private Label.',
          'Default is Generic (no IronLite imagery). Pick IronLite when the buyer wants the full IronLite Core branding (wordmark + OEM badge + construction diagram for WPC).',
          'Private Label requires a buyer brand name (e.g. "OakCove Flooring") which appears on the document.',
          'The mode LOCKS the first time a FlorWay quotation under that mode is sent (status flips to "sent"). Switching mid-deal would create document inconsistency.',
          'Super-admin can override the lock from the same card. The override requires a written reason (min 3 chars) and is recorded in the audit log.',
        ],
      },
      {
        heading: 'Cross-brand auto-add (Phase 3, C13)',
        items: [
          'When you create a new Lead, Quotation, or Deal against an existing customer under a brand that customer didn\'t yet have, the brand is automatically added to their brand relationships.',
          'A confirmation toast appears: "Customer X is now also a [BRAND] relationship."',
          'The change is recorded in the audit log as `cross_brand_relationship_added` with the user, the triggering entity, and the brand timestamp.',
          'No manual step is required: the customer\'s detail page picks up the new brand badge on next load.',
          'Per the brand isolation rule, GET-by-id for any entity in a brand outside your accessible brands returns 404 (not 403). The existence of the record isn\'t leaked.',
        ],
      },
      {
        heading: 'Brand context (cross-brand customers)',
        items: [
          'A customer may transact under more than one brand. The badge group next to the name shows every brand they have a relationship with.',
          'On the detail page, switch between "SH activity" and "FW activity" tabs to see only that brand\'s deals, quotes, emails, and docs.',
          'Compose, send, and generate buttons act on the active brand tab only. There is no shared timeline.',
          'Super admin sees an extra "All Brands (read-only)" tab. Every visit is audited. Compose/send/generate are disabled in this view.',
        ],
      },
    ],
    tips: [
      'Search by company name or email. The list is paginated, use filters for large datasets.',
      'A customer on Credit Hold cannot have new PIs or SOs created for them.',
      'New leads or quotes against an existing customer under a brand not yet in their relationships array will auto-add that brand. Removal requires super admin.',
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
      {
        heading: 'Brand-aware quotation document (Phase 3)',
        items: [
          'Sovern House quotations render with the SH layout — forest/cream palette, Sovern House wordmark, footer "New Route International Exchange Co., Ltd. · Taiwan", sender alex@sovernhouse.co.',
          'FlorWay quotations render with the FlorWay layout — iron-deep/cream palette, FLORWAY SDN. BHD. footer, sender alexflorway@gmail.com, with one of three variants picked from the customer’s productBrandingMode.',
          'IronLite variant — full IronLite I-Beam wordmark, OEM badge, plus a construction diagram addendum page when any line item is a WPC product.',
          'Generic variant — default for FlorWay. FlorWay Sdn. Bhd. wordmark with no IronLite imagery.',
          'Private Label variant — placeholder during development. PDF currently uses the FlorWay generic layout with a TODO banner naming the buyer’s brand.',
          'For FlorWay, the variant is shown on the quotation detail page above the line items so you know what the buyer will receive before sending.',
        ],
      },
      {
        heading: 'Quotation lifecycle (Phase 4, C16)',
        items: [
          'Statuses: draft (editable) → sent (to buyer) → accepted (signed/agreed) or rejected/expired. revised re-opens a sent quote for edits.',
          'Convert to PI: from sent or accepted. Creates a Proforma Invoice with the same line items.',
          'Convert to Sales Order: from accepted only. Creates a confirmed SO with the source factory and line items. Triggers FW commission accrual when the SO transitions confirmed.',
          'Both convert actions require brand access. Super-admin can convert across brands; brand-scoped users cannot.',
          'For FW, the resulting SO, PI, and Invoice are ERP-internal records. The factory sends the buyer-facing document. The desktop and mobile both disable Send for FW, and the PDF carries a "FACTORY WILL SEND TO BUYER" banner.',
        ],
      },
    ],
    tips: [
      'A quotation can be upgraded to a Proforma Invoice once the buyer agrees to terms.',
      'Valid Until date matters. Expired quotations should not be converted without reconfirming prices.',
      'Use the Factory and Lead pickers to build a complete sourcing trail from prospect to supplier.',
      'To switch a FlorWay quotation between IronLite and Generic, change the customer’s productBrandingMode on their detail page (Phase 3 C12 adds the picker UI).',
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
  '/crm/pipeline': {
    title: 'Pipeline',
    summary: 'Kanban view of every Lead grouped by stage. Drag a card between columns to update its status. Phase 4.8 collapsed the previous separate Deal model into this Lead-based view; see the audit doc for the rationale.',
    sections: [
      {
        heading: 'How to use',
        steps: [
          'Each column is a Lead status. Cards in a column are Leads currently at that stage.',
          'Drag a card to a different column to bump the Lead\'s status. The drop fires PUT /leads/:id and updates the row.',
          'Click a card to open the Lead detail page in full edit mode.',
          'Use the New Lead button to create a new prospect; it lands in the New column by default.',
        ],
      },
      {
        heading: 'Pipeline metrics',
        items: [
          'Per-column count and dollar total (sum of estimatedValue) shown in the column header.',
          'Open pipeline = Qualified + Proposal + Negotiation columns. Top-of-funnel = New + Contacted. Terminal = Won + Lost.',
          'Filter by assignee narrows every column to that user\'s Leads.',
        ],
      },
    ],
    tips: [
      'Lead numbers (LD-YYYYMMDD-NNN) are shown on each card for fast reference in conversations.',
      'Brand badge on each card distinguishes SH from FW Leads.',
    ],
  },

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
        heading: 'Brand-aware catalog (Phase 4)',
        items: [
          'Every product belongs to a brand. Quotations under a brand can only pick products of the same brand.',
          'Brand is locked at creation. Use the brand-override flow (super-admin) to move a product between brands.',
          'Base FOB price is the buyer-facing floor. It ALREADY INCLUDES any commission baked in by the factory; the ERP never adds a percentage on top for the buyer.',
          'Quotation line items default to baseFobPrice. Editing upward is free; editing below floor requires super-admin role + a written reason (audited).',
          'Manage the catalog at Settings > Product catalog. Mobile users see the same list with brand-aware filtering.',
        ],
      },
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
          'Brands: configure each brand\'s sender email, signature, colors, and product category gates.',
        ],
      },
    ],
    warnings: [
      'Changing a user\'s role takes effect immediately on their next page load.',
      'Deleting a user is a soft delete, their records remain linked but they cannot log in.',
    ],
  },

  // ── Brands ────────────────────────────────────────────────────────────────
  '/settings/brands': {
    title: 'Brands',
    summary: 'Multi-brand configuration. Each brand is a self-contained operating identity: sender email, signature, footer legal text, color palette, and (optional) product category gate. Adding a third brand is config-only.',
    sections: [
      {
        heading: 'Two brands, one operating system',
        body: 'The ERP supports more than one trading brand from a single deployment. Sovern House (SH) and FlorWay (FW) ship by default. Each transactional row (lead, quotation, sales order, invoice, expense, etc.) is locked to one brand at creation. Customers can relate to more than one brand and surface separate activity tabs.',
      },
      {
        heading: 'Fields on a brand',
        items: [
          'Code: short identifier (SH, FW). Used as the FK on every transactional row.',
          'Display name: full brand name shown in UI.',
          'Sender email: outbound emails for this brand are sent from this address. Must be a connected Google account.',
          'Signature HTML + Footer legal text: appended to outbound mail and PDF exports.',
          'Primary + Accent colors: drive the brand badge that appears everywhere.',
          'Accepted product categories: optional whitelist that constrains which products can appear on this brand\'s quotations.',
          'Active flag: hide retired brands from new-entity pickers while keeping history visible.',
        ],
      },
      {
        heading: 'Per-user access',
        body: 'Each user has an accessibleBrands array (which brands they can see and act on) and a defaultBrand (pre-fills new-entity forms). Super admin can read across brands via the All Brands view, which is read-only and writes an audit log row per request.',
      },
      {
        heading: 'Brand-locked-at-creation rule',
        body: 'Once a brand is set on a transactional record, it cannot be changed on the standard update path. The frontend strips brandCode from update payloads silently. Changes flow only through PATCH /api/admin/brand-override (super admin), which requires a written reason and is permanently audited.',
      },
    ],
    tips: [
      'FW: alexflorway@gmail.com, iron-deep + cream palette, accepted categories LVT/SPC/WPC/IronLite.',
      'SH: alex@sovernhouse.co, forest + cream palette, no category constraint.',
      'When implementing brand-aware email logic in Phase 2, remember the Egypt BCC rule applies to SH only. FW Egypt leads do not BCC Fanzey.',
    ],
    warnings: [
      'Deactivating a brand stops it appearing in new-entity pickers but does not migrate existing records. Use brand-override for record-level moves.',
      'Cross-brand visibility (All Brands view) is super-admin only and is audit-logged. Treat the audit log as part of the compliance trail.',
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

  // ── AI Assistant ──────────────────────────────────────────────────────────
  '/ai/assistant': {
    title: 'AI Assistant',
    summary: 'Sovern AI is a context-aware trade assistant powered by Claude. It reads a live snapshot of your ERP — pipeline counts, triage items, recent quotations — before every reply, so you can ask operational questions in plain English.',
    sections: [
      {
        heading: 'What the AI knows',
        items: [
          'Lead pipeline: counts by stage and the top 5 pending triage items.',
          'Recent quotations: status, customer, and value of the last 5 quotations.',
          'Upcoming activities: scheduled follow-ups and meetings due within 7 days.',
          'Connected Google accounts: which mailboxes are synced.',
          'Company context: Sovern House business model, Incoterms rules, margin formula, key contacts.',
          'Google Drive: when you ask for a file by name or topic, the assistant searches your connected Drive and returns a clickable link. Phase 4.5, C19.',
          'Gmail threads and inbox: the assistant can list and read your email threads from connected Google accounts.',
          'Web search: live lookups for flights, weather, news, factory and supplier background checks, and other quick research. Phase 4.5, C19.',
        ],
      },
      {
        heading: 'Finding and reading documents in Drive (Phase 4.5 C19 + Phase 4.14)',
        body: 'Ask for any file by name or topic and the assistant searches your connected Google Drive (up to 10 matches with clickable links). Phase 4.14 extended in-conversation reading to xlsx, xls, docx, pdf, and rtf — alongside the original Google Docs, Sheets, plain text, and CSV. The assistant can also narrow large files: name a sheet, a row range, a column range, or a page range so only the relevant slice lands in the conversation.',
        items: [
          '"Read the HanHua IronLite quote in the FW Drive" — parses the xlsx, returns each sheet as CSV.',
          '"From the IronLite quote, just rows 8 to 16 of the Quote sheet" — narrows to the data block, skipping header rows.',
          '"Read page 3 of the latest Frontech PI" — page_range narrowing on the pdf.',
          '"Read the first 2 pages of the HanHua Sales Rep Agreement docx" — max_pages truncation.',
          '"Show me the formulas in the Summary sheet, not the computed values" — raw_formulas=true.',
          'Unsupported: pptx (decks; share the link), legacy .doc (open with Google Docs to auto-convert or re-save as .docx), scanned image PDFs (OCR not yet supported — open with Google Docs for OCR), encrypted PDFs (remove the password first).',
          'Large files: 25MB ingestion cap. Above that, the assistant will ask you to narrow the request or split the file.',
        ],
      },
      {
        heading: 'External research (Phase 4.5, C19)',
        body: 'For anything outside the ERP and Drive, the assistant can run a quick web lookup. Use this for time-sensitive or public-record facts — not for trade compliance decisions, which always need a licensed broker.',
        items: [
          'Flights: "Find flights TPE to LAX next Tuesday"',
          'Weather: "Weather in Cairo on the 22nd"',
          'Factory background: "What can you find about Anhui HanHua Building Materials online?"',
          'News: "Latest on Section 301 tariffs"',
          'Heavy multi-step sourcing belongs in the Tier 2 background runner (Slash command /new-suppliers), not the synchronous chat.',
        ],
      },
      {
        heading: 'Configuration changes via chat (Phase 4.5, C19 v2)',
        body: 'The assistant can make configuration changes through natural-language chat: edit brand fields, email templates, your own profile, your dashboard, create reminders, mark tasks complete, and archive stray items. Every WRITE follows a preview-confirm-save pattern: the assistant shows the diff first, waits for "yes / save / go ahead", then applies and reports back. Every successful change writes an AuditLog row with action prefix ai_assistant_*. Responses from any AI write use a shared renderer (Phase 4.7+): the backend message takes precedence over hardcoded UI copy, genuine errors render in a red-tinted bubble, and unrecognized response shapes are pretty-printed in a code block so payloads are at least debuggable from the chat.',
        items: [
          '"Update the FW signature to put HanHua first" — assistant shows the new HTML preview, asks confirm, saves.',
          '"Hide the orders widget on my dashboard" — assistant reads your current layout, drops the widget, shows the new layout, asks confirm.',
          '"Remind me to follow up with Acme Distribution next Tuesday at 10am" — creates a ScheduledActivity in your name, echoes the Taipei time back.',
          '"Edit the FlorWay Touch 1 template subject to ..." — shows the before/after, asks confirm.',
          '"Mark that follow-up task done" — completes the activity if you are the assignee.',
          '"Set FW commission to 6.5%" — assistant shows the before/after and saves to Brand.commissionRate (Phase 4.9.1).',
          '"Deactivate the HH brand" — assistant flips Brand.active to false; the brand stays in history but disappears from pickers (Phase 4.9.1).',
          '"Create an Engineered SPC sub-category under Flooring/Resilient" — assistant calls create_product_category with the right parentId after a preview (Phase 4.9.1).',
          '"Archive the IronCore Flooring category" — assistant calls archive_product_category; refused server-side if any active products are still bound (Phase 4.9.1).',
          '"Add a HanHua price for product X at 5.80 USD per m² for China origin, valid from today" — assistant calls create_product_price (Phase 4.9.2c). The quotation floor reads from this row via getCurrentPrice.',
          '"Set HanHua factory to brand FW" — assistant calls update_factory with brand_code (Phase 4.9.2a). match_factories_for_product then prefers FW-tagged suppliers for FW products.',
          '"Create a customer in FW context: Milliken Carpet, industry contract flooring, source trade show — Domotex 2026" — assistant calls create_customer with brandCode=FW and the structured extras (Phase 4.9.3a). Returns the new customer id; you can chain create_lead next.',
          '"Draft an intro outreach to lead {id} for review before send" — assistant calls send_outreach_email with draftOnly=true (Phase 4.9.3b). The OutreachEmail row appears in /crm/leads/{id} with status=draft ready for one-click send.',
          '"List the contents of my FW Drive\'s Brand Assets folder" — assistant calls search_drive_files with accountKey="fw" (Phase 4.9.3b). The fw account targets alexflorway@gmail.com; the sh account targets alex@sovernhouse.co. Default is sh.',
        ],
      },
      {
        heading: 'How the AI assistant ingests factory quotes from Drive (Phase 4.9.3)',
        body: 'Factory quotations sit in the FW Drive under Brand Assets / IronLite Branding / and similar paths. The assistant: (1) search_drive_files with accountKey="fw" (or brandCode="FW") to find the file, (2) read_drive_file with the same routing to extract spec + price tables from Google Sheets, (3) create_product for each SKU under the correct ProductCategory (Engineered SPC / SPC / WPC / etc.), (4) create_product_price for each origin (China = HanHua, Malaysia = FlorWay) capturing cost + tariff + validFrom. Every step audits under ai_assistant_*. Show Alex a preview before every write.',
        items: [
          'Drive account auto-routes by brandCode: FW → alexflorway@gmail.com, anything else → alex@sovernhouse.co.',
          'create_product refuses to auto-create categories now — call create_product_category explicitly with preview + confirm.',
          'ProductPrice writes go through the temporal layer (validFrom required, validTo optional). Past-dated rows are historical; future-dated rows queue.',
        ],
      },
      {
        heading: 'How to create a customer + lead via chat (Phase 4.9.3)',
        body: 'Two MCP calls: create_customer (brandCode + companyName required; industry / website / source / primaryAddress object optional) → create_lead (uses the new customer id). Both audit; both expect preview + confirm. Email + phone default to placeholders if you do not provide them; admin can fix later. Companies are unique-within-brand: you can have one "Milliken" under SH and another under FW without collision.',
      },
      {
        heading: 'Hard refusals (Phase 4.5, C19 v2)',
        body: 'The assistant will refuse certain requests and point you at the right surface, even if you insist:',
        items: [
          'Deleting any row — refuse. Use the admin UI delete flow with its own audit.',
          'Editing payment / billing / invoice totals — refuse. Quotation totals are recalculated from line items; invoices are immutable once issued.',
          'Disabling sanctions screening or overriding flagged customers — refuse. The override modal in /customers/:id is the only legitimate path.',
          'Modifying user roles, permissions, brand access, or another user\'s profile — refuse. Admin UI only.',
          'Modifying AuditLog rows — refuse. AuditLog is append-only.',
        ],
      },
      {
        heading: 'Starting a conversation',
        steps: [
          'Click "New conversation" or tap a suggested prompt on the welcome screen.',
          'Type your question and press Enter (Shift+Enter for a new line).',
          'The AI responds with context drawn from your live ERP data.',
          'Continue the thread — the AI remembers earlier messages in the conversation.',
          'Start a new conversation to reset context.',
        ],
      },
      {
        heading: 'What you can ask',
        items: [
          'Pipeline summaries: "What are my open leads and their stages?"',
          'Draft emails: "Draft a follow-up for the Egypt pipeline lead."',
          'Trade knowledge: "What Incoterm should I use for a sea shipment to Rotterdam?"',
          'Calculations: "What is the landed cost if FOB is $4.20 and freight is $0.60 per sqm?"',
          'Triage decisions: "What emails are waiting in triage right now?"',
          'Compliance: "Do I need a certificate of origin for Malaysia-origin goods going to the US?"',
        ],
      },
      {
        heading: 'Managing conversations',
        items: [
          'Your past conversations are listed in the left sidebar (desktop) or conversation list (mobile).',
          'Click any conversation to resume it — history is preserved.',
          'Delete a conversation permanently with the trash icon (sidebar) or long-press (mobile).',
          'Clear a conversation to wipe messages but keep the thread.',
        ],
      },
    ],
    tips: [
      'The AI reads a fresh ERP snapshot at the start of each message — pipeline data is always current.',
      'Be specific: "Draft an email for lead ID LID-042" is more effective than "write an email."',
      'The AI follows Sovern House rules: gross margin by division, FOB pricing, no em dashes in copy.',
      'Use it to sense-check Incoterm choices, payment term risks, or landed cost estimates before a deal.',
    ],
    warnings: [
      'The AI cannot make changes to the ERP unless you have super-admin Dev Mode on. All standard edits must be done in the relevant module.',
      'Always verify AI-generated pricing and compliance advice against current rates and regulations before using it in a live deal.',
      'Conversation history is stored in the ERP database. Do not paste sensitive credentials or personal data into the chat.',
      'Drive search only sees files visible to your connected Google account. If a file is in a different Drive, share it with that account first.',
      'Web search results are public-internet data. Treat them as a starting point, not authoritative compliance or financial sources.',
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

  // ── Google Drive ──────────────────────────────────────────────────────────
  '/drive': {
    title: 'Google Drive',
    summary: 'Browse, open, and download files from your connected Google Drive accounts without leaving the ERP.',
    sections: [
      {
        heading: 'Navigating folders',
        steps: [
          'Select a connected Google account from the account selector at the top.',
          'Click any folder row to open it.',
          'Use the breadcrumb trail to navigate back up. Click any folder name in the trail to jump to that level.',
          'Click the back arrow or the parent folder in the breadcrumb to go up one level.',
        ],
      },
      {
        heading: 'Opening and downloading files',
        items: [
          'Click the external link icon on any file row to open it in Google Drive (new tab).',
          'Click the download icon to download the file directly to your computer.',
          'Google Docs, Sheets, and Slides cannot be downloaded directly — open them in Drive and use File > Download from there.',
        ],
      },
      {
        heading: 'Searching files',
        steps: [
          'Type in the search bar at the top. Results update 500 ms after you stop typing.',
          'Search scans all files in the selected account, not just the current folder.',
          'Click Clear or press Escape to exit search and return to your current folder.',
        ],
      },
      {
        heading: 'Multiple accounts',
        body: 'If more than one Google account is connected, use the account selector to switch between them. Each account shows its own Drive tree. To add an account, go to Settings > Connected Accounts.',
      },
    ],
    tips: [
      'The breadcrumb always shows your full path from root. Use it to orient yourself in deep folder structures.',
      'Search scans the entire Drive for the selected account — useful when you know the filename but not the folder.',
    ],
    warnings: [
      'Opening a file requires an active Google session in your browser for the correct account. If the file does not open, sign in to Google in another tab first.',
      'Google Docs, Sheets, and Slides must be exported from within Google Drive. The download button is only available for non-Google file types.',
    ],
  },

  // ── Inbox / Triage (Phase 4, C17) ─────────────────────────────────────────
  '/crm/inbox': {
    title: 'Email Inbox',
    summary: 'AI-triaged inbound emails from your connected Gmail accounts. Every thread is tagged with the brand of the polling account, and replies are brand-locked so an SH thread cannot accidentally be answered from a FW account.',
    sections: [
      {
        heading: 'Brand-aware threading',
        items: [
          'Every triage card carries a brand badge (SH or FW) showing which Gmail account it arrived on.',
          'The badge is set at sync time from ConnectedGoogleAccount.brandCode; the polling account is the source of truth.',
          'Cross-brand mode (super-admin only): pick All brands in the global brand picker to see SH and FW threads merged into one chronological list. Each card keeps its own brand badge.',
        ],
      },
      {
        heading: 'Replying to a thread',
        items: [
          'Reply opens the composer pre-tagged with the thread brand. The From dropdown only enables accounts whose brand matches; mismatched accounts are visible but disabled so you can see why.',
          'The default From is the seeded account for the thread brand (alex@sovernhouse.co for SH, alexflorway@gmail.com for FW).',
          'Server re-validates on submit: a cross-brand send returns 400 and writes brand_account_mismatch_block to the audit log.',
          'Every successful reply writes a reply_sent audit row with brand, fromAddress, BCC count, and country for forensic replay.',
        ],
      },
      {
        heading: 'Egypt BCC rule',
        items: [
          'For SH threads where the customer/lead country is Egypt, every outgoing email automatically BCCs mohanadfanzey@gmail.com.',
          'FW threads NEVER BCC Fanzey, regardless of country. The rule lives in one helper (applyEgyptBccIfNeeded in emailService.js) so outreach, campaign, and reply paths cannot drift.',
        ],
      },
    ],
    tips: [
      'If you accidentally pick a mismatched account, the modal disables Send and the server rejects it as defense-in-depth.',
      'Cross-brand view is read-only navigation only — clicking a card opens the single-brand context where actions are enabled.',
    ],
  },

  // ── Sanctions / Compliance (Phase 4, C18) ─────────────────────────────────
  '/compliance/sanctions': {
    title: 'Sanctions Screening',
    summary: 'Every Customer and Lead is screened against four public sanctions lists (OFAC SDN, OFAC Consolidated, EU Consolidated, UN SC Consolidated). Flagged entities are blocked at four entry points: Lead create, Customer create, Quotation create, and Outreach send.',
    sections: [
      {
        heading: 'How screening works',
        items: [
          'A daily cron at 03:30 server-time refreshes the four lists from their public sources. A failed download retains the last-known-good cache.',
          'A second daily cron at 04:00 re-screens any active customer whose lastScreenedAt is older than 90 days.',
          'Screening compares company name and country. Exact name + country match = flagged. Fuzzy match (Levenshtein ratio >= 0.85) = requires_review. Country mismatch demotes flagged to requires_review.',
        ],
      },
      {
        heading: 'When a flag fires',
        items: [
          'Lead create: blocked with HTTP 403 + sanctions_block audit. The lead is NOT created.',
          'Customer create: the row is created with isActive=false and screeningStatus=flagged so super-admin can review; transactions are blocked until override.',
          'Quotation create: blocked with HTTP 403 if customer.screeningStatus is flagged. override status bypasses.',
          'Outreach send: per-lead and campaign sends pre-screen if the last screen is older than 7 days. Flagged leads block; the rest of the campaign continues.',
        ],
      },
      {
        heading: 'Super-admin override',
        items: [
          'Open the customer detail page, click Override on the red sanctions badge.',
          'Enter a written reason (minimum 10 characters). The reason becomes the auditable justification.',
          'screeningStatus moves to override; flag details remain on the record for future reference.',
          'Override is logged as sanctions_override with the prior status and hits captured.',
        ],
      },
      {
        heading: 'Manual screening',
        items: [
          'POST /api/compliance/screen — stateless check of a (name, country) pair. No persistence.',
          'POST /api/compliance/screen/:customerId — re-screens a specific customer and writes the result. Audited.',
          'POST /api/compliance/sanctions/refresh — super-admin only. Pulls fresh data from all four sources.',
          'GET /api/compliance/sanctions/status — last refresh timestamp, per-source byte counts, cron-enabled flags.',
        ],
      },
    ],
    tips: [
      'Override is an attestation, not a clear. Future re-screens still flag the entity; the override sticks until manually changed.',
      'A "requires_review" status warns the operator but does NOT block. Treat it as a prompt to investigate before proceeding.',
      'False positives on common names are most likely. Country gating reduces them, but human review is the final check.',
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
