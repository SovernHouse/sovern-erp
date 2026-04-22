# Trading ERP — Product Architecture & Roadmap

> **Document purpose:** North-star reference for the entire team. Every new feature, every API endpoint, every UI decision should be made with the targets described here in mind. This is a living document — update it when decisions change.

---

## 1. Product Vision

This is a **whitelabelable, multi-portal trade ERP** built for international trading companies. The initial deployment serves Sovern House (New Route International Exchange Co., Ltd., Taiwan), but the product is designed from the ground up to be licensed or sold as a complete platform to other trading businesses.

**What "whitelabelable" means in practice:**
- No Sovern House branding hardcoded anywhere in the codebase. Every brand element (company name, legal entity, logo, colour scheme, email domains, taglines) is database-driven and configurable through an admin UI.
- Deploying for a new customer means: provision a new instance, run migrations, configure their branding and staff roles, connect their SMTP — and they have a fully branded system.

---

## 2. System Architecture Overview

The platform consists of **three distinct surfaces**. Each has a different audience, a different data scope, and a different trust level. They share one backend API but authenticate with different JWT scopes.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Backend API                             │
│           (Node/Express + Sequelize + SQLite → Postgres)        │
│   Auth: JWT with role/scope claims per surface                  │
└──────────────┬──────────────────┬──────────────────────────────┘
               │                  │                   │
               ▼                  ▼                   ▼
     ┌──────────────┐   ┌──────────────────┐  ┌──────────────────┐
     │  Admin ERP   │   │  Client Portal   │  │ Factory Portal   │
     │  (internal)  │   │  (buyers)        │  │  (suppliers)     │
     │  React SPA   │   │  React PWA       │  │  React PWA       │
     └──────────────┘   └──────────────────┘  └──────────────────┘
```

### 2.1 Admin ERP (current portal)

**Audience:** Internal staff — CEO, COO, Sales Reps, Accountants, Cashiers, Project Managers, Office Manager  
**Trust level:** Full internal — but access is role-scoped (see Section 4)  
**Technology:** React SPA, desktop-first (mobile-capable but not mobile-primary)

### 2.2 Client Portal

**Audience:** Buyers and customers  
**What they see:**
- Their own orders, shipments, and delivery status
- Proforma invoices and commercial invoices (their own only)
- Payment status and payment submission
- RFQ / inquiry submission
- Document downloads (their own documents only)

**What they never see:** Cost price, supplier identity, margins, other customers' data, internal notes, campaigns, leads

**Technology:** React PWA — installable on phone, works offline for order status, push notifications for shipment updates  
**Authentication:** Separate JWT scope (`client`). Customers self-register or are invited by staff.

### 2.3 Factory / Supplier Portal

**Audience:** Factories and suppliers  
**What they see:**
- Purchase orders issued to them
- Inspection schedules and QC checklists
- Shipment booking confirmations
- Document upload (packing list, CoA, certificates of origin)
- Payment status for their invoices

**What they never see:** Sales prices, customer identity, other suppliers' orders, margin data  
**Technology:** React PWA  
**Authentication:** Separate JWT scope (`factory`). Factories are invited by staff when a PO is issued.

---

## 3. Whitelabeling & Multi-Tenancy

### 3.1 Deployment Model (Recommended: Single-Instance-Per-Customer)

Each customer gets their own deployed instance of the ERP. This is simpler than shared multi-tenancy, avoids data isolation risk, and makes enterprise sales straightforward ("your data is on your own database").

```
Customer A → erp.companyA.com → Database A
Customer B → erp.companyB.com → Database B
Sovern House → erp.sovernhouse.co → Database SH
```

Shared multi-tenant (all customers on one DB, separated by `tenantId`) is possible later if a SaaS model is pursued, but requires adding `tenantId` to every model — a significant migration. Do not start building this way until the business model confirms it.

### 3.2 Branding Configuration (Build This Next)

Everything hardcoded today must become database-driven. A `TenantConfig` table (single row per deployment) should hold:

| Field | Example | Replaces |
|---|---|---|
| `companyName` | Sovern House | hardcoded throughout |
| `legalEntityName` | New Route International Exchange Co., Ltd. | legal text in emails |
| `legalEntityCountry` | Taiwan | email footers |
| `primaryColor` | `#1D5A32` | hardcoded `#1D5A32` in emailService.js |
| `logoUrl` | URL to hosted logo | hardcoded logo URLs |
| `wordmarkUrl` | URL to email wordmark | email signature |
| `faviconUrl` | URL | browser tab |
| `defaultFromEmail` | `alex@sovernhouse.co` | `SMTP_USER` default |
| `defaultWebsite` | `sovernhouse.co` | hardcoded in signatures |
| `tagline` | Your buying office in Asia. | email taglines |
| `allowedSendingDomains` | `["sovernhouse.co","sovern-house.com"]` | domain validation in campaign controller |
| `smtpHost`, `smtpUser`, `smtpPass` | SMTP credentials | `.env` only |
| `currencyCode` | TWD / USD | financial displays |
| `dateFormat` | DD/MM/YYYY | date rendering |
| `timezone` | Asia/Taipei | scheduling, timestamps |

