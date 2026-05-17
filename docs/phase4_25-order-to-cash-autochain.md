# Phase 4.25 — Order-to-Cash Auto-Chain (Feature Directive, REVISED)

**Status:** APPROVED — Alex confirmed 2026-05-17. Phase 4.25a in progress.
**Owner:** Alex (Super Admin) → Claude (executing)
**Skill ref:** `trade-backend.md`, `erp-qa.md`, `trade-odoo-patterns.md`
**Spec template:** `erp-feature-directive.md`
**Source of truth for current gap:** verified 2026-05-17 against `models/*`, `routes/*Routes.js`, `utils/statusMachine.js`

---

## Premise (Alex, 2026-05-17)

> "We need to finish the auto-chain model I described. I think that is not an AI issue, it is a code issue. AI can be supplemental in this but would not drive it. As far as I remember Odoo does this without AI. Our AI addition will be an extra cherry on top, but not the dominant part of such cycle."

This directive treats the auto-chain as backend workflow logic. The AI/MCP layer is explicitly out of scope for the primary phases and lands in a final cherry-on-top phase.

---

## REVISION NOTE (2026-05-17)

The original draft of this directive proposed `SalesOrder.confirm → ProformaInvoice` (SO upstream of Proforma). That contradicted the existing schema: `SalesOrder.proformaInvoiceId` references ProformaInvoice, meaning SalesOrder is downstream of Proforma. Alex confirmed: **use the international-trade-standard chain order, NOT literal Odoo**. The chain is now Quote → Proforma → SalesOrder, matching the existing schema and the bank-LC / import-permit workflow that real Sovern customers need.

Original literal-Odoo order had Quote → SO direct (Proforma optional PDF). That was rejected because:
1. Customers in MENA, Africa, parts of Asia require Pro Forma for LC opening at their bank.
2. Existing schema already commits to Proforma as a first-class entity with `quotationId` and `SalesOrder.proformaInvoiceId` FKs.
3. Whitelabel buyers (other trading companies) recognise the international-trade pattern and would resist literal Odoo as unfamiliar.

The "Odoo style" Alex asks for is the **structural patterns** (chatter, smart buttons, auto-creation between entities, related tabs) applied to **international trade standard data flow**, not the literal Odoo data model.

---

## Audit results (2026-05-17)

### What already exists

- **All 8 transactional models** with sensible status enums:
  - Quotation: draft, sent, revised, accepted, rejected, expired
  - ProformaInvoice: draft, sent, confirmed, cancelled
  - SalesOrder: confirmed, in_production, ready, shipped, in_transit, delivered, completed, cancelled
  - PurchaseOrder: draft, sent, confirmed, in_production, ready, shipped, received, completed, cancelled
  - Invoice: draft, sent, partially_paid, paid, overdue, cancelled
  - Payment: pending, confirmed, rejected
  - GoodsReceivedNote (GRN): pending, accepted, rejected, partial
  - PackingList: draft, confirmed
  - Shipment: booked, loaded, in_transit, at_port, customs, delivered
- **All 7 transactional REST route files wired up** in `server.js` (lines 168-247). Routes use inline handlers (no separate controllers).
- **`utils/statusMachine.js`** validates SO and PO transitions today. Foundation for chain hooks.
- **Existing transition endpoints (the trigger surface):**
  - Quotation: `POST /:id/accept`, `POST /:id/reject`, `POST /:id/convert-to-proforma-invoice`
  - SalesOrder: `PATCH /:id/status`, `POST /bulk-status`
  - PurchaseOrder: `PATCH /:id/status`, `POST /bulk-status`, `POST /:id/confirm`
  - Payment: `PATCH /:id/confirm`, `PATCH /:id/reject`
  - GRN: `POST /:id/accept`, `POST /:id/reject`
  - PackingList: `PATCH /:id/confirm`
