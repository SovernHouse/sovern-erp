# CTO Advisor — International Trade E-Commerce Platform

## The CTO's First Question: What Breaks. What Leaks. What Doesn't Scale.

Before approving any architecture or code decision for this platform, ask:

1. **What breaks under load?** Can the system handle a spike when a major supplier launches a new commodity catalog, or when 200 international buyers simultaneously request quotes during a regional trade show?

2. **What leaks data?** Are we exposing cardholder data, supplier credentials, or transactional details to unauthorized parties? Are we meeting PCI DSS, GDPR, and sanctions list compliance?

3. **What doesn't scale?** Will the database lock under concurrent inventory updates? Will the search engine crawl slow when catalog grows to 50,000+ SKUs across 30 currencies? Will API response times degrade when integrating with 10+ ERP, CRM, and logistics systems?

4. **What's the compliance risk?** Is this decision creating regulatory or legal exposure? (Export controls, tariffs, sanctions screening, trade documentation, data residency, payment method legality in specific countries.)

5. **What's the margin impact?** Does this architecture increase operational costs or processing fees in a way that erodes already-thin trade margins?

---

## Recommended Tech Stack (2025-2026)

### Frontend & Framework
- **Next.js 15** with Partial Prerendering (PPR) — allows serving static layout instantly (under 50ms) while dynamic content streams in. Critical for international audiences on slower connections.
- **React 19** for UI components and state management.
- **Tailwind CSS 4** for responsive design that works across cultures and RTL-capable layouts.

**Rationale:** Next.js is the modern standard for headless e-commerce because it decouples the frontend from the commerce backend, allowing fast iteration on UX while the backend team builds APIs. PPR is a "killer feature" for 2026 — you serve the layout in milliseconds, then fetch dynamic pricing/inventory in the background.

### Headless CMS
- **Payload CMS** (for maximum control and Next.js integration).
  - Alternative: Sanity (if non-technical editors need a polished visual interface).
  - Alternative: Strapi (if you prefer open-source and self-hosted).

**Rationale:** A headless CMS separates content management from presentation. For an international trade company, this means product descriptions, certifications, compliance docs, and marketing content can be managed independently of the product catalog API. Payload is Next.js-native (lives in the same monorepo), which reduces infrastructure complexity.

### Commerce Engine
- **Medusa.js** (open-source, self-hosted) or **Shopify Storefront API** (managed, higher fees, less customization).
- Medusa is preferred for trade-specific workflows because you control the order, pricing, and payment logic.

**Rationale:** Commerce engines handle product catalogs, inventory, orders, pricing rules, and payment processing. Medusa is more flexible for B2B workflows (tiered pricing, quote-to-cash, multi-currency). Shopify's Storefront API is simpler but less configurable for complex trade operations.

### Backend & API Layer
- **Node.js 22 LTS** with **Express.js** or **Fastify** for REST endpoints.
- **GraphQL** (Apollo Server) for complex queries (e.g., "get all products in category X across all warehouses with inventory by location and regional pricing").
- REST for simple, high-volume lookups (product details, prices).
- **Webhooks** for real-time updates on orders, shipments, and inventory changes.

**Rationale:** In 2025, REST is legacy for complex B2B queries. GraphQL collapses multiple API calls into one, reducing overfetching and latency. For high-volume, simple operations (e.g., "get product by ID"), REST is still faster due to lower parsing overhead.

### Database
- **PostgreSQL 18** (managed on AWS RDS, Azure Database, or GCP Cloud SQL).
- Use **connection pooling** (PgBouncer) to handle spikes in concurrent transactions.
- Implement **table partitioning** by region, product category, or time to keep query performance predictable as data grows.

**Rationale:** PostgreSQL handles complex relational schemas (inventory across warehouses, multi-currency pricing, supplier contracts) and executes analytical queries 1.6–15.1x faster than MongoDB depending on query type. Avoid NoSQL for transactional trade systems where data consistency is non-negotiable.

**Database Design Principle:** Store all money in its **minimum currency unit** (cents, pence, yen) as **INTEGER**, never floating-point. Floating-point arithmetic cannot accurately represent all decimals, leading to precision errors across millions of transactions.

