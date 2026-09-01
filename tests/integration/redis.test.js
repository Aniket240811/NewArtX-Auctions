/**
 * Integration Tests - Redis
 * Tests for Redis connection and basic operations
 */

const { createClient } = require('redis');
const { assert, assertEquals, TestTracker, sleep } = require('../helpers/test-helpers');
const { TEST_CONFIG } = require('../helpers/test-config');
const { REDIS_KEYS } = require('../../src/utils/constant');
const logger = require('../../src/utils/logger');

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
 * Test suite for Redis connection
 */
async function testRedisConnection() {
  const tracker = new TestTracker();
  logger.info('\n=== Testing Redis Connection ===');

  // Test 1: Basic connection establishment
  try {
    const client = await createTestRedisConnection();
    assert(client !== null, 'Should create Redis connection');

    await client.quit();
    tracker.recordTest('Redis connection establishment', true);
  } catch (error) {
    tracker.recordTest('Redis connection establishment', false, error);
  }

  // Test 2: Connection with proper authentication
  try {
    const client = await createTestRedisConnection();

    // Test a simple PING
    const response = await client.ping();
    assertEquals(response, 'PONG', 'PING should return PONG');

    await client.quit();
    tracker.recordTest('Redis PING command', true);
  } catch (error) {
    tracker.recordTest('Redis PING command', false, error);
  }

  // Test 3: Redis server responsiveness
  try {
    const client = await createTestRedisConnection();

    // Test server info
    const info = await client.info('server');
    assert(info.includes('redis_version'), 'Server info should contain version');

    await client.quit();
    tracker.recordTest('Redis server info', true);
  } catch (error) {
    tracker.recordTest('Redis server info', false, error);
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Test suite for Redis basic operations
 */
async function testRedisBasicOperations() {
  const tracker = new TestTracker();
  let client;

  try {
    client = await createTestRedisConnection();
    logger.info('\n=== Testing Redis Basic Operations ===');

    // Test 1: SET and GET operations
    try {
      const testKey = 'test:key:set:get';
      const testValue = 'test-value';

      await client.set(testKey, testValue);
      const retrievedValue = await client.get(testKey);

      assertEquals(retrievedValue, testValue, 'GET should return SET value');

      // Cleanup
      await client.del(testKey);
      tracker.recordTest('Redis SET and GET operations', true);
    } catch (error) {
      tracker.recordTest('Redis SET and GET operations', false, error);
    }

    // Test 2: SET with EXpiration
    try {
      const testKey = 'test:key:expiration';
      const testValue = 'test-value-expire';
      const ttl = 2; // 2 seconds

      await client.set(testKey, testValue, { EX: ttl });

      // Immediately check
      let retrievedValue = await client.get(testKey);
      assertEquals(retrievedValue, testValue, 'GET should return value immediately after SET');

      // Wait for expiration
      await sleep(ttl * 1000 + 100);
      retrievedValue = await client.get(testKey);

      assertEquals(retrievedValue, null, 'GET should return null after expiration');

      tracker.recordTest('Redis SET with expiration', true);
    } catch (error) {
      tracker.recordTest('Redis SET with expiration', false, error);
    }

    // Test 3: JSON operations
    try {
      const testKey = 'test:key:json';
      const testObject = { auction_id: 123, user_id: 456, amount: '1500.50' };

      await client.set(testKey, JSON.stringify(testObject));
      const retrievedString = await client.get(testKey);
      const retrievedObject = JSON.parse(retrievedString);

      assertEquals(retrievedObject.auction_id, 123, 'JSON should preserve auction_id');
      assertEquals(retrievedObject.amount, '1500.50', 'JSON should preserve amount');

      // Cleanup
      await client.del(testKey);
      tracker.recordTest('Redis JSON operations', true);
    } catch (error) {
      tracker.recordTest('Redis JSON operations', false, error);
    }

    // Test 4: HSET and HGET operations
    try {
      const testKey = 'test:key:hash';
      const field1 = 'auction_id';
      const field2 = 'highest_bid';

      await client.hSet(testKey, field1, '123');
      await client.hSet(testKey, field2, '1500.50');

      const value1 = await client.hGet(testKey, field1);
      const value2 = await client.hGet(testKey, field2);

      assertEquals(value1, '123', 'HGET should return correct field value');
      assertEquals(value2, '1500.50', 'HGET should return correct field value');

      // Cleanup
      await client.del(testKey);
      tracker.recordTest('Redis HSET and HGET operations', true);
    } catch (error) {
      tracker.recordTest('Redis HSET and HGET operations', false, error);
    }

    // Test 5: DELETE operations
    try {
      const testKey = 'test:key:delete';

      await client.set(testKey, 'value-to-delete');
      let exists = await client.exists(testKey);
      assertEquals(exists, 1, 'Key should exist after SET');

      await client.del(testKey);
      exists = await client.exists(testKey);
      assertEquals(exists, 0, 'Key should not exist after DEL');

      tracker.recordTest('Redis DELETE operations', true);
    } catch (error) {
      tracker.recordTest('Redis DELETE operations', false, error);
    }

    // Test 6: EXISTS operations
    try {
      const testKey1 = 'test:key:exists:1';
      const testKey2 = 'test:key:exists:2';

      await client.set(testKey1, 'value1');

      const exists1 = await client.exists(testKey1);
      const exists2 = await client.exists(testKey2);

      assertEquals(exists1, 1, 'Existing key should return 1');
      assertEquals(exists2, 0, 'Non-existing key should return 0');

      // Cleanup
      await client.del(testKey1);
      tracker.recordTest('Redis EXISTS operations', true);
    } catch (error) {
      tracker.recordTest('Redis EXISTS operations', false, error);
    }

  } catch (error) {
    logger.error('Redis basic operations test suite failed', error);
  } finally {
    if (client) {
      await client.quit();
    }
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Test suite for auction-specific Redis operations
 */
async function testAuctionRedisOperations() {
  const tracker = new TestTracker();
  let client;

  try {
    client = await createTestRedisConnection();
    logger.info('\n=== Testing Auction Redis Operations ===');

    // Test 1: Store auction top bid data
    try {
      const auctionId = 9999;
      const topBidData = {
        auction_id: auctionId,
        user_id: 100,
        amount: '2500.00',
        created_at: new Date().toISOString()
      };

      const key = REDIS_KEYS.AUCTION_TOP_BID(auctionId);
      await client.set(key, JSON.stringify(topBidData), { EX: 3600 });

      const retrievedData = await client.get(key);
      const parsedData = JSON.parse(retrievedData);

      assertEquals(parsedData.auction_id, auctionId, 'Should preserve auction_id');
      assertEquals(parsedData.amount, '2500.00', 'Should preserve amount');

      // Cleanup
      await client.del(key);
      tracker.recordTest('Store auction top bid data', true);
    } catch (error) {
      tracker.recordTest('Store auction top bid data', false, error);
    }

    // Test 2: Redis key naming conventions
    try {
      const auctionId = 8888;
      const expectedKeyPattern = `auction:${auctionId}:top_bid`;
      const actualKey = REDIS_KEYS.AUCTION_TOP_BID(auctionId);

      assertEquals(actualKey, expectedKeyPattern, 'Key should match expected pattern');

      tracker.recordTest('Redis key naming conventions', true);
    } catch (error) {
      tracker.recordTest('Redis key naming conventions', false, error);
    }

    // Test 3: TTL operations
    try {
      const auctionId = 7777;
      const testKey = REDIS_KEYS.AUCTION_TOP_BID(auctionId);
      const testData = { test: 'data' };

      await client.set(testKey, JSON.stringify(testData), { EX: 3600 });

      const ttl = await client.ttl(testKey);
      assert(ttl > 0 && ttl <= 3600, 'TTL should be positive and within set time');

      // Cleanup
      await client.del(testKey);
      tracker.recordTest('Redis TTL operations', true);
    } catch (error) {
      tracker.recordTest('Redis TTL operations', false, error);
    }

    // Test 4: Multiple auction data management
    try {
      const auctionIds = [6001, 6002, 6003];

      for (const auctionId of auctionIds) {
        const key = REDIS_KEYS.AUCTION_TOP_BID(auctionId);
        await client.set(key, JSON.stringify({ auction_id: auctionId }), { EX: 3600 });
      }

      // Check all exist
      for (const auctionId of auctionIds) {
        const key = REDIS_KEYS.AUCTION_TOP_BID(auctionId);
        const exists = await client.exists(key);
        assertEquals(exists, 1, `Auction ${auctionId} key should exist`);
      }

      // Cleanup
      for (const auctionId of auctionIds) {
        await client.del(REDIS_KEYS.AUCTION_TOP_BID(auctionId));
      }
      tracker.recordTest('Multiple auction data management', true);
    } catch (error) {
      tracker.recordTest('Multiple auction data management', false, error);
    }

  } catch (error) {
    logger.error('Auction Redis operations test suite failed', error);
  } finally {
    if (client) {
      await client.quit();
    }
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Run all Redis integration tests
 */
async function runRedisTests() {
  logger.info('🧪 Starting Redis Integration Tests');

  try {
    const connectionResults = await testRedisConnection();
    const basicResults = await testRedisBasicOperations();
    const auctionResults = await testAuctionRedisOperations();

    const totalPassed = connectionResults.passed + basicResults.passed + auctionResults.passed;
    const totalFailed = connectionResults.failed + basicResults.failed + auctionResults.failed;
    const totalTests = totalPassed + totalFailed;

    logger.info('\n=== Overall Redis Test Results ===');
    logger.info(`Total Tests: ${totalTests}`);
    logger.info(`Passed: ${totalPassed}`);
    logger.info(`Failed: ${totalFailed}`);

    return {
      total: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      success: totalFailed === 0
    };
  } catch (error) {
    logger.error('Redis test execution failed', error);
    return {
      total: 0,
      passed: 0,
      failed: 1,
      success: false
    };
  }
}

// Export for use in test runner
module.exports = {
  testRedisConnection,
  testRedisBasicOperations,
  testAuctionRedisOperations,
  runRedisTests
};

// Run tests if executed directly
if (require.main === module) {
  runRedisTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed', error);
      process.exit(1);
    });
}