# ERP DevOps — Deployment, Migration, and Infrastructure

**Version:** 1.0 | **Created:** 2026-04-30
**Adapted from:** vendetta-devops (Vendetta Saloon)
**Depends on:** `trade-cto.md`, `trade-backend.md`, `erp-qa.md`
**Use for:** Any ERP deployment, database schema change, backup strategy, environment setup, or production incident. Load BEFORE making schema changes, BEFORE deploying, and when investigating any production data problem.

---

## Why This Role Exists

The ERP runs Alex's trading business. It is also the product being sold to whitelabel customers. Production failures here mean:
- Lost leads, lost orders, corrupted invoices
- Downtime visible to potential whitelabel buyers during demos
- Trust damage with existing clients and factories
- Recovery time with no staging environment = fixing things live

This skill enforces the practices that prevent those failures.

---

## Infrastructure Map (Current State)

### Backend: Node.js + Express
- **Runtime:** Node.js on Alex's Windows machine, localhost:5000
- **Database:** SQLite via Sequelize (file: `backend/database.sqlite`)
- **Auth:** JWT tokens, 24h expiry
- **File storage:** Local `backend/uploads/` directory
- **Email:** Resend (transactional) and ERP email service
- **Git:** github.com/SovernHouse/sovern-erp, main branch

### Frontend: React/Vite (three portals)
- `frontend/admin-portal` — Vite dev server, localhost:3001 (or 3000)
- `frontend/customer-portal` — Vite dev server, separate port (see L-026)
- `frontend/factory-portal` — Vite dev server, separate port
- **Port conflicts:** Next.js website defaults to 3000; offset portals to 3001+ (L-026)

### Current Gaps (Known)
- No staging environment — all testing in dev or live
- No automated backups — manual only
- No CI/CD — manual git push, manual restart
- No environment parity between dev and production
- No migration tool for schema changes — Sequelize sync() used (risky for production)
- SQLite is single-file and not suited for multi-tenant production — noted for whitelabel planning

---

## Database Migration Strategy

### CRITICAL RULE: Never use `sync({ force: true })` in production
`sync({ force: true })` drops and recreates all tables. It destroys all data. It is only safe in empty dev environments. For production and for any environment with real data:

1. **Schema changes via migrations**, not by editing models and re-syncing.
2. **Backup before every schema change** — no exceptions.
3. **Test the migration in dev** (with a copy of the production database) before running against real data.

### Before Any Schema Change (Checklist)
- [ ] Backup `database.sqlite` to a timestamped copy: `database.sqlite.2026-04-30.bak`
- [ ] Write the migration as a script, not by editing the model and re-syncing
- [ ] Test on a dev copy of the production database
- [ ] Verify all existing queries still work after migration
- [ ] Update the Sequelize model to match the new schema
- [ ] Commit model + migration together in the same PR

### Safe Column Addition (Non-Destructive)
```javascript
// backend/migrations/add-productInterests-to-leads.js
const { Sequelize } = require('sequelize');
const config = require('../config/database');

async function migrate() {
  const sequelize = new Sequelize(config);
  const queryInterface = sequelize.getQueryInterface();

  await queryInterface.addColumn('Leads', 'productInterests', {
    type: Sequelize.DataTypes.JSON,
    defaultValue: [],
    allowNull: true
  });

  console.log('Migration complete: productInterests added to Leads');
  await sequelize.close();
}

migrate().catch(e => { console.error(e); process.exit(1); });
```

Run: `node backend/migrations/add-productInterests-to-leads.js`

### Adding a New Table
New models with `autoMigrateSchema: true` (if configured) will create their table on next boot. For models that do NOT auto-sync, create an explicit migration script. Never rely on `sync({ alter: true })` in production — it can silently drop columns or constraints.

---

## Backup Protocol

### Manual Backup (Current Procedure)
```powershell
# Run from Trading ERP root on Windows
$date = Get-Date -Format "yyyy-MM-dd"
Copy-Item "backend\database.sqlite" "backend\backups\database.sqlite.$date.bak"
```

### What to Back Up
- `backend/database.sqlite` — all business data
- `backend/uploads/` — all uploaded files (documents, images)
- `.env` files — NOT committed to git; back up securely (password manager or encrypted store)

