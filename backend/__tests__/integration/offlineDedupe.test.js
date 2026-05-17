const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, getRequest, seedTestData, cleanup } = require('../setup');

describe('Offline write dedupe (X-Client-Uuid)', () => {
  let db, request, testData;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    request = await getRequest();
    testData = await seedTestData();
  }, 180000);

  afterAll(async () => {
    await cleanup();
  });

  // Build a minimal create payload that always passes the validators.
  function expensePayload() {
    return {
      category: 'Other',
      description: `dedupe-test-${uuidv4()}`,
      originalCurrency: 'USD',
      originalAmount: 12.34,
      submissionStatus: 'draft',
    };
  }

  test('same X-Client-Uuid replays return the cached body without a second row', async () => {
    const uuid = `c_${uuidv4()}`;
    const body = expensePayload();

    const first = await request
      .post('/api/expenses')
      .set('Authorization', `Bearer ${testData.authToken}`)
      .set('X-Client-Uuid', uuid)
      .send(body);

    expect(first.status).toBe(201);
    const firstId = first.body?.data?.id || first.body?.id;
    expect(firstId).toBeTruthy();

    // Second call with the SAME uuid — simulates the offline replay
    // arriving after the original response was lost.
    const second = await request
      .post('/api/expenses')
      .set('Authorization', `Bearer ${testData.authToken}`)
      .set('X-Client-Uuid', uuid)
      .send(body);

    expect(second.status).toBe(201);
    const secondId = second.body?.data?.id || second.body?.id;
    expect(secondId).toBe(firstId);

    // Confirm only ONE Expense row hit the DB for this description.
    const count = await db.Expense.count({ where: { description: body.description } });
    expect(count).toBe(1);
  });

  test('different X-Client-Uuid values create separate rows', async () => {
    const body1 = expensePayload();
    const body2 = expensePayload();

    const r1 = await request
      .post('/api/expenses')
      .set('Authorization', `Bearer ${testData.authToken}`)
      .set('X-Client-Uuid', `c_${uuidv4()}`)
      .send(body1);

    const r2 = await request
      .post('/api/expenses')
      .set('Authorization', `Bearer ${testData.authToken}`)
      .set('X-Client-Uuid', `c_${uuidv4()}`)
      .send(body2);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const id1 = r1.body?.data?.id || r1.body?.id;
    const id2 = r2.body?.data?.id || r2.body?.id;
    expect(id1).not.toBe(id2);
  });

  test('no X-Client-Uuid → no dedupe (passes through every time)', async () => {
    const body = expensePayload();

    const r1 = await request
      .post('/api/expenses')
      .set('Authorization', `Bearer ${testData.authToken}`)
      .send(body);

    const r2 = await request
      .post('/api/expenses')
      .set('Authorization', `Bearer ${testData.authToken}`)
      .send(body);

    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);
    const id1 = r1.body?.data?.id || r1.body?.id;
    const id2 = r2.body?.data?.id || r2.body?.id;
    expect(id1).not.toBe(id2);
    // Two rows created.
    const count = await db.Expense.count({ where: { description: body.description } });
    expect(count).toBe(2);
  });
});
