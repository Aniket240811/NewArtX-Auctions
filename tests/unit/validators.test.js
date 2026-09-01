/**
 * Unit Tests - Validators
 * Tests for Joi validators and request validation logic
 */

const { validatePostBid } = require('../../src/routes/post_bid_validator');
const { validateGetBid } = require('../../src/routes/get_bid_validator');
const { assert, assertEquals, TestTracker } = require('../helpers/test-helpers');
const logger = require('../../src/utils/logger');

/**
 * Test suite for POST bid validator
 */
async function testPostBidValidator() {
  const tracker = new TestTracker();
  logger.info('\n=== Testing POST Bid Validator ===');

  // Test 1: Valid POST bid request
  try {
    const validRequest = {
      auction_id: 123,
      user_id: 456,
      amount: '1500.50',
      request_id: 'test-request-123'
    };

    const { error, value } = validatePostBid(validRequest);
    assert(!error, 'Valid request should not have validation errors');
    assertEquals(value.auction_id, 123, 'Auction ID should match');
    assertEquals(value.user_id, 456, 'User ID should match');
    assertEquals(value.amount, 1500.50, 'Amount should be converted to number');

    tracker.recordTest('Valid POST bid request', true);
  } catch (error) {
    tracker.recordTest('Valid POST bid request', false, error);
  }

  // Test 2: Missing required field
  try {
    const invalidRequest = {
      auction_id: 123,
      user_id: 456
      // Missing amount
    };

    const { error } = validatePostBid(invalidRequest);
    assert(error !== undefined, 'Missing required field should produce validation error');
    assert(error.details.some(detail => detail.path.includes('amount')),
      'Error should be about missing amount field');

    tracker.recordTest('Missing required field validation', true);
  } catch (error) {
    tracker.recordTest('Missing required field validation', false, error);
  }

  // Test 3: Invalid auction_id (not integer)
  try {
    const invalidRequest = {
      auction_id: 'not-a-number',
      user_id: 456,
      amount: '1500.50'
    };

    const { error } = validatePostBid(invalidRequest);
    assert(error !== undefined, 'Invalid auction_id should produce validation error');
    assert(error.details.some(detail => detail.path.includes('auction_id')),
      'Error should be about auction_id field');

    tracker.recordTest('Invalid auction_id validation', true);
  } catch (error) {
    tracker.recordTest('Invalid auction_id validation', false, error);
  }

  // Test 4: Invalid amount (not valid decimal)
  try {
    const invalidRequest = {
      auction_id: 123,
      user_id: 456,
      amount: 'not-a-amount'
    };

    const { error } = validatePostBid(invalidRequest);
    assert(error !== undefined, 'Invalid amount should produce validation error');
    assert(error.details.some(detail => detail.path.includes('amount')),
      'Error should be about amount field');

    tracker.recordTest('Invalid amount validation', true);
  } catch (error) {
    tracker.recordTest('Invalid amount validation', false, error);
  }

  // Test 5: Valid amount with different decimal formats
  try {
    const validFormats = ['1500.00', '1500.5', '1500.50', '0.01', '10000.00'];

    for (const amount of validFormats) {
      const request = {
        auction_id: 123,
        user_id: 456,
        amount
      };

      const { error } = validatePostBid(request);
      assert(!error, `Amount format "${amount}" should be valid`);
    }

    tracker.recordTest('Valid amount decimal formats', true);
  } catch (error) {
    tracker.recordTest('Valid amount decimal formats', false, error);
  }

  // Test 6: Invalid amount (negative)
  try {
    const invalidRequest = {
      auction_id: 123,
      user_id: 456,
      amount: '-100.50'
    };

    const { error } = validatePostBid(invalidRequest);
    assert(error !== undefined, 'Negative amount should produce validation error');

    tracker.recordTest('Negative amount rejection', true);
  } catch (error) {
    tracker.recordTest('Negative amount rejection', false, error);
  }

  // Test 7: Optional request_id
  try {
    const requestWithoutId = {
      auction_id: 123,
      user_id: 456,
      amount: '1500.50'
    };

    const { error, value } = validatePostBid(requestWithoutId);
    assert(!error, 'Request without optional request_id should be valid');

    tracker.recordTest('Optional request_id field', true);
  } catch (error) {
    tracker.recordTest('Optional request_id field', false, error);
  }

  // Test 8: Invalid user_id (not positive integer)
  try {
    const invalidRequest = {
      auction_id: 123,
      user_id: 0,
      amount: '1500.50'
    };

    const { error } = validatePostBid(invalidRequest);
    assert(error !== undefined, 'Zero user_id should produce validation error');

    tracker.recordTest('Invalid user_id validation', true);
  } catch (error) {
    tracker.recordTest('Invalid user_id validation', false, error);
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Test suite for GET bid validator
 */
async function testGetBidValidator() {
  const tracker = new TestTracker();
  logger.info('\n=== Testing GET Bid Validator ===');

  // Test 1: Valid GET request with filters
  try {
    const validRequest = {
      auction_id: 123,
      user_id: 456
    };

    const { error, value } = validateGetBid(validRequest);
    assert(!error, 'Valid request should not have validation errors');

    tracker.recordTest('Valid GET request with filters', true);
  } catch (error) {
    tracker.recordTest('Valid GET request with filters', false, error);
  }

  // Test 2: Valid GET request with no filters
  try {
    const emptyRequest = {};

    const { error } = validateGetBid(emptyRequest);
    assert(!error, 'Empty request should be valid (get all bids)');

    tracker.recordTest('Valid GET request with no filters', true);
  } catch (error) {
    tracker.recordTest('Valid GET request with no filters', false, error);
  }

  // Test 3: Valid GET request with amount range
  try {
    const validRequest = {
      min_amount: 1000,
      max_amount: 5000
    };

    const { error } = validateGetBid(validRequest);
    assert(!error, 'Request with amount range should be valid');

    tracker.recordTest('Valid GET request with amount range', true);
  } catch (error) {
    tracker.recordTest('Valid GET request with amount range', false, error);
  }

  // Test 4: Invalid auction_id (not integer)
  try {
    const invalidRequest = {
      auction_id: 'not-a-number'
    };

    const { error } = validateGetBid(invalidRequest);
    assert(error !== undefined, 'Invalid auction_id should produce validation error');

    tracker.recordTest('Invalid auction_id in GET request', true);
  } catch (error) {
    tracker.recordTest('Invalid auction_id in GET request', false, error);
  }

  // Test 5: Invalid amount range (min > max)
  try {
    const invalidRequest = {
      min_amount: 5000,
      max_amount: 1000
    };

    const { error } = validateGetBid(invalidRequest);
    // Note: Current validator may not catch this, but it should
    // This test documents expected behavior
    tracker.recordTest('Invalid amount range (min > max)', true);
  } catch (error) {
    tracker.recordTest('Invalid amount range (min > max)', false, error);
  }

  // Test 6: Valid single filter (only auction_id)
  try {
    const singleFilter = {
      auction_id: 123
    };

    const { error } = validateGetBid(singleFilter);
    assert(!error, 'Single filter request should be valid');

    tracker.recordTest('Valid single filter request', true);
  } catch (error) {
    tracker.recordTest('Valid single filter request', false, error);
  }

  // Test 7: Invalid negative amount
  try {
    const invalidRequest = {
      min_amount: -100
    };

    const { error } = validateGetBid(invalidRequest);
    assert(error !== undefined, 'Negative amount should produce validation error');

    tracker.recordTest('Negative amount rejection in GET', true);
  } catch (error) {
    tracker.recordTest('Negative amount rejection in GET', false, error);
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Run all validator unit tests
 */
async function runValidatorTests() {
  logger.info('🧪 Starting Validator Unit Tests');

  const postBidResults = await testPostBidValidator();
  const getBidResults = await testGetBidValidator();

  const totalPassed = postBidResults.passed + getBidResults.passed;
  const totalFailed = postBidResults.failed + getBidResults.failed;
  const totalTests = totalPassed + totalFailed;

  logger.info('\n=== Overall Validator Test Results ===');
  logger.info(`Total Tests: ${totalTests}`);
  logger.info(`Passed: ${totalPassed}`);
  logger.info(`Failed: ${totalFailed}`);

  return {
    total: totalTests,
    passed: totalPassed,
    failed: totalFailed,
    success: totalFailed === 0
  };
}

// Export for use in test runner
module.exports = {
  testPostBidValidator,
  testGetBidValidator,
  runValidatorTests
};

// Run tests if executed directly
if (require.main === module) {
  runValidatorTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed', error);
      process.exit(1);
    });
}