# Trade CFO Reference: Financial Decision Framework

**Purpose**: This is a reference document for AI advisors evaluating financial decisions for an international trade company. It covers the economic fundamentals of trade finance, pricing frameworks, risk management, and the specific checks a CFO must run before approving any deal, payment structure, or financial commitment.

**Audience**: Internal AI agent advising on finance, pricing, deal structures, working capital, and risk.

---

## I. Economic Model Overview

An international trade business operates on three capital cycles:

1. **Purchase Cycle**: Pay supplier (Day 0) → Receive goods (Day N) → Revenue from sale (Day M)
2. **Payment Cycle**: Commit payment terms to buyer → Collect cash
3. **Working Capital Cycle**: Gap between outflow (to suppliers/logistics) and inflow (from buyers)

The business only survives if:
- **Gross margin** (revenue – cost of goods – freight/insurance) > operating costs
- **Cash conversion cycle** (time to sell + time to collect – time to pay suppliers) fits available working capital
- **Currency exposure** is hedged or accepted explicitly

### Key Formula: Landed Cost
```
Total Cost to Customer = [Product Cost + Freight + Insurance + Customs Duty + 
                         Import VAT/GST + Brokerage Fees + Inland Transport + 
                         Storage + Handling] ÷ Incoterm Cost Responsibility
```

**Critical**: Do not quote or price until landed cost is fully calculated. A 10% tariff increase can wipe out a 5% margin.

---

## II. Trade Finance Instruments: Decision Matrix

### A. Letters of Credit (LC)

**How It Works**
- Importer's bank issues binding commitment to pay exporter if documents comply with LC terms
- Exporter ships goods, presents compliant documents, bank verifies and pays
- Bank assumes credit risk (not the importer)

**When to Use**
- High-value transactions (>$50K USD)
- First-time suppliers with limited credit history
- High-risk jurisdictions or when importer creditworthiness is unknown
- When importer needs to establish payment credibility with exporter

**Risk Profile**: LOW for exporter, LOW-MEDIUM for importer

**Typical Costs**
- Issuance fee (charged to importer): 0.75%–1.5% of LC value
- Amendment fee (per change): $100–$500 per bank
- Confirmation fee (if needed): 0.5%–1.0% of LC value
- Advising fee (charged to exporter): $100–$300 flat or % of value

**Example**: $100K shipment with 1% LC fee = $1,000 cost to importer (added to deal cost)

**Variants**
- **LC at Sight**: Payment immediately upon document presentation
- **Deferred Payment LC**: Payment 30/60/90 days after document presentation (importer gets credit period)
- **Revocable LC**: Bank can cancel (avoid—only use irrevocable/confirmed)

**CFO Check**
- Does the LC cost justify the risk reduction for this deal?
- Is the exporter creditworthy enough to skip the LC?
- Will the importer accept the 1%+ fee increase, or should we absorb it?

---

### B. Documentary Collections (D/P, D/A)

**How It Works**
- Exporter ships goods, documents go through importer's bank (not a direct commitment like LC)
- Bank releases documents only when buyer completes payment (D/P) or accepts draft (D/A)
- No bank guarantee; bank only acts as intermediary

**D/P (Documents Against Payment)**
- Buyer must pay immediately to receive documents and take possession of goods
- Risk: Importer can refuse to pay and goods sit at port
- Cost: $200–$500 collection fee per bank

**D/A (Documents Against Acceptance)**
- Buyer accepts time draft; bank releases documents; buyer pays on agreed date
- Risk: Buyer may not pay at maturity
- Cost: $200–$500 collection fee per bank

**When to Use**
- Repeat suppliers with established relationships (lower risk)
- When LC cost (1%+) is unjustifiable but cash-in-advance unacceptable
- Medium-value transactions ($10K–$50K)
- When importer has moderate credit standing

**Risk Profile**: MEDIUM for exporter (payment risk), LOW for importer

**Typical Costs**: $200–$500 per collection + wire fees

**CFO Check**
- Does the importer have documented payment history?
- Can we absorb 30–60 day payment delays if buyer accepts the draft?
- What's the fee vs. the margin? (e.g., $300 fee on $5K margin = 6% of profit)

---

### C. Open Account (Net 30/60/90)

**How It Works**
- Exporter ships goods on credit terms; buyer receives goods immediately
- Buyer pays after agreed period (30, 60, or 90 days)
- No bank guarantee; pure credit extension

