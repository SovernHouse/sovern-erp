# Trade Compliance Reference Guide
## AI Assistant Reference for International Trade Compliance Officer

**Last Updated:** April 2026  
**Regulatory Framework:** 15 CFR 730-774 (EAR), 31 CFR 500-599 (OFAC), 19 CFR 111-163 (Customs)

---

## I. Compliance Program Fundamentals

### Core Program Structure (31 CFR 501 / OFAC Framework)

A robust compliance program must include five essential components:

1. **Management Commitment** — Written policies and explicit authority designating compliance responsibility
2. **Risk Assessment** — Documented evaluation of the organization's sanctions, export control, and import compliance risks
3. **Internal Controls** — Clear procedures for transaction screening, customer due diligence, and escalation
4. **Testing and Auditing** — Regular independent audits of compliance procedures; sample testing of transactions
5. **Training** — Documented training for all relevant personnel, updated when regulations change

### Program Scope

The compliance program must address:
- All U.S. persons (citizens, permanent residents, entities incorporated under U.S. law)
- All transactions by U.S. companies worldwide
- All transactions occurring within U.S. territory (regardless of party citizenship)
- Affiliated entities and subsidiaries

**Key Principle (Strict Liability):** Intent is irrelevant. OFAC enforces on a strict liability basis — an unauthorized transaction violates law even if made in good faith.

### Regulatory Authority

- **OFAC (Office of Foreign Assets Control):** 31 CFR Parts 500-599, Treasury Department
- **BIS (Bureau of Industry and Security):** 15 CFR Parts 730-774, Commerce Department  
- **CBP (Customs and Border Protection):** 19 CFR Parts 111-163, Homeland Security
- **Treasury FinCEN:** Anti-money laundering and beneficial ownership rules

---

## II. Sanctions Screening

### OFAC Sanctions Programs Overview

OFAC administers 38+ separate sanctions programs targeting:
- Specific countries (Cuba, Iran, North Korea, Russia, Syria, Venezuela, etc.)
- Sectoral sanctions (Russian financial services, oil/gas, technology)
- Activity-based programs (terrorism, narcotics, human rights)
- Cyber-related and election interference sanctions

### OFAC Designated Lists

**Specially Designated Nationals and Blocked Persons List (SDN List)**
- Contains ~15,000 designations as of 2026
- Includes individuals, entities, vessels, and aircraft
- Available at: https://sanctionslist.ofac.treas.gov/Home/SdnList
- Updated daily; check the Archive of Changes: https://ofac.treasury.gov/specially-designated-nationals-list-sdn-list/archive-of-changes-to-the-sdn-list

**Sectoral Sanctions Identification List (SSI List)**
- Entities in specific sectors (Russia oil & gas, financial services, technology)
- Secondary sanctions apply to non-U.S. entities doing business with listed parties

**UN Security Council Lists**
- Consolidated at https://sanctionssearch.ofac.treas.gov/
- May differ from U.S. lists; screening should cover both

### Additional International Sanctions Lists

**EU Consolidated List (Consolidated Financial Sanctions List / CFSP)**
- Maintained at: https://data.europa.eu/data/datasets/consolidated-list-of-persons-groups-and-entities-subject-to-eu-financial-sanctions
- EU Sanctions Map: https://www.sanctionsmap.eu/
- Critical requirement: Account for non-Western naming conventions, non-Latinate characters, nicknames, and aliases

### Screening Requirements

**Timing:**
- Screening must occur BEFORE entering into a transaction
- Ongoing monitoring required for all customers and counterparties
- Re-screening recommended quarterly or upon material transaction changes

**Methods:**
- Automated screening tools checking against consolidated lists
- Manual review of results flagged by automated systems
- Periodic audits of screening procedures
- Documentation of all screening results

**Coverage:**
- Direct customers and counterparties
- Beneficial owners and key decision makers
- Parties in the supply chain where feasible
- Vessels and aircraft involved in transport

**Record Retention:** All screening results and transaction documentation must be retained for minimum 5 years.

### OFAC Compliance Guidance

