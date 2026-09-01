/**
 * Unit Tests - Logger
 * Tests for the centralized logger functionality
 */

const logger = require('../../src/utils/logger');
const { assert, assertEquals, TestTracker } = require('../helpers/test-helpers');
const fs = require('fs');
const path = require('path');

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

/**
 * Capture console output
 */
class ConsoleCapture {
  constructor() {
    this.logs = [];
    this.errors = [];
  }

  start() {
    console.log = (...args) => this.logs.push(args.join(' '));
    console.error = (...args) => this.errors.push(args.join(' '));
  }

  stop() {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }

  getLogs() {
    return this.logs;
  }

  getErrors() {
    return this.errors;
  }

  clear() {
    this.logs = [];
    this.errors = [];
  }
}

/**
 * Test suite for Logger class
 */
async function testLogger() {
  const tracker = new TestTracker();
  const capture = new ConsoleCapture();

  logger.info('\n=== Testing Logger ===');

  // Test 1: Logger debug method
  try {
    capture.start();
    capture.clear();

    logger.debug('Test debug message', { test: 'data' });

    const logs = capture.getLogs();
    assert(logs.length > 0, 'Debug should produce console output');
    assert(logs.some(log => log.includes('Test debug message')), 'Log should contain message');
    assert(logs.some(log => log.includes('DEBUG')), 'Log should contain DEBUG level');

    capture.stop();
    tracker.recordTest('Logger debug method', true);
  } catch (error) {
    capture.stop();
    tracker.recordTest('Logger debug method', false, error);
  }

  // Test 2: Logger info method
  try {
    capture.start();
    capture.clear();

    logger.info('Test info message', { test: 'data' });

    const logs = capture.getLogs();
    assert(logs.length > 0, 'Info should produce console output');
    assert(logs.some(log => log.includes('Test info message')), 'Log should contain message');
    assert(logs.some(log => log.includes('INFO')), 'Log should contain INFO level');

    capture.stop();
    tracker.recordTest('Logger info method', true);
  } catch (error) {
    capture.stop();
    tracker.recordTest('Logger info method', false, error);
  }

  // Test 3: Logger error method with metadata
  try {
    capture.start();
    capture.clear();

    const testError = new Error('Test error');
    testError.stack = 'Error: Test error\n    at test.js:10:15';

    logger.error('Test error message', testError);

    const errors = capture.getErrors();
    assert(errors.length > 0, 'Error should produce console output');
    assert(errors.some(log => log.includes('Test error message')), 'Error should contain message');
    assert(errors.some(log => log.includes('ERROR')), 'Error should contain ERROR level');

    capture.stop();
    tracker.recordTest('Logger error method', true);
  } catch (error) {
    capture.stop();
    tracker.recordTest('Logger error method', false, error);
  }

  // Test 4: Logger error method with plain object metadata
  try {
    capture.start();
    capture.clear();

    logger.error('Test error with object', { error_code: 'TEST_ERROR', details: 'Test details' });

    const errors = capture.getErrors();
    assert(errors.length > 0, 'Error with object should produce output');
    assert(errors.some(log => log.includes('error_code')), 'Error should contain metadata');
    assert(errors.some(log => log.includes('TEST_ERROR')), 'Error should contain error code');

    capture.stop();
    tracker.recordTest('Logger error with object metadata', true);
  } catch (error) {
    capture.stop();
    tracker.recordTest('Logger error with object metadata', false, error);
  }

  // Test 5: Logger without metadata
  try {
    capture.start();
    capture.clear();

    logger.debug('Debug without metadata');
    logger.info('Info without metadata');

    const logs = capture.getLogs();
    assert(logs.length >= 2, 'Both calls should produce output');

    capture.stop();
    tracker.recordTest('Logger without metadata', true);
  } catch (error) {
    capture.stop();
    tracker.recordTest('Logger without metadata', false, error);
  }

  // Test 6: Logger timestamp format
  try {
    capture.start();
    capture.clear();

    logger.info('Timestamp test');

    const logs = capture.getLogs();
    assert(logs.length > 0, 'Should produce output');
    assert(logs.some(log => log.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)),
      'Log should contain ISO timestamp');

    capture.stop();
    tracker.recordTest('Logger ISO timestamp format', true);
  } catch (error) {
    capture.stop();
    tracker.recordTest('Logger ISO timestamp format', false, error);
  }

  // Test 7: Logger with complex metadata
  try {
    capture.start();
    capture.clear();

    const complexMetadata = {
      auction_id: 123,
      user_id: 456,
      amount: '1500.50',
      timestamp: new Date().toISOString(),
      nested: {
        field1: 'value1',
        field2: 'value2'
      }
    };

    logger.info('Complex metadata test', complexMetadata);

    const logs = capture.getLogs();
    assert(logs.length > 0, 'Should produce output');
    assert(logs.some(log => log.includes('123')), 'Should contain auction_id');
    assert(logs.some(log => log.includes('456')), 'Should contain user_id');

    capture.stop();
    tracker.recordTest('Logger with complex metadata', true);
  } catch (error) {
    capture.stop();
    tracker.recordTest('Logger with complex metadata', false, error);
  }

  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Run all logger unit tests
 */
async function runLoggerTests() {
  logger.info('🧪 Starting Logger Unit Tests');

  const results = await testLogger();

  logger.info('\n=== Overall Logger Test Results ===');
  logger.info(`Total Tests: ${results.passed + results.failed}`);
  logger.info(`Passed: ${results.passed}`);
  logger.info(`Failed: ${results.failed}`);

  return {
    total: results.passed + results.failed,
    passed: results.passed,
    failed: results.failed,
    success: results.failed === 0
  };
}

// Export for use in test runner
module.exports = {
  testLogger,
  runLoggerTests
};

// Run tests if executed directly
if (require.main === module) {
  runLoggerTests()
    .then(results => {
      process.exit(results.success ? 0 : 1);
    })
    .catch(error => {
      logger.error('Test execution failed', error);
      process.exit(1);
    });
}