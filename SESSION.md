# SESSION.md — Current Work State

> This file is maintained by Cowork at the end of every session so Claude Code can pick up without losing context. Read this at the start of every session before doing anything else.

---

## Last Updated
2026-05-07 (Taiwan time)

---

## Where We Are

### CI Status
- **FAILING** on commit `bc2e448d`
- **Root cause:** `react-grid-layout` was added to `frontend/admin-portal/package.json` but `npm install` was never run, so `package-lock.json` is out of sync. CI uses `npm ci` which requires exact lockfile sync.
- **Fix (do this first):**
  ```powershell
  cd "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\frontend\admin-portal"
  npm install
  cd "C:\Users\Alex\Desktop\International Trade Company\Trading ERP"
  git add frontend/admin-portal/package-lock.json
  git commit -m "chore: update lockfile for react-grid-layout"
  git push origin main
  ```
- After pushing, verify CI via `github_list_runs` on `SovernHouse/sovern-erp`.

---

## Recently Shipped (commit bc2e448d)

### Task #40 — Google Calendar Background Sync ✅ COMPLETE
- `backend/models/CalendarEvent.js` — model, stores synced events, CRM-linkable to Lead
- `backend/services/calendarSyncService.js` — incremental syncToken sync, 15-min cron, fallback full sync on 410
- `backend/routes/calendarRoutes.js` — GET /events, /today, /:id; PATCH /:id/link-lead
- `backend/models/index.js` — CalendarEvent registered + associations wired
- `backend/server.js` — cron job every 15 min (DISABLE_CALENDAR_SYNC=true to skip); /api/calendar route registered
- `frontend/admin-portal/src/services/api.js` — calendarAPI export added

### Task #6 — Configurable Dashboard ✅ CODE DONE (docs deferred)
- `frontend/admin-portal/src/pages/Dashboard/ConfigurableDashboard.jsx` — full rewrite with react-grid-layout, backend persistence, per-role defaults
- `frontend/admin-portal/src/App.jsx` — /dashboard loads ConfigurableDashboard
- `frontend/admin-portal/package.json` — react-grid-layout added (lockfile not yet updated — see CI fix above)

---

## Next Task

### Task #41 — Google Drive File Browser UI 🔴 HIGHEST PRIORITY
Alex confirmed: Google Drive is higher priority than Dashboard docs.

**Scope:**
- Backend: model to store synced Drive files/folders, routes to browse/search them
- Frontend: Drive file browser page in admin portal — folder navigation, file preview/download link, search
- Follow the same pattern as Calendar sync: use the existing `ConnectedGoogleAccount` model + `getAuthClientForAccount()` for auth

**Reference:** Look at `calendarSyncService.js` and `calendarRoutes.js` as the pattern to follow for the Drive backend.

---

## Deferred (do not start until #41 is shipped)

- **Task #6 docs:** tooltipContent.js, helpContent.js, DEVELOPER_GUIDE.md, User Guide .docx — all need Calendar + Drive + Dashboard coverage. Do one docs pass after #41.

---

## Infrastructure Notes

- **GCP VM:** Disk expanded to 30 GB (pd-standard, free tier). Currently at ~29% usage.
- **ERP DB:** SQLite at `/home/alex/sovern-erp/data/erp.db` on GCP VM `sovern-erp` (us-central1-f).
- **Google auth:** `ConnectedGoogleAccount` model handles all Google OAuth. Use `getAuthClientForAccount()` from `googleAccountController` for Drive/Calendar/Gmail API calls.
- **Mobile app:** Lives at `mobile/sovern-ops-app/` — any ERP feature must also be surfaced there (ERP Three-Surface Rule).
- **Public repo:** `SovernHouse/sovern-erp` is public — never commit IPs, keys, or credentials.
