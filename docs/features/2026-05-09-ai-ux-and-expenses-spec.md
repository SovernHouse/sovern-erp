# Feature spec — AI chat UX wins + Expenses module

**Date:** 2026-05-09
**Status:** DRAFT — pending Alex review
**Author drafted with Claude Code; Alex to mark up and confirm before any code lands.**

---

## Summary

Six items, ranging from a 5-line nav swap to a multi-table ERP module. Items 3 and 4 are coupled (photos and receipts share infrastructure). Item 4 reuses the already-decided Google Drive storage path.

| # | Item | Size | Surfaces | Blocks |
|---|---|---|---|---|
| 0 | Mobile navbar: replace Settings with AI Assistant | 5 lines | mobile | — |
| 1 | Better copy/paste in AI chat | small | mobile + admin | — |
| 2 | Voice input in AI chat | medium | mobile (primary), admin (web SpeechRecognition) | — |
| 3 | Photo attachments in AI chat (camera + library + drag-drop) | medium-high | mobile + admin + backend | — |
| 4 | Expenses module — entry, categorisation, client attribution, exports | large | full stack (model + 2 frontends + reports + AI extraction) | depends on #3 for receipt photos |
| 5 | (renumbered — see #4) | | | |

Open questions are flagged inline as **❓ DECIDE** blocks. Don't read past those without picking — they shape the work below.

---

## Item 0 — Mobile navbar rearrangement

### Today
`mobile/sovern-ops-app/app/(tabs)/_layout.tsx:17` declares the bottom-nav primary tabs as:

```ts
const NAV_ITEMS = [
  { name: 'dashboard', icon: '🏠', label: 'Home' },
  { name: 'triage',   icon: '📥', label: 'Inbox' },
  { name: 'chat',     icon: '🗨️', label: 'Chat' },        // omnichannel inbox (WhatsApp/Telegram/internal)
  { name: 'settings', icon: '⚙️', label: 'Settings' },
] as const;
```

Note: "Chat" here is the omnichannel inbox (`ChatRoom`/`ChatMessage` models), NOT the AI Assistant. The AI Assistant lives at `app/(tabs)/assistant.tsx` and is currently reachable only via the Home grid.

### Change

Replace the `settings` entry with `assistant`:

```ts
const NAV_ITEMS = [
  { name: 'dashboard', icon: '🏠', label: 'Home' },
  { name: 'triage',   icon: '📥', label: 'Inbox' },
  { name: 'chat',     icon: '🗨️', label: 'Chat' },
  { name: 'assistant', icon: '✦', label: 'AI' },
] as const;
```

Settings remains reachable via the Home grid (already a tile in `dashboard.tsx`). Update `PRIMARY_TABS` set on line 15 to swap `settings` → `assistant`.

### Effort
~5 lines, one commit. No back-end, no migration. Ships independently.

---

## Item 1 — Better copy/paste in AI chat

### What's broken today

**Mobile (RN):** message bubbles use `<Text>` without `selectable={true}`. RN defaults to non-selectable text. So long-pressing a bubble selects the whole bubble (or fails entirely). You can't drag a selection to grab one word, or extend across multiple bubbles.

**Admin (web):** the AI message renderer wraps content in `<div>`s with default `user-select: text` — selection works at the character level — BUT the markdown rendering function in `AssistantPage.jsx` re-renders on every chat update which BLOWS AWAY any in-progress selection. That's the "can only copy one block at a time" symptom.

### Fix — mobile

- Add `selectable={true}` to every `<Text>` rendering message content in `assistant.tsx` (and any inner text components like `MessageBubble`-equivalent).
- Add a `selectable` prop to the markdown-stripped text spans inside the bubbles.
- iOS-specific: set `selectionColor={COLORS.forest}` to match brand.
- Long-press menu: iOS gives "Copy / Look Up / Share" automatically once `selectable` is on. Android also gives "Copy / Select All" automatically. No custom menu code needed.
- One nice-to-have: a "Copy whole reply" button on long-press of the bubble (renders alongside the system menu via `onLongPress` + Share API). Optional; default selection menu probably good enough.

### Fix — admin

- Memoise `MessageBubble` with `React.memo` keyed on `message.id` so re-renders don't tear the DOM under the user's selection.
- Inside the markdown renderer, ensure no `key={Math.random()}` or `key={Date.now()}` patterns (need to audit `renderMarkdown` in `AssistantPage.jsx` line 30).
- Guarantee text nodes don't get unmounted/remounted during the streaming append. Streaming additions should append to the LAST node, not replace it.

### Effort
~30-60 mins each surface. One commit each. Ships independently.

---

## Item 2 — Voice input

### Mobile

**Library:** `expo-speech-recognition` (community package, MIT, wraps `SFSpeechRecognizer` on iOS and `SpeechRecognizer` on Android). Alternative: native module — more code, no real upside.

**UX:**
- A 🎙️ button to the LEFT of the existing send button in `assistant.tsx`'s composer.
- Press-and-hold to record; release to stop AND auto-send (or auto-fill the input field, see DECIDE below).
- Visual feedback: while recording, button pulses and shows partial transcription as input-field placeholder text.
- Permission flow on first use — handled by the library; just need to register `NSSpeechRecognitionUsageDescription` and `NSMicrophoneUsageDescription` in `app.json` `ios.infoPlist`.

**Native build needed?** YES — adding `expo-speech-recognition` is a native dependency. Won't ship via EAS Update OTA. Trigger a fresh dev-client / production build (same as the deferred push notification work in SESSION.md).

### Admin (web)

**API:** Browser `webkitSpeechRecognition` (Chrome/Safari/Edge — Firefox needs a polyfill). Since admin is desktop-only and you use Chrome, this works without any library.

**UX:** Same 🎙️ button pattern, click-to-toggle recording (no press-and-hold on web — clunky).

### Languages

**❓ DECIDE 2A** — pick recognition language(s):

- **A. English only** — simplest, you said earlier you primarily speak English.
- **B. EN + ZH-TW (Mandarin Traditional)** — auto-detect, since you're in Taiwan and might dictate Chinese phrases (factory names, place names, etc.).
- **C. EN + ZH-TW + ZH-CN (Mandarin Simplified)** — your factories are mostly in mainland China; some inspector names + place names are Simplified. Slight overhead.

Default if you don't pick: **B** (matches your travel pattern).

### Auto-send behavior

**❓ DECIDE 2B** — what happens when you release the record button:

- **A. Auto-send immediately** — fastest, no chance to edit a misheard word.
- **B. Auto-fill the input field; you tap send** — safer, lets you review and tweak before sending.
- **C. Auto-fill, send after 2-second silence detected after the release** — middle ground.

Default if you don't pick: **B** (you've talked about email approval rules in CLAUDE.md — same instinct: review before send).

