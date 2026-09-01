const Joi = require('joi');

/**
 * GET bid query validator schema
 * All fields are optional for filtering
 */
const getBidSchema = Joi.object({
  auction_id: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.base': 'auction_id must be a number',
      'number.integer': 'auction_id must be an integer',
      'number.positive': 'auction_id must be positive'
    }),

  user_id: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.base': 'user_id must be a number',
      'number.integer': 'user_id must be an integer',
      'number.positive': 'user_id must be positive'
    }),

  min_amount: Joi.number()
    .positive()
    .precision(4)
    .optional()
    .messages({
      'number.base': 'min_amount must be a number',
      'number.positive': 'min_amount must be positive',
      'number.precision': 'min_amount can have maximum 4 decimal places'
    }),

  max_amount: Joi.number()
    .positive()
    .precision(4)
    .optional()
    .messages({
      'number.base': 'max_amount must be a number',
      'number.positive': 'max_amount must be positive',
      'number.precision': 'max_amount can have maximum 4 decimal places'
    })
});

/**
 * Validate GET bid query parameters
 * @param {object} data - Query parameters
 * @returns {object} Validation result with error and value
 */
function validateGetBid(data) {
  return getBidSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
}

module.exports = {
  validateGetBid
};
