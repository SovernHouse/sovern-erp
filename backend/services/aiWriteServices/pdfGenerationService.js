/**
 * pdfGenerationService — Phase 4.15a.
 *
 * Shared service that takes any of the ERP's existing PDF generators,
 * runs it with returnBuffer:true (via the 4.15a-prep helper), uploads
 * the in-memory Buffer to the brand-appropriate Drive folder, records
 * a Document row linking back to the source entity, writes an
 * ai_assistant_generate_<category>_pdf AuditLog row, and returns the
 * Drive metadata the AI assistant surfaces to the user.
 *
 * Why a single shared service: thirteen MCP generator tools all need
 * the same Drive-upload + Document-row + audit plumbing. Per L-045,
 * duplicating that into thirteen handlers is the exact failure pattern
 * Phase 4.12 closed. One service, thirteen thin call sites.
 *
 * Drive folder layout (mirrors the on-disk upload tree the generators
 * already use):
 *   SH account → Documents/<categoryFolder>/
 *   FW account → Brand Assets/Documents/<categoryFolder>/
 *
 * The categoryFolder string matches the existing disk uploadDir/<x>/
 * sub-folder name (e.g. "quotations", "invoices", "credit_notes") so
 * a human browsing either Drive or the local upload dir sees the same
 * shape.
 *
 * Folder-ID resolution: find-or-create per path, cached for the
 * process lifetime in DRIVE_FOLDER_CACHE. Folder IDs never change once
 * created so a long-lived cache is safe.
 *
 * Return shape (consumed by every MCP generator tool):
 *   {
 *     ok: true,
 *     driveFileId, driveUrl, documentRowId, fileName, sizeKB,
 *     brandCode, mimeType, category,
 *   }
 *   { ok: false, code, httpStatus, message }
 *
 * Tests inject a fake `uploader` via opts to avoid hitting real Drive
 * in CI. Default uploader uses the same OAuth helper read_drive_file
 * uses in production.
 */

const path = require('path');
const db = require('../../models');

const SH_FOLDER_PATH_BASE = ['Documents'];
const FW_FOLDER_PATH_BASE = ['Brand Assets', 'Documents'];

// Category → folder slug + Document.category enum value. Slug matches
// the on-disk upload sub-folder so Drive and local stay aligned. Enum
// values are constrained to what the Document model accepts; anything
// not in the enum falls into 'other' with entityType + entityId
// preserving the linkage.
const CATEGORY_MAP = {
  quotation:               { folder: 'quotations',              docCategory: 'quotation' },
  invoice:                 { folder: 'invoices',                docCategory: 'invoice' },
  proforma_invoice:        { folder: 'proforma_invoices',       docCategory: 'proforma_invoice' },
  purchase_order:          { folder: 'purchase_orders',         docCategory: 'purchase_order' },
  packing_list:            { folder: 'packing_lists',           docCategory: 'packing_list' },
  certificate_of_origin:   { folder: 'certificates_of_origin',  docCategory: 'shipping' },
  credit_note:             { folder: 'credit_notes',            docCategory: 'other' },
  inspection_certificate:  { folder: 'inspection_certificates', docCategory: 'inspection' },
  product_spec_sheet:      { folder: 'spec_sheets',             docCategory: 'other' },
  sales_note:              { folder: 'sales_notes',             docCategory: 'other' },
  sales_order:             { folder: 'sales_orders',            docCategory: 'sales_order' },
  shipment_document:       { folder: 'shipment_documents',      docCategory: 'shipping' },
  statement_of_account:    { folder: 'statements',              docCategory: 'other' },
};

// In-process folder-ID cache. Folder IDs never change once created.
// Cache key is `${accountKey}::${pathSegments.join('/')}`.
const DRIVE_FOLDER_CACHE = new Map();

function err(code, httpStatus, message) {
  return { ok: false, code, httpStatus, message };
}

function categorySpec(category) {
  return CATEGORY_MAP[category] || null;
}

function basePathForBrand(brandCode) {
  return String(brandCode || '').toUpperCase() === 'FW'
    ? FW_FOLDER_PATH_BASE
    : SH_FOLDER_PATH_BASE;
}

function accountKeyForBrand(brandCode) {
  return String(brandCode || '').toUpperCase() === 'FW' ? 'fw' : 'sh';
}

function emailForAccountKey(accountKey) {
  return accountKey === 'fw' ? 'alexflorway@gmail.com' : 'alex@sovernhouse.co';
}