- **One existing auto-chain link (manual today):** `Quotation.convertToProformaInvoice` (controller line 616) creates a draft Proforma + line items when the user hits the explicit endpoint. Manual button-driven today; Phase 4.25a makes it automatic on `accept`.

### The corrected chain (international trade standard)

7 trigger points fire in this order:

| # | Trigger | Today's behavior | International-trade auto-chain |
|---|---|---|---|
| 1 | `Quotation.accept` | Sets status='accepted'. Nothing else. | Auto-create a draft ProformaInvoice tied to this Quote (existing manual endpoint becomes a side-effect). |
| 2 | `ProformaInvoice.confirm` | (No current confirm endpoint; status set manually.) | Auto-create a SalesOrder (status='confirmed') tied to this Proforma (`SalesOrder.proformaInvoiceId`). |
| 3 | `SalesOrder.confirm` (status→confirmed; default at create) | None. | Auto-create a draft PurchaseOrder for each unique factory referenced by SO line items. |
| 4 | `PurchaseOrder.confirm` | Sets status='confirmed'. | Auto-create a pending GRN (expected receipt) with line items copied from PO. |
| 5 | `GRN.accept` | Sets status='accepted'. | Auto-create the sales Invoice tied to the related SalesOrder (status='draft'). |
| 6 | `Invoice.status→paid` (derived from Payment) | Manual update today. | When a confirmed Payment lands that fully covers the Invoice total, auto-transition Invoice to paid (or partially_paid if partial). |
| 7 | `SalesOrder.shipped` | Sets status='shipped'. | Auto-create a draft PackingList for the shipment if one does not exist. |
| 8 | `Shipment.delivered` | Sets status='delivered'. | Auto-transition the related SalesOrder to delivered. |

### What is NOT in scope here

- Reverse chain (refunds, cancellations cascading downstream). Separate directive.
- Multi-PO-per-SO routing logic (one SO line sourced from multiple factories). Current model assumes one PO per factory; future enhancement.
- Partial fulfilment of GRN vs PO (GRN has a partial status already). Out of scope.
- AI/MCP exposure of these triggers (Phase 4.25h, see below).

---

## Architectural approach

**Layer between routes and models: `services/workflowService.js`** (Phase 4.25a ships this file).

- One module exporting one method per trigger: `onQuotationAccepted`, `onProformaConfirmed`, `onSalesOrderConfirmed`, etc.
- Each method is idempotent: if the downstream record already exists for this upstream id, it logs and returns the existing one rather than creating a duplicate.
- Each method writes an audit log entry with `action='auto_create'` and `changes={sourceEntity, sourceId, trigger, phase}` so the chain is traceable.
- Route handlers call the relevant workflow method AFTER the status update commits, in a try/catch that does NOT fail the user's request if the downstream creation fails (best-effort default).

**Idempotency keys per chain link:**

- Quote → Proforma: `ProformaInvoice.quotationId` (existing FK).
- Proforma → SO: `SalesOrder.proformaInvoiceId` (existing FK).
- SO → PO: `PurchaseOrder.sourceSalesOrderId` (NEW nullable UUID, additive migration).
- PO → GRN: `GoodsReceivedNote.purchaseOrderId` (verify or add).
- GRN → Invoice: `Invoice.sourceGrnId` (NEW nullable UUID, additive migration).
- Payment → Invoice status: existing `Payment.invoiceId` FK.
- SO → PackingList: verify or add `PackingList.salesOrderId` FK.
- Shipment → SO: existing FK.

**Failure mode for chain hops:**

- Default: log error to AuditLog as `auto_create_failed`, do NOT roll back the upstream status change. The chain hop is "best effort" so a single bug does not lock the user out of the upstream operation.
- Opt-in strict mode (env flag `AUTOCHAIN_STRICT=true`): downstream failure rolls back the upstream status change. Used in tests, optionally in production once trusted.

---

## Phases (REVISED)

