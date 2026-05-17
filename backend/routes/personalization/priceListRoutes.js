const express = require('express');
const router = express.Router();
const db = require('../../models');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { getSuccessResponse } = require('../../utils/helpers');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const templateService = require('../../services/templateProcessingService');


const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'templates');
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.html'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

/**
 * Get all document types and their field definitions
 * @route GET /api/personalization/templates/document-types
 */

router.get('/price-lists', requireAuth, async (req, res, next) => {
  try {
    const { customerId, factoryId, isActive, page = 1, limit = 50 } = req.query;
    const where = {};
    if (customerId) where.customerId = customerId;
    if (factoryId) where.factoryId = factoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const offset = (page - 1) * limit;
    const rows = await db.PriceList.findAll({
      where,
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.Factory, attributes: ['id', 'companyName'] },
        { model: db.User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] },
        // Phase 4.28d follow-up: include lightweight item rows so the
        // list page can render Items count. itemCount derived below;
        // separately exposed so the JSON shape stays stable for older
        // consumers that read priceList.items.length.
        { model: db.PriceListItem, as: 'items', attributes: ['id'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit),
    });
    const total = await db.PriceList.count({ where });

    // Add a top-level itemCount + flat customerName / factoryName so the
    // Price List Manager table can show the readable company name
    // instead of the UUID. Odoo many2one display convention: every list
    // view of a relation shows the linked record's display_name, never
    // the FK (Alex feedback 2026-05-17).
    const shaped = rows.map((r) => {
      const json = r.toJSON();
      json.itemCount    = Array.isArray(json.items) ? json.items.length : 0;
      json.customerName = (json.Customer && json.Customer.companyName) || null;
      json.factoryName  = (json.Factory  && json.Factory.companyName)  || null;
      return json;
    });

    res.json(getSuccessResponse({
      data: shaped,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get a price list with items
 * @route GET /api/personalization/price-lists/:id
 */
router.get('/price-lists/:id', requireAuth, async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id, {
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.Factory, attributes: ['id', 'companyName'] },
        { model: db.PriceListItem, as: 'items', include: [{ model: db.Product, attributes: ['id', 'name', 'sku'] }] },
        { model: db.User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
      ]
    });
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });
    res.json(getSuccessResponse(priceList));
  } catch (error) {
    next(error);
  }
});

/**
 * Create a price list
 * @route POST /api/personalization/price-lists
 */
router.post('/price-lists', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { items, ...listData } = req.body;
    const priceList = await db.PriceList.create({ ...listData, createdBy: req.user.id });

    if (items && items.length > 0) {
      const itemsWithListId = items.map(item => ({ ...item, priceListId: priceList.id }));
      await db.PriceListItem.bulkCreate(itemsWithListId);
    }

    const result = await db.PriceList.findByPk(priceList.id, {
      include: [{ model: db.PriceListItem, as: 'items' }]
    });

    res.status(201).json(getSuccessResponse({ message: 'Price list created', data: result }));
  } catch (error) {
    next(error);
  }
});

/**
 * Update a price list
 * @route PUT /api/personalization/price-lists/:id
 */