**Admin UI:** Settings → Company Branding. Admin uploads logo, sets colours, previews how email signatures will render. No `.env` editing required for branding.

**Priority:** High. This is the first thing that must be done before selling a second license.

---

## 4. Staff Roles & Access Control

The current RBAC config has two roles (`admin`, `manager`). For real operations with multiple staff members, we need fine-grained role definitions. Roles control: which nav items appear, which API endpoints are accessible, and which data fields are visible.

### 4.1 Role Definitions

| Role | Description | Key Access |
|---|---|---|
| **admin** | System administrator. Typically the business owner / IT. | Everything, including user management, branding config, SMTP settings, RBAC config |
| **ceo / coo** | Executive oversight | Full read access to all modules + analytics + financials. Cannot edit user permissions. |
| **sales_rep** | Outbound sales, leads, customer relationships | CRM (leads, contacts, campaigns, outreach), customers, inquiries, quotations. NO access to: cost prices, purchase orders, supplier financials |
| **project_manager** | Order execution | Sales orders, purchase orders, shipments, inspections, factories, packing lists, GRN. Can see sell price and buy price on their own orders. |
| **accountant** | Full financial visibility | Invoices, payments, claims, financial reports, BI dashboard. Read-only on orders/shipments for context. NO access to: CRM/outreach, user management |
| **cashier** | Payment processing | Payments (create/edit), invoices (view only). No access to: reports, settings, CRM, orders |
| **office_manager** | Admin support | Customers, contacts, quotations, orders (view), documents, email templates. No access to: financials detail, RBAC, SMTP config |
| **viewer** | Read-only stakeholder | Dashboard and reports only. No create/edit on anything. |

### 4.2 Permission Implementation

The existing `rbacConfig.js` defines role-nav mappings. This needs to be extended to:

1. **Route-level**: current state — nav items filtered by role ✓
2. **API-level**: backend middleware must validate role before every sensitive endpoint (currently only `requireAuth` is used — roles are not enforced server-side). This is a **security gap** — fix before adding more staff.
3. **Field-level**: Some roles see sell price but not buy price. Implement `sanitizeForRole(data, role)` helpers on query responses.

### 4.3 Role Management UI

Admins should be able to:
- Assign roles to users in Settings → Users
- Create custom roles (advanced — later milestone)
- See a permissions matrix showing what each role can do

---

## 5. UX — Instructions, Tooltips & Onboarding

### 5.1 Tooltips (Priority: Medium)

Every form field and action button should have a context-sensitive tooltip explaining what it does, what format is expected, and why it matters. This is especially critical for:
- Trade-specific fields (Incoterms selector, HS code, CoO, letter of credit terms)
- Financial fields (payment terms, margin calculation)
- Status fields (lead stages, order statuses, shipment states)

**Implementation:** Use a `<Tooltip>` component wrapping a `?` icon or `ⓘ` badge. Tooltip content is stored in a `tooltips.js` config file (not hardcoded inline) so it can be translated and updated without touching component code.

