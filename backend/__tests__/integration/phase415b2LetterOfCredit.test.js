// Phase 4.15b-2 — Letter of Credit service tests.

const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const svc = require('../../services/aiWriteServices/letterOfCreditWriteService');

describe('Phase 4.15b-2 — letterOfCreditWriteService', () => {
  let db, testData, secondUser;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();
    secondUser = await db.User.create({
      id: uuidv4(),
      email: 'second@test.com',
      password: 'x',
      firstName: 'Second',
      lastName: 'User',
      role: 'admin',
      isActive: true,
    });
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  function baseLcPayload(overrides = {}) {
    return Object.assign({
      supplierId: testData.factory.id,
      customerId: testData.customer.id,
      issuingBank: 'Bank of Test',
      beneficiary: 'Sovern House Trading',
      amount: 100000,
      currency: 'USD',
      issueDate: '2026-05-01T00:00:00Z',
      expiryDate: '2026-08-01T00:00:00Z',
      type: 'sight',
      paymentTerms: 'at_sight',
      tolerance: 5,
      toleranceType: 'percentage',
    }, overrides);
  }

  // ── createLetterOfCredit ───────────────────────────────────────────

  describe('createLetterOfCredit', () => {
    it('happy path creates a draft LC', async () => {
      const r = await svc.createLetterOfCredit(baseLcPayload(),
        { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.lc.status).toBe('draft');
      expect(r.lc.lcNumber).toMatch(/^LC-\d+-[A-Z0-9]+$/);
      expect(Number(r.lc.amount)).toBe(100000);
    });

    it('rejects amount <= 0', async () => {
      const r = await svc.createLetterOfCredit(baseLcPayload({ amount: 0 }),
        { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/amount/);
    });

    it('rejects expiry on or before issue', async () => {
      const r = await svc.createLetterOfCredit(baseLcPayload({
        issueDate: '2026-05-01T00:00:00Z',
        expiryDate: '2026-04-01T00:00:00Z',
      }), { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/expiryDate/);
    });

    it('404s on unknown supplier', async () => {
      const r = await svc.createLetterOfCredit(baseLcPayload({ supplierId: uuidv4() }),
        { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
      expect(r.message).toMatch(/Factory/);
    });

    it('404s on unknown customer', async () => {
      const r = await svc.createLetterOfCredit(baseLcPayload({ customerId: uuidv4() }),
        { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
      expect(r.message).toMatch(/Customer/);
    });

    it('rejects unknown type / paymentTerms / toleranceType', async () => {
      const a = await svc.createLetterOfCredit(baseLcPayload({ type: 'forever' }),
        { userId: testData.admin.id });
      expect(a.ok).toBe(false);
      const b = await svc.createLetterOfCredit(baseLcPayload({ paymentTerms: 'sometimes' }),
        { userId: testData.admin.id });
      expect(b.ok).toBe(false);
      const c = await svc.createLetterOfCredit(baseLcPayload({ toleranceType: 'random' }),
        { userId: testData.admin.id });
      expect(c.ok).toBe(false);
    });

    it('409s on duplicate lcNumber', async () => {
      const num = `LC-DUP-${uuidv4().slice(0, 6)}`;
      await svc.createLetterOfCredit(baseLcPayload({ lcNumber: num }),
        { userId: testData.admin.id });
      const second = await svc.createLetterOfCredit(baseLcPayload({ lcNumber: num }),
        { userId: testData.admin.id });
      expect(second.ok).toBe(false);
      expect(second.httpStatus).toBe(409);
    });
  });

  // ── submit + approve state machine ─────────────────────────────────

  describe('submit + approve + self-approval block', () => {
    let lcId;

    beforeAll(async () => {
      const r = await svc.createLetterOfCredit(baseLcPayload(),
        { userId: testData.admin.id });
      lcId = r.lc.id;
    });

    it('submit: draft → submitted; embeds submitter marker', async () => {
      const r = await svc.submitLetterOfCredit(lcId, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.after.status).toBe('submitted');
      expect(r.after.notes).toMatch(/\[submitted_by:\s*[0-9a-f-]+\]/);
      expect(svc.extractSubmitterId(r.after.notes)).toBe(testData.admin.id);
    });

    it('submit refuses non-draft', async () => {
      const r = await svc.submitLetterOfCredit(lcId, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/draft/);
    });

    it('approve refuses self-approval (submitter === approver)', async () => {
      const r = await svc.approveLetterOfCredit(lcId, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('forbidden');
      expect(r.message).toMatch(/Self-approval/);
    });

    it('approve happy path with a different user: submitted → approved', async () => {
      const r = await svc.approveLetterOfCredit(lcId, { userId: secondUser.id });
      expect(r.ok).toBe(true);
      expect(r.after.status).toBe('approved');
      expect(r.before.status).toBe('submitted');
    });

    it('approve refuses non-submitted', async () => {
      const r = await svc.approveLetterOfCredit(lcId, { userId: secondUser.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/submitted/);
    });

    it('approve 404s on unknown id', async () => {
      const r = await svc.approveLetterOfCredit(uuidv4(), { userId: secondUser.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });
  });

  // ── attachLcDocument ───────────────────────────────────────────────

  describe('attachLcDocument', () => {
    let lcId;

    beforeAll(async () => {
      const r = await svc.createLetterOfCredit(baseLcPayload(),
        { userId: testData.admin.id });
      lcId = r.lc.id;
    });

    it('happy path creates a pending document row', async () => {
      const r = await svc.attachLcDocument({
        letterOfCreditId: lcId,
        documentType: 'invoice',
        fileName: 'invoice-12345.pdf',
        fileUrl: 'https://drive.example/invoice-12345.pdf',
        documentNumber: 'INV-12345',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.document.documentType).toBe('invoice');
      expect(r.document.status).toBe('pending');
    });

    it('rejects unknown documentType', async () => {
      const r = await svc.attachLcDocument({
        letterOfCreditId: lcId, documentType: 'random_doc',
        fileName: 'x', fileUrl: 'y',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/documentType/);
    });

    it('rejects missing fileName', async () => {
      const r = await svc.attachLcDocument({
        letterOfCreditId: lcId, documentType: 'invoice', fileUrl: 'y',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/fileName/);
    });

    it('404s on unknown lcId', async () => {
      const r = await svc.attachLcDocument({
        letterOfCreditId: uuidv4(), documentType: 'invoice',
        fileName: 'x', fileUrl: 'y',
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });
  });

  // ── recordLcPayment ────────────────────────────────────────────────

  describe('recordLcPayment + tolerance', () => {
    let lcId;

    beforeAll(async () => {
      const r = await svc.createLetterOfCredit(baseLcPayload({
        amount: 100000, tolerance: 5, toleranceType: 'percentage',
      }), { userId: testData.admin.id });
      lcId = r.lc.id;
      await svc.submitLetterOfCredit(lcId, { userId: testData.admin.id });
      await svc.approveLetterOfCredit(lcId, { userId: secondUser.id });
    });

    it('refuses when LC not approved/active/presented', async () => {
      const draft = await svc.createLetterOfCredit(baseLcPayload(),
        { userId: testData.admin.id });
      const r = await svc.recordLcPayment(draft.lc.id, {
        paidAmount: 100000,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/approved\/active\/presented/);
    });

    it('presented only: status → presented', async () => {
      const r = await svc.recordLcPayment(lcId, {
        presentedAmount: 100000,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.after.status).toBe('presented');
    });

    it('paid within tolerance: status → paid', async () => {
      // amount=100000, tolerance=5%, so 95000–105000 is acceptable.
      const r = await svc.recordLcPayment(lcId, {
        paidAmount: 97500,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(true);
      expect(r.after.status).toBe('paid');
      expect(Number(r.after.paidAmount)).toBe(97500);
    });

    it('paid outside tolerance: refused with discrepancy message', async () => {
      const fresh = await svc.createLetterOfCredit(baseLcPayload({
        amount: 100000, tolerance: 5, toleranceType: 'percentage',
      }), { userId: testData.admin.id });
      await svc.submitLetterOfCredit(fresh.lc.id, { userId: testData.admin.id });
      await svc.approveLetterOfCredit(fresh.lc.id, { userId: secondUser.id });
      const r = await svc.recordLcPayment(fresh.lc.id, {
        paidAmount: 80000,  // 20% short, way over 5% tolerance
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/tolerance/);
    });

    it('tolerance_type=amount works on absolute basis', async () => {
      const fresh = await svc.createLetterOfCredit(baseLcPayload({
        amount: 100000, tolerance: 250, toleranceType: 'amount',
      }), { userId: testData.admin.id });
      await svc.submitLetterOfCredit(fresh.lc.id, { userId: testData.admin.id });
      await svc.approveLetterOfCredit(fresh.lc.id, { userId: secondUser.id });
      // 100000 ± 250 absolute => 99750–100250 ok
      const a = await svc.recordLcPayment(fresh.lc.id, {
        paidAmount: 99900,
      }, { userId: testData.admin.id });
      expect(a.ok).toBe(true);
      expect(a.after.status).toBe('paid');
    });

    it('rejects non-positive amounts', async () => {
      const fresh = await svc.createLetterOfCredit(baseLcPayload(),
        { userId: testData.admin.id });
      await svc.submitLetterOfCredit(fresh.lc.id, { userId: testData.admin.id });
      await svc.approveLetterOfCredit(fresh.lc.id, { userId: secondUser.id });
      const r = await svc.recordLcPayment(fresh.lc.id, {
        presentedAmount: 0,
      }, { userId: testData.admin.id });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/presentedAmount/);
    });
  });

  // ── list + get ─────────────────────────────────────────────────────

  describe('list + get', () => {
    it('listLettersOfCredit filters by status', async () => {
      const r = await svc.listLettersOfCredit({ status: 'draft' });
      expect(r.ok).toBe(true);
      expect(r.letters.every(l => l.status === 'draft')).toBe(true);
    });

    it('listLettersOfCredit rejects unknown status', async () => {
      const r = await svc.listLettersOfCredit({ status: 'whoknows' });
      expect(r.ok).toBe(false);
      expect(r.message).toMatch(/status/);
    });

    it('listLettersOfCredit filters by expiringBefore', async () => {
      const r = await svc.listLettersOfCredit({ expiringBefore: '2030-01-01T00:00:00Z' });
      expect(r.ok).toBe(true);
      expect(r.letters.length).toBeGreaterThan(0);
    });

    it('getLetterOfCredit eager-loads documents + customer + supplier', async () => {
      const seed = await svc.createLetterOfCredit(baseLcPayload(),
        { userId: testData.admin.id });
      await svc.attachLcDocument({
        letterOfCreditId: seed.lc.id,
        documentType: 'bill_of_lading',
        fileName: 'bl.pdf',
        fileUrl: 'https://x/bl.pdf',
      }, { userId: testData.admin.id });

      const r = await svc.getLetterOfCredit(seed.lc.id);
      expect(r.ok).toBe(true);
      expect(r.lc.documents.length).toBe(1);
      expect(r.lc.customer).toBeDefined();
      expect(r.lc.supplier).toBeDefined();
    });

    it('getLetterOfCredit 404s on unknown id', async () => {
      const r = await svc.getLetterOfCredit(uuidv4());
      expect(r.ok).toBe(false);
      expect(r.code).toBe('not_found');
    });
  });
});
