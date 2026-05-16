/**
 * complianceWriteService — Phase 4.15d-2b-1.
 *
 * Wraps the existing modules/compliance controller logic so the AI
 * assistant can run compliance lookups and calculations from chat.
 * This sub-phase covers READ + STATELESS-CALC tools only:
 *
 *   - checkCompliance        — rule-based check (anti-dumping / CPSC /
 *                              CE marking / customs). No DB writes.
 *   - lookupHsCodes          — search HarmonizedCode catalog
 *   - calculateDuties        — duty + anti-dumping rate × unit price ×
 *                              quantity. Reads HarmonizedCode for the
 *                              hsCode + countrySpecific override.
 *   - listComplianceRecords  — filtered list
 *   - getComplianceRecord    — single row
 *   - listCertificatesOfOrigin / getCertificateOfOrigin — read-only
 *
 * Write tools (createComplianceRecord, updateComplianceRecord,
 * createHsCode, generateCertificateOfOrigin) are deferred to
 * 4.15d-2b-2. The CO generation flow already has a brand-aware MCP
 * tool (erp_generate_certificate_of_origin_pdf, Phase 4.15a).
 *
 * The rule-based checkCompliance replicates the controller's logic
 * verbatim rather than shimming req/res. Net: ~30 lines duplicated,
 * but the alternative (req/res shim, intercept res.json, plumb through
 * the audit) is fragile and adds 60+ lines of indirection.
 */

const { Op } = require('sequelize');
const db = require('../../models');

function err(code, httpStatus, message) {
  return { ok: false, code, httpStatus, message };
}

// EU member states for CE-marking detection. Mirrors the controller's
// hard-coded list. Centralising here so the MCP path and the REST path
// agree on what counts as "EU market" without one drifting from the
// other.
const EU_DESTINATIONS = new Set([
  'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'DK', 'FI', 'SE', 'NO',
]);

// ── checkCompliance ───────────────────────────────────────────────────

async function checkCompliance(payload) {
  const { shipmentId, productId, countryOrigin, countryDestination } = payload || {};
  if (!shipmentId && !productId) {
    return err('validation', 400, 'Either shipmentId or productId is required');
  }
  if (!countryOrigin || !countryDestination) {
    return err('validation', 400, 'countryOrigin and countryDestination are required');
  }

  const origin = String(countryOrigin).toUpperCase();
  const destination = String(countryDestination).toUpperCase();
  const requirements = [];
  const complianceChecks = {
    antiDumping: false,
    cpsc: false,
    ceMarking: false,
    customs: true,
  };

  // Anti-dumping: CN → US
  if (origin === 'CN' && destination === 'US') {
    complianceChecks.antiDumping = true;
    requirements.push({
      type: 'anti_dumping',
      description: 'Anti-dumping duties apply for Chinese origin products to US market',
      dutyRate: 241,
      antiDumpingRate: 305,
      riskLevel: 'high',
    });
  }

  // CPSC for US market
  if (destination === 'US') {
    complianceChecks.cpsc = true;
    requirements.push({
      type: 'cpsc',
      description: 'CPSC certification required for US market',
      riskLevel: 'medium',
    });
  }

  // CE marking for EU
  if (EU_DESTINATIONS.has(destination)) {
    complianceChecks.ceMarking = true;
    requirements.push({
      type: 'ce_marking',
      description: 'CE marking required for EU market',
      riskLevel: 'high',
    });
  }

  // Customs always required
  requirements.push({
    type: 'customs',
    description: 'Standard customs documentation required',
    riskLevel: 'medium',
  });

  return {
    ok: true,
    check: {
      shipmentId: shipmentId || null,
      productId: productId || null,
      countryOrigin,
      countryDestination,
      requirements,
      complianceChecks,
      riskLevel: requirements.some(r => r.riskLevel === 'high') ? 'high' : 'medium',
    },
  };
}

// ── lookupHsCodes ─────────────────────────────────────────────────────

async function lookupHsCodes(filters) {
  filters = filters || {};
  const where = {};
  if (filters.chapter) where.chapter = filters.chapter;
  if (filters.search) {
    where[Op.or] = [
      { code: { [Op.like]: `%${filters.search}%` } },
      { description: { [Op.like]: `%${filters.search}%` } },
    ];
  }
  const rows = await db.HarmonizedCode.findAll({
    where,
    limit: Math.min(filters.limit || 25, 100),
    order: [['code', 'ASC']],
  });
  return { ok: true, hsCodes: rows };
}

