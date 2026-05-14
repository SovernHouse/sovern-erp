/**
 * Status Machine - Validates state transitions for orders
 * @module utils/statusMachine
 * @description Defines and validates valid status transitions for Sales Orders and Purchase Orders
 */

const { ValidationError } = require('../middleware/errorHandler');

/**
 * Valid status transitions for Sales Orders.
 *
 * Phase 4, C16: reconciled with SalesOrder model enum
 * (confirmed/in_production/ready/shipped/in_transit/delivered/completed/cancelled).
 * Dropped the previous 'processing' state (never existed on the model
 * and rejected by Sequelize at write time). Added 'in_transit'
 * transition coverage (the model has it; the state machine didn't).
 * 'draft' is retained for explicit-draft callers; the model defaults
 * to 'confirmed' so most SOs never visit draft.
 */
const SALES_ORDER_TRANSITIONS = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'cancelled'],
  in_production: ['ready', 'shipped', 'cancelled'],
  ready: ['shipped', 'cancelled'],
  shipped: ['in_transit', 'delivered', 'cancelled'],
  in_transit: ['delivered', 'cancelled'],
  delivered: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

/**
 * Valid status transitions for Purchase Orders
 */
const PURCHASE_ORDER_TRANSITIONS = {
  draft: ['sent', 'cancelled'],
  sent: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'cancelled'],
  in_production: ['ready', 'cancelled'],
  ready: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

/**
 * Validates a status transition
 * @param {string} currentStatus - Current status of the entity
 * @param {string} newStatus - Desired new status
 * @param {string} entityType - Type of entity ('sales_order' or 'purchase_order')
 * @throws {ValidationError} If transition is not allowed
 * @returns {boolean} True if transition is valid
 */
function validateTransition(currentStatus, newStatus, entityType) {
  const transitions = entityType === 'sales_order'
    ? SALES_ORDER_TRANSITIONS
    : PURCHASE_ORDER_TRANSITIONS;

  if (!transitions[currentStatus]) {
    throw new ValidationError(`Invalid current status: ${currentStatus}`);
  }

  if (!transitions[currentStatus].includes(newStatus)) {
    throw new ValidationError(
      `Invalid status transition from '${currentStatus}' to '${newStatus}'. ` +
      `Valid transitions: ${transitions[currentStatus].join(', ') || 'none'}`
    );
  }

  return true;
}

module.exports = {
  validateTransition,
  SALES_ORDER_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS
};