OFAC publishes "Compliance Commitments" framework (https://ofac.treasury.gov/media/16331/download) emphasizing:
- Rapid adaptation to new designations
- Escalation procedures for potential violations
- Senior management involvement in compliance decisions
- Self-disclosure protocols for unintended violations

---

## III. Export Controls

### Regulatory Framework: Export Administration Regulations (EAR)

**Scope:** 15 CFR Parts 730-774  
**Administering Agency:** Bureau of Industry and Security (BIS), U.S. Department of Commerce

The EAR regulates the export of "dual-use" items — goods and technology designed for commercial purposes but with military applications.

### What Requires Export Control

**Controlled Items:**
- Commodities (raw materials, components)
- Software and technical data
- Technology (manufacturing processes, design specs)
- Technical assistance (consulting, training, repairs)

**Non-Controlled Items:**
- Publicly available information
- Items only available to general public
- General scientific principles

### Classification System: ECCN (Export Control Classification Numbers)

**Format:** Five alphanumeric characters (e.g., 3A991)

- **Character 1 (0-9):** Product category (0=Nuclear; 1=Materials; 2=Chemicals; 3=Microelectronics; 4=Computers; 5=Telecommunications; 6=Sensors; 7=Navigation; 8=Aerospace; 9=Propulsion)
- **Character 2 (A-E):** Product group within category
- **Characters 3-5:** Specific item on Commerce Control List (CCL)

**CCL Location:** 15 CFR § 774, Supplement 1  
**Search Tool:** https://www.bis.gov/licensing/classify-your-item

### EAR99 Classification

Items subject to EAR but NOT listed on the Commerce Control List (CCL) are classified as **EAR99**. These include:
- Most civilian goods with no military applications
- Items under control of another federal agency
- Lower technology commercial items

**Critical:** EAR99 items still require export control jurisdiction analysis but generally do not require a license except for certain destinations or end-uses.

### License Requirements and Exceptions

**General Prohibition:** No export of controlled items without a license (or valid license exception).

**License Types:**
- **Standard License:** Case-by-case review by BIS
- **License Exception:** Pre-approved categories allowing export without obtaining individual license (e.g., NLR for normal commercial operations, APP for spare parts, BAG for personal baggage)

**Deemed Exports:** Occurs when a U.S. person transmits controlled technical data to a foreign national in the U.S., or discloses technology to a foreign person. Requires notification of foreign person's country of origin.

### Restricted Destinations and End-Uses

**Embargoed Countries:**
- Iran, North Korea, Syria (generally no exports)
- Cuba, Venezuela (limited exceptions)
- Crimea (Russia-related restrictions)

**Restricted End-Users:**
- Nuclear weapons programs
- Chemical/biological weapons
- Missile development
- Military end-users in sensitive countries

### BIS Restricted Party Lists (within Consolidated Screening List)

**Denied Persons List (DPL):**
- Individuals and entities denied export privileges
- Any transaction involving DPL party is prohibited
- Updated at: https://www.bis.gov/licensing/

**Entity List:**
- Entities with license requirements supplemental to those in EAR
- Each entry specifies applicable license requirements and review policies
- Includes foreign entities of concern (technology, military applications)

**Unverified List:**
- End-users BIS could not verify in prior transactions
- Presence in transaction = "Red Flag" requiring resolution before proceeding

**Military End-User (MEU) List:**
- Foreign military departments and military-owned industries
- Triggers license requirement for any EAR-controlled item

### Compliance Procedures

1. Classify item using CCL or EAR99 designation
2. Determine destination country
3. Identify end-user and end-use
4. Determine if license exception applies
5. If no exception: apply for BIS license
6. Conduct denied party screening (Consolidated Screening List)
7. Document all decisions and maintain records for 5 years

---

## IV. Import Classification and Customs Compliance

### Harmonized Tariff Schedule (HTS) Classification

**Authority:** 19 CFR; administered by U.S. Customs and Border Protection (CBP)  
**Tool:** https://hts.usitc.gov/

**Structure:**
- **HTS Codes:** 10-digit codes determining duty rate and tariff classification
- **HS Codes:** 6-digit international standard (base for HTS)
- **Format:** XX-XX-XX-XX-XX (Chapter-Heading-Sub-heading-Product-Article)

**Example:** HS 8471.30 (Automatic data processing machines, weighing not more than 10kg)

**Binding Rulings:** CBP issues Harmonized Tariff Classification Rulings (binding advice on specific goods). Request at https://www.cbp.gov/trade/trade-community/rulings

### Customs Valuation Methods

**Hierarchy (19 CFR Part 152):**

1. **Transaction Value** — Price actually paid, including packing and certain aids
2. **Identical Goods** — Same goods sold to different buyers in same country
3. **Similar Goods** — Goods of same type sold to different buyers
4. **Deductive Method** — Working backward from resale price
5. **Computed Value** — Sum of materials, labor, overhead, profit
6. **Fallback Method** — Most reasonable value based on available information

**Cost Components to Include:**
- Cost of containers and packing
- Royalties and licensing fees
- Assists (materials/tools provided by importer)
- Selling commissions
- Inland freight and insurance to U.S. border

**Prohibited Adjustments:**
- Future dividends
- Post-sale alterations
- Unrelated brokerage fees

### Rules of Origin

**Definition:** Determination of which country's tariff rate applies based on where goods were produced/manufactured.

**U.S. General Rules:**
- Origin = country where good received final substantial transformation
- "Substantial" = brings good into new or different name, character, condition, or use
- Multiple country components = origin of country performing final substantial transformation

**Preference Programs:** See Section V below (USMCA, RCEP, other FTAs)

---

## V. Free Trade Agreements and Preferential Tariffs

### USMCA (U.S.-Mexico-Canada Agreement)

**Effective Date:** July 1, 2020 (replaced NAFTA)

**Qualification Requirements:**

The good must:
1. Be wholly obtained or produced in USMCA territory, OR
2. Contain non-originating materials that meet specific criteria:
   - Change in tariff classification (product-specific rules)
   - OR Regional Value Content (RVC) requirement met

**Regional Value Content (RVC):**
- Calculated as: [(Originating Value) ÷ (Adjusted Value)] × 100
- Varies by product: 60-75% typically required
- Determines what % of good's value must come from USMCA region

**Certification of Origin:**
- **No required form:** No longer required to use CBP Form 434
- **Minimum Data Elements:** Nine elements required (Annex 5-A of USMCA Text)
  - Importer name/address
  - Exporter name/address
  - Producer name/address
  - Good description and HS code
  - Certification that good qualifies
  - Signature and date
  - Supporting documentation (available upon request)
- **Medium:** Certification provided on invoice or any other document
- **Retention:** Importer keeps certification for 5 years

**Rules of Origin Text:** https://ustr.gov/sites/default/files/files/agreements/FTA/USMCA/Text/05_Origin_Procedures.pdf

### RCEP (Regional Comprehensive Economic Partnership)

**Scope:** Asia-Pacific region (ASEAN + China, Japan, South Korea, Australia, New Zealand)

**Rules of Origin:**
- Regional Value Content required (typically 40-60% depending on product)
- Cumulation allowed: inputs from RCEP partner countries count as originating
- De minimis rule: up to 10% non-originating material may be used if it doesn't meet criteria

**Certification Methods:**
1. **Authorized Exporters:** Self-certify (after transition period, all exporters allowed)
2. **Visa Agencies:** Government-issued certificates of origin
3. **Declaration on Invoice:** Exporter/producer declaration

**Key Advantage:** Simplified procedures and broader cumulation than bilateral FTAs

---

### Other FTAs

Key U.S. FTAs to consider:
- **CAFTA-DR** (Dominican Republic, Central America)
- **Korea FTA**
- **USHK FTA** (Hong Kong)
- **Bilateral agreements** with individual countries

Each requires distinct rules of origin and certificate format. Verify applicable agreement for each shipment.

---

## VI. Required Documentation Checklist

### Commercial Invoice (Required for all shipments)

**Primary Purpose:** Customs duty and value determination  
**Legal Basis:** 19 CFR 141.86

**Required Elements:**
- Invoice date and number
- Exporter/seller name and address
- Importer/buyer name and address
- Detailed description of goods (sufficient for tariff classification)
- Quantity and unit price
- **Total invoice value**
- Currency of sale
- Country of origin
- Terms of sale (Incoterms 2020: FOB, CIF, EXW, etc.)
- Certifications (if applicable: country of origin, FTA status)

**Critical Requirement:** Value must match all supporting documents (packing list, bill of lading). Discrepancies trigger CBP examination.

### Bill of Lading (Required for ocean freight)

**Legal Basis:** 46 U.S.C. § 30701; 15 CFR Part 30

**Functions:**
- Contract of carriage
- Receipt for goods from shipper
- Document of title
- Proof of export

**Required Elements:**
- Shipper/exporter name and address
- Consignee (importer) name and address
- Notify party (usually importer)
- Port of loading and discharge
- Vessel name and voyage number
- Container/BL reference number
- Cargo description (must match commercial invoice)
- Weight/dimensions
- Freight terms (prepaid or collect)
- Carrier signature and date

**Export Compliance:** Must show shipper as U.S. Principal Party in Interest (USPPI) for EEI filing.

### Air Waybill (Required for air freight)

**Function:** Equivalent to bill of lading; receipt for cargo and contract of carriage

**Contents:** Identical to BOL but for air shipments; includes flight information instead of vessel details

### Packing List (Strongly recommended)

**Contents:**
- Item-by-item breakdown of contents
- Quantity per item
- Weight per item
- Dimensions/cubic footage
- HS/HTS codes where applicable
- Marks and numbers matching cartons/packages

**Use:** Customs uses to verify contents match commercial invoice; can expedite clearance.

### Certificate of Origin

**Required if claiming preferential tariff rates under FTA.**

**Timing:** Must be completed BEFORE import claim is filed  
**Retention:** 5 years from date of import

**Specifics by Agreement:**
- **USMCA:** Minimum data elements on invoice or separate document
- **RCEP:** Visa agency form, self-certification, or invoice declaration
- **Other FTAs:** Check specific agreement requirements

### Electronic Export Information (EEI) - Shipper's Export Declaration

**Required if:** Export value >$2,500 OR export involves controlled items  
**Filing:** Through Census Bureau's Automated Export System (AES)  
**Filer:** U.S. Principal Party in Interest (USPPI)  
**Format:** 15 CFR § 30.2 — eCFR § 15 CFR Part 30 Subpart A

**Contents:**
- USPPI name, EIN, address
- Consignee information
- Commodity description, HS code, quantity, value
- Destination country
- License or exception authority
- Marks/numbers identifying shipment
- Carrier and routing information
- Date of export

### Customs Entry Form (CBP Form 3461 or 7501)

**Required for:** Every import entry into U.S.  
**Filed by:** Importer or customs broker

**Information Required:**
- Importer name and IRS number
- Exporter/foreign shipper
- Port of entry
- Commodity description and HTS code
- Quantity and unit price
- Country of origin
- Weight
- Invoice number and date
- Arrival information

### Supporting Documentation to Retain

For 5 years, maintain:
- Purchase orders and contracts
- Invoices (all versions, including pro forma)
- Bills of lading and shipping receipts
- Certificates of origin
- Insurance certificates
- Inspection reports
- Customs clearance documents
- Quality/compliance certifications
- Export license applications (if applicable)

---

## VII. Denied Party and Restricted Party Screening

### Consolidated Screening List (CSL)

**Authority:** Bureau of Industry and Security (Commerce Department)  
**Location:** https://www.trade.gov/consolidated-screening-list

**Coverage:** ~12,000 entries across 13 federal lists  
**Scope:** Combines lists from Commerce (BIS), Treasury (OFAC), and State departments

### BIS Lists (4 critical lists)

**1. Denied Persons List (DPL)**
- Individuals/entities that have had export privileges denied
- Violations involve participation in transaction with listed party
- Check for: Name, entity name, aliases, address matches

**2. Entity List**
- Foreign entities requiring license for transactions
- Most have restrictions limited to specific items/technology
- Each listing specifies:
  - License requirement type (e.g., "License required for items in EAR99")
  - Countries where restriction applies
  - License review policy (likely denial, probable denial, case-by-case)

**3. Unverified List**
- End-users BIS could not verify in prior transactions
- Presence in transaction = "Red Flag" must be resolved
- Transaction should not proceed until identity confirmed

**4. Military End-User (MEU) List**
- Foreign military departments and military-owned industries
- License required for ANY EAR-controlled item
- Geographic focus: China, Russia, and countries of concern

### OFAC Lists

**Specially Designated Nationals (SDN) List**
- Over 15,000 designations
- Check against: Individual name, entity name, vessel name, aircraft tail number
- Includes: Aliases, AKAs (also known as), former names

**Sectoral Sanctions Identification (SSI) List**
- Russian entities in sanctioned sectors
- Indirect dealings (doing business with SSI entity) may be prohibited

### Screening Procedure

**Step 1: Pre-Transaction Screening**
1. Identify all parties to transaction (buyer, seller, freight forwarder, transshipment points if known)
2. Run all party names through CSL
3. Account for name variations: initials, transliterations, common misspellings
4. Review results for false positives (common names)
5. Document screening decision and date

**Step 2: Review Results**
- **Match:** Do not proceed; escalate to Legal/Compliance Officer
- **Possible match:** Request clarification from customer (address, business type, ID)
- **No match:** Document and proceed (but re-screen if circumstances change)

**Step 3: Ongoing Monitoring**
- Quarterly re-screening of all active customers
- Immediate re-screening if:
  - New SDN list release (daily)
  - Customer providing new payment method or bank
  - New destination country announced under sanctions
  - Substantial increase in transaction value
  - New transshipment routes

**Step 4: Documentation**
- Record all screening results (positive and negative)
- Maintain copy of CSL list version used
- Document any follow-up with customer
- Retain for minimum 5 years

### International Screening

**Beyond U.S. Lists:**
- EU Consolidated List: https://www.sanctionsmap.eu/
- UN Security Council Lists: https://www.un.org/securitycouncil/sanctions/
- UK OFSI lists: https://www.gov.uk/government/publications/the-uk-sanctions-list
- Other country-specific lists depending on business footprint

---

## VIII. Record Keeping Requirements

### Retention Periods

**Import Records (19 CFR Part 163)**
- **Standard period:** 5 years from date of entry
- **Informal entries:** 2 years (if using customs broker)
- **Once requested by agency:** Cannot be destroyed (even after retention period expires)

**Export Records (15 CFR Part 30 - Foreign Trade Regulations)**
- **Standard period:** 5 years from date of export
- **All parties:** USPPI, FPPI, agents, and carriers must retain
- **Once BIS or CBP requests:** Destruction prohibited indefinitely

**Customs Broker Records (19 CFR § 163.4)**
- **5 years** from date of transaction

### What Must Be Retained

**Export Documentation:**
- Shipping documents (bills of lading, waybills, packing slips)
- Commercial invoices (all versions)
- Orders and contracts
- Evidence of controlled status (if applicable):
  - Export licenses
  - License exception justifications
  - ECCN self-classification determinations
- Electronic Export Information (EEI) or Shipper's Export Declaration (SED)
- Correspondence with customers and freight forwarders
- Denied party screening records

**Import Documentation:**
- Purchase orders and contracts
- Invoices (pro forma and commercial)
- Bills of lading and shipping receipts
- Customs entry documents (Form 3461/7501)
- Certificates of origin
- Insurance certificates
- Inspection reports
- Quality certifications
- Country of origin determinations
- Denied party screening records
- Tariff classification rulings

**Both Import and Export:**
- Bank records showing payment
- Customer identification information (beneficial owners if known)
- Compliance certifications and representations
- Denied party screening results

### Storage Format

Records may be maintained:
- Original documents
- Microfilm/microfiche
- Electronic format (if legible and retrievable)
- Cloud storage (if security and access controls documented)

**Critical:** Must be retrievable within 10 business days upon government request.

### Special Retention Rules

**When Government Request Made:**
- All records become permanent (cannot be destroyed)
- Status remains until case is resolved or request withdrawn

**Broker Records:**
- Also retained at broker's office (accessible to CBP on demand)

---

## IX. Penalties for Non-Compliance

### OFAC Sanctions Violations (31 CFR 501)

**Civil Penalties:**
- **Maximum per violation:** Adjusts annually for inflation
- **2026 Amount:** $375,000 per violation (approximately)
- **Basis:** Willful violation; mere negligence may result in no penalty or reduced penalty
- **Calculation:** Can be assessed on each transaction or each day of violation

**Aggravating Factors (result in higher penalties):**
- Concealment of violations
- Repeated violations
- Involvement of sanctioned jurisdiction
- Transaction magnitude

**Mitigating Factors (may reduce penalties):**
- Prompt self-disclosure
- Robust compliance program in place
- Preventive measures taken
- First offense

**Criminal Penalties (Trading With the Enemy Act - 50 U.S.C. § 4819):**
- **Individuals:** Up to 20 years imprisonment AND/OR up to $1,000,000 fine
- **Entities:** Up to $1,000,000 fine
- **Requirement:** Willful violation (knowing intent to violate)

**OFAC Penalty Framework:** 31 CFR Appendix A to Part 501 (Economic Sanctions Enforcement Guidelines) — https://www.law.cornell.edu/cfr/text/31/appendix-A_to_part_501

### BIS Export Control Violations (15 CFR 730-774)

**Administrative Penalties (Per Violation):**
- **2025 amount:** Up to $374,474 per violation
- **Calculation:** Assessed per transaction or per day of violation
- **Alternative:** Up to 2x the value of transaction (whichever is greater)
- **Inflation adjustment:** Updated annually

**Criminal Penalties (Export Control Reform Act - 50 U.S.C. § 4819):**
- **Willful violations:** Up to 20 years imprisonment AND/OR up to $1,000,000 fine per count
- **Negligent violations:** Up to 10 years imprisonment AND/OR up to $500,000 fine

**Denial of Export Privileges:**
- Bars individual/entity from ANY export transaction subject to EAR
- Temporary Denial Orders (TDOs): up to 180 days, renewable
- Permanent denial possible after violation finding
- Applies to all export transactions (even non-controlled items)

**BIS Enforcement:** https://www.bis.gov/enforcement/penalties

### CBP Customs Violations (19 U.S.C. § 1592)

**Penalties by Severity:**
- **Negligence:** 20% of entered merchandise value (minimum $400)
- **Gross Negligence:** 40% of entered merchandise value
- **Fraud:** 4x entered merchandise value + applicable duties

**Common Violations:**
- Misclassification of HS code
- Undervaluation of goods
- False country of origin
- Missing or false documentation
- Failure to disclose proper importer of record

### Criminal Customs Violations

- **Smuggling:** Up to 5 years imprisonment, fines up to $250,000, seizure of goods
- **False statements on entry:** Up to 10 years, fines, seizure
- **Conspiracy:** Up to 5 years, fines

### Enforcement Trends (2025-2026)

Recent enforcement actions show elevated scrutiny of:
- Sanctions evasion through transshipment and third parties
- Export of advanced technology to Entity List parties
- Undervaluation and origin misstatements
- FTA qualification claims on originating goods
- Diversion of controlled items to restricted end-uses

---

## X. Red Flags Checklist

### High-Priority Red Flags (Require Immediate Escalation)

**Sanctions Risk:**
- [ ] Party name matches OFAC SDN, EU Consolidated List, or UN list (partial match = investigate)
- [ ] Customer located in or with ties to embargoed country (Iran, North Korea, Syria, Cuba, Venezuela)
- [ ] Customer is subsidiary or affiliate of sanctioned entity
- [ ] Payment routed through jurisdiction under sectoral sanctions (Russia oil/gas sector)
- [ ] Customer uses proxy or intermediary; reluctant to provide beneficial ownership info
- [ ] Trade finance involves financial institution on OFAC list

**Export Control Risk:**
- [ ] Item contains controlled component (ECCN controlled item, even if final good is EAR99)
- [ ] Customer listed on Denied Persons List, Entity List, Unverified List, or Military End User List
- [ ] Deemed export (technology disclosure to foreign national in U.S.)
- [ ] End-use indicates weapons, aerospace, nuclear, or military application
- [ ] Customer is foreign military or military-owned enterprise
- [ ] Customer unwilling to provide statement of end-use
- [ ] Customer in country requiring license (China, Russia, Iran, North Korea, Syria)

**Diversion and Evasion Indicators:**
- [ ] Customer using freight forwarder as final consignee (rather than actual end-user)
- [ ] Transshipment through known re-export hubs (Hong Kong, Turkey, UAE, Armenia)
- [ ] Customer overpaying significantly (>125% market price)
- [ ] Customer willing to pay cash for expensive item (financing normally expected)
- [ ] Documentation inconsistencies (commercial invoice, packing list, BOL don't match)
- [ ] Commodity misclassified (CHPL item shown under non-CHPL HS code)
- [ ] End destination changed after initial inquiry
- [ ] Multiple shipments of same item to same consignee in short period

**Customer/Relationship Red Flags:**
- [ ] New customer with no verifiable business history or references
- [ ] Customer at same address as previously sanctioned or denied party
- [ ] Customer name similar to (but not identical to) listed party
- [ ] Customer requesting unusual terms (anonymity, cash payment, informal documentation)
- [ ] Customer reluctant to complete standard end-use certification
- [ ] Customer from high-risk jurisdiction (terrorism list countries, high corruption index)
- [ ] Customer's industry doesn't align with product type (e.g., cosmetics company buying advanced semiconductors)

**Transaction Red Flags:**
- [ ] Order quantity inconsistent with customer's normal operations
- [ ] Unusually large order for item with limited civilian use
- [ ] Request for expedited shipment with vague justification
- [ ] Request to remove/obscure origin markings
- [ ] Request to falsify documentation (country of origin, value, description)
- [ ] Payment method unusual (cryptocurrency, trade finance intermediaries, informal channels)
- [ ] Price negotiation focuses on avoiding duty/tax rather than commercial terms

**Documentation Red Flags:**
- [ ] Missing certifications (origin, end-use, end-user statement)
- [ ] Discrepancies between documents (invoice value ≠ BOL weight/dimensions)
- [ ] Altered, forged, or illegible documents
- [ ] Incomplete addresses or contact information
- [ ] Generic/boilerplate descriptions (missing specifics on product)

---

## XI. Compliance Officer Veto Items

### Prohibited Transactions (Absolute)

These transactions MUST NOT proceed. Compliance Officer or General Counsel has authority to veto:

1. **Any transaction involving OFAC SDN List or sanctioned jurisdiction**
   - No exception unless explicit OFAC license obtained
   - Even partial/tangential involvement warrants escalation

2. **Export of controlled items to denied persons or Entity List parties**
   - Without BIS license approval
   - Includes deemed exports of technology

3. **Trade with countries subject to comprehensive embargoes**
   - Iran, North Korea, Syria, Cuba (limited exceptions only)
   - Crimea region (Russia)
   - Cannot proceed without specific license

4. **FTA origin claims without supporting documentation**
   - USMCA, RCEP, other FTAs
   - No certificate = no preferential rate claim (pay MFN duty instead)

5. **Goods with false country of origin markings**
   - Legal requirement: accurate origin marking
   - Proceeding = CBP violation and potential fraud

6. **Imports without proper HTS classification or CBP entry**
   - Cannot claim duty deferral or wrong rate without documentation
   - Results in undisputed CBP penalties

### Escalation Items (Compliance Review Required Before Proceeding)

1. **Any Unverified List matches**
   - Must verify customer identity before proceeding
   - Request business license, beneficial owner information, references

2. **Transshipment through high-risk jurisdictions**
   - Hong Kong, UAE, Turkey, Armenia (Russia transshipment route)
   - Require customer affirmation of true end-use and consignee

3. **Unusual customer behavior or payment structures**
   - Cash payment for high-value items
   - Multiple shipments of same item in short period
   - Request to obscure shipping information

4. **FTA origin claims requiring verification**
   - Supplier representations about regional value content
   - No independent verification = cannot claim preferential rate

5. **Exports of items that could have military applications**
   - Even if classified EAR99
   - Even if destination is non-embargoed country
   - Require end-use statement from customer

6. **Cross-border data transfers (if applicable)**
   - Privacy regulation compliance (GDPR, CCPA, etc.)
   - Ensure data localization requirements met

---

## XII. Compliance Program Veto Framework

### When to Invoke Compliance Veto

The Trade Compliance Officer may unilaterally halt any transaction if:

1. **Statutory violation would result** (OFAC, EAR, CBP, sanctions law)
2. **Insufficient time to verify compliance** (deadline does not allow for due diligence)
3. **Customer unable/unwilling to provide required certifications** (end-use, origin, beneficial owner)
4. **Red flags present that cannot be resolved** (documentation inconsistencies, suspicious behavior)
5. **Doubt about legitimacy of transaction** (appears designed to evade sanctions or export controls)

### Communication Protocol

When invoking veto:
- Notify Finance, Sales, and Operations within 24 hours
- Explain specific regulatory basis for veto
- Recommend remedial actions (if any) to proceed
- Document veto in compliance file with timestamp
- Escalate to General Counsel if customer disputes decision

### Appeal Process

- Sales/customer can request Compliance Officer reconsideration with additional information
- If new facts presented that mitigate risk, Compliance Officer may approve conditional proceeding
- CEO/General Counsel can override veto only with documented legal review and acceptance of liability risk
- Override decision must be documented in compliance file

---

## XIII. Regulatory References and Tools

### Key Regulations

| Topic | Regulation | Authority |
|-------|-----------|-----------|
| OFAC Sanctions | 31 CFR Parts 500-599 | Treasury Department |
| OFAC Penalties | 31 CFR Appendix A Part 501 | Treasury Department |
| Export Controls | 15 CFR Parts 730-774 | Commerce Department (BIS) |
| CCL | 15 CFR Part 774 Supplement 1 | Commerce Department |
| Denied Parties | 15 CFR Part 764 | Commerce Department |
| Foreign Trade Regs (EEI/SED) | 15 CFR Part 30 | Commerce Department (Census) |
| Customs Entry | 19 CFR Part 141 | DHS (CBP) |
| Customs Recordkeeping | 19 CFR Part 163 | DHS (CBP) |
| Customs Penalties | 19 U.S.C. § 1592 | DHS (CBP) |
| USMCA Rules | USMCA Chapter 4 & 5 | USTR |

### Primary Search/Screening Tools

| Tool | Purpose | Link |
|------|---------|------|
| OFAC SDN Search | Real-time SDN list search | https://sanctionssearch.ofac.treas.gov/ |
| OFAC Sanctions List | Full OFAC list download | https://sanctionslist.ofac.treas.gov/ |
| CSL (Consolidated Screening List) | BIS + OFAC + State lists | https://www.trade.gov/consolidated-screening-list |
| EU Sanctions Map | EU Consolidated List | https://www.sanctionsmap.eu/ |
| HTS Lookup | Tariff code classification | https://hts.usitc.gov/ |
| BIS Item Classification | ECCN lookup | https://www.bis.gov/licensing/classify-your-item |
| CBP Rulings | Binding tariff classifications | https://www.cbp.gov/trade/trade-community/rulings |

### Regulatory Authority Websites

- **OFAC:** https://ofac.treasury.gov/
- **BIS:** https://www.bis.gov/
- **CBP:** https://www.cbp.gov/
- **Census Bureau (EEI):** https://www.census.gov/foreign-trade/

---

## XIV. Compliance Self-Assessment Checklist

Use this monthly to audit compliance program:

- [ ] All staff training current (annually minimum)
- [ ] CSL screening tool updated with latest data
- [ ] Denied party screening log complete for all transactions past 30 days
- [ ] No SDN list changes missed (check weekly archive)
- [ ] 100% of export transactions have EEI filed (if >$2,500)
- [ ] All import entries documented with proper HTS codes
- [ ] FTA origin claims supported by certificates and RVC calculations
- [ ] Records retention policy enforced (spot check 10 files; verify retention)
- [ ] No known violations outstanding or under investigation
- [ ] Escalation procedures tested (simulate red flag, verify escalation occurs)
- [ ] Legal review of high-risk transactions documented
- [ ] Customers provided certifications (end-use, origin, beneficial ownership)

---

## XV. Recent Enforcement Emphasis Areas (2025-2026)

Agencies are aggressively targeting:

1. **Sanctions Evasion Through Transshipment**
   - Use of Hong Kong, UAE, Turkey, Armenia as transshipment points
   - Concealment of Russian end-users
   - Recommendations: Enhanced due diligence on transshipment parties; require customer affirmation of true destination

2. **Export of Advanced Technology to Entity List Parties**
   - Semiconductors, AI-related components, advanced materials
   - "Deemed exports" of technical data to foreign nationals
   - Recommendations: Strict ECCN classification; end-use statements for all electronics exports

3. **Customs Valuation Manipulation**
   - Undervaluation to reduce duty
   - False country of origin
   - Recommendations: Spot audits of valuations; require supporting cost documentation

4. **FTA Abuse**
   - False origin claims on USMCA goods
   - Insufficient regional value content
   - Recommendations: Document RVC calculations; audit supplier representations

5. **Military End-User Avoidance**
   - Front companies claiming civilian end-use
   - Recommendations: Enhanced customer due diligence; skepticism of new customers in defense sectors

---

**Document Status:** Reference only. Not legal advice. Consult Legal Counsel before making final compliance decisions.

**Last Reviewed:** April 2026  
**Next Review:** October 2026

---

### Sources Cited

- [OFAC Compliance Guide 2026](https://sanctionslawyers.net/blog-en/ofac-compliance-guide/)
- [OFAC Framework for Compliance Commitments](https://ofac.treasury.gov/media/16331/download)
- [Export Controls & Sanctions: 2025 Year-End Review](https://www.torrestradelaw.com/posts/Export-Controls-Sanctions:-2025-Year-045;End-Review/422)
- [BIS 50 Percent Rule Implementation](https://www.sidley.com/en/insights/newsupdates/2025/10/us-commerce-department-bureau-of-industry-and-security-adopts-50-percent-rule-for-export-controls)
- [OFAC Enforcement - 2026 State](https://www.corporatecomplianceinsights.com/state-ofac-sanctions-enforcement-2026/)
- [BIS Red Flags Guidance](https://www.bis.gov/identify-red-flags)
- [EU Sanctions Compliance Red Flags](https://eu-sanctions-compliance-helpdesk.europa.eu/red-flags-mastering-indicators-sanctions-risk_en)
- [Sanctions Evasion and Export Control Diversion Guidance](https://www.nortonrosefulbright.com/en/knowledge/publications/41d9e975/us-agencies-release-tri-seal-sanctions-and-export-control-anti-evasion-guidance)
- [Harmonized Tariff Schedule](https://hts.usitc.gov/)
- [USMCA Origin Procedures Text](https://ustr.gov/sites/default/files/files/agreements/FTA/USMCA/Text/05_Origin_Procedures.pdf)
- [RCEP Rules of Origin Guide](https://blogs.adb.org/blog/making-rcep-successful-through-business-friendly-rules-origin)
- [U.S. Common Export Documents](https://www.trade.gov/common-export-documents)
- [19 CFR Part 163 Recordkeeping](https://www.ecfr.gov/current/title-19/chapter-I/part-163)
- [eCFR 31 CFR Appendix A Part 501 OFAC Penalties](https://www.law.cornell.edu/cfr/text/31/appendix-A_to_part_501)
- [BIS Export Enforcement Penalties](https://www.bis.gov/enforcement/penalties)