/**
 * Find-or-create a folder by name under a parent. Mirrors
 * driveStructureSetup's helper. Caches by full path so subsequent
 * uploads to the same target folder skip the Drive lookup.
 */
async function ensureFolderPath(drive, accountKey, pathSegments) {
  const cacheKey = `${accountKey}::${pathSegments.join('/')}`;
  if (DRIVE_FOLDER_CACHE.has(cacheKey)) return DRIVE_FOLDER_CACHE.get(cacheKey);

  let parentId = null;  // null = drive root
  for (let i = 0; i < pathSegments.length; i++) {
    const segment = pathSegments[i];
    const safe = String(segment).replace(/'/g, "\\'");
    const q =
      `mimeType = 'application/vnd.google-apps.folder' and name = '${safe}' and trashed = false` +
      (parentId ? ` and '${parentId}' in parents` : " and 'root' in parents");
    const list = await drive.files.list({ q, fields: 'files(id)', pageSize: 1 });
    let id;
    if (list.data.files && list.data.files.length > 0) {
      id = list.data.files[0].id;
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: segment,
          mimeType: 'application/vnd.google-apps.folder',
          parents: parentId ? [parentId] : [],
        },
        fields: 'id',
      });
      id = created.data.id;
    }
    parentId = id;
    DRIVE_FOLDER_CACHE.set(
      `${accountKey}::${pathSegments.slice(0, i + 1).join('/')}`,
      id,
    );
  }
  return parentId;
}

/**
 * Default Drive uploader. Tests pass a stub via opts.uploader to skip
 * Drive entirely. The shape returned must match { fileId, webViewLink }.
 */
async function defaultDriveUploader({ brandCode, category, fileName, buffer }) {
  const { google } = require('googleapis');
  const { getAuthClientForAccount } = require('../../controllers/googleAccountController');

  const accountKey = accountKeyForBrand(brandCode);
  const targetEmail = emailForAccountKey(accountKey);

  const account = await db.ConnectedGoogleAccount.findOne({
    where: { email: targetEmail, isActive: true },
  });
  if (!account) {
    throw new Error(`No connected Google account for ${targetEmail}. Connect via ERP Settings > Connected Accounts.`);
  }

  const auth = await getAuthClientForAccount(account);
  const drive = google.drive({ version: 'v3', auth });

  const spec = categorySpec(category);
  if (!spec) throw new Error(`Unknown PDF category "${category}".`);
  const pathSegments = [...basePathForBrand(brandCode), spec.folder];
  const parentId = await ensureFolderPath(drive, accountKey, pathSegments);

  const { Readable } = require('stream');
  const stream = Readable.from(buffer);

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType: 'application/pdf',
      parents: [parentId],
    },
    media: {
      mimeType: 'application/pdf',
      body: stream,
    },
    fields: 'id, webViewLink',
  });

  return { fileId: created.data.id, webViewLink: created.data.webViewLink || null };
}

/**
 * Core entry point. Wraps a generator function with the Drive-upload +
 * Document-row + audit plumbing.
 *
 * @param {object} payload
 *   @param {string} payload.category — one of CATEGORY_MAP keys
 *   @param {string} payload.entityType — Document.entityType (e.g. 'Quotation')
 *   @param {string} payload.entityId — Document.entityId UUID
 *   @param {string} payload.brandCode — 'SH' / 'FW' / etc.
 *   @param {Buffer} payload.buffer — generated PDF bytes
 *   @param {string} payload.fileName — desired Drive file name
 *   @param {string} [payload.description] — Document.description
 * @param {object} ctx
 *   @param {string} ctx.userId
 *   @param {string|null} ctx.ip
 *   @param {string} ctx.source — 'rest' | 'mcp'
 *   @param {function} [ctx.uploader] — test seam; same shape as defaultDriveUploader
 * @returns {Promise<object>} { ok, driveFileId, driveUrl, documentRowId,
 *   fileName, sizeKB, brandCode, mimeType, category } or error envelope.
 */
