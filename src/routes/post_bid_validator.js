const Joi = require('joi');

/**
 * POST bid request validator schema
 */
const postBidSchema = Joi.object({
  auction_id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'auction_id must be a number',
      'number.integer': 'auction_id must be an integer',
      'number.positive': 'auction_id must be positive',
      'any.required': 'auction_id is required'
    }),

  user_id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'user_id must be a number',
      'number.integer': 'user_id must be an integer',
      'number.positive': 'user_id must be positive',
      'any.required': 'user_id is required'
    }),

  amount: Joi.number()
    .positive()
    .precision(4)  // Allow up to 4 decimal places for financial precision
    .required()
    .messages({
      'number.base': 'amount must be a number',
      'number.positive': 'amount must be positive',
      'number.precision': 'amount can have maximum 4 decimal places',
      'any.required': 'amount is required'
    }),

  request_id: Joi.string()
    .optional()
    .messages({
      'string.base': 'request_id must be a string'
    })
});

/**
 * Validate POST bid request
 * @param {object} data - Request body data
 * @returns {object} Validation result with error and value
 */
function validatePostBid(data) {
  return postBidSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
}

module.exports = {
  validatePostBid
};
