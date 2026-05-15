# Phase 4.8 — Leads vs Pipeline audit

**Date:** 2026-05-15. **Author:** Cowork. **Scope:** doc only, no code.

## Summary

The ERP has two parallel CRM tables. `Lead` carries 7 lifecycle stages and 112 live rows. `Deal` carries 6 stages and zero live rows. Both models attempt to be the funnel; in practice only `Lead` is wired into Alex's operational flow (outreach, quotations, sanctions screening, AI research). The redundancy Alex feels comes from `Deal` existing as a UI surface (`/crm/pipeline`) without ever holding data. Recommendation: **collapse to a single `Lead`-based pipeline, retire the `Deal` model, and remap the Pipeline screen onto Lead.status groups.** The migration is essentially data-free because the `Deal` table has zero rows on prod.

The deferred alternative (keep both, add a real conversion workflow) is described in §5b for comparison.

---

## 1 — Current data model

### `Lead` (`Leads` table, 112 rows on prod)
- Stage enum: `new | contacted | qualified | proposal | negotiation | won | lost` (7 values).
- Holds prospect identity directly: `companyName`, `contactName`, `email`, `phone`, `website`, `linkedinUrl`. No `Customer` FK at create-time.
- Promotion path to `Customer` exists via `convertedCustomerId` UUID nullable column + `convertLead()` controller (`backend/controllers/leadController.js:280`). That controller sets `status='won'`, copies `customerId`, stamps `wonDate`. No `Deal` row is created.
- Rich pre-customer fields: `source`, `vertical`, `productInterests`, `screeningStatus` (Phase 4 C18), `draftEmailSubject` / `draftEmailBody` (AI research output), `leadType` (`inbound | outbound_prospect | supplier_contact`), `createdBySource` (`manual | ai_research | webhook | import`), `responsibleUserIds[]`, `tags[]`, `additionalContacts[]`.
- Brand-aware: `brandCode` FK to `Brand.code` (Phase 1 D-1).
- Quotation linkage: `Quotation.leadId` is a real column. Quotations are created against a Lead, not a Deal.

### `Deal` (`Deals` table, 0 rows on prod)
- Stage enum: `prospecting | qualification | proposal | negotiation | closed_won | closed_lost` (6 values).
- Requires `customerId` FK NOT NULL — a `Customer` must exist before a `Deal` can be created.
- Has `dealNumber` (DL-YYYYMMDD-XXX), `value` (required), `expectedCloseDate`, `actualCloseDate`.
- Brand-aware: `brandCode`. Same FK to `Brand.code`.
- No write side: zero rows on prod, no conversion logic in any controller (grep across `backend/` finds no `createDealFromLead`, no `convertLeadToDeal`, no `convertedDealId`).
- Read side: `DealPipeline.jsx` (admin portal) renders a Kanban from `GET /crm/pipeline`. `DealForm.jsx` exists for manual creation. Mobile has no `deals.tsx` screen at all.

### Stage-set overlap

| Lead stage | Deal stage | Same idea? |
|---|---|---|
| `new` | `prospecting` | Roughly. Lead is pre-touch; Deal "prospecting" is post-qualification in most CRMs. |
| `contacted` | — | Lead-only. |
| `qualified` | `qualification` | Yes. |
| `proposal` | `proposal` | Yes. |
| `negotiation` | `negotiation` | Yes. |
| `won` | `closed_won` | Yes. |
| `lost` | `closed_lost` | Yes. |

5 of 6 Deal stages map cleanly onto Lead stages already.

---

## 2 — Current UX

- **Where does a new prospect land?** `/leads` (desktop) or the mobile Leads tab. Both `LeadForm` and the AI assistant's `/new-clients` slash command create `Lead` rows.
- **Is there a Lead → Deal handoff trigger?** No. There is no "Convert to Deal" button anywhere in the codebase. `convertLead()` only creates a `Customer`. `DealForm` is reached from `/crm/pipeline`'s "+" button as a fresh manual entry.
- **What happens when a Lead becomes a real opportunity?** Operationally: Alex either (a) advances `Lead.status` through `qualified → proposal → negotiation → won` and never creates a Deal, or (b) marks the Lead won and runs the quotation off `Quotation.leadId`. Either way `Deal` stays empty.
- **Where does Pipeline reporting come from?** `GET /crm/pipeline` returns Deals grouped by stage. Because Deals = 0 on prod, the Pipeline screen always renders empty columns and the FW commission widget falls back to other sources.
- **Mobile state:** no Deals screen exists. Mobile already behaves as if there is one pipeline (Leads). The redundancy is desktop-only.

