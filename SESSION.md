# SESSION.md — Current Work State

> This file is maintained by Cowork at the end of every session so Claude Code can pick up without losing context. Read this at the start of every session before doing anything else.

---

## Last Updated
2026-05-08 (Taiwan time, eighth session — triage MCP tool gap closed + complete Dev Mode AI feature shipped: spec'd Phases 0-3, Sessions 1-4 built and deployed, plus boot-sync safety net + pre-existing TS error fixes)

---

## Where We Are

### CI Status
- **Latest commit:** `677d280` (Dev Mode Session 4 - mobile parity). All four Dev Mode session commits + the triage MCP commit have shipped CI green and deployed successfully. A small fix-up commit (boot-sync safety net + TS error fixes) follows this update.
- CI status: verify with `github_list_runs` after the next push.

### VM Status
- **ERP online and stable.** No crashes reported during the dashboard/AI/RBAC/e-sign work.
- **vm_exec MCP tool: WORKING** (key in `~/.ssh/authorized_keys` on the VM).
- **pm2 still running with `--exp-backoff-restart-delay 100 --max-restarts 15`.**
- **Deploy:** Frontend builds on the GitHub Actions runner. VM only runs `npm install --omit=dev` (backend) + `pm2 restart`. Peak VM memory during deploy stays under 200MB. `~/deploy.sh` on the VM is **outdated** (still does `npm install` from root which can pull Vite). Do not use it. The GH Actions workflow is the canonical deploy path.

### Mobile Status — RECOVERED + PARITY ROUNDS 1+2 SHIPPED ✅
- **"Won't open" turned out to be Expo Go's stale cached `exp://192.168.0.47:8081` URL pointing at a Metro server that wasn't running.** Not a code crash. Resolved by restarting Metro and switching to EAS Update for laptop-free operation (see Deploy Process below).
- **EAS Update wired up:** `eas update --branch preview --platform ios` publishes JS to Expo's CDN at `https://u.expo.dev/76a4e7a2-6585-4212-aa0c-1f8cfe7e001f`. Phone fetches the bundle from Expo's CDN every time it opens — laptop can be off. Free tier ($0/year, 1k MAU). Token lives in `$env:EXPO_TOKEN` (PAT, not password).
- **Mobile parity round 1 (commit `0d2c371`):** AI rename conversation, e-sign display on quotation+PO, customer/inquiry delete, L-014 hooks-rule fix.
- **Mobile parity round 2 (commit `f06a0f6`):** Factories list + detail modal + delete (server blocks if open POs); registered in `(tabs)/_layout.tsx` and `dashboard.tsx` module grid.
- **Mobile parity round 3 (commit `72bd041`):** Sales Orders tab (list + status filter + detail modal with e-sign card and line items), Quotation Sourcing Trail → Factory tap-through (deep-links to factories tab via `?openId=` param), Inquiry → Quotation convert action with navigation to the new quotation detail.
- **Mobile parity round 4 (this commit):** Sign-link generation on Quotation/SO/PO detail screens (✉️ "Send for signature" CTA → `POST /api/approvals/generate` → native Share sheet); merged AI-generated approve tasks into the Approvals tab (fetches `/api/scheduled-activities/my` filtered to type='approve' alongside the existing `/api/internal-approvals` source, badges each row Manager/AI, mark-done action for AI rows).
- **Mobile is now at full parity** with desktop for all in-app surfaces. ✅

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

## Outstanding parity backlog

- **Factory PO supplier-side sign view** — public-link supplier flow (no auth, no app install). The supplier never installs the Sovern Ops app, so there's no mobile counterpart to build. **However:** the *triggering* of this flow (generating the sign-back link) IS now on mobile via the "Send for supplier signature" CTA in the PO detail modal, plus the same for SO and Quotation. Round 4. ✅
- **Approvals AI-generated items** — `ScheduledActivity` rows of type='approve'. Mobile's Approvals tab now fetches both `/api/internal-approvals` AND `/api/scheduled-activities/my` (filtered to type='approve' + status='pending') and merges them with a "Manager" / "AI" badge on each row. Mark-done handler wired for AI rows. Round 4. ✅

All parity items from the 29-commit backlog are now shipped. ✅

## This session (2026-05-08) — all four dev-mode sessions shipped + triage MCP tool

**Session arc:** triage MCP tool fix → Dev Mode AI feature spec'd Phases 0-3 → Sessions 1-4 of Dev Mode build all pushed and deployed in this single working session at Alex's request. CI green on all four pushes. Live on the VM.

**Commits in this session (newest first):**
- `c509942` triage MCP tool + Dev Mode Session 1 (DB skeleton)
- `4d7b837` Dev Mode Session 2 (sandbox + subprocess + runner + notifier)
- `3907598` Dev Mode Session 3 (admin portal UI + Dev Mode toggle)
- `677d280` Dev Mode Session 4 (mobile parity)
- (pending TS+sync fix commit at end of this session)

### Track 1 — Triage MCP tool gap closed (small, contained)
**What:** AI-in-ERP previously had `list_triage_items` / `get_triage_item` but no way to flip a triage item's status without picking between dedicated `/spam`, `/dismiss`, `/archive`, `/promote`, `/forward-fanzey` endpoints. Alex hit this trying to mark a Frontech reply as processed from the ERP chat.

**Files staged (commit candidate 1):**
- `backend/controllers/triageController.js` — new `updateTriageItem` handler; status-only, validates against the real enum.
- `backend/routes/triageRoutes.js` — new `PATCH /api/triage/:id` route, placed after specific action routes.
- `backend/mcp/erpToolServer.js` — new `update_triage_item` MCP tool case + tool-list entry; fixed the wrong status enum on `list_triage_items` (was 'processed, archived'; real enum is pending/promoted/forwarded/spam/dismissed/archived).
- `backend/services/aiContextService.js` — system prompt mentions the new tool + correct status values.
- `mobile/sovern-ops-app/src/services/api.ts` — `updateTriageItem(id, { status })` helper + `TriageStatus` type.

**Important correction:** the original ERP-chat brief said allowed statuses were `pending / processed / archived`. That was wrong. Real enum lives on `backend/models/TriageItem.js`.

**Mobile parity:** ✅ shipped same change set.

### Track 2 — Dev Mode AI feature: specced + Session-1 backend skeleton
**What:** New capability that lets Alex (super_admin only) make ERP code changes from the in-ERP AI chat (web + mobile) while traveling, without bouncing to Cowork. AI subprocess runs in a sandboxed git worktree on the GCP VM, opens a feature-branch PR via `gh`, Alex merges from GitHub mobile.

**Spec confirmed across Phases 0–3 in chat.** Key decisions:
- **Trigger:** explicit "Dev Mode" toggle in chat header (super_admin only). Regular AI nudges to switch when it detects a code-change ask.
- **Architecture:** PR flow only. No direct push to main. You always merge.
- **Edit scope:** whole repo except `.env*`, `.github/workflows/*`, deploy scripts, `data/erp.db`, `*.key`, `*.pem`, `secrets/*`.
- **Secrets:** hard block. New env vars proposed via `.env.example` + chat instruction. No password-gated read path (rejected — prompt-injection vector).
- **Sandbox:** same GCP VM, fresh worktree under `/home/alex/sovern-erp-dev-runs/<runId>/`, non-root user.
- **Time budget:** 30-min hard timeout.
- **Caps:** max 5 runs / rolling 24h, max 30 turns / run, auto-pause if regular AI was rate-limited in last hour. (Max-sub model — no dollar cap; cost is rolling-window availability.)
- **Failure:** commit what works → WIP PR → report blocker. No prod write.
- **Mid-run Q&A:** lightweight (added per Alex's pushback). AI exits cleanly with `awaiting_clarification`, you answer in chat, backend re-invokes with prior context. 30-min answer timeout falls back to WIP PR.
- **Notifications:** in-chat reply + Expo push + Resend email summary.
- **Audit:** full DB-backed `DevModeRun` table.
- **Whitelabel:** sovereign-only in v1; decide later for commercialization.

**Files staged (commit candidate 2 — Session-1 backend skeleton):**
- `backend/models/DevModeRun.js` (NEW) — Sequelize model. 25 fields. `tableName: 'DevModeRuns'` so L-034 doesn't apply. JSON columns (`filesChanged`, `tokenUsage`) follow L-023 (no JSON.stringify). User FK declared in `.associate()`.
- `backend/models/index.js` — register `db.DevModeRun`. The existing `Object.keys(db).forEach(... .associate)` loop wires the User belongsTo automatically.
- `backend/controllers/devModeController.js` (NEW) — skeleton for `startRun`, `getRun`, `listRuns`, `answerClarification`, `abortRun`. `startRun` enforces the 5-runs/24h cap and the no-concurrent-runs rule, then creates a `queued` row and returns 202. The actual subprocess kickoff is hooked here in Session 2.
- `backend/routes/devModeRoutes.js` (NEW) — mounts under `/api/dev-mode`, gated by `requireAuth` + `requireRole('super_admin')` (L-031: bare string).
- `backend/server.js` — register `/api/dev-mode` routes.
- `mobile/sovern-ops-app/src/services/api.ts` — `startDevModeRun`, `getDevModeRun`, `listDevModeRuns`, `answerDevModeClarification`, `abortDevModeRun` + `DevModeRun` interface + `DevModeRunStatus` type. Mobile UI ships in Session 4.

**Smoke test passed:** `node -e "require('./models')"` loads the model cleanly. Table name is `DevModeRuns`, 25 fields, `requester` association live.

**What's NOT in this session:** the actual subprocess that does code work (Session 2), the chat toggle UI (Session 3), the mobile Dev Mode screens (Session 4), the gh CLI auth + gitleaks setup on the VM (Session 2 infra).

---

## Dev Mode — what's live now (post Session 4 + boot-sync fix)

| Surface | Status |
|---|---|
| `/api/dev-mode/runs` (start/get/list/answer/abort) | ✅ live, super_admin only, 401 without auth |
| `/api/push-tokens/*` (register/unregister/list) | ✅ live, any auth user |
| `DevModeRuns` + `ExpoPushTokens` SQLite tables | ✅ created (manual sync first, then via belt-and-braces fix in server.js) |
| Sandboxed claude subprocess + worktree + PR opener | ✅ live (gh CLI 2.92, gitleaks 8.30.1 installed on VM) |
| Three-channel notifier (in-app / Expo push / Resend email) | ✅ live; Expo push silently no-ops until mobile registers tokens |
| Boot recovery for stale runs | ✅ live |
| Admin portal: Dev Mode toggle + DevRunCard + /ai/dev-runs audit page | ✅ live |
| Mobile: Dev Mode toggle + DevRunCard + /dev-runs audit screen | ✅ live |
| Mobile push token registration (native side) | ⏳ deferred — needs expo-notifications + expo-device + EAS dev-client rebuild |

## Known issues found this session

- **Boot-time `sequelize.sync()` silently skipped DevModeRuns + ExpoPushTokens.** Models loaded fine, route registered fine, but `sqlite_master` showed no tables after pm2 restart. Root cause unconfirmed — suspected interaction with `define: { freezeTableName: true }` and explicit `tableName:` overrides hitting an "already exists" early-abort path on an unrelated index. **Mitigation shipped:** belt-and-braces explicit `db.DevModeRun.sync()` + `db.ExpoPushToken.sync()` in server.js boot chain. Idempotent on subsequent boots.
- **Pre-existing TS errors fixed in this session** (Alex requested):
  - `mobile/sovern-ops-app/app/(tabs)/activities.tsx:221` — `stickySectionHeaders` → `stickySectionHeadersEnabled` (correct prop in current React Native types).
  - `mobile/sovern-ops-app/app/lead/[id].tsx:98` — `item.note || item.type` → `item.subject || item.description || item.type`. The Activity model has no `note` field; data was always falling through to `item.type` because `item.note` is undefined.

## Next Task

**Session 5 (when ready, native build needed):** Mobile push notifications. Add `expo-notifications`, `expo-device`, `expo-constants`. Configure app.json (notification permissions, channel for Android). Add a hook that registers the device's Expo push token on login and calls `registerPushToken()`. Trigger a fresh EAS dev-client / production build (native deps don't ship via EAS Update OTA). Test end-to-end: dev-mode run → push lands on phone → tap → opens GitHub PR.

**First real test of the live system:** open the AI Assistant on web or mobile, switch on Dev Mode (super_admin toggle in chat header), say "add a comment to backend/server.js explaining the dev-mode boot recovery hook" or similar trivial change, watch the DevRunCard go through queued → running → opening_pr → completed, then merge the PR from your phone.

**Mobile parity status:** Full parity for Dev Mode UI surfaces. Push notification UI is the only deferred item, scoped explicitly above.

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

All previously-deferred items resolved this session:
- ✅ **Mobile app "launch crash"** — was actually a stale Expo Go cached `exp://` URL. Resolved via EAS Update OTA pipeline; phone now loads JS from Expo's CDN, no laptop required.
- ✅ **Mobile parity gap** — four rounds of porting work shipped; mobile is at full parity with desktop.
- ✅ **Drive page manager permissions** — new `GET /api/google/accounts/available` endpoint (any authenticated user) feeds the Drive picker. `/api/google/accounts` (with sync telemetry) stays admin-only.
- ✅ **Sentry @sentry/node v9 → v7** — downgraded; `instrument.js` does real `Sentry.init()` with a defensive try/catch + no-op shim fallback. server.js wired to `Sentry.Handlers.requestHandler()` (early) + `errorHandler()` (before custom errorHandler).
- ✅ **`~/deploy.sh` on VM** — original script preserved as `~/deploy.sh.bak.20260507`; replaced with a tombstone that exits 1 and points at GH Actions / `pm2 restart`.

No regressions introduced. The TLS-inspection workaround (`NODE_TLS_REJECT_UNAUTHORIZED=0`) was also retired this session — `NODE_EXTRA_CA_CERTS` set persistently on Alex's Windows session, pointing at a PEM dump of the Windows trust store. `eas update` now works without disabling cert validation.

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
