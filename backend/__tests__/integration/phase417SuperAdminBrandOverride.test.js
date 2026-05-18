/**
 * Phase 4.17 — Super Admin brand override on Lead detail (2026-05-18).
 *
 * Asserts the leadWriteService.updateLead brand-flip path:
 *
 *   1. Non-super_admin sending brandCode in a PUT is silently stripped
 *      (original behaviour — backwards compatible).
 *   2. Super_admin sending brandCode flips Lead.brandCode and writes
 *      a super_admin_brand_override AuditLog + Lead 'event'
 *      ChatterMessage.
 *   3. Active OutreachEmail drafts are re-labelled to the new brand;
 *      historical sent rows are NOT touched.
 *   4. Sending the same brandCode as the current one is a no-op (no
 *      audit + no chatter; nothing to change).
 *   5. Targeting an inactive Brand returns 400.
 */

const { v4: uuidv4 } = require('uuid');

const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Phase 4.17 — Super Admin brand override (2026-05-18)', () => {
  let db, request, testData, regularUserToken, superAdminToken;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();

    // Seed SH + FW brands.
    if (!await db.Brand.findOne({ where: { code: 'SH' } })) {
      await db.Brand.create({
        id: uuidv4(), code: 'SH', displayName: 'Sovern House',
        senderEmail: 'alex@sovernhouse.co',
        primaryColor: '#1F3A5F', accentColor: '#C7A14A', active: true,
      });
    }
    if (!await db.Brand.findOne({ where: { code: 'FW' } })) {
      await db.Brand.create({
        id: uuidv4(), code: 'FW', displayName: 'FlorWay',
        senderEmail: 'alexflorway@gmail.com',
        primaryColor: '#0F5F3A', accentColor: '#CAA66A', active: true,
      });
    }

    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');
    // Non-super_admin user for the strip-brandCode negative case.
    const regularUser = await db.User.create({
      id: uuidv4(), email: 'regular@test.com',
      password: await bcrypt.hash('regular123', 10),
      firstName: 'Regular', lastName: 'User',
      role: 'manager', isActive: true,
    });
    regularUserToken = jwt.sign(
      { id: regularUser.id, email: regularUser.email, role: regularUser.role },
      process.env.JWT_SECRET, { expiresIn: '24h' },
    );
    // Super_admin with both brands accessible so the brand-flip can
    // target either. accessibleBrands defaults to ['SH'] when omitted,
    // which would 403 the FW flip with brand_not_writable.
    const superAdmin = await db.User.create({
      id: uuidv4(), email: 'superadmin@test.com',
      password: await bcrypt.hash('super123', 10),
      firstName: 'Super', lastName: 'Admin',
      role: 'super_admin', isActive: true,
      accessibleBrands: ['SH', 'FW'],
      defaultBrand: 'SH',
    });
    superAdminToken = jwt.sign(
      { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
      process.env.JWT_SECRET, { expiresIn: '24h' },
    );
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  async function newLead(brand = 'SH') {
    return db.Lead.create({
      id: uuidv4(),
      companyName: `Lead-${uuidv4().slice(0, 6)}`,
      contactName: 'Test',
      email: `t-${uuidv4().slice(0, 6)}@example.com`,
      status: 'new',
      brandCode: brand,
      leadNumber: `LD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    });
  }

  function adminAuth() {
    return { Authorization: `Bearer ${testData.authToken}` };
  }
  function superAdminAuth() {
    return { Authorization: `Bearer ${superAdminToken}` };
  }

  it('1. Non-super_admin: brandCode in PUT is silently stripped', async () => {
    const lead = await newLead('SH');
    const res = await request
      .put(`/api/crm/leads/${lead.id}`)
      .set({ Authorization: `Bearer ${regularUserToken}` })
      .send({ brandCode: 'FW', description: 'no-op' });
    expect(res.status).toBe(200);
    const fresh = await db.Lead.findByPk(lead.id);
    expect(fresh.brandCode).toBe('SH');
    const audit = await db.AuditLog.findOne({
      where: { entity: 'Lead', entityId: lead.id, action: 'super_admin_brand_override' },
    });
    expect(audit).toBeNull();
  });

  it('2. Super_admin flips brand + writes audit + posts chatter', async () => {
    const lead = await newLead('SH');
    const res = await request
      .put(`/api/crm/leads/${lead.id}`)
      .set(superAdminAuth())
      .send({ brandCode: 'FW' });
    expect(res.status).toBe(200);
    const fresh = await db.Lead.findByPk(lead.id);
    expect(fresh.brandCode).toBe('FW');

    const audit = await db.AuditLog.findOne({
      where: { entity: 'Lead', entityId: lead.id, action: 'super_admin_brand_override' },
    });
    expect(audit).toBeTruthy();
    expect(audit.changes.from).toBe('SH');
    expect(audit.changes.to).toBe('FW');

    const chatter = await db.ChatterMessage.findOne({
      where: { entityType: 'Lead', entityId: lead.id },
      order: [['createdAt', 'DESC']],
    });
    expect(chatter).toBeTruthy();
    expect(chatter.body).toMatch(/Brand changed: SH → FW/);
  });

  it('3. Active drafts cascade; sent rows are not touched', async () => {
    const lead = await newLead('SH');
    const draft = await db.OutreachEmail.create({
      id: uuidv4(), leadId: lead.id, fromAddress: 'alex@sovernhouse.co',
      toAddress: lead.email, toName: lead.contactName,
      subject: 'draft to relabel', bodyText: 'body', touchNumber: 1,
      status: 'draft', brandCode: 'SH',
    });
    const sent = await db.OutreachEmail.create({
      id: uuidv4(), leadId: lead.id, fromAddress: 'alex@sovernhouse.co',
      toAddress: lead.email, toName: lead.contactName,
      subject: 'historical sent', bodyText: 'body', touchNumber: 1,
      status: 'sent', brandCode: 'SH', sentAt: new Date(),
    });

    await request
      .put(`/api/crm/leads/${lead.id}`)
      .set(superAdminAuth())
      .send({ brandCode: 'FW' });

    await draft.reload();
    await sent.reload();
    expect(draft.brandCode).toBe('FW');
    expect(draft.fromAddress).toBe('alexflorway@gmail.com');
    expect(sent.brandCode).toBe('SH');
    expect(sent.fromAddress).toBe('alex@sovernhouse.co');
  });

  it('4. Same-brand PUT is a no-op (no audit + no chatter)', async () => {
    const lead = await newLead('FW');
    await db.ChatterMessage.destroy({ where: { entityType: 'Lead', entityId: lead.id } });
    const res = await request
      .put(`/api/crm/leads/${lead.id}`)
      .set(superAdminAuth())
      .send({ brandCode: 'FW', description: 'unrelated edit' });
    expect(res.status).toBe(200);
    const audit = await db.AuditLog.findOne({
      where: { entity: 'Lead', entityId: lead.id, action: 'super_admin_brand_override' },
    });
    expect(audit).toBeNull();
    const chatter = await db.ChatterMessage.findOne({
      where: { entityType: 'Lead', entityId: lead.id, body: { [require('sequelize').Op.like]: 'Brand changed%' } },
    });
    expect(chatter).toBeNull();
  });

  it('5. Brand the user can\'t access -> 403; inactive but-accessible -> 400', async () => {
    const lead = await newLead('SH');
    // 'XX' is not in accessibleBrands -> brand_not_writable (403).
    const inaccessible = await request
      .put(`/api/crm/leads/${lead.id}`)
      .set(superAdminAuth())
      .send({ brandCode: 'XX' });
    expect(inaccessible.status).toBe(403);
    expect((await db.Lead.findByPk(lead.id)).brandCode).toBe('SH');

    // Now seed an INACTIVE brand the user IS allowed to see, and try
    // that — the validation should fire after the access check.
    const inactiveCode = 'IB';
    await db.Brand.create({
      id: uuidv4(), code: inactiveCode, displayName: 'InactiveBrand',
      senderEmail: 'inactive@example.com',
      primaryColor: '#000000', accentColor: '#FFFFFF', active: false,
    });
    // Grant the super_admin user access to it for the duration of this test.
    const su = await db.User.findOne({ where: { email: 'superadmin@test.com' } });
    await su.update({ accessibleBrands: ['SH', 'FW', inactiveCode] });

    const inactiveRes = await request
      .put(`/api/crm/leads/${lead.id}`)
      .set(superAdminAuth())
      .send({ brandCode: inactiveCode });
    expect(inactiveRes.status).toBe(400);
    expect((await db.Lead.findByPk(lead.id)).brandCode).toBe('SH');

    // Restore the user's accessibleBrands to avoid leaking state into
    // sibling test files that share this DB.
    await su.update({ accessibleBrands: ['SH', 'FW'] });
  });
});