---

## 3 — Prod data state (snapshot 2026-05-15)

| Table | Row count |
|---|---|
| `Leads` | 112 |
| `Deals` | **0** |
| `Customer` | 5 |
| `Quotation` | 0 |
| `Quotation.lead_id IS NOT NULL` | 0 |

The `Quotation` count is 0 because Phase 4.5 C20 archived the seeded rows. Pre-archive snapshots also confirmed Quotation linkage was through `lead_id`, never `deal_id`.

---

## 4 — Where the friction comes from

1. **Two parallel funnels on desktop**, only one used on mobile. Alex sees `/leads` and `/crm/pipeline` in the nav and has to mentally decide which is "real".
2. **Five stages duplicated** between the two enums. When Alex bumps a Lead from `qualified` to `proposal`, he's doing the same thing he'd do if he were managing a Deal.
3. **No enforced handoff** — there is no moment in the workflow where the system says "this is now a Deal". So `Deal` exists as a perpetual TODO.
4. **Pipeline-value reporting reads from `Deal`** which is empty. Commission widget + dashboard pipeline value are getting their numbers from elsewhere (Lead.estimatedValue grouped by stage), so the `Deal` screen's "pipeline" is decorative.

---

## 5 — Two options

### 5a — Recommended: collapse to a single Lead-based pipeline

Retire `Deal` as an active model. Treat `Lead` as the canonical pipeline record across its full lifecycle (`new → contacted → qualified → proposal → negotiation → won → lost`). `Pipeline` becomes a view onto `Lead` grouped by status.

**Why this fits Alex's workflow:**

- Lead already carries the full lifecycle. Nothing operational changes.
- Quotation, Outreach, Sanctions, AI research all already target Lead. Zero rewiring on the working surfaces.
- Mobile already has only Leads, so mobile gets the "Pipeline" screen for free (it already had it, just renamed).
- The win-rate / pipeline-value math improves because there is one source of truth.
- "Dead leads polluting pipeline metrics" is solved by filtering on `Lead.status IN ('qualified', 'proposal', 'negotiation')` for any "open pipeline" view, treating `new | contacted` as top-of-funnel, and `won | lost` as terminal. That's a one-line `WHERE` clause on the aggregation, not a separate model.

**What ships:**

1. New endpoint `GET /api/crm/lead-pipeline` returning Leads grouped by `Lead.status`. Replaces `GET /crm/pipeline` semantically. Old endpoint kept as alias for one release for any third-party caller.
2. `DealPipeline.jsx` rewired to call the new endpoint. Stage labels updated to use Lead's enum. Kanban drag-and-drop updates `Lead.status` (already supported by `PUT /leads/:id`).
3. `DealForm.jsx` and `Deal` create routes hidden. Existing `Deal` model + table stay in the codebase for one release as a no-op for safety, but no UI surface points at them.
4. Dashboard pipeline-value widget switched to read `Lead.estimatedValue` summed where `status IN ('qualified', 'proposal', 'negotiation')`.
5. Tooltips + helpContent updated: Pipeline page docs reference Lead stages; the word "Deal" goes away from user-facing copy.

**What we lose:**

- `dealNumber` (DL-YYYYMMDD-XXX). Lead already has its own UUID; if you want a human-readable identifier, that's a separate Lead.leadNumber field, which is a small additive migration if you want it.
- `Deal.actualCloseDate` distinct from `Lead.wonDate` / `Lead.lostDate`. Lead has both fields, so no functional loss.
- The optionality of a "this was a real opportunity vs this was a cold prospect we never qualified" distinction at the data layer. With (5a) that distinction is encoded in the stage value, not in a separate table.

**Migration risk:** essentially zero. Deal has 0 rows on prod. No data migration. The change is purely UI rewiring + endpoint aliasing + filtering logic. A revert to (5b) later is also cheap because we've kept the model in place.

### 5b — Alternative: keep both, add a real Lead → Deal conversion workflow

Make `Lead` the pre-qualification record and `Deal` the active-opportunity record. Stop the parallel-stages problem by deleting the late-stage stages from Lead's enum, and add an explicit conversion that creates a Deal.

**What ships:**

