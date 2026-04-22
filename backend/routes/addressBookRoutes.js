/**
 * Customer Address Book Routes
 * @module routes/addressBookRoutes
 * @description Endpoints for managing customer addresses
 * @requires express
 * @requires ../models
 * @requires ../middleware/auth
 * @requires ../controllers/addressBookController
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const addressBookController = require('../controllers/addressBookController');

/**
 * Create a new address for a customer
 * @route POST /api/address-book
 */
router.post('/', requireAuth, addressBookController.create);

/**
 * Get all addresses for a customer
 * @route GET /api/address-book/customer/:customerId
 */
router.get('/customer/:customerId', requireAuth, addressBookController.listByCustomer);

/**
 * Get a specific address
 * @route GET /api/address-book/:id
 */
router.get('/:id', requireAuth, addressBookController.getById);

/**
 * Update an address
 * @route PUT /api/address-book/:id
 */
router.put('/:id', requireAuth, addressBookController.update);

/**
 * Delete an address (soft delete)
 * @route DELETE /api/address-book/:id
 */
router.delete('/:id', requireAuth, addressBookController.delete);

/**
 * Set address as default
 * @route PATCH /api/address-book/:id/set-default
 */
router.patch('/:id/set-default', requireAuth, addressBookController.setDefault);

module.exports = router;
