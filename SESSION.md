# SESSION.md — Current Work State

> This file is maintained by Cowork at the end of every session so Claude Code can pick up without losing context. Read this at the start of every session before doing anything else.

---

## Last Updated
2026-05-07 (Taiwan time, seventh session — backfill of six prior sessions of dashboard/AI/RBAC work that were never logged)

---

## Where We Are

### CI Status
- **Latest commit:** `b23b7e7` (feat(esign): factory-side PO confirmation + drawn-signature canvas).
- CI status: verify with `github_list_runs` before any new push — the deploy workflow has been green throughout this stretch but specific run state at session-start should be confirmed live.

### VM Status
- **ERP online and stable.** No crashes reported during the dashboard/AI/RBAC/e-sign work.
- **vm_exec MCP tool: WORKING** (key in `~/.ssh/authorized_keys` on the VM).
- **pm2 still running with `--exp-backoff-restart-delay 100 --max-restarts 15`.**
- **Deploy:** Frontend builds on the GitHub Actions runner. VM only runs `npm install --omit=dev` (backend) + `pm2 restart`. Peak VM memory during deploy stays under 200MB. `~/deploy.sh` on the VM is **outdated** (still does `npm install` from root which can pull Vite). Do not use it. The GH Actions workflow is the canonical deploy path.

### Mobile Status — BROKEN ⚠️
- **Mobile app won't open / crashes on launch** as of 2026-05-07. Symptom reported by Alex; root cause not yet pinpointed.
- **No mobile commits since `c8cfff1` (text-selection fix).** 29 backend/dashboard commits have shipped since, none ported to mobile. Mobile is running stale JS against a moved-forward backend.
- **Triage required next session.** See "Next Task" below.

---

## Recently Shipped (this stretch — six sessions, 29 commits)

### E-signature flow (latest) ✅
- **`b23b7e7` feat(esign): factory-side PO confirmation + drawn-signature canvas** — supplier-facing PO approve page with name + drawn signature.
- **`770c812` feat(esign): public approve flips quotation status + stamps signature** — `/api/approvals/public/:token/approve` flips quotation → `accepted`, persists `signedAt` + `signedByClient`, stamps `DocumentApproval`.
- New columns added to `Quotation`, `SalesOrder`, `PurchaseOrder` models: `signedAt`, `signedByClient` / `signedBySupplier` (audit trail). IP/UA stays on the `DocumentApproval` row.

### Dashboard — admin portal only ✅ (NOT on mobile)
- **`972a12b` feat(dashboard): real data + click-through on all four widgets** — RevenueWidget, OrderStatusWidget, PendingApprovalsWidget, RecentActivityWidget all now live; each tile/row routes to its drill-down. Backend `/api/dashboard/admin` now returns `totalQuotations`, `convertedQuotations`, `quoteConversionRate`. Fixed `completionRate` "NaN" when `totalOrders=0`.
- **`5cbe786` fix(dashboard): conversion rate uses accepted quotations, sent denominator** — Quote → Order conversion = `accepted / (status != 'draft')`.
- **`7f56e87` fix: dashboard layout 500 (FK to wrong table) + add inquiry delete** — `DashboardLayout.userId` had inline `references: { model: 'Users' }` but `freezeTableName: true` makes the table singular `User`. Moved FK to `.associate()`. Added inquiry delete endpoint.
- **`986dc6c` fix(dashboard): super_admin can save layout; add MCP delete_calendar_event** — `DashboardLayout.role` ENUM doesn't include `super_admin`; coerce to `admin` on persistence. Added `delete_calendar_event` MCP tool.

### RBAC — super_admin role ✅ (NOT on mobile)
- **`6740222` fix(rbac): super_admin is a strict superset of admin (front + back)** — `requireRole` and `requireAny` short-circuit `next()` when `req.user.role === 'super_admin'`. RoleGuard mirrors this on the frontend.
- **`3b924c5` fix: add super_admin to RBAC config with full permissions and admin nav** — added super_admin entry to `authConfig.rolePermissions` with `['*']`.
- **`1e0b45c` fix: allow super_admin to access Google account management routes** — googleRoutes accepted only `admin`; updated to include super_admin.
- **`0174e41` fix: hide OAuth setup warning when Google account is already connected** — minor UI fix on ConnectedAccounts page.