```jsx
// Example
<Tooltip content="Free on Board — seller delivers goods to named port. Buyer pays freight from that point.">
  <span className="tooltip-trigger">FOB ⓘ</span>
</Tooltip>
```

### 5.2 Contextual Help Panel (Priority: Medium)

Each major page should have an optional slide-out help panel (triggered by a `?` button in the top-right) that explains:
- What this page is for
- How the workflow typically runs
- Common mistakes to avoid
- Links to relevant documentation

### 5.3 Onboarding Flow (Priority: Medium — before first external customer)

When a new user logs in for the first time:
1. Welcome modal with role-specific intro ("As a Sales Rep, your primary workspace is...")
2. Guided tour of the 3 most important features for their role (using a library like `react-joyride`)
3. "Setup checklist" for admins (connect SMTP, upload logo, create first user, set company details)

### 5.4 In-App Documentation (Priority: Low)

A `/help` route with searchable documentation, structured by role. Markdown-driven so it can be updated without code changes.

---

## 6. External Integrations

The ERP must be pluggable — each customer deployment connects their own systems. All integrations are configured through the admin UI, not `.env` files.

### 6.1 Email (Current: Nodemailer SMTP)

Already functional. Needs to move config from `.env` to `TenantConfig` table (see Section 3.2).

**Planned additions:**
- **Gmail OAuth** — connect a Gmail workspace account via OAuth2 instead of SMTP credentials (better for Google Workspace customers)
- **Outlook OAuth** — Microsoft 365 accounts
- **Mailgun / SendGrid** — high-volume sending for campaigns
- **Webhook on send** — fire a webhook after each outreach email for CRM/analytics integration

### 6.2 Accounting

| Integration | Priority | Notes |
|---|---|---|
| **Xero** | High | Most common for international trade SMEs in Asia/Oceania |
| **QuickBooks Online** | Medium | Dominant in North America |
| **Wave** | Low | Free tier, useful for very small customers |

**Sync scope:** Push invoices and payments from ERP → accounting. Pull chart of accounts for categorisation. Do NOT attempt full bidirectional sync initially — it creates reconciliation nightmares.

### 6.3 Logistics / Freight

- **ShipTrack / CargoWise integration** — shipment status webhooks
- **Manual tracking** — current state, adequate for now

### 6.4 Banking

- **Bank statement import** (CSV/OFX) — reconcile payments against bank records
- **SWIFT/wire confirmation webhooks** — auto-update payment status when wire hits

### 6.5 Customer / Lead Data

- **ImportGenius / Panjiva** — customs data for prospecting (export only, consumed manually today)
- **LinkedIn Sales Navigator** — future webhook or manual import
- **Apollo.io** — lead enrichment API

### 6.6 Document Generation

- Current: PDF generation for quotations, proformas, invoices (already implemented)
- Planned: DocuSign / HelloSign for e-signature on contracts and proformas

---

## 7. Mobile Strategy

### 7.1 Admin ERP

Desktop-primary. Must be **usable** on tablet (1024px+) for executives checking dashboards on the road. Not optimised for phone.

### 7.2 Client Portal & Factory Portal — PWA First

Both portals must be **mobile-first, offline-capable Progressive Web Apps**. This means:

- Responsive layout designed for 375px viewport first
- Service worker for offline caching of order/shipment status
- Web push notifications for: shipment status changes, new invoices, new POs (factory)
- "Add to home screen" prompt — installable without App Store friction
- Works on both iOS (Safari) and Android (Chrome)

**Why PWA before native:** One codebase, instant updates (no App Store approval), no 30% App Store commission on any payments. Cover 80% of mobile use cases.

### 7.3 Native Mobile App (Later Milestone)

If the business needs native capabilities (camera for QR scanning on goods receipt, GPS tracking for delivery, biometric auth):
- Build with **React Native + Expo** to maximise code sharing with the React PWA
- Admin ERP app: internal-only, not App Store published initially (use Expo EAS internal distribution)
- Client/Factory apps: App Store + Play Store

