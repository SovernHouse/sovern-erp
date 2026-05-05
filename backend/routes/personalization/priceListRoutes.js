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
    const { count, rows } = await db.PriceList.findAndCountAll({
      where,
      include: [
        { model: db.Customer, attributes: ['id', 'companyName'] },
        { model: db.Factory, attributes: ['id', 'companyName'] },
        { model: db.User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']],
      offset,
      limit: parseInt(limit)
    });

    res.json(getSuccessResponse({
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) }
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
    const priceList = await db.PriceList.findByPk(req.params.id);
    if (!priceList) return res.status(404).json({ success: false, error: { message: 'Price list not found', statusCode: 404 } });

    const { items, ...listData } = req.body;
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


module.exports = router;
