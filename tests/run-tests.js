/**
 * Main Test Runner
 * Orchestrates execution of all test suites with proper reporting
 * Includes automatic server lifecycle management for HTTP-based tests
 */

const { runValidatorTests } = require('./unit/validators.test');
const { runLoggerTests } = require('./unit/logger.test');
const { runDatabaseTests } = require('./integration/database.test');
const { runRedisTests } = require('./integration/redis.test');
const { runBidValidationTests } = require('./logic/bid_validation.test');
const { runIdempotencyTests } = require('./logic/idempotency.test');
const { runCacheExpirationTests } = require('./resilience/cache_expiration.test');
const { runConcurrencyTests } = require('./resilience/concurrency.test');
const logger = require('../src/utils/logger');
const http = require('http');
const path = require('path');

let testServer = null;
let isServerOwnedByTests = false;

/**
 * Check if server is already running on port 3000
 * @returns {Promise<boolean>} True if server is running
 */
async function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve(true);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Start test server if not already running
 * @returns {Promise<void>}
 */
async function ensureServerRunning() {
  const serverRunning = await isServerRunning();

  if (serverRunning) {
    logger.info('✓ Server already running on port 3000');
    return;
  }

  logger.info('Starting test server...');

  // Load and start the server
  try {
    // Clear require cache to ensure fresh server start
    delete require.cache[require.resolve('../src/index')];

    // Start the server in background
    const serverPath = path.join(__dirname, '../src/index.js');
    testServer = require('child_process').spawn('node', [serverPath], {
      stdio: 'ignore',
      detached: true
    });

    testServer.unref();
    isServerOwnedByTests = true;

    // Wait for server to be ready
    let retries = 0;
    while (retries < 30) { // Wait up to 15 seconds
      await new Promise(resolve => setTimeout(resolve, 500));
      const isUp = await isServerRunning();
      if (isUp) {
        logger.info('✓ Test server started successfully');
        return;
      }
      retries++;
    }

    throw new Error('Server failed to start within timeout period');

  } catch (error) {
    logger.error('Failed to start test server', error);
    throw error;
  }
}

/**
 * Stop test server if we started it
 * @returns {Promise<void>}
 */
async function stopTestServer() {
  if (isServerOwnedByTests && testServer) {
    logger.info('Stopping test server...');
    try {
      testServer.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      testServer.kill('SIGKILL');
      isServerOwnedByTests = false;
      logger.info('✓ Test server stopped');
    } catch (error) {
      logger.error('Error stopping test server', error);
    }
  }
}

/**
 * Test suite configuration
 */
const TEST_SUITES = [
  {
    name: 'Unit Tests - Validators',
    category: 'unit',
    run: runValidatorTests,
    required: true
  },
  {
    name: 'Unit Tests - Logger',
    category: 'unit',
    run: runLoggerTests,
    required: true
  },
  {
    name: 'Integration Tests - Database',
    category: 'integration',
    run: runDatabaseTests,
    required: true
  },
  {
    name: 'Integration Tests - Redis',
    category: 'integration',
    run: runRedisTests,
    required: true
  },
  {
    name: 'Logic Tests - Bid Validation',
    category: 'logic',
    run: runBidValidationTests,
    required: true
  },
  {
    name: 'Logic Tests - Idempotency',
    category: 'logic',
    run: runIdempotencyTests,
    required: true
  },
  {
    name: 'Resilience Tests - Cache Expiration',
    category: 'resilience',
    run: runCacheExpirationTests,
    required: false
  },
  {
    name: 'Resilience Tests - Concurrency',
    category: 'resilience',
    run: runConcurrencyTests,
    required: false
  }
];

/**
 * Run specific test suites by category
 * @param {string} category - Test category to run (unit, integration, logic, resilience, all)
 * @param {object} options - Test execution options
 * @returns {Promise<object>} Overall test results
 */
