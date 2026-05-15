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
const multer = require('multer');
const path = require('path');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctl = require('../controllers/tariffRateController');

// Phase 4.9 C-4: bulk import upload. 1MB cap is generous — a CSV of
// 1000 tariff rows is well under 50KB.
const importUpload = multer({
  dest: path.join(__dirname, '../uploads/tmp/'),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext === '.csv' || ext === '.txt' || ext === '') return cb(null, true);
    cb(new Error('Only CSV files are accepted'));
  },
});

router.get('/expiring', requireAuth, ctl.expiring);
router.get('/template.csv', requireAuth, ctl.template);
router.get('/', requireAuth, ctl.list);
router.post('/bulk-import', requireAuth, requireRole('super_admin'), importUpload.single('file'), ctl.bulkImport);
router.post('/', requireAuth, requireRole('super_admin'), ctl.create);
router.put('/:id', requireAuth, requireRole('super_admin'), ctl.update);
router.delete('/:id', requireAuth, requireRole('super_admin'), ctl.remove);

module.exports = router;
