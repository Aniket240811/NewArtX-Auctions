/**
 * Integration Tests - Database
 * Tests for MySQL connection and basic database operations
 */

const { createTestConnection, createTestAuction, createTestBid, getHighestBid, getAuctionBids, cleanupTestData, assert, assertEquals, TestTracker, sleep, formatMySQLDateTime } = require('../helpers/test-helpers');
const { TEST_CONFIG, getTestAuctionId, getTestUserId } = require('../helpers/test-config');
const logger = require('../../src/utils/logger');

/**
 * Test suite for database connection
 */
async function testDatabaseConnection() {
  const tracker = new TestTracker();
  logger.info('\n=== Testing Database Connection ===');

  // Test 1: Basic connection establishment
  try {
    const connection = await createTestConnection();
    assert(connection !== null, 'Should create database connection');

    await connection.end();
    tracker.recordTest('Database connection establishment', true);
  } catch (error) {
    tracker.recordTest('Database connection establishment', false, error);
  }

  // Test 2: Connection with proper authentication
  try {
    const connection = await createTestConnection();

    // Test a simple query
    const [rows] = await connection.execute('SELECT 1 as test');
    assertEquals(rows.length, 1, 'Query should return one row');
    assertEquals(rows[0].test, 1, 'Query should return correct result');

    await connection.end();
    tracker.recordTest('Database query execution', true);
  } catch (error) {
    tracker.recordTest('Database query execution', false, error);
  }

  // Test 3: Database exists and is accessible
  try {
    const connection = await createTestConnection();

    const [rows] = await connection.execute(
      `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [TEST_CONFIG.DATABASE.DATABASE]
    );

    assert(rows.length > 0, `Database ${TEST_CONFIG.DATABASE.DATABASE} should exist`);

    await connection.end();
    tracker.recordTest('Database accessibility', true);
  } catch (error) {
    tracker.recordTest('Database accessibility', false, error);
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Test suite for auction operations
 */
async function testAuctionOperations() {
  const tracker = new TestTracker();
  let connection;

  try {
    connection = await createTestConnection();
    logger.info('\n=== Testing Auction Operations ===');

    // Test 1: Create auction
    try {
      const auctionId = getTestAuctionId(1);
      const auctionData = {
        auction_id: auctionId,
        start_time: new Date(Date.now() - 86400000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        starting_price: 1000
      };

      const createdId = await createTestAuction(connection, auctionData);
      assertEquals(createdId, auctionId, 'Created auction ID should match requested ID');

      tracker.recordTest('Create auction', true);
    } catch (error) {
      tracker.recordTest('Create auction', false, error);
    }

    // Test 2: Read auction
    try {
      const auctionId = getTestAuctionId(1);

      const [rows] = await connection.execute(
        'SELECT id, start_time, end_time, starting_price FROM auctions WHERE id = ?',
        [auctionId]
      );

      assert(rows.length === 1, 'Should retrieve created auction');
      assertEquals(rows[0].id, auctionId, 'Auction ID should match');
      assertEquals(parseFloat(rows[0].starting_price), 1000, 'Starting price should match');

      tracker.recordTest('Read auction', true);
    } catch (error) {
      tracker.recordTest('Read auction', false, error);
    }

    // Test 3: Create multiple auctions
    try {
      const auctionIds = [getTestAuctionId(2), getTestAuctionId(3), getTestAuctionId(4)];

      for (const auctionId of auctionIds) {
        await createTestAuction(connection, {
          auction_id: auctionId,
          start_time: new Date(Date.now() - 86400000).toISOString(),
          end_time: new Date(Date.now() + 86400000).toISOString()
        });
      }

      const [rows] = await connection.execute(
        'SELECT id FROM auctions WHERE id IN (?, ?, ?)',
        auctionIds
      );

      assertEquals(rows.length, 3, 'Should retrieve all created auctions');

      tracker.recordTest('Create multiple auctions', true);
    } catch (error) {
      tracker.recordTest('Create multiple auctions', false, error);
    }

    // Test 4: Update auction
    try {
      const auctionId = getTestAuctionId(1);
      const newEndTime = formatMySQLDateTime(new Date(Date.now() + 172800000)); // 2 days from now

      await connection.execute(
        'UPDATE auctions SET end_time = ? WHERE id = ?',
        [newEndTime, auctionId]
      );

      const [rows] = await connection.execute(
        'SELECT end_time FROM auctions WHERE id = ?',
        [auctionId]
      );

      assertEquals(rows.length, 1, 'Should retrieve updated auction');

      tracker.recordTest('Update auction', true);
    } catch (error) {
      tracker.recordTest('Update auction', false, error);
    }

    // Cleanup
    for (let i = 1; i <= 4; i++) {
      await cleanupTestData(connection, getTestAuctionId(i));
    }

  } catch (error) {
    logger.error('Auction operations test suite failed', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Test suite for bid operations
 */
async function testBidOperations() {
  const tracker = new TestTracker();
  let connection;

  try {
    connection = await createTestConnection();
    logger.info('\n=== Testing Bid Operations ===');

    // Setup: Create test auction
    const auctionId = getTestAuctionId(10);
    await createTestAuction(connection, {
      auction_id: auctionId,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString(),
      starting_price: 1000
    });

    // Test 1: Create bid
    try {
      const bidId = await createTestBid(connection, {
        auction_id: auctionId,
        user_id: getTestUserId(1),
        amount: 1500.00
      });

      assert(bidId > 0, 'Should create bid with valid ID');

      tracker.recordTest('Create bid', true);
    } catch (error) {
      tracker.recordTest('Create bid', false, error);
    }

    // Test 2: Read bid
    try {
      const [rows] = await connection.execute(
        'SELECT id, auction_id, user_id, amount FROM bids WHERE auction_id = ?',
        [auctionId]
      );

      assert(rows.length > 0, 'Should retrieve created bid');
      assertEquals(rows[0].auction_id, auctionId, 'Auction ID should match');
      assertEquals(parseFloat(rows[0].amount), 1500.00, 'Amount should match');

      tracker.recordTest('Read bid', true);
    } catch (error) {
      tracker.recordTest('Read bid', false, error);
    }

    // Test 3: Create multiple bids
    try {
      await createTestBid(connection, {
        auction_id: auctionId,
        user_id: getTestUserId(2),
        amount: 2000.00
      });

      await createTestBid(connection, {
        auction_id: auctionId,
        user_id: getTestUserId(3),
        amount: 2500.00
      });

      const [rows] = await connection.execute(
        'SELECT COUNT(*) as count FROM bids WHERE auction_id = ?',
        [auctionId]
      );

      assertEquals(rows[0].count, 3, 'Should have 3 bids total');

      tracker.recordTest('Create multiple bids', true);
    } catch (error) {
      tracker.recordTest('Create multiple bids', false, error);
    }

    // Test 4: Get highest bid
    try {
      const highestBid = await getHighestBid(connection, auctionId);

      assert(highestBid !== null, 'Should retrieve highest bid');
      assertEquals(parseFloat(highestBid.amount), 2500.00, 'Highest amount should be 2500.00');
      assertEquals(highestBid.user_id, getTestUserId(3), 'Highest bid should be from user 3');

      tracker.recordTest('Get highest bid', true);
    } catch (error) {
      tracker.recordTest('Get highest bid', false, error);
    }

    // Test 5: Get all bids ordered
    try {
      const allBids = await getAuctionBids(connection, auctionId);

      assertEquals(allBids.length, 3, 'Should retrieve all 3 bids');
      assertEquals(parseFloat(allBids[0].amount), 2500.00, 'First bid should be highest');
      assertEquals(parseFloat(allBids[2].amount), 1500.00, 'Last bid should be lowest');

      tracker.recordTest('Get ordered bids', true);
    } catch (error) {
      tracker.recordTest('Get ordered bids', false, error);
    }

    // Test 6: Bid with request_id
    try {
      const requestId = 'test-request-' + Date.now();
      const bidId = await createTestBid(connection, {
        auction_id: auctionId,
        user_id: getTestUserId(4),
        amount: 3000.00,
        request_id: requestId
      });

      const [rows] = await connection.execute(
        'SELECT request_id FROM bids WHERE id = ?',
        [bidId]
      );

      assertEquals(rows[0].request_id, requestId, 'Request ID should match');

      tracker.recordTest('Bid with request_id', true);
    } catch (error) {
      tracker.recordTest('Bid with request_id', false, error);
    }

    // Cleanup
    await cleanupTestData(connection, auctionId);

  } catch (error) {
    logger.error('Bid operations test suite failed', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Test suite for transaction handling
 */
async function testTransactionHandling() {
  const tracker = new TestTracker();
  let connection;

  try {
    connection = await createTestConnection();
    logger.info('\n=== Testing Transaction Handling ===');

    // Setup: Create test auction
    const auctionId = getTestAuctionId(20);
    await createTestAuction(connection, {
      auction_id: auctionId,
      start_time: new Date(Date.now() - 86400000).toISOString(),
      end_time: new Date(Date.now() + 86400000).toISOString()
    });

    // Test 1: Successful transaction
    try {
      await connection.beginTransaction();

      await createTestBid(connection, {
        auction_id: auctionId,
        user_id: getTestUserId(1),
        amount: 1500.00
      });

      await createTestBid(connection, {
        auction_id: auctionId,
        user_id: getTestUserId(2),
        amount: 2000.00
      });

      await connection.commit();

      const [rows] = await connection.execute(
        'SELECT COUNT(*) as count FROM bids WHERE auction_id = ?',
        [auctionId]
      );

      assertEquals(rows[0].count, 2, 'Should have both bids after commit');

      tracker.recordTest('Successful transaction', true);
    } catch (error) {
      await connection.rollback();
      tracker.recordTest('Successful transaction', false, error);
    }

    // Test 2: Failed transaction rollback
    try {
      await connection.beginTransaction();

      await createTestBid(connection, {
        auction_id: auctionId,
        user_id: getTestUserId(3),
        amount: 2500.00
      });

      // Simulate error
      throw new Error('Simulated error for rollback');

    } catch (error) {
      await connection.rollback();

      const [rows] = await connection.execute(
        'SELECT COUNT(*) as count FROM bids WHERE auction_id = ? AND user_id = ?',
        [auctionId, getTestUserId(3)]
      );

      assertEquals(rows[0].count, 0, 'Should have no bids after rollback');
      tracker.recordTest('Failed transaction rollback', true);
    }

    // Cleanup
    await cleanupTestData(connection, auctionId);

  } catch (error) {
    logger.error('Transaction handling test suite failed', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Run all database integration tests
 */
async function runDatabaseTests() {
  logger.info('🧪 Starting Database Integration Tests');

  try {
    const connectionResults = await testDatabaseConnection();
    const auctionResults = await testAuctionOperations();
    const bidResults = await testBidOperations();
    const transactionResults = await testTransactionHandling();

    const totalPassed = connectionResults.passed + auctionResults.passed +
                       bidResults.passed + transactionResults.passed;
    const totalFailed = connectionResults.failed + auctionResults.failed +
                       bidResults.failed + transactionResults.failed;
    const totalTests = totalPassed + totalFailed;

    logger.info('\n=== Overall Database Test Results ===');
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
    logger.error('Database test execution failed', error);
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
  testDatabaseConnection,
  testAuctionOperations,
  testBidOperations,
  testTransactionHandling,
  runDatabaseTests
};

// Run tests if executed directly
if (require.main === module) {
  runDatabaseTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed', error);
      process.exit(1);
    });
}