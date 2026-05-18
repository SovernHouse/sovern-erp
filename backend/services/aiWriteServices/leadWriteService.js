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
  const { brandScope, userId } = ctx || {};

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

  // brandCode is immutable on the standard update path. Mirrors the
  // controller — silently stripped rather than 400 so the frontend
  // can submit the full form back without churn.
  const { brandCode: _ignored, ...allowed } = patch || {};

  const before = lead.toJSON();
  await lead.update(allowed);
  const after = lead.toJSON();

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
