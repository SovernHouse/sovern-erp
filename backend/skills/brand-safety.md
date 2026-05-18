# Brand Safety — Rule #9 Gateway Pattern

**Load when:** writing or reviewing any code that renders, sends, or persists an artifact that carries a Sovern brand identity — PDFs, emails, signatures, document headers/footers, customer-portal logos, brand-aware copy, anything a buyer or supplier sees that says "this is from <brand>".

**Why this exists:** rule #9 ("Resilient flooring is FW or HH, never SH; brand context must be explicit, asserted at render time, never default to SH") has been violated TWICE in 36 hours via different code paths:

1. **2026-05-17 — PriceList PDF brand leak (L-068).** Sequelize includes loaded `attributes: ['id', 'companyName']` for Customer + Factory, omitting `brandCode`. Renderer fell through to `'SH'` default. PDF rendered with SH logo + sender + Taiwan footer on an FW IronLite price list.
2. **2026-05-18 — BPI outreach brand leak.** MCP `send_outreach_email` omitted `fromDisplayName` and loaded a brand-agnostic `EmailSignature` default. 17 FW outreach emails went out with `From: "Sovern House | Alex"` + the SH "Your buying office in Asia" signature. Surfaced when BPI's auto-responder echoed our display name back.

Two incidents, two different code paths, same root cause: **a renderer combined brand-sourced inputs without asserting they ALL agreed on the same brand before shipping.** This skill captures the durable contract so the next renderer is born with the lock and no third incident happens.

---

## The Gateway Contract

**Every code path that produces a brand-bearing artifact MUST satisfy all four conditions before the artifact reaches a recipient:**

1. **Brand declared, not inferred.** The artifact carries an explicit `brandCode` field that was resolved at the entity level (Lead, Quotation, PriceList, etc.), not derived per-render. If `brandCode` is null at render time, REFUSE — don't fall through to a default.

2. **All brand-sourced inputs agree.** The renderer must verify that every brand-sourced input (logo URL, sender email, From display name, signature HTML, footer legal text, signature text, brand badge colors, currency, footer URL) came from the SAME Brand row. Mixing fields from two brands = REFUSE.

3. **Body content matches brand voice.** When the body is operator/AI-authored, the renderer must scan for foreign-brand identity markers and refuse if any are present. The regex set is documented below.

4. **Single gateway, not scattered checks.** The assertion lives at the service boundary (one function per surface), not in every caller. Callers cannot bypass it. The gateway throws a typed error (e.g. `BrandLeakError`) the caller surfaces as 422 / a clear MCP refusal / a clear chatter event.

The first three are WHAT to check. The fourth is HOW to enforce it — a single chokepoint that every render call goes through, not "remembered" by every developer to add a check.

---

## Identity Markers — the words that must not cross brands

This is the regex/string set every brand-safety gateway should use when scanning body or signature content. Update it whenever a new brand artifact (URL, phone, legal name, tagline) gets coined.

### Sovern House (SH) markers — must NOT appear in FW or HH outbound

- `Sovern House`, `Sovern\s*House` (any spacing)
- `sovernhouse.co`, `sovernhouse\.co`
- `Your buying office in Asia` — SH tagline
- `New Route International Exchange` — SH legal entity name
- `alex@sovernhouse.co` — SH sender email
- `alex-signature@2x.png` — SH signature image filename
- `sovern-wordmark-email-light.png` — SH wordmark image filename
- SH primary color `#1D5A32` referenced verbatim in inline styles (less common, but worth flagging when reviewing)

### FlorWay (FW) markers — must NOT appear in SH or HH outbound

- `FlorWay`, `Flor\s*Way`
- `FlorWay Sdn. Bhd.`, `FlorWay Sdn\.\s*Bhd\.`
- `Country Manager, U.S.A/Canada` (the FW signature title)
- `alexflorway@gmail.com` — shared with HH, so this marker alone doesn't prove an FW leak (see HH below)
- FW primary color `#0F5F3A` referenced verbatim

### HanHua (HH) markers — must NOT appear in SH or FW outbound

- `HanHua`, `Han\s*Hua`
- `Anhui HanHua Building Materials Technology`
- `alexflorway@gmail.com` — shared sender with FW. The combination of `alexflorway@gmail.com` + an HH-only marker (HanHua legal name, HH product line names) identifies an HH artifact.
- HH primary color `#9C2A2A` (placeholder — verify current value)

### Directional asymmetry — FW <-> HH co-mention is allowed

