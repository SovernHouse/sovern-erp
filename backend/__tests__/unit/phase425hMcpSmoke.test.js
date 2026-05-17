/**
 * Phase 4.25h — MCP smoke test.
 *
 * Verifies the 7 new tools register in TOOL_DEFS. Behavior coverage
 * lives in workflowService unit tests (4.25a-g).
 */

delete process.env.SQLITE_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';

describe('Phase 4.25h — MCP tool registration', () => {
  let mcp;

  beforeAll(() => {
    mcp = require('../../mcp/erpToolServer.js');
  });

  it('registers the 7 chain-trigger MCP tools', () => {
    const toolDefs = mcp.__testing && mcp.__testing.TOOL_DEFS;
    expect(Array.isArray(toolDefs)).toBe(true);
    const names = toolDefs.map(t => t.name);
    const expected = [
      'erp_accept_quotation',
      'erp_confirm_proforma_invoice',
      'erp_confirm_purchase_order',
      'erp_accept_grn',
      'erp_confirm_payment',
      'erp_advance_sales_order',
      'erp_deliver_shipment',
    ];
    for (const n of expected) {
      expect(names).toContain(n);
    }
  });

  it('each new tool declares an inputSchema with an id property', () => {
    const toolDefs = mcp.__testing && mcp.__testing.TOOL_DEFS;
    const needed = ['erp_accept_quotation', 'erp_confirm_proforma_invoice', 'erp_confirm_purchase_order', 'erp_accept_grn', 'erp_confirm_payment', 'erp_advance_sales_order', 'erp_deliver_shipment'];
    for (const n of needed) {
      const tool = toolDefs.find(t => t.name === n);
      expect(tool).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.inputSchema.properties).toHaveProperty('id');
    }
  });
});
