/**
 * Phase 4.25f — workflowService.onPaymentConfirmed unit test.
 *
 * Critical correctness: idempotency. Re-running on the same confirmed
 * payment must NOT double-count paidAmount.
 */

delete process.env.SQLITE_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';

const { v4: uuidv4 } = require('uuid');

describe('Phase 4.25f — workflowService.onPaymentConfirmed', () => {
  let db, workflowService;
  let customer;

  beforeAll(async () => {
    db = require('../../models');
    workflowService = require('../../services/workflowService');
    await db.sequelize.sync({ force: true });
    customer = await db.Customer.create({
      id: uuidv4(),
      companyName: 'C',
      email: 'c@test.com',
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

  async function createInvoiceWithPayments({
    invoiceTotal = 1000,
    paymentAmounts = [],
    paymentStatuses = [],
  } = {}) {
    const invoice = await db.Invoice.create({
      id: uuidv4(),
      invoiceNumber: `INV-${uuidv4().slice(0, 8)}`,
      customerId: customer.id,
      brandCode: 'SH',
      type: 'sales',
      status: 'sent',
      subtotal: invoiceTotal,
      total: invoiceTotal,
      balance: invoiceTotal,
      paidAmount: 0,
      currency: 'USD',
    });
    const payments = [];
    for (let i = 0; i < paymentAmounts.length; i++) {
      const p = await db.Payment.create({
        id: uuidv4(),
        invoiceId: invoice.id,
        amount: paymentAmounts[i],
        currency: 'USD',
        method: 'bank_transfer',
        date: new Date(),
        status: paymentStatuses[i] || 'pending',
      });
      payments.push(p);
    }
    return { invoice, payments };
  }

  it('marks Invoice as paid when sum of confirmed payments equals total', async () => {
    const { invoice, payments } = await createInvoiceWithPayments({
      invoiceTotal: 1000,
      paymentAmounts: [1000],
      paymentStatuses: ['confirmed'],
    });

    const result = await workflowService.onPaymentConfirmed(payments[0], { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.statusAfter).toBe('paid');
    expect(result.paidAmount).toBe(1000);
    expect(result.balance).toBe(0);

    await invoice.reload();
    expect(invoice.status).toBe('paid');
    expect(Number(invoice.paidAmount)).toBe(1000);
    expect(Number(invoice.balance)).toBe(0);
  });

  it('marks Invoice as partially_paid when sum is less than total', async () => {
    const { invoice, payments } = await createInvoiceWithPayments({
      invoiceTotal: 1000,
      paymentAmounts: [400],
      paymentStatuses: ['confirmed'],
    });

    const result = await workflowService.onPaymentConfirmed(payments[0], { source: 'unit-test' });
    expect(result.ok).toBe(true);
    expect(result.statusAfter).toBe('partially_paid');
    expect(result.paidAmount).toBe(400);
    expect(result.balance).toBe(600);
    await invoice.reload();
    expect(invoice.status).toBe('partially_paid');
  });

  it('idempotent: re-running on the same payment does NOT double-count', async () => {
    const { invoice, payments } = await createInvoiceWithPayments({
      invoiceTotal: 1000,
      paymentAmounts: [1000],
      paymentStatuses: ['confirmed'],
    });

    const first = await workflowService.onPaymentConfirmed(payments[0], { source: 'unit-test' });
    expect(first.paidAmount).toBe(1000);

    // Simulate someone hitting the confirm endpoint twice.
    const second = await workflowService.onPaymentConfirmed(payments[0], { source: 'unit-test' });
    expect(second.paidAmount).toBe(1000);
    expect(second.balance).toBe(0);

    await invoice.reload();
    expect(Number(invoice.paidAmount)).toBe(1000); // not 2000
  });

  it('handles multiple confirmed payments (sum across all)', async () => {
    const { invoice, payments } = await createInvoiceWithPayments({
      invoiceTotal: 1000,
      paymentAmounts: [400, 600],
      paymentStatuses: ['confirmed', 'confirmed'],
    });

    const result = await workflowService.onPaymentConfirmed(payments[1], { source: 'unit-test' });
    expect(result.paidAmount).toBe(1000);
    expect(result.statusAfter).toBe('paid');

    await invoice.reload();
    expect(Number(invoice.paidAmount)).toBe(1000);
    expect(invoice.status).toBe('paid');
  });

  it('ignores pending and rejected payments', async () => {
    const { invoice, payments } = await createInvoiceWithPayments({
      invoiceTotal: 1000,
      paymentAmounts: [400, 600, 500],
      paymentStatuses: ['confirmed', 'pending', 'rejected'],
    });

    const result = await workflowService.onPaymentConfirmed(payments[0], { source: 'unit-test' });
    expect(result.paidAmount).toBe(400); // only the confirmed payment counts
    expect(result.statusAfter).toBe('partially_paid');
    await invoice.reload();
    expect(Number(invoice.paidAmount)).toBe(400);
  });

  it('handles invalid input', async () => {
    const r1 = await workflowService.onPaymentConfirmed({}, { source: 'unit-test' });
    expect(r1.ok).toBe(false);
    expect(r1.code).toBe('invalid_input');
    const r2 = await workflowService.onPaymentConfirmed(
      { id: uuidv4(), invoiceId: uuidv4() },
      { source: 'unit-test' },
    );
    expect(r2.ok).toBe(false);
    expect(r2.code).toBe('not_found');
  });
});