FW and HH are sister factories under the Resilient family. Their seeded brand signatures intentionally co-mention each other ("FlorWay Sdn. Bhd. (Malaysia)" + "Anhui HanHua Building Materials Technology Co., Ltd. (China)"). The rule #9 model is:

- **SH content MUST NOT contain FW or HH markers** (operator separation — buyers see SH as an independent buying house, not connected to the factories)
- **FW content MUST NOT contain SH markers** (no buying-house framing)
- **HH content MUST NOT contain SH markers** (no buying-house framing)
- **FW <-> HH co-mention IS allowed** (Resilient family disclosure — buyers see one factory operator running both Malaysian + Chinese lines)

`brandSafetyGateway.assertNoForeignMarkers` implements this asymmetry. Don't expand it to forbid FW <-> HH without explicit operator approval — that would force re-authoring every signature.

### Shared FW+HH markers (resilient-flooring umbrella, NOT SH)

- "Engineered SPC", "IronLite Core", "IronLite Core Technology", "JetCore" — these technologies are FW/HH ONLY. If they appear in a body that carries SH branding in the header/signature, that's a leak.
- "factory-direct from Malaysia", "factory in Malaysia", "Malaysia-origin", "CPTPP certificate of origin" — FW-specific framing. SH outreach does NOT use these phrases.
- "factory in China" with resilient flooring context — HH-specific.

---

## The Resilient → FW/HH lock (special case of rule #9)

Resilient flooring is structurally never SH. Encode this independently of the gateway above:

**Product surface:** Resilient ProductCategory subtree contains LVT, SPC, WPC, Engineered SPC, Vinyl Sheet, Rigid Core Vinyl. Every Product under that subtree must have `brandCode in (FW, HH)`. The DB enforces this via the `ProductCategory.default_brand` column (Phase 4.20, migrate420ProductCategoryDefaultBrand).

**Lead surface:** if `Lead.productInterests` contains any resilient slug (`lvt`, `spc`, `wpc`, `engineered-spc`, `vinyl-sheet`, `rigid-core-vinyl`), `Lead.brandCode` MUST be FW or HH. Backfill migration `migrate417ResilientBrandCorrection` corrected 38 such leads on 2026-05-18; the gateway lock prevents new ones.

**PriceList surface:** if any PriceListItem points at a Product in the Resilient subtree, PriceList.brandCode MUST be FW or HH. `priceListBrandResolver.assertBrandSafe()` (Phase 4.28d) enforces.

**Quotation / SO / PI / Invoice surface:** if any line item is a Resilient product, the parent entity's `brandCode` MUST be FW or HH. Gateway TODO (Phase 4.x — see audit task list).

