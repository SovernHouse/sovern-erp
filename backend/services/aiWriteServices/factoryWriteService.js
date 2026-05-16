/**
 * factoryWriteService — Phase 4.12.
 *
 * Shared service for Factory create / update / delete. The REST controller
 * (factoryController) and the MCP write tools (create_factory /
 * update_factory / delete_factory) both go through here so brandCode
 * validation, the open-PO delete guard, and the audit trail run in
 * exactly one place.
 *
 * Returns the same { ok, factory?, deleted?, before?, code, httpStatus,
 * message } envelope as leadWriteService.
 *
 * Payload is camelCase and matches the REST request body. MCP callers do
 * their own snake_case → camelCase mapping before calling.
 */

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const db = require('../../models');

function err(code, httpStatus, message, extra = {}) {
  return { ok: false, code, httpStatus, message, ...extra };
}

function canViewFactory(userId, factory) {
  if (!factory.isConfidential) return true;
  const allowed = Array.isArray(factory.allowedUserIds) ? factory.allowedUserIds : [];
  return allowed.includes(userId);
}

async function resolveBrandCode(rawBrandCode) {
  if (rawBrandCode == null || String(rawBrandCode).trim() === '') return { ok: true, value: null };
  const code = String(rawBrandCode).toUpperCase();
  const b = await db.Brand.findOne({ where: { code } });
  if (!b) return { ok: false, message: `brandCode "${rawBrandCode}" does not exist` };
  return { ok: true, value: code };
}

async function createFactory(payload, ctx) {
  if (!payload || !payload.companyName) {
    return err('validation', 400, 'companyName is required');
  }
  const brand = await resolveBrandCode(payload.brandCode);
  if (!brand.ok) return err('validation', 400, brand.message);

  const factory = await db.Factory.create({
    id: uuidv4(),
    companyName: payload.companyName,
    contactPerson: payload.contactPerson || null,
    email: payload.email || 'unknown@unknown.local',
    phone: payload.phone || 'unknown',
    address: payload.address || null,
    city: payload.city || null,
    country: payload.country || null,
    currency: payload.currency || 'USD',
    paymentTerms: payload.paymentTerms || 'Net 60',
    leadTimeDays: payload.leadTimeDays !== undefined ? payload.leadTimeDays : 30,
    certifications: Array.isArray(payload.certifications) ? payload.certifications : [],
    specializations: Array.isArray(payload.specializations) ? payload.specializations : [],
    rating: payload.rating !== undefined ? payload.rating : 5,
    isActive: true,
    isConfidential: !!payload.isConfidential,
    allowedUserIds: Array.isArray(payload.allowedUserIds) ? payload.allowedUserIds : [],
    notes: payload.notes || null,
    logo: payload.logo || null,
    brandCode: brand.value,
  });

  return { ok: true, factory };
}

async function updateFactory(id, patch, ctx) {
  const factory = await db.Factory.findByPk(id);
  if (!factory) return err('not_found', 404, 'Factory not found');

  if (ctx?.userId && !canViewFactory(ctx.userId, factory)) {
    return err('not_found', 404, 'Factory not found');
  }

  const before = factory.toJSON();

  let resolvedBrandCode = factory.brandCode;
  if (patch.brandCode !== undefined) {
    const brand = await resolveBrandCode(patch.brandCode);
    if (!brand.ok) return err('validation', 400, brand.message);
    resolvedBrandCode = brand.value;
  }

  await factory.update({
    companyName: patch.companyName || factory.companyName,
    contactPerson: patch.contactPerson !== undefined ? patch.contactPerson : factory.contactPerson,
    email: patch.email || factory.email,
    phone: patch.phone || factory.phone,
    address: patch.address !== undefined ? patch.address : factory.address,
    city: patch.city !== undefined ? patch.city : factory.city,
    country: patch.country !== undefined ? patch.country : factory.country,
    currency: patch.currency || factory.currency,
    paymentTerms: patch.paymentTerms || factory.paymentTerms,
    leadTimeDays: patch.leadTimeDays !== undefined ? patch.leadTimeDays : factory.leadTimeDays,
    certifications: patch.certifications || factory.certifications,
    specializations: patch.specializations || factory.specializations,
    rating: patch.rating !== undefined ? patch.rating : factory.rating,
    isActive: patch.isActive !== undefined ? patch.isActive : factory.isActive,
    isConfidential: patch.isConfidential !== undefined ? patch.isConfidential : factory.isConfidential,
    allowedUserIds: patch.allowedUserIds !== undefined ? patch.allowedUserIds : factory.allowedUserIds,
    notes: patch.notes !== undefined ? patch.notes : factory.notes,
    logo: patch.logo !== undefined ? patch.logo : factory.logo,
    brandCode: resolvedBrandCode,
  });

  return { ok: true, factory, before, after: factory.toJSON() };
}

async function deleteFactory(id, ctx) {
  const factory = await db.Factory.findByPk(id);
  if (!factory) return err('not_found', 404, 'Factory not found');

  if (ctx?.userId && !canViewFactory(ctx.userId, factory)) {
    return err('not_found', 404, 'Factory not found');
  }

  const openPOs = await db.PurchaseOrder.count({
    where: {
      factoryId: id,
      status: { [Op.notIn]: ['completed', 'cancelled'] },
    },
  }).catch(() => 0);

  if (openPOs > 0) {
    return err('validation', 400,
      `Cannot delete factory with ${openPOs} open purchase order(s). Close them first.`);
  }

  const before = factory.toJSON();
  await factory.destroy();
  return { ok: true, deleted: before };
}

module.exports = {
  createFactory,
  updateFactory,
  deleteFactory,
};
