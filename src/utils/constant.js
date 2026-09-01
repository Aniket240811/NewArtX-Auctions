/**
 * HTTP Status Codes
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500
};

/**
 * Standard Error Codes
 */
const ERROR_CODES = {
  VALIDATION: 'ERR_VALIDATION',
  AUCTION_CLOSED: 'ERR_AUCTION_CLOSED',
  AUCTION_NOT_FOUND: 'ERR_AUCTION_NOT_FOUND',
  BID_TOO_LOW: 'ERR_BID_TOO_LOW',
  ALREADY_TOP_BIDDER: 'ERR_ALREADY_TOP_BIDDER',
  CONCURRENCY: 'ERR_CONCURRENCY',
  NETWORK_RETRY: 'ERR_NETWORK_RETRY',
  SYSTEM: 'ERR_SYSTEM',
  DATABASE: 'ERR_DATABASE',
  REDIS: 'ERR_REDIS',
  INVALID_AMOUNT: 'ERR_INVALID_AMOUNT'
};

/**
 * Response/Error Messages
 */
const MESSAGES = {
  // Success messages
  BID_PLACED: 'Bid placed successfully',
  AUCTION_RETRIEVED: 'Auction retrieved successfully',
  BIDS_RETRIEVED: 'Bids retrieved successfully',

  // Validation errors
  BID_TOO_LOW: 'Bid must be strictly higher than current top bid',
  AUCTION_CLOSED: 'Auction is closed',
  ALREADY_TOP_BIDDER: 'You are already the top bidder',
  CONCURRENCY_COLLISION: 'Concurrency collision, please retry',
  INVALID_BID_AMOUNT: 'Bid amount must be greater than starting price',
  AUCTION_NOT_FOUND: 'Auction not found',
  DUPLICATE_REQUEST_ID: 'Duplicate request ID detected',
  INVALID_AUCTION_ID: 'Invalid auction ID',
  INVALID_USER_ID: 'Invalid user ID',
  INVALID_REQUEST_ID: 'Invalid request ID',
  REQUEST_ID_REQUIRED: 'Request ID is required',
  AMOUNT_REQUIRED: 'Bid amount is required',
  AUCTION_ID_REQUIRED: 'Auction ID is required',
  USER_ID_REQUIRED: 'User ID is required',

  // System errors
  DATABASE_ERROR: 'Database operation failed',
  REDIS_ERROR: 'Redis operation failed',
  INTERNAL_ERROR: 'Internal server error'
};

/**
 * Redis Key Patterns
 */
const REDIS_KEYS = {
  AUCTION_TOP_BID: (auctionId) => `auction:${auctionId}:top_bid`,
  AUCTION_LOCK: (auctionId) => `auction:${auctionId}:lock`
};

module.exports = {
  HTTP_STATUS,
  ERROR_CODES,
  MESSAGES,
  REDIS_KEYS
};