router.put('/price-lists/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id, {
      include: [{ model: db.PriceListItem, as: 'items' }],
    });
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });

    const { items, ...listData } = req.body;
    // Phase 4.28d: validate brandCode if the caller is changing it. Active
    // brand required. Resilient enforcement happens in the renderer guard,
    // not here, so the operator can stage a brand change before fixing
    // items.
    if (listData.brandCode) {
      listData.brandCode = String(listData.brandCode).toUpperCase();
      const brand = await db.Brand.findOne({ where: { code: listData.brandCode, active: true } });
      if (!brand) {
        return res.status(400).json({ success: false, error: { message: `Brand "${listData.brandCode}" not active.`, statusCode: 400 } });
      }
    }

    // Phase 4.28d second follow-up: capture a "before" snapshot of the
    // top-level fields and item count so we can log a human-readable
    // diff to chatter after the update. Without this the user sees no
    // record of who edited what (Alex feedback 2026-05-17).
    const TRACKED_FIELDS = [
      'name', 'description', 'currencyCode', 'brandCode',
      'validFrom', 'validTo', 'customerId', 'factoryId',
      'isActive', 'footerNotes',
    ];
    const beforeSnapshot = {};
    for (const f of TRACKED_FIELDS) beforeSnapshot[f] = priceList[f];
    const beforeItemCount = Array.isArray(priceList.items) ? priceList.items.length : 0;
    const beforeHidden = Array.isArray(priceList.hiddenColumns) ? priceList.hiddenColumns
                     : (typeof priceList.hiddenColumns === 'string' ? (() => { try { return JSON.parse(priceList.hiddenColumns) || []; } catch (_) { return []; } })() : []);
    const beforeLabels = (priceList.columnLabels && typeof priceList.columnLabels === 'object' && !Array.isArray(priceList.columnLabels)) ? priceList.columnLabels
                     : (typeof priceList.columnLabels === 'string' ? (() => { try { return JSON.parse(priceList.columnLabels) || {}; } catch (_) { return {}; } })() : {});
    const beforeCustomDefs = Array.isArray(priceList.columnDefinitions) ? priceList.columnDefinitions
                     : (typeof priceList.columnDefinitions === 'string' ? (() => { try { return JSON.parse(priceList.columnDefinitions) || []; } catch (_) { return []; } })() : []);

    await priceList.update(listData);

    if (items) {
      await db.PriceListItem.destroy({ where: { priceListId: priceList.id } });
      if (items.length > 0) {
        const itemsWithListId = items.map(item => ({ ...item, priceListId: priceList.id }));
        await db.PriceListItem.bulkCreate(itemsWithListId);
      }
    }

    const result = await db.PriceList.findByPk(priceList.id, {
      include: [{ model: db.PriceListItem, as: 'items' }]
    });

    // Compose a human-readable diff for chatter. Skip fields that didn't
    // change. Hide-column / label / custom-column / item-count changes
    // get their own summary lines so the audit trail is readable in the
    // detail page's Chatter tab.
    try {
      const { postSystemEvent } = require('../../controllers/chatterController');
      const lines = [];
      for (const f of TRACKED_FIELDS) {
        const oldV = beforeSnapshot[f];
        const newV = result[f];
        const norm = (v) => v == null ? '' : (v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
        if (norm(oldV) !== norm(newV)) {
          const oldFmt = oldV == null || oldV === '' ? '∅' : `"${norm(oldV).slice(0, 80)}"`;
          const newFmt = newV == null || newV === '' ? '∅' : `"${norm(newV).slice(0, 80)}"`;
          lines.push(`• ${f}: ${oldFmt} → ${newFmt}`);
        }
      }
      // Hidden columns diff.
      const afterHidden = Array.isArray(listData.hiddenColumns) ? listData.hiddenColumns : beforeHidden;
      const hiddenAdded   = afterHidden.filter(k => !beforeHidden.includes(k));
      const hiddenRemoved = beforeHidden.filter(k => !afterHidden.includes(k));
      if (hiddenAdded.length)   lines.push(`• hid columns: ${hiddenAdded.join(', ')}`);
      if (hiddenRemoved.length) lines.push(`• showed columns: ${hiddenRemoved.join(', ')}`);
      // Column label overrides diff.
      const afterLabels = (listData.columnLabels && typeof listData.columnLabels === 'object' && !Array.isArray(listData.columnLabels)) ? listData.columnLabels : beforeLabels;
      const labelKeys = new Set([...Object.keys(beforeLabels), ...Object.keys(afterLabels)]);
      const labelChanges = [];
      for (const k of labelKeys) {
        if ((beforeLabels[k] || '') !== (afterLabels[k] || '')) {
          labelChanges.push(`${k} "${beforeLabels[k] || ''}" → "${afterLabels[k] || ''}"`);
        }
      }
      if (labelChanges.length) lines.push(`• renamed columns: ${labelChanges.join('; ')}`);
      // Custom column defs diff (count + keys).
      const afterCustomDefs = Array.isArray(listData.columnDefinitions) ? listData.columnDefinitions : beforeCustomDefs;
      const beforeKeys = beforeCustomDefs.map(c => c && c.key).filter(Boolean);
      const afterKeys  = afterCustomDefs.map(c => c && c.key).filter(Boolean);
      const customAdded   = afterKeys.filter(k => !beforeKeys.includes(k));
      const customRemoved = beforeKeys.filter(k => !afterKeys.includes(k));
      if (customAdded.length)   lines.push(`• added custom columns: ${customAdded.join(', ')}`);
      if (customRemoved.length) lines.push(`• removed custom columns: ${customRemoved.join(', ')}`);
      // Items count diff.
      const afterItemCount = Array.isArray(result.items) ? result.items.length : 0;
      if (Array.isArray(items) && afterItemCount !== beforeItemCount) {
        lines.push(`• items: ${beforeItemCount} → ${afterItemCount}`);
      } else if (Array.isArray(items)) {
        lines.push(`• items: ${afterItemCount} replaced`);
      }

      if (lines.length > 0) {
        const userName = req.user
          ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'User'
          : 'System';
        const body = `${userName} updated this price list:\n${lines.join('\n')}`;
        await postSystemEvent('PriceList', priceList.id, 'edit', body, { changes: lines.length }, req.user?.id || null, userName);
      }
    } catch (chatterErr) {
      // postSystemEvent already swallows; this catch guards the diff
      // builder itself. Never break the response on audit-log failure.
      const logger = require('../../utils/logger');
      logger.warn('[priceList.put] chatter audit skipped:', chatterErr.message);
    }

    res.json(getSuccessResponse({ message: 'Price list updated', data: result }));
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a price list
 * @route DELETE /api/personalization/price-lists/:id
 */
router.delete('/price-lists/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id);
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });
    await db.PriceListItem.destroy({ where: { priceListId: priceList.id } });
    await priceList.destroy();
    res.json(getSuccessResponse({ message: 'Price list deleted' }));
  } catch (error) {
    next(error);
  }
});

