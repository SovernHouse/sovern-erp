# SESSION.md — Current Work State

> This file is maintained by Cowork at the end of every session so Claude Code can pick up without losing context. Read this at the start of every session before doing anything else.

---

## Last Updated
2026-05-14 Taiwan time. Phase 4 in progress. C14 + C15 + C16 + C17 shipped + live. C18 (sanctions screening) is the only remaining commit.

---

## CI Status
- **Latest commit on main:** `ac4ff75` (feat(phase-4): inbox brand awareness + Egypt BCC single source of truth (C17))
- **Working tree:** clean
- **CI/CD Pipeline (ac4ff75):** green
- **Deploy (ac4ff75):** green
- **Backend health:** live at `https://erp.sovernhouse.co/api`
- **C17 migration verified:** `[C17] ConnectedGoogleAccount backfill: 2 tagged, 0 orphan` in pm2 logs

---

## Phase 4 — In progress

Plan file: `C:\Users\Alex\.claude\plans\mutable-stargazing-bubble.md`

### C17 — Inbox / email UX brand awareness (SHIPPED, commit `ac4ff75`, live)

**Schema:**
- `ConnectedGoogleAccount.brandCode` STRING(8) NULL — FK Brand.code (constraints:false). Auto-added by autoMigrateSchema at boot.

**Migration `migrateConnectedAccounts.js` (idempotent, sentinel-guarded):**
- Backfills brandCode by matching account.email to Brand.senderEmail (LOWER comparison).
- Orphans (no matching brand) left NULL + logged.
- Sentinel: AuditLog action `phase4_connected_accounts_brand_backfilled`.
- Wired into server.js boot after backfillBrandsIfNeeded.

**OAuth enforcement (`googleAccountController.js`):**
- Callback now looks up Brand by senderEmail. New connects without a matching brand redirect to `?google=no_brand_match`.
- listAccounts + listAvailableAccounts include brandCode in returned attributes.

**Gmail sync (`gmailSyncService.js`):**
- processMessage accepts accountBrandCode. New TriageItem rows get brandCode = account.brandCode (fallback 'SH' for orphans).
- rawEmailData.fromAccount stores the polling email for forensics.

**Reply send (`triageController.js`):**
- Accepts triageItemId + fromAccountId in body.
- Resolves brand from triageItem.brandCode → req.brandScope.defaultBrand → 'SH'.
- Enforces fromAccount.brandCode === resolvedBrandCode: 400 + audit `brand_account_mismatch_block`.
- fromAddress = fromAccount.email || Brand.senderEmail || SMTP_FROM.
- Egypt BCC via `applyEgyptBccIfNeeded` (new helper in emailService.js).
- Audits every send as `reply_sent` with brand/from/to/subject/bccCount/country.

**Egypt BCC single source of truth (`emailService.js`):**
- New `applyEgyptBccIfNeeded(brandCode, country, bccList)` helper.
- outreachController.js outreach send + campaign send + triageController.js reply all call it. Three near-duplicate inline checks collapsed into one helper.

**Desktop (`frontend/admin-portal/src/pages/CRM/TriageInbox.jsx`):**
- BrandBadge on every triage card.
- ComposeModal: header brand chip; sender-account picker `/api/google/accounts` filtered by thread brand (mismatched accounts visible but disabled).
- Cross-brand banner for super-admin in `brandScope.isCrossBrand` mode (list endpoint already merges via `brandScope.where = {}`).
- Reply state passes triageItemId + threadBrandCode through to send-email.

**Mobile (`mobile/sovern-ops-app/app/(tabs)/triage.tsx`):**
- BrandBadge on every card (size sm, no label).
- New Reply button + modal with brand-locked sender picker (touchable list).
- `listConnectedGoogleAccounts` + `sendTriageReply` added to src/services/api.ts.
- TriageItem + ConnectedGoogleAccount types extended with brandCode.

**Three-surface docs:**
- tooltipContent — new keys: `inboxBrandBadge`, `replySenderPicker`, `crossBrandTriage`, `egyptBccRule`.
- helpContent — new `/crm/inbox` section: brand-aware threading, replying, Egypt BCC rule.
- DEVELOPER_GUIDE — new "Inbox / email UX brand awareness (Phase 4, C17)" section: schema, migration, OAuth enforcement, gmail sync propagation, reply enforcement, Egypt BCC helper, desktop, mobile, audit actions, risks.
- USER_GUIDE — new "Replying to inbox emails (Phase 4, C17)" section.

**AuditLog actions added:**
- `reply_sent`, `brand_account_mismatch_block`, `phase4_connected_accounts_brand_backfilled`.

### C16 — Quote-to-SalesOrder + brand-aware SO/PI/Invoice (SHIPPED, commit `1e9f417`, live)

**Backend:**
- `backend/utils/statusMachine.js` — SO transitions reconciled with SalesOrder model enum: draft → confirmed → in_production → ready → shipped → in_transit → delivered → completed; cancellable from any non-terminal state. `processing` removed (pre-flight verified zero rows on live DB).
- `backend/routes/salesOrderRoutes.js` — `POST /create-from-quotation` adds brand-access gate (403 if `req.brandScope.accessibleBrands` doesn't include the quotation's brand and not in cross-brand mode). `PATCH /:id/status` specialized audit `sales_order_status_change`.
- `backend/routes/proformaInvoiceRoutes.js` — `POST /:id/send` hard-blocks when `pi.brandCode === 'FW'` with 400 and audit `fw_send_blocked`. Defense-in-depth alongside the UI disable.
- `backend/routes/invoiceRoutes.js` — same FW send-block on `PATCH /:id/send`.

**PDF templates:**
- New `addFwInternalRecordBanner(doc, entity)` helper in `backend/services/pdf/pdfHelpers.js`. 28px iron-deep bar with cream "FACTORY WILL SEND TO BUYER — INTERNAL RECORD" text. No-op for non-FW.
- Wired into `generateSalesOrderPDF` (`orderDocumentsPDF.js`), `generateProformaInvoicePDF` (`salesDocumentsPDF.js`), `generateInvoicePDF` (`financeDocumentsPDF.js`) — banner injected after `doc.pipe(stream)`, before `getCompanyHeader`.