### Search
- **Algolia** (managed, fast, best for UX-focused discovery) or **Elasticsearch** (self-hosted, full control, better for complex filtering).
- Algolia: Use variant-level records (one record per SKU) for granular search and faceting.
- Elasticsearch: Use hybrid search (full-text + vector search) to combine keyword matching with semantic similarity.

**Rationale:** Standard SQL `LIKE` queries are too slow at scale. Algolia's managed approach gets you to market faster (20% faster time-to-market). Elasticsearch is better if you need full control over indexing or plan to build recommendation engines (vector search for "similar products" or AI-driven discovery).

### CDN & Global Delivery
- **Cloudflare** (for DDoS protection, image optimization, and Speed Brain AI prefetching) or **AWS CloudFront + S3**.
- Enable caching for static assets (images, CSS, JS), product pages (1-hour TTL), and API responses (30-second TTL for real-time pricing).

**Rationale:** International trade websites serve global audiences. A CDN reduces latency for buyers in Singapore, Dubai, São Paulo, etc. Cloudflare's Speed Brain reduces loading delays by 45–75% through AI-driven prefetching of pages users are likely to click next. This is critical for conversion, especially on slower connections.

### Infrastructure & Hosting
- **AWS** (recommended) with multi-region failover:
  - **Compute:** ECS Fargate or EKS for containerized services (API, webhooks, integrations).
  - **Database:** RDS PostgreSQL with read replicas for high-volume queries.
  - **Storage:** S3 for documents, invoices, shipping labels, and customs forms.
  - **CDN:** CloudFront for static and dynamic content delivery.
  - **Queue:** SQS for asynchronous order processing and webhook delivery (decouples real-time API from background jobs).
  - **Monitoring:** CloudWatch + X-Ray for distributed tracing.

**Alternative:** Azure if you already have Microsoft Dynamics for ERP. GCP if you want to leverage Google's fiber network for faster international connectivity.

**Rationale:** AWS has the most regions (27+) and the deepest integration with third-party services (ERP, CRM, shipping APIs). Multi-region failover ensures uptime if a region fails.

---

## Security Requirements — Non-Negotiable

### PCI DSS Compliance (If Handling Card Data)
- **Requirement 4:** Use **TLS 1.2+** for all transmission of cardholder data. Enforce HSTS (HTTP Strict-Transport-Security) headers with `max-age=31536000`.
- **Requirement 6:** Implement OWASP Top 10 secure coding practices.
- Even if you use Stripe, PayPal, or Square (and never touch card data), you must achieve **SAQ A compliance**, which includes TLS 1.2+ and security headers.
- **Cost of non-compliance:** $5,000–$100,000 per month in fines. A breach: $50,000+ forensic investigation + reputational damage.

**Action:** Use a managed payment processor (Stripe, Adyen, or WireCard for wire transfers). Never store raw card data.

### OWASP Top 10 2025 Mitigations

| Risk | Mitigation |
|------|-----------|
| **A01: Broken Access Control** | Implement role-based access control (RBAC). Test authorization on every API endpoint. Use a library like Casbin or Zitadel. |
| **A02: Cryptographic Failures** | Encrypt data at rest (AES-256) and in transit (TLS 1.3). Use AWS KMS or Azure Key Vault for key management. |
| **A03: Injection** | Use parameterized queries. Never concatenate SQL strings. Use ORMs (TypeORM, Prisma). Sanitize all user inputs. |
| **A04: Insecure Design** | Threat model the system. Document data flows. Run security design reviews before coding. |
| **A05: Security Misconfiguration** | Use Infrastructure-as-Code (Terraform). Enforce least privilege (minimal IAM permissions). Scan dependencies with npm audit / snyk. |
| **A06: Vulnerable & Outdated Components** | Pin dependencies. Run automated SCA (software composition analysis) tools. Update regularly. Require SBOM (Software Bill of Materials) from vendors. |
| **A07: Authentication & Session Management** | Use OAuth 2.0 + OpenID Connect for B2B SSO. Enforce MFA for admin and supplier portals. Implement rate limiting on login endpoints. |
| **A08: Software & Data Integrity Failures** | Sign and verify API responses. Use code signing for deployments. Pin third-party package versions. |
| **A09: Logging & Monitoring Failures** | Log all authentication attempts, API calls, and data access. Alert on suspicious patterns. Retain logs for 90 days minimum. |
| **A10: SSRF (Server-Side Request Forgery)** | Validate all URLs before making outbound requests. Disable redirects to private IP ranges (10.x, 172.16.x, 192.168.x). Implement allowlists for external APIs. |

