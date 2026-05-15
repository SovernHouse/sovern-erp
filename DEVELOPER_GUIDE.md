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
21. [Known Limitations & Roadmap](#21-known-limitations--roadmap)
22. [AI Assistant Architecture](#22-ai-assistant-architecture)
23. [Configurable Dashboard](#23-configurable-dashboard)
24. [Google Calendar Background Sync](#24-google-calendar-background-sync)
25. [Google Drive File Browser](#25-google-drive-file-browser)

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
│   ├── controllers/            # Route handler logic — barrel pattern for large modules
│   │   ├── crmController.js    # Barrel — re-exports all CRM sub-controllers
│   │   ├── contactController.js
│   │   ├── leadController.js
│   │   ├── activityController.js
│   │   ├── dealController.js
│   │   ├── campaignController.js
│   │   └── crmDashboardController.js
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
│   │   ├── personalization/    # Sub-routers mounted via barrel
│   │   │   ├── notificationRoutes.js
│   │   │   ├── commissionRoutes.js
│   │   │   ├── filterPresetRoutes.js
│   │   │   ├── templateRoutes.js
│   │   │   ├── productAttributeRoutes.js
│   │   │   └── priceListRoutes.js
│   │   ├── personalizationRoutes.js  # Barrel — mounts personalization/ sub-routers
│   │   └── dashboardRoutes.js  # Cleaned (#48) — duplicate routes removed, DashboardLayout storage
│   ├── services/
│   │   ├── pdf/                # PDF generators — barrel pattern
│   │   │   ├── pdfHelpers.js        # Shared utilities (re-exported for all generators)
│   │   │   ├── salesDocumentsPDF.js # Quotation, Proforma, Sales Note
│   │   │   ├── orderDocumentsPDF.js # Sales Order, PO, Packing List
│   │   │   ├── financeDocumentsPDF.js # Invoice, Credit Note, Statement
│   │   │   └── logisticsDocumentsPDF.js # Inspection, Shipment, Product Spec
│   │   ├── documentGenerator.js # Barrel — re-exports all PDF generators
│   │   ├── emailService.js
│   │   ├── notificationService.js
│   │   └── schedulerService.js # node-cron background jobs
│   ├── utils/
│   │   ├── helpers.js          # Pagination, response shapes
│   │   ├── logger.js           # Winston logger — JSON to stdout (GCP), pretty in dev, silent in test
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

### Barrel pattern (introduced in #48)

Large files are split into focused modules; the original file becomes a **barrel** that re-exports everything. All existing importers are unchanged.

**Controllers** (function exports) — barrel uses object spread:
```js
// crmController.js
module.exports = {
  ...require('./contactController'),
  ...require('./leadController'),
  // ...
};
```

**Routes** (Express Router instances) — barrel mounts each sub-router:
```js
// personalizationRoutes.js
const router = express.Router();
router.use('/', require('./personalization/notificationRoutes'));
router.use('/', require('./personalization/commissionRoutes'));
// ...
module.exports = router;
```

**PDF services** — barrel uses object spread (same as controllers):
```js
// documentGenerator.js
module.exports = {
  ...require('./pdf/salesDocumentsPDF'),
  ...require('./pdf/orderDocumentsPDF'),
  // ...
};
```

When adding a new sub-file, register it in the barrel. Do not change the route registration in `server.js` or any controller imports in route files.

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

### Recent schema additions (2026-05)

**`Quotation` — sourcing trail fields**

| Field | Type | Description |
|---|---|---|
| `factoryId` | UUID FK → `Factory` | The supplier factory providing goods for this quotation. Optional. Included in `getAll` and `getById` responses as `factory: { id, companyName, country }`. |
| `leadId` | UUID FK → `Lead` | The CRM lead this quotation was built for. Optional. Provides pipeline attribution. Included in responses as `lead: { id, companyName, contactName }`. |

Both fields are accepted on `POST /api/quotations` (create) and `PUT /api/quotations/:id` (update). They are filterable via `?factoryId=` and `?leadId=` on `GET /api/quotations`. The QuotationForm admin UI includes factory and lead pickers; QuotationDetail surfaces the sourcing trail section. The Sovern Ops mobile app (`app/quotation/[id].tsx`) also displays the sourcing trail.

**`Factory` — profile enrichment fields**

| Field | Type | Description |
|---|---|---|
| `notes` | TEXT | Internal notes about the factory — negotiation history, quality issues, key contacts. Not exposed to external parties. |
| `logo` | VARCHAR(500) | URL to the factory or brand logo. Used on the factory profile card. |

Both fields are accepted on `POST /api/factories` (create) and `PUT /api/factories/:id` (update).

**`Product` — dual-description fields**

| Field | Type | Description |
|---|---|---|
| `salesDescription` | TEXT | Client-facing description. Shown on quotations, sales orders, and the customer portal. |
| `purchaseDescription` | TEXT | Supplier-facing description. Shown on factory purchase orders — may include tolerances, QC requirements, certifications. |

**`ProductPrice` — extended pricing fields**

| Field | Type | Description |
|---|---|---|
| `exwPrice` | DECIMAL(12,2) | EX-Works price at factory gate. Optional supplement to the primary `costPrice` (FOB). |
| `priceType` | ENUM('FOB','CIF','EXW','CFR','DDP') | Incoterm that governs the `costPrice`. Defaults to `'FOB'`. |

**Margin formula** (enforced in `productController.js`): `sellingPrice = costPrice / (1 − markup / 100)`. Never multiply — division gives gross margin. When a new active price is created for a factory, all existing active prices for that factory are automatically set to `isActive: false`.

**`ProductSpecification` — commercial visibility**

| Field | Type | Description |
|---|---|---|
| `clientVisibleFields` | JSON (string[]) | Array of spec field keys shown to buyers on quotations and sales orders. All fields always appear on supplier POs. Defaults to the most commercially relevant flooring fields. |

The dual-spec architecture is a single `ProductSpecification` record per product. The admin portal `ProductDetail` renders two panels: "Technical Specs" (all fields, amber label — for POs) and "Commercial Specs" (`clientVisibleFields` only, primary label — for quotations). The `ProductForm` Commercial tab provides a checkbox grid to toggle each field's visibility.

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

### Chat (Internal + Omnichannel)

All endpoints are under `/api/chat`. Auth required on all.

**Rooms**

| Method | Path | Description |
|---|---|---|
| GET | `/api/chat/rooms` | List rooms the current user is a member of (with unread counts) |
| POST | `/api/chat/rooms` | Create a named channel. Body: `{ name, description?, isPrivate? }` |
| POST | `/api/chat/rooms/dm` | Get-or-create a DM room with another user. Body: `{ userId }` |
| GET | `/api/chat/rooms/:id` | Room detail + member list |
| PATCH | `/api/chat/rooms/:id` | Update name, description, isArchived, isPrivate |
| DELETE | `/api/chat/rooms/:id` | Hard delete (admin only, empty rooms only) |

**Members**

| Method | Path | Description |
|---|---|---|
| GET | `/api/chat/rooms/:id/members` | List active members |
| POST | `/api/chat/rooms/:id/members` | Add members. Body: `{ userIds: string[] }` |
| DELETE | `/api/chat/rooms/:id/members/:uid` | Remove member (soft — sets leftAt) |

**Messages**

| Method | Path | Description |
|---|---|---|
| GET | `/api/chat/rooms/:id/messages` | Paginated history. Query: `?limit=50&before=<ISO>` |
| POST | `/api/chat/rooms/:id/messages` | Send message. Body: `{ body, mentions?, entityRef?, attachments?, parentId? }` |
| PATCH | `/api/chat/rooms/:id/messages/:mid` | Edit own message. Body: `{ body }` |
| DELETE | `/api/chat/rooms/:id/messages/:mid` | Soft delete (sets body=null, deletedAt=now) |
| POST | `/api/chat/rooms/:id/messages/:mid/react` | Toggle emoji reaction. Body: `{ emoji }` |

**Read receipts**

| Method | Path | Description |
|---|---|---|
| POST | `/api/chat/rooms/:id/read` | Mark all messages as read (sets `lastReadAt = now` on membership) |

**Utility**

| Method | Path | Description |
|---|---|---|
| GET | `/api/chat/users` | All active users for @mention autocomplete. Query: `?q=search` |

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

### Products

| Method | Path | Description |
|---|---|---|
| GET | `/api/products` | List products (paginated). Query: `?page=&limit=&search=&categoryId=&factoryId=` |
| POST | `/api/products` | Create product |
| GET | `/api/products/:id` | Get product detail (includes `prices`, `factory`, `category`) |
| PUT | `/api/products/:id` | Update product (includes `salesDescription`, `purchaseDescription`) |
| DELETE | `/api/products/:id` | Soft delete product |
| GET | `/api/products/categories/flat` | Flat list of all categories for dropdowns |
| GET | `/api/products/:id/price-history` | Full price history for a product |
| POST | `/api/products/:id/prices` | Add a supplier price. Computes `sellingPrice` server-side. Auto-deactivates prior active price for the same factory. |
| PUT | `/api/products/:id/prices/:priceId` | Update a price record. Re-computes `sellingPrice` if `costPrice` or `markup` changes. |
| DELETE | `/api/products/:id/prices/:priceId` | Delete a price record |
| GET | `/api/products/:id/specs` | Get product specification (returns `null` if not yet created) |
| POST | `/api/products/:id/specs` | Create specification record |
| PUT | `/api/products/:id/specs` | Update specification. `clientVisibleFields` is a JSON array of field key strings. |

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

### Pre-push syntax check

Before pushing, verify all route and service files parse without error. Use `node --check` (syntax only — no env dependencies, no require-time crashes):

```bash
# From repo root — covers top-level routes and personalization/ sub-routers
for f in backend/routes/*.js backend/routes/**/*.js backend/services/pdf/*.js; do
  node --check "$f" && echo "OK: $f" || echo "FAIL: $f"
done
```

`node --check` is the correct tool here. Do NOT use `node -e "require('./file')"` — that executes the module, pulling in Sequelize → sqlite3, which may not be installed locally and will produce a false FAIL.

If a file fails and looks correct, check for binary corruption:
```bash
tail -c 40 backend/routes/yourFile.js | xxd
```
A clean file ends with `...;\n` (0x0a). Any `00` bytes after that are NUL corruption — strip them with `truncate` or re-save in your editor.

---

## 20. Chat System Architecture

### Overview

The chat system is an internal messaging + omnichannel inbox. It is designed channel-agnostic from day one so external platforms (WhatsApp, WeChat/WeCom, Telegram) can be wired in via webhooks without schema migrations.

### Models

| Model | Table | Purpose |
|---|---|---|
| `ChatRoom` | `ChatRooms` | A conversation container. Types: `dm`, `channel`, `external` |
| `ChatMessage` | `ChatMessages` | A single message in a room. Soft-deleteable. |
| `ChatRoomMember` | `ChatRoomMembers` | Join table: who is in which room. Holds `lastReadAt` for read receipts. |

**ChatRoom key fields**
- `type`: `dm | channel | external`
- `channelSource`: `internal | whatsapp | telegram | wechat | email | sms` — origin platform
- `externalRoomId`: platform-specific group/thread ID for dedup and reply routing
- `dmUserA` / `dmUserB`: canonical DM lookup (sorted UUIDs, unique pair = 1 room)
- `lastMessageAt` + `lastMessagePreview`: denormalised for sidebar sort without a subquery

**ChatMessage key fields**
- `senderId`: ERP User UUID — null for inbound external messages
- `source`: same enum as `ChatRoom.channelSource`
- `externalId`: platform message ID for webhook dedup (unique index on `source + externalId`)
- `externalSenderId` / `externalSenderName`: for external contacts not in the ERP
- `mentions`: JSON array of User UUIDs — used to trigger notifications
- `entityRef`: JSON `{ type, id, label }` — links to an ERP record (e.g. Quotation QT-0042)
- `deletedAt`: soft delete — body set to null, UI shows "Message deleted."

**ChatRoomMember key fields**
- `lastReadAt`: cursor-based read receipts — unread count = messages after this timestamp
- `role`: `member | admin` — admins can rename/archive/add/remove
- `leftAt`: soft membership — history preserved after leaving

### chatService.js

Mirrors the `notificationService` pattern. `server.js` calls `chatService.setIO(io)` after socket.io init. The controller calls emit helpers rather than touching `io` directly.

Socket room naming: `chat-room-${chatRoomId}`. Users also stay in their `user-${userId}` room (from `socketAuthMiddleware`) so they receive `chat:added_to_room` events when someone adds them to a new conversation.

**Client → server events** (emitted by the browser)

| Event | Payload | Effect |
|---|---|---|
| `chat:join_room` | `chatRoomId` | `socket.join('chat-room-<id>')` |
| `chat:leave_room` | `chatRoomId` | `socket.leave('chat-room-<id>')` |
| `chat:typing` | `{ chatRoomId, isTyping }` | Relayed to all other room members |

**Server → client events** (emitted by chatService)

| Event | Payload | Trigger |
|---|---|---|
| `chat:new_message` | `{ roomId, message }` | Message sent via POST |
| `chat:message_edited` | `{ roomId, message }` | Message edited via PATCH |
| `chat:message_deleted` | `{ roomId, messageId }` | Message soft-deleted |
| `chat:room_updated` | `{ roomId, room }` | Room renamed/archived |
| `chat:member_added` | `{ roomId, member }` | Member added |
| `chat:member_removed` | `{ roomId, userId }` | Member removed |
| `chat:typing` | `{ roomId, userId, isTyping }` | Typing indicator relay |
| `chat:read` | `{ roomId, userId, lastReadAt }` | Read receipt updated |
| `chat:added_to_room` | `{ room }` | Sent to `user-<id>` room when added to a new room |

### Frontend hooks

**`useChat.js`** exports:
- `useChatRooms()` — room list + unread counts, updates on socket events
- `useChatRoom(roomId)` — messages + members + pagination for one room
- `useChatSocket(roomId, callbacks)` — joins socket room, wires all events, cleans up on unmount
- `useTypingIndicator(roomId, userId)` — throttled typing send + incoming typing state

### Omnichannel integration path (WhatsApp / WeChat / Telegram)

To add an external channel, you need three things:

1. **Webhook endpoint** — `POST /api/chat/inbound/:channel` (not yet built — this is the next step). The handler:
   - Verifies the platform's HMAC signature
   - Finds or creates a `ChatRoom` with `type: 'external'`, `channelSource: 'whatsapp'` (or `wechat`/`telegram`), and `externalRoomId` = the group/thread ID from the platform
   - Creates a `ChatMessage` with `source: 'whatsapp'`, `externalId`, `externalSenderId`, `externalSenderName`, and `body`
   - Calls `chatService.emitNewMessage()` so connected agents see it in real time

2. **Outbound routing** — when a team member replies in an external-source room, the sendMessage handler checks `room.channelSource` and calls the appropriate platform API to deliver the reply. This is a separate service (`services/whatsappService.js` etc.).

3. **Platform credentials** — stored in `.env`: `WHATSAPP_TOKEN`, `WECHAT_CORP_ID`, `WECHAT_CORP_SECRET`, `TELEGRAM_BOT_TOKEN`.

No schema migration needed — all fields (`source`, `externalId`, `channelSource`, `externalRoomId`) are already in the models.

**Platform notes**:
- **WhatsApp**: Meta Cloud API (`graph.facebook.com/v18.0`) — requires a Meta Business account and a verified phone number. Twilio Conversations is a managed alternative.
- **WeChat Work / WeCom**: `qyapi.weixin.qq.com` — requires registering your company on WeCom. The webhook receives XML-encoded messages; responses must be encrypted with AES-256.
- **Telegram**: `api.telegram.org` — simplest of the three. Register a bot via BotFather, set the webhook URL to your endpoint.

### Files

```
backend/
  models/
    ChatRoom.js
    ChatMessage.js
    ChatRoomMember.js
  controllers/
    chatController.js
  routes/
    chatRoutes.js
  services/
    chatService.js

frontend/admin-portal/src/
  hooks/
    useChat.js
  components/chat/
    ChatPanel.jsx        ← room list + message area + input
    ChatBubble.jsx       ← floating bottom-right overlay
  pages/
    ChatPage.jsx         ← full /chat management page
  services/
    api.js               ← chatAPI export
  constants/
    tooltipContent.js    ← CHAT section
    helpContent.js       ← /chat entry
  config/
    rbacConfig.js        ← Chat nav item added to all roles
```

---

## 21. Known Limitations & Roadmap

| Item | Status | Notes |
|---|---|---|
| API versioning | Open | Not implemented. All routes are `/api/...` with no version prefix. |
| JWT refresh tokens | Open | Not implemented. Access tokens expire and require re-login. |
| Financial fields in DECIMAL | OK for now | Correct for display at current volumes. Production-scale financial systems may prefer integer cents. Re-evaluate when volumes increase. |
| Sanctions screening | Partial | `Lead.sanctionsScreened` boolean field exists. Manual update flow only. Automated screening (OFAC SDN, EU consolidated, UN consolidated) is the next AI feature to build (Feature 2 of the AI roadmap). |
| GDPR consent flag | Open | `Lead.gdprConsent`, `gdprConsentObtainedAt`, `gdprConsentChannel` fields not yet added. Required before EU/UK outbound at scale. |
| Dashboard customization frontend | Done | 7-widget configurable dashboard with react-grid-layout drag/resize, per-role defaults, size presets, and layout persistence via `DashboardLayout` model. See Section 23. |
| Dashboard action reminder banner | Done | Odoo-style banner live. Green = on time, amber = today, red = overdue. |
| Internal chat + tagging | Done | ChatRoom/Message/Member models, chatController, chatRoutes, chatService, ChatPanel, ChatBubble, /chat page. Omnichannel fields ready for WhatsApp/WeChat/Telegram webhooks. |
| Chat omnichannel webhooks | Planned | Inbound webhook handler + outbound routing per platform. See Section 20 for integration path. |
| Customer portal | In progress | Standalone customer portal exists at `frontend/customer-portal/` (separate from the `client-contacts` admin module). |
| Factory portal 
---

## 22. AI Assistant Architecture

### Overview

The AI Assistant is a context-aware trade chatbot powered by Claude. It reads a live ERP snapshot at query time and responds using the `claude -p` subprocess pattern — the same approach used by `gmailSyncService.js`. All conversation history is stored in SQLite. The feature ships on three surfaces: admin portal (`AssistantPage.jsx`), mobile (`assistant.tsx`), and the shared REST backend (`/api/ai/*`).

---

### Model: `AIConversation`

File: `backend/models/AIConversation.js`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `userId` | UUID FK → Users | Scoped per user — no cross-user access |
| `title` | STRING | Auto-generated from first message (5-word Claude summary) |
| `messages` | TEXT (JSON) | Serialised array of `{ role, content, timestamp }`. Getter/setter handle JSON parse/stringify. Same pattern as `ConnectedGoogleAccount.scopes`. |
| `lastMessageAt` | DATE | Updated on each `chat` call for sidebar sort |

Registered in `backend/models/index.js` after `ConnectedGoogleAccount`.

---

### Service: `aiContextService.js`

File: `backend/services/aiContextService.js`

Builds the system prompt injected into every AI request. Key exports:

- **`buildSystemPrompt(user)`** — Returns the full system prompt string. `super_admin` and `admin` roles get the full Sovern House context + live ERP snapshot. All other roles get a scoped prompt with their role description.
- **`getLiveERPSnapshot(userRole)`** — Fires parallel DB queries at call time (not cached). Returns a formatted string with: lead pipeline counts by stage, top 5 pending triage items (subject, sender, intent score), last 5 quotations (number, customer, total, status), upcoming activities (due ≤7 days), connected Google accounts. Each query is individually try-caught so partial failures do not break the prompt.
- **Inline constants** — `SOVERN_HOUSE_CONTEXT` (company identity, business model, trading rules), `TEAM_FRAMEWORK` (all advisory lenses: CEO/CFO/CMO/Attorney/Compliance etc.), `WRITING_RULES` (no em dashes, positive framing, no self-introductions, etc.).

---

### Controller: `aiController.js`

File: `backend/controllers/aiController.js`

**`chat` (POST /api/ai/chat)**
1. Load or create `AIConversation` for `(userId, conversationId)`.
2. Call `buildSystemPrompt(user)` to get the system prompt with live ERP snapshot.
3. Assemble full prompt: `[system prompt]\n\n[last 20 messages as Human/Assistant transcript]\n\nHuman: [new message]\n\nAssistant:`.
4. Spawn `claude -p fullPrompt` subprocess (120s timeout). Collect stdout as reply.
5. Append user and assistant messages to `conversation.messages`, save.
6. If new conversation: fire a second `claude -p` call to auto-generate a 5-word title.
7. Return `{ success, data: { conversationId, title, reply, isNew } }`.

**Other endpoints**
- `listConversations` — GET, returns all conversations for the requesting user, sorted by `lastMessageAt DESC`.
- `getConversation` — GET `:id`, returns `{ conversation, messages }`.
- `deleteConversation` — DELETE `:id`.
- `clearConversation` — POST `:id/clear`, wipes `messages` array, resets `lastMessageAt`.

**`claude -p` subprocess pattern**
```js
const { execFile } = require('child_process');
// Spawns: claude -p "<fullPrompt>"
// stdout → reply text; stderr logged but not fatal; 120s timeout.
// Same pattern as gmailSyncService.js AI classification calls.
```

> **Important:** The prompt string is assembled inline with template literals. When writing to files via the Write tool, use a bash heredoc (`cat > file << 'ENDOFFILE'`) because the Write tool truncates content containing backtick template literals.

---

### Routes: `aiRoutes.js`

File: `backend/routes/aiRoutes.js`

```
POST   /api/ai/chat                    → ai.chat
GET    /api/ai/conversations           → ai.listConversations
GET    /api/ai/conversations/:id       → ai.getConversation
DELETE /api/ai/conversations/:id       → ai.deleteConversation
POST   /api/ai/conversations/:id/clear → ai.clearConversation
```

All routes require `requireAuth` (from `middleware/auth.js`). Mounted in `server.js` as `app.use('/api/ai', aiRoutes)`.

> **Auth import:** `const { requireAuth } = require('../middleware/auth')`. The `auth.js` module exports `requireAuth`, `requireRole`, and `requireAny` — there is no `authenticate` export. Using the wrong name silently registers `router.use(undefined)` and throws at runtime.

---

### Frontend: `AssistantPage.jsx`

File: `frontend/admin-portal/src/pages/AI/AssistantPage.jsx`

Key structure:
- **Left sidebar (260px):** conversation list + "New conversation" button. Hover-reveal delete button per item.
- **Main area:** header, scrollable message list, compose bar (auto-resize textarea, Enter to send, Shift+Enter for newline).
- **WelcomeScreen:** shown when no messages exist. Six suggestion prompts pre-wired to common Sovern House workflows.
- **`renderMarkdown(text)`:** custom renderer for code blocks, headings, horizontal rules, bullet lists, numbered lists, bold, inline code. No external dependency.
- **`MessageBubble`:** user messages right-aligned blue; assistant messages left-aligned white with border. Timestamps shown.
- **`TypingIndicator`:** three bouncing dots (CSS keyframe).

RBAC: accessible to all roles (`super_admin`, `admin`, `coo`, `sales_rep`, `finance`, `operations`, `viewer`). Nav item uses `Sparkles` icon from lucide-react — must be in both the import list and `iconMap` in `Layout.jsx`.

`api.js` export:
```js
export const aiAPI = {
  chat:               (data) => api.post('/ai/chat', data),
  listConversations:  ()     => api.get('/ai/conversations'),
  getConversation:    (id)   => api.get(`/ai/conversations/${id}`),
  deleteConversation: (id)   => api.delete(`/ai/conversations/${id}`),
  clearConversation:  (id)   => api.post(`/ai/conversations/${id}/clear`),
}
```

---

### Mobile: `assistant.tsx`

File: `mobile/sovern-ops-app/app/(tabs)/assistant.tsx`

Two-view pattern (same as `chat.tsx`):
- **View 1 — conversation list:** pull-to-refresh, tap to open, long-press shows a Rename / Delete / Cancel action menu. Rename opens a modal with a `TextInput` pre-populated with the current title; submit calls `aiRenameConversation` and updates the list optimistically.
- **View 2 — thread view:** forest-coloured header with ← Back, scrollable `FlatList` of `MsgBubble` components, `WelcomeScreen` as list header when empty, `TypingIndicator` as list footer while awaiting reply, compose bar with multiline `TextInput`.

`stripMarkdown(text)` helper removes `**bold**`, `# headers`, `---` rules, bullet markers, and backtick code so AI responses read cleanly as plain text on mobile.

**Hooks-rule note (L-014):** the role gate (`if (!isAuthorized) return <AccessRestricted/>`) must be a render-time JSX conditional placed AFTER all `useState` / `useEffect` / `useRef` calls, never as an early return above them. Putting it above causes the component to render zero hooks on logout (when `user` becomes null) after rendering 8+ hooks while signed in, which crashes with "Rendered fewer hooks than expected" and trips the ErrorBoundary. The data-loading effect itself guards on `isAuthorized` *inside* the effect — the hook still runs, the side-effect doesn't.

API functions added to `mobile/sovern-ops-app/src/services/api.ts`:
- `aiChat(message, conversationId?)` — POST `/api/ai/chat`
- `aiListConversations()` — GET `/api/ai/conversations`
- `aiGetConversation(id)` — GET `/api/ai/conversations/:id`
- `aiRenameConversation(id, title)` — PATCH `/api/ai/conversations/:id`
- `aiDeleteConversation(id)` — DELETE `/api/ai/conversations/:id`
- `aiClearConversation(id)` — POST `/api/ai/conversations/:id/clear`

Tab registered in `_layout.tsx` as a secondary module (accessible from Home grid, not in bottom tab bar). Added to `MODULES` in `dashboard.tsx` as `{ icon: '✦', label: 'AI Assistant', route: '/(tabs)/assistant' }`.

---

### File map

```
backend/
  models/
    AIConversation.js          ← SQLite model, JSON messages getter/setter
  services/
    aiContextService.js        ← system prompt builder + live ERP snapshot
  controllers/
    aiController.js            ← chat, listConversations, getConversation, deleteConversation, clearConversation
  routes/
    aiRoutes.js                ← REST routes, requireAuth middleware

frontend/admin-portal/src/
  pages/
    AI/
      AssistantPage.jsx        ← full chat UI, markdown renderer, sidebar, welcome screen
  services/
    api.js                     ← aiAPI export
  constants/
    tooltipContent.js          ← AI section
    helpContent.js             ← /ai/assistant entry
  config/
    rbacConfig.js              ← AI Assistant nav item, all roles
  components/
    Layout.jsx                 ← Sparkles icon added to import + iconMap

mobile/sovern-ops-app/
  app/(tabs)/
    assistant.tsx              ← conversation list + thread view
    _layout.tsx                ← assistant registered as secondary module
    dashboard.tsx              ← AI Assistant tile in MODULES grid
  src/services/
    api.ts                     ← ai* function exports + AIConversation/AIMessage types
```

---

## 23. Configurable Dashboard

### Overview

The dashboard is a per-user configurable widget grid built on `react-grid-layout`. Each user can choose which widgets to display, their sizes, and their positions. Layout is persisted server-side and falls back to a per-role default when no saved layout exists.

### File: `frontend/admin-portal/src/pages/Dashboard/ConfigurableDashboard.jsx`

### Widgets

| Widget ID | Component | Description |
|---|---|---|
| `revenue` | `RevenueWidget` | Monthly invoiced revenue vs. prior month |
| `orders` | `OrderStatusWidget` | Live order count grouped by status |
| `approvals` | `ApprovalsWidget` | Pending document approvals awaiting client response |
| `activity` | `ActivityWidget` | Recent CRM interactions across all active leads |
| `kpi` | `KPIWidget` | Single tracked metric with trend and progress |
| `actions` | `QuickActionsWidget` | Role-specific one-click shortcuts |
| `alerts` | `AlertsWidget` | System warnings, overdue items, low-stock thresholds |

Widget components are registered in `WIDGET_COMPONENTS` and metadata (id, label, type, default w/h) is held in `ALL_WIDGETS`.

### Size Presets

| Label | Columns | Rows |
|---|---|---|
| Small | 4 | 3 |
| Medium | 6 | 4 |
| Wide | 8 | 4 |
| Full | 12 | 4 |
| Tall | 6 | 6 |

The 12-column grid means Full-width widgets span the entire row.

### Per-Role Defaults (`ROLE_DEFAULTS`)

Each role has a preset widget layout used when the user has no saved layout. Roles covered: `admin`, `sales`, `operations`, `finance`, `inspector`, `customer`, `factory`. Defaults are defined as `react-grid-layout` layout arrays.

### Layout Persistence

- **GET `/api/dashboard/layout`** — returns the user's saved layout JSON, or `null` if none exists.
- **POST `/api/dashboard/layout`** — saves the current layout. Body: `{ layout, widgets }`.
- Auto-save fires 2 seconds after the last drag or resize event (`useDebouncedSave(2000)`).
- Explicit "Save Layout" button in the configurator panel triggers an immediate save.

### Customization Panel

The `DashboardConfiguratorPanel` (slide-out via the + button in the toolbar) provides:
- Per-widget toggle (include/exclude)
- Size selector per widget
- Apply, Reset to Default, and Cancel actions

`WidgetHeader` renders each widget's title bar with a `.drag-handle` class (required by `react-grid-layout` for handle-only drag) and a remove (×) button.

### File Map

```
frontend/admin-portal/src/
  pages/Dashboard/
    ConfigurableDashboard.jsx    ← main file: grid, configurator, widget registry
  services/
    api.js                       ← dashboardAPI (getLayout, saveLayout)
  constants/
    tooltipContent.js            ← DASHBOARD export
    helpContent.js               ← / (dashboard) entry, customization steps

backend/
  models/
    DashboardLayout.js           ← userId, layoutData (JSON), widgetsData (JSON)
  controllers/
    dashboardController.js       ← getLayout, saveLayout
  routes/
    dashboardRoutes.js           ← GET/POST /api/dashboard/layout, requireAuth
```

---

## 24. Google Calendar Background Sync

### Overview

Google Calendar events are synced into the ERP database on a 15-minute cron schedule. This allows the ERP to query calendar data without hitting the Google API on every request, and enables features like linking calendar events to CRM leads.

### Sync Flow

1. `server.js` schedules `runCalendarSync()` via node-cron every 15 minutes.
2. `calendarSyncService.js` iterates all active `ConnectedGoogleAccount` records with Calendar scope.
3. For each account, it calls the Google Calendar API using the stored OAuth tokens (via `getAuthClientForAccount()`).
4. **Incremental sync** uses the `syncToken` stored on `ConnectedGoogleAccount.calendarSyncToken`. On first run (or after a 410 Gone error), a full sync is performed.
5. Each event is upserted into the `CalendarEvent` model (unique index on `[google_event_id, connected_account_id]`).
6. Cancelled events set `status = 'cancelled'`. Deleted events are deactivated.
7. On `invalid_grant` error, the account's `isActive` flag is set to `false` and sync is skipped.

### CalendarEvent Model

File: `backend/models/CalendarEvent.js`

Key fields:

| Field | Type | Notes |
|---|---|---|
| `googleEventId` | STRING | The Google Calendar event ID |
| `connectedAccountId` | UUID FK | Links to `ConnectedGoogleAccount` |
| `title` | STRING | Event summary |
| `startAt` / `endAt` | DATE | Datetime for timed events |
| `startDate` / `endDate` | DATEONLY | Date for all-day events |
| `isAllDay` | BOOLEAN | |
| `attendees` | JSON | Array of `{ email, displayName, responseStatus }` |
| `meetLink` | STRING | Google Meet URL if present |
| `linkedLeadId` | UUID FK | Optional link to a CRM Lead |
| `rawEventData` | JSON | Full Google Calendar event payload |

Unique constraint: `[google_event_id, connected_account_id]` prevents duplicate syncs across accounts.

### OAuth Token Handling

Calendar sync reuses the same `ConnectedGoogleAccount` model used by Drive and Gmail. Call `getAuthClientForAccount(account)` from `googleAccountController.js` to get a ready OAuth2 client with auto-refresh.

### File Map

```
backend/
  models/
    CalendarEvent.js             ← event storage model
  services/
    calendarSyncService.js       ← sync logic: incremental, upsert, error handling
  routes/
    calendarRoutes.js            ← GET /api/calendar/events, /events/:id, /today, PATCH /:id/link-lead

frontend/admin-portal/src/
  services/
    api.js                       ← calendarAPI (getEvents, getEvent, getToday, linkLead)
```

---

## 25. Google Drive File Browser

### Overview

The Drive browser is a live proxy — it does NOT sync Drive data to the ERP database. Every request hits the Google Drive API v3 in real time. This keeps the implementation simple and ensures results are always current.

### Architecture

```
GoogleDrivePage.jsx  →  driveAPI (api.js)  →  /api/drive/*  →  driveController.js  →  Google Drive API v3
```

Auth is handled by `getAuthClientForAccount()` from `googleAccountController.js`, which retrieves the stored OAuth tokens for the selected `ConnectedGoogleAccount` and returns an authenticated `google.auth.OAuth2` client.

### Backend: `backend/controllers/driveController.js`

| Export | Route | Description |
|---|---|---|
| `listFiles` | GET `/api/drive/files` | List files/folders in a given `folderId` (defaults to root). Supports `pageToken` for pagination. |
| `getFile` | GET `/api/drive/files/:fileId` | Get metadata for a single file. |
| `searchFiles` | GET `/api/drive/search` | Full-text search across the account. |
| `getBreadcrumb` | GET `/api/drive/breadcrumb` | Returns the ancestor chain from root to a given `folderId` as a flat array. |

All routes require `requireAuth` + `requireRole('admin', 'manager')` (see `backend/routes/driveRoutes.js`).

Response envelope: `{ success: true, data: { files: [...], nextPageToken } }` for list/search; `{ success: true, data: [...] }` for breadcrumb.

### Response Unwrapping

The shared axios instance in `api.js` unwraps `{ success: true, data: X }` envelopes via a response interceptor, so callers receive `response.data = X` (not `response.data.data = X`). All data access in `GoogleDrivePage.jsx` must use `res.data.files`, `res.data.nextPageToken`, etc. — NOT `res.data.data.files`.

### Frontend: `GoogleDrivePage.jsx`

File: `frontend/admin-portal/src/pages/GoogleDrive/GoogleDrivePage.jsx`

Features:
- Account selector: dropdown of connected Google accounts with Drive scope
- Folder navigation: click a row to enter a folder; state maintained in `currentFolderId`
- Breadcrumb: fetched via `/api/drive/breadcrumb`; each crumb is clickable to jump to that folder
- Pagination: "Load more" appends the next page using `nextPageToken`
- Search: debounced 500 ms; results replace the folder view; clear to return
- File open: external link to `webViewLink` (opens Google Drive in new tab)
- File download: direct link to `webContentLink` where available

### Known Limitation

`/api/google/accounts` (used to populate the account selector) is admin-only. Managers who navigate to `/drive` will see "Failed to load connected accounts." A separate endpoint returning role-scoped accounts is needed to resolve this. Low priority while Alex is the sole user.

### File Map

```
backend/
  controllers/
    driveController.js           ← listFiles, getFile, searchFiles, getBreadcrumb
  routes/
    driveRoutes.js               ← /api/drive/* routes, requireAuth + requireRole

frontend/admin-portal/src/
  pages/GoogleDrive/
    GoogleDrivePage.jsx          ← full Drive browser UI
  services/
    api.js                       ← driveAPI (listFiles, getFile, search, breadcrumb)
  config/
    rbacConfig.js                ← Google Drive nav item in Documents submenu (admin + manager)
  App.jsx                        ← /drive route registered
  constants/
    tooltipContent.js            ← GOOGLE_DRIVE export
    helpContent.js               ← /drive entry
```

---

## 26. Sovern Ops Mobile App

### Standing rule: mobile mirrors desktop

Every change to the desktop admin portal must ship a mobile counterpart in the same session, OR be explicitly noted in `SESSION.md` as a pending parity task. Mobile is not a thin secondary surface — it mirrors desktop. This rule was codified in 2026-05-07 after a six-session stretch where 29 admin-portal commits shipped without any mobile updates and the apps drifted apart.

Concrete checklist when shipping any feature:
- New backend endpoint → add to `mobile/sovern-ops-app/src/services/api.ts`, even if the UI surface comes later
- New role / status / permission → add the role check on mobile
- New CRUD action on desktop → add the matching action on mobile (with a confirm dialog for destructive actions, since touch surfaces are high-mistap)
- New display field (signedAt, signedBy*, etc.) → surface it on mobile detail views
- Public-link supplier/customer flows (no auth) are the only legitimate exception — those aren't part of the Sovern Ops app

### Architecture overview

The mobile app is an Expo (SDK 54) React Native + Expo Router project at `mobile/sovern-ops-app/`. There is no standalone install — the app is opened via Expo Go on the phone, which fetches the JS bundle from EAS Update on Expo's CDN. The phone never talks to the developer's laptop in production.

Stack:
- Expo SDK 54, React 19.1, React Native 0.81
- Expo Router for file-based routing (`app/`)
- Zustand for the auth store; SecureStore for the JWT
- Custom tab bar (Odoo-style home grid) — see `app/(tabs)/_layout.tsx`
- Same `/api/*` backend as the admin portal — no mobile-specific routes

### Tabs and screens

```
app/
  _layout.tsx                  ← root stack, auth guard, ErrorBoundary
  index.tsx                    ← splash redirect
  (auth)/login.tsx
  (tabs)/
    _layout.tsx                ← custom bottom tab bar (Home / Inbox / Chat / Settings) + secondary modules registered as Tabs.Screen
    dashboard.tsx              ← Home: pipeline metrics + Odoo-style module grid
    triage.tsx                 ← inbox: inbound emails awaiting decision
    chat.tsx                   ← internal team chat
    settings.tsx               ← profile + sign out
    leads.tsx                  ← CRM list
    quotations.tsx             ← quotation list
    inquiries.tsx              ← RFQ triage from the road; tap → modal with delete
    approvals.tsx              ← internal manager approvals (raised by coordinators)
    activities.tsx             ← upcoming + overdue activities
    shipments.tsx              ← read-only shipment visibility
    invoices.tsx               ← read-only invoice visibility
    purchase-orders.tsx        ← PO list + detail modal with signedBy display
    sales-orders.tsx           ← SO list + detail modal with signedAt/signedByClient e-sign card and line items
    products.tsx               ← product catalog
    customers.tsx              ← customer directory; tap → modal with delete
    factories.tsx              ← supplier directory; tap → modal with delete (server blocks if open POs); accepts ?openId= to deep-link from Quotation Sourcing Trail
    assistant.tsx              ← AI assistant; long-press a conversation for Rename / Delete
  lead/[id].tsx                ← lead detail
  quotation/[id].tsx           ← quotation detail with sourcing trail + e-sign card
src/
  services/api.ts              ← single source of truth for all REST calls; all helpers must import from this file (never axios direct, see L-032)
  store/authStore.ts           ← Zustand store: { user, isAuthenticated, setUser, clearUser }
  constants/config.ts          ← SERVER_URL, SecureStore keys, COLORS palette
  components/ChatterSection.tsx← shared chatter feed embedded in detail screens
```

### Detail-screen pattern

Most detail views are rendered as a `Modal` triggered from a list row tap (`customers.tsx`, `factories.tsx`, `inquiries.tsx`, `purchase-orders.tsx`, `invoices.tsx`, `shipments.tsx`). The modal has a forest-coloured header with the entity name on the left, a `🗑` icon for delete actions where supported, and an `✕` close button. This pattern is preferred over Expo Router stack navigation for read-mostly screens because it preserves the back-tab affordance and avoids a redundant header.

Quotation and lead use full stack screens at `app/quotation/[id].tsx` and `app/lead/[id].tsx` because they have richer content (chatter, items, financials).

### E-signature display

Quotation, sales order, and PO models gained `signedAt` + `signedByClient` / `signedBySupplier` fields when the client/supplier signs via the public approve link. Mobile renders a green confirmation card above the Details section when both fields are present:

```
┌──────────────────────────────────────┐
│ ✓  Accepted by John Smith            │
│    May 7, 2026 at 2:14 PM           │
└──────────────────────────────────────┘
```

Card lives in `app/quotation/[id].tsx` (Quotation) and the PO detail modal in `app/(tabs)/purchase-orders.tsx` (Purchase Order). Renders only when both signed-fields are populated — never shown for unsigned records.

### Sign-link generation from mobile

Quotation detail (`app/quotation/[id].tsx`), Sales Order detail modal (`app/(tabs)/sales-orders.tsx`), and Purchase Order detail modal (`app/(tabs)/purchase-orders.tsx`) each expose a "Send for signature" CTA when the document hasn't been signed and isn't in a terminal state (cancelled / rejected / expired). Tapping it calls `POST /api/approvals/generate` with `{ entityType, entityId }`, gets back a public approve URL, and surfaces it in an Alert with **Open** (`Linking.openURL`) and **Share** (React Native's built-in `Share` API) buttons. The Share path uses the OS share sheet so the user can paste, email, SMS, or WhatsApp the link without leaving the app.

The API helper is `generateApprovalLink(entityType, entityId, opts?)` exported from `src/services/api.ts`. Backend supports four entity types: `ProformaInvoice`, `Quotation`, `SalesOrder`, `PurchaseOrder`. Mobile only wires Quotation / SO / PO; PI doesn't have a mobile detail screen yet (potential future parity item).

### AI-generated approval items in the Approvals tab

The Approvals tab (`app/(tabs)/approvals.tsx`) merges two backend sources to mirror desktop's `PendingApprovalsWidget`:

1. **InternalApproval** — `GET /api/internal-approvals?status=pending`. Manager-approval requests raised by coordinators (e.g. "approve sending this quotation"). Acted on with approve/reject buttons.
2. **ScheduledActivity (type='approve')** — `GET /api/scheduled-activities/my`, filtered client-side to `type === 'approve' && status === 'pending'`. AI-generated tasks created by the assistant when proposing new products or quotations. Acted on with a single mark-done button.

Both sources are fetched in parallel via `Promise.allSettled` so a single-source failure doesn't blank the tab. Items are merged into a discriminated union `AnyApproval = { kind: 'internal'|'activity'; data: ... }`, sorted by `createdAt` descending, and rendered with a kind badge ("Manager" green / "AI" amber) next to the title so the user can tell them apart. Two card components (`InternalApprovalCard`, `ActivityApprovalCard`) handle each shape.

### Cross-screen navigation

Mobile mirrors the desktop's "click an entity reference and jump to it" pattern via a single convention: the destination screen accepts a route param and auto-opens the relevant detail modal/screen on mount.

Current cross-links:

- **Quotation detail → Factory** — `app/quotation/[id].tsx` makes the Factory row in the Sourcing Trail tappable. `router.push({ pathname: '/(tabs)/factories', params: { openId: <factoryId> } })`. The Factories tab reads `useLocalSearchParams<{ openId?: string }>()` and triggers `setSelectedId(openId)` in a one-shot effect that runs after the list loads.
- **Inquiry → Quotation** — when an inquiry has been converted, the detail modal exposes "View linked quotation" which routes to `app/quotation/[id].tsx`. When un-converted, it shows "Convert to Quotation" which calls `POST /api/inquiries/:id/convert-to-quotation`, then navigates to the new quotation on success.

When adding more cross-links: keep the param name `openId` so multiple sources can deep-link into the same destination tab without coordinating param names. If a destination needs to disambiguate between deep-link and user-tap, use a separate param like `openSource=quotation-sourcing-trail`.

### CRUD deletes

Mobile-side delete is exposed via a `🗑` icon in the detail modal header → native `Alert` confirm → API call → optimistic list update. Three entities currently support delete on mobile:

- **Customer** (`DELETE /api/customers/:id`) — paranoid soft-delete, removes from all lists
- **Factory** (`DELETE /api/factories/:id`) — paranoid soft-delete; server blocks deletion when there are open POs (`status NOT IN ('completed', 'cancelled')`) and returns the count in the error message, which mobile surfaces verbatim
- **Inquiry** (`DELETE /api/inquiries/:id`) — hard delete; server blocks deletion when `convertedToQuotationId` is set

Per the standing rule: any new entity added with delete capability on desktop must add the matching mobile delete action.

### Hooks-rule gotcha (L-014)

Permission/role gates must be expressed as render-time JSX conditional returns placed AFTER all `useState` / `useRef` / `useEffect` / `useCallback` calls. Putting them above the hooks crashes the component on logout: while signed in, all hooks run; on logout, `user` becomes null and the early return runs zero hooks, triggering "Rendered fewer hooks than expected" → ErrorBoundary → "Something went wrong" page. The fix is structural — hoist all hooks above any conditional return; if an effect should not run for unauthorized users, gate it inside the effect (`useEffect(() => { if (!authorized) return; load(); }, [authorized])`). This rule extends beyond auth to feature flags, loading states, and any conditional that can flip between renders of the same mounted component.

### EAS Update deployment

Mobile JS ships via Expo's EAS Update CDN. Native binary is Expo Go itself (no standalone build right now — see the eas.json `preview` and `production` channels for when that changes).

To publish a new bundle:
```
$env:EXPO_TOKEN = "<personal-access-token>"
cd mobile/sovern-ops-app
eas update --branch preview --platform ios --message "<short description>"
```

Published bundles appear instantly in Expo Go on the next open. To force-pull on a phone that has the app open: force-quit Expo Go (swipe up from app switcher) and reopen.

Note on TLS: Alex's machine has SSL inspection software that intercepts `api.expo.dev` (and any HTTPS endpoint), breaking Node's default cert chain validation. The fix on this machine is `NODE_EXTRA_CA_CERTS` pointing at a PEM dump of the Windows trust store (which includes the AV-injected MITM cert). The PEM lives at `C:\Users\Alex\.node_extra_ca_certs.pem` and the env var is set persistently in `HKEY_CURRENT_USER\Environment`, so any new PowerShell session picks it up automatically.

To regenerate the PEM (e.g. after AV updates the cert):
```powershell
$out = "$env:USERPROFILE\.node_extra_ca_certs.pem"
$certs = @()
$certs += Get-ChildItem -Path Cert:\CurrentUser\Root -ErrorAction SilentlyContinue
$certs += Get-ChildItem -Path Cert:\LocalMachine\Root -ErrorAction SilentlyContinue
$pem = foreach ($c in $certs) {
    "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($c.RawData, 'InsertLineBreaks') + "`n-----END CERTIFICATE-----`n"
}
$pem -join "" | Set-Content -Encoding ascii -Path $out
```

Do NOT use `NODE_TLS_REJECT_UNAUTHORIZED=0` — it disables cert validation across the whole Node process and exposes you to actual MITM attacks. The earlier rounds in this session used it as a temporary workaround; that's now retired.

The web platform fails to bundle because `react-dom` is not installed (we don't need web). Always pass `--platform ios` (or `ios,android`) explicitly to skip web.

---

# Multi-Brand Data Model (Phase 1)

The ERP runs more than one trading brand from a single deployment. Sovern House (SH) and FlorWay (FW) ship by default. Every transactional row is locked to one brand at creation. Adding a third brand is config-only: insert a Brand row, restart, done.

## Architecture decisions (D-1 to D-10)

- **D-1.** Brand identity = `brandCode STRING(8)` FK referencing `Brand.code` (`UNIQUE`). Grep-friendly, matches user mental model.
- **D-2.** Brand isolation is enforced server-side. `brandScope` middleware filters every list query; the frontend hiding the All-Brands tab is necessary but not sufficient.
- **D-3.** All-Brands view (super_admin + `?viewMode=cross-brand`) is read-only at the backend. Mutation routes refuse it with 403 even if the frontend tries.
- **D-4.** `User.accessibleBrands` (JSON array) gates what the user can see. `User.defaultBrand` pre-fills the BrandPicker on new-entity forms.
- **D-5.** Brand is locked at creation. The standard update path silently strips `brandCode` from payloads. Changes flow only through `PATCH /api/admin/brand-override` (super_admin, requires written reason, audited).
- **D-6.** `Customer.brandRelationships` is a JSON array of brand codes. Adding is automatic; removal is super_admin with audit log.
- **D-7.** AuditLog is the system of record for cross-brand reads + brand overrides + relationship removals. Phase 4 dashboard reads the same table.
- **D-8.** Brand-aware theming reads colors from the Brand row. `BrandsContext` (desktop) and `useBrands()` (mobile) cache the brand list at boot. Whitelabel-ready.
- **D-9.** Migration strategy: nullable column added by `autoMigrateSchema`, backfilled to `'SH'` at boot, application-level `allowNull: false` enforced on new inserts.
- **D-10.** Egypt BCC rule (`mohanadfanzey@gmail.com`) is gated to `brand === 'SH'`. FW Egypt leads do not BCC Fanzey, ever.

## Files of interest

| File | Purpose |
|---|---|
| `backend/models/Brand.js` | Brand configuration table. Color hex validation, sender email validation, accepted-category JSON whitelist. |
| `backend/services/seedBrands.js` | Idempotent boot-time seed for SH + FW rows. Edit color/footer/etc. here to retheme a brand. |
| `backend/services/migrateBrands.js` | Boot-time backfill of `brandCode` on every transactional table + super-admin promotion. Warn-and-continue on residual NULLs. |
| `backend/middleware/brandScope.js` | Attaches `req.brandScope` after `requireAuth`. Exports `assertSingleBrandMode` + `assertBrandWritable` helpers. |
| `backend/routes/brandRoutes.js` | `GET /api/brands`, `GET /api/brands/me`, `PATCH /api/admin/brand-override`. |
| `frontend/admin-portal/src/contexts/BrandsContext.jsx` | App-wide brand cache. Provides `useBrands()` hook. |
| `frontend/admin-portal/src/components/BrandBadge.jsx` | Colored pill component. Reads colors from BrandsContext. |
| `frontend/admin-portal/src/components/BrandPicker.jsx` | Dropdown for new-entity forms. Auto-pre-fills `defaultBrand`. |
| `mobile/sovern-ops-app/src/hooks/useBrands.ts` | Mobile equivalent of BrandsContext. Same shape. |
| `mobile/sovern-ops-app/src/components/BrandBadge.tsx` | RN-native badge + group. |

## The brandScope middleware contract

After `requireAuth` runs, mount `brandScope` on every brand-tagged route. It attaches:

```js
req.brandScope = {
  accessibleBrands: ['SH', 'FW'],   // string[] — user's permitted brands
  defaultBrand:     'SH',           // string — pre-fill for new entities
  viewMode:         'single' | 'cross-brand',
  isCrossBrand:     boolean,        // only true when super_admin + ?viewMode=cross-brand
  where:            { brandCode: { [Op.in]: [...] } } | {},
}
```

Controllers consume `req.brandScope.where`:

```js
const where = { ...(req.brandScope?.where || {}), /* other filters */ };
const rows = await db.Lead.findAll({ where, ... });
```

For mutations:

```js
if (!assertSingleBrandMode(req, res)) return; // 403 in cross-brand mode
const brandCode = req.body.brandCode || req.brandScope?.defaultBrand || 'SH';
if (!assertBrandWritable(req, res, brandCode)) return; // 403 if brand not in accessibleBrands
```

For `Customer` (whose `brandRelationships` is a JSON array, not a single FK), the SQLite-portable approach is to fetch + filter at the application layer. See `customerController.getAll` for the canonical pattern.

## Adding a new brand

1. Edit `backend/services/seedBrands.js` and add a row to the `SEEDS` array.
2. Restart the backend. The idempotent seed inserts the new row at boot. Existing rows are preserved unchanged.
3. Grant access to the relevant users (set `User.accessibleBrands`).
4. The frontend picks up the new row on next page load via `BrandsContext` / `useBrands()`. BrandBadge auto-uses the new colors.

No code changes are needed in transactional models, controllers, or UI. That is the whole point of the abstraction.

## Brand override workflow

```http
PATCH /api/admin/brand-override
{
  "entityType":   "Lead",
  "entityId":     "<uuid>",
  "newBrandCode": "FW",
  "reason":       "Migrated to FW after factory relationship change"
}
```

Rules:
- Super_admin only. `requireRole('super_admin')` bare-string per L-031.
- `reason` is required, minimum 3 characters.
- Target brand must exist and be active.
- Writes an `AuditLog` row with `{ action: 'brand_override', entity, entityId, changes: { field: 'brandCode', oldValue, newValue, reason } }`.
- Returns the `auditLogId` so the caller can link back to the audit entry in dashboards.

## Gotchas

- **L-043** — `belongsTo(Brand)` associations pass `constraints: false` to avoid SQLite FK constraint failures in test setups where `sync({ force: true })` runs before Brand is seeded. Validation happens at the application layer via `brandScope`.
- **JSON array filtering on SQLite** — `Customer.brandRelationships` and `User.accessibleBrands` are JSON arrays. SQLite has no rich `Op.contains`; we filter at the application layer. Fine for the current data volumes; revisit if performance bites.
- **Test setup doesn't run boot backfill** — `__tests__/setup.js` calls `sequelize.sync({ force: true })` directly, bypassing the `server.js` boot chain. brandScope falls back to `['SH']` defaults so existing tests continue to pass without per-test brand seeding.
- **Egypt BCC** — the Mohannad Fanzey BCC rule in `outreachController.js` is now gated on `lead.brandCode === 'SH'`. The FW outbound composer (Phase 2) must not inadvertently re-introduce a blanket country check.

---

# Brand-Aware Quotation Documents (Phase 3, C9 / C10)

The buyer-facing quotation PDF is brand-aware. Brand and (for FlorWay) the customer's `productBrandingMode` together pick the variant. SH renders with a brand-styled SH layout (forest/cream/ink palette, NRIEC Taiwan footer) as of C10. FW has three variants (IronLite, Generic, Private Label placeholder) as of C9.

## Pipeline

```
quotationController.send / generatePDF
  ↓ fetches Brand by quotation.brandCode
  ↓ passes (quotation, items, customer, salesPerson, brand)
documentGenerator.generateQuotationPDF   ← barrel override
  ↓ dispatch() in brandedQuotationRenderer.js
  ↓ switches on brand.code, then customer.productBrandingMode
  ├─ FW + ironlite      → renderFlorWayIronLite
  ├─ FW + private_label → renderFlorWayPrivateLabel  (placeholder)
  ├─ FW + generic/null  → renderFlorWayGeneric       (default for FW)
  └─ SH or unknown      → renderSovernHouseClassic
returns { filename, filepath }
  ↓
generatePDF streams binary as Content-Type: application/pdf
send embeds the filename in the JSON response (legacy shape preserved)
```

Files of interest:

| File | Role |
|---|---|
| `backend/services/pdf/brandedQuotationRenderer.js` | Single dispatch point, SH renderer + FW variants |
| `backend/services/pdf/brandStyleTokens.js` | Per-brand colors, footer legal, sender block, asset paths, font registration |
| `backend/services/pdf/salesDocumentsPDF.js` | Legacy pdfkit-classic — no longer used for quotations as of C10; still used by Proforma Invoice + Sales Note |
| `backend/services/documentGenerator.js` | Barrel that overrides `generateQuotationPDF` with the new dispatch |
| `backend/controllers/quotationController.js` | `send` + `generatePDF` pass brand through; `generatePDF` now streams binary |
| `frontend/admin-portal/public/brand-assets/florway/` | I-Beam wordmark, OEM badge, construction diagram (committed) |
| `backend/assets/fonts/` | Anton + Inter TTFs (conditional registration — fonts fall back to Helvetica if missing) |

## Variant selector

```js
// in brandedQuotationRenderer.dispatch
if (brand.code === 'FW') {
  switch (customer.productBrandingMode) {
    case 'ironlite':      return renderFlorWayIronLite(...)
    case 'private_label': return renderFlorWayPrivateLabel(...)
    default:              return renderFlorWayGeneric(...)
  }
}
return renderSovernHouseClassic(...)
```

`customer.productBrandingMode === null` and unknown values default to `generic`. The variant is shown in the admin portal and mobile app via a banner above the line items so the user knows which document the buyer will receive.

## Output paths

```
uploads/quotations/{brandCode}/{variant}/quotation-{number}-{timestamp}.pdf
```

SH writes to `uploads/quotations/SH/classic/` (as of C10). FW writes to `uploads/quotations/FW/{ironlite|generic|private_label}/`. The brand+variant sub-folder layout means a renderer regression doesn't clobber prior PDFs and we can diff between variants directly on the VM.

## Asset path resolution

The PDF renderer reads asset PNGs (IronLite wordmark, OEM badge, construction diagram) from the deployed frontend public folder via relative traversal:

```js
path.resolve(__dirname, '..', '..', '..',
  'frontend', 'admin-portal', 'public', 'brand-assets')
```

This works in dev and on the GCP VM because the deploy preserves repo structure. Assets are sourced from `IronLite Branding/` on Alex's Desktop, copied into the repo as part of the C9 commit.

## Fonts

`backend/services/pdf/brandStyleTokens.js → registerBrandFonts(doc)` conditionally registers Anton-Regular.ttf and Inter-{Regular,Bold}.ttf if they exist in `backend/assets/fonts/`. If absent, the renderer falls back to pdfkit's built-in Helvetica family. The TTFs are free Google Fonts (OFL) and safe to commit; they were not bundled in the C9 PR to keep the diff small. Drop them in to upgrade typography without code changes.

## No em dashes (L-015)

Footer line uses U+00B7 middot (·). All renderer copy and tooltips use periods, commas, parens, or middot. Audit any new render text before merging.

## Streaming the binary

`GET /api/quotations/:id/pdf` now responds with `Content-Type: application/pdf` and streams the file directly. `?inline=1` sets `Content-Disposition: inline` (preview); default is `attachment` (download). The legacy JSON-response shape was inconsistent with the frontend's `responseType: 'blob'` and produced corrupted downloads. Fixed in C9.

## Adding a new brand

1. Add a SEEDS entry in `backend/services/seedBrands.js`.
2. Add a token block in `backend/services/pdf/brandStyleTokens.js` (colors, footer text, sender block, asset paths).
3. Add a render function in `brandedQuotationRenderer.js` and wire it into `dispatch()`.
4. Drop assets into `frontend/admin-portal/public/brand-assets/<brand>/`.
5. Update `tooltipContent.js` `QUOTATION.documentPreview`, `helpContent.js` `/quotations` section, and this guide.

---

# Brand-Scoped Dashboards + FW Commission (Phase 3, C11)

Every dashboard / analytics / report endpoint is now brand-aware. Single-brand users are auto-scoped via `brandScope` middleware; multi-brand users can narrow via `?brandCode=` query string.

## Wiring pattern

Backend (any route that queries brand-tagged models):

```js
const { brandScope } = require('../middleware/brandScope')
const { brandWhere } = require('../utils/brandFilterUtils')

router.use(requireAuth, brandScope)

router.get('/my-report', async (req, res) => {
  const where = { ...brandWhere(req), status: 'paid' }  // merges scope + ?brandCode
  const rows = await db.Invoice.findAll({ where })
  res.json(rows)
})
```

For raw SQL:

```js
const { sql: bsql, replacements: brs } = brandWhereSql(req, 'so')
const query = `SELECT * FROM SalesOrder so WHERE created_at > ? ${bsql}`
db.sequelize.query(query, { replacements: [start, ...brs], type: 'SELECT' })
```

For `Customer` queries (JSON `brandRelationships` array — SQLite can't filter directly):

```js
let rows = await db.Customer.findAll(...)
rows = filterCustomersByBrand(rows, req)  // application-layer filter
```

Files of interest:

| File | Role |
|---|---|
| `backend/utils/brandFilterUtils.js` | `brandWhere`, `brandWhereSql`, `filterCustomersByBrand` |
| `backend/routes/dashboardRoutes.js` | `router.use(requireAuth, brandScope)`; admin/mobile summary brand-scoped |
| `backend/routes/analyticsRoutes.js` | revenue-trend uses `brandWhereSql` |
| `backend/routes/reportRoutes.js` | sales report uses `brandWhere` |
| `frontend/admin-portal/src/components/BrandFilterPicker.jsx` | Top-of-page filter; hidden for single-brand users; persists to localStorage |
| `frontend/admin-portal/src/components/DashboardWidgets/CommissionWidget.jsx` | FW MTD tiles + expandable per-order percentage edit |
| `frontend/admin-portal/src/components/DashboardWidgets/BrandRevenueComparison.jsx` | Super_admin cross-brand only; Recharts grouped bar |

## FW Sales Commission

- `backend/services/seedCommissionRules.js` seeds `FW Sales Commission` idempotently. Default 5%; override via `FW_COMMISSION_RATE` env var on the GCP VM if you need to flex without a code change.
- `backend/services/commissionAccrual.js` exports `accrueCommissionForOrder(db, so, userId)` — fire-and-forget called from `salesOrderRoutes.js` after both create paths. Looks up the rule by name `${brand.displayName} Sales Commission`; idempotent per `(userId, salesOrderId)`.
- Per-order rate is editable via `PATCH /api/personalization/commissions/:id` (super_admin any row; row owner only on pending). `commissionAccrual.updateCommissionPercentage()` recalculates `amount = orderAmount * percentage / 100`.
- Brand-tagging: `salesOrderRoutes.js` now propagates `brandCode` (body wins, else `req.brandScope.defaultBrand`, else `'SH'`). `create-from-quotation` inherits `quotation.brandCode`. Without this, SH-defaulted SOs would never accrue against FW.

## Endpoints added in C11

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/personalization/commissions/summary?brandCode=FW&period=mtd` | Accrued / paid / pending tiles + contributing rows |
| PATCH | `/api/personalization/commissions/:id` | Per-order percentage edit |
| GET  | `/api/personalization/commissions/brand-comparison` | Super_admin only; SH vs FW revenue + commission for MTD |

## L-042 formatters

`frontend/admin-portal/src/utils/formatters.js` exports `formatDateTaipei` and `formatDateTimeTaipei` (Asia/Taipei). Use these for any new user-facing timestamp from Phase 3 onward. The legacy `formatDate` / `formatDateTime` use browser-local time and are kept to avoid mid-phase regression; broader migration is a follow-up.

---

# Product catalog (Phase 4, C14)

Brand-aware product catalog driving the quotation line-item flow. baseFobPrice is the buyer-facing floor; the ERP NEVER adds a markup on top (the price the factory provides already includes Alex's commission, which is tracked separately in `CommissionTracking`).

## Schema delta — `backend/models/Product.js`

| Field | Type | Default | Notes |
|---|---|---|---|
| `brandCode` | STRING(8) | `'SH'` | FK Brand.code (constraints:false per L-043). Locked at creation. |
| `productType` | ENUM | null | lvt/spc/wpc/hardwood/laminate/tile/ceramic/other. Coexists with categoryId FK. |
| `baseFobPrice` | DECIMAL(12,2) | null | USD per unit. FLOOR. Buyer-facing. Includes commission. |
| `currency` | STRING(3) | `'USD'` | |
| `moqUnit` | ENUM | null | sqm/sqft/box/pallet/roll/piece/container. |
| `leadTimeDays` | INTEGER | null | |
| `certifications` | JSON | `[]` | Array of `{name, issuer, expiresAt}`. Raw per L-023. |
| `originCountry` | STRING(2) | null | ISO-2. |

`Product` is added to `BRAND_TX_MODELS` in `models/index.js` and to `TX_MODELS` in `migrateBrands.js` so existing rows backfill to `brandCode='SH'`.

**SKU uniqueness deviation from Phase 4 spec:** the existing column-level `UNIQUE` on `sku` cannot be ALTER'd off in SQLite without a full table rebuild (31 live rows + many FK relations). SKU stays GLOBALLY unique; seed data uses brand prefixes (FW-*/SH-*) to avoid collisions. Per-brand SKU uniqueness deferred to a Phase 5 table rebuild.

**Legacy `ProductPrice` table:** not used by the Phase 4 quotation flow. The `markup` column default (20%) in that table is unrelated and untouched. `Product.baseFobPrice` is the authoritative buyer price.

## Quotation flow integration

`backend/controllers/quotationController.js:36-54` (line-item loop) now enforces:

1. **Brand match.** `product.brandCode !== resolvedBrandCode` → `ValidationError`.
2. **Floor check.** `unitPrice < product.baseFobPrice` AND requester is NOT super-admin → reject. Super-admin must include `belowFloorReason` (≥ 5 chars) per item; written to AuditLog as `product_floor_override`.
3. **Default unitPrice** from `product.baseFobPrice` when missing.

NO-MARKUP INVARIANT comment block in the loop. Pattern: `total = quantity * unitPrice`. No multiplier branches anywhere.

## Frontend integration

- `frontend/admin-portal/src/pages/Settings/ProductCatalog.jsx` (new) — admin page at `/settings/products`. Brand filter, DataTable, create/edit modal with BrandPicker locked at creation, deactivate toggle.
- `frontend/admin-portal/src/pages/Quotations/QuotationForm.jsx` — line-item product dropdown reads `productsAPI.getAll({brandCode, status:'active'})`. On product select, autofills `unitPrice = baseFobPrice` and `unit = moqUnit || unit`. Below-floor reveals a reason input + amber warning.

## Mobile

- `mobile/sovern-ops-app/app/(tabs)/products.tsx` — brand filter at top (hidden for single-brand users), BrandBadge on each row, baseFobPrice prefers over legacy ProductPrice.sellingPrice.

## Seed

`backend/services/seedProducts.js` — idempotent on `(brandCode, sku)`. Inserts 3 FW placeholders (`FW-SPC-65`, `FW-SPC-85`, `FW-WPC-65`) and 2 SH placeholders (`SH-HW-14`, `SH-LAM-8`). PLACEHOLDER prices commented for replacement before live use.

## AuditLog actions added

- `product_floor_override` — entity Product, changes `{sku, floor, quotedPrice, reason}`. Recorded when a super-admin quotes below `baseFobPrice` on a line item.

## NO-MARKUP INVARIANT (anchor)

Defense in depth. `baseFobPrice` IS the buyer price. Never compute `display = baseFobPrice * (1 + commissionRate)` anywhere in line-item math, PDF rendering, email HTML, or buyer-facing UI. Commission is a separate `CommissionTracking` ledger row.

Grep blocklist (CI / QA gate):
```
- (?:price|fob|amount)\s*\*\s*\(?\s*1\s*\+\s*commission
- baseFobPrice\s*\*\s*(?:[0-9.]+|commissionRate|brand\.commissionRate)
- markup\s*=\s*commission
- displayPrice\s*=\s*.*(?:baseFobPrice|fobPrice)\s*\*
```

---

# FlorWay commission tracking (Phase 4, C15)

Extends the Phase 3 C11 CommissionTracking ledger to a full FW commission flow: brand-aware accrual, per-quotation rate override, status enum lifecycle, super-admin mark-paid + claw-back, and a dashboard with KPIs + pipeline forecast + outstanding tracker.

## Schema deltas

**`backend/models/CommissionTracking.js`**

| Field | Type | Default | Notes |
|---|---|---|---|
| `customerId` | UUID | null | FK Customer (constraints:false per L-043). |
| `brandCode` | STRING(8) | `'FW'` | FK Brand.code. Required NOT NULL. |
| `accrualDate` | DATE | null | Stamped when SO transitions to confirmed. |
| `registeredBuyerSince` | DATE | null | Snapshot of first confirmed SO date for this (customerId, brandCode). |
| `status` (widened) | ENUM | `'accrued'` | Adds `accrued`, `invoiced_to_factory`, `clawed_back`. Preserves `pending`, `paid`, `disputed`. |

**`backend/models/Brand.js`**

| Field | Type | Default | Notes |
|---|---|---|---|
| `commissionRate` | DECIMAL(5,4) | `0.0500` | Brand-level default rate as decimal. SH = 0.0000 in seed/backfill. FW = 0.0500. |

**`backend/models/Quotation.js`**

| Field | Type | Default | Notes |
|---|---|---|---|
| `commissionRateOverride` | DECIMAL(5,4) | null | Per-quote override. >= 0.05 enforced server-side. |

Plus a new index `(status, brand_code)` on Quotation for the pipeline forecast scan.

## Migration — `backend/services/migrateCommissionsC15.js`

Idempotent (AuditLog sentinel rows on each step). Three parts:

1. **Status enum remap.** SQL UPDATEs: `approved → accrued`, `cancelled → clawed_back`. Other values preserved. Sentinel: `phase4_commission_status_migrated`.
2. **Field backfill.** Rows missing `customerId` / `brandCode` / `accrualDate` get them from the joined SO. Orphan rows default brandCode to 'FW'. Sentinel: `phase4_commission_fields_backfilled`.
3. **Brand.commissionRate backfill.** SH → 0.0000, FW → 0.0500. Sentinel: `phase4_brand_commission_rate_backfilled`.

Runs in `server.js` boot after `seedProductsIfEmpty`. Wrapped in try/catch — never blocks boot.

## Rate resolution order — `commissionAccrual.resolveCommissionRateDecimal`

1. `quotation.commissionRateOverride` via the SO's quotation chain (proformaInvoiceId → ProformaInvoice.quotationId; or matching accepted quote).
2. `brand.commissionRate` (Phase 4 authoritative source).
3. Legacy `CommissionRule.baseValue / 100` (fallback). The C11 `FW Sales Commission` rule remains as the fallback safety net.

## Accrual trigger

`accrueIfConfirmed(db, so, userId, opts)` is the Phase 4 entry point. No-op unless `so.status === 'confirmed'`. Called from:

1. `POST /api/sales-orders` (SO born confirmed) — existing.
2. `POST /api/sales-orders/create-from-quotation` (SO from accepted quote) — existing.
3. **NEW** `PATCH /api/sales-orders/:id/status` when transitioning draft → confirmed.

Backwards-compat alias `accrueCommissionForOrder` still exists; route callers don't change.

Idempotency: existing `(userId, salesOrderId)` row → returned as-is, no double-accrual.

## Floor enforcement

5% (0.05 decimal, 5.0 percentage) cannot be overridden — unlike the product price floor.

Enforced at:

| Point | File | What it does |
|---|---|---|
| Quotation create | `quotationController.create` | Body `commissionRateOverride < 0.05` → 400. |
| Quotation update | `quotationController.update` | Same. Override change writes `commission_rate_override` AuditLog. |
| PATCH commission row | `commissionAccrual.updateCommissionPercentage` | `< 5.0%` throws. Existing endpoint. |
| Brand admin save | Future — `BrandAdmin.jsx` save handler | TODO in C15 follow-up if Alex edits Brand.commissionRate via admin UI. |

## API endpoints (new)

- `GET /api/personalization/commissions/dashboard?brand=FW` — full dashboard payload. Gate: super_admin OR `accessibleBrands.includes('FW')`.
- `POST /api/personalization/commissions/:id/mark-paid` — super_admin only. Sets `status='paid'`, `paidDate=now`. Audits `commission_paid`.
- `POST /api/personalization/commissions/:id/claw-back` — super_admin only. Body `{reason: string >= 5 chars}`. Sets `status='clawed_back'`. Audits `commission_clawed_back`.

`requireFwAccess` middleware lives inline in `commissionRoutes.js` — super_admin bypass + `brandScope.accessibleBrands.includes('FW')` check.

## Percentage vs decimal — important reading

The CommissionTracking `percentage` column is stored as PERCENTAGE (5.0, not 0.05) for backward-compatibility with the C11 dashboard math. New code converts decimal rate → percentage at write time.

Brand.commissionRate is DECIMAL (0.0500 = 5%). Quotation.commissionRateOverride is also DECIMAL. Convert at the accrual boundary.

A grep for `* 100` and `/ 100` in `commissionAccrual.js` shows the conversion points; don't add more.

## UI

- Desktop: `frontend/admin-portal/src/pages/Analytics/CommissionDashboard.jsx`. Route at `/commissions`. Sidebar entry visible only for super_admin or `accessibleBrands.includes('FW')`.
- Mobile: existing `CommissionWidget.tsx` rewired to call `/dashboard` (instead of legacy `/summary`). Tapping the widget navigates to `mobile/sovern-ops-app/app/commission.tsx` (read-only deals list + outstanding section).

Mobile parity intentionally omits rate edits and mark-paid actions — the table-with-inputs UX is desktop-only.

## AuditLog actions added

- `commission_rate_override` — Quotation, when override field changes.
- `commission_paid` — CommissionTracking, super-admin mark-paid.
- `commission_clawed_back` — CommissionTracking, super-admin claw-back + reason.
- `phase4_commission_status_migrated` — System, one-time sentinel.
- `phase4_commission_fields_backfilled` — System, one-time sentinel.
- `phase4_brand_commission_rate_backfilled` — System, one-time sentinel.

## Pipeline forecast

`GET /commissions/dashboard` sums open quotations under the brand × rate (override if set, else brand default). Status filter: `['draft', 'sent', 'revised']`. Upper-bound estimate; probability-by-stage weighting is future work. Performance is fine at current row counts; revisit if open-quote volume grows past low thousands.

---

# Customer.productBrandingMode lock semantics (Phase 3, C12)

`Customer.productBrandingMode` is FW-specific and picks which quotation variant is rendered (`ironlite` / `generic` / `private_label`). To prevent inconsistency between a sent quotation and a later edit of the mode, the field locks the first time an FW quotation tied to that customer transitions to `status='sent'`.

## Schema

`backend/models/Customer.js` adds `productBrandingModeLockedAt` (`DataTypes.DATE`, nullable, default null). Auto-migrates on boot via the existing alter-sync pattern.

## Lock trigger

`backend/controllers/quotationController.js:send()` checks after the `quotation.update({status:'sent'})` write:

```js
if (
  quotation.brandCode === 'FW' &&
  quotation.customer.productBrandingMode &&
  !quotation.customer.productBrandingModeLockedAt
) {
  await quotation.customer.update({ productBrandingModeLockedAt: new Date() });
  auditService.logAction(req.user.id, 'product_branding_mode_locked', 'Customer', ...);
}
```

Idempotent: a second send to the same customer is a no-op. Only locks when the customer actually has a mode set; if the mode is `null` (FW falls through to 'generic' by default) there's nothing meaningful to freeze.

## Update enforcement

`customerController.update`:
- Accepts `productBrandingMode` + `privateLabelProductName` in the body.
- If `productBrandingModeLockedAt` is non-null AND the requester is NOT super_admin, returns a `ValidationError` (HTTP 400) advising to use the override flow.
- If `productBrandingMode === 'private_label'`, requires non-empty `privateLabelProductName`.

## Super_admin override

`POST /api/customers/:id/override-branding-mode-lock` (super_admin only via bare-string `requireRole('super_admin')` per L-031).

Body: `{ newMode, newPrivateLabelProductName?, reason }`. `reason` is required and must be at least 3 characters (same convention as the brand-override endpoint in `brandRoutes.js`).

Effect: clears `productBrandingModeLockedAt`, sets the new mode + private label name, writes a `product_branding_mode_override` audit row with `{ oldMode, newMode, oldLockedAt, newLockedAt: null, reason }`.

## Audit log actions added in C12

- `product_branding_mode_locked` — entity=Customer, changes={mode, lockedAt, triggeredBy:{entity:'Quotation', id, quotationNumber}}.
- `product_branding_mode_override` — entity=Customer, changes={oldMode, newMode, oldPrivateLabelProductName, newPrivateLabelProductName, oldLockedAt, newLockedAt:null, reason}.

## UI surfaces

- Desktop: `frontend/admin-portal/src/components/ProductBrandingModePicker.jsx` — three radio cards + private-label input + lock badge + super-admin "Override lock" dialog. Rendered on `CustomerDetail.jsx` only when `customer.brandRelationships.includes('FW')`.
- Mobile: `mobile/sovern-ops-app/src/components/ProductBrandingModePicker.tsx` — pill toggle + private-label input. Rendered inside the customers tab modal. Override stays desktop-only (the reason-bound dialog reads better on a larger screen).

---

# Sanctions screening (Phase 4, C18)

Adds the operational compliance backbone: every Customer and Lead is screened against four public sanctions lists, and four hard-block entry points refuse to onboard or transact with a flagged entity. Super-admin can attest-override with a written reason that becomes the auditable justification.

## Schema delta

**`backend/models/Customer.js`** — adds:

| Field | Type | Default | Notes |
|---|---|---|---|
| `screeningStatus` | ENUM | `'pending'` | pending / cleared / flagged / requires_review / override. |
| `lastScreenedAt` | DATE | null | Set by createCustomer, /screen/:id, and the 90d cron. |
| `sanctionsScreenDetails` | JSON | null | `[{list, matchedName, country, score, countryOverlap}]` per L-023. |
| `sanctionBlockReason` | TEXT | null | Filled when flagged; surfaced on the badge tooltip. |
| `sanctionOverrideReason` | TEXT | null | Super-admin attestation text (>= 10 chars). |
| `sanctionOverrideAt` | DATE | null | When override applied. |
| `sanctionOverrideBy` | UUID | null | FK User who applied the override. |
| `registeredBuyerSince` | DATE | null | First-confirmed-SO snapshot (consumed by commission accrual). |
| `registeredBuyer` | BOOLEAN | false | Flag for "has at least one confirmed SO". |

**`backend/models/Lead.js`** — adds `screeningStatus`, `sanctionsScreenDetails`, `lastScreenedAt`. Legacy `Lead.sanctionsScreened` (boolean) kept for read compatibility; new code reads the enum.

Indexes: `(screening_status)` and `(last_screened_at)` for the 90d rescreen cron + block scans.

## Migration — `backend/services/migrateSanctionsC18.js`

`autoMigrateSchema` adds the columns at boot as nullable. The migration UPDATE-sets `screening_status = 'pending'` on every NULL row in `Customers` and `Leads` so the enum has a coherent value across the codebase. Idempotent via AuditLog sentinel `phase4_sanctions_backfilled`.

## `backend/services/sanctionsService.js`

Two public functions:

- `refreshSanctionsData()` — downloads all four sources to `backend/data/sanctions/`. Atomic write via `.tmp` + rename so a half-fetch never replaces a good cache. Writes `last_refresh.json` manifest. Returns `[{key, ok, bytes, mtime}]` per source.
- `screenName(name, country)` — loads parsed files (mtime-cached in memory; re-parses only when a list file's mtime changes), then:
  - **Exact normalized name match** with country overlap (or no country specified) → `flagged`.
  - **Exact normalized name match** with country mismatch → demoted to `requires_review`.
  - **Fuzzy match** (Levenshtein ratio >= 0.85, length within 4 chars) with country overlap → `requires_review`.
  - **Fuzzy match** with country mismatch → `cleared` (too noisy otherwise).
  - **No data loaded** → `pending` (never silently waves traffic through on a cold cache).

Name normalization strips common suffixes (Ltd, LLC, Inc, GmbH, SA, Sdn, Bhd, etc.) and punctuation before comparing.

The Levenshtein implementation is inline (~30 lines) — no new package dependency. Hard list sizes (~20K rows combined) keep the in-memory cache well under 50MB.

Sources:

| List | URL | Format | Parser |
|---|---|---|---|
| OFAC SDN | treasury.gov/ofac/downloads/sdn.csv | CSV (no header) | column 1 = name, column 11 = remarks (country extracted) |
| OFAC Consolidated | treasury.gov/ofac/downloads/consolidated/cons_prim.csv | CSV (no header) | same |
| EU Consolidated | webgate.ec.europa.eu/.../csvFullSanctionsList | CSV (with header) | finds name + country columns by header lookup |
| UN SC | scsanctions.un.org/.../consolidated.xml | XML | regex over `<INDIVIDUAL>` and `<ENTITY>` blocks |

## Cron jobs — `backend/services/schedulerService.js`

| Cron | Job | Env toggle |
|---|---|---|
| `30 3 * * *` | `refreshSanctionsLists` (downloads + audits) | `SCHEDULER_SANCTIONS_REFRESH=false` to disable |
| `0 4 * * *` | `rescreenCustomers90d` (active customers with NULL or >90d lastScreenedAt) | `SCHEDULER_SANCTIONS_RESCREEN=false` to disable |

Both audit (`sanctions_refresh`, `sanctions_rescreen_batch`). Failures are logged but never crash the scheduler.

## Compliance API — `backend/modules/compliance/complianceRoutes.js`

Extends the existing compliance router with:

| Endpoint | Auth | Description |
|---|---|---|
| `POST /api/compliance/screen` | any auth | Stateless screen of `{name, country}`. No persistence. |
| `POST /api/compliance/screen/:customerId` | any auth | Re-screens a customer, persists, audits as `sanctions_screen`. |
| `POST /api/compliance/customers/:id/override` | super-admin | Body `{reason}` (>= 10 chars). Sets `screeningStatus='override'` + override metadata. Audits as `sanctions_override`. Re-activates the customer (isActive=true). |
| `GET /api/compliance/sanctions/status` | any auth | Last refresh manifest + per-source file sizes + cron-enabled flags. |
| `POST /api/compliance/sanctions/refresh` | super-admin | Manual refresh trigger. |

## Four hard-block entry points

| Entry point | File | Behavior |
|---|---|---|
| Lead create | `backend/controllers/leadController.js:createLead` | Synchronous screen at create. flagged → 403, lead NOT created, sanctions_block audited. requires_review / cleared persist with the status set so the UI can warn. |
| Customer create | `backend/controllers/customerController.js:create` | Synchronous screen at create. flagged → row created with `isActive=false`, sanctionBlockReason set, 403 returned with the customerId so super-admin can override. |
| Quotation create | `backend/controllers/quotationController.js:create` | Loads customer; rejects if `screeningStatus === 'flagged'` (override bypasses). 403 with sanctionsBlock detail. |
| Outreach send | `backend/controllers/outreachController.js` (per-lead + campaign) | Stale check (>7d since last screen) triggers a re-screen on the fly. flagged → 403 (per-lead) or skipped + OutreachEmail row with `status='failed'` + reason (campaign loop). |

In all cases the response includes `sanctionsBlock: { status, hits }` so the frontend can render a structured banner with the "Request override" affordance.

## Override flow

- Backend rejects reasons shorter than 10 characters.
- On success: `screeningStatus = 'override'`, `sanctionOverrideReason / At / By` populated, `isActive = true`. The flag details remain on the record (override is attestation, not clearance).
- AuditLog `sanctions_override` captures the prior status, prior hits, reason, and user.
- The Customer detail page shows the orange "Override on file" badge and a truncated preview of the reason.

## Frontend

`frontend/admin-portal/src/components/SanctionsBadge.jsx` — five-variant pill (cleared / pending / requires_review / flagged / override). Used on customer detail headers and reused in lists.

`frontend/admin-portal/src/pages/Customers/CustomerDetail.jsx`:
- Renders the badge next to BrandBadgeGroup.
- Surfaces `sanctionBlockReason` (flagged) or truncated `sanctionOverrideReason` (override) under the title.
- Super-admin sees a red Override button that opens a modal: 10+ char reason required, posts to `/api/compliance/customers/:id/override`, refetches the customer on success.

## Mobile parity

`mobile/sovern-ops-app/app/(tabs)/customers.tsx` — customer row gains a SANCTIONS / OVERRIDE / REVIEW chip next to the company name when the status warrants it (cleared/pending render nothing to keep the directory clean).

`mobile/sovern-ops-app/src/services/api.ts` — Customer interface extended with the new sanctions fields so callers can drive UI off them without a second fetch.

## AuditLog actions added

- `sanctions_screen` — manual or scheduled re-screen of a customer.
- `sanctions_block` — every blocked operation at the 4 entry points. `context` field disambiguates lead_create / customer_create / quotation_create / outreach_send / campaign_send.
- `sanctions_override` — super-admin attestation.
- `sanctions_refresh` — daily cron + manual triggers.
- `sanctions_rescreen_batch` — daily cron summary.
- `phase4_sanctions_backfilled` — one-time migration sentinel.

## Risks + open questions

- False positives on common names are the primary risk. Mitigation: country gating, length-prefilter, fuzzy gets `requires_review` not `flagged`, and human-review override path.
- CSV format changes upstream — parsers are defensive (header lookup + remarks regex) but log warnings if a source drops to a fraction of its prior size; the last-known-good file remains in place.
- Override expiry: today an override sticks indefinitely. The 90d rescreen preserves it (the cron explicitly checks `cust.screeningStatus === 'override'` and leaves it alone). Future work could auto-revert after a window.
- ProductPrice / Lead legacy `sanctionsScreened` BOOLEAN remains for read compatibility; new code reads `screeningStatus`.

---

# Inbox / email UX brand awareness (Phase 4, C17)

Pulls the brand-aware multi-brand model all the way through the inbox: every Gmail polling account is tagged with a brand, every TriageItem inherits the polling account's brand, the reply composer enforces sender-account = thread brand, and the Egypt-Fanzey BCC rule lives in one helper shared by all three send paths.

## Schema delta

**`backend/models/ConnectedGoogleAccount.js`** — adds:

| Field | Type | Default | Notes |
|---|---|---|---|
| `brandCode` | STRING(8) | `null` | FK Brand.code (constraints:false, L-043). Populated by migration; required for new OAuth connects. |

The column itself is added at boot by `autoMigrateSchema()`; no manual ALTER TABLE.

## Migration — `backend/services/migrateConnectedAccounts.js` (new)

Idempotent backfill matching `account.email` to `Brand.senderEmail` (case-insensitive). For each existing `ConnectedGoogleAccount` where `brandCode IS NULL`, set `brandCode` to the matching `Brand.code`. Orphans (no matching brand) are left NULL and logged as warnings.

Sentinel-guarded via `AuditLog` action `phase4_connected_accounts_brand_backfilled`. Re-runs are no-ops.

Wired into `server.js` boot after `backfillBrandsIfNeeded`.

## OAuth connect enforcement

`backend/controllers/googleAccountController.js` — the OAuth callback now:

1. Looks up a `Brand` whose `senderEmail` matches the Google profile email (LOWER() comparison).
2. For new connects: rejects with `?google=no_brand_match` redirect if no matching brand exists. We can't route polling output to a brand we don't have a row for.
3. Sets `brandCode` on the `ConnectedGoogleAccount` record from the matched brand.

`listAccounts` + `listAvailableAccounts` now include `brandCode` in the returned attributes so the brand-aware reply picker can filter without a second query.

## Gmail sync brand propagation

`backend/services/gmailSyncService.js` — `processMessage` now accepts `accountBrandCode` and stamps every new `TriageItem` with `brandCode = accountBrandCode || 'SH'`. The 'SH' fallback covers orphan accounts that predate the C17 backfill; in steady state every account is brand-tagged.

`rawEmailData.fromAccount` also stores `accountEmail` for forensic traceability.

## Reply composer brand enforcement

`backend/controllers/triageController.js` `sendEmail` handler rewrites:

```
resolvedBrandCode = triageItem?.brandCode || req.brandScope?.defaultBrand || 'SH'

if fromAccountId:
  if account.brandCode !== resolvedBrandCode:
    audit brand_account_mismatch_block
    throw 400 "Cannot send: thread is X, selected account is Y"

fromAddress = fromAccount.email
              || Brand.findOne({code: resolvedBrandCode}).senderEmail
              || env.SMTP_FROM
```

After send, writes a `reply_sent` audit row with `brandCode`, `fromAddress`, `toAddress`, `subject`, `bccCount`, `country`, `sentAt`.

## Egypt BCC — single source of truth

`backend/services/emailService.js` exports `applyEgyptBccIfNeeded(brandCode, country, bccList)`:

- SH + `country === 'egypt'` + Fanzey not already in list → appends `mohanadfanzey@gmail.com`.
- FW (or any other brand) → returns the list unchanged.
- Always returns a new array; never mutates the input.

Three send paths now call this helper instead of inline checks:

1. `outreachController.js` outreach send (per-lead).
2. `outreachController.js` campaign send.
3. `triageController.js` reply send (new in C17).

This collapses three near-duplicates into one helper. Adding a future brand or country rule is a one-line edit.

## Frontend

`frontend/admin-portal/src/pages/CRM/TriageInbox.jsx`:

- `BrandBadge` on every triage card next to the sender + intent badges.
- ComposeModal: header brand chip; new sender-account picker (`/api/google/accounts`) filtered to active accounts; mismatched accounts visible but disabled.
- Cross-brand banner shown to super-admin users with `brandScope.isCrossBrand && accessibleBrands.length > 1`; list endpoint already merges via `req.brandScope.where = {}` for cross-brand.
- Reply state now includes `triageItemId` + `threadBrandCode`; both flow through to `POST /api/triage/send-email`.

## Mobile parity (`mobile/sovern-ops-app/app/(tabs)/triage.tsx`)

- `BrandBadge` on every triage card (`src/components/BrandBadge.tsx` with `size="sm" showLabel={false}`).
- New Reply button next to Spam/Dismiss/Archive opens a modal with brand-locked sender picker (touchable list — selected = brand match; disabled = brand mismatch, dimmed).
- `listConnectedGoogleAccounts` + `sendTriageReply` added to `src/services/api.ts`.
- Server mismatch errors surface in a native Alert.

## AuditLog actions added

- `reply_sent` — every successful triage reply.
- `brand_account_mismatch_block` — every blocked cross-brand send attempt.
- `phase4_connected_accounts_brand_backfilled` — migration sentinel (one-time).

## Risks + open questions

- Existing TriageItems created before C17 default to `brandCode='SH'`. Re-tagging would require joining on `rawEmailData.fromAccount` and remains a future cleanup; cross-brand triage filtering today treats them as SH which is correct for the existing single-account install.
- Cross-brand list pagination: defaults to LIMIT 100 via the list endpoint; perf is fine at current volume but watch the index `(brand_code, status, autoArchiveAt)` if scale changes.
- Future: triage decisions (markSpam/dismiss/archive) inherit brand from the item, but the controller does not yet re-assert `assertSingleBrandMode` for super-admin in cross-brand mode. Leaving the item brand intact is the right default; flagging here so a follow-up can revisit if Alex wants stricter behavior.

---

# Quote-to-SalesOrder + brand-aware SO/PI/Invoice (Phase 4, C16)

Builds the Sovern→FlorWay commercial workflow on top of the C15 commission ledger. Quotations convert to confirmed Sales Orders; the SO status machine drives FW commission accrual; SO / PI / Invoice PDFs and detail pages reflect FW's "factory sends to buyer" model.

## Status machine reconciliation

Before C16, `backend/models/SalesOrder.js` had a status enum that included `in_transit` while `backend/utils/statusMachine.js` referenced `processing`. The two were never aligned, which would silently 400 any transition involving `in_transit`.

`statusMachine.js` is now the single source of truth:

```
draft        → confirmed | cancelled
confirmed    → in_production | cancelled
in_production → ready | shipped | cancelled
ready        → shipped | cancelled
shipped      → in_transit | delivered | cancelled
in_transit   → delivered | cancelled
delivered    → completed | cancelled
completed    → []
cancelled    → []
```

Pre-flight on the live DB confirmed zero rows in `processing` before the rename — safe to remove.

## Convert to Sales Order

`POST /api/sales-orders/create-from-quotation` (`backend/routes/salesOrderRoutes.js:372`) — accepts `{ quotationId, factoryId, estimatedDelivery?, shippingMethod?, notes? }`.

C16 additions:

1. **Brand-access gate** — after loading the quotation, check `req.brandScope.accessibleBrands.includes(quotation.brandCode)`; reject with 403 if mismatch and the user is not in cross-brand mode.
2. The new SO is created with status `confirmed`, which triggers `accrueCommissionForOrder(db, so, userId)` (C15) inline at create time.
3. Audit action remains `sales_order_create_from_quotation`; the dedicated status-change audit `sales_order_status_change` is logged only by the manual PATCH-status path.

The quotation status is **not** auto-flipped after conversion — a quote remains `accepted` and can spawn additional SOs against the same accepted terms if needed. The SO's `quotationId` FK preserves traceability.

## FW send-block (defense in depth)

For `brandCode === 'FW'`, three send routes hard-block with 400 and audit `fw_send_blocked`:

| Route | File | Block |
|---|---|---|
| `POST /api/proforma-invoices/:id/send` | `proformaInvoiceRoutes.js:171` | Returns 400 with message "FlorWay proforma invoices are internal records; the factory sends the document to the buyer." |
| `PATCH /api/invoices/:id/send` | `invoiceRoutes.js` (analogous) | Same pattern. |
| (Sales Orders have no public Send endpoint.) | — | Inherited from PI/Invoice. |

UI mirrors the server in two ways:

1. **ProformaDetail.jsx** — `isFwInternalRecord = pi.brandCode === 'FW'` disables the Send button with a tooltip; below the header the page renders an iron-deep banner repeating the explanation.
2. **OrderDetail.jsx + InvoiceDetail.jsx** — render the same iron-deep banner immediately below the workflow status bar when `brandCode === 'FW'`. No Send button exists on these screens; the banner is purely informational.

## FW PDF banner

`backend/services/pdf/pdfHelpers.js` adds `addFwInternalRecordBanner(doc, entity)`. No-op for non-FW. For FW it draws a 28px iron-deep (`#1F2933`) bar across the full page width with cream-text label "FACTORY WILL SEND TO BUYER  -  INTERNAL RECORD".

Wired into:

- `salesDocumentsPDF.js` → `generateProformaInvoicePDF`
- `orderDocumentsPDF.js` → `generateSalesOrderPDF`
- `financeDocumentsPDF.js` → `generateInvoicePDF`

In each case the call is placed after `doc.pipe(stream)` and before `getCompanyHeader(doc)` so the banner sits at y=0..28 and the rest of the document offsets naturally.

The Phase 3 brand-aware quotation renderer is the architectural template; C16 inverts the relationship — instead of branching renderers, one helper short-circuits on `entity.brandCode !== 'FW'`. This stays maintainable because the banner is identical across the three document types.

## Mobile parity (`mobile/sovern-ops-app/app/quotation/[id].tsx`)

- New `createSalesOrderFromQuotation` exported from `src/services/api.ts`.
- New Convert-to-Sales-Order button visible when `status === 'accepted'` and the quotation's brand is in `accessibleBrands` (or there are no scopes, i.e. super-admin cross-brand mode).
- Confirm-then-post flow via `Alert.alert` — uses the quotation's factory; surfaces an explicit error if `factoryId` is missing so the user knows to set it in the desktop ERP first.
- FW internal-record banner renders above the PDF buttons (iron-deep `#1F2933` background, cream text), mirroring the desktop ProformaDetail / OrderDetail / InvoiceDetail banners.
- For FW conversions the confirm alert appends the internal-record note so the user can't miss the framing.

## Pre-existing bugs fixed in C16

- `QuotationDetail.jsx:184` — `canSend` referenced `'approved'` which never existed on the Quotation status enum (the enum is `draft|sent|revised|accepted|rejected|expired`). Replaced with the documented set.

## Audit actions added

- `sales_order_status_change` — specialized name for SO status transitions (previously rolled into generic `sales_order_update`). Logged from `PATCH /api/sales-orders/:id/status`.
- `fw_send_blocked` — logged whenever a FW SO/PI/Invoice Send endpoint is hit. Includes `attemptedBy` and the entity number for forensics.

---

# Cross-brand auto-add + 404-on-wrong-brand (Phase 3, C13)

## Cross-brand auto-add

When a new Lead / Quotation / Deal is created against an existing customer under a brand they didn't yet have, `customer.brandRelationships` is automatically extended. The change is audited and the create response includes `autoAddedBrand` so the frontend can toast.

`backend/services/crossBrandAutoAdd.js` exports `addBrandIfMissing(db, customerId, brandCode, triggeredBy)`. It's dedup-safe (`Array.from(new Set([...existing, brandCode]))`) and fire-and-forget at the call site (wrapped in try/catch — never blocks the create).

Wired into:
- `leadController.createLead` → `addBrandIfMissing(db, lead.customerId, lead.brandCode, {entity:'Lead', entityId:lead.id})`
- `quotationController.create` → same, entity='Quotation'
- `dealController.createDeal` → same, entity='Deal'

Audit entry: action=`cross_brand_relationship_added`, entity='Customer', changes={oldBrands, newBrands, addedBrand, triggeredByEntity, triggeredByEntityId}.

Frontend toast surfaces are in `LeadForm.jsx`, `QuotationForm.jsx`, `DealForm.jsx`.

## 404-on-wrong-brand

`backend/utils/notFoundOnWrongBrand.js` exports two helpers:

- `isAccessibleByBrandCode(req, brandCode)` — for models with a single `brandCode` field.
- `isAccessibleByBrandRelationships(req, brandRelationships)` — for Customer's JSON array.

Both return true for super_admin in cross-brand mode. Routes that have applied the helper in C13:

| Endpoint | Helper |
|---|---|
| `GET /api/quotations/:id` | byBrandCode |
| `GET /api/customers/:id` | byBrandRelationships |
| `GET /api/crm/deals/:id` | byBrandCode |
| `GET /api/sales-orders/:id` | byBrandCode |
| `GET /api/invoices/:id` | byBrandCode |
| `GET /api/proforma-invoices/:id` | byBrandCode |
| `GET /api/leads/:id` | (pre-C13, original D-3 pattern in leadController) |

Remaining endpoints (Activity, OutreachEmail, TriageItem, Document, Inquiry) follow the same pattern; mechanical follow-up.

Writes stay 403 via the existing `assertBrandWritable` in `brandScope.js` — once the user has seen the entity in a list response, there's no information to hide on a write boundary.

## BrandPicker on create forms

`frontend/admin-portal/src/components/BrandPicker.jsx` (from Phase 1) is now wired to:

- `LeadForm.jsx`
- `QuotationForm.jsx`
- `DealForm.jsx`

Pre-fills from `useBrands().defaultBrand` on mount. Always visible (even for single-brand users, who see it disabled). Disabled in edit mode (D-5 brand-locked-at-creation).

## BrandBadge on detail headers

Added to Sales Order, Invoice, ProformaInvoice detail page headers (Customer, Lead, Quotation already had it from earlier phases). PurchaseOrder and Inquiry detail pages are stubs without real headers; deferred.



# Drive folder structure setup (Phase 4.7, C-3)

## Why

The AI assistant's "find a file in Drive" path (Phase 4.5, C19) relies on Drive search. When a file isn't found, the assistant (Phase 4.7, C-4) suggests an upload destination. For that suggestion to be useful, the destination has to actually exist. C-3 provisions the canonical structure on every connected Drive account so the suggestion always lands somewhere real.

## Structure

Created on every ConnectedGoogleAccount that has Drive scope:

```
Brand Assets/
  IronLite Branding/
  Sovern House Branding/
  Reference/

Operations/
  Contracts/
  Factory Communications/
  Templates/
```

## Endpoint

`POST /api/admin/drive-setup` — super_admin only. Idempotent. Re-running returns the existing folder IDs for already-present folders.

Response shape:
```json
{
  "success": true,
  "data": {
    "folderTree": ["Brand Assets", "Brand Assets/IronLite Branding", ...],
    "accounts": {
      "alex@sovernhouse.co": {
        "Brand Assets": { "id": "1AbC...", "created": false, "webViewLink": null },
        "Brand Assets/IronLite Branding": { "id": "1XyZ...", "created": true, "webViewLink": "https://drive.google.com/..." }
      },
      "alexflorway@gmail.com": { ... }
    }
  }
}
```

Each successful per-account run writes an `admin_drive_setup` AuditLog row with `entity = 'ConnectedGoogleAccount'`, `entityId = account.email`, and `changes = { folderCount, createdCount, tree }`.

## Bulk content upload

The ERP backend runs on a Linux VM and cannot read Alex's Windows filesystem. The setup endpoint only creates folders. To populate a folder (e.g. drop the local IronLite Branding contents into `Brand Assets/IronLite Branding/`):

1. Run the endpoint once.
2. The response includes a `webViewLink` for every newly-created folder.
3. Open the link in a browser and drag-drop the local files into the Drive folder.

This pattern is intentional. The Phase 4.7 spec deferred AI-initiated Drive upload because the ERP cannot reach Windows files directly; the assistant suggests upload destinations (C-4) and the user moves the bytes.

## Files of interest

| File | Role |
|---|---|
| `backend/services/driveStructureSetup.js` | `FOLDER_TREE` constant + `setupForAccount(account)` + `setupDriveStructureForAllAccounts(db)` |
| `backend/routes/adminRoutes.js` | `POST /api/admin/drive-setup` wired with `requireAuth + requireRole('super_admin')` |
| `backend/controllers/aiController.js` (existing) | `findOrCreateFolder()` pattern that the new service mirrors |

## Audit action

`admin_drive_setup` — entity=ConnectedGoogleAccount, entityId=account.email, changes={folderCount, createdCount, tree}.


# Product taxonomy archive/restore (Phase 4.5 C21 follow-up)

## Why

C21 hid non-flooring productType enum values on the catalog UI but did not touch the ProductCategory table. Settings -> Product Taxonomy and Product Attributes kept showing every vertical. C21 follow-up archives the non-flooring tree at the data layer.

## Schema

`ProductCategory.isArchived BOOLEAN NOT NULL DEFAULT false`. Distinct from `isActive` (legacy soft-delete). Auto-added by `sequelize.sync({ alter: true })` on boot.

## Migration

`backend/services/migrateArchiveTaxonomyC21Followup.js`. Runs on boot. Finds the Flooring parent + its direct children and archives every other category. Idempotent via AuditLog sentinel `phase4_5_c21_followup_taxonomy_archived`.

## Endpoints

- All read endpoints (`/products/categories/tree`, `/flat`, `/`, `/export`) filter `isArchived=false` by default.
- Pass `?includeArchived=true` (used by the "Show archived" toggle on the Taxonomy page) to include them.
- `PATCH /products/categories/:id/archive` — admin/manager. Cascades to direct children. Audit `taxonomy_archive`.
- `PATCH /products/categories/:id/restore` — admin/manager. Cascades to direct children. Audit `taxonomy_restore`.

## Seed behaviour

`seedDefaultTemplate`, `loadTemplate`, `importCategories` all find-or-create by (slug, parentId). They never modify existing rows' `isArchived` flag. New rows default to `isArchived=false`. Re-running "Sovern Defaults" against an archived row leaves it archived.

## UI

Settings -> Product Taxonomy: amber banner explains the default filter; a "Show archived" checkbox toggles the full tree. Archived parent rows render with an amber "Archived" badge + a "Restore" action. Non-archived rows get an Archive action (parallel to the existing Delete; archive is reversible, delete is permanent).

Settings -> Product Attributes category dropdown: receives only non-archived categories because it calls `GET /products/categories` without `includeArchived`.

QuotationForm + ProductCatalog dropdowns: same auto-filter via the unmodified `/products/categories/flat` call.

## Mobile

No mobile UI manages the taxonomy directly. Mobile's product list reads `product.category` as a denormalised string and is unaffected.
