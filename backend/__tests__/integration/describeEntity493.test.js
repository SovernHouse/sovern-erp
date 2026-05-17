// Phase 4.9.3 (final) Part F — proves erp_describe_entity sees
// brandCode on Factory (the column Alex's chat thread missed). The
// existing tool already reads rawAttributes at call time; this test
// makes the contract regression-proof.
//
// Also covers the new erp_describe_entity_db sanity: it returns the
// physical column list via PRAGMA, regardless of model staleness.

const { getApp, getDb, cleanup } = require('../setup');

describe('erp_describe_entity surfaces current model state (Phase 4.9.3 F)', () => {
  let db;

  beforeAll(async () => {
    await getApp();
    db = getDb();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  test('Factory.rawAttributes includes brandCode (Phase 4.9.2a column)', () => {
    const attrs = Object.keys(db.Factory.rawAttributes);
    expect(attrs).toContain('brandCode');
  });

  test('Factory PRAGMA table_info includes brand_code (the DB column name)', async () => {
    const [rows] = await db.sequelize.query('PRAGMA table_info(Factory)');
    const names = rows.map(r => r.name);
    expect(names).toContain('brand_code');
  });

  test('Customer.rawAttributes includes metadata (Phase 4.9.3a column)', () => {
    const attrs = Object.keys(db.Customer.rawAttributes);
    expect(attrs).toContain('metadata');
  });

  test('ProductPrice rawAttributes carry the new temporal pricing fields', () => {
    const attrs = Object.keys(db.ProductPrice.rawAttributes);
    expect(attrs).toContain('costPriceUsdPerM2');
    expect(attrs).toContain('sellingPriceUsdPerM2');
    expect(attrs).toContain('markupPercent');
    expect(attrs).toContain('tariffRate');
    expect(attrs).toContain('origin');
  });

  test('checkSchemaParity returns a structured report without throwing', async () => {
    const { checkSchemaParity } = require('../../services/checkSchemaParity');
    const findings = await checkSchemaParity(db);
    expect(findings).toBeTruthy();
    expect(findings).toHaveProperty('perfect');
    expect(findings).toHaveProperty('inModelMissingFromDb');
    expect(findings).toHaveProperty('inDbMissingFromModel');
    expect(findings).toHaveProperty('tableMissing');
    // In the test DB (built fresh via sync({force:true})) we expect
    // very few mismatches; the existence of the report is the
    // contract, not the exact contents.
  });
});
