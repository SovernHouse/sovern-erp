// Phase 4.28h — customer P&L now folds CommissionTracking + reimbursements.
//
// The existing customer profitability endpoint computed netProfit as
// (Invoice − PurchaseOrder) − Expenses − overhead. This shape is correct
// for SH (where Sovern adds a price markup) but produces $0 gross margin
// for FW/HH deals (where the buyer-facing price already includes Sovern's
// commission and the actual revenue lands in CommissionTracking).
//
// What this test asserts on /api/customers/:id/profitability:
//   1. commissionRevenue.accrued is the sum of CommissionTracking.amount
//      for the customer in the period (excluding clawed_back rows).
//   2. reimbursementsReceived.total is the sum of direct Expense rows
//      with submissionStatus='paid' (factory has reimbursed Alex).
//   3. unreimbursedExpenses.total = directExpenses − reimbursements.
//   4. netCommissionProfit = commissionRevenue.accrued − unreimbursedExpenses.
//   5. totalNetProfit folds commission + reimbursements into the blended
//      view, so an FW deal with $636.65 commission, $412 reimbursed
//      expenses, and $0 Invoice−PO gross shows positive net.

const { v4: uuidv4 } = require('uuid');

describe('Phase 4.28h — customer P&L includes CommissionTracking + reimbursements', () => {
  let db;
  let app;
  let request;
  let authToken;
  let customerId;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.TEST_LIGHT_BOOT = 'true';
    process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
    db = require('../../models');
    await db.sequelize.sync({ force: true });
    // L-034 workaround: CommissionTracking carries inline `references: {
    // model: 'SalesOrders' }` etc, which doesn't match the freezeTableName
    // singular table names. Test-only PRAGMA disables the FK check so the
    // controller can be exercised without the unrelated FK rewrite. Prod
    // SQLite has foreign_keys=OFF by default anyway; the controller does
    // not depend on FK enforcement.
    await db.sequelize.query('PRAGMA foreign_keys = OFF');

    const serverModule = require('../../server');
    app = serverModule.app;
    const supertest = require('supertest');
    request = supertest(app);

    // Test super_admin user + auth token.
    const bcrypt = require('bcryptjs');
    const user = await db.User.create({
      id: uuidv4(),
      email: 'pl-test@sovernhouse.example',
      firstName: 'PL',
      lastName: 'Test',
      password: await bcrypt.hash('test123', 10),
      role: 'super_admin',
    });
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Customer.
    const customer = await db.Customer.create({
      id: uuidv4(),
      companyName: 'Stevens Omni (test)',
      email: 'stevens-pl@test.example',
      phone: '+1-test',
      country: 'USA',
      brandRelationships: ['FW'],
    });
    customerId = customer.id;

    // Factory (FW brand, FlorWay).
    const factory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'FlorWay (test)',
      email: 'fw-pl@test.example',
      phone: '+60-test',
      brandCode: 'FW',
    });

    // SalesOrder for the FW deal: 1000 m² × $9.095 = $9,095.
    const so = await db.SalesOrder.create({
      id: uuidv4(),
      orderNumber: 'SO-PL-001',
      customerId: customer.id,
      factoryId: factory.id,
      status: 'confirmed',
      subtotal: 9095,
      totalAmount: 9095,
      currency: 'USD',
    });

    // Commission rule + accrued commission row at 7% on $9,095.
    const rule = await db.CommissionRule.create({
      id: uuidv4(),
      name: 'FlorWay Sales Commission',
      baseValue: 7.0,
      ruleType: 'percentage',
      isActive: true,
    });
    await db.CommissionTracking.create({
      id: uuidv4(),
      userId: user.id,
      commissionRuleId: rule.id,
      salesOrderId: so.id,
      customerId: customer.id,
      brandCode: 'FW',
      amount: 636.65,
      percentage: 7.0,
      orderAmount: 9095,
      status: 'accrued',
      accrualDate: new Date(),
    });

    // A second accrued row to make sure the sum works ($100 more).
    await db.CommissionTracking.create({
      id: uuidv4(),
      userId: user.id,
      commissionRuleId: rule.id,
      salesOrderId: so.id,
      customerId: customer.id,
      brandCode: 'FW',
      amount: 100,
      percentage: 7.0,
      orderAmount: 1429,
      status: 'accrued',
      accrualDate: new Date(),
    });

    // One clawed_back row that must NOT count toward accrued total.
    await db.CommissionTracking.create({
      id: uuidv4(),
      userId: user.id,
      commissionRuleId: rule.id,
      salesOrderId: so.id,
      customerId: customer.id,
      brandCode: 'FW',
      amount: 500,
      percentage: 7.0,
      orderAmount: 7143,
      status: 'clawed_back',
      accrualDate: new Date(),
    });

    // Expenses: one reimbursed ($412 paid back), one outstanding ($88 draft).
    await db.Expense.create({
      id: uuidv4(),
      userId: user.id,
      entryDate: new Date().toISOString().slice(0, 10),
      category: 'Flight',
      description: 'Klang factory inspection trip',
      originalCurrency: 'USD',
      originalAmount: 412,
      usdAmount: 412,
      customerId: customer.id,
      brandCode: 'FW',
      submissionStatus: 'paid', // reimbursed by factory
    });
    await db.Expense.create({
      id: uuidv4(),
      userId: user.id,
      entryDate: new Date().toISOString().slice(0, 10),
      category: 'Meal allowance',
      description: 'Per-diem at port',
      originalCurrency: 'USD',
      originalAmount: 88,
      usdAmount: 88,
      customerId: customer.id,
      brandCode: 'FW',
      submissionStatus: 'draft', // not yet reimbursed
    });
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  test('commissionRevenue.accrued sums non-clawed-back rows correctly', async () => {
    const res = await request
      .get(`/api/customers/${customerId}/profitability`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    // 636.65 + 100 = 736.65, clawed_back 500 excluded.
    expect(data.commissionRevenue.accrued).toBeCloseTo(736.65, 2);
    expect(data.commissionRevenue.count).toBe(3); // count includes all 3 rows
    expect(data.commissionRevenue.byBrand).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ brandCode: 'FW' }),
      ])
    );
  });

  test('reimbursementsReceived isolates the submissionStatus=paid subset', async () => {
    const res = await request
      .get(`/api/customers/${customerId}/profitability`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.directExpenses.total).toBeCloseTo(500, 2); // 412 + 88
    expect(data.reimbursementsReceived.total).toBeCloseTo(412, 2);
    expect(data.reimbursementsReceived.count).toBe(1);
    expect(data.unreimbursedExpenses.total).toBeCloseTo(88, 2);
    expect(data.unreimbursedExpenses.count).toBe(1);
  });

  test('netCommissionProfit = commissionRevenue.accrued − unreimbursedExpenses', async () => {
    const res = await request
      .get(`/api/customers/${customerId}/profitability`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    // 736.65 − 88 = 648.65
    expect(data.netCommissionProfit).toBeCloseTo(648.65, 2);
  });

  test('totalNetProfit folds commission + reimbursements over the blended view', async () => {
    const res = await request
      .get(`/api/customers/${customerId}/profitability`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    // grossProfit (0 — no Invoice − PO data for this test) + commission (736.65)
    // − unreimbursedExpenses (88) − allocatedOverhead (0 — no other customers).
    expect(data.grossProfit).toBeCloseTo(0, 2);
    expect(data.totalNetProfit).toBeCloseTo(648.65, 2);
  });

  test('backwards compat: existing fields still present', async () => {
    const res = await request
      .get(`/api/customers/${customerId}/profitability`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('revenue');
    expect(data).toHaveProperty('cogs');
    expect(data).toHaveProperty('grossProfit');
    expect(data).toHaveProperty('netProfit');
    expect(data).toHaveProperty('directCostRatio');
    expect(data).toHaveProperty('directExpenses');
    expect(data).toHaveProperty('allocatedOverhead');
  });
});
