const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');
const dayjs = require('dayjs');
const db = require('../models');
const backupConfig = require('../config/backupConfig');

const BACKUPS_DIR = backupConfig.backupsDir;

// Scheduler state
let backupScheduler = null;
let cleanupScheduler = null;

// Ensure backups directory exists
const ensureBackupsDir = () => {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
};

/**
 * Create a full database backup
 * For SQLite: copies database file and compresses
 * For PostgreSQL: uses pg_dump
 */
const createBackup = async () => {
  try {
    ensureBackupsDir();

    const timestamp = dayjs().format('YYYY-MM-DD-HH-mm-ss');
    const backupFileName = `backup-${timestamp}.sql.gz`;
    const backupPath = path.join(BACKUPS_DIR, backupFileName);

    let sourceFile, success;

    if (process.env.DATABASE_TYPE === 'postgres') {
      // PostgreSQL backup using pg_dump
      const pgDumpCmd = `pg_dump ${process.env.DB_NAME} | gzip > ${backupPath}`;
      try {
        execSync(pgDumpCmd, { stdio: 'pipe' });
        success = fs.existsSync(backupPath);
      } catch (e) {
        throw new Error(`pg_dump failed: ${e.message}`);
      }
    } else {
      // SQLite backup
      sourceFile = process.env.DATABASE_URL || path.join(__dirname, '..', 'database.sqlite');

      if (!fs.existsSync(sourceFile)) {
        throw new Error(`Database file not found: ${sourceFile}`);
      }

      // Read the database file and compress it
      const dbContent = fs.readFileSync(sourceFile);
      const gzip = zlib.createGzip();
      const writeStream = fs.createWriteStream(backupPath);

      return new Promise((resolve, reject) => {
        const readable = require('stream').Readable.from([dbContent]);
const logger = require('../utils/logger.js');
        readable
          .pipe(gzip)
          .pipe(writeStream)
          .on('finish', () => {
            success = fs.existsSync(backupPath);
            if (success) {
              resolve({
                filename: backupFileName,
                path: backupPath,
                size: fs.statSync(backupPath).size,
                timestamp: new Date(timestamp),
                type: 'sqlite'
              });
            } else {
              reject(new Error('Backup file not created'));
            }
          })
          .on('error', reject);
      });
    }

    if (!success) {
      throw new Error('Backup creation failed');
    }

    const stats = fs.statSync(backupPath);
    return {
      filename: backupFileName,
      path: backupPath,
      size: stats.size,
      timestamp: new Date(),
      type: process.env.DATABASE_TYPE || 'sqlite',
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Backup creation failed: ${error.message}`);
  }
};

/**
 * List all available backups
 */
const listBackups = async () => {
  try {
    ensureBackupsDir();

    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files
      .filter(file => file.endsWith('.gz') || file.endsWith('.sql'))
      .map(file => {
        const filePath = path.join(BACKUPS_DIR, file);
        const stats = fs.statSync(filePath);
        return {
          id: file,
          filename: file,
          path: filePath,
          size: stats.size,
          sizeReadable: formatBytes(stats.size),
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    return backups;
  } catch (error) {
    throw new Error(`Failed to list backups: ${error.message}`);
  }
};

/**
 * Restore from a specific backup
 */
const restoreBackup = async (backupId) => {
  try {
    const backupPath = path.join(BACKUPS_DIR, backupId);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Verify backup integrity first
    await verifyBackup(backupId);

    if (process.env.DATABASE_TYPE === 'postgres') {
      // PostgreSQL restore
      const gunzipCmd = `gunzip -c ${backupPath} | psql ${process.env.DB_NAME}`;
      try {
        execSync(gunzipCmd, { stdio: 'pipe' });
        return {
          success: true,
          message: `Backup ${backupId} restored successfully`,
          timestamp: new Date().toISOString()
        };
      } catch (e) {
        throw new Error(`PostgreSQL restore failed: ${e.message}`);
      }
    } else {
      // SQLite restore
      const targetFile = process.env.DATABASE_URL || path.join(__dirname, '..', 'database.sqlite');

      // Create a backup of current database before restoring
      const currentBackupPath = `${targetFile}.backup-${dayjs().format('YYYY-MM-DD-HH-mm-ss')}`;
      if (fs.existsSync(targetFile)) {
        fs.copyFileSync(targetFile, currentBackupPath);
      }

      // Decompress and restore
      const gunzip = zlib.createGunzip();
      const readStream = fs.createReadStream(backupPath);
      const writeStream = fs.createWriteStream(targetFile);

      return new Promise((resolve, reject) => {
        readStream
          .pipe(gunzip)
          .pipe(writeStream)
          .on('finish', () => {
            resolve({
              success: true,
              message: `Backup ${backupId} restored successfully`,
              timestamp: new Date().toISOString(),
              backupOfCurrent: currentBackupPath
            });
          })
          .on('error', reject);
      });
    }
  } catch (error) {
    throw new Error(`Restore failed: ${error.message}`);
  }
};

/**
 * Delete a backup file
 */
const deleteBackup = async (backupId) => {
  try {
    const backupPath = path.join(BACKUPS_DIR, backupId);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    fs.unlinkSync(backupPath);

    return {
      success: true,
      message: `Backup ${backupId} deleted successfully`,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to delete backup: ${error.message}`);
  }
};

