#!/usr/bin/env node
/**
 * Database Migration Runner
 * Supports SQLite to PostgreSQL migrations
 *
 * Usage:
 *   node migrate.js --up    # Run pending migrations
 *   node migrate.js --down  # Rollback last migration
 *   node migrate.js --list  # List migration status
 */

const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = require('../config/database');

let sequelize;
if (config.dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: config.storage,
    logging: false,
    define: config.define,
    pool: config.pool
  });
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    { ...config, logging: false }
  );
}

// Migration tracking table
const MIGRATIONS_TABLE = 'schema_migrations';

/**
 * Ensure migrations table exists
 */
async function initMigrationsTable() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    await queryInterface.createTable(MIGRATIONS_TABLE, {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      batch: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      executed_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    }, { timestamps: false });

    console.log('[MIGRATIONS] Created migrations tracking table');
  } catch (error) {
    // Table may already exist
    if (!error.message.includes('already exists')) {
      console.log('[MIGRATIONS] Migrations table already exists');
    }
  }
}

/**
 * Get list of executed migrations
 */
async function getExecutedMigrations() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const migrations = await queryInterface.sequelize.query(
      `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY batch ASC`,
      { type: sequelize.QueryTypes.SELECT }
    );
    return migrations.map(m => m.name);
  } catch (error) {
    return [];
  }
}

/**
 * Get next batch number
 */
async function getNextBatch() {
  const queryInterface = sequelize.getQueryInterface();

  try {
    const result = await queryInterface.sequelize.query(
      `SELECT MAX(batch) as batch FROM ${MIGRATIONS_TABLE}`,
      { type: sequelize.QueryTypes.SELECT }
    );
    return (result[0]?.batch || 0) + 1;
  } catch (error) {
    return 1;
  }
}

/**
 * Get all migration files
 */
function getMigrationFiles() {
  const migrationsDir = __dirname;
  return fs.readdirSync(migrationsDir)
    .filter(file => file.match(/^\d{3}_.*\.js$/) && file !== 'migrate.js')
    .sort();
}

/**
 * Run up (execute pending migrations)
 */
async function runUp() {
  console.log('\n[MIGRATIONS] Starting up migrations...\n');

  try {
    await initMigrationsTable();

    const executedMigrations = await getExecutedMigrations();
    const allMigrations = getMigrationFiles();
    const pendingMigrations = allMigrations.filter(m => !executedMigrations.includes(m));

    if (pendingMigrations.length === 0) {
      console.log('[MIGRATIONS] No pending migrations');
      return;
    }

    const nextBatch = await getNextBatch();
    const queryInterface = sequelize.getQueryInterface();

    for (const migration of pendingMigrations) {
      try {
        console.log(`[MIGRATIONS] Running: ${migration}`);

        const migrationModule = require(path.join(__dirname, migration));

        if (typeof migrationModule.up !== 'function') {
          throw new Error(`Migration ${migration} has no up function`);
        }

        // Run migration
        await migrationModule.up(queryInterface, sequelize.constructor);

        // Record in tracking table
        await queryInterface.sequelize.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (name, batch, executed_at, created_at) VALUES (?, ?, ?, ?)`,
          {
            replacements: [migration, nextBatch, new Date(), new Date()],
            type: sequelize.QueryTypes.INSERT
          }
        );

        console.log(`[MIGRATIONS] ✓ Completed: ${migration}\n`);
      } catch (error) {
        console.error(`[MIGRATIONS] ✗ Failed: ${migration}`);
        console.error(`[MIGRATIONS] Error: ${error.message}\n`);
        throw error;
      }
    }

    console.log(`[MIGRATIONS] ✓ All ${pendingMigrations.length} migrations completed successfully\n`);
  } catch (error) {
    console.error('[MIGRATIONS] Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

/**
 * Run down (rollback last batch)
 */
async function runDown() {
  console.log('\n[MIGRATIONS] Starting down migrations...\n');

  try {
    await initMigrationsTable();

    const queryInterface = sequelize.getQueryInterface();

    // Get last batch
    const result = await queryInterface.sequelize.query(
      `SELECT MAX(batch) as batch FROM ${MIGRATIONS_TABLE}`,
      { type: sequelize.QueryTypes.SELECT }
    );

    const lastBatch = result[0]?.batch;
    if (!lastBatch) {
      console.log('[MIGRATIONS] No migrations to rollback');
      return;
    }

    // Get migrations in last batch
    const lastBatchMigrations = await queryInterface.sequelize.query(
      `SELECT name FROM ${MIGRATIONS_TABLE} WHERE batch = ? ORDER BY name DESC`,
      {
        replacements: [lastBatch],
        type: sequelize.QueryTypes.SELECT
      }
    );

    for (const migration of lastBatchMigrations) {
      try {
        const migrationName = migration.name;
        console.log(`[MIGRATIONS] Reverting: ${migrationName}`);

        const migrationModule = require(path.join(__dirname, migrationName));

        if (typeof migrationModule.down !== 'function') {
          throw new Error(`Migration ${migrationName} has no down function`);
        }

        // Run down
        await migrationModule.down(queryInterface, sequelize.constructor);

        // Remove from tracking table
        await queryInterface.sequelize.query(
          `DELETE FROM ${MIGRATIONS_TABLE} WHERE name = ?`,
          {
            replacements: [migrationName],
            type: sequelize.QueryTypes.DELETE
          }
        );

        console.log(`[MIGRATIONS] ✓ Reverted: ${migrationName}\n`);
      } catch (error) {
        console.error(`[MIGRATIONS] ✗ Revert failed: ${migration.name}`);
        console.error(`[MIGRATIONS] Error: ${error.message}\n`);
        throw error;
      }
    }

    console.log(`[MIGRATIONS] ✓ Rollback completed\n`);
  } catch (error) {
    console.error('[MIGRATIONS] Rollback failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

/**
 * List migration status
 */
async function listMigrations() {
  try {
    await initMigrationsTable();

    const executedMigrations = await getExecutedMigrations();
    const allMigrations = getMigrationFiles();

    console.log('\n[MIGRATIONS] Status:\n');

    for (const migration of allMigrations) {
      const status = executedMigrations.includes(migration) ? '✓ up  ' : '✗ down';
      console.log(`  ${status}  ${migration}`);
    }

    console.log(`\nExecuted: ${executedMigrations.length}/${allMigrations.length}\n`);
  } catch (error) {
    console.error('[MIGRATIONS] Failed to list migrations:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || '--up';

  try {
    switch (command) {
      case '--up':
        await runUp();
        break;
      case '--down':
        await runDown();
        break;
      case '--list':
        await listMigrations();
        break;
      default:
        console.log('Usage:');
        console.log('  node migrate.js --up    # Run pending migrations');
        console.log('  node migrate.js --down  # Rollback last migration');
        console.log('  node migrate.js --list  # List migration status');
        process.exit(0);
    }
  } catch (error) {
    console.error('[MIGRATIONS] Fatal error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  initMigrationsTable,
  getExecutedMigrations,
  getNextBatch,
  getMigrationFiles,
  runUp,
  runDown,
  listMigrations
};
