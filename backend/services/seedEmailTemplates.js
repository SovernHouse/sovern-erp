/**
 * Seed FlorWay outreach email templates on boot, and backfill existing
 * null-brandCode templates to brandCode='SH'.
 *
 * Both operations are idempotent:
 *  - Backfill: UPDATE WHERE brandCode IS NULL (no-op after first run)
 *  - FW templates: checked by exact name before creating
 *
 * Copy guidelines applied to FW templates:
 *  - FlorWay (not Sovern House), Malaysia base
 *  - ASEAN sourcing angle (Vietnam, Thailand, Malaysia)
 *  - Tariff / antidumping avoidance framing per market
 *  - No em dashes in body or subject
 *  - [Trigger] placeholder for personalisation line
 */

const FW_TEMPLATES = [
  {
    name: 'FlorWay - US Flooring Importers (Touch 1)',
    subject: 'LVT / SPC sourcing - ASEAN factories, no Section 301',
    bodyText: `Hi [Name],

[Trigger - e.g., "Noticed [Company] imports LVT from China. The Section 301 exposure on that category has been compounding."]

FlorWay is a flooring trading company based in Malaysia. We source LVT, SPC, WPC, and engineered wood from certified factories in Vietnam, Thailand, and Malaysia. All outside the Section 301 tariff scope.

CARB Phase 2 and FloorScore certification documentation handled at origin. Pre-shipment QC on every order. Factory pricing direct, no agent layer.

Kindly share your current specs and target FOB and we will come back with factory options within 48 hours.`,
    brandCode: 'FW',
    category: 'flooring',
  },
  {
    name: 'FlorWay - EU Flooring Importers (Touch 1)',
    subject: 'SPC / LVT from ASEAN - CE certified, no antidumping exposure',
    bodyText: `Hi [Name],

[Trigger - e.g., "Saw [Company] distributes flooring across [market]. The EU antidumping duties on Chinese LVT have been a real sourcing pressure."]

FlorWay is a flooring trading company based in Malaysia. We source SPC, LVT, and engineered wood from certified factories in Vietnam and Thailand. CE and ISO documentation handled at source, no EU antidumping exposure on the product.

We work with European distributors and project buyers moving supply out of China while keeping lead times and specification compliance intact.

Kindly advise a suitable time for a brief call and we will come prepared with factory options and pricing for your current range.`,
    brandCode: 'FW',
    category: 'flooring',
  },
  {
    name: 'FlorWay - UK Flooring Importers (Touch 1)',
    subject: 'SPC / LVT sourcing - ASEAN factories, UKCA documentation',
    bodyText: `Hi [Name],

[Trigger - e.g., "Came across [Company] through [source]. The product range looks well-established."]

FlorWay is a flooring trading company based in Malaysia. We source SPC, LVT, WPC, and engineered wood from certified factories in Vietnam and Thailand. UKCA documentation handled at source, pre-shipment QC on every production run.

Kindly share the product categories and target prices you would like sourced and we will come back with factory options within 48 hours.`,
    brandCode: 'FW',
    category: 'flooring',
  },
  {
    name: 'FlorWay - Australia / NZ Flooring Importers (Touch 1)',
    subject: 'LVT / SPC sourcing from ASEAN - short lead times to ANZ',
    bodyText: `Hi [Name],

[Trigger - e.g., "Noticed [Company] distributes flooring across [state / NZ]. The product range looks well-positioned."]

FlorWay is a flooring trading company based in Malaysia. We source LVT, SPC, WPC, and engineered wood from certified factories in Vietnam, Thailand, and Malaysia. Competitive FOB pricing, short freight lead times to Australian and NZ ports, full compliance documentation.

Kindly share your current volume targets and product specs and we will come back with factory options within 48 hours.`,
    brandCode: 'FW',
    category: 'flooring',
  },
  {
    name: 'FlorWay - LATAM Flooring Importers (Touch 1)',
    subject: 'LVT / SPC desde Asia - fabricas certificadas',
    bodyText: `Hi [Name],

[Trigger - e.g., "Noticed [Company] distributes flooring across [country / region]."]

FlorWay is a flooring trading company based in Malaysia. We source LVT, SPC, and engineered wood direct from certified factories in Vietnam and Thailand. Competitive FOB pricing, pre-shipment QC, and full export documentation included.

Happy to continue in Spanish or Portuguese if easier.

Kindly share your current specs and target landed cost and we will come back with factory options within 48 hours.`,
    brandCode: 'FW',
    category: 'flooring',
  },
  {
    name: 'FlorWay - Middle East Flooring Importers (Touch 1)',
    subject: 'LVT / SPC / parquet - ASEAN sourcing, CIF Gulf',
    bodyText: `Dear [Name / Team],

[Trigger - e.g., "Noticed [Company] distributes flooring across [country]. The hospitality and project pipeline in the region looks active."]

FlorWay is a flooring trading company based in Malaysia. We source LVT, SPC, WPC, parquet, and engineered wood from certified factories in Vietnam, Thailand, and Malaysia. Competitive CIF pricing to Gulf ports, pre-shipment QC, full documentation.

Kindly advise a suitable time for a call and we will come prepared with factory options and pricing for your current product needs.`,
    brandCode: 'FW',
    category: 'flooring',
  },
];

async function seedFWEmailTemplatesIfEmpty(db) {
  // Backfill legacy templates (created before brandCode column existed) to SH.
  await db.EmailTemplate.update(
    { brandCode: 'SH' },
    { where: { brandCode: null } },
  );

  // Create FW templates idempotently — skip any that already exist by name.
  for (const tpl of FW_TEMPLATES) {
    const existing = await db.EmailTemplate.findOne({ where: { name: tpl.name } });
    if (!existing) {
      await db.EmailTemplate.create(tpl);
    }
  }
}

module.exports = { seedFWEmailTemplatesIfEmpty };