async function runTestsByCategory(category = 'all', options = {}) {
  const { stopOnFailure = false, verbose = false } = options;

  logger.info('\n╔════════════════════════════════════════════════════════════════╗');
  logger.info('║           🧪 AUCTION PLATFORM TEST SUITE 🧪                   ║');
  logger.info('╚════════════════════════════════════════════════════════════════╝');

  // Start server before HTTP-based tests (logic, resilience)
  const needsServer = category === 'all' || category === 'logic' || category === 'resilience';
  if (needsServer) {
    try {
      await ensureServerRunning();
    } catch (error) {
      logger.error('Failed to start server for HTTP tests', error);
      return {
        total: 0,
        passed: 0,
        failed: 1,
        success: false,
        message: 'Server startup failed'
      };
    }
  }

  const suitesToRun = category === 'all'
    ? TEST_SUITES
    : TEST_SUITES.filter(suite => suite.category === category);

  if (suitesToRun.length === 0) {
    logger.error(`No test suites found for category: ${category}`);
    return {
      total: 0,
      passed: 0,
      failed: 0,
      success: false,
      message: `No test suites found for category: ${category}`
    };
  }

  logger.info(`\n📋 Running ${suitesToRun.length} test suite(s) for category: ${category}`);
  logger.info('━'.repeat(60));

  const overallResults = {
    total: 0,
    passed: 0,
    failed: 0,
    suites: [],
    startTime: Date.now(),
    endTime: null
  };

  for (const suite of suitesToRun) {
    const suiteStartTime = Date.now();
    logger.info(`\n🔍 Running: ${suite.name}`);

    try {
      const results = await suite.run();
      const suiteDuration = Date.now() - suiteStartTime;

      overallResults.total += results.total;
      overallResults.passed += results.passed;
      overallResults.failed += results.failed;

      overallResults.suites.push({
        name: suite.name,
        category: suite.category,
        ...results,
        duration: suiteDuration,
        success: results.failed === 0
      });

      logger.info(`✅ Completed: ${suite.name} (${suiteDuration}ms)`);

      // Stop if this suite failed and stopOnFailure is enabled
      if (!results.success && stopOnFailure && suite.required) {
        logger.error(`❌ Stopping tests due to failure in required suite: ${suite.name}`);
        break;
      }

    } catch (error) {
      const suiteDuration = Date.now() - suiteStartTime;
      logger.error(`❌ Failed to execute suite: ${suite.name}`, error);

      overallResults.failed += 1;
      overallResults.suites.push({
        name: suite.name,
        category: suite.category,
        total: 0,
        passed: 0,
        failed: 1,
        duration: suiteDuration,
        success: false,
        error: error.message
      });

      if (stopOnFailure && suite.required) {
        logger.error(`❌ Stopping tests due to execution error in required suite: ${suite.name}`);
        break;
      }
    }
  }

  overallResults.endTime = Date.now();
  overallResults.totalDuration = overallResults.endTime - overallResults.startTime;
  overallResults.success = overallResults.failed === 0;

  // Cleanup server if we started it
  if (needsServer) {
    await stopTestServer();
  }

  return overallResults;
}

/**
 * Print comprehensive test results
 * @param {object} results - Test results object
 */
function printTestResults(results) {
  logger.info('\n╔════════════════════════════════════════════════════════════════╗');
  logger.info('║                   📊 TEST RESULTS SUMMARY 📊                   ║');
  logger.info('╚════════════════════════════════════════════════════════════════╝');

  logger.info(`\n⏱️  Total Duration: ${(results.totalDuration / 1000).toFixed(2)}s`);
  logger.info(`📈 Total Tests: ${results.total}`);
  logger.info(`✅ Passed: ${results.passed} (${((results.passed / results.total) * 100).toFixed(1)}%)`);
  logger.info(`❌ Failed: ${results.failed} (${((results.failed / results.total) * 100).toFixed(1)}%)`);

  logger.info('\n📋 Suite Results:');
  logger.info('━'.repeat(60));

  for (const suite of results.suites) {
    const status = suite.success ? '✅' : '❌';
    const passRate = suite.total > 0 ? ((suite.passed / suite.total) * 100).toFixed(1) : '0.0';
    logger.info(`${status} ${suite.name}`);
    logger.info(`   Tests: ${suite.passed}/${suite.total} (${passRate}%) - Duration: ${suite.duration}ms`);

    if (!suite.success && suite.error) {
      logger.error(`   Error: ${suite.error}`);
    }
  }

  logger.info('━'.repeat(60));

  // Final verdict
  if (results.success) {
    logger.info('\n🎉 ALL TESTS PASSED! 🎉');
    logger.info('✨ The auction platform is working correctly! ✨');
  } else {
    logger.info('\n⚠️  SOME TESTS FAILED ⚠️');
    logger.info('🔧 Please review the failed tests above and fix the issues.');
  }

  logger.info('╔════════════════════════════════════════════════════════════════╗');
  logger.info('║                   END OF TEST RESULTS                          ║');
  logger.info('╚════════════════════════════════════════════════════════════════╝\n');
}

/**
 * Main execution function
 * @param {Array} args - Command line arguments
 */
async function main(args) {
  let serverStarted = false;

  try {
    // Parse command line arguments
    const category = args[0] || 'all';
    const stopOnFailure = args.includes('--stop-on-failure') || args.includes('-s');
    const verbose = args.includes('--verbose') || args.includes('-v');

    const options = {
      stopOnFailure,
      verbose
    };

    // Determine if server is needed
    const needsServer = category === 'all' || category === 'logic' || category === 'resilience';
    if (needsServer) {
      await ensureServerRunning();
      serverStarted = true;
    }

    // Run tests
    const results = await runTestsByCategory(category, options);

    // Print results
    printTestResults(results);

    // Cleanup server if we started it
    if (serverStarted) {
      await stopTestServer();
    }

    // Exit with appropriate code
    process.exit(results.success ? 0 : 1);

  } catch (error) {
    logger.error('💥 Fatal error during test execution', error);

    // Cleanup server on error
    if (serverStarted) {
      await stopTestServer();
    }

    process.exit(1);
  }
}

// Export main functions
module.exports = {
  runTestsByCategory,
  printTestResults,
  main
};

// Run tests if executed directly
if (require.main === module) {
  main(process.argv.slice(2));
}