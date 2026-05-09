# ERP Whitelabel — SaaS Product Thinking for the Trading ERP

**Version:** 1.0 | **Created:** 2026-04-30
**Depends on:** `trade-ceo.md`, `trade-cto.md`, `trade-cfo.md`, `trade-product.md`, `erp-devops.md`
**Use for:** Any decision about the ERP that affects its potential for licensing, whitelabeling, or selling as a SaaS product to other trading companies. Load alongside trade-product.md whenever building features intended to generalize beyond Sovern House's own operations.

---

## The Dual-Purpose Mandate

This ERP serves two masters simultaneously:

**Master 1: Sovern House Operations**
Alex and his team use it every day to source flooring, manage leads, quote buyers, track shipments, and process invoices. It must be fast, reliable, and fit the Sovern House workflow precisely.

**Master 2: Whitelabel Product**
The ERP is a product Sovern House intends to sell or license to other trading companies. Every feature built must be evaluated: is this specific to Sovern House, or is it a pattern that any trading company would need?

Every feature decision must name both tradeoffs. A feature that works perfectly for Sovern but only works for Sovern is a liability in the whitelabel product. A feature that generalizes well but adds friction to daily operations is the wrong tradeoff in the other direction.

---

## Whitelabel Readiness Checklist (Feature Gate)

Before declaring any feature "whitelabel-ready," confirm:

### Generalization
- [ ] The feature works without Sovern House-specific hardcoded values (company name, logo, color, currency defaults)
- [ ] All Sovern-specific defaults are configurable (not hardcoded)
- [ ] The feature makes sense for a trading company in any vertical (auto parts, garments, electronics, commodities), not just flooring
- [ ] Country/region-specific logic (Egypt auto parts lane, Malaysia LVT agency) is behind feature flags or tenant config, not in core logic

### Multi-Tenancy
- [ ] The feature does not assume a single user (Alex) or single company
- [ ] Data that must be isolated between tenants is isolated (leads, customers, factories, pricing, documents)
- [ ] User roles work correctly for a tenant with 5-20 users (not just 1-2)
- [ ] There is no shared state between what would be different tenant databases

### Configurability
- [ ] Company name, logo, and brand colors are injectable at the tenant level (not hardcoded)
- [ ] Currency, language, and timezone are configurable per tenant
- [ ] Default payment terms, Incoterms, and document templates are editable per tenant
- [ ] Modules can be enabled/disabled per tenant (a company that doesn't do inspections doesn't see the Inspections module)

### Documentation
- [ ] The feature has user-facing documentation sufficient for a new user at a different company to use it
- [ ] The API endpoint for this feature is documented in `API_ENDPOINTS_REFERENCE.md`

---

## Feature Classification Framework

Before building any feature, classify it:

| Class | Definition | How to build it |
|-------|-----------|----------------|
| **Core** | Every trading company needs this (lead management, quotations, invoices, shipments) | Build it right, make it configurable, it IS the product |
| **Vertical-Specific** | Only relevant to a specific trade vertical (flooring spec fields, auto parts HS codes) | Build as an optional module or configurable field set; don't hardcode into core |
| **Sovern-Specific** | Only makes sense for Sovern House's specific business model | Build it, but clearly label it as a customization; abstract the pattern if possible |
| **Experimental** | We're not sure if it generalizes | Build a minimal version behind a feature flag; validate before investing |

---

## The Whitelabel Customer Profile

Who buys this product?

**Primary target: Small-to-medium trading companies (5-50 staff)**
- Import/export businesses that currently run on spreadsheets and email
- Companies that know they need software but can't afford SAP, Oracle Trade Management, or Tradogram at enterprise pricing
- Industries: flooring, textiles, auto parts, electronics, commodities, food & beverage
- Geography: Asia-based buying offices, Western importers, African commodity traders

**What they care about:**
- Does it replace my spreadsheets? (Yes)
- Can my team learn it in a week? (Yes — simple, not clever)
- Does it handle my compliance requirements? (Yes — HS codes, COO, sanctions screening)
- Can I brand it with my own logo? (Yes)
- What does it cost? (Must answer this before outreach)

