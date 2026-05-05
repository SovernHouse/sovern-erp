// Barrel: mounts all personalization sub-routers for backward compatibility.
// Split introduced by #48 — all existing importers (app.js etc.) are unchanged.
const express = require('express');
const router = express.Router();

router.use('/', require('./personalization/notificationRoutes'));
router.use('/', require('./personalization/commissionRoutes'));
router.use('/', require('./personalization/filterPresetRoutes'));
router.use('/', require('./personalization/templateRoutes'));
router.use('/', require('./personalization/productAttributeRoutes'));
router.use('/', require('./personalization/priceListRoutes'));

module.exports = router;
