# Phase 4.21 — Odoo Consistency Pass (Feature Directive)

**Status:** DRAFT — pending Alex approval
**Owner:** Alex (Super Admin) → Claude (executing)
**Skill ref:** `trade-odoo-patterns.md` (the contract this directive enforces)
**Spec template:** `erp-feature-directive.md`

---

## Context

Sovern ERP has followed Odoo-style entity-detail conventions since Phase 1 (chatter, breadcrumbs, brand-aware tabs, related-data fetches). Audit on 2026-05-17 found five detail pages non-compliant with the contract, plus three larger architectural gaps Alex flagged in conversation:
1. Customer + Client Contacts duplication
2. Factory + Supplier Contacts duplication
3. Inventory page exists despite no-stock business model

This directive scopes the remediation into four phases with clear deliverables and minimal blast radius per phase.

---

## Audit results (2026-05-17)

### Compliant — gold standard
- `Customers/CustomerDetail.jsx` — all 5 pillars (breadcrumb, smart buttons, form view, related tabs, chatter)
- `Factories/FactoryDetail.jsx` — all 5 pillars
- `Quotations/QuotationDetail.jsx` — all 5 pillars

### Compliant — minor (have chatter, may lack related-data depth)
- `Invoices/InvoiceDetail.jsx`
- `SalesOrders/OrderDetail.jsx`
- `PurchaseOrders/PurchaseOrderDetail.jsx`
- `Inquiries/InquiryDetail.jsx`
- `Inspections/InspectionDetail.jsx`
- `Claims/ClaimDetail.jsx`
- `Shipments/ShipmentDetail.jsx`

### Non-compliant — missing chatter
- `Products/ProductDetail.jsx` — **also missing related-data tabs**
- `ProformaInvoices/ProformaDetail.jsx`
- `Payments/PaymentDetail.jsx`
- `GRN/GRNDetail.jsx`
- `PackingLists/PackingListDetail.jsx`

---

## Phases

### Phase 4.21a — Chatter parity sweep (smallest scope, fastest win)

**Goal:** Mount `<ChatterPanel entityType={...} entityId={id} />` on the four non-compliant transactional pages.

**Files:**
- `frontend/admin-portal/src/pages/ProformaInvoices/ProformaDetail.jsx` (entityType="ProformaInvoice")
- `frontend/admin-portal/src/pages/Payments/PaymentDetail.jsx` (entityType="Payment")
- `frontend/admin-portal/src/pages/GRN/GRNDetail.jsx` (entityType="GRN")
- `frontend/admin-portal/src/pages/PackingLists/PackingListDetail.jsx` (entityType="PackingList")

**Mobile parity:** if these have mobile detail screens, mirror the addition. Audit before commit.

**Estimated diff:** ~25 lines total. Half a working session.

**Acceptance:** Open each page; post a comment; verify it persists across reload. CI green.

### Phase 4.21b — ProductDetail full Odoo upgrade

**Goal:** Bring ProductDetail to CustomerDetail-level compliance.

**Frontend (`Products/ProductDetail.jsx`):**
1. Smart-button strip: counts for related Quotations, Sales Orders, Purchase Orders, Inquiries that reference this product.
2. Related-data tabs: Overview (current), Quotations, Sales orders, Purchase orders, Price history (already exists as panel — promote to tab), Specifications (already a section — promote to tab).
3. Chatter at bottom.

**Backend (new endpoints, additive):**
- `GET /api/products/:id/quotations` — Quotation rows whose line items reference this product
- `GET /api/products/:id/sales-orders`
- `GET /api/products/:id/purchase-orders`
- `GET /api/products/:id/inquiries`

Each thin wrapper around existing controllers + brand-scoped via `brandWhere`. No new DB schema.

**Mobile parity:** `mobile/sovern-ops-app/app/product/[id].tsx` mirror.

**Estimated diff:** ~600 lines (300 frontend + 200 backend + 100 mobile). Full session.

**Acceptance:** Open IronLite SKU; smart buttons show real counts; tabs load; chatter works.

### Phase 4.22 — Inline quick-create for Many2one pickers

**Goal:** Odoo "lightning-bolt" pattern on all pickers.

**Files:**
- `frontend/admin-portal/src/components/BrandPicker.jsx`
- `frontend/admin-portal/src/components/FactoryPicker.jsx` (if exists; check)
- `frontend/admin-portal/src/components/CustomerPicker.jsx` (if exists; check)
- `frontend/admin-portal/src/components/SelectField` (generic), or a new `<Many2onePicker>` wrapper

**Behavior:** Search dropdown + "+ Create new" footer item that opens the related entity's create modal. On save, the new row is auto-selected.

**Estimated diff:** ~400 lines. Half-day to full day.

**Acceptance:** From a Product create form, click "+ Add factory", new factory modal opens, save → newly created factory is selected.

### Phase 4.23 — Customer/Factory unification (NEW SPEC required)

**Goal:** Replace the four-page Customer/Factory/ClientContact/SupplierContact split with two unified entities:
- **Client** = company + embedded multi-contact card
- **Supplier** = company + embedded multi-contact card

**This is a major data + UI refactor.** Out of scope for this directive — needs its own full feature directive covering:
- Data model migration (Contact merges into Customer/Factory as a One2many child)
- API surface changes (deprecation path for `/api/contacts`)
- UI rewrite (single detail page replaces two list pages)
- Mobile parity
- Whitelabel impact

Track this in `phase4_23-entity-unification.md` (TBD). Confirm scope with Alex before any code.

### Phase 4.24 — Inventory page disposition

**Goal:** Resolve the "no-stock business but Inventory page exists" tension.

**Options for Alex:**
1. **Remove entirely** — delete the route, the page, the nav entry. Simplest.
2. **Repurpose as "In-transit / On-order"** — show open PurchaseOrders that haven't been GRN'd yet (i.e. goods bought but not yet received/handed to customer). Useful for a forwarder business model.
3. **Keep for future** — if Sovern House might hold buffer stock one day.

Awaiting Alex's call.

---

## Order of execution (recommended)

1. **4.21a (Chatter sweep)** — fast, low-risk, full Three-Surface compliance for 4 pages.
2. **4.24 (Inventory disposition)** — needs Alex's decision; can run in parallel with 4.21b.
3. **4.21b (ProductDetail upgrade)** — biggest UX win for Alex's current workflow.
4. **4.22 (Quick-create pattern)** — quality-of-life improvement across all forms.
5. **4.23 (Entity unification)** — major refactor, do last when other Odoo pieces are stable.

Estimated total: 2-3 working sessions for 4.21a + 4.21b + 4.22 + 4.24. Phase 4.23 is separate and likely a multi-day effort.

---

## Out of scope for this directive

- Migrating away from Express/Sequelize toward an actual Odoo deployment (not happening).
- Rebuilding the chatter component (it works; just needs to be mounted in more places).
- Mobile-specific Odoo patterns (the contract applies, but mobile-only innovation isn't in scope).
- Whitelabel implications (each phase is brand-neutral; whitelabel review happens at directive sign-off).

---

## Approval gate

Before writing any code for Phases 4.21a–4.22:
- [ ] Alex confirms the audit results match his mental model
- [ ] Alex picks the order of execution (default order above, or different)
- [ ] Alex confirms Phase 4.24 disposition for Inventory (remove / repurpose / keep)
- [ ] Phase 4.23 spec written separately and approved before any code touches the Customer/Factory unification

Once approved, each phase ships as its own commit + PR style description in the commit body.