---

## 8. Security Priorities

Listed in order. Do these before adding external customers.

1. **Server-side role enforcement** — add role checks to every sensitive API endpoint, not just the frontend nav. Current gap: a user who knows the API URL can hit admin endpoints regardless of role.
2. **Move SMTP credentials to DB** — remove from `.env`, store encrypted in `TenantConfig`
3. **Field-level data masking** — cost prices, margins, supplier names must not appear in API responses for roles that shouldn't see them
4. **Audit trail for all mutations** — already partially implemented; ensure it covers user management, config changes, and financial records
5. **Rate limiting** — add to auth endpoints and email send endpoints
6. **2FA for admin accounts** — TOTP (Google Authenticator) for any account with `admin` or `ceo` role

---

## 9. Feature Roadmap

Ordered by business impact. Items marked ★ are prerequisites for selling to external customers.

### Immediate (this quarter)
- ★ Backend restart to create `EmailSignatures` and `EmailTemplates` tables
- ★ Seed default Alex/Sovern House signature via Settings → Email Signatures
- ★ Server-side role enforcement on sensitive endpoints
- ★ Settings → Company Branding page + `TenantConfig` model
- Tooltips component library (ship on 5 highest-traffic pages first)
- Expand RBAC to include: `ceo`, `sales_rep`, `project_manager`, `accountant`, `cashier`, `office_manager`, `viewer`

### Near-term (next quarter)
- ★ Move SMTP config to admin UI (remove from `.env`)
- Client Portal v1 (order status, invoice download, RFQ)
- Factory Portal v1 (PO view, document upload)
- Onboarding flow for new users
- Xero integration (push invoices/payments)

### Medium-term
- PWA service worker + push notifications for portals
- Gmail OAuth / Outlook OAuth for email sending
- In-app help documentation
- Custom role builder (admin creates roles and assigns permissions from a matrix UI)
- DocuSign integration for e-signature

### Long-term
- Multi-currency GL with realised/unrealised FX gain/loss
- React Native mobile app (internal staff use cases)
- Apollo.io lead enrichment
- Mailgun/SendGrid for high-volume campaign sends

---

## 10. Data & Privacy

- **Data residency:** Each customer's data stays on their own instance. No cross-customer data ever on one DB.
- **GDPR:** If selling to EU customers — add data retention policies, right-to-erasure endpoint, cookie consent. Required before any EU customer goes live.
- **PII in emails:** Outreach emails contain prospect names and email addresses. Ensure email logs are not retained longer than necessary and are access-controlled.

---

## 11. Key Technical Decisions Already Made

| Decision | Rationale |
|---|---|
| SQLite in development, Postgres in production | Fast local dev, production-grade at scale |
| `autoMigrateSchema: true` | New model columns added automatically on restart — avoids manual migrations during rapid development. Remove this and use Sequelize migrations before first external customer. |
| Nodemailer over SaaS email | Full control, no per-email cost, works with any SMTP |
| JWT auth, no sessions | Stateless, works for all three surfaces (ERP, client portal, factory portal) |
| Single backend serves all three portals | Simpler ops. Separate by scope/role in middleware, not by separate servers. |
| React SPA (Vite) | Fast development, good ecosystem, reusable between portals |

---

## 12. Open Questions for Alex to Decide

1. **SaaS vs. licensed:** Is the whitelabel product sold as "your own server" (licensed) or "log in to our cloud" (SaaS)? This determines whether multi-tenancy on one DB is needed.
2. **Pricing model:** Per-seat, flat monthly, or revenue-share? Affects how user management is architected.
3. **Support model:** Who supports external customers — Alex directly, or a channel partner? Affects how much self-serve the admin UI needs to be.
4. **ERP name:** Does the product get its own brand name, separate from Sovern House? Recommend yes — Sovern House is the trading brand; the ERP product should have its own identity.

---

*Last updated: 2026-04-21. Maintained by the engineering team. Update this document whenever a major architectural decision is made or reversed.*
