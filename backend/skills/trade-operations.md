# Trade Operations Reference Guide
**For: Operations Manager (AI Assistant), International Trade Company**  
**Updated: April 2026**

---

## Overview: End-to-End Trade Cycle

A trading company moves goods through discrete operations:
1. **Sourcing** — Find and qualify suppliers
2. **Procurement** — Place purchase orders (POs)
3. **Production / Assembly** — Supplier manufactures goods
4. **Quality Control** — Pre-shipment inspection (PSI)
5. **Freight Selection** — Choose mode (ocean, air, land)
6. **Documentation** — Prepare shipping papers
7. **Shipment Execution** — Move goods via forwarder
8. **Warehousing** — Receive and store at destination
9. **Distribution** — Final delivery to customer
10. **Payment & Reconciliation** — Invoice settlement

**Each step must be tracked with specific KPIs.** Failures in any phase destroy margins and relationships.

---

## 1. Logistics Mode Selection

### Ocean Freight (Sea)
**Cost:** $1.80–$3.20 per kg DDP (door-to-door, China to US)  
**Speed:** 20–30 days (transpacific), 30–45 days (Europe), highly variable with port congestion  
**Container types:**
- 20ft container (TEU): ~27 cbm, capacity ~18 metric tons
- 40ft container (FEU): ~67 cbm, capacity ~28 metric tons
- Cost per TEU transpacific: $800–$2,500 depending on capacity, season, carrier

**When to use:**
- Bulk commodities (grains, metals, oils)
- Heavy/bulky goods (machinery, raw materials)
- Cost-sensitive shipments where time is not critical
- Full container loads (FCL) — minimum 18–20 metric tons economical

**Key challenge:** Port congestion and tariff volatility. 2026 outlook: stable overcapacity, but geopolitical events can spike rates. Contract rate negotiations typically occur March–May.

**Incoterm strategies:**
- **FOB** (Free on Board): Seller pays to vessel; buyer pays freight + insurance. Risk transfers at ship's rail. Common for large buyers with freight contracts.
- **CIF** (Cost, Insurance & Freight): Seller pays all including minimum insurance. Buyer assumes risk once onboard. Simpler for small buyers.
- **DDP** (Delivered Duty Paid): Seller assumes all risk to final destination. Most expensive for seller but safest for buyer. Used to secure deals.

---

### Air Freight
**Cost:** $4.50–$8.50 per kg from Asia to US (2.5–5x ocean)  
**Speed:** 3–7 days door-to-door  
**Container type:** Standardized pallets (LD3, LD8, etc.), by weight/volume

**When to use:**
- High-value goods (electronics, pharmaceuticals, luxury items)
- Time-sensitive orders (emergency replenishment)
- Perishables with short shelf life
- Small quantities (< 5 metric tons) where economy of scale doesn't apply

**Key constraint:** Capacity between Asia–Europe is tight in 2026. Space is scarce; plan 4–6 weeks ahead. Air freight rates are relatively stable but availability can be constrained.

**Incoterm for air:** Typically **DDP** or **CIF** because buyer expects fast delivery and minimal friction.

---

### Land Transport (Truck / Rail)
**Cost (TL/Truckload, US domestic):** $750–$900 per 500 miles  
**Cost (LTL/Less Than Truckload, US domestic):** $220–$280 per 500 lbs  
**Speed:** 2–5 days (US domestic), 7–14 days (Mexico/Canada)  

**When to use:**
- Regional distribution within North America
- Last-mile delivery to customers
- Drayage from port to warehouse
- Nearshored or reshored inventory

**2026 trends:** Rates increasing gradually due to labor shortages and stricter compliance (ELDs, emissions). Expect 5–8% annual increases.

**Blended mode strategy:** Increasingly common — use sea to regional hub, then air or truck for final leg. Example: sea from China to Singapore, then air to US customer. Reduces total cost vs. all-air while meeting speed targets.

---

### Decision Framework

| Factor | Ocean | Air | Land |
|--------|-------|-----|------|
| **Unit Cost (low volume)** | Low | Very High | Medium |
| **Unit Cost (FCL/FTL)** | Lowest | N/A | Low |
| **Speed** | Slow (20–45 days) | Fast (3–7 days) | Medium (2–14 days) |
| **Best for** | Bulk, heavy, non-perishable | Small, high-value, urgent | Regional distribution |
| **Risk of delays** | High (ports, weather) | Low (scheduled flights) | Medium (traffic, weather) |
| **Compliance burden** | High | Very High | Medium |

**When mode is unclear:** Default to ocean if you have time (>8 weeks lead time) and volume (FCL+). Use air only if margin supports it or customer pays premium. Use land only for final-mile or regional moves.

---

## 2. Freight Forwarder Management

A freight forwarder is **not a carrier**—they are a logistics agent who coordinates transportation, negotiates rates, handles documentation, and ensures compliance.

### Forwarder Responsibilities
- **Rate negotiation** — Secure best carrier rates for ocean/air/truck
- **Booking & space confirmation** — Reserve capacity with airlines and ocean carriers
- **Documentation** — Prepare BoL, commercial invoice, CoO, export licenses
- **Customs clearance** — Navigate import/export procedures at both ends
- **Tracking & visibility** — Provide real-time shipment updates
- **Insurance coordination** — Arrange cargo insurance if needed
- **Problem resolution** — Handle delays, damaged shipments, customer disputes
- **Cost auditing** — Identify and reduce accessorial charges