### Backup Frequency Target
- Before every schema change: always
- Before every ERP version deployment: always
- Ongoing: daily automated backup (not yet implemented — Action Item)

### Action Item: Automated Daily Backup
Set up a scheduled task (Windows Task Scheduler) to run the backup script nightly:
```powershell
# backup-erp.ps1
$date = Get-Date -Format "yyyy-MM-dd-HHmm"
$src = "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\backend\database.sqlite"
$dst = "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\backend\backups\database.sqlite.$date.bak"
Copy-Item $src $dst
# Optional: delete backups older than 30 days
Get-ChildItem "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\backend\backups\" -Filter "*.bak" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item
```

---

## Deployment Procedure

### Current (Manual)
1. Stop the backend server (Ctrl+C in the terminal running `node server.js`)
2. `git pull origin main` in `Trading ERP/`
3. `cd backend && npm install` (if new packages)
4. `cd ../frontend/admin-portal && npm install && npm run build` (if frontend changed)
5. Start the backend: `node backend/server.js`

### Pre-Deployment Checklist
- [ ] Backup database (see above)
- [ ] Read git diff since last deploy — any schema changes?
- [ ] If schema changes: run migration scripts first
- [ ] Run the ERP QA regression checklist (see `erp-qa.md`)
- [ ] Confirm all required env vars are set in the production environment
- [ ] Confirm frontend build succeeds without errors

### Environment Variables (Required)
These must exist in `.env` (backend) and `.env` (frontend portals). They are NOT committed to git.

**Backend `.env` must include:**
```
JWT_SECRET=<strong random string>
RESEND_API_KEY=<from Resend dashboard>
WEBHOOK_API_KEY=<shared secret with website>
NODE_ENV=production
PORT=5000
DB_PATH=./database.sqlite
```

**Frontend `.env` must include:**
```
VITE_API_URL=http://localhost:5000
```

---

## Staging Environment (Recommended — Not Yet Implemented)

**Current risk:** Every change is tested live against the production database. A bad deployment corrupts real business data.

**Target state:**
- A second copy of the ERP at a separate URL or port, using a copy of the production database
- All feature branches tested in staging before merging to main
- Schema migrations tested in staging first

**Pragmatic interim (while staging is not set up):**
- Use `database.sqlite.dev.bak` as a development database that doesn't contain real client data
- Switch between dev and prod database via the `DB_PATH` env var
- Never run `sync({ force: true })` except against the dev database

---

## Incident Response

### P0 — Data Loss or Corruption
1. Stop the backend immediately
2. Restore from most recent backup
3. Identify the migration/operation that caused the corruption
4. Fix and re-apply safely
5. Verify data integrity by spot-checking 10 records across major tables

### P1 — Backend Down (Server Not Responding)
1. Check backend logs: `cat backend/logs/error.log | tail -50`
2. Look for uncaught exceptions, port conflicts, or DB errors at startup
3. Common causes: missing env var, port already in use (`netstat -ano | findstr 5000`), corrupt SQLite file
4. If corrupt DB: restore from backup

### P2 — Frontend Not Loading
1. Check if backend is running (visit `http://localhost:5000/health`)
2. Check browser console for network errors
3. Confirm VITE_API_URL points to correct backend port
4. Re-run `npm run build` if the build is stale

---

## Whitelabel Infrastructure Considerations

When the ERP moves toward multi-tenant/whitelabel, the SQLite + single-server model will need rearchitecting. Key flags:

- **SQLite limitation:** SQLite is a single-file database. It works for a single-tenant deployment but does not support concurrent write loads from multiple customers. For multi-tenant: migrate to PostgreSQL or MySQL.
- **Data isolation:** Each whitelabel tenant must have isolated data. Options: separate database per tenant (strong isolation, high ops overhead) or shared database with tenant_id column on every table (lower ops overhead, more complex queries).
- **Feature flags:** Multi-tenant customers will want different features enabled/disabled. Plan for a config table or env-based feature flag system before onboarding the first whitelabel customer.
- **Theming:** Brand colors, logos, company name. Store as tenant config. CSS variables via theme injection at the frontend level.
- **Authentication:** Each tenant has their own user pool. SSO considerations per tenant.

Discuss with trade-cto.md and erp-whitelabel.md before making any architecture decisions in this direction.
