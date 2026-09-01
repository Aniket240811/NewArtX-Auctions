/**
 * Centralized Structured Logger
 *
 * Provides professional logging with timestamps, log levels, and structured metadata.
 * Replaces all raw console.log/error statements across the codebase.
 * Lightweight implementation without external dependencies.
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const levels = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  ERROR: 'ERROR'
};

/**
 * Professional logger with colored output and structured metadata
 */
class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || 'info';
  }

  /**
   * Check if message should be logged based on level priority
   * @param {string} level - Log level
   * @returns {boolean}
   */
  _shouldLog(level) {
    const levelPriority = { DEBUG: 0, INFO: 1, ERROR: 2 };
    const currentPriority = levelPriority[this.level.toUpperCase()] || 1;
    const msgPriority = levelPriority[level] || 1;
    return msgPriority >= currentPriority;
  }

  /**
   * Format log message with timestamp, level, and metadata
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {object|Error} meta - Metadata or error object
   * @returns {string}
   */
  _formatMessage(level, message, meta) {
    const timestamp = new Date().toISOString();
    const color = level === 'ERROR' ? colors.red :
                  level === 'INFO' ? colors.green :
                  level === 'DEBUG' ? colors.cyan : colors.blue;

    let output = `${color}${timestamp} [${level}]${colors.reset}: ${message}`;

    // Add metadata if present
    if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
      // Handle Error objects specially
      if (meta instanceof Error) {
        output += ` ${colors.red}Error: ${meta.message}${colors.reset}`;
        if (meta.stack) {
          output += `\n${colors.red}${meta.stack}${colors.reset}`;
        }
      } else {
        output += ` ${JSON.stringify(meta)}`;
      }
    }

    return output;
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {object} meta - Optional metadata
   */
  debug(message, meta) {
    if (this._shouldLog('DEBUG')) {
      console.log(this._formatMessage('DEBUG', message, meta));
    }
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {object} meta - Optional metadata
   */
  info(message, meta) {
    if (this._shouldLog('INFO')) {
      console.log(this._formatMessage('INFO', message, meta));
    }
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error|object} errorOrMeta - Error object or metadata
   */
  error(message, errorOrMeta) {
    if (this._shouldLog('ERROR')) {
      console.error(this._formatMessage('ERROR', message, errorOrMeta));
    }
  }
}

// Export singleton instance
module.exports = new Logger();
