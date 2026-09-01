const { getBidsWithFilters } = require('../utils/mysql_utils');
const { HTTP_STATUS, ERROR_CODES, MESSAGES } = require('../utils/constant');
const logger = require('../utils/logger');

/**
 * Handle GET bids request - Pure business logic
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 * @param {object} queryParams - Validated and parsed query parameters
 */
async function handleGetBids(req, res, queryParams) {
  try {
    // Business Logic: Query bids with filters
    const bids = await getBidsWithFilters(queryParams);

    // Format response data
    const formattedBids = bids.map(bid => ({
      id: bid.id,
      auction_id: bid.auction_id,
      user_id: bid.user_id,
      amount: bid.amount.toString(),
      request_id: bid.request_id,
      created_at: bid.created_at
    }));

    // Success response
    return sendSuccessResponse(res, HTTP_STATUS.OK, {
      message: MESSAGES.BIDS_RETRIEVED,
      data: {
        count: formattedBids.length,
        bids: formattedBids
      }
    });

  } catch (error) {
    logger.error('Error in handleGetBids', error);
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
  handleGetBids
};
