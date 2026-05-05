/**
 * Winston Logger
 * @module utils/logger
 * @description Structured logging for all environments.
 *   - test:        silent (no output, no noise in CI)
 *   - development: colorized human-readable output to console
 *   - production:  JSON to stdout — captured by GCP Cloud Logging
 */

const winston = require('winston');

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  format: isDev ? devFormat : prodFormat,
  transports: [new winston.transports.Console()],
  silent: process.env.NODE_ENV === 'test',
});

module.exports = logger;
