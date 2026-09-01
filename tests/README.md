# 🧪 Professional Test Suite

A comprehensive, production-grade test suite for the NewArtX auction platform.

## 📁 Test Structure

```
tests/
├── helpers/              # Test utilities and configuration
│   ├── test-config.js    # Centralized test configuration
│   └── test-helpers.js   # Common test utilities and assertions
├── unit/                 # Unit tests (isolated component testing)
│   ├── validators.test.js # Joi validator tests
│   └── logger.test.js    # Logger functionality tests
├── integration/          # Integration tests (database/cache integration)
│   ├── database.test.js  # MySQL connection and operations
│   └── redis.test.js     # Redis connection and operations
├── logic/                # Business logic tests (auction rules)
│   ├── bid_validation.test.js  # Bid validation and auction rules
│   └── idempotency.test.js     # Network retry and idempotency
├── resilience/           # Resilience tests (advanced scenarios)
│   ├── cache_expiration.test.js # Cache TTL and MySQL fallback
│   └── concurrency.test.js      # Concurrent bid handling
├── run-tests.js          # Main test runner and orchestrator
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js installed
- MySQL running with `NewArtX` database
- Redis running on default port
- Environment configured in `environments/prod/.env`

### Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit          # Unit tests only
npm run test:integration  # Integration tests only
npm run test:logic        # Business logic tests only
npm run test:resilience   # Resilience tests only

# Run with verbose output
npm run test:verbose

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch
```

### Test Categories

#### 🧪 Unit Tests
Test individual components in isolation:
- **Validators**: Joi schema validation for POST/GET requests
- **Logger**: Centralized logging functionality
- **Fast execution**: No external dependencies

#### 🔗 Integration Tests
Test database and cache integration:
- **Database**: MySQL connections, transactions, CRUD operations
- **Redis**: Cache operations, TTL, key management
- **Real connections**: Tests against live MySQL/Redis instances

#### 🧠 Logic Tests
Test auction business rules and logic:
- **Bid Validation**: Amount validation, auction states, user rules
- **Idempotency**: Network retry handling, request deduplication
- **Business rules**: Self-bidding prevention, closed auctions

#### 🛡️ Resilience Tests
Test advanced system resilience scenarios:
- **Cache Expiration**: Redis TTL, MySQL fallback safety nets
- **Concurrency**: Race conditions, atomic operations, data consistency
- **Advanced scenarios**: High-speed concurrent bids, cache failures

## 📊 Test Coverage

### Current Test Coverage

| Category | Test Files | Test Scenarios | Status |
|----------|-----------|---------------|---------|
| Unit | 2 files | 15+ scenarios | ✅ Complete |
| Integration | 2 files | 12+ scenarios | ✅ Complete |
| Logic | 2 files | 20+ scenarios | ✅ Complete |
| Resilience | 2 files | 10+ scenarios | ✅ Complete |

**Total**: 8 test files, 57+ test scenarios

### Test Scenarios Covered

#### Unit Tests ✅
- ✅ POST bid request validation (valid/invalid formats)
- ✅ GET bid request validation (filters, ranges)
- ✅ Logger methods (debug, info, error)
- ✅ Timestamp formats and metadata handling

#### Integration Tests ✅
- ✅ MySQL connection and authentication
- ✅ Database CRUD operations (auctions, bids)
- ✅ Transaction handling (commit/rollback)
- ✅ Redis connection and basic operations
- ✅ Auction-specific Redis operations
- ✅ TTL and cache management

#### Logic Tests ✅
- ✅ Bid amount validation (too low, equal amounts)
- ✅ Auction state rules (active, closed, future)
- ✅ User-specific rules (self-bidding prevention)
- ✅ Request idempotency and deduplication
- ✅ Network retry scenarios
- ✅ Concurrent request handling

#### Resilience Tests ✅
- ✅ Redis cache expiration behavior
- ✅ MySQL fallback when cache fails
- ✅ Conditional update safety mechanisms
- ✅ Concurrent bid submissions
- ✅ Race condition handling
- ✅ Data consistency under load

## 🛠️ Test Architecture

### Test Helpers

#### `test-config.js`
Centralized test configuration:
- Server, database, and Redis connection settings
- Test data generators (IDs, amounts, timestamps)
- Test timeouts and execution settings

#### `test-helpers.js`
Common test utilities:
- HTTP request helpers (`makeRequest`)
- Database helpers (`createTestConnection`, `createTestAuction`)
- Assertion utilities (`assert`, `assertEquals`, `assertThrows`)
- Test tracking and reporting (`TestTracker`)

### Test Organization

Each test file follows this structure:

```javascript
/**
 * Test suite for [feature/component]
 * Tests for [description]
 */

// Dependencies
const { helperFunctions } = require('../helpers/test-helpers');

/**
 * Test suite for [specific scenario]
 */
async function testSpecificScenario() {
  const tracker = new TestTracker();
  
  try {
    // Test setup
    // Test execution
    // Test assertions
    
    tracker.recordTest('Test name', true);
  } catch (error) {
    tracker.recordTest('Test name', false, error);
  }
  
  tracker.printSummary();
  return tracker.getResults();
}

/**
 * Run all tests in this file
 */
async function runTests() {
  logger.info('🧪 Starting Test Suite');
  
  const results1 = await testSpecificScenario();
  const results2 = await testAnotherScenario();
  
  // Return combined results
  return { total, passed, failed, success };
}

// Export for test runner
module.exports = { testSpecificScenario, runTests };

// Run if executed directly
if (require.main === module) {
  runTests().then(results => process.exit(results.success ? 0 : 1));
}
```

