/**
 * Admin routes — Phase 4.7, C-3.
 *
 *   POST  /api/admin/drive-setup      — super_admin only. Creates the
 *                                       canonical Drive folder tree (Brand
 *                                       Assets/* + Operations/*) on every
 *                                       active ConnectedGoogleAccount that
 *                                       has the Drive scope. Idempotent.
 *                                       Returns { account.email → tree map }.
 *
 * Other admin endpoints (brand-override, sanctions override, etc.) live in
 * their own domain routers — this file is reserved for cross-cutting admin
 * operations that don't naturally belong to a single domain.
 */

const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');
const db = require('../models');
const { setupDriveStructureForAllAccounts, FOLDER_TREE } = require('../services/driveStructureSetup');

// POST /api/admin/drive-setup — super_admin only (L-031 bare-string).
// Triggers the canonical Drive folder structure setup on every active
// connected account. Idempotent: re-running is safe and returns the
// existing folder IDs for already-present folders.
router.post('/admin/drive-setup',
  requireAuth,
  requireRole('super_admin'),
  async (req, res) => {
    try {
      const result = await setupDriveStructureForAllAccounts(db);

      // Audit each successful account run so Alex has a trail of when
      // the structure was provisioned.
      if (db.AuditLog) {
        for (const [email, tree] of Object.entries(result || {})) {
          if (tree && !tree.error && !tree.skipped) {
            await db.AuditLog.create({
              userId: req.user?.id || null,
              action: 'admin_drive_setup',
              entity: 'ConnectedGoogleAccount',
              entityId: email,
              changes: {
                folderCount: Object.keys(tree).length,
                createdCount: Object.values(tree).filter((n) => n.created).length,
                tree,
              },
              ipAddress: req.ip || null,
            });
          }
        }
      }

      logger.info(`[drive-setup] Completed for ${Object.keys(result).length} account(s)`);
      return res.json({
        success: true,
        data: {
          folderTree: FOLDER_TREE.map((n) => n.path),
          accounts: result,
        },
      });
    } catch (err) {
      logger.error('[drive-setup] failed:', err.message, err.stack);
      return res.status(500).json({ error: 'Drive setup failed', detail: err.message });
    }
  },
);

module.exports = router;