**New in 2025:** SSRF is now a standalone category (was previously buried in A06). Watch for AI-generated code security risks — LLM-generated code may omit security checks. Always review generated code.

### SSL/TLS & Certificate Management
- Use **Let's Encrypt** (free) or AWS Certificate Manager (included with AWS).
- Enforce **HSTS** and **CSP (Content Security Policy)** headers.
- Implement **certificate pinning** for mobile apps and critical integrations.

### Sanctions & Export Control Screening
- Integrate with **Denied Party Screening (DPS)** providers:
  - **Worldcheck (Refinitiv)**, **Lexis Nexis**, or **Accuity** to screen suppliers and customers against OFAC, BIS, EU, and UN lists.
- Block transactions to embargoed countries (North Korea, Iran, Syria, Crimea, etc.).
- Log all screening hits and require manual review.

**Why:** A single missed sanctions violation can result in $20,000+ fines per violation. Agencies conduct audits.

### Authentication & Authorization for B2B Portals
- **Provider:** Zitadel, Stytch, or Auth0 (for managed solution) or **Keycloak** (self-hosted).
- Implement **RBAC** (Role-Based Access Control):
  - Admin: Full system access.
  - Supplier: View own orders, upload invoices, manage catalogs.
  - Buyer: View products, place orders, access order history and invoices.
  - Finance: View transactions, manage payment terms.
- Enforce **SSO (Single Sign-On)** with email verification.
- Implement **MFA** for sensitive operations (payment changes, supplier account creation).

---

## Multi-Currency & Multi-Language Architecture

### Currency Handling
- **Store prices in the base currency** (e.g., USD) in the database as **INTEGER** (cents).
- **Apply exchange rates at runtime** using a real-time or daily-updated exchange rate table.
- Implement a **separate "display currency"** for each user session based on their geography or preferences.

**Example DB Schema:**
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50),
  price_usd_cents INTEGER,  -- $99.99 stored as 9999
  warehouse_id INTEGER,
  created_at TIMESTAMP
);

CREATE TABLE exchange_rates (
  base_currency VARCHAR(3),
  target_currency VARCHAR(3),
  rate DECIMAL(10, 6),      -- Never floating-point
  updated_at TIMESTAMP
);
```

### Multi-Language Content
- **Static UI text:** Store in JSON/YAML files (version-controlled, fast to load). Use libraries like `next-i18n-router` or `i18next`.
- **Dynamic content:** Store product descriptions, certifications, and compliance docs in the database with a `locale` column.

**Example:**
```sql
CREATE TABLE product_descriptions (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  locale VARCHAR(10),       -- 'en-US', 'es-ES', 'zh-CN'
  description TEXT,
  certification_url VARCHAR(500),
  created_at TIMESTAMP
);
```

### Time Zone Handling
- Store all timestamps in **UTC** in the database.
- Convert to user's local time zone on the frontend (use `date-fns` or `moment.js`).
- For shipping deadlines and order cutoffs, always reference **UTC+0** in backend logic.

### Regional Compliance & Regulations
- **VAT/GST:** Implement tax calculation based on buyer's destination country. Use a tax engine like **TaxJar**, **Avalara**, or **Taxamo**.
- **Payment methods:** Support wire transfers (SWIFT, IBAN), letters of credit (LC), and regional payment gateways (Alipay for China, Wise for Europe).
- **Languages:** Prioritize English, Mandarin, Spanish, German, Arabic, Portuguese based on trade volume.

---

## Payment & Trade Finance Integration

### Payment Methods for International Trade
1. **Wire Transfer (Telegraphic Transfer)**: Fast, direct bank-to-bank. Integrate with banks via **SWIFT API** or **Wise (formerly TransferWise) API**.
2. **Letter of Credit (LC)**: Secure but slow (5-15 days). Partner with banks; provide workflow for document verification (invoice, BoL, certificate of origin).
3. **Credit Card**: Via Stripe or Adyen. High fees (2.9% + $0.30 per transaction). Use for smaller orders only.
4. **Open Account**: Net 30/60/90 terms. High risk for new suppliers. Implement credit scoring and require prepayment for first order.

### LC Processing Workflow (Backend)
```
1. Buyer initiates LC request
   → Generate LC template with terms
   → Send to buyer's bank for issuance
   
