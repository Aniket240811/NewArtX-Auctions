const { AuctionRead, BidRead, Auction, Bid, writeSequelize } = require('../models/index');
const { Op } = require('sequelize');
const logger = require('./logger');

/**
 * Custom error for network retry scenarios
 */
class NetworkRetryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NetworkRetryError';
    this.errorCode = 'ERR_NETWORK_RETRY';
  }
}

/**
 * Get auction by ID using read connection
 * @param {number} auctionId - Auction ID
 * @returns {Promise<object>} Auction model instance
 */
async function getAuctionById(auctionId) {
  try {
    const auction = await AuctionRead.findOne({
      where: { id: auctionId }
    });

    if (!auction) {
      const error = new Error('Auction not found');
      error.errorCode = 'ERR_AUCTION_NOT_FOUND';
      throw error;
    }

    return auction;
  } catch (error) {
    if (error.errorCode) {
      throw error;
    }
    logger.error('Database operation failed in getAuctionById', error);
    const dbError = new Error('Database operation failed');
    dbError.name = 'DatabaseError';
    dbError.errorCode = 'ERR_DATABASE';
    throw dbError;
  }
}

/**
 * Execute bid transaction with optimistic locking
 * @param {object} auction - Auction model instance
 * @param {object} bidData - Bid data to insert
 * @returns {Promise<object>} Created bid record
 */
async function executeBidTransaction(auction, bidData) {
  let transaction = null;

  try {
    transaction = await writeSequelize.transaction();

    // Insert new bid
    const bid = await Bid.create({
      auction_id: bidData.auction_id,
      user_id: bidData.user_id,
      amount: bidData.amount,
      request_id: bidData.request_id,
      created_at: new Date()
    }, { transaction });

    // Update auction with conditional fallback and optimistic locking
    // This acts as a safety net if Redis cache expires or misses
    // The where clause ensures data integrity without extra SELECT queries
    const updateResult = await Auction.update(
      {
        top_bid_amount: bidData.amount,
        top_user_id: bidData.user_id
      },
      {
        where: {
          id: bidData.auction_id,
          // Ensure auction is still active
          status: 'ACTIVE',
          // Only update if new amount is strictly greater than current top bid
          top_bid_amount: {
            [Op.lt]: bidData.amount
          },
          // Only update if user is not already the top bidder
          // (either top_user_id is null or belongs to a different user)
          top_user_id: {
            [Op.or]: [
              { [Op.is]: null },
              { [Op.ne]: bidData.user_id }
            ]
          },
          // Optimistic locking - ensure version hasn't changed
          version: auction.version
        },
        transaction
      }
    );

    // Check if update failed and determine the specific reason
    const [affectedCount] = updateResult;
    if (affectedCount === 0) {
      await transaction.rollback();

      // Re-fetch auction to determine the exact failure reason
      // This is only executed when the update fails (rare edge case)
      const currentAuction = await Auction.findOne({
        where: { id: bidData.auction_id },
        attributes: ['id', 'status', 'top_bid_amount', 'top_user_id', 'version']
      });

      if (!currentAuction) {
        const error = new Error('Auction not found');
        error.name = 'NotFoundError';
        error.errorCode = 'ERR_AUCTION_NOT_FOUND';
        throw error;
      }

      // Check if auction closed
      if (currentAuction.status === 'CLOSED') {
        const error = new Error('Auction is closed');
        error.name = 'AuctionClosedError';
        error.errorCode = 'ERR_AUCTION_CLOSED';
        throw error;
      }

      // Check if user is already top bidder (self-bidding)
      if (currentAuction.top_user_id === bidData.user_id) {
        const error = new Error('User is already the top bidder');
        error.name = 'AlreadyTopBidderError';
        error.errorCode = 'ERR_ALREADY_TOP_BIDDER';
        throw error;
      }

      // Check if bid amount is too low or equal to current top bid
      // Must be strictly greater than current top bid amount
      if (parseFloat(currentAuction.top_bid_amount || 0) >= parseFloat(bidData.amount)) {
        const error = new Error('Bid amount is too low');
        error.name = 'BidTooLowError';
        error.errorCode = 'ERR_BID_TOO_LOW';
        throw error;
      }

      // If none of the above, it's a version conflict (optimistic locking)
      const error = new Error('Concurrency collision detected');
      error.name = 'ConcurrencyError';
      error.errorCode = 'ERR_CONCURRENCY';
      throw error;
    }

    await transaction.commit();
    return bid;

  } catch (error) {
    // Rollback transaction if still active
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    // Handle network retry (duplicate request_id)
    if (error.name === 'SequelizeUniqueConstraintError') {
      // Check if this is a duplicate request_id error
      // Sequelize provides error information in different ways depending on version
      const isDuplicateRequestId =
        (error.fields && (
          (Array.isArray(error.fields) && error.fields.includes('request_id')) ||
          (typeof error.fields === 'object' && error.fields.request_id) ||
          (error.parent && error.parent.sql && error.parent.sql.includes('request_id'))
        ));

      if (isDuplicateRequestId) {
        logger.debug('Network retry detected - duplicate request_id', { request_id: bidData.request_id });
        throw new NetworkRetryError('Bid already processed (network retry)');
      }

      // Log for debugging if it's a unique constraint error but not request_id
      logger.debug('SequelizeUniqueConstraintError detected but not for request_id', { error: error.message });
    }

    // Re-throw errors with error codes
    if (error.errorCode) {
      throw error;
    }

    // Enhanced error logging for debugging
    logger.error('Database operation failed in executeBidTransaction', {
      error_name: error.name,
      error_message: error.message,
      error_stack: error.stack?.split('\n')?.slice(0, 3)?.join('\n'),
      sql: error.sql,
      bid_data: bidData
    });

    const dbError = new Error('Database operation failed');
    dbError.name = 'DatabaseError';
    dbError.errorCode = 'ERR_DATABASE';
    dbError.cause = error;
    throw dbError;
  }
}

/**
 * Get bids with dynamic filters using read connection
 * @param {object} filters - Filter parameters
 * @returns {Promise<Array>} Array of bid records
 */
async function getBidsWithFilters(filters) {
  try {
    // Build dynamic where clause
    const where = {};

    if (filters.auction_id !== undefined) {
      where.auction_id = filters.auction_id;
    }

    if (filters.user_id !== undefined) {
      where.user_id = filters.user_id;
    }

    if (filters.min_amount !== undefined || filters.max_amount !== undefined) {
      where.amount = {};

      if (filters.min_amount !== undefined) {
        where.amount[Op.gte] = filters.min_amount;
      }

      if (filters.max_amount !== undefined) {
        where.amount[Op.lte] = filters.max_amount;
      }
    }

    // Query bids
    const bids = await BidRead.findAll({
      where: Object.keys(where).length > 0 ? where : undefined,
      order: [
        ['amount', 'DESC'],
        ['created_at', 'DESC']
      ],
      limit: 100  // Prevent excessive result sets
    });

    return bids;

  } catch (error) {
    logger.error('Database operation failed in getBidsWithFilters', error);
    const dbError = new Error('Database operation failed');
    dbError.name = 'DatabaseError';
    dbError.errorCode = 'ERR_DATABASE';
    throw dbError;
  }
}

module.exports = {
  getAuctionById,
  executeBidTransaction,
  getBidsWithFilters,
  NetworkRetryError
};
