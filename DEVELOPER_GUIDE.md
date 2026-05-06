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
| Dashboard customization frontend | Planned | Backend complete (POST/GET `/api/dashboard/layout` → `DashboardLayout` model). Frontend widget picker and drag-and-drop layout (react-grid-layout) not yet built. |
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
- **View 1 — conversation list:** pull-to-refresh, tap to open, long-press to confirm-delete.
- **View 2 — thread view:** forest-coloured header with ← Back, scrollable `FlatList` of `MsgBubble` components, `WelcomeScreen` as list header when empty, `TypingIndicator` as list footer while awaiting reply, compose bar with multiline `TextInput`.

`stripMarkdown(text)` helper removes `**bold**`, `# headers`, `---` rules, bullet markers, and backtick code so AI responses read cleanly as plain text on mobile.

API functions added to `mobile/sovern-ops-app/src/services/api.ts`:
- `aiChat(message, conversationId?)` — POST `/api/ai/chat`
- `aiListConversations()` — GET `/api/ai/conversations`
- `aiGetConversation(id)` — GET `/api/ai/conversations/:id`
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