Each phase ships as one PR (with mobile parity by the Three-Surface Rule). Each phase is end-to-end (migration if needed, plus workflow method, route hook, UI badge invalidation, mobile parity, integration tests).

### Phase 4.25a — Quote.accept to ProformaInvoice (IN PROGRESS)

**Trigger:** `Quotation.accept` endpoint, after status commit.
**Side effect:** Create ProformaInvoice copying customer, currency, totals, line items, brandCode (inherits from quotation; quietly fixes a legacy bug where manual converter defaulted to 'SH').
**Migration:** None (ProformaInvoice.quotationId column already exists).
**Tests:** Integration test asserts: Pro Forma exists with correct quotationId + customerId + brandCode + totals + items; idempotency (re-accept does not duplicate); FW brand inheritance; auto_create audit row written.
**Estimated diff:** ~250 lines including test.
**Acceptance:** Click Accept on a quotation in the UI; navigate to Pro Forma Invoices list; new draft Pro Forma is present.

### Phase 4.25b — ProformaInvoice.confirm to SalesOrder

**Trigger:** `ProformaInvoice` status transitions to `confirmed`.
**Side effect:** Create SalesOrder (status='confirmed') linked via `SalesOrder.proformaInvoiceId`, copying customer, totals, items.
**Migration:** None (SalesOrder.proformaInvoiceId column already exists).
**Tests:** Confirm a Proforma; assert SO created with `proformaInvoiceId === proforma.id`, correct customerId, items, currency. Idempotency: re-confirm does not duplicate.
**Estimated diff:** ~300 lines.
**Acceptance:** Confirm a Pro Forma; Sales Orders list shows the new SO.

### Phase 4.25c — SalesOrder.confirm to PurchaseOrder (per factory)

**Trigger:** SalesOrder created with status='confirmed' (default), or transitions to confirmed.
**Side effect:** Auto-create draft PurchaseOrder for each unique factory referenced by SO line items (idempotent on `PurchaseOrder.sourceSalesOrderId`).
**Migration:** Add `PurchaseOrder.sourceSalesOrderId` nullable UUID.
**Tests:** Confirm a SO with line items from 2 factories; assert 2 POs created with correct line splits.
**Estimated diff:** ~400 lines (per-factory grouping is the main complexity).
**Acceptance:** Confirm a SO; switch to Procurement → Purchase Orders; new draft POs appear.

### Phase 4.25d — PurchaseOrder.confirm to GRN (expected receipt)

**Trigger:** `PurchaseOrder.confirm` endpoint.
**Side effect:** Auto-create GRN with status='pending' (expected receipt) and line items copied from PO.
**Migration:** Verify or add `GoodsReceivedNote.purchaseOrderId` FK.
**Tests:** Confirm a PO; assert a pending GRN exists tied to the PO; line items match PO quantities.
**Estimated diff:** ~200 lines.
**Acceptance:** Confirm a PO; Logistics → GRNs lists a new pending GRN linked to that PO.

### Phase 4.25e — GRN.accept to Invoice (sales invoice on receipt)

**Trigger:** `GRN.accept` endpoint.
**Side effect:** Auto-create sales Invoice with status='draft', tied to the related SalesOrder (via PO → SO chain). If a ProformaInvoice exists upstream, no double-issuance.
**Migration:** Add `Invoice.sourceGrnId` nullable UUID.
**Tests:** Accept a GRN; assert a draft Invoice exists with correct customer + amount.
**Estimated diff:** ~300 lines.
**Acceptance:** Accept a GRN in the UI; navigate to Invoices; new draft invoice present.

### Phase 4.25f — Payment.confirm to Invoice status auto-transition

**Trigger:** `Payment.confirm` endpoint, after status commit.
**Side effect:** Sum confirmed Payments against the related Invoice. If sum ≥ total, transition Invoice to paid. If 0 < sum < total, transition to partially_paid.
**Migration:** None (uses existing `Payment.invoiceId` FK).
**Tests:** Confirm payments of varying amounts; assert Invoice status moves through sent, partially_paid, paid.
**Estimated diff:** ~150 lines.
**Acceptance:** Record a partial payment; Invoice transitions to partially_paid. Record the remaining payment; Invoice transitions to paid.