### Effort
~3-4 hours mobile (incl. native rebuild), ~1-2 hours admin. One commit each surface.

---

## Item 3 — Photo attachments in AI chat

### Storage decision (already locked)

**Google Drive.** Reuses your existing `ConnectedGoogleAccount` OAuth + the in-repo `search_drive_files` / `read_drive_file` MCP tools. New folder created on first use: `Sovern ERP / AI uploads / YYYY-MM/`. Subfolder per month so it stays browsable as it grows.

### Upload paths

**Mobile (camera + library):**
- 📎 button next to send. Tap → action sheet: "Take photo" / "Choose from library" / "Pick a file".
- Library: `expo-image-picker` (already common in RN). File picker: `expo-document-picker`.
- Take photo: `expo-image-picker` `launchCameraAsync()`. Permission flow handled by lib.
- Native build needed for both pickers — combine with #2's voice native rebuild into one EAS dev-client cycle.

**Admin (web):**
- Same 📎 button. Click → file input. Drag-and-drop on the message area also works (existing patterns).

### Backend flow

1. Frontend uploads bytes to a NEW endpoint `POST /api/ai/attachments` → backend writes to Google Drive via the user's `ConnectedGoogleAccount`, returns `{ driveFileId, mimeType, sizeBytes, thumbnailUrl, name }`.
2. Frontend includes the `driveFileId` array in the `aiChat` payload: `{ message, conversationId, attachments: [{ driveFileId }] }`.
3. Chat controller passes attachments to the `claude -p` subprocess as image inputs. Two ways to do that with the CLI:
   - **A.** Download bytes from Drive into a tempfile, then pass `--image /tmp/xyz.jpg` (Claude CLI accepts image flags).
   - **B.** Pass via the system prompt as `[Image: <drive-file-id>]` markers and let an MCP tool (`read_drive_file_as_image`) fetch them on-demand. Slower but no tempfile management.

   Recommended: **A** for performance; clean up tempfile on subprocess exit.

