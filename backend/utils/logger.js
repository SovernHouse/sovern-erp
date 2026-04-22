/**
 * Winston Logger Configuration
 * @module utils/logger
 * @description Structured logging with Winston - console and file transports
 */

const fs = require('fs');
const path = require('path');

// Fallback/noop logger for test environment and when Winston isn't available
const noopLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  log: () => {}
};

let logger = noopLogger;

if (process.env.NODE_ENV !== 'test') {
  try {
    const winston = require('winston');

    // Ensure logs directory exists
    const logsDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    const transports = [
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 5242880,
        maxFiles: 5
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: logFormat,
        maxsize: 5242880,
        maxFiles: 10
      })
    ];

    if (isDev) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, timestamp, ...meta }) => {
              const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${level}] ${message} ${metaStr}`;
            })
          )
        })
      );
    }

    logger = winston.createLogger({
      level: isDev ? 'debug' : 'info',
      transports
    });
  } catch (error) {
    // Winston not installed, use console fallback
    logger = {
      info: (message) => console.log(`[INFO] ${message}`),
      error: (message) => console.error(`[ERROR] ${message}`),
      warn: (message) => console.warn(`[WARN] ${message}`),
      debug: (message) => console.debug(`[DEBUG] ${message}`),
      log: (message) => console.log(`[LOG] ${message}`)
    };
  }
}

module.exports = logger;
