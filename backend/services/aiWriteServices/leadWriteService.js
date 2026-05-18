/**
 * leadWriteService — Phase 4.12.
 *
 * Shared service layer for Lead create / update / delete. Both the REST
 * controller (leadController) and the MCP write tools (create_lead /
 * update_lead in erpToolServer) call into this so the compliance
 * checks (sanctions screening L-013, brand-scope enforcement, leadNumber
 * generation, cross-brand auto-add) run exactly once and cannot drift
 * between the two surfaces.
 *
 * Return shape:
 *   { ok: true,  lead, before?, after?, autoAddedBrand? }
 *   { ok: false, code, httpStatus, message, sanctionsBlock? }
 *
 * code values map to recognised failure modes the caller can pattern-match:
 *   'cross_brand_mode'    — caller is in cross-brand read-only mode (REST)
 *   'sanctions_block'     — synchronous sanctions screen tripped
 *   'brand_not_writable'  — caller has no write access to that brand
 *   'not_found'           — Lead id does not exist (or hidden by scope)
 *   'validation'          — payload missing a required field
 *
 * Context shape:
 *   ctx = { userId, brandScope, ip, source: 'rest' | 'mcp' }
 *
 * No req / res. No express coupling. Service writes only sanctions_block
 * AuditLog rows itself (matching the existing controller behavior); the
 * caller is responsible for any ai_assistant_* / generic audit rows so
 * the action prefix can encode the surface.
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../../models');
const sanctionsService = require('../sanctionsService');
const auditService = require('../auditService');
const { generateLeadNumber } = require('../leadNumberGenerator');
const { addBrandIfMissing } = require('../crossBrandAutoAdd');

function isCrossBrand(brandScope) {
  return !!(brandScope && brandScope.isCrossBrand);
}

function brandIsAccessible(brandScope, brandCode) {
  if (!brandScope) return true;
  if (brandScope.isCrossBrand) return true;
  return Array.isArray(brandScope.accessibleBrands)
    && brandScope.accessibleBrands.includes(brandCode);
}

async function createLead(payload, ctx) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, code: 'validation', httpStatus: 400, message: 'payload required' };
  }
  const { userId, brandScope, ip } = ctx || {};

  if (isCrossBrand(brandScope)) {
    return {
      ok: false,
      code: 'cross_brand_mode',
      httpStatus: 403,
      message: 'All Brands view is read-only. Switch to SH or FW to make changes.',
    };
  }

  const data = { ...payload };
  if (userId) data.createdById = userId;

  if (!data.brandCode && brandScope) {
    data.brandCode = brandScope.defaultBrand;
  }
  if (!data.brandCode) {
    return { ok: false, code: 'validation', httpStatus: 400, message: 'brand is required' };
  }
  if (!brandIsAccessible(brandScope, data.brandCode)) {
    return {
      ok: false,
      code: 'brand_not_writable',
      httpStatus: 403,
      message: `Your account does not have access to brand '${data.brandCode}'.`,
    };
  }

  const screen = sanctionsService.screenName(data.companyName, data.country);
  data.screeningStatus = screen.status;
  data.sanctionsScreenDetails = screen.hits;
  data.lastScreenedAt = new Date();

  if (screen.status === 'flagged') {
    // Phase 4.12: AuditLog.entityId is NOT NULL. The pre-4.12 controller
    // passed null here, which made every sanctions_block at Lead-create
    // time silently fail to audit (caught by the .catch). Generate a
    // placeholder UUID so the row lands; mark it via changes.preCreate
    // so audit consumers can tell this is a "Lead never existed" event.
    const placeholderId = uuidv4();
    auditService.logAction(
      userId || null,
      'sanctions_block',
      'Lead',
      placeholderId,
      {
        preCreate: true,
        companyName: data.companyName,
        country: data.country,
        hits: screen.hits,
        source: ctx?.source || 'unknown',
      },
      ip || null,
    ).catch(() => {});
    return {
      ok: false,
      code: 'sanctions_block',
      httpStatus: 403,
      message: `Sanctions match on "${data.companyName}". Matched on ${screen.hits.map((h) => h.list).join(', ')}. Super-admin override required.`,
      sanctionsBlock: { status: screen.status, hits: screen.hits },
    };
  }

  if (!data.leadNumber) {
    data.leadNumber = await generateLeadNumber(db);
  }

  const lead = await db.Lead.create(data);

  let autoAddedBrand = null;
  if (lead.customerId && lead.brandCode) {
    autoAddedBrand = await addBrandIfMissing(db, lead.customerId, lead.brandCode, {
      userId: userId || null,
      entity: 'Lead',
      entityId: lead.id,
      ip: ip || null,
    });
  }

  return { ok: true, lead, autoAddedBrand };
}

async function updateLead(id, patch, ctx) {
  const { brandScope, userId, userRole, userName } = ctx || {};

  if (isCrossBrand(brandScope)) {
    return {
      ok: false,
      code: 'cross_brand_mode',
      httpStatus: 403,
      message: 'All Brands view is read-only. Switch to SH or FW to make changes.',
    };
  }

  const lead = await db.Lead.findByPk(id);
  if (!lead) {
    return { ok: false, code: 'not_found', httpStatus: 404, message: 'Lead not found' };
  }

  if (!brandIsAccessible(brandScope, lead.brandCode)) {
    return { ok: false, code: 'not_found', httpStatus: 404, message: 'Lead not found' };
  }

  // 2026-05-18: Super Admin brand override. Lead.brandCode is normally
  // locked at creation, but a super_admin can flip it from the UI (e.g.
  // when a flooring lead got mis-tagged SH at import time and needs to
  // go to FW per rule #9). Every override writes a
  // super_admin_brand_override audit row, posts a Lead chatter event,
  // and cascades to active OutreachEmail drafts so the brand context
  // stays consistent. Non-super_admins get the brandCode key silently
  // stripped (original behaviour).
  const { brandCode: requestedBrand, ...allowed } = patch || {};
  let brandOverride = null;
  if (requestedBrand && requestedBrand !== lead.brandCode && userRole === 'super_admin') {
    const target = String(requestedBrand).toUpperCase();
    if (!brandIsAccessible(brandScope, target)) {
      return {
        ok: false,
        code: 'brand_not_writable',
        httpStatus: 403,
        message: `Cannot move Lead to brand '${target}': your account doesn't have access to it.`,
      };
    }
    const targetBrand = await db.Brand.findOne({ where: { code: target, active: true } });
    if (!targetBrand) {
      return {
        ok: false,
        code: 'validation',
        httpStatus: 400,
        message: `Brand '${target}' is not active.`,
      };
    }
    brandOverride = { from: lead.brandCode, to: target, displayName: targetBrand.displayName };
    allowed.brandCode = target;
  }

  const before = lead.toJSON();
  await lead.update(allowed);
  const after = lead.toJSON();

  // Super Admin brand override side-effects. Done AFTER the update so
  // the row state reflects the new brand when downstream queries fire.
  if (brandOverride) {
    let outreachRowsRelabeled = 0;
    try {
      // Cascade brandCode to ACTIVE drafts (status='draft'). Historical
      // sent rows record what actually went out and stay as they were.
      const [res] = await db.sequelize.query(
        "UPDATE OutreachEmails SET brand_code = ?, from_address = ? WHERE lead_id = ? AND status = 'draft'",
        { replacements: [brandOverride.to, (await db.Brand.findOne({ where: { code: brandOverride.to } })).senderEmail, lead.id] },
      );
      // SQLite returns rowsAffected via the second tuple element on some
      // Sequelize versions; fall back to a count query.
      const rowsChanged = (res && typeof res === 'object' && res.changes != null)
        ? res.changes
        : (typeof res === 'number' ? res : null);
      outreachRowsRelabeled = rowsChanged != null
        ? rowsChanged
        : await db.OutreachEmail.count({
            where: { leadId: lead.id, status: 'draft', brandCode: brandOverride.to },
          });
    } catch (_) { /* cascade is best-effort */ }

    try {
      await auditService.logAction(
        userId || null,
        'super_admin_brand_override',
        'Lead',
        lead.id,
        {
          from: brandOverride.from,
          to: brandOverride.to,
          reason: 'super-admin-toggle',
          outreachDraftRowsRelabeled: outreachRowsRelabeled,
          userName: userName || null,
          source: ctx?.source || 'rest',
        },
        ctx?.ip || null,
      );
    } catch (_) { /* best-effort */ }

    try {
      const { postSystemEvent } = require('../../controllers/chatterController');
      await postSystemEvent(
        'Lead',
        lead.id,
        'event',
        `Brand changed: ${brandOverride.from} → ${brandOverride.to} (${brandOverride.displayName}). ${outreachRowsRelabeled} active draft${outreachRowsRelabeled === 1 ? '' : 's'} re-labelled. Sent rows untouched.`,
        {
          kind: 'brand_override',
          from: brandOverride.from,
          to: brandOverride.to,
          outreachDraftRowsRelabeled: outreachRowsRelabeled,
        },
        userId || null,
        userName || 'Super Admin',
      );
    } catch (_) { /* best-effort */ }
  }

  // Phase 4.17: when callers (REST or MCP update_lead) write the
  // deprecated Lead.draftEmailSubject / Lead.draftEmailBody fields,
  // mirror the values into an OutreachEmail draft row so the Lead
  // detail Draft Cold Email widget surfaces them without a separate
  // save step. OutreachEmail is the canonical source going forward;
  // these inline columns will be dropped in Phase 4.17.x.
  const wroteDraftFields = (
    Object.prototype.hasOwnProperty.call(allowed, 'draftEmailSubject')
    || Object.prototype.hasOwnProperty.call(allowed, 'draftEmailBody')
  );
  if (wroteDraftFields && db.OutreachEmail) {
    try {
      const subject = (after.draftEmailSubject || '').trim();
      const body = (after.draftEmailBody || '').trim();
      if (subject || body) {
        const brand = lead.brandCode
          ? await db.Brand.findOne({ where: { code: lead.brandCode, active: true } })
          : null;
        if (brand) {
          const existing = await db.OutreachEmail.findOne({
            where: { leadId: lead.id, status: 'draft' },
            order: [['createdAt', 'DESC']],
          });
          const subjectToSave = subject || '(draft subject — add before sending)';
          const bodyToSave = body || '(draft body — add content before sending)';
          if (existing) {
            await existing.update({
              subject: subjectToSave,
              bodyText: bodyToSave,
              fromAddress: brand.senderEmail,
              toAddress: lead.email,
              toName: lead.contactName || null,
              brandCode: lead.brandCode,
            });
          } else {
            await db.OutreachEmail.create({
              leadId: lead.id,
              sentByUserId: userId || null,
              fromAddress: brand.senderEmail,
              toAddress: lead.email,
              toName: lead.contactName || null,
              subject: subjectToSave,
              bodyText: bodyToSave,
              touchNumber: 1,
              status: 'draft',
              smtpMessageId: null,
              sentAt: null,
              followUpDueAt: null,
              followUpCompleted: false,
              brandCode: lead.brandCode,
            });
          }
        }
      }
    } catch (e) {
      // Mirror is best-effort: a failure should not unwind the Lead
      // update. The audit trail on the Lead change still records the
      // inline-column write; the next manual draft save reconciles.
    }
  }

  return { ok: true, lead, before, after };
}

async function deleteLead(id, ctx) {
  const { brandScope } = ctx || {};

  if (isCrossBrand(brandScope)) {
    return {
      ok: false,
      code: 'cross_brand_mode',
      httpStatus: 403,
      message: 'All Brands view is read-only. Switch to SH or FW to make changes.',
    };
  }

  const lead = await db.Lead.findByPk(id);
  if (!lead) {
    return { ok: false, code: 'not_found', httpStatus: 404, message: 'Lead not found' };
  }

  if (!brandIsAccessible(brandScope, lead.brandCode)) {
    return { ok: false, code: 'not_found', httpStatus: 404, message: 'Lead not found' };
  }

  if (db.OutreachEmail) {
    await db.OutreachEmail.destroy({ where: { leadId: lead.id } });
  }
  const snapshot = lead.toJSON();
  await lead.destroy();
  return { ok: true, deleted: snapshot };
}

module.exports = {
  createLead,
  updateLead,
  deleteLead,
};
