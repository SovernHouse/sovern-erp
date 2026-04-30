/**
 * statusTransitions.js
 *
 * Defines the legal status transitions for each document type.
 * Used by Sequelize beforeUpdate hooks to reject invalid moves.
 *
 * Format: { [modelName]: { [fromStatus]: Set<toStatus> } }
 *
 * Any transition NOT listed here will be rejected with a 400-level error.
 * Terminal states (empty Set or absent key) cannot be transitioned out of.
 */

const TRANSITIONS = {
  SalesOrder: {
    confirmed:     new Set(['in_production', 'cancelled']),
    in_production: new Set(['ready', 'cancelled']),
    ready:         new Set(['shipped', 'cancelled']),
    shipped:       new Set(['in_transit']),
    in_transit:    new Set(['delivered']),
    delivered:     new Set(['completed']),
    completed:     new Set(), // terminal
    cancelled:     new Set(), // terminal
  },

  ProformaInvoice: {
    draft:     new Set(['sent', 'cancelled']),
    sent:      new Set(['confirmed', 'cancelled', 'draft']), // allow recall to draft
    confirmed: new Set(['cancelled']),
    cancelled: new Set(), // terminal
  },

  PurchaseOrder: {
    draft:         new Set(['sent', 'cancelled']),
    sent:          new Set(['confirmed', 'cancelled']),
    confirmed:     new Set(['in_production', 'cancelled']),
    in_production: new Set(['ready', 'cancelled']),
    ready:         new Set(['shipped']),
    shipped:       new Set(['received']),
    received:      new Set(['completed']),
    completed:     new Set(), // terminal
    cancelled:     new Set(), // terminal
  },

  Shipment: {
    booked:     new Set(['loaded']),
    loaded:     new Set(['in_transit']),
    in_transit: new Set(['at_port']),
    at_port:    new Set(['customs']),
    customs:    new Set(['delivered']),
    delivered:  new Set(), // terminal
  },

  Invoice: {
    draft:          new Set(['sent', 'cancelled']),
    sent:           new Set(['partially_paid', 'paid', 'overdue', 'cancelled']),
    partially_paid: new Set(['paid', 'overdue', 'cancelled']),
    overdue:        new Set(['partially_paid', 'paid', 'cancelled']),
    paid:           new Set(), // terminal
    cancelled:      new Set(), // terminal
  },
};

/**
 * Returns true if the transition from → to is valid for the given model.
 * If no transition map exists for the model, all transitions are allowed (safe default).
 *
 * @param {string} modelName  e.g. 'SalesOrder'
 * @param {string} from       current status
 * @param {string} to         desired status
 * @returns {boolean}
 */
function isValidTransition(modelName, from, to) {
  const map = TRANSITIONS[modelName];
  if (!map) return true; // no rule defined — allow

  // No change is always fine
  if (from === to) return true;

  const allowed = map[from];
  if (!allowed) return false; // unknown from-state — deny
  return allowed.has(to);
}

/**
 * Builds a Sequelize beforeUpdate hook that enforces the transition map.
 * Attach to a model with: Model.addHook('beforeUpdate', statusTransitionHook('ModelName'))
 *
 * Throws a plain Error (caught by errorHandler → 422) when the transition is invalid.
 *
 * @param {string} modelName
 * @returns {Function} Sequelize hook function
 */
function statusTransitionHook(modelName) {
  return function enforceStatusTransition(instance) {
    if (!instance.changed('status')) return; // status not being changed — skip

    const from = instance.previous('status');
    const to = instance.getDataValue('status');

    if (!isValidTransition(modelName, from, to)) {
      const err = new Error(
        `Invalid status transition for ${modelName}: "${from}" → "${to}"`
      );
      err.statusCode = 422;
      err.details = { from, to, modelName };
      throw err;
    }
  };
}

module.exports = { TRANSITIONS, isValidTransition, statusTransitionHook };
