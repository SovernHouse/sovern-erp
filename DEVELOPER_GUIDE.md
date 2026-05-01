# Sovern ERP — Developer Guide

> Internal reference for engineers building, maintaining, or extending the Sovern House ERP system.
> Keep this file updated whenever architecture or behaviour changes.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Running Locally](#4-running-locally)
5. [Environment Variables](#5-environment-variables)
6. [Database — Models & Associations](#6-database--models--associations)
7. [State Machine Guards](#7-state-machine-guards)
8. [RBAC System](#8-rbac-system)
9. [API Endpoints Reference](#9-api-endpoints-reference)
10. [Background Scheduler](#10-background-scheduler)
11. [Document Approval System](#11-document-approval-system)
12. [MCP Server (ERP-to-Claude Integration)](#12-mcp-server-erp-to-claude-integration)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Tooltip & Help System](#14-tooltip--help-system)
15. [Bulk Import](#15-bulk-import)
16. [Email & Outreach](#16-email--outreach)
17. [Whitelabel / Tenant Config](#17-whitelabel--tenant-config)
18. [Security Notes](#18-security-notes)
19. [Deployment](#19-deployment)
20. [Known Limitations & Roadmap](#20-known-limitations--roadmap)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     Admin Portal (React)                  │
│  frontend/admin-portal/                                   │
│  Vite + React 18 + React Router + Tailwind CSS           │
└──────────────────┬───────────────────────────────────────┘
                   │ REST API (JWT)
┌──────────────────▼───────────────────────────────────────┐
│                    ERP Backend (Node.js)                  │
│  backend/                                                 │
│  Express + Sequelize ORM + PostgreSQL                     │
│  Background scheduler: node-cron                         │
│  Email: Nodemailer / Resend                              │
└──────────────────┬───────────────────────────────────────┘
                   │ SQL
┌──────────────────▼──────────────┐
│         PostgreSQL Database      │
└─────────────────────────────────┘

┌──────────────────────────────────┐
│     MCP Server (TypeScript)       │
│  mcp-server/                     │
│  Wraps ERP API for Claude tools  │
└──────────────────────────────────┘
```

The admin portal is a single-page application. All data fetching goes through the shared `frontend/admin-portal/src/services/api.js` axios instance, which attaches the JWT automatically via an interceptor.

Public routes (document approval pages at `/approve/:token`) do NOT require authentication — they are served by the same React SPA but access the backend via the public `/api/approvals/public/:token` endpoints.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Vite, Tailwind CSS |
| Backend | Node.js 18+, Express 4 |
| ORM | Sequelize 6 |
| Database | **SQLite** (current; `pg` driver also installed for future Postgres migration). DB file at `backend/database.sqlite`. Auto-migration logic in `server.js` handles schema diffs on startup. |
| Auth | JWT (access token in localStorage, refresh not yet implemented) |
| Email | Nodemailer or Resend (configured via env vars) |
| Validation | Zod 4 (financial fields and trade fields enforced; CRM entities not yet covered) |
| Scheduler | node-cron (5 jobs: overdue activities, follow-up reminders, invoice transitions, production alerts, GDPR retention purge) |
| Real-time | Socket.IO 4 (notifications, shipment updates) |
| Webhooks | Custom service with HMAC-SHA256 signing, exponential retry, delivery audit (Phase 5) |
| Rate limiting | express-rate-limit, three configurations: general API, auth (5 per 15 min in prod), public approval endpoints (15 per 15 min) |
| Testing | Jest (backend unit), Playwright (E2E). 219 backend tests passing as of Phase 6. |
| CI/CD | GitHub Actions: ci.yml, deploy.yml, security.yml (Trivy + CodeQL + TruffleHog) |
| API docs | Swagger/OpenAPI 3.0 at `/api-docs`, 95+ endpoints documented |
| MCP Server | TypeScript, `@modelcontextprotocol/sdk`, zod, axios |
| Build | Vite (frontend), tsc (MCP server) |
| Containers | Docker multi-stage builds, docker-compose for dev and prod |

---

## 3. Project Structure

```
sovern-erp/
├── backend/
│   ├── config/
│   │   └── tenant.js           # Whitelabel company config
│   ├── controllers/            # Route handler logic (thin wrappers)
│   ├── middleware/
│   │   ├── auth.js             # JWT requireAuth middleware
│   │   └── errorHandler.js     # Centralised error shape
│   ├── models/
│   │   ├── index.js            # Sequelize init + all associations
│   │   ├── User.js
│   │   ├── Customer.js         # paranoid: true
│   │   ├── Factory.js          # paranoid: true, isConfidential
│   │   ├── Product.js
│   │   ├── Inquiry.js
│   │   ├── Quotation.js
│   │   ├── ProformaInvoice.js  # state machine hook
│   │   ├── SalesOrder.js       # paranoid: true, state machine hook
│   │   ├── PurchaseOrder.js    # paranoid: true, state machine hook
│   │   ├── Shipment.js         # state machine hook
│   │   ├── Invoice.js          # paranoid: true, state machine hook
│   │   ├── Payment.js          # paranoid: true
│   │   ├── DocumentApproval.js # 256-bit token, expiry, IP audit
│   │   └── ...
│   ├── routes/                 # Express routers (one file per resource)
│   ├── services/
│   │   ├── emailService.js
│   │   ├── notificationService.js
│   │   └── schedulerService.js # node-cron background jobs
│   ├── utils/
│   │   ├── helpers.js          # Pagination, response shapes
│   │   └── statusTransitions.js # State machine definitions + hooks
│   ├── seeds/
│   │   └── seed.js             # Development seed data
│   ├── .env.example
│   ├── package.json
│   └── server.js               # Express app entry point
│
├── frontend/admin-portal/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx      # App shell — sidebar, header, help button
│   │   │   ├── HelpPanel.jsx   # Slide-in help panel (? button in header)
│   │   │   ├── Tooltip.jsx     # Hover tooltip primitives
│   │   │   ├── RoleGuard.jsx   # RBAC enforcement wrapper
│   │   │   └── ...
│   │   ├── config/
│   │   │   ├── rbacConfig.js   # ROLE_PERMISSIONS + NAV_ITEMS_BY_ROLE
│   │   │   └── tenant.js       # Whitelabel config (frontend)
│   │   ├── constants/
│   │   │   ├── tooltipContent.js # All field tooltip text
│   │   │   └── helpContent.js    # Page-level help panel content
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── usePermissions.js
│   │   │   └── ...
│   │   ├── pages/              # One folder per module
│   │   ├── services/
│   │   │   └── api.js          # Axios instance + endpoint wrappers
│   │   └── App.jsx             # Route definitions (all RBAC-guarded)
│   ├── .env.example
│   └── vite.config.js
│
├── mcp-server/
│   ├── src/index.ts            # MCP server — 11 ERP tools
│   ├── package.json
│   └── tsconfig.json
│
├── CLAUDE.md                   # AI assistant instructions
├── DEVELOPER_GUIDE.md          # This file
└── git-push-erp-audit-2.ps1   # Commit script (PowerShell)
```

---

## 4. Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (running locally or via Docker)
- npm or yarn

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, etc.
npm install
npm run migrate     # Sequelize migrations (if using migrations)
npm run seed        # Load seed data (development only)
npm run dev         # nodemon with auto-restart
```

The backend starts on `http://localhost:5000` by default (`PORT` env var).

### Frontend

```bash
cd frontend/admin-portal
cp .env.example .env
# Set VITE_API_URL=http://localhost:5000
npm install
npm run dev         # Vite dev server
```

The frontend starts on `http://localhost:5173`.

### MCP Server

```bash
cd mcp-server
npm install
npm run build       # tsc → dist/
npm start           # or configure in Claude Code / Cowork plugin
```

---

## 5. Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `PORT` | No | Server port (default: 5000) |
| `FRONTEND_URL` | Yes | Used to build approval link URLs |
| `CLIENT_PORTAL_URL` | No | Override for approval links (if different from frontend) |
| `APPROVAL_LINK_EXPIRY_DAYS` | No | Days before approval link expires (default: 30) |
| `ALLOWED_SENDING_DOMAINS` | Yes | Comma-separated list of authorised outreach sender domains |
| `COMPANY_NAME` | No | Overrides tenant default company name |
| `COMPANY_DOMAIN` | No | Overrides tenant default domain |
| `ADMIN_EMAIL` | Yes | System admin email for seed data |
| `SCHEDULER_ENABLED` | No | Set to `false` to disable all cron jobs |
| `SCHEDULER_OVERDUE_ACTIVITIES` | No | Set to `false` to disable that specific job |
| `SCHEDULER_FOLLOWUPS` | No | Set to `false` to disable that specific job |
| `SCHEDULER_OVERDUE_INVOICES` | No | Set to `false` to disable that specific job |
| `SCHEDULER_PRODUCTION_DELAYS` | No | Set to `false` to disable that specific job |

### Frontend (`frontend/admin-portal/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Backend API base URL |
| `VITE_COMPANY_NAME` | No | Overrides tenant display name |
| `VITE_COMPANY_DOMAIN` | No | Overrides tenant domain |
| `VITE_ADMIN_EMAIL` | No | Default admin contact email |
| `VITE_BRAND_COLOR` | No | Primary brand hex (e.g. `#1D5A32`) |

---

## 6. Database — Models & Associations

### Association rules

All inter-model associations live in two places:
1. **`Model.associate(models)` method** inside the model file — for associations owned by that model.
2. **`backend/models/index.js`** — for *inverse* associations (hasMany / belongsToMany) that cannot be in the model file without circular imports, and for junction table associations.

**Critical rule**: Do NOT define the same association in both places. `index.js` calls `model.associate(db)` for every model, so any association in the model file is already registered. A duplicate in `index.js` will throw `SequelizeAssociationError` on startup.

### Models with soft deletes (`paranoid: true`)

These models use soft deletes — `.destroy()` sets `deletedAt` instead of deleting the row. All queries automatically exclude soft-deleted records.

| Model | Notes |
|---|---|
| `Customer` | Customers are never hard-deleted to preserve order history |
| `Factory` | Same — preserves PO and product linkage |
| `SalesOrder` | Order history is always preserved |
| `PurchaseOrder` | Same |
| `Invoice` | Financial records must be preserved |
| `Payment` | Same |

To query including soft-deleted records: `Model.findAll({ paranoid: false })`

To restore a soft-deleted record: `instance.restore()`

### Models with state machine hooks

See Section 7 for the full transition map. Models with `beforeUpdate` hooks:

- `SalesOrder`
- `PurchaseOrder`
- `ProformaInvoice`
- `Shipment`
- `Invoice`

---

## 7. State Machine Guards

**File**: `backend/utils/statusTransitions.js`

### How it works

Each guarded model has a `beforeUpdate` Sequelize hook registered via `statusTransitionHook(modelName)`. When `status` changes, the hook looks up the `from → to` pair in the `TRANSITIONS` map. If the transition is not in the allowed set, it throws an error with `statusCode: 422`.

The `errorHandler.js` middleware catches this and returns:
```json
{
  "success": false,
  "message": "Invalid status transition for SalesOrder: \"confirmed\" → \"delivered\"",
  "details": { "from": "confirmed", "to": "delivered", "modelName": "SalesOrder" }
}
```

### Transition maps

**SalesOrder**
```
confirmed → in_production, cancelled
in_production → ready, cancelled
ready → shipped, cancelled
shipped → in_transit
in_transit → delivered
delivered → completed
completed → [terminal]
cancelled → [terminal]
```

**ProformaInvoice**
```
draft → sent, cancelled
sent → confirmed, cancelled, draft (recall)
confirmed → cancelled
cancelled → [terminal]
```

**PurchaseOrder**
```
draft → sent, cancelled
sent → confirmed, cancelled
confirmed → in_production, cancelled
in_production → ready, cancelled
ready → shipped
shipped → received
received → completed
completed → [terminal]
cancelled → [terminal]
```

**Shipment**
```
booked → loaded
loaded → in_transit
in_transit → at_port
at_port → customs
customs → delivered
delivered → [terminal]
```

**Invoice**
```
draft → sent, cancelled
sent → partially_paid, paid, overdue, cancelled
partially_paid → paid, overdue, cancelled
overdue → partially_paid, paid, cancelled
paid → [terminal]
cancelled → [terminal]
```

### Bypassing guards (admin operations)

If you need to force a status in a migration or admin script, use a raw query or call `instance.set('status', newStatus)` and then use `instance.save({ hooks: false })` to skip the hook. Use this sparingly and document the reason.

---

## 8. RBAC System

**File**: `frontend/admin-portal/src/config/rbacConfig.js`

### How it works

Every route in `App.jsx` is wrapped in a `<RoleGuard permission="key">` component. The guard checks `ROLE_PERMISSIONS[userRole].includes(key)` (or `'*'` for admins). If access is denied, a 403 screen is shown — the user cannot reach the page by direct URL.

### Permission keys

| Key | Module |
|---|---|
| `dashboard` | Dashboard |
| `customers` | Customer list and profiles |
| `factories` | Factory list and profiles |
| `products` | Product catalog |
| `inquiries` | Sales inquiries |
| `quotations` | Quotations |
| `proforma` | Proforma Invoices |
| `orders` | Sales Orders |
| `purchase-orders` | Purchase Orders |
| `packing-lists` | Packing Lists |
| `shipments` | Shipments |
| `inspections` | QC Inspections |
| `claims` | Claims |
| `invoices` | Invoices |
| `payments` | Payments |
| `inventory` | Inventory |
| `reports` | Reports |
| `analytics` | Analytics |
| `bi-dashboard` | BI Dashboard |
| `documents` | Document Templates |
| `settings` | Settings + User Management |
| `outreach` | CRM Outreach / Client Contacts |
| `*` | All permissions (admin only) |

### Adding a new role

1. Add the role name and permissions array to `ROLE_PERMISSIONS` in `rbacConfig.js`.
2. Add a nav config to `NAV_ITEMS_BY_ROLE` (or let it fall back to `buildNavFromPermissions`).
3. If needed, add a tooltip description in `tooltipContent.js` under `ROLE_TIPS`.

### Dynamic roles (DB-managed)

Custom roles can be stored in the database with a `permissions` JSON array on the User record. The `usePermissions` hook checks `user.permissions` first, then falls back to `ROLE_PERMISSIONS[role]`.

---

## 9. API Endpoints Reference

All endpoints are prefixed with `/api`. Auth required unless noted.

### CRM

| Method | Path | Description |
|---|---|---|
| GET | `/api/crm/leads` | List leads (paginated, filterable) |
| POST | `/api/crm/leads` | Create lead |
| GET | `/api/crm/leads/:id` | Get lead detail |
| PUT | `/api/crm/leads/:id` | Update lead |
| DELETE | `/api/crm/leads/:id` | Soft delete lead |
| POST | `/api/crm/leads/import` | Parse CSV/XLSX for bulk import preview |
| POST | `/api/crm/leads/import/confirm` | Commit bulk import |
| GET | `/api/crm/activities` | List activities |
| POST | `/api/crm/activities` | Create activity |
| GET | `/api/crm/activities/stats` | Activity statistics |
| GET | `/api/crm/contacts` | List contacts |
| POST | `/api/crm/contacts` | Create contact |
| GET | `/api/crm/campaigns` | List campaigns |
| POST | `/api/crm/campaigns` | Create campaign |
| GET | `/api/crm/deals` | List deals |
| POST | `/api/crm/deals` | Create deal |

### Outreach

| Method | Path | Description |
|---|---|---|
| POST | `/api/outreach/send` | Send outreach email to a lead |
| GET | `/api/outreach/emails` | List sent outreach emails |

### Document Approvals

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/approvals/generate` | Required | Generate approval link for a document |
| GET | `/api/approvals` | Required | List all approvals |
| GET | `/api/approvals/:id` | Required | Get approval by ID |
| GET | `/api/approvals/public/:token` | **None** | Public: get document summary |
| POST | `/api/approvals/public/:token/approve` | **None** | Public: client approves |
| POST | `/api/approvals/public/:token/reject` | **None** | Public: client rejects |

### Proforma Invoices

| Method | Path | Description |
|---|---|---|
| GET | `/api/proforma-invoices` | List PIs |
| POST | `/api/proforma-invoices` | Create PI |
| GET | `/api/proforma-invoices/:id` | Get PI detail |
| PUT | `/api/proforma-invoices/:id` | Update PI |
| POST | `/api/proforma-invoices/:id/convert-order` | Convert PI to Sales Order |

### Sales Orders

| Method | Path | Description |
|---|---|---|
| GET | `/api/sales-orders` | List orders |
| POST | `/api/sales-orders` | Create order |
| GET | `/api/sales-orders/:id` | Get order detail |
| PUT | `/api/sales-orders/:id` | Update order |
| POST | `/api/sales-orders/:id/create-packing-list` | Auto-generate packing list |

### Standard response shape

**Success**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

**Error**:
```json
{
  "success": false,
  "message": "Human-readable error",
  "details": { ... }
}
```

**Paginated**:
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 143,
    "totalPages": 8
  }
}
```

---

## 10. Background Scheduler

**File**: `backend/services/schedulerService.js`

Runs five cron jobs. Each can be individually disabled via env vars.

| Job | Schedule | Env flag | Default | Description |
|---|---|---|---|---|
| `checkOverdueActivities` | Daily 08:00 | `SCHEDULER_ACTIVITY_REMINDERS` | `true` | Flags CRM activities past due date; sends in-app notification |
| `checkFollowups` | Daily 08:00 | `SCHEDULER_FOLLOWUP_REMINDERS` | `true` | Sends follow-up reminders for outreach emails due today |
| `transitionOverdueInvoices` | Hourly | `SCHEDULER_INVOICE_OVERDUE` | `true` | Auto-transitions Invoice status `sent`/`pending` → `overdue` |
| `checkProductionDelays` | Daily 08:00 | `SCHEDULER_PRODUCTION_ALERTS` | `true` | Alerts when a Sales Order has been `in_production` > `PRODUCTION_ALERT_DAYS` (default 45) |
| `purgeExpiredSoftDeletes` | Nightly 02:00 | `SCHEDULER_DATA_RETENTION` | `true` | Hard-deletes soft-deleted records older than `DATA_RETENTION_DAYS` (default 365) — GDPR right-to-erasure |

To disable an individual job, set its env flag to `'false'` in `.env`.

### Data retention job

The `purgeExpiredSoftDeletes` job permanently removes records from all paranoid models (those using `paranoid: true` in Sequelize) whose `deletedAt` timestamp is older than `DATA_RETENTION_DAYS` days.

**Paranoid models covered**: `Customer`, `Factory`, `SalesOrder`, `PurchaseOrder`, `Invoice`, `Payment`, `SpecTemplate`.

**Adding a new paranoid model**: add the model name to the `PARANOID_MODELS` array at the top of `purgeExpiredSoftDeletes()`.

**Configuration** (`.env` / `.env.example`):
```
SCHEDULER_DATA_RETENTION=true     # set to 'false' to disable
DATA_RETENTION_DAYS=365           # hard-delete after this many days post soft-delete
```

The job runs at 02:00 server time (off-peak) to avoid contention with daytime queries. It logs a per-model count summary. Missing models skip with a warning rather than crashing.

---

## 11. Document Approval System

**Model**: `backend/models/DocumentApproval.js`
**Routes**: `backend/routes/approvalRoutes.js`
**Frontend**: `frontend/admin-portal/src/pages/Approvals/ApprovalPage.jsx` (public)

### Token security

- 256-bit random token: `crypto.randomBytes(32).toString('hex')` → 64 hex chars
- Token is stored in the DB and embedded in the approval URL
- Expiry is enforced server-side on every request
- Client IP and User-Agent are logged on approve/reject for audit trail

### Approval URL format

```
{FRONTEND_URL}/approve/{token}
```

The public React page at `/approve/:token` calls `GET /api/approvals/public/:token` to fetch the document summary, then `POST /api/approvals/public/:token/approve` or `/reject` when the client responds.

### Supported entity types

- `ProformaInvoice`
- `Quotation`
- `SalesOrder`

Adding a new entity type: add a `case` to the `resolveDocument()` function in `approvalRoutes.js`, and add the type to the `supportedTypes` array and the `ENUM` in `DocumentApproval.js`.

---

## 12. MCP Server (ERP-to-Claude Integration)

**Location**: `mcp-server/src/index.ts`

TypeScript MCP server that exposes 11 ERP API tools to Claude via the Model Context Protocol. Powers the `sovern-erp` plugin in Claude Code and Cowork.

### Tools

| Tool | Description |
|---|---|
| `erp_list_leads` | List CRM leads with optional filters |
| `erp_get_lead` | Get full lead detail by ID |
| `erp_create_lead` | Create a new CRM lead |
| `erp_update_lead` | Update lead fields (status, score, notes, etc.) |
| `erp_delete_lead` | Soft delete a lead |
| `erp_send_outreach_email` | Send email to a lead using a template |
| `erp_list_email_templates` | List available email templates |
| `erp_create_email_template` | Create a new email template |
| `erp_list_email_signatures` | List email signatures |
| `erp_create_email_signature` | Create a new email signature |
| `erp_list_customers` | List customers |

### Setup

```bash
cd mcp-server
npm install
npm run build
```

Configure via the Cowork plugin or by adding to Claude Code's MCP config. The server reads three environment variables (per `mcp-server/src/index.ts:10-26`):

| Variable | Purpose | Default |
|---|---|---|
| `ERP_URL` | Base URL of the ERP backend | `http://localhost:5000` |
| `ERP_EMAIL` | Admin email for backend login | `admin@sovernhouse.co` |
| `ERP_PASSWORD` | Admin password for backend login | (required, no default) |

The MCP server logs in to the backend on first request and caches the JWT internally. There is no separate `ERP_JWT_TOKEN` env var (older versions of this guide referenced one, it is incorrect).

### Related: Sovern Cross-Venture MCP Server (different project, do not confuse)

Separate from `Trading ERP/mcp-server` (this section), there is a second MCP server at `International Trade Company/sovern-mcp-server/`. That one is a unified dev-infrastructure MCP connecting Claude to GitHub (VendettaGamesHQ org), Vercel, MongoDB (Vendetta Saloon DB, read-only), Sentry, Context7 (live library docs), Google Drive, and Gmail. Live as of 2026-05-01. It is for cross-venture dev workflows (CI checks before push, deployment status, library doc lookups, error triage), not for ERP trade operations. Both MCPs are useful in their own contexts; tools from the cross-venture MCP are prefixed `mcp__sovern__*` while ERP-internal tools are prefixed `mcp__sovern-erp__*`.

---

## 13. Frontend Architecture

### API service (`services/api.js`)

All HTTP calls go through the shared axios instance. It handles:
- Attaching the JWT `Authorization: Bearer ...` header automatically
- Unwrapping the standard `{ success, data }` envelope
- Redirecting to `/login` on 401

Never use `axios` directly in page components — always import from `api.js`.

### Route protection (`App.jsx`)

Every protected route is wrapped in a `<P permission="key">` shorthand component:

```jsx
const P = ({ permission, roles, children }) => (
  <ProtectedRoute permission={permission} allowedRoles={roles}>
    <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
  </ProtectedRoute>
)

<Route path="/orders" element={<P permission="orders"><OrderList /></P>} />
```

Public routes (login, approval page) have no `<P>` wrapper.

### Permissions hook

```jsx
import { usePermissions } from '../hooks/usePermissions'

const { hasPermission, hasRole, isAdmin, role } = usePermissions()

if (hasPermission('invoices')) { /* show invoice actions */ }
```

### Tooltip system

```jsx
import { Tooltip, FieldTip, StatusTip } from '../components/Tooltip'
import { INQUIRY } from '../constants/tooltipContent'

// Field label with help icon
<FieldTip label="Target Price" tip={INQUIRY.targetPrice} />

// Wrap any element
<Tooltip content="Convert PI to Sales Order" placement="top">
  <button>Convert</button>
</Tooltip>

// Status badge with explanation
<StatusTip status="in_production" modelName="SalesOrder">
  <StatusBadge status="in_production" />
</StatusTip>
```

### Help panel

The help panel opens when the user clicks the `?` button in the top-right header. Content is resolved from `constants/helpContent.js` based on `window.location.pathname`. To add content for a new page, add an entry keyed by the route path.

---

## 14. Tooltip & Help System

### Adding tooltips to a new page

1. Add your content to `tooltipContent.js` under a new export (e.g. `export const MY_MODULE = { ... }`).
2. Import and use `<FieldTip>`, `<Tooltip>`, or `<StatusTip>` in the page component.

### Adding help content for a new page

1. Add an entry to `helpContent.js` keyed by the exact route path (e.g. `'/my-module'`).
2. Structure: `{ title, summary, sections, tips, warnings, statuses, links }`.
3. The `HelpPanel` resolves content by exact path first, then by base path prefix.

### Updating existing content

All content is in `frontend/admin-portal/src/constants/`. No component code needs to change for copy updates.

---

## 15. Bulk Import

**Frontend**: `frontend/admin-portal/src/pages/Settings/BulkImport.jsx`
**Backend routes**: `POST /api/crm/leads/import` (preview) and `POST /api/crm/leads/import/confirm`

The import flow is:
1. User uploads CSV or XLSX (parsed by Multer + SheetJS/csv-parse on the server)
2. Server returns a preview (first N rows) and detected column headers
3. User maps columns to ERP fields in the wizard
4. User reviews the preview and confirms
5. Server upserts records (leads deduplicated by email)

To add a new import type (e.g. customers, factories):
1. Add the entity-specific parse/upsert logic to a new route.
2. Add the new import type to the `BulkImport.jsx` wizard step 1 selector.

---

## 16. Email & Outreach

Email is sent via `backend/services/emailService.js`. The service wraps either Nodemailer (SMTP) or Resend depending on configuration.

Outreach emails are logged in the `OutreachEmail` model, linked to the lead via `leadId`.

### Merge tags

Templates support `{{firstName}}`, `{{companyName}}`, `{{productInterest}}`. The outreach controller replaces these before sending.

### Allowed sending domains

Configured in `ALLOWED_SENDING_DOMAINS` env var (comma-separated). The controller rejects sends from domains not on this list to prevent abuse.

### Egypt BCC rule

All outreach emails for Egyptian leads must BCC `mohanadfanzey@gmail.com`. This is enforced in the outreach controller and must not be removed without explicit approval.

---

## 17. Whitelabel / Tenant Config

**Backend**: `backend/config/tenant.js`
**Frontend**: `frontend/admin-portal/src/config/tenant.js`

Both files read from environment variables with Sovern House defaults. Override any value by setting the corresponding env var.

| Config key | Env var | Default |
|---|---|---|
| `companyName` | `COMPANY_NAME` / `VITE_COMPANY_NAME` | Sovern House |
| `domain` | `COMPANY_DOMAIN` / `VITE_COMPANY_DOMAIN` | sovernhouse.co |
| `adminEmail` | `ADMIN_EMAIL` / `VITE_ADMIN_EMAIL` | info@sovernhouse.co |
| `brandColor` | `VITE_BRAND_COLOR` | #1D5A32 |

---

## 17.5 Sentry Error Tracking

**Live as of 2026-05-01.** The ERP backend and admin frontend are wired to Sentry for production error tracking, performance monitoring, and session replay (frontend only).

### Organization

- Sentry org: `sovern-house` (EU data storage region for GDPR alignment)
- Free Developer plan after 14-day trial expires. Quotas: 5,000 errors/month, 10,000 performance events/month, 50 session replays/month.

### Projects

| Project | Stack | DSN env var |
|---|---|---|
| `node-express` | Backend (Express on Node) | `SENTRY_DSN` (set in `backend/.env`) |
| `sovern-erp-admin-frontend` | Frontend (React + Vite) | `VITE_SENTRY_DSN` (set in `frontend/admin-portal/.env`) |

### Files

- `backend/instrument.js` — Sentry initialization. **MUST be the first require in `backend/server.js`** so SDK can auto-instrument Express, HTTP, and other modules.
- `backend/server.js` — calls `Sentry.setupExpressErrorHandler(app)` AFTER all routes and BEFORE the existing `app.use(errorHandler)`.
- `frontend/admin-portal/src/index.jsx` — calls `Sentry.init()` and wraps `<App />` in `<Sentry.ErrorBoundary>` with a custom fallback component.

### Behavior

- **Local development:** Sentry is disabled by default. Set `SENTRY_FORCE_ENABLE=true` (backend) or `VITE_SENTRY_FORCE_ENABLE=true` (frontend) to test against the real Sentry org.
- **Production:** Sentry is enabled when `NODE_ENV=production` (backend) or when the Vite build is in production mode (frontend).
- **Sample rates:** Performance traces sampled at 10% in production. Session replays sampled at 1% in production (rare to stay within free-plan quota), but errors trigger a 100% replay regardless.

### Querying Sentry from Claude

The Sovern MCP server has `mcp__sovern__sentry_*` tools for `list_projects`, `list_issues`, `issue_details`, `latest_event`. Requires `SENTRY_AUTH_TOKEN` and `SENTRY_ORG=sovern-house` set in the MCP server's environment (via Claude Desktop config). Use these tools to triage production errors directly from chat.

### Common operations

- **Trigger a test error in development:** add `app.get('/debug-sentry', () => { throw new Error('Sentry test'); });` to backend, then GET that URL.
- **Filter known noisy errors:** add to the `ignoreErrors` array in `instrument.js` (backend) or `index.jsx` (frontend).
- **Source map upload (optional):** for production builds, set `SENTRY_RELEASE` and `VITE_SENTRY_RELEASE` to the git SHA in CI, and use `@sentry/vite-plugin` for automatic source map upload (not yet wired; add when error stack traces become hard to read).

---

## 18. Security Notes

- JWT tokens are stored in `localStorage`. Acceptable for internal tools, but consider httpOnly cookies for higher-security deployments.
- The `DocumentApproval` token provides 256 bits of entropy. Brute-force resistant. Expiry is enforced server-side.
- All factory endpoints check `isConfidential` plus `allowedUserIds`. Confidential factories return 403 to unauthorised users.
- **Input validation:** Zod schemas enforce financial fields (`backend/utils/validateFinancials.js`) and trade fields (`backend/utils/validateTradeFields.js`, covering Incoterms, currency, shipping method enums). CRM entities (Lead, Contact, Activity, Deal, Campaign) do not yet have route-level Zod validation; this is the next gap to close.
- **Rate limiting:** general API limiter, auth limiter (stricter in production), public approval endpoint limiter (`backend/middleware/rateLimiter.js` plus `backend/routes/approvalRoutes.js`).
- **Egypt BCC enforcement:** automatic in `backend/controllers/outreachController.js` for both single-lead outreach (lines 100-108) and campaigns (lines 401-408). Adds `mohanadfanzey@gmail.com` to BCC when `lead.country === 'egypt'`.
- **Sanctions screening flag:** `Lead.sanctionsScreened` boolean exists. Manual update flow at present; automated screening is roadmapped (see Section 20 and the upcoming AI sanctions screening feature).
- **Timezone handling:** invoice aging report uses `dayjs` UTC plus timezone plugins, reads from `req.user?.timezone` or `DEFAULT_TIMEZONE` env var.
- API versioning is not yet implemented. Breaking changes will require coordination across all clients.
- Error envelope inconsistency: middleware (e.g. `auth.js`) returns `{error: '...'}` while controllers return `{success, data, message}`. Frontend's API service handles both, but the inconsistency should be normalised.

---

## 19. Deployment

The system is designed for a single-server deployment. Recommended setup:

```
Reverse proxy (nginx)
  ├── / → React SPA (static files, Vite build)
  └── /api → Node.js backend (PM2 process)
```

### Build frontend

```bash
cd frontend/admin-portal
npm run build   # outputs to dist/
```

### Start backend (production)

```bash
cd backend
NODE_ENV=production pm2 start server.js --name sovern-erp-backend
```

### Database migrations

Run Sequelize migrations before each deployment:
```bash
cd backend
npx sequelize-cli db:migrate
```

### Pre-push route smoke test

Before pushing, verify all route files load without error. This catches two classes of bugs that code review misses:
- A route callback referencing a controller method that doesn't exist (resolves to `undefined` at require-time → Express crash on startup)
- File corruption (NUL bytes, encoding artifacts) that Node refuses to parse

```bash
# From repo root
for f in backend/routes/*.js; do
  node -e "require('./$f')" 2>&1 && echo "OK: $f" || echo "FAIL: $f"
done
```

If a file fails and looks correct, check for binary corruption:
```bash
tail -c 40 backend/routes/yourFile.js | xxd
```
A clean file ends with `...;\n` (0x0a). Any `00` bytes after that are NUL corruption — strip them with `truncate` or re-save in your editor.

---

## 20. Known Limitations & Roadmap

| Item | Status | Notes |
|---|---|---|
| API versioning | Open | Not implemented. All routes are `/api/...` with no version prefix. |
| JWT refresh tokens | Open | Not implemented. Access tokens expire and require re-login. |
| Financial fields in DECIMAL | OK for now | Correct for display at current volumes. Production-scale financial systems may prefer integer cents. Re-evaluate when volumes increase. |
| Sanctions screening | Partial | `Lead.sanctionsScreened` boolean field exists. Manual update flow only. Automated screening (OFAC SDN, EU consolidated, UN consolidated) is the next AI feature to build (Feature 2 of the AI roadmap). |
| GDPR consent flag | Open | `Lead.gdprConsent`, `gdprConsentObtainedAt`, `gdprConsentChannel` fields not yet added. Required before EU/UK outbound at scale. |
| Customer portal | In progress | Standalone customer portal exists at `frontend/customer-portal/` (separate from the `client-contacts` admin module). |
| Factory portal | In progress | Standalone factory portal at `frontend/factory-portal/`. Includes warehouse scan-receive and scan-inventory features (Phase 8). |
| Audit trail | Partial | `DocumentApproval` has IP/UA logging. `auditService.logAction()` exists for manual audit calls in controllers. Auto-hooks on financial models are not yet implemented; logging is opportunistic. |
| i18n | Partial | Frontend has a `LanguageSwitcher` component. Translation strings not fully populated. |
| Rate limiting | Done | Implemented across general API, auth (stricter in production), and public approval endpoints. |
| Tests | Done (backend) | 219 backend tests passing as of Phase 6. Playwright E2E infrastructure in `backend/e2e/helpers/` (Phase 7). Coverage gaps remain on CRM, outreach, financial validation routes. |
| CI/CD | Done | GitHub Actions: ci.yml, deploy.yml, security.yml. CodeQL plus Trivy plus TruffleHog scanning weekly and on PRs. |
| API documentation | Done | Swagger UI at `/api-docs`. 95+ endpoints documented in OpenAPI 3.0 (Phase 6). |
| Webhooks | Done | Phase 5: 7 supported events, HMAC signing, exponential retry, delivery audit. |
| Exchange rates | Done | Phase 5: live API with 6-hour scheduler, fallback to hardcoded rates. |
| Docker production stack | Done | Phase 5: multi-stage build, nginx reverse proxy, health checks, SSL/TLS. |
| Bank integration (LC) | Simulated | Phase 8: 6 endpoints simulated against a real bank API. Real bank integration requires credentials and contracts. |
| AI features | In planning | Phase 9 roadmap: inbound email triage, sanctions screening, supplier memory search, document parsing, reply categorization, smart alerts. Built on local LLM (Ollama) plus LiteLLM proxy plus LangFuse self-hosted plus Promptfoo to keep zero recurring cost. |

---

*Last updated: 2026-05-01. Catch-up edit after the April 30 audit fixes shipped without the doc being updated. Drift items corrected: SQLite (was wrongly described as Postgres), MCP env vars (was wrongly listed as ERP_API_URL/ERP_JWT_TOKEN), rate limiting (was listed as missing), tests (was listed as missing), sanctions flag, validation, security notes, and the limitations table.*
*Maintainer: Sovern House Engineering*
