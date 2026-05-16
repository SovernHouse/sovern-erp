/**
 * internalApprovalWriteService — Phase 4.15d-1.
 *
 * Shared service for InternalApproval submit / decide / cancel.
 * Mirrors the Phase 4.12 service-layer pattern.
 *
 * Key invariants:
 *   - Self-approval rejected. The requester cannot also be the approver
 *     (per Alex's 4.15d spec). decidedByUserId !== requestedByUserId
 *     is enforced both in approve and reject paths.
 *   - approvalType constrained to the existing model enum:
 *     send_quotation / confirm_sales_order / place_purchase_order /
 *     process_payment / stage_advancement / general. Alex's spec
 *     mentioned 'pricing_override' / 'discount' / 'credit_limit' /
 *     'contract_clause' but those aren't in the schema; using 'general'
 *     as the catch-all for non-enum cases keeps the change additive.
 *     If those specific types become common, extend the enum in a
 *     follow-up.
 *   - State transitions: pending → approved | rejected | cancelled.
 *     Already-decided approvals cannot be re-decided (return validation
 *     error pointing the caller at submitting a new approval request).
 *
 * Return shape mirrors the rest of the aiWriteServices:
 *   { ok: true, approval, before?, after? }
 *   { ok: false, code, httpStatus, message }
 */

const db = require('../../models');

const VALID_APPROVAL_TYPES = new Set([
  'send_quotation',
  'confirm_sales_order',
  'place_purchase_order',
  'process_payment',
  'stage_advancement',
  'general',
]);

const VALID_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

function err(code, httpStatus, message, extra = {}) {
  return { ok: false, code, httpStatus, message, ...extra };
}

async function submitApproval(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  const { userId } = ctx || {};
  if (!userId) return err('validation', 400, 'requester userId required in ctx');

  const {
    approvalType,
    entityType,
    entityId,
    assignedToUserId,
    requestNote,
    priority,
    dueDate,
  } = payload;

  if (!entityType) return err('validation', 400, 'entityType is required');
  if (!entityId) return err('validation', 400, 'entityId is required');

  const resolvedType = approvalType && VALID_APPROVAL_TYPES.has(approvalType)
    ? approvalType
    : 'general';
  const resolvedPriority = priority && VALID_PRIORITIES.has(priority)
    ? priority
    : 'normal';

  // Block self-approval at submission: if the assigned approver is the
  // requester, fail before persisting. The actual approve/reject paths
  // re-check this in case the assignment is changed later.
  if (assignedToUserId && assignedToUserId === userId) {
    return err('validation', 400,
      'Cannot self-approve. assignedToUserId must differ from the requester. Either leave unassigned (any manager can approve) or pick a different approver.');
  }

  const approval = await db.InternalApproval.create({
    entityType,
    entityId: String(entityId),
    approvalType: resolvedType,
    requestedByUserId: userId,
    assignedToUserId: assignedToUserId || null,
    requestNote: requestNote || null,
    priority: resolvedPriority,
    dueDate: dueDate ? new Date(dueDate) : null,
    status: 'pending',
  });

  return { ok: true, approval };
}

async function decideApproval(id, decision, ctx) {
  if (!['approved', 'rejected'].includes(decision.status)) {
    return err('validation', 400, 'decision.status must be "approved" or "rejected"');
  }
  const { userId } = ctx || {};
  if (!userId) return err('validation', 400, 'decider userId required in ctx');

  const approval = await db.InternalApproval.findByPk(id);
  if (!approval) return err('not_found', 404, 'Approval not found');

  if (approval.status !== 'pending') {
    return err('validation', 400,
      `Approval is already ${approval.status}. Submit a new approval request instead of re-deciding this one.`);
  }

  // Self-approval block: the decider cannot be the original requester.
  if (approval.requestedByUserId === userId) {
    return err('validation', 403,
      'Cannot self-approve. The decider must differ from the requester. Ask another manager / admin to review.');
  }

  // If the approval was assigned to a specific user, only that user
  // (plus super_admin) can decide. Super-admin override is intentional —
  // it matches the existing brand-override pattern.
  if (approval.assignedToUserId && approval.assignedToUserId !== userId) {
    if (ctx?.role !== 'super_admin') {
      return err('validation', 403,
        `This approval is assigned to a specific user. Only the assignee (or super_admin) can decide it.`);
    }
  }

  const before = approval.toJSON();
  await approval.update({
    status: decision.status,
    decisionNote: decision.note || null,
    decidedByUserId: userId,
    decidedAt: new Date(),
  });
  const after = approval.toJSON();

  return { ok: true, approval, before, after };
}

async function cancelApproval(id, ctx) {
  const { userId } = ctx || {};
  const approval = await db.InternalApproval.findByPk(id);
  if (!approval) return err('not_found', 404, 'Approval not found');

  if (approval.status !== 'pending') {
    return err('validation', 400,
      `Approval is already ${approval.status}; only pending approvals can be cancelled.`);
  }

  // Only the original requester or a super_admin can cancel.
  if (approval.requestedByUserId !== userId && ctx?.role !== 'super_admin') {
    return err('validation', 403,
      'Only the original requester (or super_admin) can cancel an approval.');
  }

  const before = approval.toJSON();
  await approval.update({
    status: 'cancelled',
    decidedByUserId: userId,
    decidedAt: new Date(),
  });
  return { ok: true, approval, before };
}

module.exports = {
  submitApproval,
  decideApproval,
  cancelApproval,
  VALID_APPROVAL_TYPES,
  VALID_PRIORITIES,
};
