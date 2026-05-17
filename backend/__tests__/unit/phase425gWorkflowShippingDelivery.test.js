/**
 * Phase 4.25g — workflowService.onSalesOrderShipped + onShipmentDelivered.
 */

delete process.env.SQLITE_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';

const { v4: uuidv4 } = require('uuid');

describe('Phase 4.25g — SO.shipped -> PackingList and Shipment.delivered -> SO.delivered', () => {
  let db, workflowService;
  let customer, factory;

  beforeAll(async () => {
    db = require('../../models');
    workflowService = require('../../services/workflowService');
    await db.sequelize.sync({ force: true });
    factory = await db.Factory.create({
      id: uuidv4(),
      companyName: 'F',
      email: 'f@t.com',
      phone: '+1',
      contactPerson: 'F',
      country: 'CN',
      isActive: true,
    });
    customer = await db.Customer.create({
      id: uuidv4(),
      companyName: 'C',
      email: 'c@t.com',
      phone: '+1',
      contactPerson: 'C',
      country: 'US',
      currency: 'USD',
      paymentTerms: 'Net 30',
      isActive: true,
    });
  }, 60000);

  afterAll(async () => {
    if (db && db.sequelize) await db.sequelize.close();
  });

  async function createSO({ status = 'shipped' } = {}) {
    return db.SalesOrder.create({
      id: uuidv4(),
      orderNumber: `SO-${uuidv4().slice(0, 8)}`,
      customerId: customer.id,
      factoryId: factory.id,
      brandCode: 'SH',
      status,
      subtotal: 1000,
      total: 1000,
      currency: 'USD',
    });
  }

  describe('onSalesOrderShipped', () => {
    it('creates a draft PackingList', async () => {
      const so = await createSO({ status: 'shipped' });
      const result = await workflowService.onSalesOrderShipped(so, { source: 'unit-test' });
      expect(result.ok).toBe(true);
      expect(result.alreadyExisted).toBe(false);
      const pl = result.packingList;
      expect(pl.salesOrderId).toBe(so.id);
      expect(pl.status).toBe('draft');
      expect(pl.packingListNumber).toMatch(/^PL-\d+$/);
    });

    it('is idempotent: re-run returns existing PL', async () => {
      const so = await createSO({ status: 'shipped' });
      const first = await workflowService.onSalesOrderShipped(so, { source: 'unit-test' });
      const second = await workflowService.onSalesOrderShipped(so, { source: 'unit-test' });
      expect(second.alreadyExisted).toBe(true);
      expect(second.packingList.id).toBe(first.packingList.id);
      const all = await db.PackingList.findAll({ where: { salesOrderId: so.id } });
      expect(all.length).toBe(1);
    });

    it('handles invalid input', async () => {
      const r = await workflowService.onSalesOrderShipped({}, { source: 'unit-test' });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('invalid_input');
    });
  });

  describe('onShipmentDelivered', () => {
    async function createShipment({ soStatus = 'in_transit' } = {}) {
      const so = await createSO({ status: soStatus });
      const shipment = await db.Shipment.create({
        id: uuidv4(),
        salesOrderId: so.id,
        shipmentNumber: `SHP-${uuidv4().slice(0, 8)}`,
        status: 'delivered',
      });
      return { so, shipment };
    }

    it('transitions SO to delivered when it was in_transit', async () => {
      const { so, shipment } = await createShipment({ soStatus: 'in_transit' });
      const result = await workflowService.onShipmentDelivered(shipment, { source: 'unit-test' });
      expect(result.ok).toBe(true);
      expect(result.statusBefore).toBe('in_transit');
      expect(result.statusAfter).toBe('delivered');
      await so.reload();
      expect(so.status).toBe('delivered');
    });

    it('refuses when SO is in shipped (model hook requires in_transit first)', async () => {
      const { shipment } = await createShipment({ soStatus: 'shipped' });
      const result = await workflowService.onShipmentDelivered(shipment, { source: 'unit-test' });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('status_transition_invalid');
    });

    it('is no-op when SO is already delivered', async () => {
      const { so, shipment } = await createShipment({ soStatus: 'delivered' });
      const result = await workflowService.onShipmentDelivered(shipment, { source: 'unit-test' });
      expect(result.ok).toBe(true);
      expect(result.alreadyExisted).toBe(true);
      expect(result.statusAfter).toBe('delivered');
      await so.reload();
      expect(so.status).toBe('delivered');
    });

    it('refuses when SO is in an unexpected status (e.g. confirmed)', async () => {
      const { shipment } = await createShipment({ soStatus: 'confirmed' });
      const result = await workflowService.onShipmentDelivered(shipment, { source: 'unit-test' });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('status_transition_invalid');
    });

    it('handles invalid input', async () => {
      const r1 = await workflowService.onShipmentDelivered({}, { source: 'unit-test' });
      expect(r1.ok).toBe(false);
      expect(r1.code).toBe('invalid_input');
    });
  });
});
