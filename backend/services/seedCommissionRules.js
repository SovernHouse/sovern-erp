/**
 * Commission rule seed — Phase 3, C11.
 *
 * Idempotent insert of the "FW Sales Commission" rule. Same pattern as
 * seedBrands.js — never overwrite an existing row by `name`.
 *
 * Default base value is 5% (Alex confirmed 2026-05-14). The rate is
 * **adjustable per order** via CommissionTracking.percentage on the
 * individual row, so this seed sets the default for new FW SalesOrders
 * but never locks the rate. The seed reads
 * process.env.FW_COMMISSION_RATE if set (in case Alex wants to flex the
 * default without a code change), otherwise falls back to 5.
 *
 * Public repo rule (per CLAUDE.md): the rate is a non-sensitive business
 * decision but the env-var path is preserved so a future white-label
 * tenant can override without forking the repo.
 */

const logger = require('../utils/logger');

const FW_DEFAULT_RATE_PCT = parseFloat(process.env.FW_COMMISSION_RATE || '5');

const SEEDS = [
  {
    name: 'FW Sales Commission',
    description:
      'Default FlorWay sales commission. Auto-applied to every SalesOrder ' +
      'where brandCode=FW. Per-order rate is overridable on the individual ' +
      'CommissionTracking row.',
    ruleType: 'percentage',
    baseValue: FW_DEFAULT_RATE_PCT,
    minAmount: null,
    maxAmount: null,
    tiers: null,
    applicableRoles: ['sales', 'super_admin'],
    isActive: true,
  },
];

async function seedCommissionRulesIfEmpty(db) {
  if (!db || !db.CommissionRule) {
    logger.warn('[seedCommissionRules] db.CommissionRule not registered; skipping seed');
    return;
  }
  let inserted = 0;
  for (const row of SEEDS) {
    const existing = await db.CommissionRule.findOne({ where: { name: row.name } });
    if (existing) continue;
    await db.CommissionRule.create(row);
    inserted++;
  }
  if (inserted > 0) {
    logger.info(`[seedCommissionRules] Inserted ${inserted} commission rule(s); FW default ${FW_DEFAULT_RATE_PCT}%`);
  }
}

module.exports = { seedCommissionRulesIfEmpty, SEEDS, FW_DEFAULT_RATE_PCT };
