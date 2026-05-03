# Sovern ERP — Module Architecture

*Last updated: 2026-05-02*

---

## Overview

The Sovern ERP is built on an Odoo-inspired module system. Each feature of the ERP is a self-contained module that can be independently enabled, disabled, tested, and eventually licensed to other businesses as a standalone product. This is the foundation for eventual whitelabelling and the long-term goal of building a trade ERP platform rather than just an internal tool.

---

## Core Concepts

### What Is a Module?

A module is a self-contained feature bundle that owns:

- **Models** — its database tables (Sequelize models)
- **Routes** — its API endpoints (Express routes + controller)
- **Frontend pages and components** — the UI that surfaces the feature
- **A manifest** — declares dependencies, version, and metadata
- **A feature flag** — controls whether the module is on or off without code changes

Modules are discovered automatically by the module loader at server startup. No manual registration in `server.js` is required once a module directory exists.

### What a Module Does NOT Own

- Global authentication (lives in `core`)
- Shared UI components (Chatter, KanbanBoard, WorkflowStatusBar, etc.) — these are framework-level utilities, not module-specific
- Database connection (managed by `models/index.js`)
- Environment configuration (lives in `.env` / `config/`)

---

## Module Directory Structure

```
backend/modules/
  <module-name>/
    index.js         — init function: registers routes + models
    manifest.json    — name, version, description, dependencies
  moduleLoader.js    — scans directories, initialises in dependency order
  moduleRegistry.js  — in-memory registry of active modules
  featureFlags.js    — enable/disable flags (env-var overrideable)
  configManager.js   — per-module config values
  moduleRoutes.js    — API for querying module state at runtime
```

### Manifest Schema

```json
{
  "name": "myModule",
  "version": "1.0.0",
  "description": "Human-readable summary",
  "dependencies": ["core"],
  "routes": ["myRouteFile"],
  "models": ["MyModel"],
  "config": {}
}
```

### Init Function Signature

```js
async function initMyModule(app, sequelize, models, registry) {
  const routes = require('../../routes/myRoutes');
  app.use('/api/my-resource', routes);
  registry.registerModel('myModule', 'MyModel', models.MyModel);
}
module.exports = initMyModule;
```

---

## Current Modules

| Module | Status | Description |
|---|---|---|
| `core` | Always on | Auth, users, permissions, notifications |
| `crm` | Enabled | Leads, contacts, deals, campaigns, activities |
| `sales` | Enabled | Quotations, proforma invoices, sales orders |
| `procurement` | Enabled | Purchase orders, GRN, supplier management |
| `finance` | Enabled | Invoices, payments, cash flow, exchange rates |
| `logistics` | Enabled | Shipments, packing lists, shipping documents |
| `quality` | Enabled | Inspections, sample requests, claims |
| `products` | Enabled | Product catalogue, categories, specifications, pricing |
| `analytics` | Enabled | Dashboard, reports, BI views |
| `documents` | Enabled | Document templates, generation, versioning |
| `compliance` | Disabled | Sanctions screening, export controls, compliance records |
| `warehouse` | Disabled | Warehouse locations, stock counts, transactions |
| `tradeFinance` | Enabled | Letters of credit, landed cost calculations |
| `sampleManagement` | Enabled | Sample requests, shipments, feedback |
| `chatter` | Enabled | Polymorphic message thread on every record |
| `internalApprovals` | Enabled | Manager sign-off on staff actions |

---

## Enabling / Disabling a Module

### Via Environment Variable

```bash
# Disable warehouse module
MODULE_WAREHOUSE_ENABLED=false

# Enable compliance module
MODULE_COMPLIANCE_ENABLED=true
```

Set these in `.env` or in the GCP VM's environment (e.g. via the deploy script or systemd unit).

### Via Feature Flag Default

Edit `backend/modules/featureFlags.js`:

```js
this.defaults = {
  'module:myModule': true,   // enabled by default
  'module:myModule': false,  // disabled by default
};
```

