const { handleGetBids } = require('../controllers/get_bid');
const { validateGetBid } = require('./get_bid_validator');
const { URL } = require('url');
const { HTTP_STATUS, ERROR_CODES, MESSAGES } = require('../utils/constant');
const logger = require('../utils/logger');

/**
 * Handle GET /bid route
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 */
async function handleGetBidRoute(req, res) {
  try {
    // Extract query string using native URL parsing
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Convert numeric strings to numbers for validation
    const numericFields = ['auction_id', 'user_id', 'min_amount', 'max_amount'];
    for (const field of numericFields) {
      if (queryParams[field] !== undefined) {
        const numValue = Number(queryParams[field]);
        if (!isNaN(numValue)) {
          queryParams[field] = numValue;
        }
      }
    }

    // Validate query parameters with Joi
    const { error, value } = validateGetBid(queryParams);
    if (error) {
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION, 'Validation failed', error);
    }

    // Pass validated data to controller
    await handleGetBids(req, res, value);

  } catch (error) {
    logger.error('Error in handleGetBidRoute', error);
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

  // Add validation details if this is a validation error
  if (error && error.details) {
    errorResponse.errors = error.details.map(detail => detail.message);
  }

  // Add stack trace for debugging
  if (error && error.stack) {
    errorResponse.stack = error.stack;
  } else if (error && error.message) {
    errorResponse.stack = error.message;
  }

  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Connection': 'close'
  });
  res.end(JSON.stringify(errorResponse));
}

module.exports = {
  handleGetBidRoute
};
