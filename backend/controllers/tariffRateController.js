/**
 * TariffRate controller — Phase 4.9 C-2.
 *
 * CRUD for the import duty rate table + a lookup helper consumed by
 * the quotation builder (4.9c) and the expiring-rate dashboard
 * widget (4.9e).
 *
 * Role gate: list + lookup open to any authenticated user; mutations
 * (create / update / delete) super_admin only per L-036 (super_admin
 * supercedes; bare-string requireRole per L-031).
 *
 * Audit: every successful mutation writes a tariff_rate_{action} row
 * to AuditLog so changes to tariff stacks are forensically traceable.
 *
 * IMPORTANT (L-045): callers reading from this controller via the
 * shared `api` axios instance get the unwrapped payload directly on
 * `res.data` — do NOT write `res.data?.data` in any consumer.
 */

const { Op } = require('sequelize');
const db = require('../models');
const auditService = require('../services/auditService');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Look up the active tariff rate for (origin, destination, brand) as
 * of `asOfDate`. Returns the row whose effective window contains the
 * date; if multiple match, returns the one with the latest
 * effectiveFrom (most recently issued).
 *
 * brandCode argument: pass the quotation's brand. The lookup prefers
 * a brand-specific row when one exists for the brand, otherwise falls
 * back to the brand=NULL row (the common case).
 *
 * Returns null if no matching rate exists. Quotation builder treats
 * null as "destination not in tariff scope" and skips the landed-cost
 * column for that line.
 */
async function getCurrentTariff(originCountry, destinationCountry, brandCode = null, asOfDate = new Date()) {
  if (!db.TariffRate) return null;
  const asOf = asOfDate instanceof Date ? asOfDate.toISOString().slice(0, 10) : String(asOfDate);

  // Try brand-specific first when a brandCode is given.
  if (brandCode) {
    const branded = await db.TariffRate.findOne({
      where: {
        originCountry: String(originCountry || '').toUpperCase(),
        destinationCountry: String(destinationCountry || '').toUpperCase(),
        brandCode,
        effectiveFrom: { [Op.lte]: asOf },
        effectiveUntil: { [Op.gte]: asOf },
      },
      order: [['effectiveFrom', 'DESC']],
    });
    if (branded) return branded;
  }

  // Fall back to brand-NULL row.
  return db.TariffRate.findOne({
    where: {
      originCountry: String(originCountry || '').toUpperCase(),
      destinationCountry: String(destinationCountry || '').toUpperCase(),
      brandCode: null,
      effectiveFrom: { [Op.lte]: asOf },
      effectiveUntil: { [Op.gte]: asOf },
    },
    order: [['effectiveFrom', 'DESC']],
  });
}

