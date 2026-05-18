# Phase 4.19 — Brand Safety Gateway Rollout (Feature Directive)

**Status:** DRAFT — pending Alex approval
**Owner:** Alex (Super Admin) → Claude (executing)
**Related:** L-068 (PriceList 2026-05-17), L-073 (gateway pattern, 2026-05-18), `brand-safety.md` skill, BPI brand-leak incident 2026-05-18
**Reference implementation:** `backend/services/brandSafetyGateway.js` + `sendOutreachEmail` + `sendEmail` transactional path (all live as of 2026-05-18)

---

## Goal

Wire `brandSafetyGateway.assertBrandSafe()` into every brand-bearing render path. Today 11 paths are unprotected. Phase 4.19a-g lands the locks one renderer at a time. End state: zero rule #9 incidents possible regardless of caller (REST, MCP, batch, cron, future automation).

---

## Locked today (reference state)

| Surface | Gateway | Tests | Commit |
|---|---|---|---|
| PriceList PDF render | `priceListBrandResolver.assertBrandSafe()` | `phase428dPriceListBrandLeak.test.js` (9) | Phase 4.28d |
| PriceList email send | inherits PDF gateway + email gateway | (above) | (above) |
| Outreach email send (REST) | `sendOutreachEmail` → `brandSafetyGateway` | `outreachBrandLeakGateway.test.js` (6) | af1e54b |
| Outreach email send (MCP) | same | same | af1e54b |
| Transactional email (sendEmail) | opt-in via `options.brandCode` | `brandSafetyGateway.test.js` (38) | this directive's prep commit |
| Lead super-admin brand override | `leadWriteService.updateLead` | `phase417SuperAdminBrandOverride.test.js` (7) | ec1b62b |
| Lead resilient → SH refusal | `assertResilientNotSH` available; not yet wired into Lead.create hook | (test in gateway suite) | this directive's prep commit |

---

## Unprotected today (the backlog)

| Phase | Surface | Where | Risk | Effort |
|---|---|---|---|---|
| 4.19a | Quotation PDF | `services/pdf/brandedQuotationRenderer.js` + `services/pdf/salesDocumentsPDF.js` | HIGH (sent to buyers) | M |
| 4.19a | Quotation email | `sendQuotationEmail` in emailService.js | HIGH | S (delegate to sendEmail w/ brandCode) |
| 4.19b | ProformaInvoice PDF | `services/pdf/salesDocumentsPDF.js` | HIGH (LC + procurement docs) | M |
| 4.19b | ProformaInvoice email | `sendProformaInvoiceEmail` | HIGH | S |
| 4.19c | SalesOrder confirmation email | `sendOrderConfirmationEmail` | HIGH | S |
| 4.19c | SalesOrder PDF | `services/pdf/orderDocumentsPDF.js` | MEDIUM | M |
| 4.19d | Invoice PDF | `services/pdf/financeDocumentsPDF.js` | HIGH (legal payment instrument) | M |
| 4.19d | Invoice email | `sendInvoiceEmail` + `sendPaymentReminderEmail` + `sendPaymentConfirmationEmail` | HIGH | S |
| 4.19e | PackingList PDF | `services/pdf/logisticsDocumentsPDF.js` | MEDIUM (factory-facing but shows brand) | M |
| 4.19e | Shipment notification email | `sendShipmentNotificationEmail` + `sendShipmentUpdateEmail` | MEDIUM | S |
| 4.19f | Inspection report PDF | `services/pdf/logisticsDocumentsPDF.js` | MEDIUM | M |
| 4.19f | Inspection scheduled email | `sendInspectionScheduledEmail` + `sendInspectionReportEmail` | MEDIUM | S |
| 4.19f | Claim email | `sendClaimEmail` | LOW (rare) | S |
| 4.19g | Triage / RFQ acknowledgement | `triageController` (sender) | MEDIUM | M |
| 4.19g | PurchaseOrder PDF + email | `services/pdf/orderDocumentsPDF.js` + `sendPurchaseOrderEmail` | LOW (factory-side; brand-leak risk is reversed — factory sees both brands) | M |

Effort key: S = ~30 min (delegate to existing gateway); M = ~2-3 hrs (PDF renderer needs brand context plumbed through plus assertBrandSafe at the entry point); L = ~half-day (significant refactor).

---

## Standard rollout per surface

Each sub-phase ships in one commit with:

1. **Resolve brand at the entity level** (Quotation has `brandCode`; SO/PI/Invoice inherit from upstream; PackingList from Shipment from SO; etc.). If `brandCode` is null on the entity, refuse 422 / log + skip the send.
2. **Call `resolveBrandOrThrow(db, brandCode)`** at the top of the renderer. Get back `{brand, displayName, fromDisplayName, senderEmail, signatureHtml, signatureText}`.
3. **Pass everything brand-derived into the renderer** (logo URL, signature, footer legal text, primary/accent colours via `brandStyleTokens`).
4. **Call `assertBrandSafe({brandCode, expectedFromDisplayName, actualFromDisplayName, contentFields: {...}})`** before the render output buffer is finalised.
5. **For Resilient items**: also call `assertResilientNotSH({brandCode, productSlugs})`.
6. **Regression test** with at minimum 3 cases: refuse on display mismatch, refuse on foreign-marker content, accept correctly-branded.
7. **PR description must cite `brand-safety.md`** per the standing rule.