### CRUD deletes ✅ (NOT on mobile)
- **`0d7080a` fix(crud): customer/factory deletes now actually persist** — Customer + Factory models are paranoid; the previous code did `update({ isActive: false })` which left rows visible because list endpoints don't filter by `isActive`. Switched to `destroy()` which sets `deletedAt` and is filtered out by default.
- Factory delete blocks if there are open POs (`status NOT IN ('completed', 'cancelled')`).
- Inquiry delete added (`7f56e87`); blocks delete when `convertedToQuotationId` is set.

### Cross-link factories ↔ supplier contacts ✅ (NOT on mobile)
- **`888763e` fix(ui): cross-link factories <-> supplier contacts; fix dead buttons** — supplier contacts now render a clickable link to their factory. Several dead buttons on FactoryDetail/ContactList wired up.

### AI Assistant — major overhaul (admin portal only — NOT on mobile)
- **`fdce77c` feat(ai): rename conversations + persist active chat across reloads** — new `/api/ai/conversations/:id` PATCH endpoint with `{ title }`. Active conversation persisted in localStorage on web.
- **`face8e3` feat(ai): create_contact + delete_contact + delete_factory MCP tools**
- **`0c50fee` feat(ai): cross-conversation memory** — last 5 OTHER conversations get appended to system prompt as compact summaries; full content available via `read_conversation` / `search_conversations` MCP tools.
- **`78c3f20` feat(ai): generic erp_query tool + fix list_contacts/list_factories**
- **`14ec928` feat(ai): support custom popup reminders on calendar events**
- **`5310b0e` fix(ai): three root-cause fixes for AI chat 500 + page crash** — header-already-sent guards on every res.json/res.status path in the chat handler.
- **`0f37c86` fix(ai): stop calendar bookings asking for permission/approval** — `--permission-mode bypassPermissions` on `claude -p`.
- **`6d04a25` fix(ai): assume all meeting times are Asia/Taipei unless Alex says otherwise** — system-prompt rule.
- **`5f2936b` fix(ai): pass ERP system prompt via --system-prompt; default 45min meetings** — replaced positional system prompt + Human/Assistant prefixes with `--system-prompt` flag. Cleaner separation, no prompt corruption.
- **`b26f26a` fix(ai): bump axios timeout for /ai/chat to 140s** — must be < nginx `proxy_read_timeout` (150s) but > the 120s subprocess kill.
- **`fa260ea` fix(ai): fix MCP tools not loading in claude -p subprocess** — added `--strict-mcp-config` so `~/.claude.json` global tools are ignored; only `--mcp-config MCP_CONFIG_PATH` is used.
- **`d4d5b3a` feat: approval workflow for AI-created products and quotations**
- **`d7dd643` feat: AI fetches quotation sources directly — triage inbox, Gmail, Drive**
- **`b63ba28` feat: add product catalog MCP tools to AI assistant**
- **`81c2dba` feat: add product spec framework to AI system prompt**
- **`1ee68a3` feat: add quotation-essential fields to product creation and spec framework**
- **`c154c35` feat: configurable margin on create_product (default 5%, override per instruction)**

### Notable backend changes that affect mobile contracts
- `backend/middleware/auth.js` — `requireRole` + `requireAny` short-circuit on super_admin. Should be transparent to mobile.
- `backend/controllers/aiController.js` — new `renameConversation` handler (additive). Mobile `aiChat`/`aiListConversations`/`aiGetConversation` contracts unchanged.
- `backend/controllers/{customer,factory,inquiry}Controller.js` — switched to `destroy()` for soft delete. Response shape `{ success, data, message }` unchanged.
- `backend/models/{Quotation,SalesOrder,PurchaseOrder}.js` — additive `signedAt` + `signedBy*` fields.
- `backend/models/DashboardLayout.js` — FK declared in `.associate()` instead of inline (fixes L-034 bug).

---

## Next Task

**1. Triage mobile launch crash (HIGH priority).**
- Alex reports app won't open / crashes on launch as of 2026-05-07.
- Mobile JS is unchanged since `c8cfff1`; the crash must be runtime (backend contract drift, EAS Update bundle, or native module mismatch).
- Need actual crash text from device — start with `npx expo start` and a real device, capture the red-screen error.
- Likely candidates to investigate first: `/api/auth/me` response shape, `/api/dashboard` response shape, EAS Update channel state.

