const express = require('express');
const router = express.Router();
const db = require('../../models');
const { requireAuth } = require('../../middleware/auth');
const { getSuccessResponse } = require('../../utils/helpers');
const crypto = require('crypto');

router.get('/filter-presets', requireAuth, async (req, res, next) => {
  try {
    const { entityType } = req.query;

    const where = { userId: req.user.id };
    if (entityType) where.entityType = entityType;

    const presets = await db.FilterPreset.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json(getSuccessResponse(presets));
  } catch (error) {
    next(error);
  }
});

/**
 * Create filter preset
 * @route POST /api/personalization/filter-presets
 * @body {String} entityType - Entity type
 * @body {String} name - Preset name
 * @body {Object} filters - Filter configuration
 * @body {Boolean} isPublic - Whether preset is public
 */
router.post('/filter-presets', requireAuth, async (req, res, next) => {
  try {
    const { entityType, name, filters, isPublic } = req.body;

    let shareToken = null;
    if (isPublic) {
      shareToken = crypto.randomBytes(32).toString('hex');
    }

    const preset = await db.FilterPreset.create({
      userId: req.user.id,
      entityType,
      name,
      filters,
      isPublic,
      shareToken
    });

    res.json(getSuccessResponse({
      message: 'Filter preset created successfully',
      data: preset
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Update filter preset
 * @route PUT /api/personalization/filter-presets/:id
 */
router.put('/filter-presets/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, filters, isPublic, isDefault } = req.body;

    const preset = await db.FilterPreset.findByPk(id);
    if (!preset) {
      return res.status(404).json({
        success: false,
        error: { message: 'Preset not found', statusCode: 404 }
      });
    }

    if (preset.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized', statusCode: 403 }
      });
    }

    let shareToken = preset.shareToken;
    if (isPublic && !shareToken) {
      shareToken = crypto.randomBytes(32).toString('hex');
    } else if (!isPublic) {
      shareToken = null;
    }

    await preset.update({
      name: name || preset.name,
      filters: filters || preset.filters,
      isPublic: isPublic !== undefined ? isPublic : preset.isPublic,
      isDefault: isDefault !== undefined ? isDefault : preset.isDefault,
      shareToken
    });

    res.json(getSuccessResponse({
      message: 'Filter preset updated successfully',
      data: preset
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Delete filter preset
 * @route DELETE /api/personalization/filter-presets/:id
 */
router.delete('/filter-presets/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const preset = await db.FilterPreset.findByPk(id);
    if (!preset) {
      return res.status(404).json({
        success: false,
        error: { message: 'Preset not found', statusCode: 404 }
      });
    }

    if (preset.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: { message: 'Unauthorized', statusCode: 403 }
      });
    }

    await preset.destroy();

    res.json(getSuccessResponse({
      message: 'Filter preset deleted successfully'
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * Get public filter preset
 * @route GET /api/personalization/filter-presets/shared/:shareToken
 */
router.get('/filter-presets/shared/:shareToken', async (req, res, next) => {
  try {
    const { shareToken } = req.params;

    const preset = await db.FilterPreset.findOne({
      where: {
        shareToken,
        isPublic: true
      },
      attributes: { exclude: ['userId'] }
    });

    if (!preset) {
      return res.status(404).json({
        success: false,
        error: { message: 'Shared preset not found', statusCode: 404 }
      });
    }

    res.json(getSuccessResponse(preset));
  } catch (error) {
    next(error);
  }
});

// ========================================================================
// DOCUMENT TEMPLATE MANAGEMENT
// ========================================================================


module.exports = router;