**When to Use**
- Repeat customers with strong payment history
- Transactions under $25K where LC/collection cost is high relative to margin
- Market-standard terms to stay competitive
- When buyer is creditworthy and relationship is strategic

**Risk Profile**: HIGH for exporter (payment/credit risk), NONE for importer

**Typical Costs**: None directly, but cost of credit (carry cost)
- If you finance the $100K shipment at 5% annual rate for 90 days: ~$1,250 in carry cost

**CFO Check**
- Is this buyer in our credit database with clean history?
- Can we absorb 90-day payment delay if they default?
- What percentage of revenue is outstanding at any time?
- Do we have insurance (trade credit insurance) to cover default?

---

### D. Cash in Advance (CIA) / Wire Transfer (T/T)

**How It Works**
- Buyer wires payment before shipment is arranged
- Exporter receives funds in advance, eliminates all credit risk

**When to Use**
- New suppliers with zero credit history
- High-risk jurisdictions (sanctions exposure, unstable currency)
- Time-sensitive goods (perishables, seasonal items)
- Buyer insists or margins are razor-thin

**Risk Profile**: ZERO for exporter, HIGH for importer

**Typical Costs**: Wire fees ($15–$50) + currency conversion spread (0.5%–2%)

**CFO Check**
- Is the buyer creditworthy enough that CIA is the only option?
- Will CIA pricing be accepted, or will we lose the deal?
- What's the ITAR/export control status of the goods?

---

### E. Trade Credit Insurance

**How It Works**
- Insurance company guarantees payment if buyer defaults (protects against non-payment)
- Covers open account transactions
- Exporter continues to extend credit; insurance pays claim if buyer fails to pay

**When to Use**
- Open account terms for large/repeat orders
- Moderate-risk buyers (good history but some concern)
- To justify aggressive payment terms without credit risk

**Typical Costs**: 0.5%–2% of transaction value
- Example: $100K sale on Net 60 with 1% insurance = $1,000 annual premium

**Coverage Limits**: Usually 80%–95% of invoice value

**CFO Check**
- Is the buyer profile suitable for insurance underwriting?
- Does the insurer have exclusions (embargo countries, specific industries)?
- What's the deductible and claims process?

---

## III. Landed Cost Calculation Framework

### Components (in order of calculation)

1. **Product Cost** (per Incoterm basis—EXW, FOB, CIF, DDP)
2. **Ocean/Air Freight** (FCA, FOB, CIF, DDP stages)
3. **Insurance** (during transit—usually 1.5%–2.5% of CIF value)
4. **Customs Duty** (tariff rate for HS code × (Product + Freight + Insurance))
5. **VAT/GST** (applied to dutiable value in importing country—ranges 15%–25%)
6. **Import Processing Fees** (Merchandise Processing Fee in US ~0.3427%)
7. **Brokerage Fees** (customs clearance—$150–$500 per shipment)
8. **Port/Terminal Handling** (loading/unloading—$50–$200 per container)
9. **Inland Transportation** (origin port to warehouse—$100–$500 per shipment)
10. **Storage/Demurrage** (if delayed—$100–$500/day)

### Example: $100,000 FOB Import

```
FOB Price (Shanghai port):                    $100,000
Ocean Freight (Shanghai → Los Angeles):       +$3,000
Insurance (1.25% × $103,000):                 +$1,288
Subtotal CIF value:                           $104,288

Customs Duty (10% tariff):                    +$10,429
Subtotal dutiable value:                      $114,717

VAT/GST (20% × $114,717):                     +$22,943
Merchandise Processing Fee (0.3427%):         +$394
Customs Brokerage:                            +$300

Port handling, inland freight, storage:       +$500
Total Landed Cost:                            $139,283

Unit Cost (if 1000 units):                    $139.28/unit
```

**Critical Landed Cost Risks**
- **Tariff reclassification**: Item classified as 10% duty but actually 25% → sudden margin erosion
- **Duty rate changes**: Tariffs increased mid-shipment (buyer bears risk under FOB; we do under CIF)
- **Volumetric surcharges**: Freight increases if dimensional weight exceeds actual weight
- **Currency fluctuation**: If priced in USD but freight invoice in CNY, unhedged exposure
- **Demurrage**: Delayed inspection = extra $100–$500/day storage