**Outreach surface:** if the Lead is resilient (Lead.brandCode in FW/HH, or any item or association implies resilient), every OutreachEmail tied to that Lead MUST have `brand_code in (FW, HH)` AND the rendered signature/From display MUST agree (rule #9 gateway in `sendOutreachEmail`).

---

## Where the gateways live (current state, 2026-05-18)

| Surface | Gateway location | Lock status | Regression test |
|---|---|---|---|
| PriceList PDF render | `services/priceListBrandResolver.assertBrandSafe()` | ✅ Locked (L-068, 2026-05-17) | `phase428dPriceListBrandLeak.test.js` |
| PriceList email send | Inherits PDF gateway + email gateway | ✅ Locked | (above) |
| Outreach email send (REST) | `controllers/outreachController.resolveBrandForOutreachOrThrow` + `services/emailService.sendOutreachEmail` gateway | ✅ Locked (2026-05-18) | `phase417LeadDraftCanonical.test.js`, `outreachBrandLeakGateway.test.js` |
| Outreach email send (MCP) | Same emailService gateway after the 2026-05-18 BPI fix | ✅ Locked | `outreachBrandLeakGateway.test.js` |
| Lead brand override | `services/aiWriteServices/leadWriteService` super_admin override path | ✅ Locked (commit `ec1b62b`) | `phase417SuperAdminBrandOverride.test.js` |
| Quotation PDF render | None today | ❌ UNPROTECTED | none |
| Quotation email send | None today | ❌ UNPROTECTED | none |
| ProformaInvoice PDF | None today | ❌ UNPROTECTED | none |
| ProformaInvoice email | None today | ❌ UNPROTECTED | none |
| SalesOrder confirmation email | None today | ❌ UNPROTECTED | none |
| SalesOrder PDF | None today | ❌ UNPROTECTED | none |
| PurchaseOrder PDF | Goes to factory (less buyer-side leak risk) | ⚠️ Lower priority | none |
| Invoice PDF | None today | ❌ UNPROTECTED | none |
| Invoice email | None today | ❌ UNPROTECTED | none |
| PackingList PDF | None today | ❌ UNPROTECTED | none |
| Shipment notification email | None today | ❌ UNPROTECTED | none |
| Inspection report PDF | None today | ❌ UNPROTECTED | none |
| Triage / RFQ ack email | None today | ❌ UNPROTECTED | none |
| Transactional email wrapper (welcome, reset, digest) | None today (SH-only by design but should still assert) | ⚠️ Lower priority | none |

Locks marked UNPROTECTED are the audit backlog. Each one is a future L-068-class incident waiting for the right combination of resilient lead + AI-driven send.

---

## How to add a new gateway (template)

```js
// Service: every renderer for a brand-bearing artifact lives in a
// service file with a single `assertBrandSafe` checkpoint. Callers
// (REST, MCP, batch jobs) all funnel through this one function.

class BrandLeakError extends Error {
  constructor(message, { entityId, brandCode, leakField } = {}) {
    super(message);
    this.name = 'BrandLeakError';
    this.entityId = entityId;
    this.brandCode = brandCode;
    this.leakField = leakField;
  }
}

const SH_IDENTITY_MARKERS = /(Sovern\s*House|sovernhouse\.co|Your\s+buying\s+office\s+in\s+Asia|New\s+Route\s+International\s+Exchange|alex@sovernhouse\.co)/i;
const FW_IDENTITY_MARKERS = /(\bFlorWay\b|FlorWay\s+Sdn\.\s*Bhd\.|Country\s+Manager,\s*U\.S\.A\/Canada)/i;
const HH_IDENTITY_MARKERS = /(\bHanHua\b|Anhui\s+HanHua\s+Building)/i;

function assertBrandSafe(artifact, { brandCode, expectedDisplayName }) {
  if (!brandCode) {
    throw new BrandLeakError(
      `Refusing to render: brandCode is required and was not provided. ` +
      `Resolve the brand at the entity level and pass it through.`,
      { leakField: 'brandCode' }
    );
  }

  // Display fields must agree
  if (artifact.fromDisplayName && expectedDisplayName) {
    if (artifact.fromDisplayName !== expectedDisplayName) {
      throw new BrandLeakError(
        `Refusing to render: fromDisplayName="${artifact.fromDisplayName}" ` +
        `does not match brand "${brandCode}" (expected "${expectedDisplayName}"). Rule #9.`,
        { brandCode, leakField: 'fromDisplayName' }
      );
    }
  }

  // Content fields must not contain foreign-brand markers
  const fields = ['subject', 'bodyText', 'signatureHtml', 'signatureText', 'footerLegalText'];
  for (const field of fields) {
    const value = artifact[field];
    if (!value) continue;

    if (brandCode !== 'SH' && SH_IDENTITY_MARKERS.test(value)) {
      throw new BrandLeakError(
        `Refusing to render: ${field} for brand "${brandCode}" contains Sovern House identity markers. Rule #9.`,
        { brandCode, leakField: field }
      );
    }
    if (brandCode !== 'FW' && FW_IDENTITY_MARKERS.test(value)) {
      throw new BrandLeakError(
        `Refusing to render: ${field} for brand "${brandCode}" contains FlorWay identity markers. Rule #9.`,
        { brandCode, leakField: field }
      );
    }
    if (brandCode !== 'HH' && HH_IDENTITY_MARKERS.test(value)) {
      throw new BrandLeakError(
        `Refusing to render: ${field} for brand "${brandCode}" contains HanHua identity markers. Rule #9.`,
        { brandCode, leakField: field }
      );
    }
  }
}

module.exports = { assertBrandSafe, BrandLeakError };
```

Drop this into a new service file per surface, OR centralise as `services/brandSafetyGateway.js` and import everywhere. The centralised version is the right call once we have a third surface using it.

---

## Regression test template

Every gateway gets a regression test that PROVES the lock holds. Mirror `outreachBrandLeakGateway.test.js`:

```js
const { sendXEmail } = require('../../services/xEmailService');

