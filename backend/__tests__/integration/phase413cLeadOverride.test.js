// Phase 4.13c — Lead sanctions override route tests.
//
// Mirrors the existing /api/compliance/customers/:id/override but for
// Leads. Required behaviour:
//   - super_admin can override a 'flagged' Lead with a reason >= 10 chars
//   - reason < 10 chars rejected with 400 ValidationError
//   - non-super_admin (admin / sales / etc.) gets 403
//   - unauthenticated gets 401
//   - Lead not found → 404
//   - After override: screeningStatus='override', original hits preserved
//     in sanctions_screen_details with a new 'override' rule entry appended
//     carrying reviewer='super_admin', reviewerUserId, reviewerEmail, reason
//   - AuditLog row written with action='sanctions_override', entity='Lead',
//     entity_id matching the lead, changes.priorStatus + priorHits + reason
//   - Subsequent createQuotation for a downstream Customer is unblocked
//     (status='override' is not 'flagged') — covered indirectly by the
//     fact that quotationWriteService gates on 'flagged' only

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Phase 4.13c — POST /api/compliance/leads/:id/override', () => {
  let db, request, testData, superAdminToken;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();

    // Seed a super_admin user separately. seedTestData() only creates
    // an 'admin' user; this route is super_admin gated.
    const superAdmin = await db.User.create({
      id: uuidv4(),
      email: 'superadmin@phase413c.test',
      password: await bcrypt.hash('test12345', 10),
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      isActive: true,
    });
    superAdminToken = jwt.sign(
      { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
    );
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  async function seedFlaggedLead({ status = 'flagged' } = {}) {
    return db.Lead.create({
      companyName: `4.13c override target ${uuidv4()}`,
      contactName: 'Override Target',
      email: `override-${uuidv4()}@example.com`,
      country: 'Iran',
      brandCode: 'SH',
      screeningStatus: status,
      sanctionsScreenDetails: [{
        rule: 'jurisdiction',
        basis: 'OFAC comprehensive sanctions — Iran (ITSR 31 CFR Part 560 / EO 13599)',
        authority: 'OFAC',
        matched: 'country=Iran',
        reviewer: 'automated_screen',
        timestamp: new Date().toISOString(),
      }],
      lastScreenedAt: new Date(),
      status: 'new',
      source: 'other',
      leadType: 'outbound_prospect',
    });
  }

  it('super_admin can override a flagged Lead with a reason >= 10 chars', async () => {
    const lead = await seedFlaggedLead();

    const response = await request
      .post(`/api/compliance/leads/${lead.id}/override`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Customer holds an OFAC SDGT-approved general license; verified by counsel 2026-05-16.' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.screeningStatus).toBe('override');

    await lead.reload();
    expect(lead.screeningStatus).toBe('override');

    // The original hit is preserved + a new 'override' hit is appended.
    const details = Array.isArray(lead.sanctionsScreenDetails)
      ? lead.sanctionsScreenDetails
      : JSON.parse(lead.sanctionsScreenDetails);
    expect(details.length).toBe(2);
    expect(details[0].rule).toBe('jurisdiction');
    expect(details[1].rule).toBe('override');
    expect(details[1].reviewer).toBe('super_admin');
    expect(details[1].basis).toMatch(/SDGT-approved/);
    expect(details[1].reviewerEmail).toBe('superadmin@phase413c.test');
  });

  it('writes a sanctions_override AuditLog row with priorStatus + priorHits + reason', async () => {
    const lead = await seedFlaggedLead();
    const reason = 'OFAC General License No. H authorizes Q1 2026 humanitarian shipments.';

    await request
      .post(`/api/compliance/leads/${lead.id}/override`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason });

    await new Promise(r => setTimeout(r, 50));
    const auditRows = await db.AuditLog.findAll({
      where: { action: 'sanctions_override', entity: 'Lead', entityId: lead.id },
      order: [['createdAt', 'DESC']],
      limit: 1,
    });
    expect(auditRows.length).toBe(1);

    const changes = typeof auditRows[0].changes === 'string'
      ? JSON.parse(auditRows[0].changes)
      : auditRows[0].changes;
    expect(changes.priorStatus).toBe('flagged');
    expect(changes.reason).toBe(reason);
    expect(Array.isArray(changes.priorHits)).toBe(true);
    expect(changes.priorHits[0].rule).toBe('jurisdiction');
    expect(changes.overriddenBy).toBe('superadmin@phase413c.test');
  });

  it('rejects reason shorter than 10 characters with 400', async () => {
    const lead = await seedFlaggedLead();
    const response = await request
      .post(`/api/compliance/leads/${lead.id}/override`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'too short' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    // ValidationError surface goes through middleware/errorHandler which
    // nests message inside .error per its envelope contract.
    expect(response.body.error?.message).toMatch(/10 characters/);

    await lead.reload();
    expect(lead.screeningStatus).toBe('flagged');  // unchanged
  });

  it('rejects missing reason with 400', async () => {
    const lead = await seedFlaggedLead();
    const response = await request
      .post(`/api/compliance/leads/${lead.id}/override`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({});

    expect(response.status).toBe(400);
    await lead.reload();
    expect(lead.screeningStatus).toBe('flagged');
  });

  it('returns 404 for a non-existent Lead', async () => {
    const response = await request
      .post(`/api/compliance/leads/${uuidv4()}/override`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'This reason is definitely longer than ten characters.' });

    expect(response.status).toBe(404);
  });

  it('rejects an admin (non-super_admin) with 403', async () => {
    const lead = await seedFlaggedLead();
    const response = await request
      .post(`/api/compliance/leads/${lead.id}/override`)
      .set('Authorization', `Bearer ${testData.authToken}`)  // role='admin'
      .send({ reason: 'This reason is more than ten characters long.' });

    expect(response.status).toBe(403);
    await lead.reload();
    expect(lead.screeningStatus).toBe('flagged');
  });

  it('rejects an unauthenticated request with 401', async () => {
    const lead = await seedFlaggedLead();
    const response = await request
      .post(`/api/compliance/leads/${lead.id}/override`)
      .send({ reason: 'This reason is more than ten characters long.' });

    expect(response.status).toBe(401);
    await lead.reload();
    expect(lead.screeningStatus).toBe('flagged');
  });

  it('preserves prior manual_db_override hits when applying a new override', async () => {
    const lead = await db.Lead.create({
      companyName: `4.13c manual chain ${uuidv4()}`,
      contactName: 'Manual',
      email: `manual-chain-${uuidv4()}@example.com`,
      country: 'Iran',
      brandCode: 'SH',
      screeningStatus: 'blocked',
      sanctionsScreenDetails: [{
        rule: 'jurisdiction',
        basis: 'OFAC comprehensive sanctions — Iran (ITSR 31 CFR Part 560 / EO 13599)',
        authority: 'OFAC',
        matched: 'country=Iran',
        reviewer: 'manual_db_override',
        timestamp: '2026-05-16T03:25:00Z',
        note: 'Originally added manually.',
      }],
      lastScreenedAt: new Date(),
      status: 'new',
      source: 'other',
      leadType: 'outbound_prospect',
    });

    const response = await request
      .post(`/api/compliance/leads/${lead.id}/override`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ reason: 'Treasury OFAC License #XYZ-2026-001 issued 2026-05-16, valid through Q4.' });

    expect(response.status).toBe(200);
    await lead.reload();
    const details = Array.isArray(lead.sanctionsScreenDetails)
      ? lead.sanctionsScreenDetails
      : JSON.parse(lead.sanctionsScreenDetails);
    expect(details.length).toBe(2);
    expect(details[0].reviewer).toBe('manual_db_override');
    expect(details[1].reviewer).toBe('super_admin');
  });
});