**2. Mobile parity for the 29-commit dashboard stretch (MEDIUM priority).**
The following changes shipped on admin portal only and need mobile counterparts (per the ERP Three-Surface Rule):
- **super_admin role checks** anywhere mobile gates UI by role (currently mobile likely treats super_admin as unauthorized for admin-only screens).
- **AI assistant:** `aiRenameConversation` API helper + UI; rely on cross-conversation memory implicitly (it's all server-side).
- **Approvals:** AI-generated approval items now flow into `/api/internal-approvals` — confirm mobile `getPendingApprovals` still resolves correctly.
- **Inquiry delete:** add `deleteInquiry` API helper + UI.
- **Customer/factory delete:** add `deleteCustomer`, `deleteFactory` API helpers + UI (currently mobile is read-only for these).
- **E-sign factory PO confirmation:** decide if mobile needs a supplier-facing sign view, or stays purely on web.
- **Quotation/SalesOrder/PurchaseOrder:** surface `signedAt` / `signedByClient` / `signedBySupplier` in detail views.

**3. Resume normal feature work** once 1+2 are clear.

---

## Deploy Process

Deploys are **fully automated** via GitHub Actions. After every push to `main`:
1. CI runs tests (auto)
2. Deploy workflow builds frontend on runner, SCPs dist to VM, restarts backend (auto)
3. Health check passes → green deploy

**Manual emergency restart** (if needed): `vm_exec: pm2 restart sovern-erp`
**Manual full redeploy** (if GH Actions fails): trigger workflow_dispatch from GitHub Actions UI.

---

## Deferred / Known Issues

- **Mobile app launch crash (NEW, HIGH).** See Next Task.
- **Mobile parity gap (NEW, MEDIUM).** 29 commits' worth of dashboard/AI/RBAC work has not been ported. See Next Task.
- **Drive page: manager permissions gap.** `/api/google/accounts` is admin-only but the Drive page is accessible to managers. Managers see "Failed to load connected accounts". Fix requires a separate endpoint that returns Drive-scoped accounts for the current user's role. Low priority.
- **Sentry disabled.** `backend/instrument.js` is a stub. No error tracking until @sentry/node is downgraded to v7. Low priority.
- **`~/deploy.sh` on VM is stale.** Still does `npm install` from root which can pull Vite. Do not use it; the GH Actions workflow is canonical.

---

## Infrastructure Notes

- **VM SSH (MCP):** `vm_exec` and `vm_status` fully working. Key is in `~/.ssh/authorized_keys` directly (not GCP metadata). If SSH auth fails again, run from the GCP browser SSH console:
  `echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKaAg2Dq0Ca8SGbgzUV6maTW9t/AwPAGJpQca1dB5cJX sovern-mcp@claude' >> ~/.ssh/authorized_keys`
- **When SSH times out under load:** GCP VM has 958MB RAM. With pm2 exponential backoff, crash loops alone can no longer saturate it. If a runaway process (Vite build, etc.) saturates CPU/RAM, SSH becomes unresponsive — use GCP browser SSH console to kill the offending process.
- **GCP VM:** Disk expanded to 30 GB (pd-standard, free tier). Currently at ~29% usage.
- **ERP DB:** SQLite at `/home/alex/sovern-erp/data/erp.db` on GCP VM `sovern-erp` (us-central1-f).
- **Google auth:** `ConnectedGoogleAccount` model handles all Google OAuth. Use `getAuthClientForAccount()` from `googleAccountController` for Drive/Calendar/Gmail API calls.
- **Mobile app:** Lives at `mobile/sovern-ops-app/` — any ERP feature must also be surfaced there (ERP Three-Surface Rule). Currently 29 commits behind admin portal.
- **Public repo:** `SovernHouse/sovern-erp` is public — never commit IPs, keys, or credentials.
- **Claude `-p` invocation:** Always use `--system-prompt`, `--strict-mcp-config`, `--permission-mode bypassPermissions`, `--disallowed-tools 'Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch'`, and write the user prompt to stdin (`--tools` is variadic; positional prompts get consumed as tool names). Pattern is in `backend/controllers/aiController.js` `runClaudeSubprocess`.
