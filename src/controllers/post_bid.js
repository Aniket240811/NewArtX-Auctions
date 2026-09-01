const { evaluateAndSetTopBid } = require('../utils/redis_utils');
const { getAuctionById, executeBidTransaction, NetworkRetryError } = require('../utils/mysql_utils');
const { HTTP_STATUS, ERROR_CODES, MESSAGES } = require('../utils/constant');
const logger = require('../utils/logger');

/**
 * Handle POST bid request - Pure business logic
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {object} parsedBody - Validated and parsed request body
 */
async function handlePostBid(req, res, parsedBody) {
  try {
    const { auction_id, user_id, amount, request_id } = parsedBody;

    // Business Flow Step 1: Check if auction exists
    const auction = await getAuctionById(auction_id);

    // Business Flow Step 2: Check if auction is closed (time check)
    if (auction.status === 'CLOSED') {
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.AUCTION_CLOSED, MESSAGES.AUCTION_CLOSED, null);
    }

    // Business Flow Step 3: Exact moment check - current time must be <= end_time
    const currentTime = new Date();
    const endTime = new Date(auction.end_time);

    if (currentTime > endTime) {
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.AUCTION_CLOSED, MESSAGES.AUCTION_CLOSED, null);
    }

    // Business Flow Step 4: Check bid amount against starting price
    if (parseFloat(amount) <= parseFloat(auction.starting_price)) {
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INVALID_AMOUNT, MESSAGES.INVALID_BID_AMOUNT, null);
    }

    // Business Flow Step 5: Call Redis Lua script for concurrency / bid amount rules
    // Pass auction end_time for automatic Redis TTL cleanup
    const redisResult = await evaluateAndSetTopBid(auction_id, user_id, amount.toString(), auction.end_time);

    // Handle Redis evaluation results
    if (redisResult === -1) {
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.ALREADY_TOP_BIDDER, MESSAGES.ALREADY_TOP_BIDDER, null);
    }

    if (redisResult === 0) {
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BID_TOO_LOW, MESSAGES.BID_TOO_LOW, null);
    }

    // Track if this is a possible network retry (redisResult === 2)
    const isPossibleRetry = redisResult === 2;

    // Business Flow Step 6: Execute database transaction
    try {
      const bid = await executeBidTransaction(auction, {
        auction_id,
        user_id,
        amount,
        request_id
      });

      // If we reach here, transaction succeeded
      // Check if this was an illegal self-bid (new request_id, same user/amount)
      if (isPossibleRetry) {
        // This should have been a retry, but it succeeded with a NEW request_id
        // This is illegal self-bidding - we need to handle this
        // Since the transaction already committed, we just return an error
        // but acknowledge the bid was placed (MySQL has the data)
        return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.ALREADY_TOP_BIDDER, MESSAGES.ALREADY_TOP_BIDDER + ' (bid was placed but should not have been)', null);
      }

      // Success response for normal bid placement
      return sendSuccessResponse(res, HTTP_STATUS.CREATED, {
        message: MESSAGES.BID_PLACED,
        data: {
          auction_id,
          user_id,
          amount: amount.toString(),
          request_id
        }
      });

    } catch (transactionError) {
      // Handle network retry (duplicate request_id)
      if (transactionError instanceof NetworkRetryError) {
        logger.info('Network retry successful - returning 200 OK', {
          auction_id,
          user_id,
          request_id
        });
        // This is expected when isPossibleRetry is true
        return sendSuccessResponse(res, HTTP_STATUS.OK, {
          message: 'Bid already processed (network retry)',
          data: {
            auction_id,
            user_id,
            amount: amount.toString(),
            request_id
          }
        });
      }

      // Log for debugging
      logger.debug('Transaction error details', {
        error_name: transactionError.name,
        constructor_name: transactionError.constructor.name,
        is_network_retry: transactionError instanceof NetworkRetryError
      });

      // Handle other transaction errors
      throw transactionError;
    }

  } catch (error) {
    logger.error('Error in handlePostBid', error);

    // Handle MySQL fallback business rule errors (400 Bad Request)
    if (error.errorCode === 'ERR_BID_TOO_LOW') {
      logger.info('MySQL fallback: Bid too low detected', { auction_id, user_id, amount });
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.BID_TOO_LOW, MESSAGES.BID_TOO_LOW, error);
    }

    if (error.errorCode === 'ERR_ALREADY_TOP_BIDDER') {
      logger.info('MySQL fallback: Self-bidding detected', { auction_id, user_id });
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.ALREADY_TOP_BIDDER, MESSAGES.ALREADY_TOP_BIDDER, error);
    }

    if (error.errorCode === 'ERR_AUCTION_CLOSED') {
      logger.info('MySQL fallback: Auction closed detected', { auction_id });
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.AUCTION_CLOSED, MESSAGES.AUCTION_CLOSED, error);
    }

    // Handle auction not found error (404 Not Found)
    if (error.errorCode === 'ERR_AUCTION_NOT_FOUND') {
      return sendStandardizedError(res, HTTP_STATUS.NOT_FOUND, ERROR_CODES.AUCTION_NOT_FOUND, MESSAGES.AUCTION_NOT_FOUND, error);
    }

    // Handle concurrency error (409 Conflict)
    if (error.errorCode === 'ERR_CONCURRENCY') {
      return sendStandardizedError(res, HTTP_STATUS.CONFLICT, ERROR_CODES.CONCURRENCY, MESSAGES.CONCURRENCY_COLLISION, error);
    }

    // Handle system errors (500 Internal Server Error)
    return sendStandardizedError(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.SYSTEM, MESSAGES.INTERNAL_ERROR, error);
  }
}

/**
 * Send standardized error response
 * @param {object} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Error code
 * @param {string} message - Error message
 * @param {object} error - Original error object
 */
function sendStandardizedError(res, statusCode, errorCode, message, error) {
  const errorResponse = {
    success: false,
    error_code: errorCode,
    message: message
  };

  // Add stack trace for debugging
  if (error && error.stack) {
    errorResponse.stack = error.stack;
  }

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Connection': 'close'
  });
  res.end(JSON.stringify(errorResponse));
}

/**
 * Send success response
 * @param {object} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {object} data - Response data
 */
function sendSuccessResponse(res, statusCode, data) {
  const successResponse = {
    success: true,
    ...data
  };

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Connection': 'close'
  });
  res.end(JSON.stringify(successResponse));
}

module.exports = {
  handlePostBid
};
