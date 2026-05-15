/**
 * Tariff rate routes — Phase 4.9 C-2.
 *
 *   GET    /api/tariff-rates?origin=CN&destination=US&includeExpired=true
 *   GET    /api/tariff-rates/expiring?days=7
 *   POST   /api/tariff-rates                — super_admin only
 *   PUT    /api/tariff-rates/:id            — super_admin only
 *   DELETE /api/tariff-rates/:id            — super_admin only
 *
 * Read endpoints are any authenticated user (the quotation builder
 * needs them on every line item). Mutations are super_admin per L-036.
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const ctl = require('../controllers/tariffRateController');

router.get('/expiring', requireAuth, ctl.expiring);
router.get('/', requireAuth, ctl.list);
router.post('/', requireAuth, requireRole('super_admin'), ctl.create);
router.put('/:id', requireAuth, requireRole('super_admin'), ctl.update);
router.delete('/:id', requireAuth, requireRole('super_admin'), ctl.remove);

module.exports = router;