async function persistGeneratedPdf(payload, ctx) {
  const { category, entityType, entityId, brandCode, buffer, fileName, description } = payload;
  const spec = categorySpec(category);
  if (!spec) {
    return err('validation', 400, `Unknown PDF category "${category}". Valid: ${Object.keys(CATEGORY_MAP).join(', ')}.`);
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return err('validation', 400, 'buffer must be a non-empty Buffer.');
  }
  if (!fileName) {
    return err('validation', 400, 'fileName is required.');
  }
  const resolvedBrand = String(brandCode || 'SH').toUpperCase();

  const uploader = (ctx && ctx.uploader) || defaultDriveUploader;

  let driveResult;
  try {
    driveResult = await uploader({
      brandCode: resolvedBrand,
      category,
      fileName,
      buffer,
    });
  } catch (e) {
    return err('drive_upload_failed', 502, `Drive upload failed: ${e.message}`);
  }

  // Create Document row linking back to the source entity. The Document
  // model is paranoid-soft; isActive defaults true.
  const documentRow = await db.Document.create({
    name: fileName,
    type: 'generated',
    category: spec.docCategory,
    fileUrl: driveResult.webViewLink,
    fileName,
    fileSize: buffer.length,
    mimeType: 'application/pdf',
    entityType,
    entityId,
    brandCode: resolvedBrand,
    createdBy: ctx?.userId || null,
    description: description || `Generated via AI assistant — ${category}`,
  });

  // Audit. Mirrors the Phase 4.12 ai_assistant_<action> convention so
  // the existing audit-query patterns surface AI-driven PDF generation.
  if (db.AuditLog) {
    await db.AuditLog.create({
      userId: ctx?.userId || null,
      action: `ai_assistant_generate_${category}_pdf`,
      entity: entityType,
      entityId,
      changes: {
        documentRowId: documentRow.id,
        driveFileId: driveResult.fileId,
        driveUrl: driveResult.webViewLink,
        fileName,
        sizeKB: Math.round(buffer.length / 1024),
        category,
        brandCode: resolvedBrand,
        source: ctx?.source || 'unknown',
      },
      ipAddress: ctx?.ip || null,
    }).catch(() => {});
  }

  return {
    ok: true,
    driveFileId: driveResult.fileId,
    driveUrl: driveResult.webViewLink,
    documentRowId: documentRow.id,
    fileName,
    sizeKB: Math.round(buffer.length / 1024),
    brandCode: resolvedBrand,
    mimeType: 'application/pdf',
    category,
  };
}

// ── Phase 4.15a: per-category dispatch ────────────────────────────────
//
// Each MCP generator tool is a thin wrapper around `generateAndPersist`.
// This function knows, for each category:
//   - what model + relations to fetch
//   - which underlying PDF generator to call + with what arg shape
//   - what entityType label to record on the Document row
//   - how to compose the Drive file name
//
// Adding a new category = adding a row to CATEGORY_HANDLERS below + a
// row to CATEGORY_MAP above. No other code change needed.