**Desktop:**
- `QuotationDetail.jsx` — fixed pre-existing `'approved'` bug (the Quotation enum is draft|sent|revised|accepted|rejected|expired). Added Convert-to-SO button visible when status='accepted' and brand-accessible. Modal with factory picker (defaults to quotation factory), estimatedDelivery, shippingMethod, notes. Routes to new SO on success. Modal includes FW internal-record note when brand='FW'.
- `ordersAPI.createFromQuotation()` added to `services/api.js`.
- `ProformaDetail.jsx` — `isFwInternalRecord` flag disables Send button (+ tooltip) and renders an iron-deep banner below the action bar.
- `OrderDetail.jsx` + `InvoiceDetail.jsx` — render the same iron-deep FW internal-record banner below the workflow status bar.

**Mobile:**
- `mobile/sovern-ops-app/src/services/api.ts` — new `createSalesOrderFromQuotation` exported.
- `mobile/sovern-ops-app/app/quotation/[id].tsx` — FW iron-deep banner above PDF buttons. New Convert-to-Sales-Order button visible when status='accepted' and brand-accessible. Alert-driven confirm flow; uses quotation.factoryId (errors if missing). For FW, the confirm prompt repeats the internal-record framing.

**Three-surface docs:**
- tooltipContent — new keys: `convertToSO`, `fwInternalRecord`, `salesOrderStatuses`.
- helpContent `/quotations` — new "Quotation lifecycle (Phase 4, C16)" section.
- DEVELOPER_GUIDE — new "Quote-to-SalesOrder + brand-aware SO/PI/Invoice (Phase 4, C16)" section: status machine reconciliation, convert flow, FW send-block defense in depth, PDF banner wiring, mobile parity, audit actions, pre-existing bug fixed.
- USER_GUIDE — new "Converting a Quotation to a Sales Order" + "FlorWay internal documents" sections under Common Workflows.

**AuditLog actions added:**
- `sales_order_status_change`, `fw_send_blocked`.

### C15 — FW commission ledger + dashboard + accrual rewrite (SHIPPED, commit `908d21d`, live)

**Schema:**
- `CommissionTracking` — added `customerId`, `brandCode` (default 'FW'), `accrualDate`, `registeredBuyerSince`. Status enum widened to add `accrued`, `invoiced_to_factory`, `clawed_back`. Default for new rows: `'accrued'`. Indexes on customer_id, brand_code, brand_code+status, accrual_date.
- `Brand` — added `commissionRate DECIMAL(5,4) DEFAULT 0.0500`. seedBrands: SH = 0.0000, FW = 0.0500.
- `Quotation` — added `commissionRateOverride DECIMAL(5,4) NULL` + index `(status, brand_code)` for forecast scan.

**Migration `migrateCommissionsC15.js` (idempotent, sentinel-guarded):**
- Status enum remap: `approved → accrued`, `cancelled → clawed_back`.
- Field backfill: customerId / brandCode / accrualDate via joined SO; orphans default brandCode='FW'.
- Brand.commissionRate backfill: SH=0.0000, FW=0.0500.
- Wired into server.js after seedProductsIfEmpty.

**Accrual rewrite `commissionAccrual.js`:**
- New `accrueIfConfirmed(db, so, userId)` — no-op unless SO is at 'confirmed'.
- Rate resolution: quotation.commissionRateOverride → brand.commissionRate → legacy CommissionRule fallback.
- Sets customerId, brandCode, accrualDate, registeredBuyerSince. Status 'accrued' for new rows.
- Backwards-compat alias `accrueCommissionForOrder` preserved.
- `updateCommissionPercentage` now enforces 5% floor (cannot override).
- Exports `COMMISSION_FLOOR_DECIMAL = 0.05`, `COMMISSION_FLOOR_PERCENT = 5.0`.

**salesOrderRoutes.js:**
- `PATCH /:id/status` now hooks accrueCommissionForOrder when status transitions from non-confirmed to 'confirmed'.

**quotationController.js:**
- create + update validate `commissionRateOverride >= 0.05` (decimal). Update path audits `commission_rate_override` when the field changes.

**New endpoints (`backend/routes/personalization/commissionRoutes.js`):**
- `GET /api/personalization/commissions/dashboard?brand=FW` — KPIs (MTD/QTD/YTD/PendingPayment) + pipeline forecast + deals + outstanding. Gated by inline `requireFwAccess` (super_admin OR accessibleBrands.includes('FW')).
- `POST /commissions/:id/mark-paid` — super_admin only, status=paid + paidDate. Audit `commission_paid`.
- `POST /commissions/:id/claw-back` — super_admin + reason (≥ 5 chars). Audit `commission_clawed_back`.

**Backend brandScope hook:** `personalizationRoutes.js` now applies `requireAuth + brandScope` at the router so commission endpoints can read `accessibleBrands`.

**Desktop:**
- New `frontend/admin-portal/src/pages/Analytics/CommissionDashboard.jsx` — KPI strip, pipeline forecast card, outstanding > 30d section (super-admin Mark-paid actions), full deals table with inline percentage editor (super-admin only on accrued/pending rows). Status pills color-coded.
- App.jsx: new lazy route `/commissions`.
- Layout.jsx: user-menu entry "FlorWay commission" visible only for super_admin OR `accessibleBrands.includes('FW')`.

**Mobile:**
- `mobile/sovern-ops-app/src/components/CommissionWidget.tsx` rewired to use new `/dashboard` endpoint. Now tappable → navigates to `/commission` detail. Tiles show MTD Accrued + Pending payment.
- New `mobile/sovern-ops-app/app/commission.tsx` — read-only deals list with KPIs, outstanding section, status pills. Mobile-friendly card layout.

**Three-surface docs:**
- tooltipContent — new keys: `commissionRateOverride`, `commissionFloor`, `commissionStatuses`, `markPaid`, `clawBack`, `pipelineForecast`, `outstandingTracker`.
- helpContent — new "FlorWay commission tracking (Phase 4)" section under `/`.
- DEVELOPER_GUIDE — new "FlorWay commission tracking (Phase 4, C15)" section: schema deltas, migration, rate resolution, accrual trigger points, floor enforcement, API endpoints, percentage-vs-decimal note, UI, AuditLog actions, pipeline forecast notes.
- USER_GUIDE — new "Tracking FlorWay Commission (Phase 4)" walkthrough.

**AuditLog actions added:**
- `commission_rate_override`, `commission_paid`, `commission_clawed_back`, `phase4_commission_status_migrated`, `phase4_commission_fields_backfilled`, `phase4_brand_commission_rate_backfilled`.

### C14 — Brand-aware product catalog (SHIPPED, commit `8fb9a6a`, live)