### At Runtime (API)

```
GET  /api/modules              — list all modules and their status
POST /api/modules/:name/enable — enable a module
POST /api/modules/:name/disable— disable a module
```

Note: runtime enable/disable takes effect on next server restart for modules that register routes.

---

## How to Build a New Module

1. Create the directory: `backend/modules/myModule/`

2. Write `manifest.json`:
```json
{
  "name": "myModule",
  "version": "1.0.0",
  "description": "What this module does",
  "dependencies": ["core"],
  "routes": ["myRoutes"],
  "models": ["MyModel"],
  "config": {}
}
```

3. Write `index.js` (the init function, as above)

4. Create your Sequelize model at `backend/models/MyModel.js`

5. Register the model in `backend/models/index.js`

6. Create your Express router at `backend/routes/myRoutes.js`

7. Create your controller at `backend/controllers/myController.js`

8. Add a feature flag default in `featureFlags.js`:
```js
'module:myModule': true,
```

9. Build the frontend: pages in `frontend/admin-portal/src/pages/MyModule/`, add to router in `App.jsx`, add menu item in `Layout.jsx`

The module loader discovers the new module automatically — no registration in `server.js` required.

---

## Frontend Module Convention

The frontend does not have a formal module loader yet (React doesn't need one at this scale). Instead, follow these conventions:

```
frontend/admin-portal/src/
  pages/
    MyModule/
      MyModuleList.jsx       — list/index page
      MyModuleDetail.jsx     — detail page
      MyModuleForm.jsx       — create/edit form
  components/
    (shared components only — not module-specific)
  services/
    api.js                   — add myModuleAPI export here
```

For large future modules (e.g. a full Inventory module), consider a `pages/Inventory/index.js` barrel file that re-exports all sub-pages.

---

## Odoo Patterns Implemented

| Odoo Feature | Sovern Implementation | Status |
|---|---|---|
| Module system | `backend/modules/` + manifest + featureFlags | Live |
| Chatter (message thread) | `ChatterMessage` model + `Chatter.jsx` component | Live |
| Status bar / workflow | `WorkflowStatusBar.jsx` with stage presets | Live |
| Kanban pipeline | `KanbanBoard.jsx` with HTML5 DnD | Live |
| Internal approvals | `InternalApproval` model + `ApprovalPanel.jsx` | Live |
| Activity scheduling | Planned — `internalApprovals` module v1.1 | Roadmap |
| Email integration | `OutreachEmail` model + Resend | Live |
| Client portal / signing | `DocumentApproval` model + token link | Live |

---

## Roadmap: Whitelabelling via Modules

The eventual goal is to license the Sovern ERP to other trading companies. The module system supports this:

1. **Company-specific modules** — each client can enable/disable the modules relevant to their business (e.g. disable `sampleManagement` for a commodity-only trader)
2. **Tenant config** — `configManager.js` already supports per-tenant configuration (company name, logo, currency, timezone)
3. **Module marketplace** — in the future, Sovern can offer premium modules (e.g. `garments`, `autoparts`, `compliance`) that clients pay to activate

The architecture is already shaped for this. The first step when whitelabelling is to replace hardcoded `Sovern House` references with tenant config values (tracked in lessons.md under the tenant config task).

---

## Dependency Graph (Current)

```
core
 ├── crm (leads, contacts, deals)
 ├── sales (quotations, PIs, SOs)
 │    └── internalApprovals (sign-off before sending)
 ├── procurement (POs, GRN)
 │    └── internalApprovals
 ├── finance (invoices, payments)
 ├── logistics (shipments)
 ├── quality (inspections, claims)
 ├── products (catalogue, pricing)
 ├── tradeFinance (LC, landed cost)
 ├── documents (templates, generation)
 ├── analytics (dashboard, reports)
 ├── chatter (message thread — cross-module)
 │    └── internalApprovals (events logged via chatter)
 ├── compliance [disabled]
 └── warehouse [disabled]
```