### CFO Checkpoints
- [ ] **Tariff Rate Verification**: Confirm HS code classification with customs broker (not a guess)
- [ ] **Freight Quote Lock**: Lock freight cost in writing before committing price to buyer
- [ ] **Currency Exposure**: If paying supplier in CNY but freight/insurance in USD, hedge or account for 2%–5% variance
- [ ] **Duty Pass-Through**: Clarify: does buyer absorb duty increase mid-deal?
- [ ] **Insurance Coverage**: Confirm cargo value insured for full landed cost, not just FOB value

---

## IV. Incoterms 2020: Cost & Risk Allocation

**Remember**: Incoterms only define POINT OF RISK TRANSFER. They don't prevent further negotiations on who pays what.

| Incoterm | Seller Pays | Buyer Pays | Risk Transfer | Best For |
|----------|-------------|-----------|----------------|----------|
| **EXW** (Ex Works) | Product only | Everything after origin point | At seller's door | Buyer arranges all logistics; minimal seller liability |
| **FCA** (Free Carrier) | Product + delivery to carrier | Freight, insurance, duty, import tax | At named carrier location | Buyer's freight forwarder arranges pickup |
| **FOB** (Free on Board) | Product + inland freight + loading | Ocean freight, insurance, duty, tax | Ship's rail at origin port | Exporter responsible for loading; buyer arranges ocean freight |
| **CIF** (Cost, Insurance, Freight) | Product + freight + insurance to destination port | Unloading, duty, import tax | Ship's rail at origin port (!) | Common for bulk/commodity; exporter covers ocean leg |
| **DDP** (Delivered Duty Paid) | Everything except unloading | Unloading only (if buyer wants) | At buyer's warehouse | Exporter takes all risk/cost; most buyer-friendly |

### Pricing Impact Example (1000 units @ $10 FOB Shanghai)

```
EXW Shanghai:              $10.00/unit  (product only)
FOB Shanghai:              $13.00/unit  (+inland + loading: $3)
CIF LA:                    $14.50/unit  (+ocean $1.50)
DDP LA (with duty/tax):    $18.00/unit  (+duty/VAT/fees $3.50)
```

### CFO Risk Flags by Incoterm

**EXW**
- ⚠️ Buyer controls shipping; if goods damaged in transit, we may face warranty claims (Incoterm says risk transfers, but buyer may sue anyway)
- ⚠️ Lowest price; high volume-seller leverage

**FOB**
- ⚠️ Risk transfers at ship's rail; if goods damaged during ocean transit, buyer claims on insurance (if insured)
- ⚠️ Buyer arranges ocean freight; if freight is expensive, buyer may blame us for "not warning them"
- ✓ Standard for commodity trade

**CIF**
- ⚠️ **Dangerous**: Risk transfers at ship's rail, but WE pay for insurance
- ⚠️ If goods damaged in transit, buyer claims against insurance WE arranged; if claim denied, buyer's recourse is against us
- ✓ Covers our cost risk, but not legal/warranty risk

**DDP**
- ⚠️ We assume ALL risk until goods are in buyer's warehouse
- ⚠️ Duty miscalculation, customs delays, demurrage—all our problem
- ✓ Highest margin but highest exposure

### CFO Guidance
- **Default to FOB for new suppliers** (clear risk boundary; buyer arranges logistics)
- **Use CIF only if we have freight/insurance relationships** (don't outsource risk if we can't manage it)
- **Never quote DDP unless** we have customs clearance in-house and can absorb duty miscalculations
- **Verify Incoterm in contract** explicitly; don't assume buyer interprets it the same way

---

## V. Currency Risk Management

### Exposure Scenarios

**Scenario A: Importer (Buyer)**
- Contract price: $100K USD
- Supplier cost: 700K CNY
- Exposure: If CNY appreciates (750K → 680K CNY/$100K USD), we save money
- If CNY depreciates (700K → 780K CNY/$100K USD), we lose money

**Scenario B: Exporter (Seller)**
- Contract price: $100K USD
- Customer pays 60 days later
- Exposure: If USD weakens vs. our home currency, revenue declines in local terms
- If USD strengthens, we gain

### Hedging Strategies

#### 1. **Forward Contract (Most Common)**
- Lock in exchange rate today for delivery in 30/60/90 days
- Cost: Carry cost (interest rate differential between currencies)
  - If lending USD is 5% annual and lending CNY is 3%, "carry" = +2% per year
  - For 90 days: +0.5% cost to lock forward rate
