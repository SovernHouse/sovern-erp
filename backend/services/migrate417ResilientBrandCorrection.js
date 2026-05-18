/**
 * migrate417ResilientBrandCorrection — 2026-05-18 super-admin brand override.
 *
 * Rule #9 enforcement on existing data. The 2026-05-08 LVT/SPC outreach
 * batch + 2026-04-21..05-11 lead imports created 38 Leads tagged SH that
 * are unambiguously resilient flooring (LVT / SPC / WPC / vinyl /
 * rigid-core-vinyl in productInterests or in the draft text). Per
 * non-negotiable rule #9: "Resilient flooring is FW (Malaysia origin)
 * OR HH (China origin), NEVER SH." These leads need their brand
 * corrected to FW so future outreach (touch 2+) goes out from
 * alexflorway@gmail.com with the FW signature.
 *
 * What this migration does, per Lead in the hardcoded list:
 *   1. Snapshot the previous brandCode.
 *   2. Update Lead.brandCode = 'FW'.
 *   3. Update every OutreachEmail tied to the lead to brandCode='FW'
 *      (Alex's direction 2026-05-18: flip historical sent rows too, so
 *      reports show a clean FW picture; the from_address column still
 *      records the literal sender used at send-time so the audit trail
 *      isn't actually rewritten).
 *   4. Write a `super_admin_brand_override` AuditLog row.
 *   5. Post a `event`-type ChatterMessage on the Lead so the operator
 *      sees the correction inline with other activity.
 *
 * Idempotent via AuditLog sentinel
 * `phase4_17_resilient_brand_correction_2026_05_18`. The 38 lead IDs
 * are hardcoded so the migration is deterministic and reviewable;
 * re-running it skips on the sentinel.
 *
 * If a lead in the list is already brandCode='FW' on the row when the
 * migration runs (e.g. Alex flipped one manually first), that lead is
 * skipped without writing an audit/chatter row — no-op is safe.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_17_resilient_brand_correction_2026_05_18';
const SYSTEM_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

// Identified 2026-05-18 by querying SH leads in (new, contacted) whose
// productInterests array or draftEmailSubject/body matched
// LVT / SPC / WPC / vinyl / rigid-core-vinyl. Confirmed by Alex.
const LEAD_IDS = [
  // 2026-04-21 batch (status=contacted at time of migration)
  '47c60d6c-c374-479c-ba4f-88885c450e89', // Herregan Distributors
  '43f461ba-9841-4bfa-9d4a-f45ad0890ef5', // Home Legend LLC
  '762785b1-1148-4d95-b836-44cb44bac73d', // J.J. Haines & Company
  // The remainder of the 2026-04-21 / 04-22 / 04-23 contacted set
  // are looked up at runtime by leadNumber to keep this list short
  // AND ensure we error-out (skip cleanly) if any of the rows have
  // been moved by hand. We use leadNumber because the underlying
  // UUIDs were generated at create time and listing them here would
  // make the file unreadable.
];

// leadNumber is the human-readable LD-YYYYMMDD-NNN identifier. Matching
// on leadNumber means the migration is robust to UUID reshuffling and
// the file documents EXACTLY which leads are being corrected.
const LEAD_NUMBERS = [
  // 2026-04-21 contacted batch
  'LD-20260421-007', // Home Legend LLC
  'LD-20260421-008', // Herregan Distributors
  'LD-20260421-009', // J.J. Haines & Company
  'LD-20260421-010', // Carpet Court Australia
  'LD-20260421-011', // Choices Flooring
  'LD-20260421-012', // Flooring Xtra
  'LD-20260421-013', // Multi Company / Rollux / Floorcenter
  'LD-20260421-014', // CHC
  // 2026-04-22 LATAM batch
  'LD-20260422-009', // Importadora BS S.A.
  'LD-20260422-010', // Limatco S.A.
  'LD-20260422-011', // Revestimientos y Pisos
  'LD-20260422-012', // Maxipiso
  'LD-20260422-013', // Bluemat S.A.
  'LD-20260422-014', // The Flooring Company
  // 2026-04-23
  'LD-20260423-002', // CarpetLAND
  // 2026-05-10 batch (status=new)
  'LD-20260510-001', // XL Flooring Co Ltd
  'LD-20260510-002', // Twelve Oaks Fine Flooring
  'LD-20260510-003', // Primco Limited
  'LD-20260510-004', // Metropolitan Hardwood Floors Inc.
  'LD-20260510-005', // Goodfellow Inc.
  'LD-20260510-007', // Vidar Design Flooring
  'LD-20260510-008', // Shnier, A Gesco Company
  // 2026-05-11 batch (status=new)
  'LD-20260511-001', // Unico Flooring Distributors, Inc.
  'LD-20260511-002', // Ohio Valley Flooring
  'LD-20260511-003', // Ultimate Floors Inc.
  'LD-20260511-004', // ELLIE Cabinetry and More
  'LD-20260511-005', // CPF Floors LLC
  'LD-20260511-006', // Apollo Distributing Company
  'LD-20260511-007', // NRF Distributors, Inc.
  'LD-20260511-008', // Building Plastics, Inc. (BPI)
  'LD-20260511-009', // Republic Floor
  'LD-20260511-010', // Choice Flooring Distributors, LLC
  'LD-20260511-011', // Carolina Wholesale Floors
  'LD-20260511-012', // Urban Surfaces
  'LD-20260511-013', // Vanwood Floors
  'LD-20260511-014', // Floors @ Work
  'LD-20260511-015', // Dragona Flooring & Supplies
  'LD-20260511-016', // Stevens Omni
];

async function migrate417ResilientBrandCorrection(db) {
  if (!db?.sequelize) return { skipped: true };
  if (!db.AuditLog || !db.Lead || !db.OutreachEmail || !db.ChatterMessage) {
    logger.warn('[phase4_17_resilient] required models unavailable; skipping');
    return { skipped: true };
  }

  const sentinel = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION } });
  if (sentinel) return { skipped: true, reason: 'sentinel-present' };

  const stats = {
    targetedByLeadNumber: LEAD_NUMBERS.length,
    leadsFound: 0,
    leadsFlippedToFW: 0,
    leadsAlreadyFW: 0,
    leadsMissing: [],
    outreachRowsRelabeled: 0,
  };

  const { Op } = require('sequelize');
  const leads = await db.Lead.findAll({
    where: { leadNumber: { [Op.in]: LEAD_NUMBERS } },
  });
  stats.leadsFound = leads.length;
  const foundNumbers = new Set(leads.map((l) => l.leadNumber));
  stats.leadsMissing = LEAD_NUMBERS.filter((n) => !foundNumbers.has(n));

  for (const lead of leads) {
    if (lead.brandCode === 'FW') {
      stats.leadsAlreadyFW += 1;
      continue;
    }
    const before = { brandCode: lead.brandCode };

    // 1. Flip the Lead's brand.
    await lead.update({ brandCode: 'FW' });

    // 2. Relabel every OutreachEmail tied to the lead. Per Alex's
    //    direction on 2026-05-18: include historical sent rows so the
    //    brand picture on reports is clean. The from_address column
    //    is NOT modified — the literal sender used at send-time
    //    survives, so audit-trail integrity is preserved for the
    //    actual SMTP transaction even though the brand label flips.
    const [outreachCount] = await db.sequelize.query(
      'UPDATE OutreachEmails SET brand_code = ? WHERE lead_id = ?',
      { replacements: ['FW', lead.id] },
    );
    // SQLite returns the changed rows count via `outreachCount`; on this
    // dialect Sequelize wraps as { changes: N } or returns N depending
    // on driver version. Fall back to a follow-up count if needed.
    let relabeled = (outreachCount && typeof outreachCount === 'object' && outreachCount.changes != null)
      ? outreachCount.changes
      : (typeof outreachCount === 'number' ? outreachCount : null);
    if (relabeled == null) {
      relabeled = await db.OutreachEmail.count({ where: { leadId: lead.id, brandCode: 'FW' } });
    }
    stats.outreachRowsRelabeled += relabeled;

    // 3. AuditLog (super_admin_brand_override is the rule #9 audit shape).
    await db.AuditLog.create({
      action: 'super_admin_brand_override',
      entity: 'Lead',
      entityId: lead.id,
      userId: null,  // system-driven correction; no individual super_admin
      changes: {
        from: before.brandCode,
        to: 'FW',
        reason: 'rule-9-resilient-flooring-correction-2026-05-18',
        leadNumber: lead.leadNumber,
        companyName: lead.companyName,
        outreachRowsRelabeled: relabeled,
        triggeredBy: 'migrate417ResilientBrandCorrection',
      },
    });

    // 4. Chatter event so the correction is visible on the Lead detail page.
    await db.ChatterMessage.create({
      entityType: 'Lead',
      entityId: lead.id,
      messageType: 'event',
      body: `Brand corrected: ${before.brandCode} → FW. Reason: resilient flooring (LVT / SPC / WPC / vinyl) is FW (Malaysia origin), never SH (rule #9). ${relabeled} OutreachEmail row${relabeled === 1 ? '' : 's'} re-labelled.`,
      userId: null,
      authorName: 'System',
      metadata: {
        kind: 'brand_correction',
        from: before.brandCode,
        to: 'FW',
        outreachRowsRelabeled: relabeled,
      },
      attachments: [],
    }).catch(() => {});

    stats.leadsFlippedToFW += 1;
    logger.info(`[phase4_17_resilient] ${lead.leadNumber} ${lead.companyName}: SH → FW (${relabeled} outreach rows)`);
  }

  await db.AuditLog.create({
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: SYSTEM_ENTITY_ID,
    userId: null,
    changes: stats,
  });

  logger.info(`[phase4_17_resilient] complete: ${JSON.stringify(stats)}`);
  return stats;
}

module.exports = { migrate417ResilientBrandCorrection, SENTINEL_ACTION, LEAD_NUMBERS };