### Forwarder Selection Criteria

**Network & Relationships** (Most Important)
- Partnerships with major ocean carriers (Maersk, MSC, COSCO, Hapag-Lloyd)
- Relationships with air carriers and ground handlers
- Office presence in your supplier countries AND destination markets
- Access to customs brokers in key ports

**Technology & Visibility**
- Real-time shipment tracking (GPS, EDI feeds from carriers)
- Portal access for you to monitor shipments 24/7
- Integration with your ERP/TMS system (API, EDI, or manual uploads)
- Automated alerts for exceptions (delays, damage, compliance issues)

**Cost Management**
- Transparent rate cards — know what you're paying per shipment
- Ability to consolidate shipments to reduce per-unit costs
- Service for identifying and eliminating accessorial charges (extra fees)
- Annual rate review and renegotiation process

**Service Quality**
- Response time — Must respond to urgent issues within 4 business hours
- Escalation path — If your account manager is unavailable, who handles it?
- Consistency — Same contacts for continuity; avoid high turnover
- Expertise — They should understand your industry (commodities, electronics, textiles, etc.)

**Compliance & Insurance**
- IATA certified (for air freight)
- NVOCC licensed (for ocean freight)
- C-TPAT certified (US customs compliance)
- Insurance broker relationships for cargo coverage

### Forwarder Contracts
**Essential terms:**
- Rate guarantees (e.g., locked-in rates for 12 months)
- Minimum volume commitments (often 10–20 containers/month for volume discount)
- Performance SLAs (on-time delivery target, damage rate target, documentation accuracy)
- Termination clause (e.g., 60-day notice)
- Dispute resolution (arbitration preferred over litigation)
- Technology access and support hours

**Typical structure:** 2–3 primary forwarders (redundancy), with smaller regional partners for specialty routes. Never depend on one forwarder.

### Forwarder Red Flags
- Cannot commit to SLAs or performance metrics
- No real-time tracking capability
- Poor communication (slow email responses, no proactive alerts)
- High damage rates (>2% of shipments) or frequent claims issues
- Recent changes in ownership or management
- Lack of insurance or compliance certifications
- Resistance to transparent pricing (hidden fees)

**Action:** If a forwarder shows red flags, escalate within 2 weeks. If not resolved, begin transition to backup forwarder immediately.

---

## 3. Supplier Onboarding & Qualification

### Pre-Approval Checklist

Before placing a first order, complete these steps:

#### Financial & Legal Verification
- [ ] Company registration and business license (verified against government registry)
- [ ] Financial stability check — Request last 2 years of bank statements or credit report
- [ ] Tax ID and VAT registration
- [ ] Business ownership structure (identify beneficial owners for sanctions compliance)
- [ ] Major client references (minimum 2–3 verifiable customers)
- [ ] D&B or equivalent credit report

#### Sanctions & Compliance Screening
- [ ] Check against OFAC SDN list (US Treasury)
- [ ] Check against EU sanctions lists (if applicable)
- [ ] Check against UN consolidated sanctions list
- [ ] Verify no violations of anti-corruption laws (FCPA, UKBR)
- [ ] Check for environmental or labor law violations in their jurisdiction

**Tools:** OFAC.gov, EU Commission website, UN Office of Counter-Terrorism (sanctions lists), D&B Hoover's, Creditsafe, or third-party compliance platforms.

**For trading companies:** Sanctions screening is non-negotiable. A violation can result in criminal liability and asset seizure. Never proceed without documented screening.

#### Quality & Operational Capability
- [ ] Factory tour or video inspection (if remote, request third-party PSI pre-order)
- [ ] ISO 9001 certification (or equivalent QMS) — if not certified, request quality plan
- [ ] Production capacity confirmation — Request order/delivery schedule for past 12 months
- [ ] Lead time and minimum order quantity (MOQ) — Confirm they can meet your forecast
- [ ] Communication capability — Phone, email, WhatsApp, WeChat for urgent issues

#### Trade & Export Readiness
- [ ] Confirm ability to issue export invoices, packing lists, and BoLs
- [ ] Verify export license status (some products require license from their government)
- [ ] Confirm compliance with destination country import requirements
- [ ] Understand HS codes for their products (they must be able to help classify)