### Phase 4.25g — SalesOrder.shipped to PackingList + Shipment.delivered to SalesOrder.delivered

**Two related sub-triggers bundled into one PR.**

**Trigger A:** `SalesOrder.status` patched to shipped. → Auto-create draft PackingList if none exists.
**Trigger B:** `Shipment.status` patched to delivered. → Auto-transition the related SalesOrder to delivered.
**Migration:** Verify or add `PackingList.salesOrderId` FK.
**Tests:** Both transitions verified end-to-end.
**Estimated diff:** ~230 lines.
**Acceptance:** Move SO to shipped from the UI; Packing Lists list shows a new draft PL. Mark Shipment as delivered; SO list shows SO transitioning to delivered.

### Phase 4.25h — MCP exposure (cherry on top, OPTIONAL)

Once Phases 4.25a-g are stable, expose the human-facing trigger endpoints as MCP tools so the AI can drive the chain when asked. No new business logic, only thin wrappers:

- `accept_quotation(id)` → calls `POST /quotations/:id/accept`
- `confirm_proforma_invoice(id)` → calls the Pro Forma confirm endpoint
- `confirm_sales_order(id)`, `confirm_purchase_order(id)`, `accept_grn(id)`, `confirm_payment(id)`, etc.

Cherry-on-top: the chain works without it. AI gains write access to the workflow, useful for "advance this deal to the next step" prompts. Estimated diff: ~250 lines, all in `backend/mcp/erpToolServer.js`.

---

## Order of execution (REVISED)

1. **4.25a (Quote → Proforma)** ✅ in progress this session.
2. **4.25b (Proforma → SO)** next.
3. **4.25c (SO → PO per factory)**. Per-factory grouping is the main complexity.
4. **4.25d (PO → GRN)** mostly mechanical.
5. **4.25e (GRN → Invoice)** closes the document loop.
6. **4.25f (Payment → Invoice status)**. Self-contained, low risk.
7. **4.25g (SO.shipped → PL + Shipment.delivered → SO.delivered)**. Bundle as one PR.
8. **4.25h (MCP exposure)** last, after 4.25a-g have run in production for at least 2 weeks without intervention.

Total estimated effort: 5-8 working sessions for 4.25a-g, 1 session for 4.25h.

---

## Risks

- **Existing data without source links.** All currently-existing SOs have no `sourceQuotationId` / `sourceSalesOrderId` etc. The auto-chain does not break them; it only creates the link going forward. Backfill is out of scope.
- **Duplicate creation across deploys.** If a deploy happens mid-chain (user accepts quote, deploy restarts before Pro Forma creation), the next chain attempt would create a duplicate. Mitigated by the idempotency key on each link. Idempotency is mandatory in each workflow method.
- **Notifications spam.** Each chain hop fires a notification today. Bundling: each workflow method should only fire ONE consolidated notification per chain step, not one per record created.
- **Status enum drift.** The Quotation model uses `accepted` while the workflow assumes `confirmed` elsewhere. Each chain method reads the enum it needs; no cross-enum normalisation required.

---

## Approval gate (REVISED)

- [x] Alex confirmed the 7-trigger list matches his Odoo / international-trade-standard mental model (2026-05-17).
- [x] Idempotency-by-source-id approach confirmed.
- [x] Best-effort failure mode confirmed (downstream failures do NOT roll back upstream status). `AUTOCHAIN_STRICT` opt-in available.
- [x] Order of execution confirmed: start with 4.25a (Quote → Proforma).
- [x] MCP exposure (4.25h) is "later, after stable" rather than alongside each phase.
- [ ] Phase 4.25h requires a separate skim against `trade-security.md` before MCP write-tools are exposed for chain-advancing actions.
