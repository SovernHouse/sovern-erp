# SESSION.md — Current Work State

> This file is maintained by Cowork at the end of every session so Claude Code can pick up without losing context. Read this at the start of every session before doing anything else.

---

## Last Updated
2026-05-09 (Taiwan time, tenth session continued — Expenses module FULLY OPEN TO ALL USERS. Permission model changed: expenses routes now gated on `requireAuth` (all users) with user-scoping in controller so non-super_admin users see only their own expenses. Offices/Trips/Submissions remain super_admin-only. Ownership checks added to getExpense/updateExpense/deleteExpense. Mobile app immediately ready for Alex to log expenses. Three-Surface Rule documented (lessons.md L-035) and super_admin principle (lessons.md L-036) added.)

---

## Where We Are

### CI Status
- **Latest commit:** `1ec1313` (admin Expenses page — item 4f). All session commits CI green and deployed. Backend health 200 confirmed live.
- **Commits this session (newest first):**
  - `1ec1313` feat(expenses): admin Expenses page with offices + report generation (4f)
  - `98700fb` feat(reports): GET /api/customers/:id/profitability — client P&L (4e)
  - `f3da278` feat(expenses): /expense, /expenses, /expense-report slash commands (4d-2)
  - `e5c3b5e` feat(expenses): Drive exporters + report-generation endpoint (4d-1)
  - `8a5e97c` feat(expenses): receipt photo → AI extraction (4c)
  - `f064838` chore: track laptop setup + skills sync scripts
  - `f8b0c52` docs: SESSION.md — wrap up tenth session, items 0-3 + 4a+4b shipped (mid-session save)
  - `cca01a7` fix(expenses): inline auth gate per route (don't break /api/health)
  - `f02dd7c` feat(expenses): controllers + routes for all four resources (4b)
  - `ded660e` feat(expenses): models — Expense, ReimbursementOffice, Trip, Submission (4a)
  - `add0d37` fix(backend): pin pdf-parse to 1.1.1 (Node 18 compat) + sync lock file
  - `348fd15` feat(ai-chat): photo + document attachments — mobile + admin (item 3 UI)
  - `77f09b4` feat(ai-chat): attachment uploads + read_attachment MCP (item 3 backend)
  - `826036b` feat(ai-chat): slash command autocomplete (item 1.5)
  - `87d9793` feat(ai-chat): voice input — mobile press-and-hold + admin web (item 2)
  - `2d0145b` docs(spec): resolve all 5 DECIDEs + office-list question
  - `01bb7e4` fix(ai-chat): copy/paste — stable keys + memoised bubble + copy actions
  - `b9e40c9` docs: spec — AI UX wins (copy/paste, voice, photos) + expenses module
  - `5cf2f99` feat(mobile): swap Settings for AI Assistant in bottom nav (item 0)
- Two CI failures + two fix-ups along the way: (1) `pdf-parse@2.4.5` required Node ≥20 but CI runs Node 18 → pinned to `1.1.1`; (2) expenseRoutes `router.use(requireAuth)` mounted at `/api` blocked `/api/health` → moved to inline middleware per route. Both fixed and shipped.

### VM Status
- **ERP online and stable.** No crashes during the AI Web Access work. Backend health 200 throughout the swap.
- **NGINX UPDATED on VM (manual swap, this session):** `/etc/nginx/sites-enabled/sovern-erp` now has `proxy_read_timeout 270s` + `proxy_send_timeout 270s` on `/api/`. Old version had a special `/api/ai/` block with 150s; new config drops it because /api/ already covers it via prefix matching. Two `.bak` files moved out of `sites-enabled/` to `sites-available/` to silence "conflicting server name" warnings; nginx -t now warning-free. The repo's `infra/nginx/sovern-erp.conf` is the source of truth.
- **vm_exec MCP tool: NOW WORKING ON MAC** (this Mac, not just Windows Cowork). New SSH key generated at `~/.ssh/id_ed25519` and pubkey installed on VM `~/.ssh/authorized_keys`. New `sovern-vm` MCP server at `~/.claude/mcp-servers/sovern-vm/server.js` exposes `vm_exec(command, timeout_ms?)` and `vm_status` tools. Registered in `~/.claude/settings.json`. Loads on next Claude Code restart in this directory.
- **OS: kernel update pending.** VM is showing `*** System restart required ***` from accumulated apt updates. Not from our work. Schedule a reboot window when convenient; pm2 + the deploy workflow handle the restart cleanly.
- **pm2 still running with `--exp-backoff-restart-delay 100 --max-restarts 15`.**
- **Deploy:** Frontend builds on the GitHub Actions runner. VM only runs `git reset --hard origin/main` + `npm install --omit=dev` (backend) + `pm2 restart`. Peak VM memory during deploy stays under 200MB. `~/deploy.sh` on the VM is **outdated** (still does `npm install` from root which can pull Vite). Do not use it. The GH Actions workflow is the canonical deploy path. **Note:** the workflow does NOT auto-copy the nginx config to `/etc/nginx/sites-enabled/`. Future infra/nginx/ changes still require a manual VM-side swap (now trivially doable via `vm_exec`).

### Mobile Status — RECOVERED + PARITY ROUNDS 1+2 SHIPPED ✅
- **"Won't open" turned out to be Expo Go's stale cached `exp://192.168.0.47:8081` URL pointing at a Metro server that wasn't running.** Not a code crash. Resolved by restarting Metro and switching to EAS Update for laptop-free operation (see Deploy Process below).
- **EAS Update wired up:** `eas update --branch preview --platform ios` publishes JS to Expo's CDN at `https://u.expo.dev/76a4e7a2-6585-4212-aa0c-1f8cfe7e001f`. Phone fetches the bundle from Expo's CDN every time it opens — laptop can be off. Free tier ($0/year, 1k MAU). Token lives in `$env:EXPO_TOKEN` (PAT, not password).
- **Mobile parity round 1 (commit `0d2c371`):** AI rename conversation, e-sign display on quotation+PO, customer/inquiry delete, L-014 hooks-rule fix.
- **Mobile parity round 2 (commit `f06a0f6`):** Factories list + detail modal + delete (server blocks if open POs); registered in `(tabs)/_layout.tsx` and `dashboard.tsx` module grid.
- **Mobile parity round 3 (commit `72bd041`):** Sales Orders tab (list + status filter + detail modal with e-sign card and line items), Quotation Sourcing Trail → Factory tap-through (deep-links to factories tab via `?openId=` param), Inquiry → Quotation convert action with navigation to the new quotation detail.
- **Mobile parity round 4 (this commit):** Sign-link generation on Quotation/SO/PO detail screens (✉️ "Send for signature" CTA → `POST /api/approvals/generate` → native Share sheet); merged AI-generated approve tasks into the Approvals tab (fetches `/api/scheduled-activities/my` filtered to type='approve' alongside the existing `/api/internal-approvals` source, badges each row Manager/AI, mark-done action for AI rows).
- **Mobile is now at full parity** with desktop for all in-app surfaces. ✅

---

## Recently Shipped (this stretch — eight sessions, 53 commits)

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

## This session (2026-05-09 tenth session — partial Item 4 + AI UX wins)

**Trigger:** Alex's four-then-five-asks: better copy/paste, voice input, photo attachments, expenses module, mobile nav rearrangement (Settings → AI Assistant in bottom nav). Plus a slash-command autocomplete add during the build.

**Spec:** `docs/features/2026-05-09-ai-ux-and-expenses-spec.md` — six items, five DECIDE blocks all resolved (voice langs EN+ZH-TW+ZH-CN, voice send=auto-fill manual-tap, file Read enabled with whitelist, P&L=revenue share + direct-cost ratio, no historical backfill). Office list = no seed; admin self-service.

### Shipped this session

- **Item 0 — mobile bottom nav swap** (commit `5cf2f99`): Settings off the bar, AI Assistant on. Settings still reachable via Home grid. ✅ live now.
- **Item 1 — copy/paste fix** (commit `01bb7e4`): root cause was `keyExtractor={(_,i)=>String(i)}` on FlatList + un-memoised admin MessageBubble — both re-mounted bubbles on every append, killing in-progress text selection. Stable keys + React.memo + admin hover-copy button + mobile long-press Share sheet. ✅ live now.
- **Item 1.5 — slash command autocomplete** (commit `826036b`): type `/` → filtered command list above input. ↑↓/Tab/Enter to insert (admin); tap to insert (mobile). ✅ live now.
- **Item 2 — voice input** (commit `87d9793`): mobile press-and-hold 🎙️ via expo-speech-recognition; admin web `webkitSpeechRecognition` toggle. Auto-fills input, manual send. Multi-lang. ✅ admin live now; mobile pending EAS native rebuild.
- **Item 3 backend — attachments + read_attachment MCP** (commits `77f09b4`, `add0d37`): POST /api/ai/attachments uploads to user's Google Drive (Sovern ERP/AI uploads/YYYY-MM/). aiChat accepts attachments[]. New `read_attachment(file_id)` MCP tool returns: images→MCP image content (vision), PDFs→pdf-parse text, DOCX→mammoth text, XLSX/XLS→exceljs per-sheet rows, Google Docs/Sheets→Drive export, text/CSV→direct read. Legacy `.doc` rejected with re-save instruction. New deps: pdf-parse@1.1.1 (Node 18 compat) + mammoth@1.12.0. MCP dispatcher gained `__mcpContent` escape hatch for non-text content. ✅ live now.
- **Item 3 UI — pickers + chips + thumbnails** (commit `348fd15`): mobile 📎 button with Take photo / Choose photo / Choose file action sheet (expo-image-picker + expo-document-picker); admin file input + drag-drop. Pending attachment chips above composer with remove (×). Hard cap of 5 attachments per message. Inline thumbnails for images in chat history; file chips for non-images. ✅ admin live now; mobile pending EAS native rebuild.
- **Item 4a — expense models** (commit `ded660e`): four new tables — Expense (26 fields), ReimbursementOffice, Trip, ExpenseSubmission. Multi-currency by design. All FKs in `.associate()` per L-034. JSON columns raw per L-023. ✅ live (tables created on next backend boot via belt-and-braces lateAdditions sync).
- **Item 4b — expense controllers + routes** (commits `f02dd7c`, `cca01a7`): full CRUD for all four resources at /api/expense-offices, /api/expense-trips, /api/expenses, /api/expense-submissions. Auto-create "Personal" office on empty table per spec. FX conversion via existing ExchangeRate model. createSubmission groups + flips status + snapshots totalsByCurrency. updateSubmission with paidAt propagates to all rows in batch. ✅ live now (regression-fixed: auth gate moved from router-level to per-route inline middleware so /api/health 200 stays unauthenticated).

### Items shipped after the mid-session save

- **Item 4c (commit `8a5e97c`)** — `POST /api/expenses/extract-from-receipt`. Synchronous endpoint that spawns claude -p with the ERP MCP, reads the receipt via `read_attachment`, and returns a structured JSON `{entryDate, originalCurrency, originalAmount, vendor, suggestedCategory, suggestedDescription, country, confidence, notes}` for the UI to render as a pre-filled draft. Currency-disambiguation rules built into the system prompt (NT$ → TWD, ¥ → CNY, ₫ → VND, ฿ → THB).
- **Item 4d-1 (commit `e5c3b5e`)** — Drive exporters in `backend/services/expenseExporters.js`: three templates (`expense_to_alex_v2`, `inspector_travel_v2`, `custom_csv`) + a `generateReport` dispatch function. New endpoint `POST /api/expense-submissions/:id/generate-report` builds the XLSX, uploads to Drive at `Sovern ERP/Expense reports/<office.code>/YYYY-MM/`, stamps `submission.exportFileDriveFileId`. Smoke-tested locally: produces a 6.9KB multi-currency XLSX matching the source-sheet shape.
- **Item 4d-2 (commit `f3da278`)** — three new slash commands on both surfaces: `/expense <amount> <ccy> <description>` (parses tolerant input including currency symbols, creates a draft Expense), `/expenses [unpaid|all]` (lists recent rows), `/expense-report <office-code>` (bundles drafts into a submission, generates XLSX, returns a Drive link). Slash regex order: `/expense-report` before `/expense` so it matches first. Slash autocomplete catalog now shows 8 commands.
- **Item 4e (commit `98700fb`)** — `GET /api/customers/:id/profitability?from=&to=`. Returns revenue/COGS/directExpenses/allocatedOverhead/grossProfit/netProfit/directCostRatio. Allocation by revenue share per DECIDE 4B; direct-cost ratio surfaced as a separate column for the high-touch signal. Default period: trailing 12 months. v1 treats stored numerics as USD-equivalent (most Sovern invoices are USD); a fuller per-invoice FX conversion is left for v2.
- **Item 4f (commit `1ec1313`)** — `frontend/admin-portal/src/pages/Expenses/ExpensesPage.jsx`. Single-page UI: filter strip (status, paid, office) + per-currency totals + table with edit/delete + drawer create/edit form + "Generate report" office picker that runs createSubmission → generateReport and opens the Drive XLSX in a new tab + nested OfficesModal for full ReimbursementOffice CRUD with exportTemplateKey picker. Wired at `/expenses` route; sidebar nav entry added.

### Items NOT yet shipped (next-session work)

- **Mobile expense entry UI** — needs the EAS native rebuild first (camera + document picker — items 2 + 3 native deps). Then expense entry screens for the on-the-road flow (camera → AI extract via `/api/expenses/extract-from-receipt` → draft form). Backend support is fully ready.
- **Customer profitability page UI** — endpoint shipped (4e); a dedicated chart-y page with the per-line breakdown is the natural next add. AI can already call the endpoint via `erp_query` or a direct fetch in chat for ad-hoc reporting.
- **Receipt-attached-via-chat → expense flow** — when Alex drops a receipt photo into the AI chat, the AI sees it via `read_attachment`. A natural next iteration: a system-prompt rule that nudges "want me to log this as an expense?" + a thin slash like `/log-expense <conversation-attachment>` that wires the existing extraction endpoint to chat.

### Known blockers / pending operational items

- **EAS native rebuild required for mobile.** Items 2 (voice) and 3 (photos) added three native deps (`expo-speech-recognition`, `expo-image-picker`, `expo-document-picker`). They live in `mobile/sovern-ops-app/package.json` + `app.json` (microphone, camera, photo library, speech recognition permissions). Run `cd mobile/sovern-ops-app && eas build --platform ios --profile preview` (~15-20 min). EAS Update OTA will NOT pick these up — only `eas build` will.
- **`docs/features/2026-05-09-ai-ux-and-expenses-spec.md`** is the source of truth for what's still TODO + the five locked DECIDEs. Read at session start before resuming Item 4.

---

## This session (2026-05-09 ninth session) — AI Web Access feature shipped end-to-end (5 commits)

**Trigger:** Alex sent a mobile screenshot showing HTTP 502 on the AI Assistant when he asked it to "do deep research and search the internet and its resources for potential Canadian clients for us to send emails to". Diagnosis: `backend/controllers/aiController.js:65` had `WebFetch,WebSearch` in `--disallowed-tools`, AI couldn't fulfill the ask, looped past the 120s subprocess kill timer, backend returned 502.

**Spec'd inline (no skill files locally — fresh clone) following the Dev Mode Phase 0–3 pattern. Locked decisions:**
- **Tier 1 (chat, synchronous):** enable WebSearch + WebFetch in the chat subprocess for travel/quick-lookup asks (hotels, restaurants, contacts, transit, news). Bump kill timer 120 → 240s, nginx 150 → 270s, admin axios 140 → 260s. AI may call existing MCP tools (create_calendar_event, create_contact, create_lead) to persist findings.
- **Tier 2 (background, asynchronous):** Two slash commands `/new-clients` and `/new-suppliers` kick off background `claude -p` runs (20-min cap, 3 concurrent + 10/24h per user) that return draft Lead or Factory rows with source URL + evidence on each. Three-channel notifier (in-app message appended to chat + Expo push + Resend email). Mode is explicit (no NL ambiguity for entity type).
- **Three lookup commands `/clients`, `/suppliers`, `/products`:** instant ERP queries via existing list endpoints, rendered inline. Client-side parsing.

**Commits in this session (newest first):**
- `e06a93d` Tier 2 UI — slash commands + research tab on mobile + admin
- `0bab448` Tier 2 list_customers MCP tool + slash-command system prompt (also fixed an unescaped backtick in aiContextService.js template literal that I introduced in 5a96d3f — would have crashed `require()` on the VM, caught locally before deploy)
- `ad5a8c4` Tier 2 runner: real subprocess + dedup + draft creation + notifier
- `1ec6f01` Tier 2 backend skeleton — ResearchTask model + controller + routes + boot recovery
- `5a96d3f` Tier 1: enable WebSearch+WebFetch in chat + raise timeouts

### Track 1 — AI Web Access (Tier 1 + Tier 2)

**Backend (Tier 1):**
- `backend/controllers/aiController.js` — removed WebFetch/WebSearch from disallowed-tools; bumped kill timer 120 → 240s.
- `backend/services/aiContextService.js` — new "Slash commands" + "Web access" + "When NOT to use Tier 1 web tools" sections in the system prompt. Reinforced no-fictional-data rule. Documented natural-language sourcing fallback (AI nudges toward /new-X rather than attempting in chat).
- `infra/nginx/sovern-erp.conf` — added `proxy_read_timeout 270s` + `proxy_send_timeout 270s` to `/api/`. Manually swapped on VM (see VM Status above).
- `frontend/admin-portal/src/services/api.js` — bumped `aiAPI.chat` axios timeout 140 → 260s. Mobile fetch path has no timeout (unchanged; the original 502 was the backend itself returning 502 from controller line 203).

**Backend (Tier 2):**
- `backend/models/ResearchTask.js` (NEW) — `tableName: 'ResearchTasks'`. Fields: mode (clients|suppliers), brief, conversationId (link back to AIConversation for result append), status (queued/running/completed/failed/cancelled), summary, findings (JSON array of {type, draftId|null, companyName, sourceUrl, evidence, dedupedAgainst|null, skipped?}), findingsCount, draftsCreated, duplicatesFound, tokenUsage, subprocessPid, timing. User + AIConversation FKs in `.associate()` per L-034.
- `backend/controllers/researchController.js` (NEW) — startTask/getTask/listTasks/cancelTask. Per-user caps: 3 concurrent + 10 / rolling 24h.
- `backend/routes/researchRoutes.js` (NEW) — `/api/research`, gated `requireAuth` + `requireRole('admin', 'super_admin')` (bare strings — L-031).
- `backend/services/researchRunner.js` (NEW) — spawns `claude -p` subprocess with WebSearch/WebFetch + ERP MCP, 20-min hard timeout, JSON output parser. dedupAndCreateDrafts validates required fields (Lead.email + Factory.email + Factory.phone are all non-null), dedups against existing Lead/Customer/Factory by email and companyName, creates draft rows with source URL on each. Recovery for orphaned `running` rows on boot (same pattern as devModeRunner).
- `backend/services/researchNotifier.js` (NEW) — in-app message appended to AIConversation (primary surface) + Notification row + Expo push + Resend email summary. All best-effort.
- `backend/server.js` — mount `/api/research`, add 'ResearchTask' to lateAdditions sync list, wire boot-recovery hook.
- `backend/mcp/erpToolServer.js` — new `list_customers` MCP tool (the missing lookup wrapper). Mirrors list_factories shape. Description tells the AI: do NOT use this for sourcing NEW prospects — use /new-clients.

**Frontend (mobile):**
- `mobile/sovern-ops-app/src/services/api.ts` — research helpers + types (ResearchTask, ResearchTaskMode, ResearchTaskStatus, ResearchFinding).
- `mobile/sovern-ops-app/app/(tabs)/assistant.tsx` — parseSlashCommand + runSlashCommand helpers. Branch added at top of handleSend (before the dev-mode branch). Two /new-X push an immediate "Research started" assistant message; runner's notifier appends the result to the same conversation when done.
- `mobile/sovern-ops-app/app/(tabs)/research.tsx` (NEW) — list + detail modal. Status pill, mode badge, brief preview. Detail shows summary + findings with status (created / deduped / skipped) and tap-through to created Lead/Factory rows. 15s polling while any task is in-flight. Cancel action on non-terminal rows.
- `mobile/sovern-ops-app/app/(tabs)/_layout.tsx` — register `research` as hidden secondary tab with BackToHome header.
- `mobile/sovern-ops-app/app/(tabs)/dashboard.tsx` — added 🔎 AI Research tile to module grid.

**Frontend (admin):**
- `frontend/admin-portal/src/services/api.js` — `researchAPI` = { startTask, listTasks, getTask, cancelTask }.
- `frontend/admin-portal/src/pages/AI/AssistantPage.jsx` — same parseSlashCommand / runSlashCommand helpers in JSX form, branch at top of handleSend.
- `frontend/admin-portal/src/pages/AI/ResearchPage.jsx` (NEW) — table + drawer detail. Status + mode filters, 15s polling while in-flight. Drawer shows summary + findings; clicking a finding with a draftId navigates to /crm/leads/:id or /factories/:id.
- `frontend/admin-portal/src/App.jsx` — `/ai/research` route, gated to admin + super_admin.
- `frontend/admin-portal/src/config/rbacConfig.js` — sidebar nav entry.

### Track 2 — VM ops MCP (Mac side)

**Why:** The original SESSION.md said `vm_exec` MCP tool was working, but that was on the Windows Cowork machine. This Mac had zero SSH keys; the AI couldn't run sudo commands on the VM autonomously. Alex wanted to fix this properly so future infra ops don't gate on him pasting commands.

**What landed (NOT in git — these are local-machine + Mac-side files):**
- `~/.ssh/id_ed25519` — generated this session, no passphrase (MCP must SSH non-interactively — same security posture as Alex on this Mac running the commands himself, since access is gated on the Mac being unlocked).
- VM `~/.ssh/authorized_keys` — pubkey installed via GCP browser SSH paste (one-time bootstrap; comment is `alex-mac@sovern-erp`).
- `~/.claude/mcp-servers/sovern-vm/server.js` (NEW) — hand-rolled JSON-RPC stdio MCP server, zero deps, models the in-repo erpToolServer.js pattern. Two tools: `vm_exec(command, timeout_ms?)` (free-form ssh, default 60s, max 600s) and `vm_status` (uptime + free + df + pm2 list + pm2 logs).
- `~/.claude/settings.json` — added `mcpServers.sovern-vm` registration.

The MCP loads on next Claude Code start in this directory. Today the nginx swap was done via raw Bash (since SSH already worked); subsequent VM ops in future sessions will use `vm_exec` directly.

---

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

**Highest priority: real test of everything that just shipped.**

1. **Test the new admin Expenses page** at `/expenses`. Create an office (Settings > Offices > New). Pick `expense_to_alex_v2` as the template. Manually log 2-3 expenses across different currencies. Run "Generate report" — should produce an XLSX in Drive at `Sovern ERP/Expense reports/<office.code>/YYYY-MM/` matching the existing template shape.
2. **Test slash commands in admin chat:** `/expense 142 TWD taxi`, `/expenses unpaid`, `/expense-report SOVERN_TW`.
3. **Test receipt extraction:** drop a real receipt photo into the AI chat (📎 button). AI should call `read_attachment`, see the image, and read out the structured fields. Then on the admin Expenses page, create from those values manually for now (the explicit "from receipt" UI flow is a v2 add).
4. **Test the client P&L endpoint:** `curl https://erp.sovernhouse.co/api/customers/<id>/profitability` (with auth header). Verify revenue + cogs + directExpenses + allocatedOverhead + netProfit + directCostRatio all populate sensibly.

**EAS native rebuild still owed for mobile:**
- `cd mobile/sovern-ops-app && eas build --platform ios --profile preview` (~15-20 min).
- After install, mobile picks up: voice mic button (item 2), camera + library + document picker (item 3), expense entry screens (item 4 mobile UI — to be built once rebuild lands).
- Until then mobile users see voice + 📎 button wired but the underlying native modules aren't bundled, so taps will error.

**Operational:**
- Restart Claude Code in this directory once to load the `sovern-vm` MCP server (registered in `~/.claude/settings.json` last session). Future infra ops use `vm_exec` instead of raw Bash.
- Schedule a VM reboot window for the kernel update (`*** System restart required ***` warning on login). Pre-existing.

**Polish backlog (deprioritised; pick when you have appetite):**
- Receipt-photo-in-chat → "want me to log this as an expense?" prompt → one-click create. Glue between item 3 (chat photos) and item 4 (expenses).
- Customer profitability admin page (the endpoint is live; needs a chart-y UI under `/customers/:id/profitability`).
- Mobile expense entry screens: list + detail + camera capture flow.
- Per-invoice FX conversion in the client P&L (v1 treats numerics as USD-equivalent).

**Mobile parity status:** AI chat at parity once EAS rebuild runs. Expenses module is admin-only until mobile entry UI ships.

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

- **VM SSH (MCP):** Two keys in VM's `~/.ssh/authorized_keys` (not GCP metadata):
  - `sovern-mcp@claude` — the Windows Cowork machine's MCP key (original)
  - `alex-mac@sovern-erp` — this Mac's MCP key (added 2026-05-09 this session)
  If either Mac/Windows loses its private key, regenerate locally and re-paste the matching `echo 'ssh-ed25519 ... >> ~/.ssh/authorized_keys` via GCP browser SSH console (project `local-iterator-495008-e6`, zone us-central1-f, instance `sovern-erp`).
- **VM ops MCP (Mac side):** `~/.claude/mcp-servers/sovern-vm/server.js` exposes `vm_exec(command, timeout_ms?)` + `vm_status`. Registered in `~/.claude/settings.json`. Loads on Claude Code start. Free-form shell over SSH; quotes the command properly so pipes/redirects/sudo work. Default timeout 60s, max 600s.
- **When SSH times out under load:** GCP VM has 958MB RAM. With pm2 exponential backoff, crash loops alone can no longer saturate it. If a runaway process (Vite build, etc.) saturates CPU/RAM, SSH becomes unresponsive — use GCP browser SSH console to kill the offending process.
- **GCP VM:** Disk expanded to 30 GB (pd-standard, free tier). Currently at ~29% usage.
- **ERP DB:** SQLite at `/home/alex/sovern-erp/data/erp.db` on GCP VM `sovern-erp` (us-central1-f).
- **Google auth:** `ConnectedGoogleAccount` model handles all Google OAuth. Use `getAuthClientForAccount()` from `googleAccountController` for Drive/Calendar/Gmail API calls.
- **Mobile app:** Lives at `mobile/sovern-ops-app/` — any ERP feature must also be surfaced there (ERP Three-Surface Rule). At full parity with admin as of this session (AI Web Access shipped to both surfaces in the same commits).
- **Public repo:** `SovernHouse/sovern-erp` is public — never commit IPs, keys, or credentials.
- **Claude `-p` invocation:** Always use `--system-prompt`, `--strict-mcp-config`, `--permission-mode bypassPermissions`, and write the user prompt to stdin (`--tools` is variadic; positional prompts get consumed as tool names).
  - **Chat subprocess** (`backend/controllers/aiController.js` `runClaudeSubprocess`): `--disallowed-tools 'Bash,Read,Write,Edit,Glob,Grep'` — WebFetch and WebSearch are intentionally allowed for travel/quick-lookup asks. 240s kill timer.
  - **Research subprocess** (`backend/services/researchRunner.js` `runResearchSubprocess`): same disallowed list, plus `--output-format json` for token-usage telemetry. 20-min kill timer. Uses the same MCP server as chat (a separate tmpfile config: `sovern-erp-research-mcp-config.json`).
  - **Dev-mode subprocess** (`backend/services/devModeSubprocess.js`): inverts the allowlist — `--allowedTools 'Bash,Read,Write,Edit,Glob,Grep'` ON, ERP MCP OFF (no `--mcp-config`). Sandboxed via `--add-dir` + cwd-pinned to a worktree. 30-min cap.