- Best for: Specific transactions with firm dates

**Example**
```
Today: Spot rate USD/CNY = 7.00
Need: 700K CNY in 90 days
Forward contract locks: 7.05 (paying 0.5% carry)
Cost: 700K / 7.00 = $100K vs. 700K / 7.05 = $99.3K
Premium paid: $700 for certainty
```

#### 2. **Natural Hedging**
- Match inflows and outflows in same currency
- Example: Buy commodities in USD, sell in USD; no hedge needed
- Cost: None, but requires operational alignment

#### 3. **Options (Expensive)**
- Pay premium upfront for right (not obligation) to exchange at set rate
- Cost: 1%–3% of notional value
- Best for: High uncertainty (buyer may cancel)

#### 4. **Netting**
- Combine multiple transactions in same currency
- If buying 500K CNY and selling 400K CNY, net position is 100K CNY owed
- Cost: Depends on netting terms

### CFO Hedging Policy
- [ ] **Hedging Threshold**: Hedge any single-currency position >$50K or >5% of cash reserves
- [ ] **Hedging Horizon**: Hedge forward 30–90 days; don't lock rates 6+ months (cost/liquidity risk)
- [ ] **Acceptable Carry Cost**: Don't pay >1% carry for hedges (defeats margin on small deals)
- [ ] **Rebalance Monthly**: Review positions; close hedges if exposure is resolved

**Typical Carry Costs (2025)**
- USD/CNY: +0.3%–0.5% per 90 days
- EUR/USD: -0.1%–+0.2% (depends on Fed/ECB rates)
- USD/INR: +0.8%–1.2% (higher interest rate differential)

---

## VI. Payment Terms Decision Matrix

**Rule**: Choose payment terms based on BUYER RISK + MARGIN + COMPETITION

| Buyer Profile | Recommended Terms | CFO Condition |
|---------------|--------------------|---------------|
| **Tier 1: Repeat customer, A+ credit, major account** | Net 60–90 | Hold net outstanding <30% of revenue |
| **Tier 2: Established account, good history** | Net 30–60 | Verify credit quarterly; cap at $250K per account |
| **Tier 3: New supplier, unknown credit** | LC at Sight or DP | Require bank confirmation or D/P collection |
| **Tier 4: Spot/transactional, risky geography** | CIA or FOB with LC | Payment before shipment arranged |
| **Tier 5: Government/SOE buyer, slow payer** | LC 90/120 days or partial CIA | Structure as: 30% CIA, 70% LC at 90 days |

### Payment Terms Definition

**T/T (Telegraphic Transfer / Wire)**
- Payment by wire; no documents
- Fastest but highest risk to buyer (funds gone, goods not verified)
- Use for: spot trades, repeat customers

**LC at Sight**
- Bank pays importer's bank when compliant documents presented
- Faster than deferred LC (typically 5–7 days)
- Use for: first-time suppliers, high-value deals

**Net 30/60/90**
- Open account; buyer pays 30/60/90 days after invoice
- Requires credit approval
- Use for: repeat customers, competitive markets

**DP (Documents Against Payment)**
- Bank releases documents only when buyer pays
- Slower than LC (7–14 days depending on processing)
- Use for: moderate-trust suppliers, medium values

**DA (Documents Against Acceptance)**
- Bank releases documents when buyer accepts draft; payment due at maturity
- Creates floating payment obligation; buyer has goods before paying
- Risk: Buyer may refuse payment at maturity
- Use for: established relationships, 30–60 day terms acceptable

### CFO Approval Checklist for Payment Terms

Before committing to any payment terms:

- [ ] **Buyer Credit Rating**: Check D&B / credit bureau / payment history
- [ ] **Deal Margin**: Calculate: Is margin >payment term cost? (e.g., Net 90 at 5% carry ≈ 1.25% cost)
- [ ] **Cash Flow Impact**: Will outstanding receivables exceed 30% of monthly revenue?
- [ ] **Default Scenario**: If buyer defaults on Net 60, can we absorb the loss?
- [ ] **Competitive Pressure**: Are we matching market terms or creating a pricing disadvantage?
- [ ] **Currency Risk**: If buyer pays in foreign currency, is it hedged?
- [ ] **Insurance Coverage**: Is this transaction covered by trade credit insurance?

---

## VII. Margin Analysis & Benchmarks

### Typical Gross Margins by Sector (2025)

