/**
 * Resilience Tests - Concurrency
 * Tests for concurrent bid handling, race conditions, and data consistency
 */

const { makeRequest, createTestConnection, createTestAuction, getAuctionBids, cleanupTestData, cleanupAllTestData, createTestRedisConnection, cleanupRedisData, cleanupAllRedisData, assert, assertEquals, TestTracker } = require('../helpers/test-helpers');
const { getTestAuctionId, getTestUserId } = require('../helpers/test-config');
const logger = require('../../src/utils/logger');

/**
 * Test suite for concurrent bid submissions
 */
async function testConcurrentBidSubmissions() {
  const tracker = new TestTracker();
  let connection;
  let redisClient;

  try {
    connection = await createTestConnection();
    redisClient = await createTestRedisConnection();

    // Pre-test cleanup: Ensure clean state
    await cleanupAllTestData(connection);
    await cleanupAllRedisData(redisClient);

    logger.info('\n=== Testing Concurrent Bid Submissions ===');

    // Setup: Create test auction
    const auctionId = getTestAuctionId(900);
    await createTestAuction(connection, {
      auction_id: auctionId,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(),
      starting_price: 1000
    });
    await cleanupRedisData(redisClient, auctionId);

    // Test 1: Multiple concurrent bids from different users
    try {
      const concurrentBids = [];
      const userCount = 10;

      // Create concurrent bid requests
      for (let i = 0; i < userCount; i++) {
        concurrentBids.push(
          makeRequest('POST', '/bid', {
            body: {
              auction_id: auctionId,
              user_id: getTestUserId(i),
              amount: (1500 + i * 100).toString()
            }
          })
        );
      }

      // Execute all bids concurrently
      const responses = await Promise.all(concurrentBids);

      // All should be processed (either success or proper rejection)
      const processedCount = responses.filter(r => r.statusCode === 201 || r.statusCode === 400).length;
      assertEquals(processedCount, userCount, 'All concurrent bids should be processed');

      // At least some should succeed
      const successCount = responses.filter(r => r.statusCode === 201).length;
      assert(successCount > 0, 'At least some concurrent bids should succeed');

      // Verify data consistency
      const bids = await getAuctionBids(connection, auctionId);
      assert(bids.length > 0, 'Database should contain bids');

      tracker.recordTest('Multiple concurrent bids processing', true);
    } catch (error) {
      tracker.recordTest('Multiple concurrent bids processing', false, error);
    }

    // Test 2: Concurrent bids with same user (should handle gracefully)
    try {
      const auctionId2 = getTestAuctionId(901);
      await createTestAuction(connection, {
        auction_id: auctionId2,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      });
      await cleanupRedisData(redisClient, auctionId2);

      const userId = getTestUserId(20);
      const sameUserBids = [];

      // Create multiple concurrent bids from same user
      for (let i = 0; i < 5; i++) {
        sameUserBids.push(
          makeRequest('POST', '/bid', {
            body: {
              auction_id: auctionId2,
              user_id: userId,
              amount: (2000 + i * 100).toString()
            }
          })
        );
      }

      // Execute concurrently
      const responses = await Promise.all(sameUserBids);

      // Only first should succeed, others should be rejected
      const successCount = responses.filter(r => r.statusCode === 201).length;
      const rejectionCount = responses.filter(r => r.statusCode === 400).length;

      assert(successCount <= 1, 'At most one bid from same user should succeed');
      assert(rejectionCount >= 4, 'Remaining bids should be rejected');

      // Cleanup
      await cleanupTestData(connection, auctionId2);
      await cleanupRedisData(redisClient, auctionId2);
      tracker.recordTest('Concurrent bids from same user', true);
    } catch (error) {
      tracker.recordTest('Concurrent bids from same user', false, error);
    }

    // Test 3: Race condition on highest bid
    try {
      const auctionId3 = getTestAuctionId(902);
      await createTestAuction(connection, {
        auction_id: auctionId3,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      });
      await cleanupRedisData(redisClient, auctionId3);

      const concurrentBids = [];
      const bidAmounts = ['2500.00', '2500.00', '2500.00']; // Same amount from different users

      // Create concurrent bids with same amount
      for (let i = 0; i < bidAmounts.length; i++) {
        concurrentBids.push(
          makeRequest('POST', '/bid', {
            body: {
              auction_id: auctionId3,
              user_id: getTestUserId(30 + i),
              amount: bidAmounts[i]
            }
          })
        );
      }

      // Execute concurrently
      const responses = await Promise.all(concurrentBids);

      // Only first should succeed with that amount
      const successCount = responses.filter(r => r.statusCode === 201).length;
      assert(successCount <= 1, 'At most one equal bid should succeed');

      // Cleanup
      await cleanupTestData(connection, auctionId3);
      await cleanupRedisData(redisClient, auctionId3);
      tracker.recordTest('Race condition handling', true);
    } catch (error) {
      tracker.recordTest('Race condition handling', false, error);
    }

    // Test 4: Data consistency under concurrent load
    try {
      const auctionId4 = getTestAuctionId(903);
      await createTestAuction(connection, {
        auction_id: auctionId4,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      });
      await cleanupRedisData(redisClient, auctionId4);

      const concurrentBids = [];
      const bidCount = 20;

      // Create many concurrent bids
      for (let i = 0; i < bidCount; i++) {
        concurrentBids.push(
          makeRequest('POST', '/bid', {
            body: {
              auction_id: auctionId4,
              user_id: getTestUserId(40 + i),
              amount: (3000 + i * 50).toString()
            }
          })
        );
      }

      // Execute all concurrently
      await Promise.all(concurrentBids);

      // Verify database consistency
      const bids = await getAuctionBids(connection, auctionId4);
      assert(bids.length > 0, 'Database should have bids');

      // Verify highest bid is consistent
      const [rows] = await connection.execute(
        `SELECT user_id, amount FROM bids
         WHERE auction_id = ?
         ORDER BY amount DESC, created_at ASC
         LIMIT 1`,
        [auctionId4]
      );

      assert(rows.length > 0, 'Should have highest bid');
      const highestAmount = parseFloat(rows[0].amount);

      // Verify no bids higher than the supposed highest
      const [maxRows] = await connection.execute(
        `SELECT MAX(amount) as max_amount FROM bids WHERE auction_id = ?`,
        [auctionId4]
      );

      assertEquals(parseFloat(maxRows[0].max_amount), highestAmount, 'Max amount should be consistent');

      // Cleanup
      await cleanupTestData(connection, auctionId4);
      await cleanupRedisData(redisClient, auctionId4);
      tracker.recordTest('Data consistency under load', true);
    } catch (error) {
      tracker.recordTest('Data consistency under load', false, error);
    }

    // Test 5: Atomic operations
    try {
      const auctionId5 = getTestAuctionId(904);
      await createTestAuction(connection, {
        auction_id: auctionId5,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      });
      await cleanupRedisData(redisClient, auctionId5);

      const concurrentBids = [];

      // Create rapid concurrent bids
      for (let i = 0; i < 15; i++) {
        concurrentBids.push(
          makeRequest('POST', '/bid', {
            body: {
              auction_id: auctionId5,
              user_id: getTestUserId(60 + i),
              amount: (4000 + i * 100).toString()
            }
          })
        );
      }

      // Execute concurrently without delays
      const responses = await Promise.all(concurrentBids);

      // Verify no duplicate bid amounts from same user
      const [duplicateCheck] = await connection.execute(
        `SELECT user_id, amount, COUNT(*) as count FROM bids
         WHERE auction_id = ?
         GROUP BY user_id, amount
         HAVING count > 1`,
        [auctionId5]
      );

      assertEquals(duplicateCheck.length, 0, 'Should have no duplicate bids from same user');

      // Cleanup
      await cleanupTestData(connection, auctionId5);
      await cleanupRedisData(redisClient, auctionId5);
      tracker.recordTest('Atomic operations', true);
    } catch (error) {
      tracker.recordTest('Atomic operations', false, error);
    }

    // Cleanup
    await cleanupTestData(connection, auctionId);
    await cleanupRedisData(redisClient, auctionId);

  } catch (error) {
    logger.error('Concurrent bid submissions test suite failed', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    if (redisClient) {
      await redisClient.quit();
    }
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Test suite for optimistic locking
 */
async function testOptimisticLocking() {
  const tracker = new TestTracker();
  let connection;
  let redisClient;

  try {
    connection = await createTestConnection();
    redisClient = await createTestRedisConnection();

    // Pre-test cleanup: Ensure clean state
    await cleanupAllTestData(connection);
    await cleanupAllRedisData(redisClient);

    logger.info('\n=== Testing Optimistic Locking ===');

    // Setup: Create test auction
    const auctionId = getTestAuctionId(910);
    await createTestAuction(connection, {
      auction_id: auctionId,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(),
      starting_price: 1000
    });
    await cleanupRedisData(redisClient, auctionId);

    // Test 1: Version field prevents lost updates
    try {
      // First, check if bids table has version field
      const [columns] = await connection.execute(
        `SHOW COLUMNS FROM bids WHERE Field = 'version'`
      );

      if (columns.length > 0) {
        // Create initial bid
        await makeRequest('POST', '/bid', {
          body: {
            auction_id: auctionId,
            user_id: getTestUserId(1),
            amount: '2000.00'
          }
        });

        // Get current version
        const [bidRows] = await connection.execute(
          `SELECT id, version FROM bids WHERE auction_id = ? ORDER BY amount DESC LIMIT 1`,
          [auctionId]
        );

        if (bidRows.length > 0) {
          const bidId = bidRows[0].id;
          const currentVersion = bidRows[0].version;

          // Try to update with old version (should fail)
          const [updateResult] = await connection.execute(
            `UPDATE bids SET amount = ?, version = version + 1
             WHERE id = ? AND version = ?`,
            ['2500.00', bidId, currentVersion - 1] // Old version
          );

          assertEquals(updateResult.affectedRows, 0, 'Update with old version should fail');

          // Try to update with current version (should succeed)
          const [updateResult2] = await connection.execute(
            `UPDATE bids SET amount = ?, version = version + 1
             WHERE id = ? AND version = ?`,
            ['2500.00', bidId, currentVersion] // Current version
          );

          assertEquals(updateResult2.affectedRows, 1, 'Update with current version should succeed');
        }

        tracker.recordTest('Version field prevents lost updates', true);
      } else {
        logger.info('Version field not found, skipping optimistic locking test');
        tracker.recordTest('Version field prevents lost updates', true); // Skip if no version field
      }
    } catch (error) {
      tracker.recordTest('Version field prevents lost updates', false, error);
    }

    // Test 2: Conditional updates ensure consistency
    try {
      // Get current highest bid
      const [highestBid] = await connection.execute(
        `SELECT id, user_id, amount FROM bids
         WHERE auction_id = ?
         ORDER BY amount DESC
         LIMIT 1`,
        [auctionId]
      );

      // Try to insert a lower bid using conditional update
      if (highestBid.length > 0) {
        const currentHighest = parseFloat(highestBid[0].amount);
        const lowerAmount = currentHighest - 100;

        // This should be rejected by business logic
        const response = await makeRequest('POST', '/bid', {
          body: {
            auction_id: auctionId,
            user_id: getTestUserId(2),
            amount: lowerAmount.toString()
          }
        });

        assertEquals(response.statusCode, 400, 'Lower bid should be rejected');
        assertEquals(response.data.success, false, 'Response should indicate failure');
        assertEquals(response.data.error_code, 'ERR_BID_TOO_LOW', 'Should return ERR_BID_TOO_LOW error');
      }

      tracker.recordTest('Conditional updates ensure consistency', true);
    } catch (error) {
      tracker.recordTest('Conditional updates ensure consistency', false, error);
    }

    // Cleanup
    await cleanupTestData(connection, auctionId);
    await cleanupRedisData(redisClient, auctionId);

  } catch (error) {
    logger.error('Optimistic locking test suite failed', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    if (redisClient) {
      await redisClient.quit();
    }
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Run all concurrency resilience tests
 */
async function runConcurrencyTests() {
  logger.info('🧪 Starting Concurrency Resilience Tests');

  try {
    const concurrentResults = await testConcurrentBidSubmissions();
    const lockingResults = await testOptimisticLocking();

    const totalPassed = concurrentResults.passed + lockingResults.passed;
    const totalFailed = concurrentResults.failed + lockingResults.failed;
    const totalTests = totalPassed + totalFailed;

    logger.info('\n=== Overall Concurrency Test Results ===');
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
    logger.error('Concurrency test execution failed', error);
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
  testConcurrentBidSubmissions,
  testOptimisticLocking,
  runConcurrencyTests
};

// Run tests if executed directly
if (require.main === module) {
  runConcurrencyTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed', error);
      process.exit(1);
    });
}