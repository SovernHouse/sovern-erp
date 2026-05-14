# SESSION.md — Current Work State

> This file is maintained by Cowork at the end of every session so Claude Code can pick up without losing context. Read this at the start of every session before doing anything else.

---

## Last Updated
2026-05-14 Taiwan time. Phase 3 in progress. C9 + C10 shipped + live. C11 (per-brand reporting + FW commission widget) staged for commit.

---

## CI Status
- **Latest commit on main:** `7e8a8f5` (feat(phase-3): SH brand-styled quotation renderer (C10))
- **Working tree:** C11 staged, awaiting commit
- **CI/CD Pipeline (7e8a8f5):** green
- **Deploy (7e8a8f5):** green
- **Backend health:** live at `https://erp.sovernhouse.co/api`

---

## Phase 3 — In progress

Plan file: `C:\Users\Alex\.claude\plans\mutable-stargazing-bubble.md`

### C11 — Per-brand reporting + FW commission widget (READY FOR COMMIT)

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
