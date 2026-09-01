/**
 * Resilience Tests - Cache Expiration
 * Tests for Redis TTL, cache expiration, and MySQL fallback behavior
 */

const { makeRequest, createTestConnection, createTestAuction, cleanupTestData, cleanupAllTestData, createTestRedisConnection, cleanupRedisData, cleanupAllRedisData, assert, assertEquals, TestTracker, sleep } = require('../helpers/test-helpers');
const { getTestAuctionId, getTestUserId, TEST_CONFIG } = require('../helpers/test-config');
const { REDIS_KEYS } = require('../../src/utils/constant');
const logger = require('../../src/utils/logger');

/**
 * Test suite for Redis cache expiration
 */
async function testRedisCacheExpiration() {
  const tracker = new TestTracker();
  let redisClient;
  let dbConnection;

  try {
    redisClient = await createTestRedisConnection();
    dbConnection = await createTestConnection();

    // Pre-test cleanup: Ensure clean state
    await cleanupAllTestData(dbConnection);
    await cleanupAllRedisData(redisClient);

    logger.info('\n=== Testing Redis Cache Expiration ===');

    // Setup: Create test auction
    const auctionId = getTestAuctionId(700);
    await createTestAuction(dbConnection, {
      auction_id: auctionId,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(),
      starting_price: 1000
    });
    await cleanupRedisData(redisClient, auctionId);

    // Test 1: Cache expiration after TTL
    try {
      const shortTTL = 2; // 2 seconds
      const testKey = REDIS_KEYS.AUCTION_TOP_BID(auctionId);
      const testBidData = {
        auction_id: auctionId,
        user_id: getTestUserId(1),
        amount: '1500.00',
        created_at: new Date().toISOString()
      };

      // Set cache as hash with short TTL (matching server's hash structure)
      await redisClient.hSet(testKey, {
        user_id: testBidData.user_id.toString(),
        amount: testBidData.amount
      });
      await redisClient.expire(testKey, shortTTL);

      // Immediately verify it exists
      let cachedData = await redisClient.hGetAll(testKey);
      assert(Object.keys(cachedData).length > 0, 'Cache should exist immediately after setting');

      // Wait for expiration
      await sleep(shortTTL * 1000 + 500); // Wait for TTL + buffer

      // Verify it's expired
      cachedData = await redisClient.hGetAll(testKey);
      assertEquals(Object.keys(cachedData).length, 0, 'Cache should be empty after expiration');

      tracker.recordTest('Cache expiration after TTL', true);
    } catch (error) {
      tracker.recordTest('Cache expiration after TTL', false, error);
    }

    // Test 2: Bid creates cache with proper TTL
    try {
      const auctionId2 = getTestAuctionId(701);
      await createTestAuction(dbConnection, {
        auction_id: auctionId2,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      });
      await cleanupRedisData(redisClient, auctionId2);

      // Make a bid
      const response = await makeRequest('POST', '/bid', {
        body: {
          auction_id: auctionId2,
          user_id: getTestUserId(2),
          amount: '2000.00'
        }
      });

      assertEquals(response.statusCode, 201, 'Bid should succeed');

      // Check if cache was created
      const cacheKey = REDIS_KEYS.AUCTION_TOP_BID(auctionId2);
      const cachedData = await redisClient.get(cacheKey);

      assert(cachedData !== null, 'Cache should be created after successful bid');

      // Check TTL is set
      const ttl = await redisClient.ttl(cacheKey);
      assert(ttl > 0, 'Cache should have positive TTL');

      // Cleanup
      await cleanupTestData(dbConnection, auctionId2);
      await cleanupRedisData(redisClient, auctionId2);
      tracker.recordTest('Bid creates cache with TTL', true);
    } catch (error) {
      tracker.recordTest('Bid creates cache with TTL', false, error);
    }

    // Test 3: Cache persists for expected duration
    try {
      const expectedTTL = 3600; // 1 hour default
      const testKey = REDIS_KEYS.AUCTION_TOP_BID(auctionId);
      const testBidData = {
        auction_id: auctionId,
        user_id: getTestUserId(3),
        amount: '2500.00'
      };

      await redisClient.hSet(testKey, {
        user_id: testBidData.user_id.toString(),
        amount: testBidData.amount
      });
      await redisClient.expire(testKey, expectedTTL);

      // Check TTL immediately
      const initialTTL = await redisClient.ttl(testKey);
      assert(initialTTL > 0 && initialTTL <= expectedTTL, 'Initial TTL should be within expected range');

      // Wait 2 seconds and check TTL decreased
      await sleep(2000);
      const decreasedTTL = await redisClient.ttl(testKey);
      assert(decreasedTTL < initialTTL, 'TTL should decrease over time');

      // Cleanup
      await redisClient.del(testKey);
      tracker.recordTest('Cache persists for expected duration', true);
    } catch (error) {
      tracker.recordTest('Cache persists for expected duration', false, error);
    }

    // Test 4: Cache refresh on new bid
    try {
      const auctionId3 = getTestAuctionId(702);
      await createTestAuction(dbConnection, {
        auction_id: auctionId3,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      });
      await cleanupRedisData(redisClient, auctionId3);

      const cacheKey = REDIS_KEYS.AUCTION_TOP_BID(auctionId3);

      // First bid
      await makeRequest('POST', '/bid', {
        body: {
          auction_id: auctionId3,
          user_id: getTestUserId(4),
          amount: '3000.00'
        }
      });

      const firstTTL = await redisClient.ttl(cacheKey);
      assert(firstTTL > 0, 'First bid should create cache with TTL');

      // Wait 2 seconds
      await sleep(2000);

      // Second higher bid
      await makeRequest('POST', '/bid', {
        body: {
          auction_id: auctionId3,
          user_id: getTestUserId(5),
          amount: '4000.00'
        }
      });

      const secondTTL = await redisClient.ttl(cacheKey);
      assert(secondTTL > firstTTL, 'New bid should refresh TTL');

      // Verify cache content updated
      const cachedData = JSON.parse(await redisClient.get(cacheKey));
      assertEquals(cachedData.amount, '4000.00', 'Cache should contain latest bid');
      assertEquals(cachedData.user_id, getTestUserId(5), 'Cache should contain latest bidder');

      // Cleanup
      await cleanupTestData(dbConnection, auctionId3);
      await cleanupRedisData(redisClient, auctionId3);
      tracker.recordTest('Cache refresh on new bid', true);
    } catch (error) {
      tracker.recordTest('Cache refresh on new bid', false, error);
    }

    // Cleanup
    await cleanupTestData(dbConnection, auctionId);
    await cleanupRedisData(redisClient, auctionId);

  } catch (error) {
    logger.error('Redis cache expiration test suite failed', error);
  } finally {
    if (redisClient) {
      await redisClient.quit();
    }
    if (dbConnection) {
      await dbConnection.end();
    }
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Test suite for MySQL fallback behavior
 */
async function testMySQLFallbackBehavior() {
  const tracker = new TestTracker();
  let redisClient;
  let dbConnection;

  try {
    redisClient = await createTestRedisConnection();
    dbConnection = await createTestConnection();

    // Pre-test cleanup: Ensure clean state
    await cleanupAllTestData(dbConnection);
    await cleanupAllRedisData(redisClient);

    logger.info('\n=== Testing MySQL Fallback Behavior ===');

    // Setup: Create test auction
    const auctionId = getTestAuctionId(800);
    await createTestAuction(dbConnection, {
      auction_id: auctionId,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(),
      starting_price: 1000
    });
    await cleanupRedisData(redisClient, auctionId);

    // Test 1: System falls back to MySQL when cache is missing
    try {
      const cacheKey = REDIS_KEYS.AUCTION_TOP_BID(auctionId);

      // Ensure no cache exists
      await redisClient.del(cacheKey);

      // Make a bid (should work without cache)
      const response = await makeRequest('POST', '/bid', {
        body: {
          auction_id: auctionId,
          user_id: getTestUserId(1),
          amount: '1500.00'
        }
      });

      assertEquals(response.statusCode, 201, 'Bid should succeed without cache');
      assertEquals(response.data.success, true, 'Response should indicate success');

      tracker.recordTest('MySQL fallback when cache missing', true);
    } catch (error) {
      tracker.recordTest('MySQL fallback when cache missing', false, error);
    }

    // Test 2: MySQL fallback after cache expiration
    try {
      const auctionId2 = getTestAuctionId(801);
      await createTestAuction(dbConnection, {
        auction_id: auctionId2,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      });
      await cleanupRedisData(redisClient, auctionId2);

      const cacheKey = REDIS_KEYS.AUCTION_TOP_BID(auctionId2);

      // Create initial bid and cache
      await makeRequest('POST', '/bid', {
        body: {
          auction_id: auctionId2,
          user_id: getTestUserId(2),
          amount: '2000.00'
        }
      });

      // Set very short TTL for cache
      const currentCacheData = await redisClient.hGetAll(cacheKey);
      await redisClient.hSet(cacheKey, currentCacheData);
      await redisClient.expire(cacheKey, 1); // 1 second TTL

      // Wait for expiration
      await sleep(1500);

      // Try new bid (should work with MySQL fallback)
      const response = await makeRequest('POST', '/bid', {
        body: {
          auction_id: auctionId2,
          user_id: getTestUserId(3),
          amount: '2500.00'
        }
      });

      assertEquals(response.statusCode, 201, 'Bid should succeed after cache expiration');
      assertEquals(response.data.success, true, 'Response should indicate success');

      // Cleanup
      await cleanupTestData(dbConnection, auctionId2);
      await cleanupRedisData(redisClient, auctionId2);
      tracker.recordTest('MySQL fallback after cache expiration', true);
    } catch (error) {
      tracker.recordTest('MySQL fallback after cache expiration', false, error);
    }

    // Test 3: MySQL data consistency after cache operations
    try {
      const auctionId3 = getTestAuctionId(802);
      await createTestAuction(dbConnection, {
        auction_id: auctionId3,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      });
      await cleanupRedisData(redisClient, auctionId3);

      // Make several bids
      const bidAmounts = ['1500.00', '2000.00', '3000.00'];
      for (let i = 0; i < bidAmounts.length; i++) {
        await makeRequest('POST', '/bid', {
          body: {
            auction_id: auctionId3,
            user_id: getTestUserId(10 + i),
            amount: bidAmounts[i]
          }
        });
      }

      // Get data directly from MySQL
      const [rows] = await dbConnection.execute(
        `SELECT user_id, amount FROM bids
         WHERE auction_id = ?
         ORDER BY amount DESC
         LIMIT 1`,
        [auctionId3]
      );

      assert(rows.length > 0, 'MySQL should have bid data');
      assertEquals(rows[0].amount, '3000.00', 'MySQL should have highest bid');
      assertEquals(rows[0].user_id, getTestUserId(12), 'MySQL should have correct user');

      // Cleanup
      await cleanupTestData(dbConnection, auctionId3);
      await cleanupRedisData(redisClient, auctionId3);
      tracker.recordTest('MySQL data consistency', true);
    } catch (error) {
      tracker.recordTest('MySQL data consistency', false, error);
    }

    // Test 4: Conditional update fallback safety
    try {
      const auctionId4 = getTestAuctionId(803);
      await createTestAuction(dbConnection, {
        auction_id: auctionId4,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      });
      await cleanupRedisData(redisClient, auctionId4);

      const cacheKey = REDIS_KEYS.AUCTION_TOP_BID(auctionId4);

      // Create initial bid
      await makeRequest('POST', '/bid', {
        body: {
          auction_id: auctionId4,
          user_id: getTestUserId(13),
          amount: '2500.00'
        }
      });

      // Manually corrupt cache to simulate cache failure
      await redisClient.hSet(cacheKey, {
        user_id: getTestUserId(13).toString(),
        amount: '9999.99' // Wrong amount in cache
      });

      // Try lower bid (should be rejected by MySQL conditional update)
      const response = await makeRequest('POST', '/bid', {
        body: {
          auction_id: auctionId4,
          user_id: getTestUserId(14),
          amount: '2000.00' // Lower than actual MySQL highest bid
        }
      });

      assertEquals(response.statusCode, 400, 'Lower bid should be rejected');
      assertEquals(response.data.success, false, 'Response should indicate failure');
      assertEquals(response.data.error_code, 'ERR_BID_TOO_LOW', 'Should return ERR_BID_TOO_LOW error');

      // Cleanup
      await redisClient.del(cacheKey);
      await cleanupTestData(dbConnection, auctionId4);
      await cleanupRedisData(redisClient, auctionId4);
      tracker.recordTest('Conditional update safety', true);
    } catch (error) {
      tracker.recordTest('Conditional update safety', false, error);
    }

    // Cleanup
    await cleanupTestData(dbConnection, auctionId);
    await cleanupRedisData(redisClient, auctionId);

  } catch (error) {
    logger.error('MySQL fallback behavior test suite failed', error);
  } finally {
    if (redisClient) {
      await redisClient.quit();
    }
    if (dbConnection) {
      await dbConnection.end();
    }
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Run all cache expiration and fallback resilience tests
 */
async function runCacheExpirationTests() {
  logger.info('🧪 Starting Cache Expiration Resilience Tests');

  try {
    const cacheResults = await testRedisCacheExpiration();
    const fallbackResults = await testMySQLFallbackBehavior();

    const totalPassed = cacheResults.passed + fallbackResults.passed;
    const totalFailed = cacheResults.failed + fallbackResults.failed;
    const totalTests = totalPassed + totalFailed;

    logger.info('\n=== Overall Cache Expiration Test Results ===');
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
    logger.error('Cache expiration test execution failed', error);
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
  testRedisCacheExpiration,
  testMySQLFallbackBehavior,
  runCacheExpirationTests
};

// Run tests if executed directly
if (require.main === module) {
  runCacheExpirationTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed', error);
      process.exit(1);
    });
}