// ── calculateDuties ───────────────────────────────────────────────────

async function calculateDuties(payload) {
  const { hsCode, countryOrigin, countryDestination, unitPrice, quantity } = payload || {};
  if (!hsCode) return err('validation', 400, 'hsCode is required');
  if (!countryOrigin) return err('validation', 400, 'countryOrigin is required');
  if (!countryDestination) return err('validation', 400, 'countryDestination is required');

  const harmonizedCode = await db.HarmonizedCode.findOne({ where: { code: hsCode } });
  if (!harmonizedCode) {
    return err('not_found', 404,
      `HS code "${hsCode}" not found. Use erp_lookup_hs_codes with a chapter or description search to find the right code.`);
  }

  let dutyRate = parseFloat(harmonizedCode.dutyRate || 0);
  let antiDumpingRate = parseFloat(harmonizedCode.antiDumpingRate || 0);

  // Country-specific overrides take precedence over the base rate.
  const originUpper = String(countryOrigin).toUpperCase();
  if (harmonizedCode.countrySpecific && harmonizedCode.countrySpecific[originUpper]) {
    const cs = harmonizedCode.countrySpecific[originUpper];
    if (cs.dutyRate != null) dutyRate = parseFloat(cs.dutyRate);
    if (cs.antiDumpingRate != null) antiDumpingRate = parseFloat(cs.antiDumpingRate);
  }

  const totalDutyRate = dutyRate + antiDumpingRate;
  const dutyAmount = (unitPrice != null && quantity != null)
    ? (parseFloat(unitPrice) * parseInt(quantity, 10) * totalDutyRate / 100)
    : 0;

  return {
    ok: true,
    calculation: {
      hsCode,
      description: harmonizedCode.description,
      countryOrigin,
      countryDestination,
      baseRate: dutyRate,
      antiDumpingRate,
      totalDutyRate,
      unitPrice: unitPrice != null ? parseFloat(unitPrice) : null,
      quantity: quantity != null ? parseInt(quantity, 10) : null,
      dutyAmount: Number(dutyAmount.toFixed(2)),
    },
  };
}

// ── listComplianceRecords ─────────────────────────────────────────────

async function listComplianceRecords(filters) {
  filters = filters || {};
  const where = {};
  if (filters.shipmentId) where.shipmentId = filters.shipmentId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.countryOrigin) where.countryOrigin = filters.countryOrigin;
  if (filters.countryDestination) where.countryDestination = filters.countryDestination;
  const rows = await db.ComplianceRecord.findAll({
    where,
    limit: Math.min(filters.limit || 25, 100),
    order: [['createdAt', 'DESC']],
  });
  return { ok: true, records: rows };
}

async function getComplianceRecord(id) {
  if (!id) return err('validation', 400, 'id is required');
  const record = await db.ComplianceRecord.findByPk(id);
  if (!record) return err('not_found', 404, `ComplianceRecord ${id} not found.`);
  return { ok: true, record };
}

// ── listCertificatesOfOrigin / getCertificateOfOrigin ─────────────────

async function listCertificatesOfOrigin(filters) {
  filters = filters || {};
  const where = {};
  if (filters.status) where.status = filters.status;
  if (filters.shipmentId) where.shipmentId = filters.shipmentId;
  if (filters.countryOfOrigin) where.countryOfOrigin = filters.countryOfOrigin;
  const rows = await db.CertificateOfOrigin.findAll({
    where,
    limit: Math.min(filters.limit || 25, 100),
    order: [['createdAt', 'DESC']],
  });
  return { ok: true, certificates: rows };
}

async function getCertificateOfOrigin(id) {
  if (!id) return err('validation', 400, 'id is required');
  const coo = await db.CertificateOfOrigin.findByPk(id);
  if (!coo) return err('not_found', 404, `CertificateOfOrigin ${id} not found.`);
  return { ok: true, certificate: coo };
}

module.exports = {
  checkCompliance,
  lookupHsCodes,
  calculateDuties,
  listComplianceRecords,
  getComplianceRecord,
  listCertificatesOfOrigin,
  getCertificateOfOrigin,
  EU_DESTINATIONS,
};