/**
 * Export a price list to Excel
 * @route GET /api/personalization/price-lists/:id/export
 */
router.get('/price-lists/:id/export', requireAuth, async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id, {
      include: [{ model: db.PriceListItem, as: 'items' }]
    });
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });

    const columns = [
      { key: 'sku', label: 'SKU', width: 15 },
      { key: 'productName', label: 'Product Name', width: 30 },
      { key: 'sellingPrice', label: 'Selling Price', width: 15 },
      { key: 'costPrice', label: 'Cost Price', width: 15 },
      { key: 'minimumOrder', label: 'Min Order', width: 12 },
      { key: 'leadTimeDays', label: 'Lead Time (days)', width: 15 },
      { key: 'unit', label: 'Unit', width: 10 },
      { key: 'notes', label: 'Notes', width: 25 }
    ];

    const rows = priceList.items.map(item => item.toJSON());
    const workbook = await templateService.generateExcel(rows, columns, priceList.name);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${priceList.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
});

/**
 * Import items into a price list from Excel/CSV
 * @route POST /api/personalization/price-lists/:id/import
 */
router.post('/price-lists/:id/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id);
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });
    if (!req.file) return res.status(400).json({ success: false, error: { message: 'No file uploaded', statusCode: 400 } });

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const parsed = await templateService.parseImportFile(req.file.path, ext);

    // Map parsed rows to price list items
    const columnMapping = req.body.columnMapping ? JSON.parse(req.body.columnMapping) : {};
    const items = parsed.rows.map(row => {
      const item = { priceListId: priceList.id };
      // Auto-map common column names
      for (const [header, value] of Object.entries(row)) {
        const lower = header.toLowerCase().replace(/[^a-z]/g, '');
        const mapped = columnMapping[header];
        if (mapped) { item[mapped] = value; }
        else if (lower.includes('sku')) { item.sku = value; }
        else if (lower.includes('product') && lower.includes('name')) { item.productName = value; }
        else if (lower.includes('selling') || lower === 'price') { item.sellingPrice = parseFloat(value) || 0; }
        else if (lower.includes('cost')) { item.costPrice = parseFloat(value) || 0; }
        else if (lower.includes('min')) { item.minimumOrder = parseFloat(value) || 0; }
        else if (lower.includes('lead')) { item.leadTimeDays = parseInt(value) || 0; }
        else if (lower.includes('unit')) { item.unit = value; }
        else if (lower.includes('note')) { item.notes = value; }
      }
      return item;
    });

    // Replace or append
    const mode = req.body.mode || 'append';
    if (mode === 'replace') {
      await db.PriceListItem.destroy({ where: { priceListId: priceList.id } });
    }

    await db.PriceListItem.bulkCreate(items);

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    res.json(getSuccessResponse({
      message: `Imported ${items.length} items (${mode} mode)`,
      data: { importedCount: items.length, headers: parsed.headers }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Import products from Excel/CSV
 * @route POST /api/personalization/products/import
 */
router.post('/products/import', requireAuth, requireRole('admin'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { message: 'No file uploaded', statusCode: 400 } });

    const ext = path.extname(req.file.originalname).toLowerCase().replace('.', '');
    const parsed = await templateService.parseImportFile(req.file.path, ext);

    // Clean up
    await fs.unlink(req.file.path).catch(() => {});

    // Return parsed data for user to review and map columns before confirming
    res.json(getSuccessResponse({
      message: 'File parsed successfully. Review the data and confirm import.',
      data: {
        headers: parsed.headers,
        sampleRows: parsed.rows.slice(0, 5),
        totalRows: parsed.rowCount
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Confirm product import with column mapping
 * @route POST /api/personalization/products/import/confirm
 */
router.post('/products/import/confirm', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { rows, columnMapping, categoryId } = req.body;
    if (!rows || !Array.isArray(rows)) return res.status(400).json({ success: false, error: { message: 'rows is required', statusCode: 400 } });

    let created = 0, updated = 0, errors = [];

    for (const row of rows) {
      try {
        const productData = {};
        for (const [sourceCol, targetField] of Object.entries(columnMapping || {})) {
          productData[targetField] = row[sourceCol];
        }
        if (categoryId) productData.categoryId = categoryId;

        // Try to find by SKU for upsert
        if (productData.sku) {
          const existing = await db.Product.findOne({ where: { sku: productData.sku } });
          if (existing) {
            await existing.update(productData);
            updated++;
          } else {
            await db.Product.create(productData);
            created++;
          }
        } else {
          await db.Product.create(productData);
          created++;
        }
      } catch (rowError) {
        errors.push({ row, error: rowError.message });
      }
    }

    res.json(getSuccessResponse({
      message: `Import complete: ${created} created, ${updated} updated, ${errors.length} errors`,
      data: { created, updated, errors: errors.slice(0, 10) }
    }));
  } catch (error) {
    next(error);
  }
});


// ── Phase 4.28b — PDF / email / approval-request endpoints ────────────────

/**
 * Generate a PDF rendition of a PriceList (with its items).
 * @route GET /api/personalization/price-lists/:id/pdf
 */
router.get('/price-lists/:id/pdf', requireAuth, async (req, res, next) => {
  try {
    const { priceListIncludeForBrand, BrandLeakError } =
      require('../../services/priceListBrandResolver');
    const priceList = await db.PriceList.findByPk(req.params.id, {
      include: priceListIncludeForBrand(db),
      order: [[{ model: db.PriceListItem, as: 'items' }, 'sku', 'ASC']],
    });
    if (!priceList) {
      return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });
    }
    const { renderPriceListPdf } = require('../../services/pdf/priceListRenderer');
    let buffer;
    try {
      buffer = await renderPriceListPdf(priceList);
    } catch (renderErr) {
      if (renderErr instanceof BrandLeakError) {
        return res.status(422).json({
          success: false,
          error: { message: renderErr.message, code: renderErr.code, info: renderErr.info, statusCode: 422 },
        });
      }
      throw renderErr;
    }
    const slug = String(priceList.name || 'price-list').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${slug}-${priceList.id.slice(0, 8)}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  } catch (error) {
    next(error);
  }
});

/**
 * Send a PriceList as a PDF attachment via email. Recipients can be
 * arbitrary addresses or resolved from a leadId / customerId.
 * @route POST /api/personalization/price-lists/:id/send-email
 * @body  { to: string[] | string, subject?, message?, leadId?, customerId? }
 */
router.post('/price-lists/:id/send-email', requireAuth, async (req, res, next) => {
  try {
    const { sendPriceListEmail } = require('../../services/priceListEmailService');
    const result = await sendPriceListEmail(req.params.id, {
      to:         req.body.to,
      leadId:     req.body.leadId,
      customerId: req.body.customerId,
      subject:    req.body.subject,
      message:    req.body.message,
      ctx: { userId: req.user?.id || null, ip: req.ip || null, source: 'rest' },
    });
    if (!result.ok) {
      const httpStatus = result.code === 'not_found' ? 404 :
                         result.code === 'no_recipients' ? 400 :
                         result.code === 'brand_leak' ? 422 :
                         result.code === 'send_failed' ? 502 : 500;
      return res.status(httpStatus).json({ success: false, error: { message: result.message, code: result.code, statusCode: httpStatus } });
    }
    res.json(getSuccessResponse({
      sent:       !result.disabled,
      disabled:   !!result.disabled,
      recipients: result.recipients,
      subject:    result.subject,
      messageId:  result.messageId,
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Request approval on a PriceList: creates a ScheduledActivity of
 * type='approve' assigned to the chosen user. The Phase 4.17 Product
 * approval flow established the pattern.
 * @route POST /api/personalization/price-lists/:id/request-approval
 * @body  { assigneeId: string, dueDate?, note? }
 */
router.post('/price-lists/:id/request-approval', requireAuth, async (req, res, next) => {
  try {
    const priceList = await db.PriceList.findByPk(req.params.id, {
      attributes: ['id', 'name'],
    });
    if (!priceList) {
      return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });
    }
    const assigneeId = req.body.assigneeId;
    if (!assigneeId) {
      return res.status(400).json({ success: false, error: { message: 'assigneeId is required', statusCode: 400 } });
    }
    const assignee = await db.User.findByPk(assigneeId, { attributes: ['id', 'firstName', 'lastName', 'email'] });
    if (!assignee) {
      return res.status(404).json({ success: false, error: { message: 'Assignee user not found', statusCode: 404 } });
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueDate = req.body.dueDate || tomorrow.toISOString().slice(0, 10);

    const activity = await db.ScheduledActivity.create({
      type:         'approve',
      entityType:   'PriceList',
      entityId:     priceList.id,
      entityLabel:  `Approve price list: ${priceList.name}`,
      assignedToId: assignee.id,
      assignedById: req.user?.id || null,
      dueDate,
      priority:     'normal',
      note:         req.body.note || `${(req.user && (req.user.firstName + ' ' + req.user.lastName)) || 'Someone'} requested your approval on price list "${priceList.name}".`,
      status:       'pending',
    });

    const auditService = require('../../services/auditService');
    auditService.logAction(
      req.user?.id || null,
      'request_price_list_approval',
      'PriceList',
      priceList.id,
      { assigneeId, dueDate, activityId: activity.id },
      req.ip || null,
    ).catch(() => {});

    res.json(getSuccessResponse({
      activityId:   activity.id,
      priceListId:  priceList.id,
      assignedToId: assignee.id,
      dueDate,
      status:       'pending',
    }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
