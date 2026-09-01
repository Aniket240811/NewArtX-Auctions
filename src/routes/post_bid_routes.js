const { handlePostBid } = require('../controllers/post_bid');
const { validatePostBid } = require('./post_bid_validator');
const { HTTP_STATUS, ERROR_CODES, MESSAGES } = require('../utils/constant');
const logger = require('../utils/logger');

/**
 * Handle POST /bid route
 * @param {object} req - HTTP request object
 * @param {object} res - HTTP response object
 */
async function handlePostBidRoute(req, res) {
  let body = '';

  try {
    // Read data chunks from request
    for await (const chunk of req) {
      body += chunk.toString();

      // Prevent memory attacks - limit body size
      if (body.length > 1_000_000) { // 1MB limit
        return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION, 'Request body too large', null);
      }
    }

    // Parse JSON
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION, 'Invalid JSON in request body', parseError);
    }

    // Validate content type
    const contentType = req.headers['content-type'];
    if (contentType && !contentType.includes('application/json')) {
      return sendStandardizedError(res, 415, ERROR_CODES.VALIDATION, 'Content-Type must be application/json', null);
    }

    // Validate request body with Joi
    const { error, value } = validatePostBid(parsedBody);
    if (error) {
      return sendStandardizedError(res, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION, 'Validation failed', error);
    }

    // Pass validated data to controller
    await handlePostBid(req, res, value);

  } catch (error) {
    logger.error('Error in handlePostBidRoute', error);
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
  handlePostBidRoute
};
