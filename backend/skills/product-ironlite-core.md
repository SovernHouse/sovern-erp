# Product Knowledge — IronLite Core Technology

Read this alongside `company-profile.md` and `brand-safety.md` before writing any customer-facing material that touches IronLite Core, FlorWay, or HanHua. All numbers here are sourced from the V4 Sales Sheet (Edition 01, 2026) and the I-Beam brand deck.

---

## What IronLite Core Is

IronLite Core is an engineered three-layer rigid SPC core technology manufactured on two production lines in Asia (FlorWay in Malaysia, Anhui HanHua in China). It is not a finished consumer brand; it is the **technology inside** finished boards. Customers ship product under their own brand on the front, with optional IronLite Core ingredient-branding on the back.

The single-line product description, lifted from the V4 Sales Sheet hero:

> **SPC Redefined.**
> *The strength of iron, the lightness of air. Inside.*

Use this phrasing in headline copy. Do not paraphrase it.

---

## The Construction Stack

Four functional layers in one rigid board, top to bottom:

| # | Layer | Function |
|---|---|---|
| 01 | **SPC wear layer** | Indentation resistance and click-joint integrity. Topped with a super anti-scratch UV finish. |
| 02 | **WPC middle layer** | Impact dampening, acoustic absorption, the underfoot warmth of real engineered wood. This is the "lightness of air" layer. |
| 03 | **SPC stability layer** | Dimensional control through summer-to-winter heat cycles. |
| 04 | **1 mm IXPE underlay** | Bonded to the back of every board. No separate underlayment SKU. |

The construction headline used in customer materials:

> **"Three engineered layers in one rigid board. The sandwich is the story."**

---

## Specifications

