/**
 * Backup Configuration
 * Centralized configuration for backup scheduling and policies
 */

const path = require('path');

const config = {
  // Backup directory path
  backupsDir: path.join(__dirname, '..', 'backups'),

  // Retention policy
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 7,
  maxBackupCount: parseInt(process.env.BACKUP_MAX_COUNT) || 10,

  // Schedule configuration (cron-like format using setInterval offsets)
  schedule: {
    // Enable scheduled backups (default: false for dev, true for production)
    enabled: process.env.ENABLE_SCHEDULED_BACKUP === 'true' ||
             process.env.NODE_ENV === 'production',

    // Backup frequency in milliseconds (default: 24 hours)
    intervalMs: parseInt(process.env.BACKUP_INTERVAL_MS) || 24 * 60 * 60 * 1000,

    // Preferred time for daily backups (24-hour format)
    // Uses offset calculation to run at this time each day
    preferredTime: process.env.BACKUP_TIME || '02:00',

    // Parse preferred time (HH:MM)
    getTimeOffset() {
      try {
        const [hours, minutes] = this.preferredTime.split(':').map(Number);
        const now = new Date();
        const backupTime = new Date(now);
        backupTime.setHours(hours, minutes, 0, 0);

        // If backup time has already passed today, schedule for tomorrow
        if (backupTime <= now) {
          backupTime.setDate(backupTime.getDate() + 1);
        }

        return backupTime.getTime() - now.getTime();
      } catch (error) {
        console.error('Invalid BACKUP_TIME format (use HH:MM):', error);
        return 2 * 60 * 60 * 1000; // Default to 2 hours from now
      }
    }
  },

  // Backup size thresholds and alerts
  alerts: {
    // Alert if backup size exceeds this (in MB)
    maxSizeMB: parseInt(process.env.BACKUP_MAX_SIZE_MB) || 1000,

    // Send alert if backup fails (requires alertService configured)
    alertOnFailure: process.env.BACKUP_ALERT_ON_FAILURE !== 'false'
  },

  // Verification settings
  verification: {
    // Verify backups after creation
    enabled: true,

    // Minimum file size to consider backup valid (bytes)
    minSizeBytes: 1024 // At least 1KB
  },

  // Cleanup settings
  cleanup: {
    // Run cleanup after backup creation
    enabled: true,

    // Cleanup interval in milliseconds (default: daily)
    intervalMs: parseInt(process.env.BACKUP_CLEANUP_INTERVAL_MS) || 24 * 60 * 60 * 1000
  },

  // Database type
  databaseType: process.env.DATABASE_TYPE || 'sqlite',

  // Logging
  logLevel: process.env.BACKUP_LOG_LEVEL || 'info' // 'debug', 'info', 'warn', 'error'
};

module.exports = config;