These are ranges; actual margins depend on volume, supplier relationships, and market conditions.

| Commodity / Sector | Typical Gross Margin | Notes |
|-------------------|---------------------|-------|
| **Bulk Agricultural** (grain, oils) | 2%–5% | High volume, low margin; tight supply chains |
| **Raw Materials** (metals, minerals) | 3%–8% | Commodity-priced; margin in volume and logistics efficiency |
| **Chemicals/Fertilizer** | 5%–12% | More processing; less commodity-like; buyer relationships matter |
| **Manufactured Goods** (textiles, machinery) | 8%–25% | Brand, quality, lead time matter; buyer captivity higher |
| **Electronics/Components** | 10%–20% | Higher value; quality/specs critical; inventory risk high |
| **Food/Beverage** | 12%–30% | Regulatory compliance costs; brand margins higher; perishable risk |
| **Consulting/Services** | 25%–60% | Knowledge-based; lowest capital requirement |

**Important**: Gross margin ≠ Net Margin
- Gross margin: Revenue – COGS – Freight – Duty
- Net margin: Gross margin – Operating Expenses (salaries, office, tools, insurance)
- Trade finance costs eat 1%–2% of gross margin
- Working capital financing (if extended terms) eats another 0.5%–1.5%

**Example: Grain Import Deal**

```
Revenue:                                   $1,000,000
COGS (product):                           -$950,000
Freight/Insurance/Duty (4% of revenue):    -$40,000
Gross Profit:                              $10,000  (1% gross margin)

Less: Trade finance costs (LC 1%):         -$10,000
Operating expenses (est 0.5%):             -$5,000
Net Profit:                                -$5,000  (LOSS)
```

**This deal loses money.** Reject or renegotiate.

### CFO Margin Guardrails

- [ ] **Minimum Gross Margin**: 3%–5% depending on sector (commodities vs. goods)
- [ ] **Maximum Outstanding Receivables**: 30% of monthly revenue
- [ ] **Payment Term Cost Cap**: Term cost <50% of gross margin
- [ ] **FX Hedging Cost**: <1% of gross margin
- [ ] **Trade Finance Cost**: <2% of gross margin
- [ ] **Minimum Deal Size**: Don't process deals <$25K (fixed LC costs too high)

**Margin Erosion Red Flags**
- Customer demands Net 90 but we pay suppliers COD → financing gap
- Freight surge hits 15% (usual 3–4%)
- Tariff increases mid-deal; buyer won't absorb
- Currency weakens; customer quotes in local currency (unhedged exposure)

---

## VIII. Working Capital Management in Trade

### Cash Conversion Cycle (CCC)

**Formula**: DIO + DSO – DPO
- **DIO** (Days Inventory Outstanding): Avg days goods sit before sale
- **DSO** (Days Sales Outstanding): Avg days to collect payment after sale
- **DPO** (Days Payable Outstanding): Avg days before we pay suppliers

**Example**
```
We buy inventory, wait 30 days to sell (DIO = 30)
After sale, customer pays in 60 days (DSO = 60)
We pay suppliers in 30 days (DPO = 30)

CCC = 30 + 60 – 30 = 60 days
Interpretation: We need cash for 60 days before getting paid by customer
If order is $100K, we need $100K available for 60 days to fund the deal
```

### Working Capital Financing

If CCC is 60 days and we do $100K/month in transactions:
- Cash tied up: $100K × (60/30) = $200K at any time
- If we can't finance with suppliers (DPO), we need external financing
- Financing cost at 5% annual: $200K × 5% ÷ 12 = $833/month

### Optimization Strategies

1. **Reduce DIO** (sell faster)
   - Offer discounts for quick pickup
   - Reduce safety stock
   - Negotiate consignment with suppliers (move DPO later)

2. **Reduce DSO** (collect faster)
   - Offer 2% discount for payment within 10 days instead of 60
   - Use LC at Sight instead of Net 60
   - Use factoring (sell receivable to factor at discount)

3. **Extend DPO** (pay slower, without damaging supplier relationship)
   - Negotiate payment terms with suppliers
   - Use supply chain financing (supplier gets paid early via bank, we get extended terms)
   - Risk: Supplier may increase prices if terms extend

### Working Capital CFO Checks