---

## Phased plan

### 4.19a — Quotation (PDF + email) [HIGH priority, S+M]
- Add `brandCode` validation in `quotationController.create`. Refuse if null.
- `brandedQuotationRenderer.renderQuotationPdf(quotation)` resolves brand, calls `assertBrandSafe`, renders.
- `sendQuotationEmail(customer, quotation)` resolves brand from `quotation.brandCode`, calls `sendEmail(to, subject, html, {brandCode})` so the existing gateway fires.
- Regression: `phase419aQuotationBrandLeak.test.js`. Verify against the 2026-05-17 IronLite scenario.

### 4.19b — ProformaInvoice (PDF + email) [HIGH, S+M]
- Same pattern. Resolve via `proformaInvoice.brandCode` (inherited from Quotation per Phase 4.25a).
- Test mirrors 4.19a.

### 4.19c — SalesOrder (PDF + email) [HIGH/MEDIUM, S+M]
- SalesOrder.brandCode is set at SO.confirm time per Phase 4.25b.
- Lock SO PDF + confirmation email.

### 4.19d — Invoice (PDF + email) [HIGH, S+M]
- Same. Plus `sendPaymentReminderEmail` and `sendPaymentConfirmationEmail` (shared template; one gateway call covers all three callers).

### 4.19e — PackingList + Shipment (PDF + email) [MEDIUM, S+M]
- PackingList inherits brand from SO. Shipment inherits from PackingList.

### 4.19f — Inspection + Claim (PDF + email) [MEDIUM, S+M]
- Lower volume; same pattern.

### 4.19g — Triage / RFQ + PurchaseOrder [LOW/MEDIUM, M]
- Triage: incoming inquiry → reply email. Reply email's brand depends on which brand the inbox was tied to (factory.brandCode or customer.brandRelationships[0]).
- PurchaseOrder goes to a factory; brand-leak risk is reversed (factory already knows we operate FW + HH together, they ARE FW/HH). But still lock for hygiene.

---

## What this directive does NOT cover (out of scope)

- **Brand-aware email templates per brand.** Today every transactional email body is hardcoded "Trading ERP Team" / "Trading Company" generic copy. A full refactor that gives each brand its own templated body (logo, footer URL, signoff voice) is Phase 4.20 — separate directive. The gateway just makes sure whatever template you load doesn't accidentally cross-pollinate brand identity markers; it does not author per-brand templates.
- **Customer/Factory portal brand badges.** The portals already use BrandBadge which reads from BrandsContext. Leak risk is structural (the portal IS branded per session); gateway is overkill there.
- **Mobile app outbound.** Mobile triggers a backend send via the REST path which is already locked.
- **A new fourth brand.** Adding a brand requires extending the SH/FW/HH marker map. Captured as a rule in `brand-safety.md` "When extending brands"; no code work needed in this phase.

---

## Approval gate (3-item — required before any sub-phase ships)

1. **Scope approval.** Yes/no on rolling out 4.19a-g as scoped. Acceptable to ship 4.19a-d only (the HIGH-priority quotation-through-invoice path) and defer e-g to a follow-up window.
2. **Operator-side defaults for un-branded existing rows.** Today some Quotation/SO/PI/Invoice rows might have `brandCode = null` or `SH` from before brand tagging was strict. Gateway will refuse to render them. Two options:
   - **Refuse + tell the operator to fix the brandCode** (clean, but blocks rendering until manual fix)
   - **Best-effort resolve from customer.brandRelationships[0] before refusing** (transparent recovery, but masks the data debt)
   Pick one before 4.19a lands.
3. **Test approach for PDF renderers.** Two options:
   - **Pure-function tests** that exercise `assertBrandSafe` with mocked data (cheap, no PDFKit roundtrip)
   - **Integration tests** that render the PDF, parse it back, assert no foreign markers (real, slow)
   Pure-function tests are recommended; we already trust PDFKit doesn't mutate input strings.

Once approved, 4.19a is the natural starting commit. Each sub-phase ships its own commit + tests.

---

## Estimated total scope

- 4.19a: half a window (Quotation is the most complex renderer — `brandedQuotationRenderer.js` is 1500+ lines)
- 4.19b-c: half a window combined
- 4.19d-e: half a window combined
- 4.19f-g: half a window combined

Total: ~2 working days end-to-end. 4.19a alone closes the highest-revenue-impact leak surface (Quotations are what customers actually quote against).