## 📈 Test Execution

### Running Individual Test Files

```bash
# Run specific test file
node tests/unit/validators.test.js
node tests/integration/database.test.js
node tests/logic/bid_validation.test.js
```

### Test Output Format

```
╔════════════════════════════════════════════════════════════════╗
║           🧪 AUCTION PLATFORM TEST SUITE 🧪                   ║
╚════════════════════════════════════════════════════════════════╝

📋 Running 8 test suite(s) for category: all
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Running: Unit Tests - Validators
✅ PASSED: Valid POST bid request
✅ PASSED: Missing required field validation
...
✅ Completed: Unit Tests - Validators (234ms)

[Additional test suites...]

╔════════════════════════════════════════════════════════════════╗
║                   📊 TEST RESULTS SUMMARY 📊                   ║
╚════════════════════════════════════════════════════════════════╝

⏱️  Total Duration: 8.45s
📈 Total Tests: 57
✅ Passed: 57 (100.0%)
❌ Failed: 0 (0.0%)

📋 Suite Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Unit Tests - Validators
   Tests: 8/8 (100.0%) - Duration: 234ms

✅ Unit Tests - Logger
   Tests: 7/7 (100.0%) - Duration: 123ms

[Additional suite results...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 ALL TESTS PASSED! 🎉
✨ The auction platform is working correctly! ✨

╔════════════════════════════════════════════════════════════════╗
║                   END OF TEST RESULTS                          ║
╚════════════════════════════════════════════════════════════════╝
```

## 🔧 Configuration

### Environment Variables

Tests use the same environment as the main application:
- `SERVER_HOST`, `SERVER_PORT` - Server configuration
- `DB_WRITE_HOST`, `DB_READ_HOST` - Database connections
- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `DB_USER`, `DB_PASSWORD` - Database authentication

### Test Configuration

Modify test behavior in `tests/helpers/test-config.js`:
```javascript
TEST_CONFIG: {
  TEST_DATA: {
    AUCTION_ID_START: 9000,    // Starting test auction ID
    USER_ID_START: 100,        // Starting test user ID
    TIMEOUTS: {
      CONNECTION: 5000,         // Connection timeout
      OPERATION: 10000,         // Operation timeout
      CACHE_EXPIRY: 2000       // Cache expiry timeout
    }
  }
}
```

## 🚨 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Kill existing server
lsof -ti:3000 | xargs kill -9
```

#### Database Connection Issues
```bash
# Verify MySQL is running
mysql -u root -e "SELECT 1"

# Check database exists
mysql -u root -e "SHOW DATABASES LIKE 'NewArtX'"
```

#### Redis Connection Issues
```bash
# Verify Redis is running
redis-cli ping

# Check Redis connections
redis-cli client list
```

### Test Failures

#### Cleanup Test Data
```bash
# Access MySQL and clean test data
mysql -u root NewArtX
DELETE FROM bids WHERE auction_id >= 9000;
DELETE FROM auctions WHERE id >= 9000;
```

#### Clear Redis Cache
```bash
# Clear test auction keys
redis-cli
KEYS auction:9*
DEL <returned_keys>
```

## 📝 Best Practices

### Writing New Tests

1. **Use Test Helpers**: Leverage existing utilities in `test-helpers.js`
2. **Proper Cleanup**: Always clean up test data in `finally` blocks
3. **Descriptive Names**: Use clear test names that describe what's being tested
4. **Assertion Checks**: Use provided assertion functions (`assert`, `assertEquals`)
5. **Error Handling**: Wrap tests in try-catch and record results properly

### Test Organization

- **Unit Tests**: Test single functions/components in isolation
- **Integration Tests**: Test component interactions with real services
- **Logic Tests**: Test business rules and validation logic
- **Resilience Tests**: Test edge cases and failure scenarios

## 🔍 Debugging Tests

### Verbose Mode
```bash
# Run with verbose logging
LOG_LEVEL=debug npm run test:verbose
```

### Individual Test Execution
```bash
# Run specific test file for debugging
node tests/unit/validators.test.js
```

### Database Inspection
```bash
# Check test data
mysql -u root NewArtX -e "SELECT * FROM bids WHERE auction_id = 9000"
```

## 📚 Additional Resources

- **Main Application**: `src/` directory
- **Database Schema**: `scripts/setup_database.js`
- **API Documentation**: See route files in `src/routes/`
- **Constants**: `src/utils/constant.js`

## 🎯 Test Goals

This test suite ensures:

1. **✅ Functionality**: All features work as expected
2. **🔒 Reliability**: System handles edge cases gracefully
3. **⚡ Performance**: Operations complete within acceptable timeframes
4. **🛡️ Safety**: Data consistency and integrity maintained
5. **🔄 Resilience**: System recovers from failures appropriately

---

**Note**: Tests run against live MySQL and Redis instances. Ensure these services are running before executing tests.