1. New endpoint `POST /api/leads/:id/convert-to-deal`. Body: `{ customerId?, dealTitle, value, expectedCloseDate, contactId? }`. Creates a Customer (if `customerId` not supplied) via the existing `convertLead()` flow, then creates a Deal pointing at the Customer with the Lead's metadata copied over. Sets `Lead.status='converted'` and writes `lead_converted_to_deal` AuditLog row linking Lead UUID ↔ Deal UUID.
2. Migration to add `converted` to `Lead.status` enum and remove `proposal | negotiation | won` (since those move to Deal). `won` rows are migrated to `converted`. Pre-existing `proposal | negotiation` rows on prod get bumped to `qualified` and a Deal is auto-created for each (5 rows max, given prod counts).
3. `LeadDetail.jsx` gets a "Convert to Deal" button visible when `Lead.status='qualified'`. Modal collects deal title/value/close date.
4. Tooltips clarify: Lead = pre-qualification, Deal = active opportunity.
5. Mobile gets a new `(tabs)/deals.tsx` screen (currently doesn't exist) and the Lead detail page gets a Convert action.

**Why this is the right call ONLY if Alex wants the strict separation:**

- Best metric hygiene: dead leads literally cannot show up in pipeline-value reporting because they're in a different table.
- Cleanest mental model if conversion is a real moment (typically: signed NDA, MSA, or first paid sample order).

**Why this is overkill in practice:**

- Adds a new conversion workflow Alex has to remember to use. If he forgets, the Deal table stays empty and we're back where we started.
- Builds a new mobile screen for a record type that currently has 0 production rows.
- Doubles maintenance cost (two list views, two detail pages, two forms, two sets of brand-scope checks).
- The "dead leads don't pollute pipeline" benefit is achievable in (5a) with a `WHERE` clause, no new model needed.

---

## 6 — Recommendation: 5a

The prod state is decisive. `Lead` is the operational record. `Deal` was always aspirational and has stayed empty long enough to confirm it's the wrong abstraction for this workflow.

Going forward, Lead is the pipeline. The mental model becomes: "every prospect is a Lead. The stage tells you where they are." `new | contacted` = top-of-funnel, `qualified | proposal | negotiation` = open pipeline (counts for metrics), `won | lost` = terminal.

---

## 7 — Implications for Phase 4.8 Commit 3 (mobile stage chips + filter pills)

### If Alex picks 5a (recommended)

Stage list for the Leads list view on mobile uses the Lead enum verbatim, color-coded by lifecycle bucket:

| Stage | Bucket | Color token |
|---|---|---|
| `new` | top-of-funnel | steel |
| `contacted` | top-of-funnel | steel |
| `qualified` | open pipeline | brand accent (SH=forest, FW=iron) |
| `proposal` | open pipeline | brand accent |
| `negotiation` | open pipeline | brand accent |
| `won` | terminal positive | green |
| `lost` | terminal negative | bronze |

No separate Deals list view is needed on mobile because Deals retire as a user-facing surface. The desktop `DealPipeline.jsx` rewires to read Lead-grouped-by-status under the same hood.

Other affected mobile screens use their existing stage enums (Quotation, SalesOrder, PurchaseOrder, Invoice, Inquiry) with the same color buckets where applicable. Factories has Active/Inactive only, no stage; an Active/Inactive filter pill is the closest analog.

### If Alex picks 5b

Lead and Deal each keep their own stage enums and color mappings. Commit 3 ships filter pills for both, and a new `(tabs)/deals.tsx` screen has to be built first. That's significantly more work and depends on the 5b conversion-workflow commit landing first, which is not in Phase 4.8 scope.

---

## 8 — Open questions for Alex before Commit 3 starts

1. **Pick 5a or 5b.** Default recommendation is 5a per above.
2. **If 5a, do you want a human-readable `Lead.leadNumber` (LD-YYYYMMDD-XXX) added during the rewire?** Not strictly required for Commit 3, but easy to add while we're touching the model.
3. **If 5a, is keeping the old `/crm/pipeline` endpoint as an alias for one release acceptable, or just delete it now?** Keeping the alias is safer; deletion is cleaner. No external callers exist that we know of.
4. **Color token for "open pipeline" — should it be the brand accent (forest for SH rows, iron for FW rows) OR a single neutral like steel?** I'd lean brand-accent so the same stage reads differently across brands, but the alternative is fewer colors on a busy list view.
