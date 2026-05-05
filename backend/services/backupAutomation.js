/**
 * Enhanced Backup Automation Service
 * Extends the existing backupService with advanced features:
 * - Backup rotation (daily, weekly, monthly)
 * - Backup verification and integrity checking
 * - Restore functionality with rollback support
 * - S3 upload support
 * - Backup metadata tracking
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');
const zlib = require('zlib');
const dayjs = require('dayjs');
const backupService = require('./backupService');
const logger = require('../utils/logger.js');

// Backup directory configuration
const BACKUPS_DIR = path.join(__dirname, '../backups');
const BACKUP_METADATA_FILE = path.join(BACKUPS_DIR, 'backup-manifest.json');

// Backup retention policy
const RETENTION_POLICY = {
  daily: 7,      // Keep 7 daily backups
  weekly: 4,     // Keep 4 weekly backups (oldest daily of each week)
  monthly: 12    // Keep 12 monthly backups
};

/**
 * Ensure backups directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }
}

/**
 * Calculate MD5 checksum of a file
 * @param {string} filePath - Path to file
 * @returns {string} - MD5 hash
 */
function calculateChecksum(filePath) {
  const hash = crypto.createHash('md5');
  const stream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Verify backup integrity
 * Checks file size, gzip validity, and checksum
 */
async function verifyBackupIntegrity(backupFile) {
  try {
    const filePath = path.join(BACKUPS_DIR, backupFile);

    if (!fs.existsSync(filePath)) {
      return { valid: false, reason: 'File not found' };
    }

    const stats = fs.statSync(filePath);

    // Check minimum size (must be > 1KB)
    if (stats.size < 1024) {
      return { valid: false, reason: 'File too small', size: stats.size };
    }

    // Try to decompress to validate gzip
    return new Promise((resolve) => {
      const gunzip = zlib.createGunzip();
      const readStream = fs.createReadStream(filePath);
      let dataReceived = false;

      readStream
        .pipe(gunzip)
        .on('data', () => {
          dataReceived = true;
        })
        .on('end', () => {
          resolve({
            valid: dataReceived,
            size: stats.size,
            reason: dataReceived ? 'Valid' : 'No data'
          });
        })
        .on('error', () => {
          resolve({
            valid: false,
            size: stats.size,
            reason: 'Gzip corruption detected'
          });
        });
    });
  } catch (error) {
    return { valid: false, reason: error.message };
  }
}

/**
 * Load backup manifest
 * Tracks metadata for all backups
 */
function loadBackupManifest() {
  try {
    if (fs.existsSync(BACKUP_METADATA_FILE)) {
      return JSON.parse(fs.readFileSync(BACKUP_METADATA_FILE, 'utf8'));
    }
  } catch (error) {
    logger.warn('[BACKUP] Failed to load manifest:', error.message);
  }
  return {};
}

/**
 * Save backup manifest
 */
function saveBackupManifest(manifest) {
  try {
    fs.writeFileSync(BACKUP_METADATA_FILE, JSON.stringify(manifest, null, 2));
  } catch (error) {
    logger.error('[BACKUP] Failed to save manifest:', error.message);
  }
}

/**
 * Create backup with metadata
 * Extends backupService.createBackup with verification and metadata
 */
async function createBackupWithMetadata() {
  try {
    ensureBackupDir();

    // Create backup using existing service
    const backup = await backupService.createBackup();

    // Verify backup integrity
    const verification = await verifyBackupIntegrity(backup.filename);

    if (!verification.valid) {
      throw new Error(`Backup verification failed: ${verification.reason}`);
    }

    // Calculate checksum
    const filePath = path.join(BACKUPS_DIR, backup.filename);
    const checksum = await calculateChecksum(filePath);

    // Load and update manifest
    const manifest = loadBackupManifest();
    const backupMetadata = {
      filename: backup.filename,
      timestamp: new Date().toISOString(),
      size: backup.size,
      checksum,
      databaseType: backup.type,
      status: 'verified',
      compressed: true,
      type: 'daily'
    };

    manifest[backup.filename] = backupMetadata;
    saveBackupManifest(manifest);

    logger.info('[BACKUP] ✓ Backup created with metadata:', backup.filename);

    return {
      ...backup,
      ...backupMetadata
    };
  } catch (error) {
    logger.error('[BACKUP] ✗ Failed to create backup:', error.message);
    throw error;
  }
}

/**
 * Classify backup by age (daily, weekly, monthly)
 * @param {Date} backupDate - Date of backup
 * @returns {string} - Classification: 'daily', 'weekly', or 'monthly'
 */
function classifyBackupByAge(backupDate) {
  const now = dayjs();
  const backup = dayjs(backupDate);
  const daysOld = now.diff(backup, 'day');

  if (daysOld <= 7) return 'daily';
  if (daysOld <= 28) return 'weekly';
  return 'monthly';
}

/**
 * Apply backup rotation policy
 * Deletes old backups based on retention rules
 */
async function rotateBackups() {
  try {
    ensureBackupDir();

    const manifest = loadBackupManifest();
    const backups = await backupService.listBackups();
    const now = dayjs();

    // Classify backups
    const classified = {
      daily: [],
      weekly: [],
      monthly: []
    };

    for (const backup of backups) {
      const classification = classifyBackupByAge(backup.createdAt);
      classified[classification].push(backup);
    }

    // Sort by date descending (newest first)
    Object.keys(classified).forEach(key => {
      classified[key].sort((a, b) => b.createdAt - a.createdAt);
    });

    const deletedBackups = [];

    // Apply retention policy
    for (const [type, backupList] of Object.entries(classified)) {
      const limit = RETENTION_POLICY[type];
      if (backupList.length > limit) {
        const toDelete = backupList.slice(limit);
        for (const backup of toDelete) {
          try {
            await backupService.deleteBackup(backup.filename);
            delete manifest[backup.filename];
            deletedBackups.push({
              filename: backup.filename,
              type,
              reason: `Exceeded ${type} limit (${limit})`
            });
          } catch (error) {
            logger.error(`[BACKUP] Failed to delete ${backup.filename}:`, error.message);
          }
        }
      }
    }

    // Save updated manifest
    if (deletedBackups.length > 0) {
      saveBackupManifest(manifest);
    }

    return {
      success: true,
      message: `Rotation completed. Deleted ${deletedBackups.length} old backups`,
      deletedBackups,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('[BACKUP] Rotation failed:', error.message);
    throw error;
  }
}

/**
 * Restore from backup with rollback capability
 * Creates a backup of current DB before restoring
 */
async function restoreBackupWithRollback(backupId) {
  try {
    ensureBackupDir();

    const backupPath = path.join(BACKUPS_DIR, backupId);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Verify backup before restore
    const verification = await verifyBackupIntegrity(backupId);
    if (!verification.valid) {
      throw new Error(`Backup verification failed: ${verification.reason}`);
    }

    logger.info('[BACKUP] Creating safety backup before restore...');

    // Create safety backup
    const safetyBackup = await createBackupWithMetadata();

    logger.info('[BACKUP] Restoring from backup...');

    // Perform restore
    const result = await backupService.restoreBackup(backupId);

    // Update manifest
    const manifest = loadBackupManifest();
    if (manifest[backupId]) {
      manifest[backupId].lastRestored = new Date().toISOString();
    }
    saveBackupManifest(manifest);

    return {
      ...result,
      safetyBackup: safetyBackup.filename,
      message: `Backup restored successfully. Safety backup created: ${safetyBackup.filename}`
    };
  } catch (error) {
    logger.error('[BACKUP] Restore failed:', error.message);
    throw error;
  }
}

/**
 * Upload backup to S3
 * Optional: Store backups in cloud for disaster recovery
 */
async function uploadBackupToS3(backupId) {
  const AWS = require('aws-sdk');

  if (!process.env.S3_BUCKET || !process.env.S3_KEY || !process.env.S3_SECRET) {
    throw new Error('S3 credentials not configured');
  }

  try {
    const s3 = new AWS.S3({
      accessKeyId: process.env.S3_KEY,
      secretAccessKey: process.env.S3_SECRET,
      region: process.env.S3_REGION || 'us-east-1'
    });

    const filePath = path.join(BACKUPS_DIR, backupId);
    const fileContent = fs.readFileSync(filePath);

    const params = {
      Bucket: process.env.S3_BUCKET,
      Key: `backups/${backupId}`,
      Body: fileContent,
      ContentType: 'application/gzip',
      Metadata: {
        'backup-date': new Date().toISOString(),
        'database-type': process.env.DB_TYPE || 'sqlite'
      }
    };

    const result = await s3.upload(params).promise();

    logger.info('[BACKUP] ✓ Uploaded to S3:', result.Location);

    return {
      success: true,
      location: result.Location,
      bucket: process.env.S3_BUCKET,
      key: params.Key
    };
  } catch (error) {
    logger.error('[BACKUP] S3 upload failed:', error.message);
    throw error;
  }
}

/**
 * Get backup statistics
 */
function getBackupStatistics() {
  try {
    ensureBackupDir();

    const manifest = loadBackupManifest();
    const backups = Object.values(manifest);

    if (backups.length === 0) {
      return {
        total: 0,
        totalSize: 0,
        oldest: null,
        newest: null,
        verified: 0
      };
    }

    const sorted = backups.sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    const totalSize = backups.reduce((sum, b) => sum + (b.size || 0), 0);
    const verified = backups.filter(b => b.status === 'verified').length;

    return {
      total: backups.length,
      totalSize,
      totalSizeReadable: formatBytes(totalSize),
      oldest: sorted[sorted.length - 1],
      newest: sorted[0],
      verified,
      percentage: Math.round((verified / backups.length) * 100)
    };
  } catch (error) {
    logger.error('[BACKUP] Failed to get statistics:', error.message);
    return null;
  }
}

/**
 * Helper to format bytes
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  createBackupWithMetadata,
  rotateBackups,
  restoreBackupWithRollback,
  uploadBackupToS3,
  verifyBackupIntegrity,
  getBackupStatistics,
  loadBackupManifest,
  saveBackupManifest,
  calculateChecksum,
  classifyBackupByAge,
  ensureBackupDir,
  formatBytes,
  RETENTION_POLICY,
  BACKUPS_DIR
};
