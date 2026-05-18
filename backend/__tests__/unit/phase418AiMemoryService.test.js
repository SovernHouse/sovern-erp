/**
 * Phase 4.18e — aiMemoryService unit tests.
 *
 * Uses the production models singleton so the service's `require('../models')`
 * lookup hits the same AiMemory model the test creates. Test isolation
 * comes from a beforeAll sync({ force:true }) on the in-memory SQLite the
 * default models singleton uses, then per-test cleanup of AiMemory rows.
 */

const { v4: uuidv4 } = require('uuid');

let db;
let aiMemoryService;
let testUserId;

beforeAll(async () => {
  // The default config/database wires SQLite — for unit tests we use the
  // already-configured singleton and rely on sync({ force:true }) to
  // build the User + AiMemory tables in memory.
  db = require('../../models');
  await db.User.sync({ force: true });
  await db.AiMemory.sync({ force: true });

  // SQLite enforces the FK, so a real User row is required.
  const u = await db.User.create({
    email: `mem-test-${Date.now()}@test.local`,
    password: 'x',
    firstName: 'Mem',
    lastName: 'Test',
    role: 'super_admin',
  });
  testUserId = u.id;

  aiMemoryService = require('../../services/aiMemoryService');
});

afterEach(async () => {
  await db.AiMemory.destroy({ where: {}, truncate: false });
});

describe('aiMemoryService.upsert', () => {
  test('creates a row when none exists', async () => {
    const row = await aiMemoryService.upsert({
      userId: testUserId,
      key: 'phrasing-ironlite',
      value: 'always use "with IronLite Core Technology"',
      kind: 'voice_rule',
    });
    expect(row.id).toBeTruthy();
    expect(row.key).toBe('phrasing-ironlite');
    expect(row.value).toMatch(/IronLite Core Technology/);
    expect(row.kind).toBe('voice_rule');
    expect(row.isActive).toBe(true);
  });

  test('updates value when row already exists (same key)', async () => {
    await aiMemoryService.upsert({ userId: testUserId, key: 'k1', value: 'v1' });
    const updated = await aiMemoryService.upsert({ userId: testUserId, key: 'k1', value: 'v2' });
    expect(updated.value).toBe('v2');

    const rows = await db.AiMemory.findAll({ where: { userId: testUserId, key: 'k1' } });
    expect(rows.length).toBe(1);
  });

  test('resurrects a soft-deleted row', async () => {
    const saved = await aiMemoryService.upsert({ userId: testUserId, key: 'k2', value: 'v' });
    await aiMemoryService.softDelete({ userId: testUserId, key: 'k2' });
    const before = await db.AiMemory.findByPk(saved.id);
    expect(before.isActive).toBe(false);

    const restored = await aiMemoryService.upsert({ userId: testUserId, key: 'k2', value: 'v-new' });
    expect(restored.isActive).toBe(true);
    expect(restored.value).toBe('v-new');
  });

  test('refuses empty key', async () => {
    await expect(aiMemoryService.upsert({ userId: testUserId, key: '', value: 'v' }))
      .rejects.toThrow(/key required/);
  });

  test('refuses empty value', async () => {
    await expect(aiMemoryService.upsert({ userId: testUserId, key: 'k', value: '' }))
      .rejects.toThrow(/value required/);
  });

  test('caps value at 2KB', async () => {
    const huge = 'x'.repeat(5000);
    const row = await aiMemoryService.upsert({ userId: testUserId, key: 'big', value: huge });
    expect(row.value.length).toBe(2048);
  });
});

describe('aiMemoryService.list', () => {
  test('returns only active rows by default', async () => {
    await aiMemoryService.upsert({ userId: testUserId, key: 'a', value: '1' });
    await aiMemoryService.upsert({ userId: testUserId, key: 'b', value: '2' });
    await aiMemoryService.softDelete({ userId: testUserId, key: 'a' });

    const rows = await aiMemoryService.list({ userId: testUserId });
    expect(rows.map(r => r.key)).toEqual(['b']);
  });

  test('filters by kind', async () => {
    await aiMemoryService.upsert({ userId: testUserId, key: 'a', value: '1', kind: 'fact' });
    await aiMemoryService.upsert({ userId: testUserId, key: 'b', value: '2', kind: 'voice_rule' });
    const voiceRules = await aiMemoryService.list({ userId: testUserId, kind: 'voice_rule' });
    expect(voiceRules.length).toBe(1);
    expect(voiceRules[0].key).toBe('b');
  });
});

describe('aiMemoryService.topForPrompt', () => {
  test('orders by lastReferencedAt DESC then updatedAt DESC', async () => {
    await aiMemoryService.upsert({ userId: testUserId, key: 'a', value: '1' });
    await aiMemoryService.upsert({ userId: testUserId, key: 'b', value: '2' });
    await aiMemoryService.upsert({ userId: testUserId, key: 'c', value: '3' });

    // Mark 'b' as referenced — it should bubble to the top.
    await aiMemoryService.touchReferenced({ userId: testUserId, key: 'b' });

    const top = await aiMemoryService.topForPrompt({ userId: testUserId, limit: 30 });
    expect(top.map(r => r.key)[0]).toBe('b');
  });

  test('excludes soft-deleted rows', async () => {
    await aiMemoryService.upsert({ userId: testUserId, key: 'a', value: '1' });
    await aiMemoryService.upsert({ userId: testUserId, key: 'b', value: '2' });
    await aiMemoryService.softDelete({ userId: testUserId, key: 'a' });
    const top = await aiMemoryService.topForPrompt({ userId: testUserId });
    expect(top.map(r => r.key)).toEqual(['b']);
  });

  test('respects limit cap', async () => {
    for (let i = 0; i < 5; i++) {
      await aiMemoryService.upsert({ userId: testUserId, key: `k${i}`, value: 'v' });
    }
    const top = await aiMemoryService.topForPrompt({ userId: testUserId, limit: 3 });
    expect(top.length).toBe(3);
  });
});

describe('aiMemoryService.softDelete', () => {
  test('flips isActive=false on existing row', async () => {
    const saved = await aiMemoryService.upsert({ userId: testUserId, key: 'k', value: 'v' });
    const result = await aiMemoryService.softDelete({ userId: testUserId, key: 'k' });
    expect(result.deleted).toBe(true);
    expect(result.id).toBe(saved.id);

    const row = await db.AiMemory.findByPk(saved.id);
    expect(row.isActive).toBe(false);
  });

  test('returns deleted:false when key not found', async () => {
    const result = await aiMemoryService.softDelete({ userId: testUserId, key: 'nope' });
    expect(result.deleted).toBe(false);
  });
});