- [ ] **CCC Target**: Aim for <45 days (less cash tied up)
- [ ] **Cash Reserve**: Keep 30% of monthly operating expenses in liquid reserves
- [ ] **Outstanding Receivables**: Never exceed 40% of annual revenue
- [ ] **Supplier Payment Behavior**: Track which suppliers offer discounts for early payment (often 2% for 10 days)
- [ ] **Seasonal Timing**: In Q4 (high volume), ensure working capital financing is arranged in Q3
- [ ] **Factoring Feasibility**: Can we factor receivables if we need emergency cash? (Cost: 2%–4% of invoice value)

---

## IX. Tax Considerations in International Trade

### Transfer Pricing

**Definition**: Price at which a company transfers goods/services to its own subsidiary/related entity in another country.

**Rule**: Transfer price must reflect "arm's length" principle—i.e., the price an independent third party would charge.

**Risk**: If tax authorities believe transfer price is artificially low, they can:
- Increase our taxable income in home country
- Impose penalties (10%–40% of unpaid tax)
- Initiate double-taxation disputes

**CFO Policy**
- Document transfer pricing logic with comparable prices from independent suppliers
- File transfer pricing documentation with tax return
- Example: If we buy from unrelated supplier for $100/unit, our transfer price should be $95–$105/unit (not $50)

### VAT/GST Treatment

**Rule**: VAT/GST is a consumption tax; tax is paid in country of consumption.

**Import Transaction Example** (US importer buying from China)
```
Product cost (FOB):           $100
Freight/Insurance:            $5
Duty (import tax):            $10
Subtotal (dutiable value):    $115

VAT (0% in US—sales tax instead): $0
[Note: US has no VAT; states charge sales tax on final sale]

Importer pays:                $115 total
Importer sells for:           $150
Importer charges sales tax:   $12 (8% of $150, varies by state)
```

**Export Transaction** (US exporter selling to EU)
```
Sales price (DDP):            $150
EU VAT (20%):                 $30
EU buyer pays:                $180

US exporter:
- Collects $180
- Pays $30 VAT to EU tax authority
- Nets $150
- No VAT on export from US (zero-rated export)
```

**CFO Policy**
- [ ] **Landed Cost Includes Local VAT**: When calculating landed cost for imports, include destination country VAT
- [ ] **VAT Recovery**: Ensure we claim VAT recovery on business inputs (imports, transport, services)
- [ ] **Export Zero-Rating**: Ensure export transactions are zero-rated in destination (claim VAT relief if export qualifies)
- [ ] **Documentation**: Keep invoices, bill of lading, proof of export for VAT compliance

### Withholding Taxes

**Definition**: Tax withheld by payer on certain cross-border payments (interest, royalties, dividends, management fees).

**Example**
```
US company owes UK company $100K consulting fee
Standard withholding tax: 30% on non-resident payments
UK company receives: $70K (withholding retained by US payer or tax authority)
```

**CFO Policy**
- [ ] **Treaty Benefits**: Verify if countries have tax treaty; treaty rates are usually lower (e.g., 10% instead of 30%)
- [ ] **Form W-8BEN**: Non-US vendors should provide W-8BEN to claim treaty rates
- [ ] **Estimate on Invoices**: Quote assumes after-withholding amount unless client handles withholding

### Duty Drawback & Bonded Warehouses

**Duty Drawback**: Refund of tariffs paid on imports if goods are re-exported.
- Example: Import steel for $100K, pay $10K duty, re-export; claim $10K refund
- Claim process: 1–3 years; requires detailed documentation
- Use for: If we import components, assemble, and re-export

**Bonded Warehouse**: Goods stored without paying duties until they enter commerce.
- Useful for: Time delay (goods stay in warehouse, duties deferred)
- Cost: Warehouse fees ($100–$300/month)
- Use if: Uncertain when goods will sell, want to defer duty payments

---

## X. CFO Decision Checklist: Before Approving Any Deal

### Pre-Deal Approval (Tier 1)

- [ ] **Buyer Credit Check**: D&B report or credit bureau. Minimum score?
- [ ] **Landed Cost Verified**: Tariff code confirmed by broker, not guessed. Freight quote locked in writing.
- [ ] **Margin Calculation**: Gross margin ≥ sector minimum (3%–5%). Operating costs covered?
- [ ] **Currency Exposure**: If deal is in foreign currency, is it hedged or accepted consciously?
- [ ] **Payment Term Financeable**: If Net 60, can we absorb 60-day payment delay + carry cost?
- [ ] **Incoterm Risk**: Is Incoterm (FOB/CIF/DDP) appropriate? Do we understand risk transfer?
- [ ] **Working Capital Impact**: Will outstanding receivables exceed 40% of annual revenue?

