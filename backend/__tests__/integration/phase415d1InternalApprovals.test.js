// Phase 4.15d-1 — Internal Approvals service tests.
//
// Coverage:
//   - submitApproval: happy path, missing required fields, self-assignment
//     at submission blocked, approvalType normalization to 'general' when
//     out-of-enum, default priority.
//   - decideApproval: approve happy path, reject with note, self-approval
//     blocked (requester decides their own), assigned-only enforcement
//     (non-assignee blocked unless super_admin), already-decided refused.
//   - cancelApproval: requester can cancel; non-requester non-super_admin
//     refused; already-decided refused.

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getApp, getDb, seedTestData, cleanup } = require('../setup');

const svc = require('../../services/aiWriteServices/internalApprovalWriteService');

describe('Phase 4.15d-1 — internalApprovalWriteService', () => {
  let db, testData, requesterUser, approverUser, superAdminUser;

  beforeAll(async () => {
    await getApp();
    db = getDb();
    testData = await seedTestData();

    // Three users for the role matrix.
    requesterUser = await db.User.create({
      id: uuidv4(),
      email: 'requester@phase415d1.test',
      password: await bcrypt.hash('test12345', 10),
      firstName: 'Req', lastName: 'User',
      role: 'sales', isActive: true,
    });
    approverUser = await db.User.create({
      id: uuidv4(),
      email: 'approver@phase415d1.test',
      password: await bcrypt.hash('test12345', 10),
      firstName: 'App', lastName: 'Rover',
      role: 'manager', isActive: true,
    });
    superAdminUser = await db.User.create({
      id: uuidv4(),
      email: 'super@phase415d1.test',
      password: await bcrypt.hash('test12345', 10),
      firstName: 'Super', lastName: 'Admin',
      role: 'super_admin', isActive: true,
    });
  }, 30000);

  afterAll(async () => {
    await cleanup();
  });

  // ── submitApproval ──────────────────────────────────────────────────

  describe('submitApproval', () => {
    it('happy path creates a pending approval row', async () => {
      const result = await svc.submitApproval({
        approvalType: 'send_quotation',
        entityType: 'Quotation',
        entityId: uuidv4(),
        assignedToUserId: approverUser.id,
        requestNote: 'Please review before sending.',
        priority: 'high',
      }, { userId: requesterUser.id, source: 'mcp' });

      expect(result.ok).toBe(true);
      expect(result.approval.status).toBe('pending');
      expect(result.approval.approvalType).toBe('send_quotation');
      expect(result.approval.priority).toBe('high');
      expect(result.approval.requestedByUserId).toBe(requesterUser.id);
      expect(result.approval.assignedToUserId).toBe(approverUser.id);
    });

    it('blocks self-assignment at submission', async () => {
      const result = await svc.submitApproval({
        entityType: 'Quotation',
        entityId: uuidv4(),
        assignedToUserId: requesterUser.id,  // same as requester
      }, { userId: requesterUser.id, source: 'mcp' });

      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
      expect(result.message).toMatch(/self-approve/i);
    });

    it('rejects missing entityType', async () => {
      const result = await svc.submitApproval({
        entityId: uuidv4(),
      }, { userId: requesterUser.id, source: 'mcp' });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
    });

    it('rejects missing entityId', async () => {
      const result = await svc.submitApproval({
        entityType: 'Quotation',
      }, { userId: requesterUser.id, source: 'mcp' });
      expect(result.ok).toBe(false);
    });

    it('normalizes out-of-enum approvalType to "general"', async () => {
      const result = await svc.submitApproval({
        approvalType: 'pricing_override',  // not in enum
        entityType: 'Quotation',
        entityId: uuidv4(),
      }, { userId: requesterUser.id, source: 'mcp' });
      expect(result.ok).toBe(true);
      expect(result.approval.approvalType).toBe('general');
    });

    it('defaults priority to "normal" when omitted or invalid', async () => {
      const a = await svc.submitApproval({
        entityType: 'X', entityId: uuidv4(),
      }, { userId: requesterUser.id, source: 'mcp' });
      const b = await svc.submitApproval({
        entityType: 'X', entityId: uuidv4(), priority: 'super-urgent',
      }, { userId: requesterUser.id, source: 'mcp' });
      expect(a.approval.priority).toBe('normal');
      expect(b.approval.priority).toBe('normal');
    });

    it('accepts unassigned approvals (any manager can decide)', async () => {
      const result = await svc.submitApproval({
        entityType: 'PurchaseOrder', entityId: uuidv4(),
      }, { userId: requesterUser.id, source: 'mcp' });
      expect(result.ok).toBe(true);
      expect(result.approval.assignedToUserId).toBe(null);
    });
  });

  // ── decideApproval ──────────────────────────────────────────────────

  describe('decideApproval', () => {
    async function seedPending(opts = {}) {
      const r = await svc.submitApproval({
        entityType: 'Quotation',
        entityId: uuidv4(),
        assignedToUserId: opts.assignedToUserId || approverUser.id,
      }, { userId: opts.requesterId || requesterUser.id, source: 'mcp' });
      return r.approval;
    }

    it('approver can approve a pending request', async () => {
      const ap = await seedPending();
      const result = await svc.decideApproval(ap.id, {
        status: 'approved', note: 'LGTM',
      }, { userId: approverUser.id, role: approverUser.role, source: 'mcp' });

      expect(result.ok).toBe(true);
      expect(result.after.status).toBe('approved');
      expect(result.after.decisionNote).toBe('LGTM');
      expect(result.after.decidedByUserId).toBe(approverUser.id);
    });

    it('approver can reject with a note', async () => {
      const ap = await seedPending();
      const result = await svc.decideApproval(ap.id, {
        status: 'rejected', note: 'Price too low, increase margin.',
      }, { userId: approverUser.id, role: approverUser.role, source: 'mcp' });
      expect(result.ok).toBe(true);
      expect(result.after.status).toBe('rejected');
      expect(result.after.decisionNote).toBe('Price too low, increase margin.');
    });

    it('blocks the requester from self-approving', async () => {
      const ap = await seedPending();
      const result = await svc.decideApproval(ap.id, {
        status: 'approved',
      }, { userId: requesterUser.id, role: requesterUser.role, source: 'mcp' });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/self-approve/i);
    });

    it('blocks non-assignees (unless super_admin)', async () => {
      const ap = await seedPending();
      const someoneElse = await db.User.create({
        id: uuidv4(),
        email: `noprov-${uuidv4()}@example.com`,
        password: await bcrypt.hash('x', 10),
        firstName: 'Some', lastName: 'One',
        role: 'sales', isActive: true,
      });
      const result = await svc.decideApproval(ap.id, {
        status: 'approved',
      }, { userId: someoneElse.id, role: someoneElse.role, source: 'mcp' });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/assignee/i);
    });

    it('super_admin can override the assignee-only rule', async () => {
      const ap = await seedPending();
      const result = await svc.decideApproval(ap.id, {
        status: 'approved', note: 'super-admin override',
      }, { userId: superAdminUser.id, role: 'super_admin', source: 'mcp' });
      expect(result.ok).toBe(true);
      expect(result.after.decidedByUserId).toBe(superAdminUser.id);
    });

    it('refuses to re-decide an already-approved request', async () => {
      const ap = await seedPending();
      await svc.decideApproval(ap.id, { status: 'approved' }, { userId: approverUser.id, role: approverUser.role });
      const second = await svc.decideApproval(ap.id, {
        status: 'rejected',
      }, { userId: approverUser.id, role: approverUser.role });
      expect(second.ok).toBe(false);
      expect(second.message).toMatch(/already approved/i);
    });

    it('rejects invalid decision.status', async () => {
      const ap = await seedPending();
      const result = await svc.decideApproval(ap.id, {
        status: 'maybe',
      }, { userId: approverUser.id, role: approverUser.role });
      expect(result.ok).toBe(false);
    });
  });

  // ── cancelApproval ──────────────────────────────────────────────────

  describe('cancelApproval', () => {
    async function seedPending() {
      const r = await svc.submitApproval({
        entityType: 'Quotation',
        entityId: uuidv4(),
        assignedToUserId: approverUser.id,
      }, { userId: requesterUser.id, source: 'mcp' });
      return r.approval;
    }

    it('requester can cancel their own pending approval', async () => {
      const ap = await seedPending();
      const result = await svc.cancelApproval(ap.id, {
        userId: requesterUser.id, role: requesterUser.role,
      });
      expect(result.ok).toBe(true);
      expect(result.approval.status).toBe('cancelled');
    });

    it('non-requester non-super-admin cannot cancel', async () => {
      const ap = await seedPending();
      const result = await svc.cancelApproval(ap.id, {
        userId: approverUser.id, role: approverUser.role,
      });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/original requester/i);
    });

    it('super_admin can cancel any pending approval', async () => {
      const ap = await seedPending();
      const result = await svc.cancelApproval(ap.id, {
        userId: superAdminUser.id, role: 'super_admin',
      });
      expect(result.ok).toBe(true);
      expect(result.approval.status).toBe('cancelled');
    });

    it('refuses to cancel an already-decided approval', async () => {
      const ap = await seedPending();
      await svc.decideApproval(ap.id, { status: 'approved' }, { userId: approverUser.id, role: approverUser.role });
      const result = await svc.cancelApproval(ap.id, { userId: requesterUser.id });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/already approved/i);
    });
  });
});
