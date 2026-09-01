/**
 * Test Helper Utilities
 * Common utilities for test execution, assertions, and database operations
 */

const mysql = require('mysql2/promise');
const { createClient } = require('redis');
const { TEST_CONFIG, getTestAuctionId, getTestUserId } = require('./test-config');
const { REDIS_KEYS } = require('../../src/utils/constant');
const logger = require('../../src/utils/logger');

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make HTTP request
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {object} options - Request options
 * @returns {Promise<object>} Response data
 */
async function makeRequest(method, path, options = {}) {
  const http = require('http');
  const { body, headers = {} } = options;

  return new Promise((resolve, reject) => {
    const url = new URL(path, TEST_CONFIG.SERVER.BASE_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port || TEST_CONFIG.SERVER.PORT,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : {};
          // Add diagnostic logging for HTTP responses
          if (res.statusCode !== 201 && res.statusCode !== 400 && res.statusCode !== 200) {
            logger.info('Unexpected HTTP response', {
              statusCode: res.statusCode,
              url: path,
              method: method,
              responseData: parsedData
            });
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          logger.error('HTTP response parsing error', {
            statusCode: res.statusCode,
            rawData: data,
            error: error.message
          });
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      logger.error('HTTP request error', {
        url: path,
        method: method,
        error: error.message,
        code: error.code
      });
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Create MySQL connection for tests
 * @returns {Promise<mysql.Connection>}
 */
async function createTestConnection() {
  try {
    const connection = await mysql.createConnection({
      host: TEST_CONFIG.DATABASE.HOST,
      port: TEST_CONFIG.DATABASE.PORT,
      user: TEST_CONFIG.DATABASE.USER,
      password: TEST_CONFIG.DATABASE.PASSWORD,
      database: TEST_CONFIG.DATABASE.DATABASE
    });
    return connection;
  } catch (error) {
    logger.error('Failed to create test database connection', error);
    throw error;
  }
}

/**
 * Format JavaScript Date or ISO string to MySQL datetime format
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} MySQL formatted datetime string
 */
function formatMySQLDateTime(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Create test auction in database
 * @param {mysql.Connection} connection - Database connection
 * @param {object} auctionData - Auction data
 * @returns {Promise<number>} Created auction ID
 */
async function createTestAuction(connection, auctionData) {
  try {
    const auctionId = auctionData.auction_id || getTestAuctionId();
    const { start_time, end_time, starting_price = 1000, title = `Test Auction ${auctionId}` } = auctionData;

    // Format datetime values for MySQL
    const formattedStartTime = formatMySQLDateTime(start_time);
    const formattedEndTime = formatMySQLDateTime(end_time);

    await connection.execute(
      `INSERT INTO auctions (id, title, start_time, end_time, starting_price, top_bid_amount, top_user_id, status)
       VALUES (?, ?, ?, ?, ?, 0, 0, 'ACTIVE')
       ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       start_time = VALUES(start_time),
       end_time = VALUES(end_time),
       starting_price = VALUES(starting_price)`,
      [auctionId, title, formattedStartTime, formattedEndTime, starting_price]
    );

    logger.info('Created test auction', { auction_id: auctionId });
    return auctionId;
  } catch (error) {
    logger.error('Failed to create test auction', error);
    throw error;
  }
}

/**
 * Create test bid in database
 * @param {mysql.Connection} connection - Database connection
 * @param {object} bidData - Bid data
 * @returns {Promise<number>} Created bid ID
 */
async function createTestBid(connection, bidData) {
  try {
    const { auction_id, user_id, amount, request_id } = bidData;
    const defaultRequestId = request_id || `test-bid-${Date.now()}-${auction_id}-${user_id}`;

    const [result] = await connection.execute(
      `INSERT INTO bids (auction_id, user_id, amount, request_id)
       VALUES (?, ?, ?, ?)`,
      [auction_id, user_id, amount, defaultRequestId]
    );

    logger.info('Created test bid', { bid_id: result.insertId, auction_id, user_id, amount });
    return result.insertId;
  } catch (error) {
    logger.error('Failed to create test bid', error);
    throw error;
  }
}

/**
 * Get highest bid for auction from database
 * @param {mysql.Connection} connection - Database connection
 * @param {number} auctionId - Auction ID
 * @returns {Promise<object|null>} Highest bid data
 */
async function getHighestBid(connection, auctionId) {
  try {
    const [rows] = await connection.execute(
      `SELECT id, auction_id, user_id, amount, request_id, created_at
       FROM bids
       WHERE auction_id = ?
       ORDER BY amount DESC, created_at ASC
       LIMIT 1`,
      [auctionId]
    );

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.error('Failed to get highest bid', error);
    throw error;
  }
}

/**
 * Get all bids for auction from database
 * @param {mysql.Connection} connection - Database connection
 * @param {number} auctionId - Auction ID
 * @returns {Promise<Array>} Array of bids
 */
async function getAuctionBids(connection, auctionId) {
  try {
    const [rows] = await connection.execute(
      `SELECT id, auction_id, user_id, amount, request_id, created_at
       FROM bids
       WHERE auction_id = ?
       ORDER BY amount DESC, created_at ASC`,
      [auctionId]
    );

    return rows;
  } catch (error) {
    logger.error('Failed to get auction bids', error);
    throw error;
  }
}

/**
 * Clean up test data from database
 * @param {mysql.Connection} connection - Database connection
 * @param {number} auctionId - Auction ID to clean up
 * @returns {Promise<void>}
 */
async function cleanupTestData(connection, auctionId) {
  try {
    await connection.execute(
      'DELETE FROM bids WHERE auction_id = ?',
      [auctionId]
    );

    await connection.execute(
      'DELETE FROM auctions WHERE id = ?',
      [auctionId]
    );

    logger.info('Cleaned up test data', { auction_id: auctionId });
  } catch (error) {
    logger.error('Failed to clean up test data', error);
    throw error;
  }
}

/**
 * Clean up all test data from database for auction ID range
 * @param {mysql.Connection} connection - Database connection
 * @param {number} startId - Starting auction ID
 * @param {number} endId - Ending auction ID
 * @returns {Promise<void>}
 */
async function cleanupAllTestData(connection, startId = 9000, endId = 10000) {
  try {
    await connection.execute(
      'DELETE FROM bids WHERE auction_id >= ? AND auction_id < ?',
      [startId, endId]
    );

    await connection.execute(
      'DELETE FROM auctions WHERE id >= ? AND id < ?',
      [startId, endId]
    );

    logger.info('Cleaned up all test data', { start_id: startId, end_id: endId });
  } catch (error) {
    logger.error('Failed to clean up all test data', error);
    throw error;
  }
}

/**
 * Clean up all Redis cache keys for test auctions
 * @param {RedisClient} redisClient - Redis client
 * @param {number} startId - Starting auction ID
 * @param {number} endId - Ending auction ID
 * @returns {Promise<void>}
 */
async function cleanupAllRedisData(redisClient, startId = 9000, endId = 10000) {
  try {
    const { REDIS_KEYS } = require('../../src/utils/constant');

    // Clean up auction top bid keys
    for (let auctionId = startId; auctionId < endId; auctionId++) {
      const key = REDIS_KEYS.AUCTION_TOP_BID(auctionId);
      await redisClient.del(key);
    }

    logger.info('Cleaned up all Redis test data', { start_id: startId, end_id: endId });
  } catch (error) {
    logger.error('Failed to clean up all Redis data', error);
    throw error;
  }
}

/**
 * Create Redis connection for tests
 * @returns {Promise<RedisClient>}
 */
async function createTestRedisConnection() {
  try {
    const client = createClient({
      socket: {
        host: TEST_CONFIG.REDIS.HOST,
        port: TEST_CONFIG.REDIS.PORT
      },
      username: TEST_CONFIG.REDIS.USER,
      password: TEST_CONFIG.REDIS.PASSWORD
    });

    client.on('error', (error) => {
      logger.error('Redis test connection error', error);
    });

    await client.connect();
    return client;
  } catch (error) {
    logger.error('Failed to create test Redis connection', error);
    throw error;
  }
}

/**
 * Clean up Redis data for an auction
 * @param {RedisClient} redisClient - Redis client
 * @param {number} auctionId - Auction ID to clean up
 * @returns {Promise<void>}
 */
async function cleanupRedisData(redisClient, auctionId) {
  try {
    const key = REDIS_KEYS.AUCTION_TOP_BID(auctionId);
    await redisClient.del(key);
    logger.info('Cleaned up Redis data', { auction_id: auctionId });
  } catch (error) {
    logger.error('Failed to clean up Redis data', error);
    throw error;
  }
}

/**
 * Assert test condition
 * @param {boolean} condition - Condition to check
 * @param {string} message - Assertion message
 * @throws {Error} If condition is false
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Assert equals
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @param {string} message - Assertion message
 */
function assertEquals(actual, expected, message = '') {
  const formattedMessage = message ||
    `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`;
  assert(actual === expected, formattedMessage);
}

/**
 * Assert deep equals
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @param {string} message - Assertion message
 */
function assertDeepEquals(actual, expected, message = '') {
  const formattedMessage = message ||
    `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`;
  assert(JSON.stringify(actual) === JSON.stringify(expected), formattedMessage);
}

/**
 * Assert throws
 * @param {Function} fn - Function to test
 * @param {string} message - Expected error message
 */
async function assertThrows(fn, message) {
  try {
    await fn();
    throw new Error(`Expected function to throw with message: ${message}`);
  } catch (error) {
    if (error.message.includes('Expected function to throw')) {
      throw error;
    }
    if (!error.message.includes(message)) {
      throw new Error(`Expected error message "${message}" but got "${error.message}"`);
    }
  }
}

/**
 * Test result tracker
 */
class TestTracker {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Record test result
   * @param {string} testName - Test name
   * @param {boolean} passed - Whether test passed
   * @param {string} error - Error message if failed
   */
  recordTest(testName, passed, error = null) {
    this.results.tests.push({
      name: testName,
      passed,
      error: error ? error.message : null
    });

    if (passed) {
      this.results.passed++;
      logger.info(`✅ PASSED: ${testName}`);
    } else {
      this.results.failed++;
      logger.error(`❌ FAILED: ${testName}`, error);
    }
  }

  /**
   * Get test results summary
   * @returns {object} Test results
   */
  getResults() {
    return this.results;
  }

  /**
   * Print test results summary
   */
  printSummary() {
    const total = this.results.passed + this.results.failed;
    const passRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;

    logger.info('\n=== Test Results Summary ===');
    logger.info(`Total Tests: ${total}`);
    logger.info(`Passed: ${this.results.passed} (${passRate}%)`);
    logger.info(`Failed: ${this.results.failed}`);

    if (this.results.failed > 0) {
      logger.info('\nFailed Tests:');
      this.results.tests
        .filter(test => !test.passed)
        .forEach(test => {
          logger.error(`  - ${test.name}: ${test.error}`);
        });
    }

    logger.info(`\n${this.results.failed === 0 ? '🎉 ALL TESTS PASSED! 🎉' : '⚠️  SOME TESTS FAILED'}`);
  }
}

module.exports = {
  sleep,
  makeRequest,
  createTestConnection,
  createTestAuction,
  createTestBid,
  getHighestBid,
  getAuctionBids,
  cleanupTestData,
  cleanupAllTestData,
  createTestRedisConnection,
  cleanupRedisData,
  cleanupAllRedisData,
  assert,
  assertEquals,
  assertDeepEquals,
  assertThrows,
  TestTracker,
  formatMySQLDateTime
};