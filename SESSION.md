# SESSION.md — Current Work State

> This file is maintained by Cowork at the end of every session so Claude Code can pick up without losing context. Read this at the start of every session before doing anything else.

---

## Last Updated
2026-05-07 (Taiwan time, second session)

---

## Where We Are

### CI Status
- **PASSING** on commit `eba9753`
- Lockfile fix (`cb8fc7f`) resolved the prior CI failure.

---

## Recently Shipped

### Lockfile fix (commit cb8fc7f) ✅
- `frontend/admin-portal/package-lock.json` added — was missing, causing `npm ci` failure on CI.

### Task #41 — Google Drive File Browser UI ✅ COMPLETE (commit eba9753)
All layers were already implemented in prior work; this session fixed a critical data-access bug:

**Backend (already existed):**
- `backend/controllers/driveController.js` — live proxy to Google Drive API v3; listFiles, getFile, searchFiles, getBreadcrumb
- `backend/routes/driveRoutes.js` — mounted at `/api/drive`, admin + manager auth
- No DB model — Drive data queried on demand, not synced/stored

**Frontend (already existed, bug fixed this session):**
- `frontend/admin-portal/src/pages/GoogleDrive/GoogleDrivePage.jsx` — folder navigation, breadcrumb, search, file open/download
- `frontend/admin-portal/src/services/api.js` — `driveAPI` export present
- `frontend/admin-portal/src/App.jsx` — `/drive` route registered
- `frontend/admin-portal/src/config/rbacConfig.js` — Google Drive nav item in Documents submenu (admin + manager)

**Bug fixed:** All 5 data-access calls in `GoogleDrivePage.jsx` were using `res.data?.data?.X` but the `api.js` interceptor already unwraps `{ success, data }` envelopes one level, so the correct pattern is `res.data?.X`. All four API calls (accounts, listFiles, breadcrumb, search) were returning empty results due to this.

### Task #40 — Google Calendar Background Sync ✅ COMPLETE (commit bc2e448d)
- `backend/models/CalendarEvent.js`
- `backend/services/calendarSyncService.js`
- `backend/routes/calendarRoutes.js`
- `backend/server.js` — cron every 15 min
- `frontend/admin-portal/src/services/api.js` — `calendarAPI` export

### Task #6 — Configurable Dashboard ✅ COMPLETE (docs done this session)
- `frontend/admin-portal/src/pages/Dashboard/ConfigurableDashboard.jsx`
- `frontend/admin-portal/src/App.jsx` — /dashboard loads ConfigurableDashboard

### Task #6 docs ✅ COMPLETE (this session)
One-pass docs covering ConfigurableDashboard, Google Calendar sync, Google Drive browser:
- `frontend/admin-portal/src/constants/tooltipContent.js` — DASHBOARD (11 keys) + GOOGLE_DRIVE (8 keys) exports added
- `frontend/admin-portal/src/constants/helpContent.js` — `/` dashboard steps updated (Customize + icon, drag/resize, auto-save); `/drive` entry added
- `DEVELOPER_GUIDE.md` — ToC extended (sections 21-25); roadmap "Dashboard customization" marked Done; sections 23/24/25 appended
- `docs/USER_GUIDE.md` — sections added for Configurable Dashboard, Google Calendar, Google Drive

---

## Next Task

No outstanding tasks defined. Await instructions from Alex.

---

## Deferred / Known Issues

- **Drive page: manager permissions gap.** `/api/google/accounts` is admin-only but the Drive page is accessible to managers. Managers will see "Failed to load connected accounts" error. Fix requires a separate endpoint that returns Drive-scoped accounts for the current user's role. Low priority — Alex only has one role in practice.

---

## Infrastructure Notes

- **GCP VM:** Disk expanded to 30 GB (pd-standard, free tier). Currently at ~29% usage.
- **ERP DB:** SQLite at `/home/alex/sovern-erp/data/erp.db` on GCP VM `sovern-erp` (us-central1-f).
- **Google auth:** `ConnectedGoogleAccount` model handles all Google OAuth. Use `getAuthClientForAccount()` from `googleAccountController` for Drive/Calendar/Gmail API calls.
- **Mobile app:** Lives at `mobile/sovern-ops-app/` — any ERP feature must also be surfaced there (ERP Three-Surface Rule).
- **Public repo:** `SovernHouse/sovern-erp` is public — never commit IPs, keys, or credentials.
