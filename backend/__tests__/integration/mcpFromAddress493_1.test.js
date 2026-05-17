// Phase 4.9.3.1 — MCP send_outreach_email brand-aware fromAddress.
//
// Verifies the hotfix that replaced
//   `const fromAddress = process.env.SMTP_USER;`
// with brand-aware resolution mirroring outreachController. Three cases:
//   1. FW lead, no override → fromAddress = FW Brand.senderEmail
//   2. SH lead, no override → fromAddress = SH Brand.senderEmail
//   3. SH lead + explicit fromAddress → override wins
//
// Approach: this is one of the first tests that exercises the MCP
// subprocess end-to-end with real data flow (the smoke test in
// mcpSmoke.test.js skips data-flow because both processes use their
// own :memory: SQLite). To share state we route both the jest
// process and the spawned MCP subprocess to a temp file SQLite via
// the new SQLITE_STORAGE test-mode override (config/database.js).
// MCP_FORCE_SYNC=false on the subprocess so it doesn't wipe the seed.

const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Pick a unique temp DB file BEFORE anything is required. Override is
// honored by config/database.js when NODE_ENV=test (Phase 4.9.3.1).
const DB_PATH = path.join(os.tmpdir(), `mcp-fromaddr-${process.pid}-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.SQLITE_STORAGE = DB_PATH;
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';

const { startMcp, stopMcp } = require('../helpers/mcpHarness');

describe('MCP send_outreach_email brand-aware fromAddress (Phase 4.9.3.1)', () => {
  let db, mcp, fwLead, shLead, adminId;

  beforeAll(async () => {
    db = require('../../models');
    await db.sequelize.sync({ force: true });

    // Seed admin User
    adminId = uuidv4();
    await db.User.create({
      id: adminId,
      email: 'admin-493-1@test.com',
      password: '$2a$10$abcdefghijklmnopqrstuv',
      firstName: 'Test',
      lastName: 'Admin',
      role: 'super_admin',
      isActive: true,
    });

    // Seed both brands (codes match prod). FW maps to alexflorway@gmail.com,
    // SH maps to alex@sovernhouse.co.
    await db.Brand.create({
      id: uuidv4(),
      code: 'FW',
      displayName: 'FlorWay',
      legalName: 'FlorWay SDN. BHD.',
      senderEmail: 'alexflorway@gmail.com',
      primaryColor: '#0f5f3a',
      accentColor: '#caa66a',
      active: true,
      commissionRate: 0.07,
    });
    await db.Brand.create({
      id: uuidv4(),
      code: 'SH',
      displayName: 'Sovern House',
      legalName: 'New Route International Exchange Co., Ltd.',
      senderEmail: 'alex@sovernhouse.co',
      primaryColor: '#102a43',
      accentColor: '#caa66a',
      active: true,
      commissionRate: 0,
    });

    // Two leads, one per brand.
    fwLead = await db.Lead.create({
      id: uuidv4(),
      brandCode: 'FW',
      companyName: 'FW Test Prospect',
      contactName: 'Pat Florway',
      email: 'pat.fw-prospect@example.com',
      status: 'new',
      source: 'test',
    });
    shLead = await db.Lead.create({
      id: uuidv4(),
      brandCode: 'SH',
      companyName: 'SH Test Prospect',
      contactName: 'Jamie Sovern',
      email: 'jamie.sh-prospect@example.com',
      status: 'new',
      source: 'test',
    });

    // Spawn MCP subprocess routed to the same DB file. MCP_FORCE_SYNC=false
    // so it doesn't wipe the seed; ERP_USER_ID = admin so sentByUserId
    // resolves; NODE_ENV=test so config picks SQLITE_STORAGE.
    mcp = await startMcp({
      env: {
        SQLITE_STORAGE: DB_PATH,
        MCP_FORCE_SYNC: 'false',
        ERP_USER_ID: adminId,
        NODE_ENV: 'test',
      },
    });
  }, 180000);

  afterAll(async () => {
    await stopMcp(mcp);
    if (db) await db.sequelize.close();
    try { fs.unlinkSync(DB_PATH); } catch (_) {}
  });

  test('FW lead, no explicit fromAddress → resolves to FW Brand.senderEmail (alexflorway@gmail.com)', async () => {
    const result = await mcp.callTool('send_outreach_email', {
      lead_id: fwLead.id,
      subject: 'FW outreach default-from test',
      body_text: 'Phase 4.9.3.1 — confirming brand-aware default.',
      draftOnly: true,
    });
    expect(result?.success).toBe(true);
    expect(result?.outreachEmail?.fromAddress).toBe('alexflorway@gmail.com');

    // Cross-check against the row in the shared DB.
    const row = await db.OutreachEmail.findByPk(result.outreachEmail.id);
    expect(row).toBeTruthy();
    expect(row.fromAddress).toBe('alexflorway@gmail.com');
    expect(row.leadId).toBe(fwLead.id);
    expect(row.status).toBe('draft');
  }, 180000);

  test('SH lead, no explicit fromAddress → resolves to SH Brand.senderEmail (alex@sovernhouse.co)', async () => {
    const result = await mcp.callTool('send_outreach_email', {
      lead_id: shLead.id,
      subject: 'SH outreach default-from test',
      body_text: 'Phase 4.9.3.1 — confirming SH default.',
      draftOnly: true,
    });
    expect(result?.success).toBe(true);
    expect(result?.outreachEmail?.fromAddress).toBe('alex@sovernhouse.co');

    const row = await db.OutreachEmail.findByPk(result.outreachEmail.id);
    expect(row.fromAddress).toBe('alex@sovernhouse.co');
  }, 180000);

  test('SH lead with explicit fromAddress override → override wins over brand default', async () => {
    const result = await mcp.callTool('send_outreach_email', {
      lead_id: shLead.id,
      subject: 'SH outreach override-from test',
      body_text: 'Phase 4.9.3.1 — confirming override.',
      draftOnly: true,
      fromAddress: 'alternative@sovernhouse.co',
    });
    expect(result?.success).toBe(true);
    expect(result?.outreachEmail?.fromAddress).toBe('alternative@sovernhouse.co');
  }, 180000);
});
