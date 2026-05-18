# trade-odoo-patterns

Sovern House ERP follows Odoo-style entity-detail conventions. This skill codifies the contract every entity detail page must meet. Reference for every detail-page build, audit, or refactor.

Read at the start of any task that touches `pages/<Entity>/<Entity>Detail.jsx`, builds a new detail page, or modifies how an entity surfaces related data.

---

## The five pillars of an Odoo-style entity detail page

Every detail page in the Sovern ERP must implement **all five**. If any is missing, the page is non-compliant.

**Plus a hard rule (CLAUDE.md non-negotiable #8):** every new entity feature must also expose matching MCP write tools in `backend/mcp/erpToolServer.js` so the AI assistant can drive the same workflows from chat. Tools must be super_admin-gated, audit-logged via `auditAiWrite('ai_assistant_*', ...)` (Phase 4.19a invariant enforces this), and the entity must be in the chatter + scheduledActivity whitelists. UI-only is not "done."

**Plus a hard rule (CLAUDE.md non-negotiable #9 — brand context):** any user-facing artifact (PDF, email body, attachment, generated document) must declare its brand context explicitly and the renderer must REFUSE to fall back to a default. Resilient flooring (LVT / SPC / Engineered SPC / WPC / Vinyl Sheet, or anything under the Resilient ProductCategory subtree) is FW (Malaysia origin) OR HH (China origin), NEVER SH. Use `services/priceListBrandResolver.js`-style guards on every renderer + email helper. Brand columns must be loaded via the Sequelize include (forgetting to include `brandCode` / `brandRelationships` is the 2026-05-17 PriceList leak pattern). Build a regression test that locks in the guard for any new renderer.

### 1. Breadcrumb header
Top-of-page navigation crumbs derived from the route + the entity name. Use the existing `useBreadcrumbs` hook + render via `<Breadcrumb />` (registered in the app layout). Example:
```jsx
useBreadcrumbs(customer?.name)
```
The hook reads the route and pushes the entity name. No manual `<Breadcrumb path={...} />` boilerplate per page.

### 2. Smart-button strip (related-data quick stats)
Header row of clickable count chips: "12 Orders", "3 Quotations", "5 Invoices", "1 Claim". Each chip drills into a filtered list pre-scoped to this entity. Pattern: `useState` for each related collection, `Promise.all` to fetch in parallel, render as a row of stat cards at the top.

### 3. Form view (read mode + edit mode)
Field grid showing the entity's data. Default = read mode (`<InfoRow label value />`). "Edit" pencil button toggles edit mode (`<EditableField />`). Per-field inline edit is acceptable for transactional entities; full-modal edit acceptable for entities with many fields.

### 4. Related-data tabs (or sections)
Below the header, tabs to drill into:
- **Many2one fields** (e.g. Product → Factory, Order → Customer): clickable link to the related entity's detail page.
- **One2many fields** (e.g. Customer → Orders, Product → Quotation Lines): embedded list (DataTable) with quick-create button when applicable.
- **Computed aggregations** (Profitability, Order Funnel): inline panel or dedicated tab.

Tabs are managed via local `activeTab` state. Use the existing tab-strip pattern from CustomerDetail.jsx (lines 95+).

### 5. Chatter (mandatory for every transactional entity)
`<ChatterPanel entityType="<Model>" entityId={id} />` mounted near the bottom of the page. Carries: comments, file attachments, activity log, internal notes. No exceptions for transactional entities (Product, Customer, Factory, Lead, Quotation, Order, Invoice, PO, Shipment, Inspection, Claim, GRN, Packing List, Payment, Proforma).

Settings/config pages (User, Role, Template, Brand) are exempt.

---

## Reference implementations (gold standard)

| Page | File | Why it's the reference |
|---|---|---|
| Customer detail | `frontend/admin-portal/src/pages/Customers/CustomerDetail.jsx` | All 5 pillars; brand-context tab strip; profitability panel; sanctions override modal |
| Factory detail | `frontend/admin-portal/src/pages/Factories/FactoryDetail.jsx` | All 5 pillars; product list under Factory; performance widget |
| Quotation detail | `frontend/admin-portal/src/pages/Quotations/QuotationDetail.jsx` | All 5 pillars; line items + revisions + version diff |

When in doubt, model after CustomerDetail.

---

## Known gaps (as of Phase 4.20.1)

These detail pages are missing Chatter and / or related-data tabs. Each needs a compliance pass.

| Page | Breadcrumb | Chatter | Related tabs | Status |
|---|---|---|---|---|
| ProductDetail | ✓ | **✗** | **✗** (no orders / quotations / POs / current price tab) | **Non-compliant** |
| ProformaDetail | ✓ | **✗** | ? | Partial |
| PaymentDetail | ✓ | **✗** | ? | Partial |
| GRNDetail | ✓ | **✗** | ? | Partial |
| PackingListDetail | ✓ | **✗** | ? | Partial |

Document the full audit + remediation plan in a feature directive (see `erp-feature-directive.md`) before starting work.

---

## Smart-button data shape

The smart-button strip needs per-entity related counts. The backend convention is:
- **GET /api/<entity>/<id>/<related>** returns `{ success, data: [...] }`
- Frontend calls these in `Promise.all` on mount and renders counts.

If a related-data endpoint does not exist for the entity-relation pair you need, add it as a thin wrapper around the relevant controller. **Do not** roll a one-off `findAll({ where: { ... } })` inside the detail-page component — that bypasses the brand-scope middleware (L-047) and silently shows the wrong data to multi-brand users.

---

## Quick-create from Many2one pickers (Odoo "lightning-bolt" pattern)

When a form references another entity by Many2one (e.g. "Pick supplier" on Product create), the picker should offer:
1. Search the existing list (default)
2. "+ Create new" inline button that opens a modal for the related entity's create form
3. After save, auto-select the new row in the picker

Today: most BrandPicker / FactoryPicker / CustomerPicker components only do #1. **Adding inline quick-create is a Phase 4.21 priority** (Alex's Odoo direction).

---

## Anti-patterns to avoid

- **Detail page that only loads the entity itself, no related data.** This is the Phase-1 placeholder shape. Every entity has at least one related collection; surface it.
- **Manual breadcrumb props on every page.** Use `useBreadcrumbs(label)` — the hook handles routing.
- **Direct `findAll` in components.** Bypasses brand-scope, brand-relationship filtering, and standard auth. Always use the API surface.
- **Tabs that show a single tab.** If only one tab makes sense, skip the tab strip; render the content directly.
- **Chatter mounted but with no entityId / wrong entityType.** Will write to a phantom thread. Test by adding a comment and verifying it persists across reloads.
- **Per-page custom edit modal that diverges from the rest of the codebase.** Use the shared `<Modal>` + `<FormFields>` components.

---

## Mobile parity (Three-Surface Rule, L-035)

Every desktop detail-page change must ship to mobile in the same commit. Mobile uses Expo Router under `mobile/sovern-ops-app/app/`. For entity-detail pages on mobile:
- Stack-navigate from the corresponding tab list
- Render the same pillars in vertical scroll (no tabs; collapsible sections instead — narrower viewport)
- Chatter renders as `<ChatterMobile entityType entityId />` (mobile component, not the desktop `<ChatterPanel />`)

If a desktop detail page is non-compliant, the mobile counterpart will be too. Fix both.

---

## Verification checklist (run before marking any detail-page work done)

- [ ] `useBreadcrumbs(<entity name>)` called at the top
- [ ] Smart-button strip renders counts from real API responses
- [ ] Edit mode toggles cleanly; save persists; cancel reverts
- [ ] Each related-data tab loads via its own endpoint (no inline `findAll`)
- [ ] `<ChatterPanel entityType entityId />` mounted; test comment persists across reload
- [ ] Mobile equivalent updated in the same commit (or explicit WIP companion task)
- [ ] Brand-scope applies to all related-data queries (audit with a non-super-admin test user if possible)
- [ ] No console errors on empty-data state (e.g. customer with 0 orders)

---

*Last updated: 2026-05-17 — Phase 4.20.1. Codified after Alex flagged Odoo consistency gaps on ProductDetail + the Customer/Client + Factory/Supplier dual-entity model.*
