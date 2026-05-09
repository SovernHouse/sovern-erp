# ERP Feature Directive — Spec-First Protocol for New ERP Features

**Version:** 1.0 | **Created:** 2026-04-30
**Adapted from:** vendetta-feature-directive (Vendetta Saloon)
**Use for:** Any new ERP feature, module, or significant change. No code written until a spec exists and Alex confirms it. Prevents the most expensive failure pattern: building the wrong thing efficiently.

---

## Why This Skill Exists

The most expensive pattern in ERP development is:
1. Alex gives an instruction: "add a landed cost calculator"
2. The AI builds something that vaguely fits the description
3. Alex sees it — it's missing key fields, doesn't match the trade workflow, or is over-engineered
4. Re-do for 2–4 sessions

This is not a coding problem. It is a specification problem. The instruction was never converted into a concrete, verifiable spec before code was written. This skill forces that conversion.

**Rule: No code is written until a spec exists and Alex has confirmed it.**

---

## When This Skill Activates

Load whenever an instruction contains:
- "Add a [module / feature / screen]"
- "Build a [calculator / form / dashboard / report]"
- "I want to be able to [do X] in the ERP"
- "Can we add..."
- "Integrate with [external service]"
- "The [existing feature] should also..."
- Any instruction that would create new database schema, new API routes, or new frontend pages

---

## The Five Phases

### Phase 0 — The Grill (MANDATORY)

Ask ONE question at a time. Wait for the answer. Keep going until you can describe the feature to a stranger and they could build it without asking anything.

**Minimum 5 questions. Hit ALL these categories:**

1. **User and trigger** — Which role uses this? (Alex/admin, customer, factory, manager?) What event triggers them to open this feature?

2. **Data model** — What new fields or tables does this need? Does it touch existing models (Lead, Order, Factory)?

3. **Scope boundary** — What is this NOT? What is the MVP vs the full vision? What is explicitly out of scope for v1?

4. **Business logic** — Are there calculations involved? Validation rules? State transitions? Workflow steps? What are the edge cases (zero values, missing data, concurrent edits)?

5. **Whitelabel angle** — Is this Sovern-specific or general-purpose? Should it be configurable? Would a whitelabel customer in auto parts or garments need this too?

6. **Integrations** — Does this need to connect to email, PDF generation, a third-party API, or another module in the ERP?

7. **Permissions** — Which roles can see it? Which can edit it? Which can delete?

8. **Output/deliverable** — What does the user see when they're done? A record saved? A PDF downloaded? An email sent? A dashboard updated?

9. **Success criteria** — How does Alex know this is working correctly? What does he check?

10. **Failure modes** — What's the worst-case if this ships broken? Data corruption? Wrong invoice sent to a client? Or just ugly UI?

**Exit criteria:** You can write a one-paragraph feature summary covering: who it's for, what it does, what it doesn't do, what data it touches, what the output is, how success is measured, and what breaks if it fails.

Show Alex the summary paragraph. Get a "yes, that's it" before Phase 1.

---

### Phase 1 — Identify the Affected Layers

Map out every layer the feature touches:

| Layer | What's affected |
|-------|----------------|
| Database | New tables? New columns? Modified indexes? |
| Backend models | New model? Association changes? |
| Backend API | New routes? Modified controllers? New middleware? |
| Frontend | New page? New component? New service call? |
| Existing features | Does this change how any existing feature behaves? |
| External systems | Email? PDF? Third-party API? |

Flag any **irreversible decisions** — database schema choices, API contracts consumed by the customer/factory portal, document templates. Get these right; be flexible on everything else.

---

### Phase 2 — Write the User Stories

Use this format for every story:

```
As a [role],
I want to [action],
so that [outcome / business value].

Acceptance criteria:
- [ ] Observable, testable criterion 1
- [ ] Observable, testable criterion 2
- [ ] Observable, testable criterion 3

Out of scope (v1):
- Feature X (defer to v2)
```

At least one story per actor. At least one acceptance criterion that a QA engineer could verify without Alex's interpretation.

---

### Phase 3 — Data Model Design

Before writing any code, sketch the schema:

```javascript
// Example: Landed Cost Calculation
{
  id: UUID,
  inquiryId: UUID (FK → Inquiries),
  customerId: UUID (FK → Customers, optional),
  productDescription: STRING,
  fobPrice: DECIMAL(15,4),
  currency: STRING (default 'USD'),
  incoterm: ENUM('EXW','FOB','CIF','DDP',...),
  freightCost: DECIMAL(15,4),
  insuranceCost: DECIMAL(15,4),
  dutyRate: DECIMAL(5,4),  // 0.0750 = 7.5%
  customsBrokerFee: DECIMAL(15,4),
  otherCosts: JSON,  // [{label, amount}]
  totalLandedCost: DECIMAL(15,4),  // computed
  marginTarget: DECIMAL(5,4),
  sellingPrice: DECIMAL(15,4),  // computed
  createdBy: UUID (FK → Users),
  notes: TEXT
}
```

Check:
- [ ] No double-encoded JSON fields (pass raw objects, not JSON.stringify())
- [ ] No inline `references:` blocks if `freezeTableName: true` is set (L-023, L related)
- [ ] All FK relationships also defined in `.associate()`
- [ ] Schema is whitelabel-compatible (no Sovern-specific constraints)

---

### Phase 4 — Build

Now write code. Rules:
- Build the migration script first (schema before code)
- Build and test the backend endpoint before the frontend
- Use the shared API service (`import api from '../../services/api'`) — never raw axios
- Follow the existing controller pattern: `{ getAll, getById, create, update, delete }`
- Add the route to the router and register in `server.js`
- Build the frontend page last, using the confirmed API response shape

---

### Phase 5 — QA Gate

Before declaring done, run `erp-qa.md` Pre-Ship Regression Checklist for the affected module. Confirm:
- [ ] CRUD works
- [ ] Permissions enforced correctly
- [ ] JSON fields return objects/arrays (not strings)
- [ ] Frontend shows loading state, empty state, and error state
- [ ] Mobile layout holds at 390px
- [ ] lessons.md updated if any non-obvious pattern was discovered

---

## ERP Feature Backlog Format

When a feature is requested but not yet specced, add it to the backlog with this format:

```
## [Feature Name]
Status: Backlog / Speccing / In Progress / Done
Requested: [date]
Class: Core / Vertical-Specific / Sovern-Specific / Experimental
Affected layers: [DB / API / Frontend / External]
Notes: [one line summary of what was requested]
Spec: [link to spec doc when written]
```

Maintain the backlog in `PRODUCT_ARCHITECTURE.md` or a dedicated `erp-backlog.md`.
