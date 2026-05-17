# SESSION.md — Current Work State

> Maintained at end of every session so a fresh Claude Code instance can pick up without losing context. Read this first.

---

## Last Updated — 2026-05-17 Taiwan time (late evening, Phase 4.23 wrap)

**Picking up next:**
1. **Mobile embedded contacts** — ContactsSection equivalent for the mobile CustomerDetailModal + FactoryDetailModal. Task #30 carry-over; ~200 line component + wire-up.
2. **Phase 4.22 quick-create extension** to LeadForm, InquiryForm, DealForm, PurchaseOrderForm (the pattern is established in ProductForm + QuotationForm; just apply same modal+button).
3. **Phase 4.19c** — service-layer convergence for Product / ProductPrice / ProductSpec.
4. 2026-05-16 14:42 bulk Factory soft-delete root cause investigation still open.
5. EU sanctions URL webgate alert check-in cron-scheduled for 2026-05-18 09:37 TPE.

**Latest:** Phase 4.23 — Client/Supplier unification with embedded contacts (commit `8031aa8`). Plus product row-click → ProductDetail fix.

- **ContactsSection** new reusable component (`frontend/admin-portal/src/components/ContactsSection.jsx`) — inline CRUD card list with primary-flag, edit, delete. Mounted on CustomerDetail (new tab between Overview and Orders) and FactoryDetail (replaced legacy tab that routed out to /crm/contacts/*).
- **contactsAPI** added to services/api.js — wraps existing /api/contacts surface; the contactController already supports customerId / factoryId filters, no new backend needed.
- **UI relabel** Customer → Client / Factory → Supplier across nav, page titles, mobile tabs. Routes (/customers, /factories), DB tables (Customer, Factory), and API endpoints unchanged.
- **Removed nav entries:** Supplier Contacts (/crm/contacts) and Client Contacts (/client-contacts). Routes still resolve for backward compat / legacy deep links.
- **Product row click fix** — DataTable accepts new `onRowClick` prop. ProductList row → /products/:id (full detail). ProductCatalog row → /products/:id. Edit pencil now goes to /products/:id/edit explicitly. Bug Alex reported: clicking product on Products page didn't open detail with chatter/related tabs.

**Previous:** Phase 4.21 + 4.22 + 4.24 — Odoo consistency pass. After the 4.20 IronLite cluster shipped, post-deploy verification surfaced another wave of issues (Intelligence tab 500s, taxonomy not recursive, multi-brand users silently scoped to SH-only). Fixed those (4.20.1), then drafted `docs/phase4_21-odoo-consistency-pass.md` directive + added `trade-odoo-patterns.md` skill to codify the entity-detail contract. Executed 4.21a (chatter sweep), 4.24 (Inventory removal), 4.21b (ProductDetail full upgrade), 4.22 (Many2one quick-create). 7 commits, 3 EAS Updates.

- **4.20.1 L-047 fix** — Sequelize returns `User.accessibleBrands` as a stringified JSON array on SQLite, not a parsed array. `brandScope` middleware's `Array.isArray` check was false → fallback to `['SH']` → every multi-brand user (incl. alex@sovernhouse.co) silently scoped to single-brand. Patched parse-on-read in `backend/middleware/brandScope.js` AND `backend/mcp/erpToolServer.js brandScopeForMcp`. Verified alex now resolves `['SH','FW']`.
- **4.20.1 Recursive taxonomy** — `productCategoryController.getCategoryTree` only attached direct children to roots; grandchildren (Resilient → Engineered SPC) were unreachable. Rewrote as recursive `buildNode`. Desktop `ProductTaxonomy.jsx SubCategoryRow` made recursive with progressive indent. Mobile `app/product-taxonomy.tsx` rewritten with unified `CategoryNode` component.
- **4.20.1 Intelligence tab fixes** — `/api/analytics/shipment-timeline` 500 fixed (null `row.status` guard). `/api/reports/customer` 404 fixed: added `GET /api/reports/customers` (plural, list aggregate); `getCustomerReport` API client now points at it.
- **4.21 directive** — `docs/phase4_21-odoo-consistency-pass.md` + new `trade-odoo-patterns.md` skill (separate repo SovernHouse/instructions-skills). Skill codifies the 5 pillars: breadcrumb, smart-button strip, form view, related tabs, chatter at bottom.
- **4.21a chatter sweep** — ChatterPanel mounted on PaymentDetail / ProformaDetail / GRNDetail / PackingListDetail. Backend chatterController + scheduledActivityController whitelists extended with 'Product', 'GRN', 'PackingList'.
- **4.21b ProductDetail full upgrade** — Backend: 4 new `GET /api/products/:id/{quotations,sales-orders,purchase-orders,inquiries}` endpoints, brand-scoped on the parent via `brandWhere`, deduplicated by parent id. Desktop: ProductDetail.jsx rewritten with smart-button strip (5 chips) + 7 tabs (Overview / Specifications / Pricing / Quotations / Sales Orders / POs / Inquiries) + Chatter at bottom. Mobile: ProductDetailModal extended with smart-button count chips + ChatterSection.
- **4.22 Many2one quick-create** — Two new modals: `FactoryQuickCreate` + `CustomerQuickCreate`. Applied to ProductForm (Settings/ProductCatalog) and QuotationForm. "+ New" button next to picker → modal → save → auto-select. Follow-up: apply to LeadForm, InquiryForm, DealForm, PurchaseOrderForm.
- **4.24 Inventory page removed** — Sovern House holds no inventory. Deleted `/inventory` route + InventoryList.jsx + InventoryAdjustment.jsx + 9 nav entries from rbacConfig.js + inventoryAPI from services/api.js. Kept `/reports/inventory` (historical aggregate; separate concern).

**Phase 4.20 (earlier same day):** Phase 4.20 — IronLite visibility bug cluster fixed. Yesterday's IronLite shipping work landed 9 SKUs + 2 factories on prod but every UI surface for them was broken. Five sub-fixes in one wave:

- **4.20 Bug 1A** — `BrandFilterPicker` only offered "All Brands" when super_admin opted into cross-brand viewMode via URL. Relaxed: any user with 2+ accessible brands sees the option (backend `brandWhere` still scopes to `accessibleBrands` on `?brandCode=all`, so non-super-admin multi-brand users are safe). `ProductCatalog.jsx` + mobile `products.tsx` now default super_admin's `brandFilter` to `'all'` so the catalog opens aggregated, not single-brand-locked.
- **4.20 Bug 1B** — IronLite SKUs were created with `productType='other'` because the MCP enum didn't include `engineered_spc`. Added `engineered_spc` to the Product model ENUM, MCP create+update enum coercion, both MCP schema descriptions, desktop+mobile FLOORING_PRODUCT_TYPES filter arrays, and the desktop catalog dropdown. Direct prod UPDATE retagged the 9 IL-* SKUs from `product_type='other'` → `'engineered_spc'`.
- **4.20 Bug 2** — Both HanHua + FlorWay factories were soft-deleted yesterday 2026-05-16 14:42 UTC as part of an unexplained bulk-delete of 5 factories. Restored both via direct DB `UPDATE Factory SET deleted_at=NULL` (the other 3 in the wave look like accidental duplicates of an older 2026-05-07 wave-1 delete; left deleted). Backup at `data/erp.db.pre-4_20-bug2-factory-restore.backup`.
- **4.20 Bug 3** — `/products/categories` rendered a hardcoded stub component with 3 fake categories (Laminate Flooring / Vinyl Flooring / Hardwood). Real taxonomy lives at `/settings/product-taxonomy`. Deleted the stub, redirected the route, repointed Procurement nav entry. **Mobile parity gap closed:** new `mobile/sovern-ops-app/app/product-taxonomy.tsx` (~380 lines, core CRUD + archive + show-archived toggle) mirrors the desktop taxonomy UI; linked from Settings tab. Skipped vs desktop: drag reorder (uses up/down N/A — read-only sort), seed-defaults (desktop only), JSON import/export (heavy on mobile).
- **4.20 Bug 4a** — `BrandPicker` on the Product edit form was visually present but `disabled={isEdit}`, so clicks did nothing. Added `'Product'` to `OVERRIDABLE_ENTITY_TYPES` in `brandRoutes.js` and surfaced a super_admin-only "Change brand…" button on the edit form that opens a `BrandOverrideModal` (new brand picker + reason textarea, posts to `/admin/brand-override`, audit-logged).
- **4.20 Bug 4b** — Resilient flooring subtree now defaults `brand_code='FW'` on product create. Added `ProductCategory.default_brand` nullable column + `migrate420ProductCategoryDefaultBrand.js` (sentinel-guarded ALTER + seed 'FW' on slugs `resilient/lvt/spc/engineered-spc/wpc/vinyl-sheet`). `ProductCatalog.jsx` prefills `form.brandCode` on category change for new products. MCP `create_product` falls back to `category.defaultBrand` when no `brandCode` is passed. Both paths are still overridable.

Test status: 46 product/MCP/audit-invariant/orphan-FK suite passes after the changes (phase417, phase418, phase419a, phase419b, mcpSmoke, mcpControllerConvergence). Wider 626-suite verification expected via CI on push.

**Previous:** Phase 4.19 — guardrails + emergency hotfix. Mid-session "failed to load products" alarm: `productController.getAll` included `ProductPrice.sellingPrice` but Phase 4.9.2b renamed that column to `sellingPriceUsdPerM2` long ago. Audit found 5 more stale `sellingPrice` references (factory price update, quote builder, logistics PDF, MCP create_product response in 2 spots) — all silently wrong since the rename. Patched all 6 in one commit. Then shipped **4.19a** (audit invariant test that walks every MCP `case` block, finds DB writes, requires a matching `auditAiWrite` — caught 4 real gaps which got fixed: add_lead_activity, log_activity, update_triage_item, send_outreach_email) and **4.19b** (orphan-FK detector that scans `sqlite_master` for `REFERENCES …_orphan_…`; pins L-052 from Phase 4.16.4). Suite 626/626 green.

2026-05-16 Taiwan time (earlier). Phase 4.18 — add missing `ai_assistant_create_product` AuditLog write. The 9 IronLite SKUs created 2026-05-16 had zero corresponding audit rows even though sibling `create_product_spec` (9) and `create_product_price` (18) audited correctly. Added `auditAiWrite('create_product', 'Product', product.id, {...key fields...}, USER_ID)` in the MCP handler after the row succeeds. Convergence test runs the handler in-process (new `__testing.callTool` shim) and asserts the audit row lands. Forward-only; existing 9 rows intact, no backfill. Suite 622/622 green.

**Session arc (deployed unless noted):**

| Commit | Phase | What |
|---|---|---|
| `8031aa8` | 4.23 | Client/Supplier unification: ContactsSection embedded on CustomerDetail + FactoryDetail. UI relabel everywhere. Redundant contact nav removed. Product row-click → ProductDetail fix bundled. |
| `61c2f9b` | 4.22 | Many2one inline quick-create (FactoryQuickCreate + CustomerQuickCreate modals). Wired into ProductForm + QuotationForm. Follow-up: extend to Lead/Inquiry/Deal/PO forms. |
| `586c3c7` | 4.21b | ProductDetail full Odoo upgrade: 4 new /api/products/:id/* endpoints + desktop smart-button strip + 7 tabs + Chatter + mobile mirror with count chips. |
| `02fe8d6` | 4.21a + 4.24 | Chatter sweep (Payment/Proforma/GRN/PackingList) + Inventory page removed entirely. Backend whitelist extended with Product/GRN/PackingList. |
| `dd5b634` | docs (skills repo) | New `trade-odoo-patterns.md` skill + routing entry. |
| `8902077` | docs | `docs/phase4_21-odoo-consistency-pass.md` feature directive + CLAUDE.md routing for trade-odoo-patterns. |
| `7892610` | 4.20.1 | L-047 brand-scope parse-on-read fix + recursive category tree (backend + desktop + mobile) + shipment-timeline 500 fix + /reports/customers list endpoint. |
| `2d35c7e` | 4.20 | IronLite visibility cluster (engineered_spc enum, BrandFilterPicker All-Brands, super_admin defaults to 'all', factory restore data fix, stub Categories page deleted, ChangeBrandModal for product edit, defaultBrand on ProductCategory). |
| `b06d6f7` | 4.17 sweep | Drop no-op `ProductPrice.isActive` update + fix misleading status text in `create_product` response. CI in progress. |
| `8ee420b` | 4.17 follow-up | Orphan-FK audit on prod found ProductAttribute had the same broken FK as Product — rebuilt the table (0 rows). Dropped inline `references` from the model per L-034. Patched `migrate415c1ProductCubicMeters.js` plural-vs-singular table name. Wrote retroactive sentinel so the migration stops looping on every boot. |
| `821dd19` | 4.17 | Product approval modal + 3 endpoints (`/approve`, `/reject`, `/request-revision`) + handler-noise gate. Activity pills for `entityType='Product'+type='approve'` now open a full-detail modal with the 3 actions instead of routing nowhere. `create_product` skips the approval activity when `active:true` was passed. Cleared 9 stale IronLite chips on prod via direct UPDATE. 12 new endpoint tests. |
| `baa018f` | 4.16.3 | Widened `create_product` MCP inputSchema from ~12 to ~25 fields. Handler now writes `base_fob_price`, `lead_time_days`, `origin_country`, `origin_variants`, `cubic_meters`, `certifications_list` to the row. Unblocked IronLite Turn 1 with a single tool call per product. |
| `a5d2033` | 4.16.2 | `claude -p` now invoked with `--output-format stream-json --verbose`. Each tool call / model text chunk emits a JSON event → the Phase 4.16 heartbeat watchdog finally gets a real signal. SSE `onProgress` forwards real assistant text chunks to the browser (not raw bytes). |
| `50ebf87` | 4.16.1 | `IDLE_TIMEOUT_MS` 30s → 120s. Single MCP tool calls (xlsx parse + multi-row DB writes) routinely silence stdout 30–60s — was killing legitimate turns. |
| `445f1d6` | 4.16 | SSE streaming chat + heartbeat-based subprocess liveness. Replaces flat 240s kill + 150s Express middleware. Bulk turns now have unlimited wall-clock as long as the subprocess emits progress. SSE branch on `/api/ai/chat` for streaming clients; JSON-buffer branch for mobile + offline replay. |
| `ff68428` | 4.13.6 | Sanctions URL repair (OFAC SLS canonical paths, `cons_prim.csv` → `consolidated.csv`, EU `==` padding dropped) + UA header added (root cause of 403s was Node's default UA) + failure-streak alert (Notification + email at 3+ consecutive failures) + weekly Monday URL-probe CI workflow. |
| `6f1d22b` | 4.15 docs | DEVELOPER_GUIDE + tooltipContent + helpContent for Phase 4.15b-2 + 4.15c-1/2/3. |
| `4668020` | 4.15 wrap | Container (5) + Inspection (9) + Sample (6) + LC (7) MCP tools + 4 services. **Phase 4.15 complete** (~70 tools across the sprint). |

**Direct prod-DB fixes this session (no commit, applied via `vm_exec`):**
- `4.20 Bug 2` — `UPDATE Factory SET deleted_at=NULL WHERE id IN (HanHua, FlorWay)`. Backup at `erp.db.pre-4_20-bug2-factory-restore.backup`.
- `4.20 Bug 1B` — `UPDATE Product SET product_type='engineered_spc' WHERE sku LIKE 'IL-%' AND deleted_at IS NULL` (9 rows). Forward-only retag; the engineered_spc enum value lands in code via Phase 4.20 deploy.

**Direct prod-DB fixes prior session (no commit, applied via `vm_exec`):**
- `4.16.4` — Rebuilt `Product` table to drop the broken `REFERENCES ProductCategory_orphan_20260515` FK. 4 rows preserved. Backup at `erp.db.pre-4_16_4-fk-rebuild.backup`.
- `4.17 fu` — Rebuilt `ProductAttribute` table to drop the same orphan FK. 0 rows. Backup at `erp.db.pre-4_17fu-fk-rebuild.backup`. Wrote retroactive Phase 4.15c-1 sentinel.
- Cleared 9 stale IronLite ScheduledActivity rows (Product, type='approve', status='pending') after the products were activated by IronLite Turn 1.

**Orphan-FK audit:** `sqlite_master WHERE sql LIKE '%_orphan_%' AND name NOT LIKE '%_orphan_%'` returns 0 tables.

---

## CI Status

- **Latest deployed commit:** `8ee420b` (Phase 4.17 follow-up). Phase 4.20 is staged locally, pending Alex's push.
- **Backend health:** live at `https://erp.sovernhouse.co/api`. Boot-time migration sentinel chain will extend to `phase4_20_product_category_default_brand` on next restart.
- **Tests:** Phase 4.20 verified against 6 representative suites (phase417/418/419a/419b/mcpSmoke/mcpControllerConvergence = 46 passes). Full 626-suite green expected via CI on push.
- **Mobile parity:** new `app/product-taxonomy.tsx` screen closes the pre-existing taxonomy parity gap. Linked from Settings tab → "Product Taxonomy". OTA-deliverable (no EAS rebuild needed — pure JS).
- **Frontend:** Vercel auto-deploys on push. Phase 4.20 adds `BrandOverrideModal` (inline in `ProductCatalog.jsx`) + removes `pages/Products/ProductCategories.jsx`. Verify post-deploy: (1) Settings → Products opens with All Brands selected for super_admin; (2) Procurement → Product Categories now redirects to `/settings/product-taxonomy`; (3) Edit product → "Change brand…" opens override modal.

---

## Bugs from 2026-05-16 — ALL FIXED in Phase 4.20 (see Latest above)

Original report retained below for context.



All four spotted in a quick UI walkthrough after the Phase 4.19 deploy.
Triage notes below — every DB-level fact was confirmed earlier via direct
`vm_exec` queries, so issues 1–3 are very likely UI brand-scope filter
problems, not missing data. Issue 4 is a known incomplete feature plus a
new policy ask.

### Bug 1 — IronLite products not visible in the catalog

**State on prod (verified):** 9 active Products with SKU prefix `IL-`,
`brand_code='FW'`, all `is_active=1`. Each has 2 ProductPrice rows
(China + Malaysia, validFrom=2026-05-14, validTo=+15 days) and 1
ProductSpecification. Container loading optimizer + landed-cost work
against them today.

**Likely cause:** the admin portal's brand-scope filter is set to SH-only
in Alex's session. `productController.getAll` uses `brandWhere(req)` which
pulls from the user's `accessibleBrands` + the `?brandCode=` query
override. If Alex is in single-brand mode with default SH, FW rows don't
appear. Switching the topbar brand selector to FW (or cross-brand mode)
should make them visible.

**To diagnose tomorrow:**
1. Confirm what `req.user.accessibleBrands` returns for `alex@sovernhouse.co`
   on prod (should be `['SH', 'FW']` per the Phase 4 migration log).
2. Confirm the topbar brand switcher state in the browser (likely set to
   SH by default and never moved).
3. If the user IS set to cross-brand but the UI still filters: bug in
   `brandWhere` or the topbar binding.

### Bug 2 — HH/FW factories not visible

**State on prod (verified):**
- Anhui HanHua Building Materials Technology Co., Ltd. (id
  `6b1b3926-a3a7-4744-b7d6-acb7432f9935`) — `brandCode='FW'`, active
- FlorWay SDN. BHD. (id `4f1cb036-856c-40ab-93ec-fc0ecad34f25`) —
  `brandCode='FW'`, active

**Likely cause:** same brand-scope filter as Bug 1. Factory list is
brand-scoped per `brandScope` middleware. HH brand itself is `active=false`
(per "Brands on prod" note above), so factories assigned to HH would not
appear under HH context — but neither factory IS under HH; they're both FW.

**Note:** Alex wrote "HH or FW factories"; HH brand is inactive by design
(it was the original supplier brand, deprecated when FW absorbed the
HanHua relationship). If Alex expects HH factories to show, that's a
deeper question about whether HH should be re-enabled or whether the
expectation should be "HanHua the *factory* under FW the *brand*".

### Bug 3 — "Engineered SPC" product category not visible

**State on prod (verified):** ProductCategory id
`2e25e192-cb38-4ba8-8a65-6b31935c8931`, name 'Engineered SPC', parent
Resilient (which is under Flooring root). 9 IronLite Products attached.
sortOrder=3.

**Likely cause:**
(a) Same brand-scope filter as Bugs 1–2 if the taxonomy tree filters by
    brand of attached products
(b) OR the taxonomy UI hides nodes whose subtree is empty in the current
    brand scope — Engineered SPC has only FW Products under it, so if
    Alex is in SH scope it'd render as empty/hidden
(c) OR a real bug: the category tree controller has a different code path
    than the product list, and may not honour brand scope correctly

**To diagnose tomorrow:** check `categoryController.getCategoryTree` and
`getCategoriesFlat` for brand-scope handling. Cross-reference against the
Resilient → Engineered SPC chain at sortOrder 2 → 3 (Resilient sortOrder=2
per the existing taxonomy snapshot).

### Bug 4 — ProductForm Brand picker doesn't work + default-brand policy missing

Two sub-bugs in one report:

**4a — Brand picker is non-functional in the product edit form.**
This is a known Phase-1 polish gap (carry-over from the previous session,
not new): "BrandPicker in create forms — LeadForm, QuotationForm,
DealForm. Users can brand-override an existing entity via
`/admin/brand-override` (audit-logged) but the create form doesn't have a
picker yet." Apparently the edit form has the visible UI element but
clicking doesn't trigger the override flow. Need to wire it to the
existing override endpoint OR add an inline brand-update path to
`update_product` (Phase 4.9.3a typed accept brand_code already; the
backend supports it).

**4b — New policy: resilient flooring categories should default to FW.**
LVT, SPC, WPC, Engineered SPC, Vinyl Sheet — all the children of the
Resilient subtree under Flooring should default `brand_code='FW'` on
product create, rather than requiring an explicit selection. The
rationale: FW (FlorWay) owns the resilient flooring catalog by design;
SH is the parent trading brand for everything else (auto parts, garments,
commodities, etc.).

**Where to implement 4b:**
- `ProductForm.jsx` on category change: if the picked category is under
  the Resilient subtree (need a `parentChain` check or a flag on the
  category), pre-fill `brand_code` to 'FW' (still overridable).
- `create_product` MCP handler: same default rule applied server-side so
  AI-driven creates respect the policy without the AI having to remember.
- Possibly add a `defaultBrand` column to `ProductCategory` (with FW for
  the Resilient subtree, NULL for others = inherit user default) so the
  rule lives in data instead of code. Cleanest long-term path; ~30 min
  of migration + form wire-up.

---

## Carry-over (still open)

### Synthetic test product still on dashboard
SKU `TEST-APPROVAL-1778942054`, product id `fa0e16a2-dde2-4c9f-820b-084952bd2e27`,
activity id `a67a1cca-7922-42c9-8de6-d485b22742b9`. Pending approval chip in
the banner. Use it to test the Phase 4.17 ProductApprovalModal end-to-end
when you pick up tomorrow. Approve / reject / request-revision — any
action closes the activity. Safe to delete the product itself after.

### Phase 4.19c — Service-layer convergence for Product / ProductPrice / ProductSpec

Highest-leverage item from the post-IronLite risk plan. Extract the
direct `getDb().Product.create(...)` paths in `case 'create_product'`,
`case 'update_product'`, `case 'archive_product'`, `case 'approve_product'`
into `backend/services/aiWriteServices/productWriteService.js`. Same
pattern as Phase 4.12 (Lead, Quotation, Factory, Contact). Then do
ProductPrice + ProductSpec the same way. Eliminates the cluster of bugs
that surfaced this session:
  - Phase 4.17 misleading status text (would be one place to fix, not N
    case blocks)
  - Phase 4.18 missing audit (audit-on-create would be a service contract)
  - Phase 4.19 sellingPrice fan-out (model field references would be in
    a single typed service, not scattered across controllers + MCP +
    PDF generators)

Estimated half-day focused work. Worth blocking time for.

### #18 — Prod verification step 3 (closed)
Verified earlier this session against AuditLog (115 leads rescreened,
Iran lead preserved, sentinel rows present for 4.13a + 4.13b). Marked
complete in the task list.

### EU sanctions URL — webgate upstream still 500
After the 4.16+4.17 wave settled, query AuditLog for `ai_assistant_*` rows to confirm the new MCP tools (~20 from the 4.15 wave + the 6 from 4.15c-3 + the 5 from 4.15b-2) are writing audit rows correctly in prod usage. Spot-check:
```
SELECT action, COUNT(*) AS n, MAX(created_at) AS last_seen
FROM AuditLog
WHERE action LIKE 'ai_assistant_%' AND created_at > date('now', '-1 day')
GROUP BY action ORDER BY n DESC;
```

### EU sanctions URL — webgate upstream still 500
The Phase 4.13.6 failure-streak alert will trip at the 3-day mark if webgate doesn't recover. First failure 2026-05-15; alert fires on or after the 2026-05-18 daily refresh run. **Scheduled in-session check-in** at `2026-05-18 09:37 TPE` (cron job `97e3fbfc`) to verify whether the alert fired and propose the OpenSanctions / data.europa.eu mirror swap if webgate is still down.

### Three-Surface Rule audit pending for Phase 4.17
The new approval modal is desktop-only. Mobile chat surface currently has no equivalent action — clicking a Product-typed approval activity on mobile does nothing useful. Not blocking (the AI assistant can call the new endpoints directly via REST through `aiAPI` from chat), but worth a small mobile-screen approval view in a future phase.

### SESSION.md compaction passed (2026-05-16)
Previous file was 1217 lines of per-phase detail. Now ~150 lines focused on recent + open work; full per-phase history lives in `git log` + commit messages.

---

## Open business carry-over (preserved from prior compaction)

- **Brands on prod:** SH active commission=0%, FW active commission=7% (HanHua Sales Rep Agreement), HH inactive.
- **Taxonomy on prod:** Flooring → Resilient → SPC/WPC/Engineered SPC/LVT/Vinyl Sheet (Resilient sortOrder=2, EngSPC=3, LVT=4, Vinyl Sheet=5). Engineered Wood + remaining flooring rows direct children of Flooring. IronCore Flooring + WPC Hybrid Flooring archived. Orphan `ProductCategory` (singular) renamed to `ProductCategory_orphan_20260515`; 18 rows preserved (~30 day retention; safe to DROP after 2026-06-15).
- **Factories on prod:** Anhui HanHua + FlorWay SDN. BHD. both `brandCode='FW'`.
- **IronLite SKUs on prod:** 9 active `IL-180x1220-{6.5..12.0}mm` products under FW brand, all category=Engineered SPC, primary factory=HanHua, origin_variants=[China, Malaysia], lead_time=30 days. 18 ProductPrice rows (2 per SKU, China + Malaysia FOB from xlsx dated 2026-05-14, validTo=+15 days). 9 ProductSpecification rows.
- **Phase 4.13d still open:** JurisdictionRule DB table + admin CRUD + full OFAC/EU/UK/UN authority matrix + Customer/Quotation parameterization + mobile UI for jurisdiction warnings (L-035). Not blocking; Phase 4.13c override route + 4.13a comprehensive jurisdictions cover the immediate need.
- **Phase 4.14.1 follow-up — Cowork sovern-mcp-server parsers**: shipped local-only at `C:\Users\Alex\Desktop\International Trade Company\sovern-mcp-server\` (initial commit `3ac9b0a` on local-only `main`). Repo has no remote. Restart Cowork app after build to load the new dist.
- **VM kernel restart pending:** `*** System restart required ***` on last VM login. Schedule a reboot when convenient. pm2 restarts cleanly.

---

## Deploy Process

Fully automated via GitHub Actions. After every push to `main`:
1. CI runs tests (auto)
2. Deploy workflow builds frontend on runner, SCPs dist to VM, restarts backend (auto)
3. Health check passes → green deploy

**Manual emergency restart:** `vm_exec: pm2 restart sovern-erp`

---

## Infrastructure Notes

- **ERP server:** GCP VM `sovern-erp`, project `local-iterator-495008-e6`, zone `us-central1-f`
- **DB:** SQLite at `/home/alex/sovern-erp/data/erp.db` (WAL mode, 64MB cache, foreign_keys=ON)
- **Git repo:** `github.com/SovernHouse/sovern-erp` (public — never commit keys/credentials)
- **Admin login:** `alex@sovernhouse.co` (`.co` not `.ca`)
- **Mobile app:** `mobile/sovern-ops-app/` — Three-Surface Rule: every desktop feature ships to mobile same commit (or explicit deferral with companion task)
- **VM SSH (MCP):** Two keys in VM `~/.ssh/authorized_keys` — `sovern-mcp@claude` (Windows Cowork) + `alex-mac@sovern-erp` (Mac)
- **Claude `-p` invocation rules (Phase 4.16.2):** `--system-prompt`, `--strict-mcp-config`, `--permission-mode bypassPermissions`, `--output-format stream-json --verbose`, user prompt via stdin. Constants in `aiController.js`: `IDLE_TIMEOUT_MS=120_000`, `IDLE_CHECK_INTERVAL_MS=5_000`, `HARD_CAP_MS=900_000`, `SIGTERM_TO_SIGKILL_MS=3_000`. Express middleware on `/api/ai/chat` matches at 900_000ms.
- **Sanctions sources:** OFAC SLS `PublicationPreview/exports/SDN.CSV` + `consolidated.csv`, EU webgate `csvFullSanctionsList_1_1`, UN `scsanctions.un.org/.../consolidated.xml`. UA header sent on download. Streak alert at 3+ consecutive failures (Notification + email).

---

## Lessons captured this session

See `International Trade Company/Instructions & Skills/lessons.md` for full text.

- **L-048** — pdf-parse 1.1.4 on Node 22 throws "bad XRef entry"; wrap `Buffer` as `new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)`.
- **L-049** — SheetJS `sheet_to_csv` silently ignores its `range` option. Walk cells manually.
- **L-050** — Two callers applying the same one-line bugfix → extract a shared helper before the third caller forgets.
- **L-051** — Sequelize silently drops unknown attributes on `Model.create()`. "Expected X, Received 0" on a numeric round-trip = check the model column exists.
- **Architectural pattern surfaced (no L-number yet, candidate L-052):** orphan-FK rot. SQLite `REFERENCES` inline on Sequelize models pin a specific table name; archive/rename migrations on the parent don't update the FK target. With `foreign_keys=ON` this breaks every INSERT silently. Audit pattern: `SELECT name FROM sqlite_master WHERE sql LIKE '%_orphan_%' AND name NOT LIKE '%_orphan_%'`.