const CATEGORY_HANDLERS = {
  quotation: {
    entityType: 'Quotation',
    async fetch(id) {
      const q = await db.Quotation.findByPk(id, {
        include: [
          { association: 'items', include: [{ model: db.Product, as: 'product' }] },
          { model: db.Customer, as: 'customer' },
          { model: db.User, as: 'salesPerson' },
        ],
      });
      return q;
    },
    fileName: (q) => `quotation-${q.quotationNumber}-${Date.now()}.pdf`,
    async generate(entity, opts) {
      const { dispatch } = require('../pdf/brandedQuotationRenderer');
      let brand = null;
      if (entity.brandCode) {
        brand = await db.Brand.findOne({ where: { code: entity.brandCode, active: true } });
      }
      return dispatch(entity, entity.items || [], entity.customer || {}, entity.salesPerson || {}, brand, { returnBuffer: true });
    },
  },

  invoice: {
    entityType: 'Invoice',
    async fetch(id) {
      return db.Invoice.findByPk(id, {
        include: [
          { model: db.Customer, as: 'customer' },
          { model: db.SalesOrder, as: 'salesOrder' },
        ],
      });
    },
    fileName: (e) => `inv-${e.invoiceNumber}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateInvoicePDF } = require('../pdf/financeDocumentsPDF');
      return generateInvoicePDF(entity, entity.salesOrder || {}, entity.customer || {}, { returnBuffer: true });
    },
  },

  proforma_invoice: {
    entityType: 'ProformaInvoice',
    async fetch(id) {
      return db.ProformaInvoice.findByPk(id, {
        include: [
          { association: 'items', include: [{ model: db.Product, as: 'product' }] },
          { model: db.Customer, as: 'customer' },
        ],
      });
    },
    fileName: (e) => `pi-${e.piNumber}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateProformaInvoicePDF } = require('../pdf/salesDocumentsPDF');
      return generateProformaInvoicePDF(entity, entity.items || [], entity.customer || {}, { returnBuffer: true });
    },
  },

  purchase_order: {
    entityType: 'PurchaseOrder',
    async fetch(id) {
      return db.PurchaseOrder.findByPk(id, {
        include: [
          { association: 'items', include: [{ model: db.Product, as: 'product' }] },
          { model: db.Factory, as: 'factory' },
        ],
      });
    },
    fileName: (e) => `po-${e.poNumber}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generatePurchaseOrderPDF } = require('../pdf/orderDocumentsPDF');
      return generatePurchaseOrderPDF(entity, entity.items || [], entity.factory || {}, { returnBuffer: true });
    },
  },

  packing_list: {
    entityType: 'PackingList',
    async fetch(id) {
      return db.PackingList.findByPk(id, {
        include: [{ association: 'items', include: [{ model: db.Product, as: 'product' }] }],
      });
    },
    fileName: (e) => `pl-${e.packingListNumber}-${Date.now()}.pdf`,
    async generate(entity, opts) {
      if (opts && opts.advanced) {
        const { generatePackingListPDF } = require('../pdfTemplates');
        return generatePackingListPDF(entity.id);
      }
      const { generatePackingListPDF } = require('../pdf/orderDocumentsPDF');
      return generatePackingListPDF(entity, entity.items || [], { returnBuffer: true });
    },
  },

  certificate_of_origin: {
    entityType: 'CertificateOfOrigin',
    async fetch(id) {
      // CertificateOfOrigin lives in pdfTemplates which fetches internally.
      // We still need an id-level entity for the Document row linkage.
      return { id, certNumber: id };
    },
    fileName: (e) => `co-${e.certNumber}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateCertificateOfOriginPDF } = require('../pdfTemplates');
      return generateCertificateOfOriginPDF(entity.id);
    },
  },

  credit_note: {
    entityType: 'CreditNote',
    async fetch(id) {
      return db.Invoice.findByPk(id, {
        include: [{ model: db.Customer, as: 'customer' }],
      });
    },
    fileName: (e) => `cn-${e.invoiceNumber || e.id}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateCreditNotePDF } = require('../pdf/financeDocumentsPDF');
      return generateCreditNotePDF(entity, entity.customer || {}, { returnBuffer: true });
    },
  },

  inspection_certificate: {
    entityType: 'Inspection',
    async fetch(id) {
      return db.Inspection.findByPk(id, {
        include: [
          { model: db.InspectionReport, as: 'report' },
          { model: db.Factory, as: 'factory' },
        ],
      });
    },
    fileName: (e) => `cert-${e.inspectionNumber}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateInspectionCertificatePDF } = require('../pdf/logisticsDocumentsPDF');
      return generateInspectionCertificatePDF(entity, entity.report || null, entity.factory || {}, { returnBuffer: true });
    },
  },

  product_spec_sheet: {
    entityType: 'Product',
    async fetch(id) {
      return db.Product.findByPk(id, {
        include: [
          { model: db.ProductCategory, as: 'category' },
          { model: db.Factory, as: 'factory' },
          { model: db.ProductPrice, as: 'prices', limit: 1, order: [['validFrom', 'DESC']] },
        ],
      });
    },
    fileName: (e) => `spec-sheet-${e.sku}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateProductSpecSheetPDF } = require('../pdf/logisticsDocumentsPDF');
      const price = Array.isArray(entity.prices) && entity.prices[0] ? entity.prices[0] : null;
      return generateProductSpecSheetPDF(entity, entity.category || null, entity.factory || null, price, { returnBuffer: true });
    },
  },

  sales_note: {
    entityType: 'ProformaInvoice',
    async fetch(id) {
      return db.ProformaInvoice.findByPk(id, {
        include: [
          { association: 'items', include: [{ model: db.Product, as: 'product' }] },
          { model: db.Customer, as: 'customer' },
        ],
      });
    },
    fileName: (e) => `sales-note-${e.piNumber}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateSalesNotePDF } = require('../pdf/salesDocumentsPDF');
      return generateSalesNotePDF(entity, entity.items || [], entity.customer || {}, {}, { returnBuffer: true });
    },
  },

  sales_order: {
    entityType: 'SalesOrder',
    async fetch(id) {
      return db.SalesOrder.findByPk(id, {
        include: [
          { association: 'items', include: [{ model: db.Product, as: 'product' }] },
          { model: db.Customer, as: 'customer' },
          { model: db.Factory, as: 'factory' },
        ],
      });
    },
    fileName: (e) => `so-${e.orderNumber}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateSalesOrderPDF } = require('../pdf/orderDocumentsPDF');
      return generateSalesOrderPDF(entity, entity.items || [], entity.customer || {}, entity.factory || {}, { returnBuffer: true });
    },
  },

  shipment_document: {
    entityType: 'Shipment',
    async fetch(id) {
      return db.Shipment.findByPk(id, {
        include: [
          { model: db.SalesOrder, as: 'salesOrder' },
          { model: db.Customer, as: 'customer' },
        ],
      });
    },
    fileName: (e) => `shp-${e.shipmentNumber}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateShipmentDocumentPDF } = require('../pdf/logisticsDocumentsPDF');
      return generateShipmentDocumentPDF(entity, entity.salesOrder || {}, entity.customer || {}, { returnBuffer: true });
    },
  },

  statement_of_account: {
    entityType: 'Customer',
    async fetch(id) {
      const customer = await db.Customer.findByPk(id);
      if (!customer) return null;
      const invoices = await db.Invoice.findAll({ where: { customerId: id }, order: [['createdAt', 'DESC']] });
      const payments = await db.Payment.findAll({ where: { customerId: id } }).catch(() => []);
      // Stitch invoices + payments onto the customer-like object the
      // generator expects.
      customer._invoices = invoices;
      customer._payments = payments;
      return customer;
    },
    fileName: (e) => `stmt-${e.id}-${Date.now()}.pdf`,
    async generate(entity) {
      const { generateStatementOfAccountPDF } = require('../pdf/financeDocumentsPDF');
      return generateStatementOfAccountPDF(entity, entity._invoices || [], entity._payments || [], { returnBuffer: true });
    },
  },
};