2. Seller receives LC from advising bank
   → Verify LC terms (amount, documents required, expiry)
   → Accept or request amendments
   
3. After shipment
   → Gather documents (commercial invoice, bill of lading, insurance cert, certificate of origin)
   → Submit to advising bank
   
4. Bank verifies documents
   → If compliant: release payment to seller
   → If discrepant: flag issues, seller must correct or negotiate waiver
```

**Integration:** Build a document upload workflow. Store PDFs in S3, validate with OCR (AWS Textract), and trigger bank notifications via webhook.

### Trade Finance Platforms to Integrate
- **Drip Capital** (financing for exporters, integrates via API).
- **Flex Capital** (supply chain financing).
- **TradeTech platforms** like **Bolster** or **Kontainers** for digital LC workflows.

---

## API Architecture for B2B Commerce

### REST Endpoints (High-Volume, Simple Operations)
```
GET /products/{id}                      # Product details
GET /products?category=commodities&limit=50   # List with pagination
GET /inventory/{product_id}/{warehouse_id}    # Real-time stock level
GET /pricing/{product_id}?currency=EUR        # Dynamic pricing
POST /orders                             # Create order
GET /orders/{id}                         # Order status
```

### GraphQL Queries (Complex Multi-Entity Lookups)
```graphql
query {
  products(category: "commodities", limit: 10) {
    id, sku, name, description,
    pricing {
      usd, eur, gbp      # Multi-currency prices
    },
    inventory {
      warehouse: "SG-01"  # Stock in Singapore
      quantity: 500
      leadTime: "5 days"
    },
    supplier {
      name, certifications, leadTimes
    },
    compliance {
      hsCode, origin, restrictions
    }
  }
}
```

### Webhooks (Real-Time Updates)
```
POST /webhooks/order-status-changed
POST /webhooks/inventory-low
POST /webhooks/payment-received
POST /webhooks/shipment-tracking
```

**Implementation:** Use a webhook delivery service like **Svix** or build with SQS + Lambda to ensure retries and idempotency.

### Rate Limiting & Throttling
- Tier 1 (Free): 100 requests/hour.
- Tier 2 (Supplier): 10,000 requests/hour.
- Tier 3 (Buyer with contract): 50,000 requests/hour.
- Implement with **API Gateway** (AWS) or **Kong**.

### Versioning
- Use URL versioning: `/api/v1/products`, `/api/v2/products`.
- Never remove fields. Deprecate and mark as `@deprecated` in GraphQL.

---

## Database Design for Multi-Currency Product Catalogs

### Core Schema

**Products:**
```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE,
  name VARCHAR(255),
  category_id INTEGER REFERENCES categories(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  hs_code VARCHAR(10),          -- For customs/tariffs
  origin_country VARCHAR(2),    -- ISO 3166-1
  unit_of_measure VARCHAR(10),  -- kg, meters, pieces
  price_base_usd_cents INTEGER, -- Always USD, always cents
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE product_prices (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  currency VARCHAR(3),          -- 'EUR', 'GBP', 'CNY'
  price_cents INTEGER,
  minimum_order_quantity INTEGER,
  effective_date DATE,
  expires_date DATE,
  updated_at TIMESTAMP
);

CREATE TABLE inventory (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  quantity_available INTEGER,
  quantity_reserved INTEGER,
  quantity_in_transit INTEGER,
  last_stock_check TIMESTAMP
);

CREATE TABLE warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  location_city VARCHAR(100),
  location_country VARCHAR(2),
  latitude DECIMAL(9, 6),
  longitude DECIMAL(9, 6),
  lead_time_days INTEGER
);
```

**Supplier & Compliance:**
```sql
CREATE TABLE suppliers (
  id SERIAL PRIMARY KEY,
  legal_name VARCHAR(255),
  country VARCHAR(2),
  contact_email VARCHAR(255),
  payment_terms VARCHAR(50),   -- e.g., 'Net 30', 'LC'
  certifications TEXT,          -- ISO 9001, etc.
  duns_number VARCHAR(20),      -- For credit checks
  sanctioned BOOLEAN DEFAULT FALSE,
  last_screening_date TIMESTAMP
);
```

### Partitioning Strategy
- **Partition by time:** For tables with high write volumes (orders, transactions), partition by week or month.
- **Partition by region:** For inventory, partition by warehouse region (ASIA, EUROPE, AMERICAS).

**Example:**
```sql
CREATE TABLE orders (
  id SERIAL,
  customer_id INTEGER,
  total_cents INTEGER,
  created_at TIMESTAMP
) PARTITION BY RANGE (YEAR(created_at), MONTH(created_at));