**Backend:**
- `backend/models/Product.js` — added 8 fields: brandCode (default 'SH'), productType (enum), baseFobPrice (decimal FLOOR), currency, moqUnit, leadTimeDays, certifications (JSON), originCountry. Compound + brand_code indexes added; SKU stays globally unique (column-level UNIQUE can't ALTER on SQLite; deviation documented).
- `backend/models/index.js` + `backend/services/migrateBrands.js` — 'Product' added to BRAND_TX_MODELS + TX_MODELS so existing 31 rows backfill to brandCode='SH'.
- `backend/routes/productRoutes.js` — router-level `requireAuth + brandScope`. Every product request is brand-scoped.
- `backend/controllers/productController.js` — create accepts new fields, defaults brandCode from req.brandScope.defaultBrand, calls assertBrandWritable. getAll applies brandWhere(req) + productType filter. getById + update both 404 on wrong brand (no existence leak).
- `backend/controllers/quotationController.js` line 36-54 — line-item loop now enforces (a) brand match between product and quotation, (b) floor check (unitPrice >= product.baseFobPrice); below-floor requires super-admin role + belowFloorReason (>= 5 chars) per item, audited as `product_floor_override`. Defaults unitPrice from baseFobPrice when absent. Explicit no-markup invariant comment.
- New `backend/services/seedProducts.js` — idempotent on (brandCode, sku). 3 FW placeholders (FW-SPC-65 IronLite 6.5mm $5.80, FW-SPC-85 IronLite 8.5mm $7.20, FW-WPC-65 Generic WPC 6.5mm $6.40), 2 SH placeholders (SH-HW-14 Engineered Oak 14mm $24.00, SH-LAM-8 Laminate 8mm AC4 $6.80). PLACEHOLDER prices commented for replacement. Wired into server.js boot after seedCommissionRulesIfEmpty.

**Desktop:**
- New `frontend/admin-portal/src/pages/Settings/ProductCatalog.jsx` — admin page at /settings/products. Brand filter (BrandFilterPicker), DataTable with SKU/Name/Brand/Type/floor price/MOQ/Lead/Active columns, New/Edit modal with BrandPicker (locked on edit), deactivate toggle. Floor price column reads baseFobPrice.
- `App.jsx` lazy route + `Layout.jsx` user-menu link "Product catalog".
- `QuotationForm.jsx` — line-item Product dropdown is brand-filtered via re-fetch on brandCode change. Picking a product autofills unitPrice from baseFobPrice and unit from moqUnit. Below-floor reveals an amber warning + reason input; reason submitted as `belowFloorReason` per item.

**Mobile:**
- `mobile/sovern-ops-app/app/(tabs)/products.tsx` — BrandFilterPicker at top, BrandBadge on each row. baseFobPrice preferred over legacy ProductPrice.sellingPrice on display.
- `mobile/sovern-ops-app/src/services/api.ts` — Product type extended with new fields. getProducts accepts brandCode + status params.

**Three-surface docs:**
- `tooltipContent.js` PRODUCT — new entries: brandCode, productType, baseFobPrice, moqUnit, leadTimeDays, certifications, originCountry, floorOverride.
- `helpContent.js` `/products` — new "Brand-aware catalog (Phase 4)" section.
- `DEVELOPER_GUIDE.md` — new "Product catalog (Phase 4, C14)" section: schema delta, quotation flow integration, frontend, mobile, seed, AuditLog actions, no-markup invariant + grep blocklist.
- `docs/USER_GUIDE.md` — new "Managing the Product Catalog (Phase 4)" walkthrough.

**AuditLog action:**
- `product_floor_override` — entity Product, changes {sku, floor, quotedPrice, reason}.

**Plan deviation: SKU globally unique (not per-brand).** SQLite ALTER limitations + 31 live rows + many FK relations make the table rebuild unsafe for this commit. Brand-prefixed seed SKUs (FW-*/SH-*) sidestep collisions. Phase 5 ticket: rationalize Product+ProductPrice and do the per-brand SKU rebuild.

**Pre-existing bug fixed in-flight:** productController.create didn't call assertBrandWritable. Now it does.

---

## Phase 3 — COMPLETE ✅

Plan file: `C:\Users\Alex\.claude\plans\mutable-stargazing-bubble.md` (kept for reference)

**Commits shipped this session, in order:**

| Hash | Scope |
|---|---|
| `cbb308a` | C9 — FW quotation document template (IronLite / Generic / Private Label) + mobile Preview/Download PDF |
| `7e8a8f5` | C10 — SH brand-styled quotation renderer (forest / cream / ink) |
| `72c7844` | C11 — Per-brand reporting + FW commission widget (5% default, adjustable per order) |
| `e9c0938` | C12 — productBrandingMode picker + lock-after-sent + super-admin override |
| `14cd45b` | C13 — Phase 1 polish bundle (BrandBadge expansion, BrandPicker on create forms, cross-brand auto-add, 404-on-wrong-brand) |
| `ddf80a1` | Polish 1 — 404 extension (Inquiry/Activity/TriageItem/Document) + analytics brand-scope (7 endpoints) + desktop L-042 formatters |
| `e65f664` | Polish 2 — mobile L-042 (timezone Asia/Taipei on 28 call sites across 14 files) |

7 commits, all CI green, all deployed live on `erp.sovernhouse.co`.

---

## What Alex still owes manually (next time he's at his Windows machine)

1. **Mobile npm install** — `cd "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\mobile\sovern-ops-app"` then `npm install`. Picks up `expo-file-system` + `expo-sharing` added in C9 for the mobile Preview/Download PDF feature. Without this, the mobile PDF buttons throw on tap.

2. **Optional: typography upgrade for PDFs** — drop these into `backend/assets/fonts/` to swap Helvetica fallback for the FW brand-spec fonts:
   - `Anton-Regular.ttf` (display)
   - `Inter-Regular.ttf` + `Inter-Bold.ttf` (body)
   - All free from fonts.google.com (OFL). The PDF renderer's `registerBrandFonts` already conditionally registers them; no code change needed when they appear.

3. **Optional: flex the FW commission rate** — set `FW_COMMISSION_RATE=<n>` (e.g. `7`) in the GCP VM's env and restart pm2 to seed a different default. Existing CommissionTracking rows keep their per-order rates.

4. **Auto-update error on the Claude Code CLI** — separate from the ERP. Run `! claude doctor` from this prompt to diagnose, then `npm i -g @anthropic-ai/claude-code` in an elevated PowerShell if needed.

---

## Smoke-test checklist Alex hasn't run yet (Phase 3 verification)

When you next have a phone in hand + a test customer in the DB, walk through:

**FW PDF variants (after `npm install`):**
1. FW customer with `productBrandingMode='ironlite'` + WPC quotation → Download PDF → I-Beam wordmark, OEM badge, construction diagram on page 2.
2. Same customer with `productBrandingMode='generic'` → FlorWay Sdn Bhd wordmark, no IronLite imagery.
3. Same customer with `productBrandingMode='private_label'` + a brand name → placeholder page with TODO banner.
4. SH customer + quotation → new SH brand-styled layout (forest/cream/ink). This is a visual change from the old pdfkit-classic layout for SH; flag if it doesn't match your taste.
5. Send FW quotation by email → PDF attached, sender `alexflorway@gmail.com`, no Mohanad BCC.
6. Footer middot (U+00B7) renders, no em dashes anywhere.
7. Mobile: open quotation detail → tap Preview PDF (opens in viewer) → tap Download PDF (share sheet).

**Brand-scoped reporting:**
8. Dashboard top-right brand picker → toggle SH / FW → KPIs and charts update.
9. FW commission widget renders three tiles (Accrued / Paid / Pending) for the current Taipei month.
10. Click "Show orders" → expand the per-order list → change a pending row's percentage → confirm the amount recalculates and saves.
11. As super-admin in cross-brand view → see the BrandRevenueComparison side-by-side bar.

**productBrandingMode lock:**
12. Add FW to a customer's brand relationships → picker appears on customer detail.
13. Set mode to `ironlite`, send an FW quotation → reload customer detail → picker locked with Asia/Taipei lock timestamp.
14. As super-admin → click Override → enter reason (min 3 chars) → confirm. Audit log entry should appear.

**Phase 1 polish:**
15. Create an FW lead/quote/deal against an existing SH-only customer → toast appears, customer brand relationships now include FW.
16. As an SH-only user, hit `/api/quotations/<FW-id>` directly → 404 (not 403).
17. BrandBadge visible on Order, Invoice, ProformaInvoice detail headers.
18. BrandPicker visible on LeadForm, QuotationForm, DealForm.

**Timezone:**
19. Every date and time on every screen, every PDF footer, every audit log timestamp → Taipei time.

---

## Deferred (not in Phase 3 — pick up in a future phase)

- **SO / PO / Invoice / Packing List brand-aware document templates** — factory currently sends FW docs per your standing decision. Pick up when factory hands off.
- **Full Private Label quotation template** — placeholder ships now; full template lands when the first OEM private-label buyer signs.
- **Calendar / Docs MCP integration extensions** — not blocking.
- **Quotation approval workflow** — Mr. Lee / Alice confirmed no sign-off needed.

---

## Stale memory note

`project_expenses_per_brand` memory says Phase 1 didn't tag Expense/Office/Trip/Submission with brandCode and that we owe a sub-commit. The Phase 3 Explore agent confirmed they ARE tagged from Phase 1 Commit 3b-A. Memory should be updated/deleted when convenient.

---

## Next session pickup

If you come back to ERP work, start by:

1. `git log --oneline -8` to confirm we're at `e65f664` on `main` (or further if anyone pushed).
2. Re-read this file and `lessons.md` per the standing protocol.
3. Either:
   - Smoke-test the checklist above and report findings, OR
   - Pick up one of the deferred items above, OR
   - Hit a new feature ask.

---

### Mobile L-042 follow-up (SHIPPED, commit `e65f664`, live)

Every per-screen mobile date formatter now passes `timeZone: 'Asia/Taipei'`. 14 files touched, ~28 call sites updated.

**Files:**
- `app/quotation/[id].tsx` (4 sites)
- `app/lead/[id].tsx` (1)
- `src/components/ChatterSection.tsx` (1)
- `app/dev-runs.tsx` (2)
- `app/(tabs)/assistant.tsx` (1 date formatter; currency `toLocaleString` calls left alone)
- `app/(tabs)/approvals.tsx` (3)
- `app/(tabs)/activities.tsx` (1)
- `app/(tabs)/dashboard.tsx` (1)
- `app/(tabs)/chat.tsx` (3)
- `app/(tabs)/inquiries.tsx` (1 date; currency left alone)
- `app/(tabs)/invoices.tsx` (1 date)
- `app/(tabs)/purchase-orders.tsx` (4 incl. share-link expiry)
- `app/(tabs)/research.tsx` (1)
- `app/(tabs)/sales-orders.tsx` (4 incl. share-link expiry)
- `app/(tabs)/triage.tsx` (2)
- `app/(tabs)/shipments.tsx` (1)

Currency `Number.toLocaleString` calls intentionally left as-is — they're number formatting, not date formatting, and don't need a timezone.

L-042 desktop migration (in commit `ddf80a1`) plus this mobile migration close the timezone loop for every user-facing surface in the ERP.

### Phase 3 mechanical follow-ups (SHIPPED, commit `ddf80a1`, live)

**404-on-wrong-brand extended:**
- `inquiryController.getById` — `isAccessibleByBrandCode` check after the findByPk.
- `activityController.getActivityById` — same.
- `triageController.getTriageItem` — same.
- `documentRoutes` GET `/:id` — same.
- OutreachEmail has no standalone get-by-id endpoint (only nested under leads) — nothing to lock down.

**Analytics brand-scoped:**
- `analyticsRoutes` — `order-funnel`, `top-products`, `customer-segments`, `factory-performance`, `payment-aging`, `shipment-timeline`, `profit-margins`, `forecast` all now use `brandWhere(req)` or `brandWhereSql(req, alias)`. Per-route `requireAuth` removed (router-level applies it).
- `shipment-timeline` joins to SalesOrder for brand-scoping (Shipment carries no brandCode directly).
- `factory-performance` brand-scopes PurchaseOrder side; Factory itself is shared across brands.
- `customer-segments` brand-scopes the SalesOrder join; customers with zero matching orders still appear with revenue=0 (Customer's JSON `brandRelationships` requires app-layer filtering, separate concern).

**L-042 desktop formatters:**
- `frontend/admin-portal/src/utils/formatters.js` — `formatDate` and `formatDateTime` now use `Intl.DateTimeFormat` with `timeZone: 'Asia/Taipei'`. Every existing call site auto-upgrades.
- Mobile screens use per-screen inline `toLocaleDateString` without timeZone — out of scope here; mark as future cleanup.

**SH PDF path confirmation:**
- No code change. `renderSovernHouseClassic` writes to `uploads/quotations/SH/classic/` since C10 (verified at `brandedQuotationRenderer.js:91`). The follow-up note in C13 was stale.

---

### C13 — Phase 1 polish bundle (SHIPPED, commit `14cd45b`, live)

**BrandBadge expansion (desktop detail headers):**
- `OrderDetail.jsx`, `InvoiceDetail.jsx`, `ProformaDetail.jsx` — added `<BrandBadge code={record.brandCode || 'SH'} size="sm" />` next to the StatusBadge.
- Customer, Lead, Quotation already had it from earlier phases.
- PurchaseOrder and Inquiry detail pages are stubs without real headers — deferred.

**BrandPicker on create forms:**
- New `frontend/admin-portal/src/components/BrandPicker.jsx` (from Phase 1) wired into:
  - `LeadForm.jsx` — picker above company info, brandCode in form state, disabled in edit mode.
  - `QuotationForm.jsx` — picker above customer section, brandCode in submitData payload.
  - `DealForm.jsx` — picker above deal information, brandCode in spread submitData.

**Cross-brand auto-add:**
- New `backend/services/crossBrandAutoAdd.js` — `addBrandIfMissing(db, customerId, brandCode, triggeredBy)` extends `customer.brandRelationships` dedup-safe and writes `cross_brand_relationship_added` AuditLog row. Fire-and-forget at call sites.
- Wired into `leadController.createLead`, `quotationController.create`, `dealController.createDeal`. All three now return `autoAddedBrand` in the response.
- Frontend create forms (LeadForm, QuotationForm, DealForm) show a toast / success banner when `autoAddedBrand` is present.

**404-on-wrong-brand:**
- New `backend/utils/notFoundOnWrongBrand.js` — `isAccessibleByBrandCode(req, brandCode)` and `isAccessibleByBrandRelationships(req, rels)` helpers.
- Applied to getById on: Quotation, Customer (brandRelationships pattern), Deal, SalesOrder, Invoice, ProformaInvoice.
- Remaining (Activity, OutreachEmail, TriageItem, Document, Inquiry) follow the same pattern — mechanical follow-up. Writes stay 403 via `assertBrandWritable`.

**brandCode propagation on quotation create:**
- `quotationController.create` now reads `brandCode` from body, falls back to `req.brandScope.defaultBrand` then `'SH'`, and persists it on the new Quotation. (Phase 1 model had brandCode but the create route wasn't passing it.)

**Audit log action:**
- New action `cross_brand_relationship_added` — entity=Customer, changes={oldBrands, newBrands, addedBrand, triggeredByEntity, triggeredByEntityId}.

**Three-surface docs:**
- `tooltipContent.js` — `BRAND.crossBrandAutoAdd`, `BRAND.brandPickerOnCreate`.
- `helpContent.js` — new "Cross-brand auto-add (Phase 3, C13)" section under `/customers`.
- `DEVELOPER_GUIDE.md` — new "Cross-brand auto-add + 404-on-wrong-brand (Phase 3, C13)" section with helper docs, endpoint coverage table, BrandPicker wiring notes.
- `docs/USER_GUIDE.md` — new "Cross-Brand Auto-Add (Phase 3)" subsection under Managing Customers.

---

### C12 — productBrandingMode picker UI + lock + super-admin override (SHIPPED, commit `e9c0938`, live)

**Schema:**
- `backend/models/Customer.js` — adds `productBrandingModeLockedAt` (DATE, nullable, default null). Auto-migrates on boot via alter-sync.

**Backend:**
- `customerController.update()` accepts `productBrandingMode` and `privateLabelProductName`. Rejects non-super_admin edits when locked. Validates `private_label` requires non-empty `privateLabelProductName`.
- New `customerController.overrideProductBrandingModeLock` + route `POST /api/customers/:id/override-branding-mode-lock` (super_admin only via bare-string requireRole per L-031). Body `{ newMode, newPrivateLabelProductName?, reason }`. Reason min 3 chars. Clears lock, writes `product_branding_mode_override` AuditLog row.
- `quotationController.send` — after status flip to 'sent', if `brandCode==='FW'` and the customer has a mode set and isn't already locked, sets `productBrandingModeLockedAt = new Date()` and writes `product_branding_mode_locked` AuditLog row. Idempotent.

**Desktop:**
- New `frontend/admin-portal/src/components/ProductBrandingModePicker.jsx` — three radio cards (IronLite / Generic / Private Label), required private-label name input, lock badge with Asia/Taipei timestamp, super-admin "Override lock" dialog (mode + name + reason).
- `frontend/admin-portal/src/pages/Customers/CustomerDetail.jsx` — renders the picker only when `customer.brandRelationships.includes('FW')`. Uses `useAuth()` for super_admin gating.

**Mobile:**
- New `mobile/sovern-ops-app/src/components/ProductBrandingModePicker.tsx` — pill toggle, private-label inline input, lock badge. Override stays desktop-only.
- `app/(tabs)/customers.tsx` — renders the picker inside the customer detail modal when FW is in brand relationships.
- `src/services/api.ts` Customer type — adds `productBrandingModeLockedAt`.

**Audit log:**
- New action `product_branding_mode_locked` — entity=Customer, changes={mode, lockedAt, triggeredBy:{entity:'Quotation', id, quotationNumber}}.
- New action `product_branding_mode_override` — entity=Customer, changes={oldMode, newMode, oldPrivateLabelProductName, newPrivateLabelProductName, oldLockedAt, newLockedAt:null, reason}.

**Three-surface docs:**
- `tooltipContent.js` — extends `CUSTOMER.productBrandingMode` with lock note, new `CUSTOMER.productBrandingModeLocked`.
- `helpContent.js` — new "FlorWay product branding mode (Phase 3)" section under `/customers`.
- `DEVELOPER_GUIDE.md` — new "Customer.productBrandingMode lock semantics (Phase 3, C12)" section with schema, trigger, enforcement, override flow, audit actions.
- `docs/USER_GUIDE.md` — new "FlorWay Product Branding Mode" subsection under Managing Customers.

### C11 — Per-brand reporting + FW commission widget (SHIPPED, commit `72c7844`, live)

**Backend:**
- New `backend/services/seedCommissionRules.js` — idempotently inserts `FW Sales Commission` rule (ruleType=percentage, baseValue=5, applicableRoles=['sales','super_admin']). Wired into `server.js` after the brand seed. Reads `FW_COMMISSION_RATE` env if you want to flex the default without a code change.
- New `backend/services/commissionAccrual.js` — `accrueCommissionForOrder(db, so, userId)` fire-and-forget helper. Idempotent per (userId, salesOrderId). Looks up the rule by `${brand.displayName} Sales Commission`. Also exports `updateCommissionPercentage(row, newPct)` used by the PATCH endpoint.
- `backend/routes/salesOrderRoutes.js` — both SO create paths now (a) propagate `brandCode` (body wins, else user defaultBrand, else 'SH'; the create-from-quotation path inherits from the source quotation) and (b) call `accrueCommissionForOrder` post-creation.
- `backend/routes/personalization/commissionRoutes.js` — three new endpoints:
  - `GET /commissions/summary?brandCode=FW&period=mtd` — Accrued / Paid / Pending tiles + contributing rows. Used by CommissionWidget.
  - `PATCH /commissions/:id` — per-order percentage edit. Super_admin any; owner only on pending rows.
  - `GET /commissions/brand-comparison` — super_admin only; SH vs FW revenue + commission for MTD. Used by BrandRevenueComparison widget.
- New `backend/utils/brandFilterUtils.js` — `brandWhere(req)`, `brandWhereSql(req, alias)`, `filterCustomersByBrand(rows, req)`. Layered on top of `brandScope` middleware to give a clean `?brandCode=` override.
- `backend/routes/dashboardRoutes.js` — `router.use(requireAuth, brandScope)` + brand-scoped admin dashboard + mobile summary.
- `backend/routes/analyticsRoutes.js` — `router.use(requireAuth, brandScope)` + revenue-trend brand-scoped via raw-SQL helper.
- `backend/routes/reportRoutes.js` — `router.use(requireAuth, brandScope)` + sales report brand-scoped.

**Desktop:**
- New `frontend/admin-portal/src/components/BrandFilterPicker.jsx` — top-of-page pill; hidden for single-brand users; persists choice to localStorage; "All Brands" option for super_admin in cross-brand mode.
- New `frontend/admin-portal/src/components/DashboardWidgets/CommissionWidget.jsx` — FW MTD tiles + expandable per-order table with inline percentage edit.
- New `frontend/admin-portal/src/components/DashboardWidgets/BrandRevenueComparison.jsx` — super_admin cross-brand only; Recharts grouped bar.
- `Dashboard.jsx` — BrandFilterPicker in header + both widgets above KPI row; `brandFilter` state passed as `?brandCode=` to all dashboard API calls.
- `services/api.js` dashboardAPI — every endpoint now accepts `{ brandCode }` params.
- `utils/formatters.js` — new `formatDateTaipei` + `formatDateTimeTaipei` (L-042 compliance for Phase 3 strings; legacy formatters unchanged).

**Mobile:**
- New `mobile/sovern-ops-app/src/components/BrandFilterPicker.tsx` — pill toggle, mirrors desktop logic.
- New `mobile/sovern-ops-app/src/components/CommissionWidget.tsx` — read-only summary (per-order edit stays desktop-only).
- `app/(tabs)/dashboard.tsx` — wires both above the pipeline metrics; `brandFilter` state passed to `getDashboard({brandCode})`.
- `src/services/api.ts` `getDashboard` — now accepts optional `{brandCode}`.

**Three-surface docs:**
- `tooltipContent.js` — `DASHBOARD.brandFilter`, `allBrands`, `fwCommission`, `brandRevenueComparison`.
- `helpContent.js` — new "Brand-filtered reporting (Phase 3)" section under `/`.
- `DEVELOPER_GUIDE.md` — new "Brand-Scoped Dashboards + FW Commission (Phase 3, C11)" section with wiring pattern, files of interest, FW commission accrual flow, endpoints, L-042 note.
- `docs/USER_GUIDE.md` — new "Brand Filter on Dashboards" + "FlorWay Commission Widget" paragraphs.

**Scope notes:**
- Brand-scope helper applied to the most-visible queries (admin dashboard, mobile summary, revenue-trend, sales report). Remaining analytics endpoints (order-funnel, top-products, customer-segments, factory-performance, payment-aging, profit-margins, forecast) inherit `req.brandScope` from middleware but the where-clause weaving on each handler is a mechanical follow-up — not blocking C11.
- Customer queries (JSON `brandRelationships`) require application-layer filtering via `filterCustomersByBrand`; the admin dashboard accepts a small under-scope until that follow-up.

### C10 — SH brand-styled quotation renderer (SHIPPED, commit `7e8a8f5`, live)

**What ships:**
- Replaced the C9 SH classic delegate with a native `renderSovernHouseClassic()` in `backend/services/pdf/brandedQuotationRenderer.js`. Same shared draw helpers as FW (brand-agnostic — they take a tokens bag) so the SH document has the same structural rigor as FW but with the Sovern House palette: forest #1D5A32 primary, cream #F1EEE7 accent, ink body text, with a clay/bronze accent reserved.
- SH wordmark header reads the `sovern-house-logo-light.png` asset; falls back to text "SOVERN HOUSE / INTERNATIONAL TRADE" when the asset is missing.
- Footer middot legal "New Route International Exchange Co., Ltd. · Taiwan".
- Sender block "Alexander McConnell / FOUNDER / alex@sovernhouse.co".
- Trading-house intro paragraph ("verified factories across Asia, ships under your preferred Incoterm").
- Output path moved from `uploads/quotations/quotation-{number}.pdf` to `uploads/quotations/SH/classic/quotation-{number}-{timestamp}.pdf` for consistency with the FW brand+variant convention.
- 3 SH logo PNGs copied into `frontend/admin-portal/public/brand-assets/sovern-house/` for consistency with the florway/ folder layout. The originals at `/public/` root are untouched.
- `legacySales` import removed from `brandedQuotationRenderer.js` (no longer used). `salesDocumentsPDF.js` retained for `generateProformaInvoicePDF` + `generateSalesNotePDF` which other phases will replace.
- Doc wording generalized: tooltips + helpContent + DEVELOPER_GUIDE no longer say "SH falls through to legacy"; they now describe SH as brand-styled.

**Visual regression accepted:** every existing SH quotation now re-renders with the new layout when re-downloaded. No data change.

### C9 — FW quotation document template (SHIPPED, commit `cbb308a`, live)

**What ships:**
- New `backend/services/pdf/brandedQuotationRenderer.js` — dispatch + 3 FW variants + SH classic delegate. Selects variant from `Customer.productBrandingMode` automatically.
- New `backend/services/pdf/brandStyleTokens.js` — FW iron-deep/cream palette, footer middot legal line, sender block, asset paths, conditional Anton/Inter font registration with Helvetica fallback.
- `backend/services/documentGenerator.js` — barrel override so `generateQuotationPDF` routes through dispatch.
- `backend/controllers/quotationController.js` — `send()` passes brand into PDF; `generatePDF()` fetches brand and now **streams binary** as `Content-Type: application/pdf` (fixes pre-existing bug where the frontend expected blob but backend returned JSON, producing corrupted downloads).
- `frontend/admin-portal/src/pages/Quotations/QuotationDetail.jsx` — variant hint banner for FW (IronLite / Generic / Private Label) and private-label "in development" notice.
- `mobile/sovern-ops-app/app/quotation/[id].tsx` — Preview PDF + Download PDF buttons, variant banner. Send via ERP button preserved.
- `mobile/sovern-ops-app/src/services/api.ts` — new `downloadQuotationPDF(id, {inline})` helper using lazy-loaded `expo-file-system`.
- `mobile/sovern-ops-app/package.json` — added `expo-file-system ~19.0.16` and `expo-sharing ~14.0.7`.
- 6 IronLite PNGs copied into `frontend/admin-portal/public/brand-assets/florway/` (versioned, deployable).
- `tooltipContent.js` — new `QUOTATION.documentPreview` + `QUOTATION.florWayVariants`.
- `helpContent.js` — new "Brand-aware quotation document" section under `/quotations`.
- `DEVELOPER_GUIDE.md` — new "Brand-Aware Quotation Documents (Phase 3, C9 / C10)" section with pipeline diagram, file index, variant selector code, asset path resolution, font registration, "Adding a new brand" recipe.
- `docs/USER_GUIDE.md` — new "Brand-Aware Quotation Documents" + "Downloading and Previewing the PDF" subsections under Managing Quotations.

**Manual steps before testing:**
1. `cd mobile/sovern-ops-app && npm install` (picks up expo-file-system + expo-sharing). Alex runs this on Windows.
2. (Optional) Drop `Anton-Regular.ttf` + `Inter-Regular.ttf` + `Inter-Bold.ttf` from fonts.google.com into `backend/assets/fonts/`. PDFs render fine without them (Helvetica fallback) — typography auto-upgrades when present.
3. Restart backend on GCP VM after deploy so the new renderer is loaded.

**Verification checklist (after commit + deploy):**
1. FW customer with `productBrandingMode='ironlite'` + WPC quotation → Download PDF → I-Beam wordmark header, OEM badge, construction diagram on page 2.
2. Same customer with mode `generic` → FlorWay Sdn Bhd wordmark, no IronLite imagery.
3. Same customer with mode `private_label` + `privateLabelProductName='OakCove Flooring'` → placeholder page with TODO banner.
4. SH quotation → existing pdfkit-classic layout (regression check; C10 replaces).
5. FW quotation `send` → email with PDF preview; sender `alexflorway@gmail.com`; no Mohanad BCC.
6. Footer middot (U+00B7) renders.
7. No em dashes anywhere.
8. Mobile Preview PDF + Download PDF buttons work after `npm install`.

### Remaining Phase 3 work (post-C9 commit)
- C10 — SH quotation template (replaces legacy SH pdfkit-classic with brand-styled SH layout).
- C11 — Per-brand reporting dashboards + FW commission widget.
- C12 — `productBrandingMode` picker UI on Customer detail + lock-after-sent + super-admin override.
- C13 — Phase 1 polish bundle (BrandBadge expansion, BrandPicker on create forms, cross-brand auto-add, 404-on-wrong-brand getById extension).

---

## Where We Are

### Phase 2 — Multi-Brand (SH + FlorWay) — COMPLETE ✅

All Phase 2 work is shipped. The ERP is now fully brand-aware for the SH and FW brands across every key surface.

#### What Phase 2 delivered (this session + the session that led into this one)

**C5 — Brand-aware email composer (carried from prior session, commit `e53e4c2`):**
- Outreach emails auto-select `fromAddress` and signature from `lead.brandCode → Brand.senderEmail`
- `From` header uses `brand.displayName | Alex` (e.g. "FlorWay | Alex" not hardcoded SH)
- Campaign send validation checks against live `Brand.senderEmail` values (enables `alexflorway@gmail.com`)
- Egypt BCC rule (`mohanadfanzey@gmail.com`) gated to `brandCode === 'SH'` only, never FW
- FW brand has its own `signatureHtml` and `signatureText` (iron-deep divider, generic FlorWay copy, FLORWAY SDN. BHD. footer)
- `Brand.signatureText` column added to model + auto-migrated on boot

**C6 — Brand-aware quotation email sender (commit `caca318`):**
- `emailService.js`: new `sendTransactionalEmail` (Gmail API, pre-built HTML/text) + `sendTransactionalEmailWithFallback` (SMTP fallback). Same connected-account lookup as outreach.
- `quotationController.js`: `send()` now looks up `quotation.brandCode → Brand`, builds brand-colored HTML email with line items table + totals + signature, routes via `sendTransactionalEmailWithFallback`. Replaces generic SMTP `sendQuotationEmail`.
- `QuotationDetail.jsx`: `BrandBadge` in header, Send dialog shows brand sender email.
- `api.ts` (mobile): `brandCode` on `Quotation` interface, `sendQuotation(id)` function.
- `quotation/[id].tsx` (mobile): `BrandBadge` in header, "Send via ERP" button (draft-only) with brand-aware confirmation prompt.

**C7 — Brand admin UI (commit `319189a`):**
- `GET /api/brands/:code` + `PUT /api/brands/:code` (super_admin only) — update displayName, senderEmail, primaryColor, accentColor, logoUrl, signatureHtml, signatureText, footerLegalText
- `Settings/BrandAdmin.jsx` (new): accordion card per brand, color pickers with hex inputs, textareas for HTML/plain-text signatures and footer legal, dirty-state guard, discard button
- Route `/settings/brands` (super_admin only); "Brands" link added to user dropdown menu
- `app/brands.tsx` (mobile, new): read-only brand info screen — colors, sender email, footer legal
- Settings screen: "Brands" row in System section → navigates to `/brands`

**C8 — FW email templates + brand-filtered picker (commit `553b303`):**
- `EmailTemplate` model: `brandCode STRING(8)` nullable, auto-migrated on boot
- `emailTemplateController`: GET accepts `?brandCode=` filter; POST/PUT accept + persist brandCode
- `seedEmailTemplates.js` (new): on boot, backfills existing templates to `brandCode='SH'`, then creates 6 FW templates idempotently:
  - FlorWay - US Flooring Importers (Touch 1) — Section 301 / ASEAN angle
  - FlorWay - EU Flooring Importers (Touch 1) — antidumping / CE angle
  - FlorWay - UK Flooring Importers (Touch 1) — UKCA angle
  - FlorWay - Australia / NZ Flooring Importers (Touch 1) — short ANZ lead time angle
  - FlorWay - LATAM Flooring Importers (Touch 1) — Spanish/Portuguese offer
  - FlorWay - Middle East Flooring Importers (Touch 1) — CIF Gulf / hospitality angle
- `ComposePanel` in ClientContacts.jsx: loads `?brandCode=${leadBrandCode}` — FW lead sees FW templates only
- `BulkSendModal`: template fetch is reactive to `form.fromAddress`; switches brand → template list refreshes
- Both panels tag any saved templates with the current brandCode

---

## How the Multi-Brand System Works (reference)

| Layer | Where it lives | How it works |
|---|---|---|
| Brand table | `backend/models/Brand.js` | SH + FW rows. `code`, `senderEmail`, `displayName`, `primaryColor`, `accentColor`, `signatureHtml`, `signatureText`, `footerLegalText`, `logoUrl` |
| Brand seeding | `backend/services/seedBrands.js` | Idempotent on boot. FW has its own signature HTML/text. SH signature is `null` (served by EmailSignature flow) |
| Brand scope middleware | `backend/middleware/brandScope.js` | Injects `req.brandScope.where` for list filtering. Super_admin sees all. |
| brandCode FK | All transactional models (Lead, Quotation, Deal, etc.) | `STRING(8)`, FK to Brand.code, auto-migrated on boot, backfilled to 'SH' |
| BrandsContext (desktop) | `frontend/admin-portal/src/contexts/BrandsContext.jsx` | `useBrands()` hook: `getBrand(code)`, `accessibleBrands`, `defaultBrand` |
| useBrands (mobile) | `mobile/sovern-ops-app/src/hooks/useBrands.ts` | Module-level cache, same API surface |
| BrandBadge | Both surfaces | Color-coded pill: green = SH, blue = FW |
| Email composer | `ClientContacts.jsx` ComposePanel + BulkSendModal | Auto-selects fromAddress from brand; filters templates by brandCode |
| Campaign validation | `outreachController.js` sendCampaign | Validates fromAddress against live `Brand.senderEmail` values (not static domain list) |
| Quotation email | `quotationController.js` send | Looks up brand, builds brand-colored HTML email, routes via Gmail API |
| Egypt BCC | `outreachController.js` | `brandCode === 'SH' && country === 'Egypt'` only — never FW |
| Brand admin UI | `/settings/brands` (desktop) | Super_admin only. Edit all brand fields via accordion. |
| Brand view (mobile) | `app/brands.tsx` | Read-only. Linked from Settings > System > Brands |
| Template filtering | `emailTemplateController` + composer | `?brandCode=X` returns brand-specific templates; seed backfills existing to SH, creates FW on boot |

---

## Phase 1 Deferred Polish (still outstanding)

These were explicitly deferred during Phase 1 and not addressed in Phase 2:

- **BrandPicker in create forms** — LeadForm, QuotationForm, DealForm. Users can brand-override an existing entity via `/admin/brand-override` (audit-logged) but the create form doesn't have a picker yet. Low urgency while super_admin creates all new entities.
- **BrandBadge on deal/SO/PO/invoice headers** — added to Lead, Lead list, Quotation. Still missing from Deal, SalesOrder, PurchaseOrder, Invoice, ProformaInvoice detail pages.
- **404-on-wrong-brand for get-by-id** — implemented for Lead detail. Not yet on Quotation, Deal, SO, PO, Invoice endpoints (they return the record regardless of brand scope mismatch).
- **Mobile EAS native rebuild** — Blocked on Apple Developer account. Items 2 (voice) + 3 (camera/doc picker) from the prior AI UX session still need a native rebuild to ship on mobile. Until then those buttons throw on tap.

---

## Outstanding From Previous Sessions

### Scan-Receipt flow (staged, never committed)
The SESSION.md before this session noted these files were staged but not committed:
- `backend/routes/aiRoutes.js`
- `frontend/admin-portal/src/pages/Expenses/ExpensesPage.jsx`
- `mobile/sovern-ops-app/src/services/api.ts`
- `mobile/sovern-ops-app/app/(tabs)/expenses.tsx`

**Check the working tree first thing next session.** Run `git status` and `git diff --staged`. If the staged changes are still there, test the flow (real receipt photo on desktop, confirm Drive upload + AI extract + pre-fill banner) then commit + push.

### VM kernel update pending
`*** System restart required ***` on VM login. Schedule a reboot when convenient. pm2 handles restart cleanly.

---

## Next Task

**Start of next session — in order:**

1. `git status` — check if the scan-receipt staged changes are still there. If yes, test + commit.
2. Pick a Phase 1 polish item from the list above, or start the next major feature.

**Likely next major feature candidates (Alex to confirm direction):**
- **BrandPicker in create forms** — LeadForm, QuotationForm, DealForm. Straightforward UI addition.
- **Customer profitability page UI** — backend endpoint (`GET /api/customers/:id/profitability`) is live. Needs a chart-y breakdown page under `/customers/:id`.
- **Mobile EAS native rebuild** — requires Apple Developer account. Unblocks voice + camera features.
- **FW Touch 2 / Follow-up templates** — follow-up outreach copy for non-responders. Same template structure, different timing and hook.

---

## Deploy Process

Deploys are **fully automated** via GitHub Actions. After every push to `main`:
1. CI runs tests (auto)
2. Deploy workflow builds frontend on runner, SCPs dist to VM, restarts backend (auto)
3. Health check passes → green deploy

**Manual emergency restart:** `vm_exec: pm2 restart sovern-erp`

---

## Infrastructure Notes

- **ERP server:** GCP VM `sovern-erp`, project `local-iterator-495008-e6`, zone `us-central1-f`
- **DB:** SQLite at `/home/alex/sovern-erp/data/erp.db`
- **Git repo:** `github.com/SovernHouse/sovern-erp` (public — never commit keys/credentials)
- **Admin login:** `alex@sovernhouse.co` (`.co` not `.ca`)
- **Mobile app:** `mobile/sovern-ops-app/` — Three-Surface Rule: every desktop feature ships to mobile same commit
- **VM SSH (MCP):** Two keys in VM `~/.ssh/authorized_keys` — `sovern-mcp@claude` (Windows Cowork) + `alex-mac@sovern-erp` (Mac)
- **Claude `-p` invocation rules:** `--system-prompt`, `--strict-mcp-config`, `--permission-mode bypassPermissions`, user prompt via stdin
