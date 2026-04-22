/**
 * SQLite connection pool optimization
 * Configures SQLite for better concurrent access and performance
 */

/**
 * Optimize SQLite database for Trading ERP
 * Configures:
 * - WAL (Write-Ahead Logging) mode for better concurrency
 * - Busy timeout for handling concurrent access
 * - Cache size for performance
 * - Synchronous mode for safety
 *
 * @param {object} sequelize - Sequelize instance
 * @returns {Promise<void>}
 */
async function optimizeDatabase(sequelize) {
  try {
    console.log('[Database] Optimizing SQLite configuration...');

    // Enable WAL mode for better concurrent reads
    // This allows readers to not block writers and vice versa
    await sequelize.query('PRAGMA journal_mode = WAL');
    console.log('[Database] WAL mode enabled');

    // Set busy timeout (in milliseconds)
    // This allows concurrent access to wait a bit instead of failing immediately
    await sequelize.query('PRAGMA busy_timeout = 5000');
    console.log('[Database] Busy timeout set to 5000ms');

    // Set cache size (in pages, negative value means MB)
    // -64000 = 64MB cache
    await sequelize.query('PRAGMA cache_size = -64000');
    console.log('[Database] Cache size set to 64MB');

    // Set synchronous mode (NORMAL is good for SQLite)
    // FULL = safest but slowest
    // NORMAL = good balance of safety and speed
    // OFF = fastest but risky
    await sequelize.query('PRAGMA synchronous = NORMAL');
    console.log('[Database] Synchronous mode set to NORMAL');

    // Set temp storage to memory
    await sequelize.query('PRAGMA temp_store = MEMORY');
    console.log('[Database] Temp store set to MEMORY');

    // Enable query optimization
    await sequelize.query('PRAGMA query_only = OFF');
    console.log('[Database] Query optimization enabled');

    // Foreign key support (should be enabled)
    await sequelize.query('PRAGMA foreign_keys = ON');
    console.log('[Database] Foreign keys enabled');

    // Checkpoint the WAL periodically (restart writes less often)
    await sequelize.query('PRAGMA wal_autocheckpoint = 1000');
    console.log('[Database] WAL autocheckpoint set to 1000 pages');

    // Get and log current settings
    const settings = await sequelize.query('PRAGMA journal_mode');
    console.log('[Database] Current journal mode:', settings[0][0]);

    const cacheInfo = await sequelize.query('PRAGMA cache_size');
    console.log('[Database] Cache size:', cacheInfo[0][0]);

    console.log('[Database] SQLite optimization complete');
  } catch (error) {
    console.error('[Database] Error optimizing SQLite:', error.message);
    throw error;
  }
}

/**
 * Get database statistics (useful for monitoring)
 * @param {object} sequelize - Sequelize instance
 * @returns {Promise<object>} Database stats
 */
async function getDatabaseStats(sequelize) {
  try {
    const stats = {};

    // Get database file size
    const fs = require('fs');
    const path = require('path');
    const dbPath = sequelize.options.storage;

    if (dbPath && fs.existsSync(dbPath)) {
      const stats_file = fs.statSync(dbPath);
      stats.databaseSize = stats_file.size;
      stats.databasePath = dbPath;
    }

    // Get WAL file size if it exists
    if (dbPath) {
      const walPath = `${dbPath}-wal`;
      if (fs.existsSync(walPath)) {
        const walStats = fs.statSync(walPath);
        stats.walFileSize = walStats.size;
      }
    }

    // Get page count and size
    const pageCount = await sequelize.query('PRAGMA page_count');
    const pageSize = await sequelize.query('PRAGMA page_size');

    stats.pageCount = pageCount[0]?.[0]?.['page_count'] || 0;
    stats.pageSize = pageSize[0]?.[0]?.['page_size'] || 0;

    // Estimate total database size in MB
    if (stats.pageCount && stats.pageSize) {
      stats.estimatedDatabaseSizeMB = ((stats.pageCount * stats.pageSize) / (1024 * 1024)).toFixed(2);
    }

    // Get table info
    const tables = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    stats.tableCount = tables[0].length;

    return stats;
  } catch (error) {
    console.error('[Database] Error getting stats:', error.message);
    return {};
  }
}

/**
 * Reset database to default settings (useful for testing/cleanup)
 * @param {object} sequelize - Sequelize instance
 * @returns {Promise<void>}
 */
async function resetDatabase(sequelize) {
  try {
    console.log('[Database] Resetting to default settings...');

    await sequelize.query('PRAGMA journal_mode = DELETE');
    await sequelize.query('PRAGMA cache_size = -2000');
    await sequelize.query('PRAGMA synchronous = FULL');

    console.log('[Database] Reset complete');
  } catch (error) {
    console.error('[Database] Error resetting database:', error.message);
    throw error;
  }
}

module.exports = {
  optimizeDatabase,
  getDatabaseStats,
  resetDatabase
};
