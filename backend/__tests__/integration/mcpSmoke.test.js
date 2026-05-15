// Phase 4.11 — MCP tool smoke tests.
//
// Spawns the real MCP subprocess (backend/mcp/erpToolServer.js) and
// exercises the registry + schema-introspection tools. Catches the
// class of bugs Phase 4.9.3 surfaced (subprocess loading a stale
// view of the model registry; DB schema vs model attribute drift).
//
// Data-flow tool tests (create_customer, create_product, etc.) are
// out of scope for this harness because the subprocess uses its own
// :memory: SQLite that doesn't share state with the Jest process.
// Add those in a follow-up by routing both processes to a temp file
// DB if/when the cost is worth it.

const { startMcp, stopMcp } = require('../helpers/mcpHarness');

describe('MCP tool smoke (Phase 4.11)', () => {
  let mcp;

  beforeAll(async () => {
    mcp = await startMcp();
  }, 30000);

  afterAll(async () => {
    await stopMcp(mcp);
  });

  test('tools/list exposes the expected high-value tools', async () => {
    const tools = await mcp.listTools();
    const names = tools.map(t => t.name);
    // Sanity-check a cross-section: registry, CRUD, schema introspection,
    // Drive routing, outreach draft, pricing.
    const expected = [
      'erp_list_entities', 'erp_describe_entity', 'erp_describe_entity_db',
      'list_brands', 'create_brand', 'update_brand',
      'list_customers', 'create_customer', 'update_customer', 'get_customer', 'archive_customer',
      'list_products', 'create_product', 'update_product', 'get_product', 'archive_product',
      'list_product_categories', 'create_product_category',
      'create_product_price', 'list_product_prices', 'get_current_price',
      'search_drive_files', 'read_drive_file',
      'send_outreach_email',
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  }, 30000);

  test('erp_list_entities returns a non-empty list including Factory + Customer + Product + ProductPrice', async () => {
    const result = await mcp.callTool('erp_list_entities', {});
    expect(result).toBeTruthy();
    const entities = result.entities || result;
    expect(Array.isArray(entities)).toBe(true);
    for (const name of ['Factory', 'Customer', 'Product', 'ProductPrice', 'Brand']) {
      expect(entities).toContain(name);
    }
  }, 30000);

  test('erp_describe_entity Factory includes brandCode (Phase 4.9.2a)', async () => {
    const result = await mcp.callTool('erp_describe_entity', { entity: 'Factory' });
    expect(result).toBeTruthy();
    expect(result.attributes).toContain('brandCode');
    expect(result.tableName).toBe('Factory');
  }, 30000);

  test('erp_describe_entity Customer includes metadata (Phase 4.9.3a)', async () => {
    const result = await mcp.callTool('erp_describe_entity', { entity: 'Customer' });
    expect(result.attributes).toContain('metadata');
  }, 30000);

  test('erp_describe_entity_db Factory includes brand_code column (live schema)', async () => {
    const result = await mcp.callTool('erp_describe_entity_db', { entity: 'Factory' });
    expect(result).toBeTruthy();
    expect(Array.isArray(result.columns)).toBe(true);
    const colNames = result.columns.map(c => c.name);
    expect(colNames).toContain('brand_code');
    // The mismatch report should exist as a structural promise even
    // when empty.
    expect(result.mismatch).toBeTruthy();
    expect(result.mismatch).toHaveProperty('modelAttributesMissingFromDb');
    expect(result.mismatch).toHaveProperty('dbColumnsMissingFromModel');
  }, 30000);

  test('erp_describe_entity_db ProductPrice has the 4.9.2b temporal shape (cost_price_usd_per_m2 present)', async () => {
    const result = await mcp.callTool('erp_describe_entity_db', { entity: 'ProductPrice' });
    expect(result).toBeTruthy();
    const colNames = result.columns.map(c => c.name);
    expect(colNames).toContain('cost_price_usd_per_m2');
    expect(colNames).toContain('origin');
    expect(colNames).toContain('tariff_rate');
  }, 30000);
});