/**
 * Verify backup integrity
 * Checks if backup file is valid and meets minimum size requirements
 */
const verifyBackup = async (backupId) => {
  try {
    const backupPath = path.join(BACKUPS_DIR, backupId);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Check file size
    const stats = fs.statSync(backupPath);
    if (stats.size < backupConfig.verification.minSizeBytes) {
      return {
        valid: false,
        backupId,
        size: stats.size,
        message: `Backup file too small (${stats.size} bytes)`,
        timestamp: new Date().toISOString()
      };
    }

    // Try to read and decompress (validate gzip integrity)
    const gunzip = zlib.createGunzip();
    const readStream = fs.createReadStream(backupPath);

    return new Promise((resolve, reject) => {
      let dataReceived = false;
      let bytesRead = 0;

      readStream
        .pipe(gunzip)
        .on('data', (chunk) => {
          dataReceived = true;
          bytesRead += chunk.length;
        })
        .on('end', () => {
          resolve({
            valid: dataReceived,
            backupId,
            size: stats.size,
            uncompressedSize: bytesRead,
            message: dataReceived ? 'Backup is valid' : 'Backup appears to be corrupted',
            timestamp: new Date().toISOString()
          });
        })
        .on('error', (err) => {
          resolve({
            valid: false,
            backupId,
            size: stats.size,
            message: `Backup verification failed: ${err.message}`,
            timestamp: new Date().toISOString()
          });
        });
    });
  } catch (error) {
    throw new Error(`Failed to verify backup: ${error.message}`);
  }
};

/**
 * Get backup schedule configuration
 */
const getBackupSchedule = async () => {
  try {
    const user = await db.User.findOne({ where: { role: 'admin' } });
    if (!user) {
      return {
        enabled: false,
        frequency: 'daily',
        retentionDays: 30
      };
    }

    let preferences = {};
    try {
      preferences = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : (user.preferences || {});
    } catch (e) {
      preferences = {};
    }

    const schedule = preferences.backupSchedule || {
      enabled: false,
      frequency: 'daily',
      retentionDays: 30,
      time: '02:00'
    };

    return schedule;
  } catch (error) {
    throw new Error(`Failed to get backup schedule: ${error.message}`);
  }
};

/**
 * Set backup schedule
 */
const setBackupSchedule = async (schedule) => {
  try {
    const user = await db.User.findOne({ where: { role: 'admin' } });
    if (!user) {
      throw new Error('No admin user found');
    }

    let preferences = {};
    try {
      preferences = typeof user.preferences === 'string' ? JSON.parse(user.preferences) : (user.preferences || {});
    } catch (e) {
      preferences = {};
    }

    const updatedPreferences = {
      ...preferences,
      backupSchedule: {
        enabled: schedule.enabled !== false,
        frequency: schedule.frequency || 'daily',
        retentionDays: schedule.retentionDays || 30,
        time: schedule.time || '02:00',
        updatedAt: new Date().toISOString()
      }
    };

    await user.update({ preferences: JSON.stringify(updatedPreferences) });

    return {
      success: true,
      message: 'Backup schedule updated successfully',
      schedule: updatedPreferences.backupSchedule
    };
  } catch (error) {
    throw new Error(`Failed to set backup schedule: ${error.message}`);
  }
};

/**
 * Clean up old backups based on retention policy
 */
