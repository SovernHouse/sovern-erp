const path = require('path');
const logger = require('../utils/logger.js');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * Database configuration for Sequelize CLI
 * Supports both SQLite and PostgreSQL
 *
 * Priority:
 * 1. DATABASE_URL - for automatic PostgreSQL URL parsing
 * 2. Individual DB_* variables (DB_HOST, DB_USER, etc.)
 * 3. Default to SQLite for development/test
 */
function getConfig() {
  const env = process.env.NODE_ENV || 'development';

  // Base configuration
  const baseConfig = {
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  };

  // Check if DATABASE_URL is set (PostgreSQL URL format)
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);

    return {
      ...baseConfig,
      dialect: 'postgres',
      username: url.username || process.env.DB_USER,
      password: url.password || process.env.DB_PASSWORD,
      database: url.pathname.slice(1) || process.env.DB_NAME,
      host: url.hostname || process.env.DB_HOST,
      port: url.port || process.env.DB_PORT || 5432,
      logging: process.env.LOG_LEVEL === 'debug' ? logger.info : false,
      pool: {
        max: parseInt(process.env.DB_POOL_MAX || '10'),
        min: parseInt(process.env.DB_POOL_MIN || '2'),
        acquire: 30000,
        idle: 10000
      },
      ssl: process.env.DB_SSL !== 'false',
      dialectOptions: process.env.DB_SSL !== 'false' ? {
        ssl: {
          require: true,
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        }
      } : {}
    };
  }

  // Check for individual PostgreSQL configuration
  if (process.env.DB_HOST && process.env.DB_USER) {
    return {
      ...baseConfig,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'trading_erp',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: process.env.LOG_LEVEL === 'debug' ? logger.info : false,
      pool: {
        max: parseInt(process.env.DB_POOL_MAX || '10'),
        min: parseInt(process.env.DB_POOL_MIN || '2'),
        acquire: 30000,
        idle: 10000
      },
      ssl: process.env.DB_SSL !== 'false',
      dialectOptions: process.env.DB_SSL !== 'false' ? {
        ssl: {
          require: true,
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        }
      } : {}
    };
  }

  // Default to SQLite
  if (env === 'test') {
    return {
      ...baseConfig,
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false
    };
  }

  // Development SQLite
  return {
    ...baseConfig,
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'database.sqlite'),
    logging: process.env.LOG_LEVEL === 'debug' ? logger.info : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  };
}

const config = {
  development: getConfig(),
  test: 