4. Conversation `messages` JSON gets a new shape: `{ role, content, attachments: [{ driveFileId, name, mimeType, thumbnailUrl }], createdAt }`. Mobile + admin renderers show inline thumbnails.

### Vision model

Claude Opus 4.7 has native vision. The `claude -p` CLI accepts image inputs alongside text. No Anthropic API change needed — same subprocess pattern as today.

### Effort
~6-8 hours total. New endpoint + Drive integration + subprocess plumbing + 2 frontend surfaces + image rendering in message bubbles. One feature, ~3-4 commits.

---

## Item 4 — Expenses module

The big one. Spec'd to support both your existing flows + the new AI capabilities + client P&L integration.

### 4.1 — What exists today (your sheets)

**Flow A — "Expense to Alex YYYY.xlsx"** (your personal claim):

```
Title:         Unpaid Expense to Alex YYYY
Header row:    Date | Item | Description | RMB Amount | THB amount | VDN amount | TWD amount | USD Amount
Body rows:     one per expense, amount in original-currency column + USD conversion
Marker rows:   "The above expense has been paid on [date]"  ← splits paid vs unpaid
Total row:     "Total Unpaid Amount" with per-currency sums
```

Item categories observed: Salary, Bonus, Travel, Rent, Visa, Ticket, Office, Flight, Taxi.
LAU-only variant: same template, pre-filtered to one client = manual proto-attribution.

**Flow B — "Inspector's travel expense application form"** (per-inspector, per-trip, billed to clients):

```
Title:         Travel expense application form - 旅行费用申请表
One sheet per inspector: WJW, ZDC, ZLZ, ZLY, LQY, SZ, TDC, WDQ, WXK, Archie, Johnson
Header row:    Date | Days | Customer name | Factory | Factory location | Mode of transport |
               Customer order # | Factory Contract # | Reason for travel | Product |
               Container | Meal allowance | Travel fee | Hotel fee | PM | Labour cost
Subtotal rows: per-month "Mar 2023 Total"
Plus:          "MASTER DATA" tab with avg.travel cost/trip + No. Trips per inspector per location
Plus:          "summarizing" tab + "Date" tab
Currency:      CNY only (China-based work)
```

Customer codes seen: WIN, JMC, KTB, WES, PFE, SHAW, LAU, TOR, KUP, BWF, OSD, FFL, OSB, VIG, etc. — these match (or should match) Customer rows in the ERP.

### 4.2 — Data model

New tables:

