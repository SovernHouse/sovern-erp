const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../models');
const { getPagination, getPaginatedResponse, getSuccessResponse } = require('../utils/helpers');
const { NotFoundError, ValidationError, ForbiddenError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

/**
 * Create a new address for a customer
 * @route POST /api/address-book
 * @param {string} customerId - Customer ID
 * @param {string} label - Address label (Main Office, Warehouse, etc)
 * @param {string} addressLine1 - First line of address
 * @param {string} addressLine2 - Second line of address (optional)
 * @param {string} city - City
 * @param {string} state - State/Province (optional)
 * @param {string} postalCode - Postal code (optional)
 * @param {string} country - Country
 * @param {string} contactName - Contact person name (optional)
 * @param {string} contactPhone - Contact phone (optional)
 * @param {string} contactEmail - Contact email (optional)
 * @param {boolean} isDefault - Set as default address
 * @param {boolean} isShipping - Mark for shipping
 * @param {boolean} isBilling - Mark for billing
 */
const create = async (req, res, next) => {
  try {
    const { customerId, label, addressLine1, addressLine2, city, state, postalCode, country, contactName, contactPhone, contactEmail, isDefault, isShipping, isBilling } = req.body;

    // Validate required fields
    if (!customerId || !label || !addressLine1 || !city || !country) {
      throw new ValidationError('customerId, label, addressLine1, city, and country are required');
    }

    // Check customer exists
    const customer = await db.Customer.findByPk(customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // If isDefault is true, unset other default addresses
    if (isDefault) {
      await db.CustomerAddress.update(
        { isDefault: false },
        { where: { customerId, isDefault: true } }
      );
    }

    const address = await db.CustomerAddress.create({
      id: uuidv4(),
      customerId,
      label,
      addressLine1,
      addressLine2: addressLine2 || null,
      city,
      state: state || null,
      postalCode: postalCode || null,
      country,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      contactEmail: contactEmail || null,
      isDefault: isDefault || false,
      isShipping: isShipping || false,
      isBilling: isBilling || false,
      isActive: true
    });

    res.status(201).json(getSuccessResponse(address, 'Address created successfully'));

    // Fire-and-forget audit
    auditService.logAction(req.user.id, 'CREATE', 'CustomerAddress', address.id, { data: address.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Get all addresses for a customer
 * @route GET /api/address-book/customer/:customerId
 * @param {string} customerId - Customer ID
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 10)
 * @param {boolean} activeOnly - Filter active addresses only (default: true)
 */
const listByCustomer = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const { page = 1, limit = 10, activeOnly = true } = req.query;
    const { offset } = getPagination(page, limit);

    // Check customer exists
    const customer = await db.Customer.findByPk(customerId);
    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    const where = { customerId };
    if (activeOnly === 'true' || activeOnly === true) {
      where.isActive = true;
    }

    const { count, rows } = await db.CustomerAddress.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']]
    });

    res.json(getPaginatedResponse(rows, count, parseInt(page), parseInt(limit)));
  } catch (error) {
    next(error);
  }
};

/**
 * Get a specific address
 * @route GET /api/address-book/:id
 * @param {string} id - Address ID
 */
const getById = async (req, res, next) => {
  try {
    const address = await db.CustomerAddress.findByPk(req.params.id);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    res.json(getSuccessResponse(address, 'Address retrieved successfully'));
  } catch (error) {
    next(error);
  }
};

/**
 * Update an address
 * @route PUT /api/address-book/:id
 */
const update = async (req, res, next) => {
  try {
    const address = await db.CustomerAddress.findByPk(req.params.id);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    const beforeSnapshot = address.toJSON();

    const { label, addressLine1, addressLine2, city, state, postalCode, country, contactName, contactPhone, contactEmail, isDefault, isShipping, isBilling, isActive } = req.body;

    // If isDefault is true, unset other default addresses for this customer
    if (isDefault === true && !address.isDefault) {
      await db.CustomerAddress.update(
        { isDefault: false },
        { where: { customerId: address.customerId, isDefault: true } }
      );
    }

    await address.update({
      ...(label && { label }),
      ...(addressLine1 && { addressLine1 }),
      ...(addressLine2 !== undefined && { addressLine2 }),
      ...(city && { city }),
      ...(state !== undefined && { state }),
      ...(postalCode !== undefined && { postalCode }),
      ...(country && { country }),
      ...(contactName !== undefined && { contactName }),
      ...(contactPhone !== undefined && { contactPhone }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(isDefault !== undefined && { isDefault }),
      ...(isShipping !== undefined && { isShipping }),
      ...(isBilling !== undefined && { isBilling }),
      ...(isActive !== undefined && { isActive })
    });

    const updated = await db.CustomerAddress.findByPk(req.params.id);

    res.json(getSuccessResponse(updated, 'Address updated successfully'));

    // Fire-and-forget audit
    auditService.logAction(req.user.id, 'UPDATE', 'CustomerAddress', address.id, { before: beforeSnapshot, after: updated.toJSON() }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an address
 * @route DELETE /api/address-book/:id
 */
const delete_ = async (req, res, next) => {
  try {
    const address = await db.CustomerAddress.findByPk(req.params.id);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    const beforeSnapshot = address.toJSON();

    // Soft delete by marking inactive
    await address.update({ isActive: false });

    res.json(getSuccessResponse({ id: address.id }, 'Address deleted successfully'));

    // Fire-and-forget audit
    auditService.logAction(req.user.id, 'DELETE', 'CustomerAddress', address.id, { before: beforeSnapshot }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

/**
 * Set an address as default for a customer
 * @route PATCH /api/address-book/:id/set-default
 */
const setDefault = async (req, res, next) => {
  try {
    const address = await db.CustomerAddress.findByPk(req.params.id);

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    if (!address.isActive) {
      throw new ValidationError('Cannot set inactive address as default');
    }

    // Unset other defaults for this customer
    await db.CustomerAddress.update(
      { isDefault: false },
      { where: { customerId: address.customerId, isDefault: true } }
    );

    // Set this as default
    await address.update({ isDefault: true });

    const updated = await db.CustomerAddress.findByPk(req.params.id);

    res.json(getSuccessResponse(updated, 'Address set as default'));

    // Fire-and-forget audit
    auditService.logAction(req.user.id, 'UPDATE', 'CustomerAddress', address.id, { action: 'set_default' }, req.ip).catch(() => {});
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  listByCustomer,
  getById,
  update,
  delete: delete_,
  setDefault
};