#### Contract Agreement
- [ ] Master Service Agreement (MSA) or Terms & Conditions signed
- [ ] Clarity on Incoterms (FOB, CIF, DDP, etc.)
- [ ] Payment terms (typically Net 30–60 for new suppliers; prepayment for high-risk countries)
- [ ] Quality standards and rejection criteria defined
- [ ] Dispute resolution clause (arbitration in neutral venue preferred)
- [ ] IP protection clause (they don't use your specs for competitors)

**Timeline:** Allow 3–4 weeks for complete onboarding. Fast-track only if urgent, but increase monitoring post-launch.

### Ongoing Supplier Management
- **Monthly:** Track on-time delivery %, quality acceptance rate, communication responsiveness
- **Quarterly:** Review pricing, check for cost increases, confirm capacity for upcoming orders
- **Annual:** Full audit (financial health check, sanctions screening update, quality audit)

**Red flag triggers:** Missed delivery, repeated quality issues (>5% defect rate), missed communications, sudden price increases (>10%), or any change in ownership.

---

## 4. Quality Control & Pre-Shipment Inspection (PSI)

### When to Inspect
**Always** conduct PSI for:
- First orders from new suppliers
- Custom or made-to-order products
- High-value shipments (>$50,000)
- Complex assemblies with many components
- Products with safety or regulatory requirements (electronics, food, pharma)

**Conditional** PSI for:
- Repeat orders from proven suppliers (every 3rd shipment or quarterly, minimum)
- Standard catalog items from established vendors
- Low-value shipments (<$5,000)

### PSI Scope
1. **Quantity verification** — Count units, weights, and volumes match invoice
2. **Quality inspection** — Random sample of 5–10% of units (or per AQL standard)
3. **Packaging assessment** — Adequate protection for transport mode and duration
4. **Documentation review** — BoL, invoices, certificates of conformity, test reports
5. **Photo/video evidence** — Document condition of goods before shipment

### Third-Party Inspection Providers

**Top tier (global presence, premium cost):**
- **SGS** — 96,000 employees, 2,700 offices. Specializes in quality, quantity, value, compliance. Cost: $400–$1,200 per inspection (1–2 days)
- **Bureau Veritas** — 82,000 employees, 140+ countries. Strong in product compliance testing. Cost: $400–$1,200 per inspection

**Mid-tier (specialist networks, competitive pricing):**
- **QIMA** — Strong in Asia manufacturing; network of local inspectors. Cost: $250–$800 per inspection
- **Eurofins** — Labs + field inspection; good for food, pharma, chemicals. Cost: $400–$1,000

**Cost breakdown:** Factory inspection ($300–$400) + sampling/testing ($100–$400) + report ($100–$200) = $500–$1,000 typical.

**Timing:** Schedule inspection 3–4 days before shipment departure (minimum 1 week notice). For ocean freight from Asia, plan 2–3 weeks before sailing date to allow time for remediation if issues found.

### What PSI Can't Guarantee
- **Durability:** Inspection is a snapshot; doesn't predict failure after 6 months
- **Counterfeit detection:** May require forensic analysis or manufacturer verification
- **Hidden defects:** Internal components or design flaws may not be visible
- **Performance testing:** Most PSI firms don't have testing labs; request test reports from supplier separately

**Critical:** If safety or regulatory compliance is involved (e.g., electronics, food, pharma), **do not rely on PSI alone**. Require supplier to provide third-party test certificates (e.g., FCC, CE, UL, SGS test reports) **before** production.

---

## 5. Order-to-Delivery Workflow

### Timeline (Typical Asia → US Shipment)

| Phase | Duration | Owner | Deliverables |
|-------|----------|-------|--------------|
| **1. PO & Confirmation** | 1–3 days | You + Supplier | PO, order confirmation, specs reviewed |
| **2. Production** | 10–30 days | Supplier | In-process photos, production schedule |
| **3. Quality Control** | 3–5 days | QC firm | Inspection report, photos, test certs |
| **4. Shipping Logistics** | 2–3 days | Forwarder + Supplier | Booking confirmation, container info |
| **5. Port Processing** | 2–5 days | Forwarder + Port | BoL issued, vessel loading |
| **6. Ocean Transit** | 20–30 days | Carrier | Tracking #, departure/arrival alerts |
| **7. Destination Customs** | 1–3 days | Broker + Forwarder | Customs declaration, entry clearance |
| **8. Final Mile** | 2–5 days | Drayage/Truck | Delivery confirmation |
| **9. Warehouse Receipt** | 1 day | You | Physical count, damage report |
| **10. Reconciliation** | 2–5 days | Finance | Invoice match, payment release |
| **Total** | ~45–75 days | — | — |

**Critical**: Delays in production, inspection, or customs clearance can cascade. Build 20% buffer into lead times for urgent orders.

### Key Handoff Points

1. **PO Issuance** → Must include:
   - Detailed specifications (HS code, dimensions, weight, packaging)
   - Quality requirements and acceptance criteria
   - Delivery date (actual shipping date, not arrival; factor in transit time)
   - Incoterm (FOB, CIF, DDP) and payment terms
   - PSI requirement and timeline

2. **Production Kick-Off** → Confirm with supplier:
   - Raw material sourcing complete
   - Production schedule locked in
   - Any lead time items (special packaging, labels) ordered
   - Escalation contact for production issues

3. **Pre-Shipment** (2 weeks before shipping date) → With Forwarder:
   - Final shipment details (container size, weight, dimensions, HS code)
   - Incoterm and insurance needs
   - Delivery address and contact info at destination
   - Any customs documentation needed (FDA registration, energy star, etc.)

4. **Departure** → Receive from Forwarder:
   - Bill of Lading (BoL) reference number
   - Estimated Transit Time (ETA)
   - Carrier name and vessel/flight info
   - Container/seal numbers

5. **Arrival** → Forwarder provides:
   - Arrival notification
   - Customs clearance status
   - Final delivery address and scheduled arrival
   - Proof of delivery (POD)

### Root Cause Analysis Triggers

If any of these occur, stop and investigate immediately:
- **Delivery >10 days late** → What failed? Production? Port congestion? Customs hold?
- **Quality defect >5%** → Was PSI adequate? Was inspection bypassed?
- **Cost overrun >15%** → Did forwarder charges spike? Were accessorials hidden?
- **Damage >2%** → Packaging failure? Handling issue?
- **Documentation missing** → Who was responsible? Can be held up at customs.

**Document findings in lessons-learned log.** If systemic, update the process.

---

## 6. Shipping Documentation Flow

### Document Responsibility Matrix

| Document | Prepared By | Verified By | Submitted To | Timing |
|----------|------------|-------------|--------------|--------|
| **Commercial Invoice** | Supplier/You | You | Forwarder, Customs | At shipment |
| **Packing List** | Supplier | You | Forwarder, Delivery | At shipment |
| **Bill of Lading (BoL)** | Forwarder/Carrier | Forwarder | You, Buyer, Bank | After loading |
| **Certificate of Origin (CoO)** | Supplier's Chamber of Commerce | Supplier | You, Customs | Before shipment |
| **Export License** | Supplier (or government) | You | Forwarder, Customs | Before shipment |
| **Import License** | You or Broker | You | Destination Customs | Before arrival |
| **Insurance Certificate** | Forwarder's Broker | Forwarder | You, Bank (if L/C) | Before loading |
| **Inspection Report** | Third-party PSI firm | You | Forwarder, Customs | Before shipment |
| **Test Certificates** | Lab or Supplier | Supplier | You, Customs | Before shipment |

**Critical rule:** Never ship without:
1. Commercial Invoice (defines what, who, value)
2. Packing List (how it's packaged)
3. BoL or Airway Bill (proof of shipment)
4. CoO or export license (trade compliance)

---

### Document Details

#### Commercial Invoice
**Purpose:** Legal record of sale; used by customs for duty calculation.

**Must include:**
- Your company name, address, tax ID (exporter)
- Buyer name, address (importer)
- Invoice number and date
- HS codes for each line item
- Quantity, unit price, total price per line
- Total invoice value in USD (or agreed currency)
- Incoterm (FOB, CIF, DDP) and delivery location
- Payment terms (Net 30, 50% prepay, L/C, etc.)
- Signature and stamp (if required by origin country)

**Who verifies?** You must verify invoice matches your PO before goods leave supplier facility.

#### Packing List
**Purpose:** Detailed breakdown of how goods are physically packed; helps in receiving, unpacking, and damage claims.

**Must include:**
- All line items with quantities
- Box/carton/pallet breakdown (e.g., "20 units in Box 1, 30 units in Box 2")
- Individual box/carton weight and dimensions
- Gross weight and net weight (product only)
- Any special handling instructions (Fragile, This Side Up)
- Carton mark/labeling (if using numbers or codes)

**Example:**
```
Box 1-10:  Widget Model A, 50 units each = 500 units
  Dimensions: 50cm × 40cm × 30cm
  Weight: 15kg each box = 150kg total

Box 11-15: Widget Model B, 25 units each = 125 units
  Dimensions: 60cm × 40cm × 30cm
  Weight: 18kg each box = 90kg total

Total: 625 units, 24 boxes, 240kg
```

#### Bill of Lading (BoL) — Ocean Freight
**Purpose:** Legal contract between shipper and carrier; proof of shipment; needed for payment.

**Must include (forwarder prepares):**
- Shipper (your company)
- Consignee (buyer) OR "To Order" (with notify party)
- Notify party (your freight forwarder or agent at destination)
- Ocean carrier and vessel name
- Port of loading and port of discharge
- Container/seal numbers, dimensions, weight
- Freight charges and prepaid/collect status
- Terms of carriage (carrier's standard conditions)
- Signature by carrier or agent (makes it valid)

**Important variants:**
- **Straight BoL** — Non-negotiable; specific consignee only (safest)
- **Order BoL** — Negotiable; buyer can endorse to third party (flexible for financial transactions)
- **Telex Release** — Carrier releases cargo without physical BoL (faster but risky; avoid for valuable shipments)

**When issued?** After container is loaded on vessel (typically 1–2 days after departure). Forwarder transmits BoL to you immediately.

#### Airway Bill (AWB) — Air Freight
**Purpose:** Similar to BoL but for air freight; non-negotiable, non-transferable.

**Key difference:** Issued by airline or forwarder immediately upon acceptance of shipment (not at takeoff). Contains flight info, shipper, consignee, weight, value.

**Timing:** Issued within hours of shipment being handed to airline.

#### Certificate of Origin (CoO)
**Purpose:** Proves goods originated in a specific country; determines duty rates under preferential trade agreements (USMCA, EU GSP, etc.).

**Who issues?** Exporting country's Chamber of Commerce or government trade authority (local to supplier).

**Must show:**
- Country of origin
- Product description and HS code
- Quantity and value
- Shipper and consignee
- Certification stamp and signature (chamber of commerce seal)

**Cost:** $20–$50 per document. Supplier typically arranges; you pay or they bill.

**Timing:** Must be issued **before** shipment departs. Some countries require it within 2 weeks of invoice date.

**Trade implication:** If CoO is missing or wrong, goods may enter at higher tariff rate or be held at destination customs. Always verify CoO matches HS code and origin before shipment.

#### Export/Import Licenses
**When required:** Restricted products (electronics, chemicals, food, machinery, etc.) may require export license from origin country OR import license at destination.

**Examples:**
- China: Export licenses for machinery, chemicals, certain electronics
- US: Import licenses for food (FDA), electronics (FCC), hazmat
- EU: Various CE marking requirements

**Responsibility:** YOU must research if product requires license. If it does and supplier doesn't have it, **DO NOT SHIP**. Penalties are severe (cargo seizure, fines, criminal liability).

**Timing:** Can take 2–4 weeks to obtain. Must be requested at start of order if applicable.

---

## 7. Warehousing & Inventory Management

### Warehouse Location Strategy

**Hub-and-spoke model** (most common for trading companies):
- **Port warehouse** or **Free Trade Zone (FTZ)** at major ports (Los Angeles, New York, Rotterdam)
  - Purpose: Consolidate inbound shipments, defer duties, perform light assembly/QC
  - Benefit: Duty deferral until goods leave FTZ; cost savings for large importers
- **Regional distribution centers** in secondary markets (Texas, Illinois, California for US)
  - Purpose: Smaller inventory closer to customers; reduce final-mile cost
  - Benefit: Faster delivery; local supplier relationships

**Cost benchmarks:**
- FTZ warehouse: $4–$8 per pallet per month (lower because duties deferred)
- Standard warehouse: $6–$12 per pallet per month (higher because duties paid upfront)
- Distribution center: $8–$15 per pallet per month (climate-controlled, pick/pack labor included)

**When to use FTZ:**
- Import high-value products (electronics, machinery, luxury goods)
- High-touch fulfillment (need to repackage, consolidate, quality check)
- Large inventory dwell time (>30 days before sale)

**When to use standard warehouse:**
- Fast-moving inventory (turn >12x annually)
- Low-value bulk goods (commodities)
- Local/domestic distribution only

### Inventory Management Best Practices (2026)

**Real-time data accuracy:**
- Implement barcode or RFID tracking at receipt
- Reconcile physical counts monthly (not annually)
- Use ERP system as single source of truth for stock levels
- Flag discrepancies >2% immediately

**Lot and serial tracking:**
- Essential for products with recalls (electronics, food, pharma)
- Enables traceability from supplier to customer
- Critical for compliance with regulations (FDA, CE, etc.)

**Carrying cost optimization:**
- Calculate true carrying cost: (Inventory Value × Holding Cost Rate ÷ Average Inventory)
- Holding cost includes: warehouse rent, labor, insurance, obsolescence, shrinkage (~20–30% annually)
- Example: $1M inventory at 25% holding cost = $250K/year
- Target: Reduce DIO (Days Inventory Outstanding) by 15–20%

**Commodity-specific strategy:**
- **Perishables (food, pharma):** First-in-first-out (FIFO) labeling critical; limit dwell time to shelf-life limits
- **Seasonal goods:** Build inventory Q2–Q3 for Q4 peak; liquidate after season
- **Slow-moving items:** Either negotiate vendor returns or write off after 12 months
- **Precious metals / high-value:** Segregated, locked storage; full insurance

### Inventory KPIs to Track

| KPI | Target | Frequency |
|-----|--------|-----------|
| **Days Inventory Outstanding (DIO)** | <45 days | Monthly |
| **Inventory Turnover** | >8x/year | Monthly |
| **Fill Rate** | >95% | Weekly |
| **Shrinkage Rate** | <1% | Monthly |
| **Carrying Cost as % Revenue** | <15% | Monthly |
| **Obsolescence Rate** | <2% | Quarterly |

**Red flag:** If DIO exceeds 60 days, investigate excess stock and slow-moving items immediately.

---

## 8. Risk Management in Logistics

### Insurance Coverage (Cargo & Trade)

#### Cargo Insurance
**Purpose:** Covers loss or damage during transport.

**Types:**
- **All-Risk (Institute Cargo Clauses A)** — Covers all losses except war, strikes, ITIN (inherent vice). Most comprehensive. Cost: 1–3% of shipment value.
- **Institute Cargo Clauses C** — Covers basic perils (theft, sinking, collision). Minimum cover for trade finance. Cost: 0.5–1% of shipment value.
- **Voyage-specific** — One shipment only (typical for high-value or risky moves)
- **Open policy** — Annual blanket coverage for all shipments (economies of scale; good for high-volume traders)

**When required?**
- Mandatory if using CIF or DDP Incoterms (seller buys)
- Strongly recommended under FOB (buyer buys) if risk-averse
- Always for electronics, pharmaceuticals, food, machinery (inherent damage risk)

**Cost vs. Value:**
- <$50K shipment: Often self-insure (retain risk)
- $50K–$500K shipment: Buy All-Risk coverage (cost justified)
- >$500K shipment: Always insure; negotiate group rate if frequent shipper

#### Trade Finance Insurance (Export Credit Insurance)
**Purpose:** Covers non-payment risk by buyer; protects cash flow.

**Types:**
- **Single-shipment coverage** — One buyer, one transaction
- **Portfolio coverage** — Multiple buyers over 12 months
- **Insolvency insurance** — Covers if buyer goes bankrupt
- **Political risk insurance** — Covers if foreign government blocks payment (rare but critical)

**Cost:** 1–2% of invoice value. **Net benefit:** Enables longer payment terms (Net 60–90) without cash flow squeeze.

**When critical:**
- New buyer with no payment history
- High-risk country (unpredictable political/economic conditions)
- Large order relative to your company size
- Buyer requesting extended terms (>60 days)

**Providers:**
- Coface, Euler Hermes, Atradius (major commercial insurers)
- EXIM Bank (US government export credit agency; covers US exporters)

---

### Delay & Logistics Risk Mitigation

#### Common Delay Scenarios & Contingencies

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| **Port congestion** | Medium | +5–15 days | Use alternate port; shift to air; negotiate force majeure clause |
| **Carrier capacity shortage** | Medium | +10–20 days | Book 4–6 weeks ahead; use multiple forwarders |
| **Customs hold** | Medium | +2–7 days | Verify all docs 1 week pre-arrival; use broker with local customs connections |
| **Production delay** | High | +5–30 days | Weekly prod. check-ins; hold supplier financially liable for delays >5 days |
| **Damaged goods in transit** | Low | Varies | Proper packaging; cargo insurance; PSI before shipment |
| **Geopolitical disruption** | Low | +30–90 days | Monitor sanctions lists; have supplier in secondary country; force majeure clause |
| **Vessel breakdown** | Low | +7–14 days | Usually covered by carrier; cargo insurance covers loss |

**Force majeure clause (ESSENTIAL):**
```
Neither party shall be liable for delays or failures to perform 
if caused by circumstances beyond reasonable control, including 
but not limited to: war, terrorism, natural disaster, pandemic, 
government action, port strikes, vessel casualty, or act of God. 
Affected party must notify other party within 5 business days 
and provide reasonable evidence. Extension of time for performance 
shall equal duration of delay plus 15 days.
```

#### Diversification Strategy
- **Suppliers:** Never rely on one supplier for >30% of a product category
- **Forwarders:** Maintain 2–3 freight forwarders; rotate shipments quarterly
- **Ports:** If available, use alternate ports (e.g., LA + Long Beach vs. LA only)
- **Inventory locations:** Split stock between port warehouse and inland warehouse

**Cost of diversification:** ~5–10% premium on freight (less competitive rates with smaller volumes). **Worth it:** Avoids single-point failures.

---

## 9. Technology Stack for Trade Operations

### Must-Have Tools (2026)

**1. Transportation Management System (TMS)**
- **Purpose:** Central control tower for all shipments
- **Core features:** Shipment planning, carrier selection, rate shopping, tracking, exception management
- **Leading platforms (2026):**
  - **Blue Yonder** — Industry standard; AI-driven optimization; strong compliance module
  - **E2Open** — Unified TMS for global trade; customs automation; strong visibility
  - **Descartes** — Freight + customs + compliance focus; strong for complex border moves
  - **Oracle / SAP TMS** — Best if already using their ERP

- **Must-have features:**
  - Real-time tracking (GPS + carrier feeds)
  - Multi-mode support (ocean, air, road, rail)
  - Customs document automation
  - Carrier integration (rate quotes, booking, proof-of-delivery)
  - Mobile app for field visibility

**Cost:** $5K–$30K/month depending on volume and scope

**2. ERP System with Inventory Module**
- **Purpose:** Single source of truth for inventory, purchase orders, financials
- **Core features:** PO management, stock tracking, landed cost calculation, accounts payable
- **Platforms:**
  - **NetSuite** — Cloud-native; strong inventory + financials integration
  - **SAP** — Enterprise-grade; complex but comprehensive
  - **Axelor** — Open-source; good for SMEs; low cost

- **Must-have for traders:**
  - Multi-location inventory tracking
  - Landed cost rollup (freight + duty + insurance into unit cost)
  - Lot/serial tracking
  - Real-time stock visibility
  - Supplier scorecard reporting

**Cost:** $2K–$20K/month

**3. Customs & Trade Compliance Platform**
- **Purpose:** Automate document generation, verify sanctions, manage licenses
- **Leading platforms:**
  - **Descartes (ShipCompliant)** — Classifies products (HS codes), generates BoLs, checks sanctions
  - **Flex (Flexport)** — Freight + compliance; strong for importers
  - **Amber Road** — Customs focused; good for duty optimization

- **Must-have features:**
  - Automated HS code classification (machine learning)
  - Real-time OFAC/sanctions screening
  - Automated BoL/invoice generation
  - Import/export duty calculations
  - Document archival for compliance audits

**Cost:** $1K–$10K/month

**4. Visibility & Tracking Platform**
- **Purpose:** Real-time location tracking of containers and pallets
- **Options:**
  - Carrier-provided tracking (limited to their shipments; not reliable)
  - Forwarder portal (good but sometimes slow data)
  - Third-party tracking (better coverage; integrates multiple carriers)

- **Recommended:** Forwarder portal + optional third-party (FourKites, project44) for high-value shipments

**Cost:** $0 (forwarder-included) to $5K/month (premium tracking)

---

### Integration Priority

1. **TMS + ERP:** Essential for order-to-delivery visibility
2. **TMS + Customs platform:** Automates documentation
3. **ERP + Accounting (QuickBooks, Xero):** Landed cost flows to P&L
4. **All + Supplier portal:** Two-way communication with vendors

**Red flag:** If these systems don't communicate via API/EDI, you will have data entry errors and delays. Avoid manual reconciliation at all costs.

---

## 10. Key Performance Indicators (KPIs)

### Operational KPIs (Track Weekly/Monthly)

| KPI | Target | Owner | Action if Missed |
|-----|--------|-------|------------------|
| **On-Time Delivery %** | >95% | Forwarder | Root cause; 5-day corrective action plan |
| **Perfect Order Rate** | >98% | You + Supplier | Quality audit within 2 weeks |
| **Lead Time (PO to Delivery)** | Per forecast | Supplier + Forwarder | Compare to benchmark; renegotiate if systemic |
| **Damage Rate** | <2% | Forwarder + Warehouse | Investigate packaging or handling |
| **Customs Clearance Time** | <24 hours | Broker | Pre-clear docs; improve filing |
| **Document Accuracy** | >99% | Ops team | Retraining; process review |
| **Fill Rate** | >95% | Warehouse | Stock forecast vs. actual |

### Financial KPIs (Track Monthly/Quarterly)

| KPI | Target | Owner | Action |
|-----|--------|-------|--------|
| **Days Inventory Outstanding (DIO)** | <45 days | Inventory | Liquidate slow movers; reduce order size |
| **Landed Cost per Unit** | Budget ±5% | Procurement | Renegotiate freight/duty; improve sourcing |
| **Freight Cost as % Revenue** | <8% | TMS | Mode optimization; consolidation |
| **Cash Conversion Cycle (CCC)** | <60 days | Finance | Pay suppliers slower; collect faster (within reason) |
| **Cost per Shipment** | Budget ±10% | Forwarder | Audit for hidden charges; consolidate |
| **Inventory Carrying Cost** | <25% of value | Warehouse | DIO reduction; FIFO discipline |

---

## 11. Operations Manager Red Flags & Stop Conditions

**STOP all shipments and escalate immediately if:**

1. **Compliance Issue Detected**
   - Buyer or supplier appears on OFAC/sanctions list
   - Required export/import license is missing
   - Product may be under export control (dual-use goods)
   - Destination is under US/EU/UN trade restrictions
   - **Action:** Halt shipment; legal review within 24 hours. Document screening immediately.

2. **Quality Failure >5%**
   - Defect rate exceeds 5% in PSI
   - Safety-critical product failure detected
   - **Action:** Quarantine shipment; assess liability; supplier corrective action plan before next shipment

3. **Documentation Incomplete or Fraudulent**
   - Missing BoL, commercial invoice, or CoO
   - Documents don't match (e.g., invoice qty ≠ packing list)
   - Potential forgery detected
   - **Action:** DO NOT RELEASE GOODS. Alert forwarder and customs.

4. **Financial Red Flags**
   - Supplier financial collapse (bankruptcy, restructuring)
   - Buyer default or non-payment >60 days overdue
   - Unexpected cost increase >20% from forwarder
   - **Action:** Investigate with finance; may trigger insurance claim

5. **Force Majeure Event**
   - Port strike, labor action, natural disaster
   - Geopolitical event (war, sanctions escalation, coup)
   - Pandemic or health emergency affecting logistics
   - **Action:** Assess impact; communicate to buyers; invoke force majeure if applicable

6. **Delay >20% of Original ETA**
   - Vessel missed schedule; customs hold extends beyond 10 days
   - Supplier production delays >15 days without explanation
   - **Action:** Root cause analysis; escalate to CEO/board; potential customer compensation

7. **Damage or Loss in Transit**
   - Claim >$50K or >10% of shipment value
   - Widespread damage suggesting systemic packaging failure
   - **Action:** File insurance claim within 24 hours; notify carrier; require proof-of-loss documentation

8. **Carrier or Forwarder Failure**
   - Forwarder communication blackout >24 hours
   - Carrier files bankruptcy or route cancellation
   - Repeated service failures (>3 missed SLAs in 3 months)
   - **Action:** Begin transition to backup forwarder; notify affected customers

---

## 12. Operational Dashboards & Reporting

### Weekly Operations Standup

```
LOGISTICS STATUS REPORT — Week of [Date]

SHIPMENTS IN TRANSIT
├─ Shipment #[001]: Supplier X → Buyer Y
│  ├─ Status: Arrived Port [Date], Customs Clearance in Progress
│  ├─ ETA: [Date] +2 days (acceptable)
│  ├─ Issues: None
│
├─ Shipment #[002]: Supplier Z → Buyer W
│  ├─ Status: In Production (75% complete, on track)
│  ├─ ETA: Loading [Date]
│  ├─ Issues: NONE
│
└─ Shipment #[003]: Supplier A → Buyer B
   ├─ Status: Delayed +5 days (customs docs incomplete)
   ├─ ETA: [Date] if docs filed today
   ├─ Issues: ⚠️ DELAYED — Forwarder to file amended entry today

INVENTORY SNAPSHOT
├─ On Hand: [X] units across [Y] locations
├─ On Order: [Z] units (arriving [dates])
├─ Carrying Cost This Month: $[amount]
├─ Days Inventory Outstanding: [days] (target: <45)
└─ Slow Movers (not turned in 90+ days): [list]

QUALITY & COMPLIANCE
├─ Pending Inspections: [count]
├─ Recent PSI Results: [pass/fail rates]
├─ Sanctions Screening: Current (last run [date])
└─ Open Compliance Issues: None / [list]

FINANCIAL
├─ Freight Spend YTD: $[amount] vs. Budget $[amount]
├─ Average Cost per Shipment: $[amount]
├─ Supplier Payments Outstanding: $[amount]
└─ Buyer Receivables Outstanding: $[amount] (age analysis)

NEXT WEEK PRIORITIES
├─ [ ] Follow up on Shipment #003 customs clearance
├─ [ ] Approve PSI report for Shipment #004
├─ [ ] Quarterly supplier audit with Supplier X
└─ [ ] Negotiate annual rate renewal with Forwarder Y
```

### Monthly Management Review

- **Summary:** Top 3 successes, top 3 failures, financial impact
- **Metrics:** On-time delivery %, quality rate, cost variance, cash cycle
- **Forecast:** Orders in next 30/60/90 days, inventory projections
- **Risks:** Upcoming compliance issues, supplier concerns, geopolitical
- **Action items:** Changes needed for next month

---

## 13. Lessons Learned Log Template

Use this to document every significant issue, fix, and process improvement:

```
L-001 | SUPPLIER FINANCIAL SCREENING FAILURE
Root Cause: Did not verify D&B before first order; supplier had outstanding tax liens
Fix: Now run D&B + sanctions check for ALL new suppliers before PO approval
Rule: No exceptions — screening is required, no "fast track" onboarding
Impact: Prevented $150K loss when supplier was later seized by government

L-002 | PSI CUTOFF TIMING
Root Cause: Arranged PSI 2 days before shipment; inspector couldn't access factory quickly enough
Fix: Schedule PSI 7–10 days before sailing date; allows time for rework if needed
Rule: No PSI within 3 days of shipment departure; minimum 1-week notice
Impact: Reduced quality issues by 30%; no last-minute delays

L-003 | FORWARDER RATE TRANSPARENCY
Root Cause: Forwarder added $5K in "accessorial charges" at last minute (fuel surcharge, port fees)
Fix: Require all-in rate quotes with zero hidden fees in forwarder contract
Rule: Any charge >2% of base freight must be pre-approved; new charges require 30-day notice
Impact: Saving $3K+ per month after renegotiation

```

---

## Summary: Operations Manager Playbook

**Your job:**
1. Ensure every order flows from supplier to customer on time, on budget, compliant, and without damage
2. Flag risks before they become problems
3. Build relationships with suppliers, forwarders, and customs brokers (these are your operational foundation)
4. Measure everything; optimize continuously
5. Learn from every mistake; codify the lesson

**Key rules:**
- **Compliance is non-negotiable.** When in doubt, consult legal.
- **Supplier quality and stability matter more than unit price.** A cheap supplier who fails costs 10x more.
- **Real-time data beats intuition.** Use your TMS, ERP, and dashboards—don't guess.
- **Diversify everything.** Never be dependent on one supplier, forwarder, or port.
- **Communicate early and over-communicate.** Buyers and suppliers need to know status, risks, and delays ASAP.

**Red flag trigger:** If a pattern repeats (same supplier late 3 times, same forwarder error 2 times, etc.), stop and redesign the process. Don't accept "it happens."

---

## References & Further Reading

- [Ivalua Supply Chain Management 2026](https://www.ivalua.com/blog/supply-chain-management-strategies-best-practices-for-2025/)
- [KPMG Supply Chain Trends 2026](https://kpmg.com/xx/en/our-insights/operations/supply-chain-trends-2026.html)
- [LooperBuy Ocean Air Freight 2026 Guide](https://looperbuy.com/blog/ocean-and-air-freight-the-2026-b2b-experts-guide-to-comparing-costs-speed-and-smarter-shipping-from-china.html)
- [Xeneta 2026 Ocean Outlook](https://www.xeneta.com/hubfs/2026%20Ocean%20Outlook.pdf)
- [Legacy SCS International Freight Forwarding Guide](https://legacyscs.com/international-freight-forwarding-guide/)
- [US Trade.gov Common Export Documents](https://www.trade.gov/common-export-documents)
- [Maersk Shipping Documentation Guide](https://www.maersk.com/logistics-explained/shipping-documentation/2023/09/27/shipping-documents-us)
- [Freightos Incoterms 2026 Guide](https://www.freightos.com/freight-resources/incoterms-plain-english-freight-shipping-guide/)
- [Trade Finance Global Incoterms Guide](https://www.tradefinanceglobal.com/incoterms/choosing-the-right-incoterm/)
- [QIMA Pre-Shipment Inspection Guide](https://blog.qima.com/inspection/best-pre-shipment-inspection-companies)
- [NetSuite Supply Chain KPIs & Metrics](https://www.netsuite.com/portal/resource/articles/erp/supply-chain-kpis-metrics.shtml)
- [GoRamp Supply Chain KPIs 2026](https://www.goramp.com/blog/supply-chain-kpis)
- [SelectHub Best TMS Software 2026](https://www.selecthub.com/c/tms-software/)
- [Gartner Magic Quadrant TMS 2026](https://www.gartner.com/en/supply-chain/research/supply-chain-top-25)
- [FreightAmigo Trade Finance Insurance 2026](https://www.freightamigo.com/en/blog/trade-finance/export-credit-insurance-vs-bank-guarantees-2026-safer-faster/)

