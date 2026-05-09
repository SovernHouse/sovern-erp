# ERP Debug — Systematic Root-Cause Methodology

**Version:** 1.0 | **Created:** 2026-04-30
**Adapted from:** vendetta-debug (Vendetta Saloon)
**Use for:** Any bug, crash, wrong data, silent failure, broken API, or unexpected behaviour in the Trading ERP (backend Node.js/Express, frontend React/Vite, SQLite/Sequelize, admin/customer/factory portals).

**Philosophy:** Random edits are forbidden. Understand first, fix second. A bug fixed without understanding its root cause will resurface or be replaced by a worse one.

---

## PHASE 0 — TRIAGE: Which Layer?

Before touching a single file, identify which layer the bug lives in. ERP bugs almost always look like frontend problems but live in the backend.

### The Layer Walk (MANDATORY for any data, auth, or business logic bug)

| Layer | What to test | How |
|-------|-------------|-----|
| 1. Database | Is the data actually wrong in SQLite? | `python3 -c "import sqlite3; c=sqlite3.connect('backend/database.sqlite'); print(list(c.execute('SELECT * FROM Leads LIMIT 5')))"` |
| 2. Backend API | Does the endpoint return correct data when called directly? | Browser console or Insomnia: `fetch('/api/crm/leads', { headers: { Authorization: 'Bearer TOKEN' } }).then(r=>r.json()).then(console.log)` |
| 3. Auth/Middleware | Is the token valid? Is requireRole working? | Check for 401/403 responses. Verify the token in jwt.io. Check requireRole call signature (L-031: pass bare strings, never an array) |
| 4. Sequelize/ORM | Is the query correct? Are associations defined? | Add temporary `logging: console.log` to sequelize config; read the SQL it generates |
| 5. Frontend service | Is the API call constructed correctly? | Check `services/api.js` — does it use the shared axios instance with the auth interceptor? (L-032: never import axios directly) |
| 6. Frontend state | Is the component using stale state or wrong data? | React DevTools, check useState / useEffect dependencies |

**Stop at the first layer that fails.** Fix that layer. Do not move upward until the layer below passes.

### Common ERP Misdiagnosis Traps

- **"The form doesn't save"** — usually not the form. Usually the API returns an error the form silently swallows. Open Network tab first.
- **"The table shows wrong data"** — check the API response before editing the component. If the API returns correct data, the bug is in the component. If not, it's backend.
- **"Auth broke"** — check requireRole call signature. `requireRole(['admin'])` passes an array, which always fails (L-031). Should be `requireRole('admin')`.
- **"Associations not working"** — verify both sides of the association are defined. Lead.hasMany(Activity) AND Activity.belongsTo(Lead). Missing one side causes "X is not associated to Y" errors.
- **"JSON field is a string"** — if a JSON field returns `"{\"key\":\"value\"}"` (double-encoded), somewhere JSON.stringify was called on a value Sequelize already serializes (L-023).
- **"Works in dev, broken in prod"** — check env vars. `.env` is not committed. Check that all required vars are in the production environment.

### The 2-Attempt Rule

After 2 failed fix attempts on the same bug:
1. STOP writing code.
2. Trace the full call chain from user action to error. Write it down: `LeadsPage.createLead() → POST /api/crm/leads → requireAuth → requireRole('manager') → crmController.createLead() → Lead.create() → FK error`.
3. The bug is in the layer you haven't looked at yet.
4. If still stuck: add targeted console.log at each step of the call chain. Remove all logs when resolved.

---

## PHASE 1 — REPRODUCE

Create the smallest failing case. If you can't reproduce it reliably, you can't fix it.

**For API bugs:**
```javascript
// Minimal repro in browser console (replace token and id as needed)
const token = localStorage.getItem('authToken');
fetch('/api/crm/leads/LEAD_ID', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
```

**For Sequelize bugs:**
```javascript
// Add temporary logging to sequelize config
const sequelize = new Sequelize({ ..., logging: console.log });
// Read the SQL it generates. If the table name is wrong, check freezeTableName.
// If a FK constraint fails, check the references: block in the model.
```

**For model association bugs:**
```javascript
// Test the association in isolation
const { Lead, Activity } = require('./backend/models');
// Check: does Lead.associations have 'activities'?
console.log(Object.keys(Lead.associations));
```

**Data to gather for every bug report:**
- Which page / which action?
- Which user role?
- What did the user expect? What did they see?
- HTTP status code in Network tab?
- Full error message (not just "something went wrong")?
- Browser console errors?
- Backend log output at the time of the error?

---

## PHASE 2 — ISOLATE

Narrow to the exact line that fails. Options in order of speed:

1. **Read the error message carefully.** SQLite errors include the table name and column. Sequelize errors include the association name. React errors include the component and the prop that was undefined.
2. **Grep for the error string** across the whole codebase: `grep -r "SequelizeForeignKeyConstraintError\|is not associated to\|Cannot read properties of undefined" backend/ frontend/`
3. **Binary search the call chain.** Add a `console.log('CHECKPOINT A')` halfway down the function. If it fires, the bug is in the second half. Repeat.
4. **Check the migration vs the model.** If the schema was changed manually, the model and the database may be out of sync. Run `node backend/scripts/check-tables.js` if it exists, or inspect the table schema directly.

---

## PHASE 3 — FIX

Fix rules:
- **Fix the root cause, not the symptom.** A try/catch that swallows the error is not a fix.
- **One change at a time.** Don't refactor surrounding code while fixing a bug. Surgical changes only.
- **Write a test for the failure mode first** (if time allows). At minimum, manually verify the failing case before and after the fix.
- **Check for siblings.** If Activity.js had wrong FK references, check Contact.js, Deal.js, and any other model that references Users or Customers — they likely have the same pattern.
- **Document in lessons.md.** Every bug fixed is a lesson. Format: `L-XXX — short title` + root cause + fix + rule for the future.

---

## PHASE 4 — VERIFY

Before declaring done:
- [ ] The specific failing action now works (not just "the code looks right")
- [ ] Siblings checked — same bug not present in related files
- [ ] No regressions introduced — other related pages/actions still work
- [ ] Backend logs show no new errors
- [ ] lessons.md updated if a non-obvious pattern was involved

---

## ERP-Specific Bug Patterns (Known Issues Catalogue)

| Pattern | Root Cause | Fix |
|---------|-----------|-----|
| `requireRole` always returns 403 | Called with array: `requireRole(['admin'])` | Use bare strings: `requireRole('admin')` (L-031) |
| Axios calls return 401 on every request | Component imported axios directly, bypassing auth interceptor | Import `api` from `services/api.js` (L-032) |
| JSON field returns double-encoded string | `JSON.stringify()` called on a DataTypes.JSON field before Sequelize serializes it | Pass raw JS objects/arrays to JSON fields (L-023) |
| Activity INSERT fails with `no such table: main.Users` | `references: { model: 'Users' }` in model file, but table is `User` (freezeTableName:true) | Remove `references:` blocks; rely on associations |
| `Activity is not associated to Lead!` | Missing inverse association | Add `Lead.hasMany(Activity)` to Lead.associate |
| Boot error cascades to `undefined.hasMany` | Silent catch in model loader masked a real load error | Per-model loader with targeted MODULE_NOT_FOUND catch |
| Website RFQ creates no ERP lead | RFQ webhook uses wrong API endpoint | Use `/api/webhook/rfq`, NOT `/api/inquiries` (L-024) |
| SQLite native binary fails on Linux | `sqlite3` package compiled for Windows | Use Python `sqlite3` module for Linux inspection (L-025) |