CREATE TABLE orders_2026_04 PARTITION OF orders
  FOR VALUES FROM (2026, 04) TO (2026, 05);
```

### Indexing Strategy
- Index on frequently filtered columns: `sku`, `category_id`, `warehouse_id`, `created_at`.
- Use composite indexes for common queries: `(product_id, warehouse_id, created_at)` for "inventory by product and warehouse ordered by date."
- Monitor slow queries with `pg_stat_statements` and optimize.

---

## Performance & CDN Strategy

### Content Delivery
1. **Static Assets (CSS, JS, Images):** Cache indefinitely on CDN. Use content hashing for versioning.
2. **Product Pages:** Cache for 1 hour (allows price updates to propagate within 60 minutes).
3. **API Responses:** Cache for 30 seconds for read-heavy endpoints (product details, catalog).
4. **Real-Time Data (Inventory, Pricing):** No caching. Always fresh.

### CDN Optimization
- **Image optimization:** Use WebP format, responsive images, lazy-loading. Tools: Cloudflare Image Optimization, AWS Image Lambda.
- **Gzip compression:** Reduce payload by 60-70%.
- **HTTP/2 push:** Preload critical assets before the browser requests them.
- **Origin shielding:** Route requests through an extra cache layer to reduce load on origin servers.

### Regional Performance
- **Primary regions:** US (Virginia), EU (Frankfurt), APAC (Singapore).
- **Failover:** If primary region is down, auto-route traffic to secondary region.
- **Health checks:** Monitor origin servers every 10 seconds. Auto-failover on 3 consecutive failures.

---

## Third-Party Integration Architecture

### Patterns
- **Synchronous:** For immediate operations (product lookup, rate quote).
- **Asynchronous:** For long-running operations (order fulfillment, shipping label generation, customs clearance).

### ERP Integration
- **System:** SAP, Microsoft Dynamics, Sage, NetSuite, or custom.
- **Pattern:** Sync inventory via nightly batch (EDI/file) or real-time via API webhooks.
- **Data:** Product master, stock levels, supplier contracts, delivery schedules.

**Implementation:**
```
E-Commerce Platform <--(GraphQL mutation)--> Queue (SQS/RabbitMQ)
  └---> Worker Service (polls queue)
         └---> ERP API call (REST, SOAP, or EDI)
         └---> DB update on success, retry on failure
