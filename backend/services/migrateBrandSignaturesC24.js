/**
 * Phase 4.5, C24 — FW brand signature refresh.
 *
 * Alex's signature for the FlorWay sender (alexflorway@gmail.com) now
 * carries his Country Manager title and surfaces both the FlorWay
 * (Malaysia) trading entity AND the upstream Anhui HanHua factory
 * (China). The HTML is a Calibri/Arial table for inline-style email
 * clients; the plain-text fallback mirrors the same fields without
 * the styling.
 *
 * Idempotent via AuditLog sentinel `phase4_5_fw_signature_updated`.
 * After the sentinel exists, the migration is a no-op on every
 * subsequent boot. SH is intentionally untouched.
 *
 * seedBrands.js is updated in parallel so fresh installs (and any
 * test DB rebuild) start with the same content.
 */

const logger = require('../utils/logger');

const SENTINEL_ACTION = 'phase4_5_fw_signature_updated';

const FW_SIGNATURE_HTML = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Calibri, Arial, sans-serif; font-size: 14px; color: #1F2937; line-height: 1.45;">
  <tr>
    <td style="padding: 0;">
      <div style="font-size: 15px; font-weight: 600; color: #111827;">Alexander McConnell</div>
      <div style="font-size: 13px; color: #4B5563; margin-top: 2px;">Country Manager, U.S.A/Canada</div>
      <div style="margin-top: 10px; font-size: 13px;">
        <div style="color: #1F2937;">FlorWay Sdn. Bhd. <span style="color: #6B7280;">(Malaysia)</span></div>
        <div style="color: #1F2937;">Anhui HanHua Building Materials Technology Co., Ltd. <span style="color: #6B7280;">(China)</span></div>
      </div>
      <div style="margin-top: 10px; font-size: 12px; color: #4B5563;">
        <a href="mailto:alexflorway@gmail.com" style="color: #4B5563; text-decoration: none;">alexflorway@gmail.com</a><br>
        +886 970 781 818
      </div>
    </td>
  </tr>
</table>`;

const FW_SIGNATURE_TEXT = `Alexander McConnell
Country Manager, U.S.A/Canada

FlorWay Sdn. Bhd. (Malaysia)
Anhui HanHua Building Materials Technology Co., Ltd. (China)

alexflorway@gmail.com
+886 970 781 818`;

async function hasSentinel(db) {
  if (!db.AuditLog) return false;
  const row = await db.AuditLog.findOne({ where: { action: SENTINEL_ACTION, entity: 'System' } });
  return !!row;
}

async function writeSentinel(db, changes) {
  if (!db.AuditLog) return;
  await db.AuditLog.create({
    userId: null,
    action: SENTINEL_ACTION,
    entity: 'System',
    entityId: '00000000-0000-0000-0000-000000000000',
    changes,
    ipAddress: null,
  });
}

async function migrateBrandSignaturesC24(db) {
  if (!db.Brand) {
    logger.info('[C24] Brand model missing; skipping');
    return { skipped: true };
  }

  if (await hasSentinel(db)) {
    return { skipped: true };
  }

  const fw = await db.Brand.findOne({ where: { code: 'FW' } });
  if (!fw) {
    logger.warn('[C24] FW brand row not found; cannot apply signature refresh');
    return { skipped: true, reason: 'no_fw_row' };
  }

  const oldHtml = fw.signatureHtml;
  const oldText = fw.signatureText;

  await fw.update({
    signatureHtml: FW_SIGNATURE_HTML,
    signatureText: FW_SIGNATURE_TEXT,
  });

  await writeSentinel(db, {
    brandCode: 'FW',
    oldSignatureLength: (oldHtml || '').length,
    newSignatureLength: FW_SIGNATURE_HTML.length,
    oldTextLength: (oldText || '').length,
    newTextLength: FW_SIGNATURE_TEXT.length,
    runAt: new Date().toISOString(),
  });

  logger.info('[C24] FW brand signature updated (HTML + text)');
  return { updated: true };
}

module.exports = {
  migrateBrandSignaturesC24,
  FW_SIGNATURE_HTML,
  FW_SIGNATURE_TEXT,
};
