// Phase 4.18 — create_product MCP handler must write its ai_assistant_*
// AuditLog row. Sibling actions (create_product_spec, create_product_price)
// already do; the 9 IronLite SKUs on 2026-05-16 surfaced the gap.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

// IMPORTANT: set ERP_USER_ID BEFORE requiring erpToolServer — the module
// captures the env var once at load time into a top-level USER_ID const.
const FIXED_ADMIN_ID = '11111111-aaaa-4bbb-8ccc-222222222222';
process.env.ERP_USER_ID = FIXED_ADMIN_ID;

// eslint-disable-next-line node/no-missing-require -- relative path is correct
const { __testing } = require('../../mcp/erpToolServer');
const { callTool } = __testing;

describe('Phase 4.18 — create_product audit-write convergence', () => {
  let db;
  let testData;
  let categoryId;
  let factoryId;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();

    // Re-seed an admin with the exact UUID baked into ERP_USER_ID so the
    // audit row gets a valid user_id FK (auditAiWrite passes through
    // whatever it gets — we want it to match a real User).
    const bcrypt = require('bcryptjs');
    await db.User.create({
      id: FIXED_ADMIN_ID,
      email: `mcp-fixed-${uuidv4()}@example.com`,
      password: await bcrypt.hash('x', 10),
      firstName: 'MCP',
      lastName: 'Fixed',
      role: 'super_admin',
      isActive: true,
    });

    // FW brand for the create payload.
    const fw = await db.Brand.findOne({ where: { code: 'FW' } });
    if (!fw) {
      await db.Brand.create({
        code: 'FW',
        displayName: 'FlorWay',
        senderEmail: 'fw@example.com',
        primaryColor: '#123456',
        accentColor: '#abcdef',
        active: true,
        commissionRate: 0.07,
      });
    }

    const cat = await db.ProductCategory.create({
      id: uuidv4(),
      name: 'Phase418-EngSPC',
      isActive: true,
    });
    categoryId = cat.id;

    const factory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'Phase418-Factory',
      email: 'p418@example.com',
      phone: '+0000000000',
      country: 'China',
      isActive: true,
      brandCode: 'FW',
    });
    factoryId = factory.id;
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  it('create_product writes ai_assistant_create_product AuditLog row with key fields', async () => {
    const sku = `P418-${Date.now()}`;
    const result = await callTool('create_product', {
      name: 'Phase 4.18 audit test product',
      sku,
      brand_code: 'FW',
      category_id: categoryId,
      factory_id: factoryId,
      currency: 'USD',
      unit: 'sqm',
      origin_country: 'CN',
      origin_variants: [{ origin: 'China', factoryId }, { origin: 'Malaysia' }],
      lead_time_days: 30,
      active: true,
    });

    expect(result.success).toBe(true);
    expect(result.sku).toBe(sku);
    const productId = result.productId;

    const audit = await db.AuditLog.findOne({
      where: { action: 'ai_assistant_create_product', entityId: productId },
    });
    expect(audit).toBeTruthy();
    expect(audit.entity).toBe('Product');
    expect(audit.userId).toBe(FIXED_ADMIN_ID);

    // Audit payload includes the key identification fields.
    expect(audit.changes).toMatchObject({
      sku,
      brandCode: 'FW',
      categoryId,
      factoryId,
      isActive: true,
      leadTimeDays: 30,
      originCountry: 'CN',
      originVariantsCount: 2,
    });
  });

  it('audit row count matches Product create count under bulk (mirrors the IronLite 9-SKU regression)', async () => {
    const baseline = await db.AuditLog.count({ where: { action: 'ai_assistant_create_product' } });

    const skus = [];
    for (let i = 0; i < 3; i++) {
      const sku = `P418-BULK-${Date.now()}-${i}`;
      skus.push(sku);
      const r = await callTool('create_product', {
        name: `Bulk ${i}`,
        sku,
        brand_code: 'FW',
        category_id: categoryId,
        factory_id: factoryId,
        unit: 'sqm',
        active: true,
      });
      expect(r.success).toBe(true);
    }

    const after = await db.AuditLog.count({ where: { action: 'ai_assistant_create_product' } });
    expect(after - baseline).toBe(3);

    // Every Product has exactly one matching audit row.
    for (const sku of skus) {
      const product = await db.Product.findOne({ where: { sku } });
      expect(product).toBeTruthy();
      const audit = await db.AuditLog.findOne({
        where: { action: 'ai_assistant_create_product', entityId: product.id },
      });
      expect(audit).toBeTruthy();
    }
  });

  it('update_product and archive_product still write their audit rows (no regression)', async () => {
    // Build a fresh product to update + archive. Must be active=true so
    // archive_product has something to flip (handler short-circuits with
    // "already inactive" otherwise, skipping the audit write).
    const sku = `P418-UPD-${Date.now()}`;
    const created = await callTool('create_product', {
      name: 'Update test', sku,
      brand_code: 'FW', category_id: categoryId, factory_id: factoryId,
      unit: 'sqm', active: true,
    });
    const productId = created.productId;

    const updated = await callTool('update_product', {
      id: productId,
      description: 'Patched description',
    });
    expect(updated.success !== false).toBeTruthy();

    const updateAudit = await db.AuditLog.findOne({
      where: { action: 'ai_assistant_update_product', entityId: productId },
    });
    expect(updateAudit).toBeTruthy();

    const archived = await callTool('archive_product', { id: productId });
    expect(archived.success !== false).toBeTruthy();

    const archiveAudit = await db.AuditLog.findOne({
      where: { action: 'ai_assistant_archive_product', entityId: productId },
    });
    expect(archiveAudit).toBeTruthy();
  });
});
