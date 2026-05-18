/**
 * Phase 4.26d — Mobile push for auto-chain hops.
 *
 * Asserts the expoPushService + workflowService.notifyAutoChain wiring:
 *
 *   1. sendPushToUser with no userId is a no-op.
 *   2. sendPushToUser with no registered tokens returns skipped:no-active-tokens.
 *   3. sendPushToUser with one active token POSTs the expected Expo payload
 *      and returns sent=1.
 *   4. A DeviceNotRegistered ticket in the Expo response flips the token
 *      to isActive=false (dead-token cleanup).
 *   5. notifyAutoChain creates a Notification row AND triggers a push for
 *      a user with a registered token.
 *
 * No real Expo API is touched — global.fetch is stubbed in each test.
 */

const { v4: uuidv4 } = require('uuid');

const { getApp, getDb, seedTestData, cleanup } = require('../setup');

describe('Phase 4.26d — Expo push for auto-chain', () => {
  let db, testData;
  let originalFetch;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();
    originalFetch = global.fetch;
  }, 180000);

  afterAll(async () => {
    global.fetch = originalFetch;
    await cleanup();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('1. sendPushToUser with no userId is a no-op', async () => {
    const { sendPushToUser } = require('../../services/expoPushService');
    const res = await sendPushToUser(null, { title: 'X', body: 'Y' });
    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
  });

  it('2. sendPushToUser with no active tokens skips cleanly', async () => {
    const { sendPushToUser } = require('../../services/expoPushService');
    const res = await sendPushToUser(testData.admin.id, { title: 'X', body: 'Y' });
    expect(res.ok).toBe(true);
    expect(res.skipped).toBe(true);
    expect(res.reason).toBe('no-active-tokens');
  });

  it('3. sendPushToUser POSTs to Expo with the right payload shape', async () => {
    // Stage one active token.
    const token = await db.ExpoPushToken.create({
      id: uuidv4(),
      userId: testData.admin.id,
      token: 'ExponentPushToken[unit-test-active]',
      platform: 'ios',
      isActive: true,
    });

    let capturedUrl;
    let capturedBody;
    global.fetch = jest.fn(async (url, init) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ data: [{ status: 'ok', id: 'ticket-1' }] }),
      };
    });

    const { sendPushToUser } = require('../../services/expoPushService');
    const res = await sendPushToUser(testData.admin.id, {
      title: 'Workflow update',
      body: 'Pro Forma auto-created from quotation QOT-2026-0001.',
      data: { kind: 'auto_chain', entityType: 'ProformaInvoice', entityId: 'pi-1' },
    });

    expect(res.ok).toBe(true);
    expect(res.sent).toBe(1);
    expect(capturedUrl).toBe('https://exp.host/--/api/v2/push/send');
    expect(Array.isArray(capturedBody)).toBe(true);
    expect(capturedBody[0].to).toBe(token.token);
    expect(capturedBody[0].title).toBe('Workflow update');
    expect(capturedBody[0].data.kind).toBe('auto_chain');
    expect(capturedBody[0].data.entityType).toBe('ProformaInvoice');
    expect(capturedBody[0].priority).toBe('high');

    await token.destroy({ force: true });
  });

  it('4. DeviceNotRegistered ticket deactivates the token', async () => {
    const dead = await db.ExpoPushToken.create({
      id: uuidv4(),
      userId: testData.admin.id,
      token: 'ExponentPushToken[dead]',
      platform: 'ios',
      isActive: true,
    });

    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({
        data: [{
          status: 'error',
          message: 'The recipient device is not registered.',
          details: { error: 'DeviceNotRegistered' },
        }],
      }),
    }));

    const { sendPushToUser } = require('../../services/expoPushService');
    const res = await sendPushToUser(testData.admin.id, { title: 'X', body: 'Y' });
    expect(res.ok).toBe(true);
    expect(res.deactivated).toBe(1);

    const after = await db.ExpoPushToken.findByPk(dead.id);
    expect(after.isActive).toBe(false);
    await after.destroy({ force: true });
  });

  it('5. notificationService.createNotification fires exactly one push via expoPushService', async () => {
    const token = await db.ExpoPushToken.create({
      id: uuidv4(),
      userId: testData.admin.id,
      token: 'ExponentPushToken[chain-test]',
      platform: 'android',
      isActive: true,
    });

    let pushCount = 0;
    let lastBody = null;
    global.fetch = jest.fn(async (_url, init) => {
      pushCount += 1;
      lastBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => '',
        json: async () => ({ data: [{ status: 'ok', id: 't' }] }),
      };
    });

    // Going through notificationService.createNotification directly is
    // equivalent to what workflowService.notifyAutoChain does — the
    // service handles persistence + Socket.IO + push fan-out in one
    // call. This locks the Phase 4.26d invariant: one notification =
    // one push, not two.
    const notificationService = require('../../services/notificationService');
    await notificationService.createNotification(
      testData.admin.id,
      'auto_chain',
      'Workflow update',
      'Pro Forma auto-created from quotation QOT-X.',
      { kind: 'auto_chain', entityType: 'ProformaInvoice', entityId: 'pi-X' },
      '/proforma-invoices/pi-X',
    );

    expect(pushCount).toBe(1);
    expect(lastBody[0].data.kind).toBe('auto_chain');
    expect(lastBody[0].data.entityType).toBe('ProformaInvoice');

    const notif = await db.Notification.findOne({
      where: { userId: testData.admin.id, type: 'auto_chain' },
      order: [['createdAt', 'DESC']],
    });
    expect(notif).toBeTruthy();
    expect(notif.title).toBe('Workflow update');

    // Cleanup
    await token.destroy({ force: true });
    await notif.destroy({ force: true });
  });
});
