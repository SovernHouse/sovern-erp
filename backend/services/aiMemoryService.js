/**
 * aiMemoryService — Phase 4.18e.
 *
 * Thin Sequelize wrapper around the AiMemory model. Used by:
 *   - MCP tools (remember_fact / forget_fact / list_memories)
 *   - aiContextService.buildSystemPrompt (memory injection)
 *
 * Upsert semantics: (userId, key) is the natural identity. A second
 * call with the same key updates value/kind/source and flips
 * isActive back to true if it had been soft-deleted.
 */

const db = require('../models');
const logger = require('../utils/logger');

const VALUE_CAP_BYTES = 2048;

async function list({ userId, kind, limit = 50, includeInactive = false } = {}) {
  if (!db.AiMemory) return [];
  const where = { userId };
  if (!includeInactive) where.isActive = true;
  if (kind) where.kind = kind;
  const rows = await db.AiMemory.findAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit: Math.max(1, Math.min(200, limit)),
  });
  return rows.map(toJSON);
}

/**
 * Returns the top N rows for injection into the system prompt.
 * Ordered by lastReferencedAt DESC then updatedAt DESC so freshly-
 * cited memories surface first. Capped at 30 rows / ~500 tokens to
 * keep every turn's context budget manageable.
 */
async function topForPrompt({ userId, limit = 30 } = {}) {
  if (!db.AiMemory) return [];
  // SQLite treats NULL as the smallest value in DESC ordering, so
  // rows that have never been referenced naturally fall to the
  // bottom of the lastReferencedAt sort. updatedAt is the
  // secondary key so freshly-saved memories still surface before
  // older never-referenced ones.
  const rows = await db.AiMemory.findAll({
    where: { userId, isActive: true },
    order: [
      ['lastReferencedAt', 'DESC'],
      ['updatedAt', 'DESC'],
    ],
    limit: Math.max(1, Math.min(60, limit)),
  });
  return rows.map(toJSON);
}

async function upsert({ userId, key, value, kind = 'fact', source = 'explicit-remember-command' }) {
  if (!db.AiMemory) throw new Error('AiMemory model unavailable');
  const cleanKey = String(key || '').trim().slice(0, 80);
  const cleanValue = String(value || '').trim().slice(0, VALUE_CAP_BYTES);
  if (!cleanKey) throw new Error('key required');
  if (!cleanValue) throw new Error('value required');

  const existing = await db.AiMemory.findOne({ where: { userId, key: cleanKey } });
  if (existing) {
    await existing.update({
      value: cleanValue,
      kind,
      source,
      isActive: true,
    });
    return toJSON(existing);
  }
  const row = await db.AiMemory.create({
    userId,
    key: cleanKey,
    value: cleanValue,
    kind,
    source,
    isActive: true,
  });
  return toJSON(row);
}

async function softDelete({ userId, key }) {
  if (!db.AiMemory) return { deleted: false };
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return { deleted: false };
  const existing = await db.AiMemory.findOne({
    where: { userId, key: cleanKey, isActive: true },
  });
  if (!existing) return { deleted: false };
  await existing.update({ isActive: false });
  return { deleted: true, id: existing.id };
}

async function touchReferenced({ userId, key }) {
  if (!db.AiMemory) return false;
  try {
    const existing = await db.AiMemory.findOne({
      where: { userId, key: String(key || '').trim(), isActive: true },
    });
    if (!existing) return false;
    await existing.update({ lastReferencedAt: new Date() });
    return true;
  } catch (e) {
    logger.warn('[ai-memory] touchReferenced failed:', e.message);
    return false;
  }
}

function toJSON(row) {
  const o = row.toJSON ? row.toJSON() : row;
  return {
    id: o.id,
    userId: o.userId,
    kind: o.kind,
    key: o.key,
    value: o.value,
    source: o.source,
    isActive: o.isActive,
    lastReferencedAt: o.lastReferencedAt,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

module.exports = { list, topForPrompt, upsert, softDelete, touchReferenced };