| Spec | Value |
|---|---|
| **Core type** | **IronLite** (Sovern's branded engineered SPC core technology). |
| **Default plank dimension** | 180 mm x 1220 mm |
| **Total thickness range** | 6.5 mm to 12.0 mm |
| **Wear layer** | **50S = 0.5 mm = 20 mil.** Conversion key: 100S = 1 mm. |
| **AC rating** | **AC4 / Class 32 (commercial light).** Per Alice via WeChat 2026-05-19, applies when wear layer is 50S. |
| **Surface finish (standard)** | **Embossed.** EIR (Embossed In Register) available as an upgrade at **+$0.20/m²** (Alex, 2026-05-19). |
| **Surface coating** | **Ultra Scratch Resistant UV Lacquer.** Standard across all SKUs. |
| **Click system** | **Unilin** (patent-licensed). Per Alex, 2026-05-19 (supersedes the earlier "drop-down click" note). |
| **Installation method** | **Lock System** — floating, no glue required. |
| **Core construction (canonical, per total thickness)** | Five-layer stack: 0.5 mm wear layer + 1 mm SPC top + Nmm WPC foam core + 1 mm SPC stability + 1 mm IXPE backing. **N = total − 3.5 mm**. e.g. 6.5 mm SKU → 3 mm WPC core; 12.0 mm SKU → 8.5 mm WPC core. |
| **Underlayment** | **1 mm IXPE, attached / bonded to the back.** No separate underlay SKU. |
| **Core density** | 1,200 kg/m³ |
| **Conventional SPC density** | 2,050 kg/m³ |
| **Weight reduction vs SPC** | 41% lighter |
| **m² per 40' high-cube container** | 1,713 to 3,140 (varies by thickness) |
| **Container yield uplift vs SPC** | 1.7x more m² per HQ at the same weight payload |
| **Approximate freight saving** | $0.76/m² lower ocean freight vs SPC |
| **Wear layer commercial rating** | Commercial-grade (see `product-flooring-industry.md`) |
| **HS Code** | 3918.10 (PVC vinyl flooring) |

### Price variants (negotiable uplifts on top of base FOB)

Stored on \`Product.priceVariants\` as a JSON array. Each entry has
\`label\`, \`uplift\`, \`priceUnit\`, \`currency\`, and a \`negotiable\` flag.
For IronLite Core the only variant today is the EIR finish upgrade:

| Label | Base | Indicative uplift | Negotiable |
|---|---|---|---|
| EIR (Embossed In Register) | Embossed (standard) | +\$0.20/m² | Yes |

**Rule:** when drafting a quotation, the AI surfaces the EIR option as
a separate line below the base item and asks Alex which way to go.
The \$0.20 is Alex's marker, not a fixed uplift. Final number gets
agreed per deal. See \`aiContextService.js\` "Price-variant negotiation
protocol".

### Certifications (confirmed by Alice, 2026-05-19)

| Certification | Status | Notes |
|---|---|---|
| **FloorScore** | Certified | Issuer: SCS Global Services |
| **GreenGuard** | Certified | Issuer: UL Environment |
| **CARB2** | Claimed | Factory says yes; **no certificate on file** — surface as a verifiable claim, not a documented credential. Request the certificate before any buyer asks for paperwork. |
| **CE** | Certified | Issuer: European Conformity |

### AI directive — capture supplier confirmations into Product specs

When the operator shares supplier-confirmed product details over chat (WeChat
exports, gmail forwards, screenshots of WeChat conversations), **immediately
propose an `update_product` call** that writes the confirmed values to
`Product.specifications` (JSON: thickness, width, length, material, finish,
color, wearLayer, acRating, species, grade, construction, clickSystem) and/or
`Product.certifications` (JSON array of `{name, issuer, expiresAt, note}`).
Don't leave that information stranded in chat. The 2026-05-19 incident:
Alice confirmed construction, finish, AC rating, click system, and four
certifications, and the AI didn't write any of it to the product row —
the price-list PDF rendered without crucial product info because the
catalog was empty.

### The Nine-SKU Lineup

Each thickness ships from two production lines. Pick the SKU prefix by
origin: **ILMY-*** for FlorWay (Malaysia, FW brand) and **ILCN-*** for
Anhui HanHua (China, HH brand). The pre-2026-05-19 unified `IL-*` SKUs
were retired during Phase 4.28l — the AI must use the origin-prefixed
forms in every new outreach, quotation, and price list.

| Malaysia SKU (FW) | China SKU (HH) | Total Thickness | Core Layer | Pieces / Box | m² / Box | m² / HQ |
|---|---|---|---|---|---|---|
| ILMY-180x1220-6.5mm  | ILCN-180x1220-6.5mm  | 6.5 mm  | 5.5 mm  | 11 | 2.42 | 3,140 |
| ILMY-180x1220-7.0mm  | ILCN-180x1220-7.0mm  | 7.0 mm  | 6.0 mm  | 11 | 2.42 | 2,899 |
| ILMY-180x1220-7.5mm  | ILCN-180x1220-7.5mm  | 7.5 mm  | 6.5 mm  | 9  | 1.98 | 2,569 |
| ILMY-180x1220-8.0mm  | ILCN-180x1220-8.0mm  | 8.0 mm  | 7.0 mm  | 8  | 1.76 | 2,460 |
| ILMY-180x1220-8.5mm  | ILCN-180x1220-8.5mm  | 8.5 mm  | 7.5 mm  | 8  | 1.76 | 2,284 |
| ILMY-180x1220-9.0mm  | ILCN-180x1220-9.0mm  | 9.0 mm  | 8.0 mm  | 7  | 1.54 | 2,152 |
| ILMY-180x1220-10.0mm | ILCN-180x1220-10.0mm | 10.0 mm | 9.0 mm  | 7  | 1.54 | 1,998 |
| ILMY-180x1220-11.0mm | ILCN-180x1220-11.0mm | 11.0 mm | 10.0 mm | 6  | 1.32 | 1,845 |
| ILMY-180x1220-12.0mm | ILCN-180x1220-12.0mm | 12.0 mm | 11.0 mm | 6  | 1.32 | 1,713 |

All boards: 180 mm x 1220 mm plank, 0.5 mm wear layer, 1 mm IXPE underlay bonded.

---

## Performance Numbers (ISO-tested)

Use these stats verbatim. Each is the headline number from the V4 Sales Sheet stats band:

| Stat | Number | Source |
|---|---|---|
| Lighter than SPC | **41%** | 1,200 kg/m³ vs 2,050 kg/m³ |
| More m² per HQ | **1.7x** | 4,666 m² vs 2,732 m² at same weight payload |
| Lower shrinkage vs WPC | **50%** | 0.10% vs 0.20% horizontal under ISO 23999:2021 |
| Lower indentation | **22%** | 0.07 mm vs 0.09 mm (WPC) and 0.08 mm (SPC) under ISO 24343-1 |

---

## Origins (Two Production Lines, One Technology)

| Origin | Location | US Tariff | When to Recommend |
|---|---|---|---|
| **FlorWay Sdn. Bhd.** | Port Klang, Malaysia | 15.5% | All US programmes. Outside the CBP anti-circumvention enforcement zone currently constraining Vietnam and Thailand rigid-core programmes. Form D documentation holds up cleanly at USCBP. |
| **Anhui HanHua Building Materials Technology Co., Ltd.** | Anhui Province, China | 40.8% | Asian, EU, and Middle East programmes where volume and lead time matter more than US duty. Section 301 plus reciprocal stack applies to US-bound containers. |

**Default origin for US prospects: Malaysia.** Lead with FlorWay for US conversations. HanHua becomes the lead origin only for non-US buyers or where volume and lead time outweigh US duty.

---

## The Branding Model (Path A / Path B)

This is the closing offer in every IronLite Core conversation. Use these labels exactly.

**Path A — Use the IronLite Core badge.**
The badge sits in the corner of the partner's packaging the way Intel Inside, Gore-Tex, and Dolby ride along on products their inventors do not manufacture. Recommended when the partner wants a recognisable third-party technology signal.

**Path B — Rename the core under your own brand.**
The partner calls the technology whatever fits their line. The IronLite Core name and badge do not appear on any customer-facing material. **The name is not trademarked.** Recommended for partners with established technology branding of their own.

> **Headline:** "Your brand on the front. Your call on the badge."
> **Sub-headline:** "Two paths. One core technology."

---

## HGTV Citation (Approved Wording)

This engineered three-layer SPC technology has been featured on HGTV's *Rock the Block* (2022) and *Unsellable Houses* (2024).

Use this wording verbatim in marketing copy, sales sheets, LinkedIn posts, and email signatures where an HGTV credibility cue helps the audience. Do not name the brand the show featured.

---

## Approved Cold Email Openers

Four sanctioned variants, each tuned for a different audience. Use whichever fits the recipient. Do not invent new openers without Alex's approval.

**A. Freight cost angle (general distributor and importer audience)**
> We have a three-layer SPC core out of Malaysia engineered to ship 41% lighter than conventional SPC, which puts roughly 1.7x more m² in a HQ and about $0.76/m² back on your landed cost.

**B. US tariff angle (best for US buyers facing Section 301 or CBP scrutiny)**
> Programmes running Vietnamese or Thai rigid-core are getting hit with CBP holds. Our Malaysian factory is at 15.5% US duty on a three-layer SPC core with clean Form D documentation.

**C. Path A/B branding angle (best for private-label partners)**
> Our Malaysian factory makes a three-layer rigid SPC core available either as an ingredient brand on your box, the way Intel Inside or Gore-Tex ride along, or fully rebrandable under your own technology name.

**D. Engineering angle (best for product, technical, and spec audiences)**
> There's a three-layer SPC core out of Malaysia at 1,200 kg/m³ that hits 41% lighter than conventional SPC, 22% lower indentation under ISO 24343-1, and walks like an engineered wood underfoot.

---

## Sales Talking Points (What Doesn't Fit on a Spec Sheet)

Three benefits the end customer feels but the spec sheet cannot prove. Use these in conversation and longer-form copy.

**Stronger clicks.** Single-layer rigid cores fail at the click joint when stressed. With IronLite Core, click stress distributes across two SPC layers separated by a WPC shock absorber. Edges do not shear under heavy traffic or moving furniture. Fewer warranty calls.

**Warmer underfoot.** The WPC middle layer gives boards the acoustic and tactile feel of real engineered wood. Conventional SPC sounds hollow and feels cold. Boards with IronLite Core walk like a hardwood. End consumers feel it on the first step.

**Super anti-scratch UV finish.** Dropped objects damage conventional WPC finishes easily. The factory's super anti-scratch UV topcoat survives stiletto heels, dog claws, and dragged kitchen chairs. The realities of household life.

---

## Voice Rules (Hard Constraints)

When generating any IronLite Core copy, the assistant must:

1. **Never mention "JetCore"** in any customer-facing output, regardless of context, question, or follow-up. If a prospect names JetCore, deflect by describing IronLite Core on its own merits. Do not confirm, deny, or compare to JetCore.
2. **Never claim a US trademark on the IronLite Core name.** The name is deliberately unprotected so partners can rebrand.
3. **Never use the phrase "trader" or "middleman"** to describe FlorWay, HanHua, or Sovern's relationship to either factory. Use "our Malaysian factory," "our China factory," "factory-direct," or "the production line we represent."
4. **Default origin for US buyers is Malaysia.** Lead with FlorWay. Mention HanHua only when the audience is non-US or when volume or lead time is the explicit driver.
5. **Default plank dimension is 180 mm x 1220 mm.** Only quote alternative dimensions when the prospect explicitly asks.
6. **Use British English spellings** in all customer-facing copy (organise, finalise, colour, programme, metre, fibre, behaviour, optimisation).
7. **Never use the em-dash character (—).** Use commas, periods, semicolons, colons, or parentheses.
8. **Use the V4 stats verbatim.** Do not round or paraphrase the four headline numbers (41%, 1.7x, 50%, 22%).
9. **HGTV is cited using the Option 2 wording above and no other phrasing.** Do not name the show's branded product.
10. **Never mention commission, sourcing fee, buying commission, agency fee, markup, or any percentage tied to Sovern's compensation.** Never quote, hint at, or confirm a commission rate in any customer-facing output. If a prospect asks how Sovern is paid, deflect: "Alex will confirm our commercial terms with you directly."

---

## Internal-Only Notes (Never Surface to Buyers)

The following facts are for assistant context only. They must never appear in any output the buyer sees.

- **JetCore is a parallel ingredient brand on the same production line.** The same engineered core ships under that name through other distributors. Treat as confidential industry context. Never confirm or compare on the record.
- **Click system: drop-down click.** Standard across all 9 SKUs. Only volunteer this detail if the buyer specifically asks about the click mechanism. Do not lead with it in copy or openers.
- **HGTV citation history:** The product that appeared on *Rock the Block* (Season 3, premiered 28 February 2022) and *Unsellable Houses* (Season 4, premiered 10 September 2024) was branded JetCore on screen. The approved citation language is deliberately brand-agnostic for this reason.
- **The IronLite Core name is unregistered by design.** Partners are encouraged to rebrand under Path B. The technology, not the trademark, is the value.

---

## Quick-Reference Cheat Sheet

| Need to write... | Pull from... |
|---|---|
| Sales sheet headline | "SPC Redefined. The strength of iron, the lightness of air. Inside." |
| Stats band | 41% lighter, 1.7x more m² per HQ, 50% lower shrinkage, 22% lower indentation |
| Construction summary | Three engineered layers (SPC wear, WPC middle, SPC stability) plus 1 mm IXPE underlay bonded |
| US tariff line | "15.5% US duty out of Malaysia, clean Form D documentation" |
| Branding offer | Path A (IronLite Core badge) or Path B (rebrand under your own name, not trademarked) |
| HGTV cue | "Featured on HGTV's Rock the Block (2022) and Unsellable Houses (2024)" |
| Contact | Alexander McConnell, Country Manager U.S.A / Canada, alexflorway@gmail.com, +886 970 781 818 |