```

### CRM Integration
- **System:** Salesforce, HubSpot, Pipedrive.
- **Pattern:** Sync customer records, opportunities (RFQ), and deal stages.
- **Data:** Customer name, email, credit score, order history, negotiated terms.

### Shipping & Logistics APIs
- **Carriers:** FedEx, DHL, UPS, local carriers (Poste Italiane, DPD, etc.).
- **Pattern:** Call carrier API to get rates, generate shipping labels, fetch tracking updates.
- **Tools:** Integrations platforms like FreightPOP, ShipERP, or Pitney Bowes.

**Workflow:**
```
Order placed
  → Get shipping rates (carrier API)
  → Display options to customer
  → Customer selects
  → Generate label (carrier API)
  → Update tracking (webhook listener)
```

### Customs & Compliance Tools
- **Tariff lookup:** WITS (World Integrated Trade Solution), Harmonized Tariff Schedule.
- **Denied Party Screening:** Worldcheck (Refinitiv), Lexis Nexis, Accuity.
- **Trade documentation:** Automated BoL generation, commercial invoice, certificate of origin.
- **Tool:** Magaya, DSV, or homebrew via APIs.

**Requirement:** Flag high-risk shipments (restricted items, embargoed countries, large values) for manual review before fulfillment.

---

## Data Privacy & GDPR Technical Compliance

### Immediate 2026 Actions
1. **Verify Consent Mode v2:** If you use Google Analytics, ensure consent is properly triggered before firing pixels.
2. **Test consent UI for dark patterns:** Ensure "Reject" is as easy as "Accept". Rejection must be one click, not buried in settings.
3. **Update vendor contracts:** Reference 2025 Standard Contractual Clauses (SCCs) for EU data transfers.
4. **AI processing assessment:** If using LLM APIs (e.g., OpenAI) for product descriptions, complete a Legitimate Interests Assessment (LIA).

### Core Requirements
- **Data minimization:** Don't collect email, phone, or address unless required for order fulfillment.
- **Guest checkout:** Allow users to purchase without creating an account. Mandatory accounts are justified only for subscriptions.
- **Consent management:** Explicit opt-in for marketing. Use a CMP (Consent Management Platform) like OneTrust or Cookiebot.
- **Right to erasure:** Implement data deletion workflows. On "delete my account," purge customer data (keeping order records for legal/tax compliance, but anonymized).

### Technical Implementation
```javascript
// Example: Cookie consent check before tracking
if (window.gtag && getCookieConsent('analytics')) {
  gtag('event', 'page_view');
}

// Implement Data Subject Request workflow
POST /gdpr/data-export
  → Query all customer data
  → Generate ZIP with JSON exports
  → Email encrypted file
  → Log DSR with timestamp
