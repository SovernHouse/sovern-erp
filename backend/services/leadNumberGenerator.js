/**
 * Phase 4.8, Commit 3a — Lead.leadNumber generator.
 *
 * Format: LD-YYYYMMDD-NNN
 *   LD       fixed prefix matching Deal's DL- pattern
 *   YYYYMMDD UTC date (so the same Lead number is reproducible regardless
 *            of the caller's timezone — display layer translates to
 *            Asia/Taipei separately per L-042)
 *   NNN      zero-padded counter, monotonic within a single day, starts at 1
 *
 * Counter strategy is "scan existing rows for today's prefix, pick max+1".
 * Slightly slower than a sequence object but avoids stateful state-machine
 * code in a single-writer ERP. At Sovern's create-rate (single-digit Leads
 * per day) the scan is trivial.
 */

const { Op } = require('sequelize');

function dateString(d) {
  // YYYYMMDD in UTC. Display layer renders Asia/Taipei separately.
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function pad(n) {
  return String(n).padStart(3, '0');
}

/**
 * Generate the next LD-YYYYMMDD-NNN for "today" (UTC) given the current
 * Lead set. Pass an optional `whenDate` for backfill of historical rows
 * so the date prefix matches each row's original createdAt.
 */
async function generateLeadNumber(db, whenDate) {
  if (!db || !db.Lead) {
    throw new Error('Lead model not registered');
  }
  const d = whenDate instanceof Date ? whenDate : new Date();
  const prefix = `LD-${dateString(d)}-`;
  const todays = await db.Lead.findAll({
    where: { leadNumber: { [Op.like]: `${prefix}%` } },
    attributes: ['leadNumber'],
    raw: true,
  });
  let max = 0;
  for (const row of todays) {
    const tail = row.leadNumber.slice(prefix.length);
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${pad(max + 1)}`;
}

module.exports = { generateLeadNumber, dateString };
