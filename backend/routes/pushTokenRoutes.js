const express = require('express');
const router = express.Router();
const pushTokenController = require('../controllers/pushTokenController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);

router.post('/register', asyncHandler(pushTokenController.registerToken));
router.post('/unregister', asyncHandler(pushTokenController.unregisterToken));
router.get('/me', asyncHandler(pushTokenController.listMyTokens));

module.exports = router;