```

### Data Residency
- **EU customers:** Store data in EU data centers (AWS eu-central-1, Azure North Europe).
- **China:** If operating in China, store data locally (AWS China region or Alibaba Cloud).
- **Contracts:** Ensure SPA (Sub-processor Agreement) terms for all cloud vendors.

### Retention Policies
- **Customer accounts:** Delete 12 months after account closure.
- **Payment records:** Keep 7 years (tax law requirement).
- **Logs:** Retain 90 days minimum for security. Purge older logs.
- **Cookies:** Session cookies (deleted on browser close). Persistent cookies: max 12 months.

---

## Scalability & Infrastructure Planning

### Load Testing Targets
- **Concurrent users:** Design for 5,000 simultaneous users (suppliers + buyers).
- **Peak RPS (requests/second):** 500 RPS (average), 2,000 RPS (peak during flash sale).
- **API latency:** p99 < 500ms. p95 < 200ms.
- **Database queries:** Max 100ms per query at p95.

### Horizontal Scaling Strategy
1. **Load balancer:** AWS ALB (Application Load Balancer) or Nginx.
2. **Auto-scaling group:** ECS Fargate or EKS. Scale up when CPU > 70%, down when < 30%.
3. **Database read replicas:** PostgreSQL read replicas for high-volume read queries. Write goes to primary; reads distributed to replicas.
4. **Connection pooling:** PgBouncer to manage DB connections (max 500 per app instance).
5. **Cache layer:** Redis for session storage, rate limiting counters, and frequently accessed data (exchange rates, product image URLs).

### Disaster Recovery
- **RTO (Recovery Time Objective):** 1 hour (acceptable downtime).
- **RPO (Recovery Point Objective):** 15 minutes (data loss tolerance).
- **Strategy:** Daily automated backups (S3). Multi-region failover (read replicas in secondary region).
- **Testing:** Monthly failover drills.

---

## Technical Debt Watchlist — Things That Bite You Later

1. **Floating-point currency math.** A single developer using `parseFloat` for money will cost thousands in transaction errors over time. Enforce INTEGER-only currency storage at code review.

2. **Missing index on frequently-filtered columns.** Schema grows, queries slow, nobody knows why. Add indexes proactively for any column used in WHERE, JOIN, or ORDER BY.

3. **No rate limiting on APIs.** A single malicious actor or misconfigured integration can hammer your backend and take down the platform. Implement rate limits on day one.

4. **Hardcoded API keys or credentials.** Environment variables only. Scan codebase with tools like `git-secrets` or `TruffleHog` in CI/CD.

5. **Payment processing without tokenization.** Even with a processor, if raw card data ever touches your database, you lose PCI DSS safety and exposure balloons. Always use token-based payment APIs.

6. **Missing sanctioned party screening.** A single shipment to an embargoed country is a $20,000+ fine. Screen all suppliers and customers on day one.

7. **Unencrypted customer data at rest.** Use AES-256 for sensitive fields (SSN, passport number, bank account). Store encryption keys in a vault, not in code.

8. **No audit logs.** If a supplier account is mysteriously modified or an order cancelled, you can't prove what happened. Log all sensitive actions with timestamps and user identity.

9. **Missing webhooks for async workflows.** Building polling into order processing (loop: "is the order ready yet?") will create race conditions and missed events. Use webhooks from day one.

10. **No database transaction isolation.** Concurrent updates to inventory during a flash sale can result in overselling. Use explicit locking or serializable isolation level for high-contention operations.

---

## Items the CTO Blocks

These decisions require explicit escalation and approval. Do not proceed without CTO and CEO alignment:

### 1. Payment Processing
- **No custom payment processing.** You cannot build your own payment processor. Use Stripe, Adyen, Wise, or SWIFT APIs only.
- **No storing raw card data.** If a code change touches cardholder data, CTO + Legal must review.

### 2. Data Security
- **No logging of sensitive data** (passwords, SSNs, card numbers). Detect via code review and SCA tools.
- **No exfiltration of customer data** to third-party analytics without explicit consent. GDPR fines are brutal.
- **No disabling SSL/TLS or HSTS** for "performance." These are non-negotiable.

### 3. Compliance & Legal
- **No shipments to sanctioned countries** without legal review. Violates OFAC, BIS, EU regulations.
- **No changes to privacy policy** without Legal. Users must be notified.
- **No new integrations with data brokers** or marketing vendors without privacy impact assessment.

### 4. Infrastructure
- **No direct internet access to databases.** Databases live in private subnets. Only app servers can connect via security groups/network policies.
- **No public S3 buckets** containing customer data, invoices, or shipping labels.
- **No single points of failure.** All critical services must have failover. Multi-region deployments required.

### 5. Architecture
- **No monolithic databases.** If a single table grows to 100M+ rows, partition it or move to a separate service.
- **No synchronous external API calls** in critical paths (checkout, order creation). Use async + queues.
- **No hardcoded timeouts or retries** in integration code. Make them configurable and test them.

### 6. Code Quality
- **No LLM-generated code in production** without security review. AI can miss input validation or crypto mistakes.
- **No disabling security checks** (linting, SAST, SBOM) in the CI/CD pipeline.

---

## Recommended Tech Debt Elimination Plan

Every sprint, allocate 20% of capacity to address one item from the watchlist above:

| Sprint | Focus | Rationale |
|--------|-------|-----------|
| S1-S2 | Implement rate limiting + sanctioned party screening | Risk reduction. Without these, platform is legally exposed on day 1. |
| S3-S4 | Add database indexes + connection pooling | Performance stabilization. Prevents slow-query cascades. |
| S5-S6 | Implement audit logging + alerts | Compliance + debugging. Required for incident response. |
| S7-S8 | Webhook delivery infrastructure + retry logic | Async reliability. Prevents race conditions in order processing. |
| S9-S10 | Multi-region failover + disaster recovery drills | Availability. Prevents downtime during carrier or payment processor incidents. |

---

## Key References

### Security & Compliance
- [PCI DSS v2 E-Commerce Guidelines](https://www.pcisecuritystandards.org/pdfs/PCI_DSS_v2_eCommerce_Guidelines.pdf)
- [OWASP Top 10:2025](https://owasp.org/Top10/)
- [GDPR Compliance Checklist 2026](https://formbricks.com/blog/gdpr-compliance-checklist-2025)

### Tech Stack & Architecture
- [The Top 5 Headless CMS for Ecommerce 2025 (Vendure)](https://vendure.io/resources/top-5-headless-cms-for-ecommerce-in-2025-complete-guide)
- [Best Tech Stack for E-Commerce in 2026 (WebSection)](https://www.webscension.co/tech-stack-for/e-commerce)
- [PostgreSQL Performance Optimization Roadmap 2025](https://kmoppel.github.io/2025-04-10-postgres-scaling-roadmap/)

### International Trade & Payments
- [Methods of Payment in International Trade (trade.gov)](https://www.trade.gov/methods-payment)
- [A Beginner's Guide to Letters of Credit (Impello Global)](https://www.impelloglobal.com/blog/a-beginners-guide-to-letters-of-credit-in-international-trade)
- [5 Common Payment Methods for International Trade (Statrys)](https://statrys.com/blog/int-trade-payment-methods)

### Multi-Currency & Localization
- [Architecting Global Commerce: Multi-Language & Multi-Currency (DEV Community)](https://dev.to/indianwebsiteco/architecting-global-commerce-a-developers-guide-to-multi-language-multi-currency-and-1oj8)
- [Managing Multilingual and Multi-Currency Online Stores (BitBag)](https://bitbag.io/blog/multilingual-and-multi-currency-online-store)

### Search & Performance
- [Hybrid Search for E-Commerce (Elasticsearch Labs)](https://www.elastic.co/search-labs/blog/hybrid-search-ecommerce)
- [Algolia: Ecommerce Search Solutions 2025](https://www.algolia.com/blog/ecommerce/ecommerce-search-solutions)
- [CDN Performance Benchmarks 2025-2026](https://blog.blazingcdn.com/en-us/best-cdn-of-2025-performance-benchmarks-15-providers)

### Infrastructure & Cloud
- [AWS vs Azure vs GCP: Choosing the Right Platform 2025](https://amasty.com/blog/choosing-the-right-cloud-platform/)
- [Reliability in Cloud Computing: AWS vs Azure vs GCP (SolarWinds)](https://www.solarwinds.com/blog/reliability-in-cloud-computing-aws-vs-azure-gcp-strategy-comparison)

### Integrations & APIs
- [API Integration Guide for B2B](https://www.motocoders.com/api-integration-guide/)
- [BigCommerce B2B Edition APIs](https://developer.bigcommerce.com/b2b-edition/apis)
- [Shipping & Logistics API Integration (ShipERP)](https://shiperp.com/)

---

## How to Use This Document

**Before Architecture Review:**
- Read the "CTO's First Question" section.
- Check the tech stack. Has the team chosen something outside the recommended stack? If so, justify why and document the tradeoff.

**Before Code Review:**
- Scan the "Technical Debt Watchlist" and "Items the CTO Blocks."
- If code touches payments, auth, compliance, or data security, flag for explicit review.

**During Incident Response:**
- Check the "Disaster Recovery" section for RTO/RPO and failover procedures.
- Check the "Audit Logs" section to trace what happened.

**During Scaling Challenges:**
- Check the "Scalability & Infrastructure Planning" section.
- Use the PostgreSQL design patterns to optimize queries before adding more servers.

---

**Last Updated:** April 2026  
**CTO Stamp:** Approved for production use in international trade e-commerce platforms.
