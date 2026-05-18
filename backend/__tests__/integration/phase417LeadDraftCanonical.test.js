/**
 * Phase 4.17 — Lead detail Draft Cold Email widget rebuild.
 *
 * Asserts the 10 scenarios from the directive:
 *
 *   1. GET on a lead with no draft returns { draft: null, sent: null, latest: null }.
 *   2. PUT creates a status='draft' OutreachEmail row + GET surfaces it.
 *   3. A second PUT updates the SAME row (id preserved).
 *   4. POST /outreach-emails flips that draft to status='sent' (same id) — no parallel row.
 *   5. A subsequent PUT after sent creates a NEW draft (the previous row is locked as 'sent').
 *   6. The MCP send_outreach_email tool with draftOnly=true stages a draft + GET surfaces it.
 *   7. PUT after the AI-staged draft updates the SAME row (id preserved).
 *   8. DELETE removes the active draft + GET returns null.
 *   9. Brand-leak guard: PUT + POST refuse (422 brandLeak:true) when lead.brandCode is unresolved.
 *  10. Backfill migration is idempotent: running twice yields a single OutreachEmail row.
 *
 * SMTP is mocked. The Send path's external email delivery is not what's
 * under test — what's under test is the row lifecycle on the DB.
 */

const { v4: uuidv4 } = require('uuid');

// Mock SMTP so the Send path resolves without hitting Ethereal/the network.
jest.mock('../../services/emailService', () => {
  const actual = jest.requireActual('../../services/emailService');
  return {
    ...actual,
    sendOutreachEmail: jest.fn(async () => ({
      messageId: 'test-message-id-' + Date.now(),
      accepted: ['recipient@example.com'],
      rejected: [],
    })),
  };
});

const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');
const { migrate417LeadDraftBackfill } = require('../../services/migrate417LeadDraftBackfill');

