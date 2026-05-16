/**
 * contactWriteService — Phase 4.12.
 *
 * Shared service for Contact create / update / delete. The REST controller
 * (contactController) historically had no validation beyond Sequelize; the
 * MCP handler had its own ad-hoc validation. This service consolidates the
 * rules: a contact must be linked to either a Factory (supplier-side) or a
 * Customer (buyer-side); at least one name field is required; email is
 * required.
 *
 * Returns the same { ok, contact?, deleted?, before?, code, httpStatus,
 * message } envelope.
 */

const db = require('../../models');

function err(code, httpStatus, message) {
  return { ok: false, code, httpStatus, message };
}

async function createContact(payload, ctx) {
  if (!payload) return err('validation', 400, 'payload required');
  if (!payload.firstName && !payload.lastName) {
    return err('validation', 400, 'first_name or last_name is required');
  }
  if (!payload.email) {
    return err('validation', 400, 'email is required');
  }
  if (!payload.factoryId && !payload.customerId) {
    return err('validation', 400,
      'Either factory_id (supplier-side) or customer_id (buyer-side) is required');
  }

  const contact = await db.Contact.create({
    firstName: payload.firstName || '',
    lastName: payload.lastName || '',
    email: payload.email,
    phone: payload.phone || null,
    mobile: payload.mobile || null,
    jobTitle: payload.jobTitle || null,
    department: payload.department || null,
    customerId: payload.customerId || null,
    factoryId: payload.factoryId || null,
    isPrimary: payload.isPrimary === true,
    website: payload.website || null,
    linkedinUrl: payload.linkedinUrl || null,
    notes: payload.notes || null,
    isActive: payload.isActive !== false,
  });

  return { ok: true, contact };
}

async function updateContact(id, patch, ctx) {
  const contact = await db.Contact.findByPk(id);
  if (!contact) return err('not_found', 404, 'Contact not found');

  const before = contact.toJSON();
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'mobile',
    'jobTitle', 'department', 'customerId', 'factoryId', 'isPrimary',
    'website', 'linkedinUrl', 'notes', 'isActive'];
  const updates = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) updates[key] = patch[key];
  }
  await contact.update(updates);
  return { ok: true, contact, before, after: contact.toJSON() };
}

async function deleteContact(id, ctx) {
  const contact = await db.Contact.findByPk(id);
  if (!contact) return err('not_found', 404, 'Contact not found');
  const before = contact.toJSON();
  await contact.destroy();
  return { ok: true, deleted: before };
}

module.exports = {
  createContact,
  updateContact,
  deleteContact,
};
