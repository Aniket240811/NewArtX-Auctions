/**
 * Test Configuration Module
 * Centralized test environment setup and configuration
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../environments/prod/.env') });

/**
 * Test configuration object
 */
const TEST_CONFIG = {
  // Server configuration
  SERVER: {
    HOST: process.env.SERVER_HOST || 'localhost',
    PORT: process.env.SERVER_PORT || 3000,
    BASE_URL: `http://${process.env.SERVER_HOST || 'localhost'}:${process.env.SERVER_PORT || 3000}`
  },

  // Database configuration
  DATABASE: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: process.env.DB_PORT || 3306,
    USER: process.env.DB_WRITE_USER || 'root',
    PASSWORD: process.env.DB_WRITE_PASS || '',
    DATABASE: process.env.DB_NAME || 'NewArtX'
  },

  // Redis configuration
  REDIS: {
    HOST: process.env.REDIS_HOST || 'localhost',
    PORT: process.env.REDIS_PORT || 6379,
    USER: process.env.REDIS_USER || 'default',
    PASSWORD: process.env.REDIS_PASS || ''
  },

  // Test data configuration
  TEST_DATA: {
    // Use high auction IDs to avoid conflicts with production data
    AUCTION_ID_START: 9000,
    USER_ID_START: 100,

    // Bid increments for testing
    BID_AMOUNTS: {
      INITIAL: 1000,
      INCREMENT: 500,
      LARGE: 10000
    },

    // Test timeouts (in milliseconds)
    TIMEOUTS: {
      CONNECTION: 5000,
      OPERATION: 10000,
      CACHE_EXPIRY: 2000, // Shorter for testing
      SHUTDOWN: 3000
    },

    // Test auction configurations
    AUCTIONS: {
      ACTIVE: {
        start_time: new Date(Date.now() - 86400000).toISOString(), // Started 1 day ago
        end_time: new Date(Date.now() + 86400000).toISOString()    // Ends 1 day from now
      },
      CLOSED: {
        start_time: new Date(Date.now() - 172800000).toISOString(), // Started 2 days ago
        end_time: new Date(Date.now() - 86400000).toISOString()     // Ended 1 day ago
      }
    }
  },

  // Test execution settings
  EXECUTION: {
    // Delay between tests to avoid conflicts
    TEST_DELAY: 100,

    // Maximum retry attempts for network operations
    MAX_RETRIES: 3,

    // Whether to clean up test data after tests
    CLEANUP: true
  }
};

/**
 * Get unique test auction ID
 * @param {number} offset - Offset from start ID
 * @returns {number} Unique auction ID for testing
 */
function getTestAuctionId(offset = 0) {
  return TEST_CONFIG.TEST_DATA.AUCTION_ID_START + offset;
}

/**
 * Get unique test user ID
 * @param {number} offset - Offset from start ID
 * @returns {number} Unique user ID for testing
 */
function getTestUserId(offset = 0) {
  return TEST_CONFIG.TEST_DATA.USER_ID_START + offset;
}

/**
 * Get test bid amount
 * @param {string} type - Type of amount (initial, increment, large)
 * @param {number} multiplier - Multiplier for the amount
 * @returns {number} Test bid amount
 */
function getTestAmount(type = 'increment', multiplier = 1) {
  const baseAmount = TEST_CONFIG.TEST_DATA.BID_AMOUNTS[type.toUpperCase()] ||
                    TEST_CONFIG.TEST_DATA.BID_AMOUNTS.INCREMENT;
  return baseAmount * multiplier;
}

/**
 * Generate unique request ID for testing
 * @param {string} prefix - Prefix for the request ID
 * @returns {string} Unique request ID
 */
function generateRequestId(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  TEST_CONFIG,
  getTestAuctionId,
  getTestUserId,
  getTestAmount,
  generateRequestId
};