**What they do NOT care about:**
- Cutting-edge technology stack
- Open-source community
- Integration with 200 apps (they want to integrate with: email, maybe Shopify, maybe QuickBooks)

---

## Pricing Model Considerations (CFO lens)

Options for whitelabel monetization (discuss with trade-cfo.md before committing):

| Model | Pros | Cons |
|-------|------|------|
| Per-seat SaaS ($X/user/month) | Predictable MRR, scales with customer growth | Need billing infrastructure, churn risk |
| Per-tenant flat fee (annual license) | Simple, no billing infrastructure needed | Less predictable, lumpy revenue |
| Setup fee + annual support | Aligns with B2B buying patterns | Requires ongoing support capacity |
| Revenue share on deals processed | Aligns incentives, scales with customer GMV | Complex to measure, requires trust |

**Recommendation for MVP:** Start with annual license + setup fee. Simplest to execute, no billing infrastructure needed, aligns with how B2B software is typically bought in the trading industry.

---

## Technical Architecture for Whitelabel

### Short-Term (Current State — Single Tenant)
The ERP currently runs as a single-tenant application. This is fine for Sovern House's own use and for serving one whitelabel customer at a time with separate deployments.

### Medium-Term (2-5 Whitelabel Customers)
- Separate deployment per customer (separate server/VPS, separate database)
- Shared codebase with tenant config injected via env vars
- Brand assets (logo, colors) injected via env vars or a `tenant.config.js` file

### Long-Term (Multi-Tenant SaaS)
Requires database redesign (PostgreSQL, tenant_id on all tables) — plan for this BEFORE you have more than 5 customers, because retrofitting multi-tenancy onto a single-tenant SQLite schema is extremely painful.

### Theme Injection Architecture (Frontend)
```javascript
// frontend/shared/theme.js
const theme = {
  primaryColor: import.meta.env.VITE_BRAND_PRIMARY || '#1a5c3a', // Sovern forest green
  logoUrl: import.meta.env.VITE_LOGO_URL || '/sovern-logo.svg',
  companyName: import.meta.env.VITE_COMPANY_NAME || 'Sovern House',
};

export default theme;
```

All brand references in the frontend should use `theme.primaryColor`, not hardcoded hex values.

---

## Demo Preparation Standards

The ERP will be demoed to prospective whitelabel customers. Demo readiness checklist:

- [ ] Demo database populated with realistic-looking fake data (not "Test Customer 1", "Test Lead 123")
- [ ] All modules functional — no broken pages or 500 errors
- [ ] Loading states work — no blank screens while data fetches
- [ ] Empty states are graceful — no ugly "undefined" or crash pages
- [ ] Brand colors and logo are easily swappable (can rebrand for a prospect's demo in under 10 minutes)
- [ ] The top 3 demo flows work perfectly: (1) Lead → Quotation → PI, (2) Shipment tracking, (3) Factory management with documents
- [ ] Mobile responsive — prospect's CEO will look at their phone during the demo
- [ ] The ERP is accessible from a URL the prospect can visit (not just localhost) — use ngrok or a staging deployment

---

## Competitive Context

Who else is in this space?

| Product | Positioning | Weakness |
|---------|------------|----------|
| Tradogram | Procurement-focused, good UI | Not trade-specific (no COO, no inspection workflow, no factory portal) |
| Zoho CRM + Inventory | Cheap, widely known | Generic, not built for import/export compliance |
| TradeGecko/QuickBooks Commerce | E-commerce focused | No B2B trade finance, no factory portal |
| Expeditors TMS | Enterprise, very expensive | SME can't afford it |
| Custom Excel/Notion | Free | Doesn't scale, no audit trail, no compliance |

**Sovern House ERP differentiator:** The only ERP that combines CRM, full trade lifecycle (inquiry → shipment), factory portal, compliance documentation, and whitelabel flexibility — built by a trading company that actually uses it.