#### `Expense`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `entryDate` | DATE | When the expense happened (not when entered). |
| `category` | STRING | Free text initially; suggest `ExpenseCategory.code` lookup later. |
| `description` | TEXT | Free text — what it was. |
| `originalCurrency` | STRING(3) | ISO 4217 (RMB/CNY, TWD, USD, THB, VND, CAD, HKD, etc.). |
| `originalAmount` | DECIMAL(15,2) | In original currency. |
| `usdAmount` | DECIMAL(15,2) | Converted at entry-date FX. Stored, not re-derived (locks the rate at submission time, matches your sheet). |
| `fxRateUsed` | DECIMAL(12,6) | The original→USD rate at conversion. Audit trail. |
| `paidAt` | DATE NULLABLE | NULL = unpaid; set when reimbursement received. Mirrors your "above paid on..." markers. |
| `paidByOfficeId` | UUID FK → ReimbursementOffice | Which office paid. |
| `customerId` | UUID FK NULLABLE → Customer | Direct attribution (e.g. LAU trip costs go on LAU's P&L). |
| `factoryId` | UUID FK NULLABLE → Factory | When the expense is factory-side (inspector trip). |
| `quotationId` / `purchaseOrderId` | UUID FK NULLABLE | Even tighter linkage when known (e.g. inspector trip for PO X). |
| `inspectorId` | UUID FK NULLABLE → User | When trip was performed by an inspector, not by Alex. |
| `tripId` | UUID FK NULLABLE → Trip | Multi-day trip aggregation (see Trip below). |
| `submittingOfficeId` | UUID FK NULLABLE → ReimbursementOffice | Which office this expense will be claimed FROM (your "more than one office" answer). |
| `submissionStatus` | ENUM | `draft` / `submitted` / `paid` / `rejected` / `not_claimable`. |
| `submissionBatchId` | UUID FK NULLABLE → ExpenseSubmission | Groups expenses into a single submitted report. |
| `receiptDriveFileIds` | JSON array | Drive file IDs of receipt photos (uses item #3's Drive infra). |
| `aiExtractedFromDriveFileId` | STRING NULLABLE | If AI created this row from a receipt photo, which file. |
| `aiExtractionConfidence` | DECIMAL(3,2) NULLABLE | 0.00–1.00, AI's confidence. Low = needs human review. |
| `notes` | TEXT NULLABLE | Free notes. |
| `createdAt` / `updatedAt` | timestamps | |

#### `ReimbursementOffice`

The "more than one office" answer maps to a small lookup table. Each office has its own format/rules.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `code` | STRING | Short code (e.g. `SOVERN_TW`, `IFL`, `PARENT_HK`). |
| `displayName` | STRING | "Sovern House Taiwan", "IFL Flooring", etc. |
| `defaultCurrency` | STRING(3) | Reimbursement happens in this currency. |
| `claimsFrequency` | ENUM | `monthly` / `quarterly` / `ad_hoc`. |
| `acceptedCategories` | JSON array | Whitelist of categories this office covers. Empty = all. |
| `exportTemplateKey` | STRING NULLABLE | Which exporter to use ("expense_to_alex_v2" / "inspector_travel_v2" / "custom_csv"). NULL until first report run; UI prompts to pick on first export. |
| `notes` | TEXT NULLABLE | Free notes about the office, contact person, where to send the report. |

**Default values for new offices:** `claimsFrequency = 'ad_hoc'`, `exportTemplateKey = NULL`, `acceptedCategories = []` (= all). Alex tightens these per office as patterns emerge.

**Seed:** none. Table is empty by default. Alex creates offices via the admin UI as needed; a default placeholder office "Personal" can be auto-created on the first expense if no office has been registered yet, so the very first expense entry doesn't get blocked on office setup.

#### `ExpenseSubmission`

A single batch report sent to one office.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `officeId` | UUID FK → ReimbursementOffice | |
| `periodStart` / `periodEnd` | DATE | Reporting window. |
| `submittedAt` | DATE NULLABLE | NULL until you mark submitted. |
| `paidAt` | DATE NULLABLE | When reimbursement landed. |
| `exportFileDriveFileId` | STRING NULLABLE | Drive ID of the generated XLSX report. |
| `totalsByCurrency` | JSON | Snapshot: {RMB: 38000, USD: 9527.85, ...}. |
| `notes` | TEXT NULLABLE | |

#### `Trip` (optional, but cleaner)

Groups multiple expense rows into a logical trip ("Vietnam trip Apr 2023" = 12 rows). Used by the export to render trip-level subtotals matching how Flow B's monthly subtotals work.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | STRING | "Vietnam Apr 2023", "Canada visit Jun 2023" |
| `startDate` / `endDate` | DATE | |
| `purpose` | TEXT NULLABLE | |
| `primaryCustomerId` | UUID FK NULLABLE → Customer | When the whole trip was for one client. |
| `inspectorId` | UUID FK NULLABLE → User | When an inspector did the trip. |

#### `FxRate` (probably already exists)

We need exchange rates. SESSION.md mentions an `ExchangeRate` model (`db.ExchangeRate = require('./ExchangeRate')(sequelize)`). Reuse it — store the rate at expense-entry time. Auto-fetch from a free FX API (e.g. exchangerate.host) cached daily; let users override.

### 4.3 — UX surfaces

#### A. Mobile expense entry (the on-the-road flow)

Flow optimised for: standing at a taxi rank, just paid, want to log it before forgetting.

1. Open Expenses tab from Home grid (new tile 💰).
2. Tap big **+** FAB → bottom sheet with three buttons:
   - 📷 **Take photo of receipt** (most common)
   - ✍️ **Manual entry** (fallback)
   - 🎙️ **Voice entry** ("142 Taiwan dollars taxi from airport to hotel for the LAU trip") — uses item #2's voice infra.
3. **Photo path:** camera → photo uploaded to Drive (item #3 infra) → backend kicks off an AI receipt-extraction job (asynchronous, like the research runner pattern from this morning's work). AI returns: `{date, amount, currency, vendor, suggestedCategory, suggestedCustomerId, suggestedTripId, confidence}`. Mobile shows a draft expense form pre-filled with these — you tap edits, confirm, save.
4. **Voice path:** transcript → AI extracts the same fields → same draft form.
5. **Manual path:** form with the fields above; Customer + Trip are searchable dropdowns.

#### B. Mobile expense list

- Default view: "Unpaid expenses" — what's owed to you, sectioned by ReimbursementOffice.
- Filter: by trip, by client, by date, by status.
- Tap row → detail with linked receipt photos (tap to view full-screen via Drive).
- Swipe action: mark paid, delete, change office.

#### C. Admin expense entry + report generation

- Same fields, fuller table view.
- "Generate report" button on `/expenses/submissions` → pick office + date range → render XLSX matching that office's `exportTemplateKey`. Save to Drive, mark submission row, send to your specified email/share if configured.

#### D. AI chat integration

New slash commands:

- `/expense <amount> <currency> <description>` → quick-add an unattributed expense (Alex types this on the fly).
  Example: `/expense 142 TWD taxi from airport for LAU trip` → creates an Expense row with AI-suggested customerId=LAU, tripId=current LAU trip if one is open.
- `/expenses` → list recent expenses (last 20), filter by `unpaid`, `by-office`, etc.
- `/expense-report <office>` → kicks off the report-generation flow.

Plus the AI naturally handles photos: drop a receipt into chat → AI extracts, asks "create an expense row?" → you say yes → row created.

Plus the AI can read local files: "ask AI to read a file on my computer" — works via the existing claude `-p` Read tool, but that tool is currently DISABLED in the chat subprocess. **❓ DECIDE 4A**: do we re-enable file Read for the chat subprocess so the AI can read e.g. an emailed PDF receipt off your laptop? Risk: prompt injection from a malicious file could direct the AI to do other reads. Mitigation: limit Read to a whitelist of paths (`~/Desktop`, `~/Downloads`, the repo). Recommended: **yes, with whitelist**.

### 4.4 — Client profitability integration

The whole point of attribution. Once expenses carry a `customerId` (or roll up via `tripId.primaryCustomerId`), we can extend the existing client-reporting code:

- New endpoint `GET /api/customers/:id/profitability?from=&to=` returns:
  ```
  {
    revenue:           { invoiced, paid, currency: 'USD' },
    cogs:              { factoryCosts, currency: 'USD' },     // from PurchaseOrders
    directExpenses:    { total, count, currency: 'USD' },     // expenses where customerId = X
    allocatedExpenses: { total, basis, currency: 'USD' },     // share of "general business" expenses, allocated by revenue %
    grossProfit:       revenue - cogs,
    netProfit:         revenue - cogs - directExpenses - allocatedExpenses,
    period:            { from, to },
  }
  ```
- New page in admin: `/customers/:id/profitability` — same data, charted.
- Mobile: small profitability card on the Customer detail screen.

**❓ DECIDE 4B** — allocation basis for "general business" expenses (rent, software, your salary) that aren't tied to one client:

- **A. Allocate by revenue share** — if LAU was 30% of revenue this period, LAU absorbs 30% of allocable overhead. Industry default.
- **B. Allocate by direct-expense share** — bigger allocation goes to clients you spent more direct effort on.
- **C. Don't allocate at all** — net profit only counts direct expenses; overhead reported separately.

Default if you don't pick: **A** (cleanest).

### 4.5 — Exporters

One generic export interface, plug-in templates per office:

- `expense_to_alex_v2` — single sheet matching your existing format. Multi-currency columns. Marker rows for paid batches. Total row at bottom. (Used for: your personal Sovern reimbursement.)
- `inspector_travel_v2` — multi-tab, one per inspector; columns matching your existing format. Single-currency CNY. Monthly subtotal rows. (Used for: inspector trips, billed to clients.)
- `custom_csv` — generic flat CSV catch-all.

Add a new `exportTemplateKey` to `ReimbursementOffice` to pick which one.

Output format: XLSX (for fidelity to your existing workflow), saved to a Drive folder (`Sovern ERP / Expense reports / <office> / YYYY-MM/`).

### 4.6 — Migration / backfill

Your existing 2021–2023 expense sheets are historical context — useful but optional to import. Two paths:

- **A. Skip backfill.** New module starts clean from 2026. Old sheets stay in Drive as-is. (Recommended for shipping speed.)
- **B. Backfill via a one-time import script.** Parse the sheets, create Expense rows with attributions inferred from the sheet name + Customer column. Adds a few days of work + cleanup.

**❓ DECIDE 4C** — A or B? Recommended A.

---

## Item 5 — (renumbered into #4)

Originally listed by Alex as "I want to create an expenses module" — folded into Item 4 above.

---

## Build sequence (proposed)

Each row independently shippable, CI-green, deployed.

| Order | Commit (target) | Items |
|---|---|---|
| 1 | `feat(mobile): swap Settings for AI Assistant in bottom nav` | Item 0 |
| 2 | `fix(ai-chat): selectable text in mobile bubbles + memoised admin renderer` | Item 1 |
| 3 | `feat(ai-chat): voice input (mobile + admin)` | Item 2 |
| 4 | `feat(ai-chat): photo attachments via Google Drive (mobile + admin + backend)` | Item 3 |
| 5 | `feat(expenses): models + controllers + routes (backend skeleton)` | Item 4.2 backend |
| 6 | `feat(expenses): AI receipt extraction runner (background job)` | Item 4.3-A backend |
| 7 | `feat(expenses): mobile expense entry + list + detail screens` | Item 4.3-A,B mobile |
| 8 | `feat(expenses): admin expense table + submission + Drive exporters` | Item 4.3-C + 4.5 admin |
| 9 | `feat(expenses): AI chat slash commands (/expense, /expenses, /expense-report)` | Item 4.3-D |
| 10 | `feat(reports): client profitability endpoint + admin page + mobile card` | Item 4.4 |

Items #2-#3 need a single EAS dev-client native rebuild between them (both add native deps). Plan that as one cycle.

Total estimated effort: roughly 2-3 days of focused work for items 0-3, another 4-5 days for the expenses module if we pick the lighter options on the DECIDE blocks.

---

## Resolved DECIDE blocks

| ID | Decision |
|---|---|
| 2A | Voice langs: **EN + ZH-TW + ZH-CN** (auto-detect across all three) |
| 2B | Voice button: **auto-fill the input field; tap send manually** (review before commit) |
| 4A | File Read in chat subprocess: **enabled, with path whitelist** (`~/Desktop`, `~/Downloads`, the sovern-erp repo, the receipts Drive folder) |
| 4B | Overhead allocation: **revenue share + a "Direct cost / Revenue %" column on the report** for the high-touch signal. No composite math. |
| 4C | Historical backfill: **none** — start clean from 2026 |
| Office list | **No seed.** Table starts empty; Alex creates offices via admin UI as needed; default `frequency=ad_hoc`, `exportTemplateKey=NULL`. A placeholder "Personal" office is auto-created on the first expense if the table is empty so initial entry doesn't block on setup. |

All five DECIDEs and the office-list question now resolved. Build sequence is unblocked end-to-end.

---

## Notes

- This spec assumes nothing is whitelabel-blocking. The Expenses module is genuinely useful to other trading companies as-is — multi-currency + multi-office reimbursement + client P&L is exactly the shape of "trading company back-office" that whitelabel buyers want. Pricing tier consideration for later.
- The AI receipt extraction reuses the "research runner" pattern from this morning's Tier 2 work: ResearchTask was the template, ExpenseExtractionJob would be the analog. Same three-channel notifier, same boot-recovery, same caps.
- All new endpoints respect the L-031 rule (bare-string requireRole), L-034 (FK in associate), L-023 (no JSON.stringify on JSON columns). Three-surface rule honored throughout.