describe('X email brand-leak gateway (rule #9 / L-068)', () => {
  test('refuses FW send when fromDisplayName is the SH default', async () => {
    await expect(sendXEmail({
      brandCode: 'FW', brandDisplayName: 'FlorWay',
      fromDisplayName: 'Sovern House | Alex',  // wrong
      /* ... */
    })).rejects.toThrow(/Brand-leak refused.*Sovern House.*FlorWay/);
  });

  test('refuses FW send when signature contains "Sovern House"', async () => {
    await expect(sendXEmail({
      brandCode: 'FW', brandDisplayName: 'FlorWay',
      fromDisplayName: 'FlorWay | Alex',
      signatureHtml: '<div>Sovern House is...</div>',
    })).rejects.toThrow(/signature.*FW.*Sovern House/i);
  });

  test('accepts a correctly-branded send', async () => {
    const result = await sendXEmail({
      brandCode: 'FW', brandDisplayName: 'FlorWay',
      fromDisplayName: 'FlorWay | Alex',
      signatureHtml: '<div>FlorWay Sdn. Bhd.</div>',
    });
    expect(result.ok).toBe(true);
  });
});
```

At minimum 3 cases per gateway: refuse on display mismatch, refuse on signature foreign-marker, accept correctly-branded.

---

## Data-state invariants (recurrent audit queries)

These are queries you run periodically (or on a cron) to catch rule #9 violations that slipped past the gateway. They cost nothing to run and surface drift quickly.

```sql
-- 1. Resilient-flooring Leads tagged SH (rule #9 violation)
SELECT l.id, l.lead_number, l.company_name, l.brand_code, l.product_interests
FROM Leads l
WHERE l.brand_code = 'SH'
  AND (
    l.product_interests LIKE '%lvt%' OR
    l.product_interests LIKE '%spc%' OR
    l.product_interests LIKE '%wpc%' OR
    l.product_interests LIKE '%vinyl-sheet%' OR
    l.product_interests LIKE '%rigid-core%'
  );

-- 2. OutreachEmail rows where brand_code disagrees with the sender
SELECT oe.id, oe.brand_code, oe.from_address, l.company_name
FROM OutreachEmails oe
LEFT JOIN Leads l ON l.id = oe.lead_id
WHERE (
  (oe.brand_code = 'SH' AND oe.from_address LIKE '%alexflorway%') OR
  (oe.brand_code IN ('FW', 'HH') AND oe.from_address LIKE '%sovernhouse%')
);

-- 3. PriceLists with brand_code disagreeing with item Product brand
-- (priceListBrandResolver catches this at render, but the data drift is worth surfacing)
SELECT pl.id, pl.name, pl.brand_code, p.brand_code AS item_brand, COUNT(*) AS items
FROM PriceList pl
JOIN PriceListItem pli ON pli.price_list_id = pl.id
LEFT JOIN Product p ON p.id = pli.product_id
WHERE p.brand_code IS NOT NULL AND p.brand_code != pl.brand_code
GROUP BY pl.id, p.brand_code;

-- 4. Quotation / SO / PI / Invoice with a Resilient product line but brand_code = SH
-- (gateway TODO; data audit catches what's already in the table)
```

Run these monthly until every entity in the system has a render-time gateway, then drop to quarterly.

---

## Process rules

1. **Every new renderer or sender added to the codebase MUST cite this skill in its PR.** No exceptions. The PR description must include either "renders artifact X for brand Y, gateway at <file:line>" or an explicit "this is not brand-bearing because <reason>."

2. **Before declaring a render fix done:** run the regression test, hand-verify against at least one brand-correct AND one brand-incorrect input.

3. **When extending the identity marker regex:** add every brand artifact (URL, image filename, legal name, tagline, sender email) to the marker set the FIRST time it's coined. Don't wait for a leak to discover what should have been there.

4. **When extending brands:** adding a fourth brand (HH joined the family in Phase 4.9) means updating the identity marker map for all THREE existing brands to exclude the new one. Audit every gateway file when a new Brand row is created.

5. **Operator policy on a confirmed leak:** the standard play is "stop the bleeding, don't follow up." A corrective email confirms the cross-brand relationship to every recipient, which is usually worse than the breach itself. Mark affected leads for hand-handling (Lead.tags += 'brand-leak-post-mortem-YYYY-MM-DD'); handle re-introduction by phone or fresh same-brand-only message at next-touch time.

---

## Reading order when reviewing brand-bearing code

1. This skill.
2. `lessons.md` L-068 (PriceList incident) + L-073 (gateway generalisation, pending).
3. `services/priceListBrandResolver.js` — reference implementation of the gateway pattern.
4. `services/emailService.js` (the `sendOutreachEmail` gateway block) — reference for the email surface.
5. The Brand model + the migration history (`migrateBrands.js`, `migrateBrandSignaturesC24.js`, `migrate420ProductCategoryDefaultBrand.js`) to understand brand resolution sources.