### Deal Execution (Tier 2)

- [ ] **Contract Includes**:
  - Specific Incoterm and responsibility for tariff changes
  - Payment terms, payment method (LC, DP, Net X)
  - Dispute resolution (arbitration, jurisdiction)
  - Warranty/quality standards
  - Force majeure clause
  - Shipping dates and delivery windows
- [ ] **Compliance Verified**: No sanctions, ITAR, or export control issues? Trade Compliance Officer review.
- [ ] **Insurance Arranged**: Cargo insurance in place before shipment. Amount covers full landed cost.
- [ ] **Supplier PO Confirmed**: Price locked with supplier. Delivery timeline matches buyer expectation.

### Payment Processing (Tier 3)

- [ ] **Payment Method Secured**: If LC, confirmed and correct documents specified. If DP/DA, collection initiated.
- [ ] **Invoice Accuracy**: All details match contract (quantity, specs, price, Incoterm, payment terms).
- [ ] **Shipping Documents Prepared**: Bill of lading, commercial invoice, packing list, certificates (if required).
- [ ] **Duty Declarations Filed**: Customs entry filed; estimated duties calculated; variance identified.

### Post-Delivery (Tier 4)

- [ ] **Goods Received Acknowledged**: Buyer confirms receipt; no damage/shortage claims pending.
- [ ] **Payment Collected**: If open account, invoice due date tracked; follow-up on overdue accounts.
- [ ] **Claims Resolved**: Any damage claims, tariff adjustments, or disputes settled.
- [ ] **Lessons Logged**: Any cost overruns, delays, or issues documented for future deals.

---

## XI. Red Flags: CFO Blocks & Escalations

### STOP & ESCALATE (Immediate CFO Hold)

🛑 **No Deal if Any of These Are True**

1. **Unknown Buyer in High-Risk Jurisdiction**
   - Buyer is first-time, no credit history, located in country on OFAC/sanctions list
   - Action: Require CIA or LC at Sight + compliance review before proceeding

2. **Margin Too Thin to Support Terms**
   - Gross margin <2% in bulk commodities or <5% in manufactured goods
   - Payment term financing cost eats >50% of margin
   - Action: Renegotiate price or payment terms, or walk away

3. **Landed Cost Calculation Incomplete**
   - Tariff code not confirmed (guessing)
   - Freight cost not locked in writing
   - Currency exposure unhedged on deals >$250K
   - Action: Halt deal until all costs verified

4. **Supplier Payment Misaligned**
   - We pay supplier Net 30, but buyer pays Net 90
   - Working capital gap = $XXX for 60 days; not financeable
   - Action: Negotiate supplier terms or reduce buyer terms