const cleanupOldBackups = async () => {
  try {
    const schedule = await getBackupSchedule();
    const retentionDays = schedule.retentionDays || 30;
    const cutoffDate = dayjs().subtract(retentionDays, 'day').toDate();

    const backups = await listBackups();
    const deletedBackups = [];

    for (const backup of backups) {
      if (new Date(backup.createdAt) < cutoffDate) {
        await deleteBackup(backup.filename);
        deletedBackups.push(backup.filename);
      }
    }

    return {
      success: true,
      message: `Cleanup completed. Deleted ${deletedBackups.length} old backups`,
      deletedBackups,
      retentionDays,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Cleanup failed: ${error.message}`);
  }
};

/**
 * Helper function to format bytes
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Start scheduled backups
 * Runs backups at configured interval with automatic cleanup
 * Fire-and-forget pattern: doesn't block request processing
 */
const startBackupScheduler = () => {
  if (!backupConfig.schedule.enabled) {
    logger.info('[BACKUP] Scheduled backups disabled');
    return { enabled: false, message: 'Scheduled backups disabled in config' };
  }

  if (backupScheduler) {
    logger.info('[BACKUP] Scheduler already running');
    return { enabled: true, message: 'Scheduler already running' };
  }

  try {
    // Calculate initial delay to preferred time (default: 2 AM)
    const initialDelay = backupConfig.schedule.getTimeOffset();

    logger.info(`[BACKUP] Starting scheduler (initial delay: ${Math.round(initialDelay / 1000 / 60)} minutes)`);

    // First backup at preferred time
    backupScheduler = setTimeout(() => {
      // Run backup in the background (fire-and-forget)
      runScheduledBackup();

      // Then repeat at regular interval
      backupScheduler = setInterval(runScheduledBackup, backupConfig.schedule.intervalMs);
    }, initialDelay);

    return {
      enabled: true,
      message: 'Backup scheduler started',
      nextBackupIn: Math.round(initialDelay / 1000 / 60) + ' minutes',
      config: {
        interval: backupConfig.schedule.intervalMs,
        preferredTime: backupConfig.schedule.preferredTime,
        retention: backupConfig.retentionDays + ' days'
      }
    };
  } catch (error) {
    logger.error('[BACKUP] Scheduler startup error:', error.message);
    return { enabled: false, error: error.message };
  }
};

/**
 * Stop the backup scheduler
 */
const stopBackupScheduler = () => {
  if (backupScheduler) {
    clearInterval(backupScheduler);
    clearTimeout(backupScheduler);
    backupScheduler = null;
    logger.info('[BACKUP] Scheduler stopped');
    return { success: true, message: 'Backup scheduler stopped' };
  }
  return { success: true, message: 'Scheduler was not running' };
};

/**
 * Execute a scheduled backup with automatic cleanup
 * Run in background without blocking
 */
const runScheduledBackup = async () => {
  try {
    const startTime = Date.now();
    logger.info(`[BACKUP] Scheduled backup started at ${new Date().toISOString()}`);

    // Create backup
    const backup = await createBackup();

    // Verify backup integrity
    const verification = await verifyBackup(backup.filename);
    if (!verification.valid) {
      logger.error(`[BACKUP] Verification failed for ${backup.filename}:`, verification.message);
    }

    // Check size alert threshold
    if (backup.size > backupConfig.alerts.maxSizeMB * 1024 * 1024) {
      logger.warn(
        `[BACKUP] ALERT: Backup size (${formatBytes(backup.size)}) exceeds threshold ` +
        `(${backupConfig.alerts.maxSizeMB}MB)`
      );
    }

    // Run cleanup
    if (backupConfig.cleanup.enabled) {
      const cleanup = await cleanupOldBackups();
      if (cleanup.deletedBackups && cleanup.deletedBackups.length > 0) {
        logger.info(`[BACKUP] Cleanup removed ${cleanup.deletedBackups.length} old backups`);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(
      `[BACKUP] Scheduled backup completed in ${Math.round(duration / 1000)}s ` +
      `(${formatBytes(backup.size)}, valid: ${verification.valid})`
    );
  } catch (error) {
    logger.error('[BACKUP] Scheduled backup failed:', error.message);

    // Alert on failure if configured
    if (backupConfig.alerts.alertOnFailure) {
      try {
        const alertService = require('./alertService');
        await alertService.createAlert({
          type: 'BACKUP_FAILURE',
          severity: 'high',
          title: 'Scheduled Backup Failed',
          message: `Automatic backup failed: ${error.message}`,
          relatedEntity: 'backup'
        });
      } catch (alertError) {
        logger.error('[BACKUP] Failed to send alert:', alertError.message);
      }
    }
  }
};

/**
 * Get scheduler status
 */
const getSchedulerStatus = () => {
  return {
    running: !!backupScheduler,
    config: {
      enabled: backupConfig.schedule.enabled,
      interval: backupConfig.schedule.intervalMs,
      preferredTime: backupConfig.schedule.preferredTime,
      retention: backupConfig.retentionDays + ' days'
    },
    environment: {
      databaseType: backupConfig.databaseType,
      backupsDir: BACKUPS_DIR
    }
  };
};

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  verifyBackup,
  getBackupSchedule,
  setBackupSchedule,
  cleanupOldBackups,
  ensureBackupsDir,
  startBackupScheduler,
  stopBackupScheduler,
  runScheduledBackup,
  getSchedulerStatus
};