function categoryHandler(category) {
  return CATEGORY_HANDLERS[category] || null;
}

/**
 * Top-level entry the MCP tools call. Resolves the right fetcher +
 * generator, runs them, persists via persistGeneratedPdf. Keeps each
 * MCP tool handler to ~10 lines.
 *
 * @param {object} payload
 *   @param {string} payload.category — one of CATEGORY_MAP keys
 *   @param {string} payload.entityId — UUID of the source entity
 *   @param {object} [payload.generatorOpts] — extra opts forwarded to
 *     the underlying generator (e.g. {advanced: true} for packing_list)
 * @param {object} ctx — { userId, brandScope, ip, source, uploader? }
 */
async function generateAndPersist(payload, ctx) {
  const { category, entityId, generatorOpts } = payload;
  const handler = categoryHandler(category);
  if (!handler) {
    return err('validation', 400, `Unknown PDF category "${category}". Valid: ${Object.keys(CATEGORY_HANDLERS).join(', ')}.`);
  }
  if (!entityId) {
    return err('validation', 400, 'entityId is required.');
  }

  const entity = await handler.fetch(entityId);
  if (!entity) {
    return err('not_found', 404, `${handler.entityType} ${entityId} not found.`);
  }

  // brandCode is taken from the entity when present; falls back to SH.
  // CertificateOfOrigin + product_spec_sheet + statement_of_account
  // entities may not carry brandCode directly; use the requester's
  // defaultBrand from ctx as the fallback.
  const brandCode = entity.brandCode
    || (ctx?.brandScope?.defaultBrand)
    || 'SH';

  let buffer;
  try {
    buffer = await handler.generate(entity, generatorOpts || {});
  } catch (e) {
    return err('generator_failed', 500, `${category} PDF generator threw: ${e.message}`);
  }

  if (!Buffer.isBuffer(buffer)) {
    return err('generator_returned_non_buffer', 500,
      `${category} generator returned ${typeof buffer} instead of a Buffer. Generator may need the returnBuffer:true patch.`);
  }

  const fileName = handler.fileName(entity);

  return persistGeneratedPdf({
    category,
    entityType: handler.entityType,
    entityId,
    brandCode,
    buffer,
    fileName,
  }, ctx);
}

module.exports = {
  persistGeneratedPdf,
  generateAndPersist,
  categoryHandler,
  CATEGORY_MAP,
  CATEGORY_HANDLERS,
  categorySpec,
  basePathForBrand,
  accountKeyForBrand,
  // Exposed for tests that want to verify cache behavior or seed a fake.
  DRIVE_FOLDER_CACHE,
  defaultDriveUploader,
};
