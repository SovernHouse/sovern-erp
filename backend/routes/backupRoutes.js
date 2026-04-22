const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const backupService = require('../services/backupService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSuccessResponse } = require('../utils/helpers');

// PHASE 4: List all backups
router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const backups = await backupService.listBackups();

    res.json(getSuccessResponse({
      backups,
      count: backups.length
    }, 'Backups retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Create a new backup
router.post('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const backup = await backupService.createBackup();

    res.json(getSuccessResponse(backup, 'Backup created successfully'));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Restore from backup
router.post('/:id/restore', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await backupService.restoreBackup(id);

    res.json(getSuccessResponse(result, 'Backup restored successfully'));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Delete a backup
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await backupService.deleteBackup(id);

    res.json(getSuccessResponse(result, 'Backup deleted successfully'));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Download backup file
router.get('/:id/download', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
    const backupPath = path.join(BACKUPS_DIR, id);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // Verify the file is actually in the backups directory (security check)
    if (!backupPath.startsWith(BACKUPS_DIR)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.download(backupPath, id, (err) => {
      if (err && !res.headersSent) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Get backup schedule
router.get('/schedule/config', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const schedule = await backupService.getBackupSchedule();

    res.json(getSuccessResponse({ schedule }, 'Backup schedule retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Set backup schedule
router.put('/schedule/config', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { enabled, frequency, retentionDays, time } = req.body;

    if (!frequency || !['hourly', 'daily', 'weekly', 'monthly'].includes(frequency)) {
      return res.status(400).json({ error: 'frequency must be one of: hourly, daily, weekly, monthly' });
    }

    if (retentionDays && (retentionDays < 1 || retentionDays > 365)) {
      return res.status(400).json({ error: 'retentionDays must be between 1 and 365' });
    }

    const result = await backupService.setBackupSchedule({
      enabled,
      frequency,
      retentionDays,
      time
    });

    res.json(getSuccessResponse(result.schedule, 'Backup schedule updated successfully'));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Verify backup integrity
router.get('/:id/verify', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const verification = await backupService.verifyBackup(id);

    res.json(getSuccessResponse(verification, 'Backup verification completed'));
  } catch (error) {
    next(error);
  }
});

// PHASE 4: Cleanup old backups
router.post('/maintenance/cleanup', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = await backupService.cleanupOldBackups();

    res.json(getSuccessResponse(result, 'Backup cleanup completed'));
  } catch (error) {
    next(error);
  }
});

// Get scheduler status
router.get('/scheduler/status', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const status = backupService.getSchedulerStatus();

    res.json(getSuccessResponse(status, 'Scheduler status retrieved successfully'));
  } catch (error) {
    next(error);
  }
});

// Start backup scheduler
router.post('/scheduler/start', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = backupService.startBackupScheduler();

    res.json(getSuccessResponse(result, 'Backup scheduler started successfully'));
  } catch (error) {
    next(error);
  }
});

// Stop backup scheduler
router.post('/scheduler/stop', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const result = backupService.stopBackupScheduler();

    res.json(getSuccessResponse(result, 'Backup scheduler stopped successfully'));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