5. **Contract Missing Critical Clauses**
   - No Incoterm specified (who bears tariff risk if rates change?)
   - No force majeure (what if supplier can't deliver?)
   - No dispute resolution clause
   - Action: Legal review before signature

6. **Regulatory/Compliance Risk**
   - Goods on ITAR/export control list; buyer in restricted country
   - Goods subject to quotas or licenses not yet obtained
   - Sanctioned party in supply chain
   - Action: Trade Compliance Officer clearance required

7. **Payment Method Unjustifiable**
   - Customer insists on Net 120 when tier is spot/new buyer
   - Requires LC but credit is strong (LC cost unjustified)
   - CCC would exceed 90 days with this deal
   - Action: Push back on payment terms or provide business reason

8. **Outstanding Receivables Red Line**
   - Adding this deal would push outstanding >40% of annual revenue
   - Action: Don't book deal until prior receivables collected

---

### YELLOW FLAGS (Require Explicit CFO Approval)

⚠️ **Proceed Only With Documented CFO Sign-Off**

- Deal under $25K (LC fixed costs disproportionate) — Exception if repeat customer
- New supplier (not yet vetted) — Requires CIA or LC; tier down on future orders if clean
- Tariff-heavy HS code (tariff >15% of product cost) — Verify classification; lock freight quotes
- Volatile commodity (grain, energy, metals) — Price lock in contracts; consider hedging
- Payment term >60 days to new buyer — Require bank LC or credit insurance
- Currency exposure >5% of deal value — Require forward contract quote before committing
- Multi-leg deal (buy from A, sell to B, buy from C, sell to D) — Chart the cash flow; verify all links executable
- Buyer in country with regulatory uncertainty (new tariffs, sanctions risk) — Require political risk insurance

---

### COMPLIANCE FLAGS (Non-Negotiable)

🚨 **Automatic Escalation**

- **Sanctions Screening**: All buyers, suppliers, intermediaries screened against OFAC/UN/EU/UK sanctions lists
- **ITAR/Export Control**: If goods subject to ITAR/EAR, buyer must be approved end-user; no diversion risk
- **Conflict Minerals**: If sourcing minerals from conflict regions, due diligence required
- **Labor/ESG**: Supplier practices (child labor, environmental) flagged if known or suspected
- **Country Risk**: Business in Iran, North Korea, Syria, Cuba, Crimea—blocked except with legal review
- **Entity Verification**: Buyer/supplier must be verified legal entity (UBO, corporate status, active)

---

## XII. Template: Deal Financial Summary

Use this template for every deal >$50K:

```
DEAL: [Buyer] | [Product] | [Qty] | [Date]

REVENUE & MARGIN
Revenue (ex-tax):                          $________
COGS (product cost):                       $________ 
Gross Profit (before freight/duty):        $________
Gross Margin %:                            ________%

LANDED COST BREAKDOWN
Freight (international + inland):          $________
Insurance:                                 $________
Customs Duty:                              $________
VAT/GST (if applicable):                   $________
Processing Fees (brokerage, etc.):         $________
Total Landed Cost:                         $________

FINANCING COSTS
Trade Finance (LC, insurance, etc.):       $________
Currency Hedging:                          $________
Carry Cost (if extended terms):            $________
Total Financing Cost:                      $________

FINAL NET PROFIT
Gross Profit – Landed Cost – Financing:    $________
Net Profit Margin %:                       ________%

CASH FLOW
Payment Terms to Buyer:                    [LC / Net 30 / DP, etc.]
Payment Terms from Supplier:               [COD / Net 30 / etc.]
CCC Impact (days cash tied up):            ________ days
Working Capital Required:                  $________

RISKS
[ ] Tariff exposure (if rates change mid-deal)
[ ] Currency exposure (if unhedged)
[ ] Buyer credit risk (if payment delayed)
[ ] Supplier delivery risk
[ ] Regulatory/compliance flags

CFO APPROVAL: _________________ Date: _________
```

---

## XIII. Key Contacts & Resources

**Internal**
- Trade Compliance Officer: Verify sanctions, ITAR, export controls
- Customs Broker: Tariff codes, landed cost estimates, duty drawback claims
- Finance Team: Working capital forecasting, cash position

**External**
- Customs Broker: HS code classification, tariff estimates, CBP filings
- Freight Forwarder: Freight quotes, carrier selection, documentation
- Insurance Broker: Cargo insurance, trade credit insurance, political risk
- Trade Finance Bank: LC issuance/negotiation, D/P collections, supply chain financing
- Law Firm: Contract review, dispute resolution, sanctions compliance

**Data Resources**
- USITC (US International Trade Commission): HS code lookups, tariff rates
- World Bank Tariff Database: Tariff rates by country
- OFAC Sanctions List: Buyer/supplier screening
- Trade Agreements Database: Preferential tariff rates (USMCA, etc.)

---

## XIV. Lessons & Precedents

*Update this section as operational experience accumulates.*

- **L-001**: Always verify HS code with customs broker; don't guess. Misclassification cost us $12K in unanticipated duty on a $50K deal.
- **L-002**: Lock freight quotes in writing before quoting buyer. Ocean freight volatility (Suez closures, bunker surges) can swing margin 2%–3%.
- **L-003**: Currency exposure on deals >$100K must be hedged or explicitly accepted by CFO. Unhedged deal lost $5K when USD weakened mid-shipment.
- **L-004**: Don't extend Net 60 to new buyers without LC. One buyer took goods, delayed payment 120+ days, required collection action.
- **L-005**: Trade credit insurance (1% cost) is cheap insurance against 5%+ margin loss. Use it on all open account deals >$100K.
- **L-006**: CCC >60 days drains working capital fast. A $500K deal with 90-day CCC ties up ~$150K for 90 days; ensure this is financed before booking.

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-09  
**Next Review**: 2026-Q3  
**Owner**: CFO / Finance

