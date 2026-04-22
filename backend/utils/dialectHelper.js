/**
 * Dialect-aware helper functions for Sequelize
 * Handles differences between SQLite and PostgreSQL
 */

const { Op } = require('sequelize');

/**
 * Get the appropriate LIKE operator for the current dialect
 * SQLite uses LIKE (case-insensitive by default)
 * PostgreSQL uses ILIKE for case-insensitive matching
 *
 * @param {string} dialect - Database dialect ('sqlite' or 'postgres')
 * @returns {Symbol} Sequelize Op symbol
 */
function likeOp(dialect = process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite') {
  return dialect === 'postgres' ? Op.iLike : Op.like;
}

/**
 * Get the appropriate substring/contains operator
 * SQLite uses LIKE with wildcards
 * PostgreSQL uses ILIKE with wildcards
 *
 * @param {string} value - Value to search for
 * @param {string} dialect - Database dialect
 * @returns {object} Sequelize where clause
 */
function containsOp(value, dialect = process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite') {
  const operator = likeOp(dialect);
  return { [operator]: `%${value}%` };
}

/**
 * Get the appropriate starts-with operator
 * SQLite uses LIKE with wildcard suffix
 * PostgreSQL uses ILIKE with wildcard suffix
 *
 * @param {string} value - Value to search for
 * @param {string} dialect - Database dialect
 * @returns {object} Sequelize where clause
 */
function startsWithOp(value, dialect = process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite') {
  const operator = likeOp(dialect);
  return { [operator]: `${value}%` };
}

/**
 * Get the appropriate ends-with operator
 * SQLite uses LIKE with wildcard prefix
 * PostgreSQL uses ILIKE with wildcard prefix
 *
 * @param {string} value - Value to search for
 * @param {string} dialect - Database dialect
 * @returns {object} Sequelize where clause
 */
function endsWithOp(value, dialect = process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite') {
  const operator = likeOp(dialect);
  return { [operator]: `%${value}` };
}

/**
 * Convert camelCase to snake_case for database field names
 * Used for index definitions and raw queries
 *
 * @param {string} str - camelCase string
 * @returns {string} snake_case string
 */
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Convert snake_case to camelCase
 * Used when retrieving data from database
 *
 * @param {string} str - snake_case string
 * @returns {string} camelCase string
 */
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Get the appropriate boolean type for the dialect
 * SQLite uses BOOLEAN (treated as integer)
 * PostgreSQL uses BOOLEAN
 *
 * @param {string} dialect - Database dialect
 * @returns {string} SQL type
 */
function booleanType(dialect = process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite') {
  return dialect === 'postgres' ? 'BOOLEAN' : 'INTEGER';
}

/**
 * Get the appropriate JSON type for the dialect
 * SQLite uses TEXT (stored as JSON string)
 * PostgreSQL uses JSONB for better performance
 *
 * @param {string} dialect - Database dialect
 * @returns {string} SQL type
 */
function jsonType(dialect = process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite') {
  return dialect === 'postgres' ? 'JSONB' : 'TEXT';
}

/**
 * Get the appropriate UUID type for the dialect
 * SQLite uses TEXT (with UUID constraint)
 * PostgreSQL uses UUID
 *
 * @param {string} dialect - Database dialect
 * @returns {string} SQL type
 */
function uuidType(dialect = process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite') {
  return dialect === 'postgres' ? 'UUID' : 'TEXT';
}

/**
 * Get the current database dialect from environment or config
 * @returns {string} 'sqlite' or 'postgres'
 */
function getCurrentDialect() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.startsWith('postgres') ? 'postgres' : 'sqlite';
  }
  return process.env.NODE_ENV === 'production' ? 'postgres' : 'sqlite';
}

module.exports = {
  likeOp,
  containsOp,
  startsWithOp,
  endsWithOp,
  toSnakeCase,
  toCamelCase,
  booleanType,
  jsonType,
  uuidType,
  getCurrentDialect,
  // Re-export Op for convenience
  Op
};
