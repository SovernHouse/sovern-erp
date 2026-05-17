/**
 * Latent fix: statusMachine.js <-> statusTransitions.js alignment.
 *
 * Verifies the route-validator map and the model-hook map agree on
 * every SO and PO transition. Catches future drift.
 */

delete process.env.SQLITE_STORAGE;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-67890';

const { SALES_ORDER_TRANSITIONS, PURCHASE_ORDER_TRANSITIONS, validateTransition } = require('../../utils/statusMachine');
const { TRANSITIONS } = require('../../utils/statusTransitions');

describe('Latent fix: status-machine and model-hook maps must agree', () => {
  function arrToSet(arr) {
    return new Set(arr);
  }

  function setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  it('SalesOrder maps agree on every state', () => {
    const route = Object.keys(SALES_ORDER_TRANSITIONS);
    const model = Object.keys(TRANSITIONS.SalesOrder);
    expect(new Set(route)).toEqual(new Set(model));
    for (const state of route) {
      const routeAllowed = arrToSet(SALES_ORDER_TRANSITIONS[state]);
      const modelAllowed = TRANSITIONS.SalesOrder[state];
      expect(setsEqual(routeAllowed, modelAllowed)).toBe(true);
    }
  });

  it('PurchaseOrder maps agree on every state', () => {
    const route = Object.keys(PURCHASE_ORDER_TRANSITIONS);
    const model = Object.keys(TRANSITIONS.PurchaseOrder);
    expect(new Set(route)).toEqual(new Set(model));
    for (const state of route) {
      const routeAllowed = arrToSet(PURCHASE_ORDER_TRANSITIONS[state]);
      const modelAllowed = TRANSITIONS.PurchaseOrder[state];
      expect(setsEqual(routeAllowed, modelAllowed)).toBe(true);
    }
  });

  it('validateTransition still rejects unknown transitions', () => {
    expect(() => validateTransition('shipped', 'delivered', 'sales_order'))
      .toThrow(/Invalid status transition/);
  });

  it('validateTransition allows in_transit -> delivered for SO', () => {
    expect(() => validateTransition('in_transit', 'delivered', 'sales_order'))
      .not.toThrow();
  });

  it('validateTransition allows shipped -> received for PO (not delivered, which is not a PO state)', () => {
    expect(() => validateTransition('shipped', 'received', 'purchase_order'))
      .not.toThrow();
    expect(() => validateTransition('shipped', 'delivered', 'purchase_order'))
      .toThrow(/Invalid status transition/);
  });
});
