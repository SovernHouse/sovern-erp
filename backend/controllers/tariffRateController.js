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

// ─── Phase 4.9 C-4: bulk import + template ───────────────────────────────────

// CSV column names. One row per tariff entry. Each named component
// column ("mfnBase", "section301", etc.) becomes a {name, ratePercent}
// entry in the components array when filled in. The two "otherN"
// pairs handle rare additions without bloating the header.
const COMPONENT_COLUMNS = [
  { col: 'mfnBase',         name: 'MFN base (HTS column 1)' },
  { col: 'section301',      name: 'Section 301' },
  { col: 'section232',      name: 'Section 232' },
  { col: 'ieepaReciprocal', name: 'IEEPA reciprocal' },
  { col: 'ieepaFentanyl',   name: 'IEEPA fentanyl' },
  { col: 'adCvd',           name: 'AD/CVD' },
  { col: 'mpf',             name: 'MPF (merchandise fee)' },
  { col: 'hmf',             name: 'HMF (harbor maintenance)' },
];

const CSV_HEADER = [
  'originCountry', 'destinationCountry', 'effectiveFrom', 'effectiveUntil',
  ...COMPONENT_COLUMNS.map(c => c.col),
  'otherName1', 'otherRate1', 'otherName2', 'otherRate2',
  'totalRate', 'sourceNote', 'brandCode',
];

const CSV_EXAMPLE_ROWS = [
  // CN -> US matches the seed (sums to 40.7714).
  ['CN', 'US', '2026-05-14', '2026-06-14', '3.2', '25.0', '', '10.0', '2.15', '', '0.3464', '0.075', '', '', '', '', '', 'HanHua factory note 2026-05-14', ''],
  // MY -> US matches the seed (sums to 15.5214).
  ['MY', 'US', '2026-05-14', '2026-06-14', '5.0', '', '', '10.0', '', '', '0.3464', '0.175', '', '', '', '', '', 'HanHua factory note 2026-05-14', ''],
];

// GET /api/tariff-rates/template.csv
exports.template = (req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="tariff-rates-template.csv"');
  const lines = [
    CSV_HEADER.join(','),
    ...CSV_EXAMPLE_ROWS.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
  ];
  res.send(lines.join('\n'));
};

function csvRowToTariffPayload(row) {
  const components = [];
  for (const { col, name } of COMPONENT_COLUMNS) {
    const raw = (row[col] || '').trim();
    if (!raw) continue;
    const v = Number(raw);
    if (!Number.isFinite(v)) throw new Error(`${col}=${raw} is not numeric`);
    if (v === 0) continue; // skip zero-rate components — they add nothing
    components.push({ name, ratePercent: v });
  }
  // Handle the two free-form pairs.
  for (let i = 1; i <= 2; i++) {
    const name = (row[`otherName${i}`] || '').trim();
    const rateRaw = (row[`otherRate${i}`] || '').trim();
    if (!name && !rateRaw) continue;
    if (!name || !rateRaw) throw new Error(`otherName${i} and otherRate${i} must both be filled when used`);
    const v = Number(rateRaw);
    if (!Number.isFinite(v)) throw new Error(`otherRate${i}=${rateRaw} is not numeric`);
    components.push({ name, ratePercent: v });
  }

  const origin = (row.originCountry || '').toUpperCase().trim();
  const dest = (row.destinationCountry || '').toUpperCase().trim();
  if (origin.length !== 2 || dest.length !== 2) {
    throw new Error('originCountry and destinationCountry must each be 2-letter ISO codes');
  }
  const effectiveFrom = (row.effectiveFrom || '').trim();
  const effectiveUntil = (row.effectiveUntil || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveUntil)) {
    throw new Error('effectiveFrom and effectiveUntil must be YYYY-MM-DD');
  }
  if (effectiveUntil < effectiveFrom) {
    throw new Error('effectiveUntil must be on or after effectiveFrom');
  }

  let ratePercent;
  if (components.length > 0) {
    ratePercent = Math.round(components.reduce((s, c) => s + c.ratePercent, 0) * 10000) / 10000;
  } else {
    const totalRaw = (row.totalRate || '').trim();
    if (!totalRaw) throw new Error('Must supply at least one component column OR a totalRate');
    const v = Number(totalRaw);
    if (!Number.isFinite(v) || v < 0) throw new Error(`totalRate=${totalRaw} is not a non-negative number`);
    ratePercent = v;
  }

  return {
    originCountry: origin,
    destinationCountry: dest,
    effectiveFrom,
    effectiveUntil,
    components,
    ratePercent,
    sourceNote: (row.sourceNote || '').trim() || null,
    brandCode: (row.brandCode || '').trim().toUpperCase() || null,
  };
}

// POST /api/tariff-rates/bulk-import (multipart file=<csv> OR json {csv: "..."})
exports.bulkImport = async (req, res, next) => {
  try {
    const { parse } = require('csv-parse/sync');
    let raw = '';
    if (req.file && req.file.path) {
      const fs = require('fs');
      raw = fs.readFileSync(req.file.path, 'utf8');
      fs.unlink(req.file.path, () => {});
    } else if (req.body && typeof req.body.csv === 'string') {
      raw = req.body.csv;
    } else {
      return res.status(400).json({ success: false, message: 'Provide a multipart file=<csv> upload or JSON body { csv: "..." }' });
    }

    let rows;
    try {
      rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    } catch (e) {
      return res.status(400).json({ success: false, message: `CSV parse failed: ${e.message}` });
    }

    const results = { inserted: 0, updated: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const payload = csvRowToTariffPayload(row);
        // Upsert on (originCountry, destinationCountry, effectiveFrom).
        const existing = await db.TariffRate.findOne({
          where: {
            originCountry: payload.originCountry,
            destinationCountry: payload.destinationCountry,
            effectiveFrom: payload.effectiveFrom,
          },
        });
        if (existing) {
          await existing.update(payload);
          auditService.logAction(req.user?.id, 'tariff_rate_updated', 'TariffRate', existing.id, { source: 'bulk_import', after: payload }, req.ip).catch(() => {});
          results.updated++;
        } else {
          const created = await db.TariffRate.create({ ...payload, createdById: req.user?.id || null });
          auditService.logAction(req.user?.id, 'tariff_rate_created', 'TariffRate', created.id, { source: 'bulk_import', data: created.toJSON() }, req.ip).catch(() => {});
          results.inserted++;
        }
      } catch (e) {
        // Row index +2 so the user sees the CSV line number (header is line 1).
        results.errors.push({ row: i + 2, message: e.message, data: row });
      }
    }

    auditService.logAction(req.user?.id, 'tariff_rate_bulk_import', 'TariffRate', null, {
      inserted: results.inserted, updated: results.updated, errorCount: results.errors.length,
    }, req.ip).catch(() => {});

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};