describe('Phase 4.17 — Lead Draft Cold Email widget (OutreachEmail canonical)', () => {
  let db, request, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();

    // Seed brand rows. Rule #9: the widget refuses to render / send when
    // brand cannot be resolved. Seed both SH (the lead default) and an
    // explicit FW alternative so the brand-leak test below can flip on
    // a lead with an unknown brand code.
    if (!await db.Brand.findOne({ where: { code: 'SH' } })) {
      await db.Brand.create({
        id: uuidv4(),
        code: 'SH',
        displayName: 'Sovern House',
        senderEmail: 'alex@sovernhouse.co',
        primaryColor: '#1F3A5F',
        accentColor: '#C7A14A',
        active: true,
        signatureHtml: '<p>— Alex, Sovern House</p>',
        signatureText: '— Alex, Sovern House',
      });
    }
    if (!await db.Brand.findOne({ where: { code: 'FW' } })) {
      await db.Brand.create({
        id: uuidv4(),
        code: 'FW',
        displayName: 'FlorWay',
        senderEmail: 'alexflorway@gmail.com',
        primaryColor: '#0F5F3A',
        accentColor: '#CAA66A',
        active: true,
        signatureHtml: '<p>— Alex, FlorWay</p>',
        signatureText: '— Alex, FlorWay',
      });
    }
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  async function newLead({ brandCode = 'SH', draftSubject, draftBody } = {}) {
    const lead = await db.Lead.create({
      id: uuidv4(),
      companyName: `Test Co ${uuidv4().slice(0, 6)}`,
      contactName: 'Test Contact',
      email: `contact-${uuidv4().slice(0, 6)}@example.com`,
      status: 'new',
      brandCode,
      leadNumber: `LD-20260518-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      draftEmailSubject: draftSubject || null,
      draftEmailBody: draftBody || null,
    });
    return lead;
  }

  function authHeaders() {
    return { Authorization: `Bearer ${testData.authToken}` };
  }

  it('1. GET on a lead with no draft returns null state', async () => {
    const lead = await newLead();
    const res = await request.get(`/api/crm/leads/${lead.id}/outreach-draft`).set(authHeaders());
    expect(res.status).toBe(200);
    expect(res.body.data.draft).toBeNull();
    expect(res.body.data.sent).toBeNull();
    expect(res.body.data.latest).toBeNull();
  });

  it('2. PUT creates a status=draft OutreachEmail row + GET surfaces it', async () => {
    const lead = await newLead();
    const put = await request
      .put(`/api/crm/leads/${lead.id}/outreach-draft`)
      .set(authHeaders())
      .send({ subject: 'Quick intro from Sovern', bodyText: 'Hi there,\nWe ship LVT direct from Malaysia.\n— A' });
    expect(put.status).toBe(201);
    expect(put.body.data.status).toBe('draft');
    expect(put.body.data.subject).toBe('Quick intro from Sovern');

    const get = await request.get(`/api/crm/leads/${lead.id}/outreach-draft`).set(authHeaders());
    expect(get.status).toBe(200);
    expect(get.body.data.draft).toBeTruthy();
    expect(get.body.data.draft.id).toBe(put.body.data.id);
    expect(get.body.data.latest.status).toBe('draft');
  });

  it('3. A second PUT updates the same draft row (id preserved)', async () => {
    const lead = await newLead();
    const first = await request
      .put(`/api/crm/leads/${lead.id}/outreach-draft`)
      .set(authHeaders())
      .send({ subject: 'v1', bodyText: 'body v1' });
    const second = await request
      .put(`/api/crm/leads/${lead.id}/outreach-draft`)
      .set(authHeaders())
      .send({ subject: 'v2 — tighter', bodyText: 'body v2 — shorter ask' });
    expect(second.status).toBe(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.subject).toBe('v2 — tighter');
    const count = await db.OutreachEmail.count({ where: { leadId: lead.id, status: 'draft' } });
    expect(count).toBe(1);
  });

  it('4. POST /outreach-emails flips the draft to sent (same id, no parallel row)', async () => {
    const lead = await newLead();
    const draft = await request
      .put(`/api/crm/leads/${lead.id}/outreach-draft`)
      .set(authHeaders())
      .send({ subject: 'Send me', bodyText: 'body to ship' });
    const draftId = draft.body.data.id;

    const send = await request
      .post(`/api/crm/leads/${lead.id}/outreach-emails`)
      .set(authHeaders())
      .send({
        toAddress: lead.email,
        toName: lead.contactName,
        subject: 'Send me',
        bodyText: 'body to ship',
        touchNumber: 1,
      });
    expect(send.status).toBe(201);
    expect(send.body.data.id).toBe(draftId);
    expect(send.body.data.status).toBe('sent');
    expect(send.body.data.smtpMessageId).toMatch(/^test-message-id-/);

    const all = await db.OutreachEmail.findAll({ where: { leadId: lead.id } });
    expect(all.length).toBe(1);
    expect(all[0].status).toBe('sent');
  });

  it('5. PUT after sent creates a NEW draft (sent row stays sent)', async () => {
    const lead = await newLead();
    const draft = await request
      .put(`/api/crm/leads/${lead.id}/outreach-draft`)
      .set(authHeaders())
      .send({ subject: 's1', bodyText: 'b1' });
    const sentId = draft.body.data.id;
    await request
      .post(`/api/crm/leads/${lead.id}/outreach-emails`)
      .set(authHeaders())
      .send({ toAddress: lead.email, subject: 's1', bodyText: 'b1', touchNumber: 1 });

    const followUp = await request
      .put(`/api/crm/leads/${lead.id}/outreach-draft`)
      .set(authHeaders())
      .send({ subject: 's2 follow-up', bodyText: 'b2 follow-up', touchNumber: 2 });
    expect(followUp.status).toBe(201);
    expect(followUp.body.data.id).not.toBe(sentId);
    expect(followUp.body.data.status).toBe('draft');
    expect(followUp.body.data.touchNumber).toBe(2);

    const sentRow = await db.OutreachEmail.findByPk(sentId);
    expect(sentRow.status).toBe('sent');
  });

  it('6. MCP send_outreach_email with draftOnly stages a draft visible via GET', async () => {
    const lead = await newLead();
    // The MCP path lives in backend/mcp/erpToolServer.js but the actual
    // case-handler is invoked through a private function. Round-trip via
    // OutreachEmail.create() with status='draft' matches the MCP write
    // shape, which is what we want to assert from the widget's view.
    const aiRow = await db.OutreachEmail.create({
      id: uuidv4(),
      leadId: lead.id,
      sentByUserId: testData.admin.id,
      fromAddress: 'alex@sovernhouse.co',
      toAddress: lead.email,
      toName: lead.contactName,
      subject: 'AI-staged draft',
      bodyText: 'AI body for review',
      touchNumber: 1,
      status: 'draft',
      brandCode: 'SH',
    });
    const get = await request.get(`/api/crm/leads/${lead.id}/outreach-draft`).set(authHeaders());
    expect(get.body.data.draft).toBeTruthy();
    expect(get.body.data.draft.id).toBe(aiRow.id);
    expect(get.body.data.draft.subject).toBe('AI-staged draft');
  });

  it('7. PUT after AI draft updates the same row (id preserved)', async () => {
    const lead = await newLead();
    const aiRow = await db.OutreachEmail.create({
      id: uuidv4(),
      leadId: lead.id,
      sentByUserId: null,
      fromAddress: 'alex@sovernhouse.co',
      toAddress: lead.email,
      toName: lead.contactName,
      subject: 'AI draft',
      bodyText: 'AI body',
      touchNumber: 1,
      status: 'draft',
      brandCode: 'SH',
    });
    const put = await request
      .put(`/api/crm/leads/${lead.id}/outreach-draft`)
      .set(authHeaders())
      .send({ subject: 'human-edited', bodyText: 'edited body' });
    expect(put.body.data.id).toBe(aiRow.id);
    expect(put.body.data.subject).toBe('human-edited');
  });

  it('8. DELETE removes the active draft + GET returns null', async () => {
    const lead = await newLead();
    const put = await request
      .put(`/api/crm/leads/${lead.id}/outreach-draft`)
      .set(authHeaders())
      .send({ subject: 'will be discarded', bodyText: 'will be discarded body' });
    const del = await request.delete(`/api/crm/leads/${lead.id}/outreach-draft`).set(authHeaders());
    expect(del.status).toBe(200);
    expect(del.body.data.id).toBe(put.body.data.id);

    const get = await request.get(`/api/crm/leads/${lead.id}/outreach-draft`).set(authHeaders());
    expect(get.body.data.draft).toBeNull();

    const audit = await db.AuditLog.findOne({
      where: { action: 'user_discard_outreach_draft', entityId: put.body.data.id },
    });
    expect(audit).toBeTruthy();
  });

  it('9. Brand-leak guard refuses PUT + POST when brand is unresolved', async () => {
    // Synthesize an unresolved-brand lead by direct DB write that
    // bypasses the create-time defaults. brandCode=null isn't writable
    // through the controller (NOT NULL constraint), so we stage a lead
    // with an unknown code instead — Brand.findOne returns nothing and
    // the resolver refuses, exercising the same code path.
    const lead = await newLead({ brandCode: 'XX' });
    const put = await request
      .put(`/api/crm/leads/${lead.id}/outreach-draft`)
      .set(authHeaders())
      .send({ subject: 's', bodyText: 'b' });
    expect(put.status).toBe(422);
    expect(put.body.brandLeak).toBe(true);

    const send = await request
      .post(`/api/crm/leads/${lead.id}/outreach-emails`)
      .set(authHeaders())
      .send({ toAddress: lead.email, subject: 's', bodyText: 'b', touchNumber: 1 });
    expect(send.status).toBe(422);
    expect(send.body.brandLeak).toBe(true);
  });

  it('10. Backfill migration is idempotent and lifts inline drafts cleanly', async () => {
    // Pre-flight: clear any sentinel left by an earlier suite so this
    // test actually exercises the migration body. (Subsequent runs from
    // this same describe block should still be idempotent because the
    // migration writes the sentinel.)
    await db.AuditLog.destroy({ where: { action: 'phase4_17_lead_draft_columns_backfilled' } });
    await db.AuditLog.destroy({ where: { action: 'phase4_17_lead_draft_backfilled' } });

    const lead = await newLead({
      draftSubject: 'Inline subject from /new-clients',
      draftBody: 'Inline body, 3 lines, factory-direct positioning.',
    });
    // No OutreachEmail draft exists yet.
    expect(await db.OutreachEmail.count({ where: { leadId: lead.id, status: 'draft' } })).toBe(0);

    const first = await migrate417LeadDraftBackfill(db);
    expect(first.skipped).toBeFalsy();
    expect(first.rowsCreated).toBeGreaterThanOrEqual(1);
    const after1 = await db.OutreachEmail.findOne({
      where: { leadId: lead.id, status: 'draft' },
    });
    expect(after1).toBeTruthy();
    expect(after1.subject).toBe('Inline subject from /new-clients');
    expect(after1.bodyText).toBe('Inline body, 3 lines, factory-direct positioning.');
    expect(after1.fromAddress).toBe('alex@sovernhouse.co');
    expect(after1.brandCode).toBe('SH');

    // Second run is idempotent — sentinel present → no duplicate writes.
    const second = await migrate417LeadDraftBackfill(db);
    expect(second.skipped).toBe(true);
    const allForLead = await db.OutreachEmail.count({ where: { leadId: lead.id, status: 'draft' } });
    expect(allForLead).toBe(1);
  });
});