// ─── List ────────────────────────────────────────────────────────────────────
// GET /api/tariff-rates?origin=CN&destination=US&includeExpired=true
exports.list = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.origin)      where.originCountry      = String(req.query.origin).toUpperCase();
    if (req.query.destination) where.destinationCountry = String(req.query.destination).toUpperCase();
    if (req.query.brandCode)   where.brandCode          = req.query.brandCode;
    if (String(req.query.includeExpired || '').toLowerCase() !== 'true') {
      const today = new Date().toISOString().slice(0, 10);
      where.effectiveUntil = { [Op.gte]: today };
    }
    const rows = await db.TariffRate.findAll({
      where,
      order: [['destinationCountry', 'ASC'], ['originCountry', 'ASC'], ['effectiveFrom', 'DESC']],
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// ─── Expiring soon ───────────────────────────────────────────────────────────
// GET /api/tariff-rates/expiring?days=7
// Used by the C-5 dashboard banner. Returns rates whose effectiveUntil
// is within `days` from today (default 7). Excludes already-expired
// rows — those need a different warning surface.
exports.expiring = async (req, res, next) => {
  try {
    const days = Number.isFinite(Number(req.query.days)) ? Number(req.query.days) : 7;
    const today = new Date();
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + days);
    const todayStr = today.toISOString().slice(0, 10);
    const horizonStr = horizon.toISOString().slice(0, 10);
    const rows = await db.TariffRate.findAll({
      where: {
        effectiveUntil: { [Op.between]: [todayStr, horizonStr] },
      },
      order: [['effectiveUntil', 'ASC']],
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

// Phase 4.9 C-3 follow-up: validate + normalize a components array.
// Returns { components, ratePercent }: when components is non-empty,
// ratePercent is auto-computed as the sum (rounded to 4 decimals).
// When components is empty, falls back to the explicit ratePercent.
function resolveComponentsAndRate(rawComponents, fallbackRate) {
  if (!Array.isArray(rawComponents) || rawComponents.length === 0) {
    if (fallbackRate == null) throw new Error('Either components[] (non-empty) or ratePercent must be provided');
    return { components: [], ratePercent: Number(fallbackRate) };
  }
  const cleaned = rawComponents.map((c, i) => {
    if (!c || typeof c !== 'object') throw new Error(`components[${i}] must be an object`);
    const name = String(c.name || '').trim();
    if (!name) throw new Error(`components[${i}].name is required`);
    const rate = Number(c.ratePercent);
    if (!Number.isFinite(rate)) throw new Error(`components[${i}].ratePercent must be a number`);
    return {
      name,
      ratePercent: rate,
      ...(c.note ? { note: String(c.note) } : {}),
    };
  });
  const sum = cleaned.reduce((acc, c) => acc + c.ratePercent, 0);
  return { components: cleaned, ratePercent: Math.round(sum * 10000) / 10000 };
}

// ─── Create ──────────────────────────────────────────────────────────────────
exports.create = async (req, res, next) => {
  try {
    const { originCountry, destinationCountry, ratePercent, effectiveFrom, effectiveUntil, sourceNote, brandCode, components } = req.body || {};
    if (!originCountry || !destinationCountry || !effectiveFrom || !effectiveUntil) {
      return res.status(400).json({ success: false, message: 'originCountry, destinationCountry, effectiveFrom, effectiveUntil are required' });
    }
    let resolved;
    try {
      resolved = resolveComponentsAndRate(components, ratePercent);
    } catch (e) {
      return res.status(400).json({ success: false, message: e.message });
    }
    const row = await db.TariffRate.create({
      originCountry: String(originCountry).toUpperCase().slice(0, 2),
      destinationCountry: String(destinationCountry).toUpperCase().slice(0, 2),
      ratePercent: resolved.ratePercent,
      components: resolved.components,
      effectiveFrom,
      effectiveUntil,
      sourceNote: sourceNote || null,
      brandCode: brandCode || null,
      createdById: req.user?.id || null,
    });
    auditService.logAction(req.user?.id, 'tariff_rate_created', 'TariffRate', row.id, { data: row.toJSON() }, req.ip).catch(() => {});
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
};

// ─── Update ──────────────────────────────────────────────────────────────────
exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await db.TariffRate.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: 'Tariff rate not found' });
    const before = row.toJSON();
    const updates = {};
    for (const k of ['originCountry', 'destinationCountry', 'ratePercent', 'effectiveFrom', 'effectiveUntil', 'sourceNote', 'brandCode', 'components']) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    if (updates.originCountry) updates.originCountry = String(updates.originCountry).toUpperCase().slice(0, 2);
    if (updates.destinationCountry) updates.destinationCountry = String(updates.destinationCountry).toUpperCase().slice(0, 2);
    // Phase 4.9 C-3 follow-up: if components is updated (or already
    // exists), auto-compute ratePercent from the components sum.
    const nextComponents = updates.components !== undefined ? updates.components : before.components;
    if (Array.isArray(nextComponents) && nextComponents.length > 0) {
      let resolved;
      try {
        resolved = resolveComponentsAndRate(nextComponents, updates.ratePercent ?? before.ratePercent);
      } catch (e) {
        return res.status(400).json({ success: false, message: e.message });
      }
      updates.components = resolved.components;
      updates.ratePercent = resolved.ratePercent;
    } else if (updates.ratePercent != null) {
      updates.ratePercent = Number(updates.ratePercent);
    }
    await row.update(updates);
    auditService.logAction(req.user?.id, 'tariff_rate_updated', 'TariffRate', id, { before, after: row.toJSON() }, req.ip).catch(() => {});
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
};

// ─── Delete ──────────────────────────────────────────────────────────────────
exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const row = await db.TariffRate.findByPk(id);
    if (!row) return res.status(404).json({ success: false, message: 'Tariff rate not found' });
    const snapshot = row.toJSON();
    await row.destroy();
    auditService.logAction(req.user?.id, 'tariff_rate_deleted', 'TariffRate', id, { before: snapshot }, req.ip).catch(() => {});
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

module.exports.getCurrentTariff = getCurrentTariff;
