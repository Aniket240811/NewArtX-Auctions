const { getRedisClient } = require('../db/redis');
const { REDIS_KEYS } = require('./constant');
const logger = require('./logger');

/**
 * Lua script for atomic bid evaluation and setting
 * Returns: 1 (success), 0 (bid too low), -1 (self-bidding), 2 (possible network retry)
 */
const EVALUATE_BID_SCRIPT = `
  local key = KEYS[1]
  local userId = ARGV[1]
  local amount = tonumber(ARGV[2])
  local ttl = ARGV[3] -- Optional TTL in seconds

  -- Get current top bid data
  local currentData = redis.call('HGETALL', key)

  if #currentData > 0 then
    -- Hash exists, extract current values
    local currentUserId = currentData[2]
    local currentAmount = tonumber(currentData[4])

    -- Check if user is already the top bidder
    if currentUserId == userId then
      -- Same user - check if amount also matches (possible network retry)
      if amount == currentAmount then
        return 2  -- Possible network retry (same user, same amount)
      else
        return -1  -- Error: self-bidding with different amount
      end
    end

    -- Check if new bid is strictly higher
    if amount <= currentAmount then
      return 0  -- Error: bid too low
    end
  end

  -- Update or create the hash with new top bid
  redis.call('HSET', key, 'user_id', userId, 'amount', amount)

  -- Set TTL if provided (for new entries or updates)
  if ttl and ttl ~= '' then
    redis.call('EXPIRE', key, ttl)
  end

  return 1  -- Success
`;

/**
 * Seed auction top bid data in Redis with automatic TTL cleanup
 * @param {number} auctionId - Auction ID
 * @param {string} amount - Bid amount
 * @param {number} userId - User ID
 * @param {Date|string} endTime - Auction end time (Date object or ISO string)
 * @returns {Promise<void>}
 */
async function seedAuctionTopBid(auctionId, amount, userId, endTime) {
  try {
    const client = getRedisClient();
    const key = REDIS_KEYS.AUCTION_TOP_BID(auctionId);

    await client.hSet(key, {
      user_id: userId.toString(),
      amount: amount.toString()
    });

    // Set TTL to 1 hour after auction end time for automatic cleanup
    // This prevents Redis from filling up with old finished auctions
    if (endTime) {
      const auctionEndTime = endTime instanceof Date ? endTime : new Date(endTime);
      const cleanupTime = new Date(auctionEndTime.getTime() + 60 * 60 * 1000); // +1 hour
      const ttlSeconds = Math.max(0, Math.floor((cleanupTime - new Date()) / 1000));

      if (ttlSeconds > 0) {
        await client.expire(key, ttlSeconds);
        logger.info('Seeded auction top bid with TTL', {
          auction_id: auctionId,
          user_id: userId,
          amount: amount,
          ttl_seconds: ttlSeconds
        });
      } else {
        logger.info('Seeded auction top bid (already expired, no TTL set)', {
          auction_id: auctionId,
          user_id: userId,
          amount: amount
        });
      }
    } else {
      logger.info('Seeded auction top bid (no end time provided)', {
        auction_id: auctionId,
        user_id: userId,
        amount: amount
      });
    }
  } catch (error) {
    logger.error('Failed to seed auction top bid', error);
    throw error;
  }
}

/**
 * Evaluate and set top bid atomically using Lua script with automatic TTL cleanup
 * @param {number} auctionId - Auction ID
 * @param {number} userId - User ID
 * @param {string} amount - Bid amount
 * @param {Date|string} endTime - Auction end time (Date object or ISO string)
 * @returns {Promise<number>} 1 (success), 0 (bid too low), -1 (self-bidding), 2 (possible network retry)
 */
async function evaluateAndSetTopBid(auctionId, userId, amount, endTime) {
  try {
    const client = getRedisClient();
    const key = REDIS_KEYS.AUCTION_TOP_BID(auctionId);

    // Calculate TTL: 1 hour after auction end time
    let ttlSeconds = '';
    if (endTime) {
      const auctionEndTime = endTime instanceof Date ? endTime : new Date(endTime);
      const cleanupTime = new Date(auctionEndTime.getTime() + 60 * 60 * 1000); // +1 hour
      ttlSeconds = Math.max(0, Math.floor((cleanupTime - new Date()) / 1000)).toString();
    }

    // Execute Lua script atomically with TTL parameter
    const result = await client.eval(
      EVALUATE_BID_SCRIPT,
      {
        keys: [key],
        arguments: [userId.toString(), amount.toString(), ttlSeconds]
      }
    );

    // Convert result to number
    const statusCode = Number(result);

    if (statusCode === 1) {
      logger.info('Bid accepted via Redis evaluation', {
        auction_id: auctionId,
        user_id: userId,
        amount: amount,
        ttl_seconds: ttlSeconds || null
      });
    } else if (statusCode === 0) {
      logger.debug('Bid rejected via Redis evaluation: amount too low', {
        auction_id: auctionId,
        user_id: userId,
        amount: amount
      });
    } else if (statusCode === -1) {
      logger.debug('Bid rejected via Redis evaluation: user already top bidder', {
        auction_id: auctionId,
        user_id: userId,
        amount: amount
      });
    } else if (statusCode === 2) {
      logger.debug('Possible network retry detected via Redis evaluation', {
        auction_id: auctionId,
        user_id: userId,
        amount: amount
      });
    }

    return statusCode;
  } catch (error) {
    logger.error('Failed to evaluate bid via Redis', error);
    throw error;
  }
}

/**
 * Get current top bid for an auction
 * @param {number} auctionId - Auction ID
 * @returns {Promise<object|null>} Object with {user_id, amount} or null
 */
async function getAuctionTopBid(auctionId) {
  try {
    const client = getRedisClient();
    const key = REDIS_KEYS.AUCTION_TOP_BID(auctionId);

    const data = await client.hGetAll(key);

    if (Object.keys(data).length === 0) {
      return null;
    }

    return {
      user_id: parseInt(data.user_id),
      amount: data.amount
    };
  } catch (error) {
    logger.error('Failed to get top bid for auction', error);
    throw error;
  }
}

/**
 * Clear auction top bid data from Redis
 * @param {number} auctionId - Auction ID
 * @returns {Promise<void>}
 */
async function clearAuctionTopBid(auctionId) {
  try {
    const client = getRedisClient();
    const key = REDIS_KEYS.AUCTION_TOP_BID(auctionId);

    await client.del(key);
    logger.info('Cleared auction top bid from Redis', { auction_id: auctionId });
  } catch (error) {
    logger.error('Failed to clear auction top bid from Redis', error);
    throw error;
  }
}

module.exports = {
  seedAuctionTopBid,
  evaluateAndSetTopBid,
  getAuctionTopBid,
  clearAuctionTopBid
};

/*
 * ============================================================================
 * REDIS LRU EVICTION CONFIGURATION
 * ============================================================================
 *
 * For optimal performance under high concurrent load, configure Redis with
 * LRU (Least Recently Used) eviction policy. This ensures Redis automatically
 * evicts old/unused keys when memory limit is reached, preventing OOM errors.
 *
 * RECOMMENDED CONFIGURATION (redis.conf):
 *
 * # Set maximum memory limit (adjust based on available RAM)
 * maxmemory 2gb
 *
 * # Use allkeys-lru eviction policy for best performance
 * # This evicts least recently used keys regardless of TTL
 * maxmemory-policy allkeys-lru
 *
 * ALTERNATIVE: volatile-lru (only evict keys with TTL set)
 * maxmemory-policy volatile-lru
 *
 * OTHER EVICTION POLICIES:
 * - allkeys-lru: Best for general use, evicts any LRU keys
 * - volatile-lru: Only evicts keys with TTL set (safer, but less effective)
 * - allkeys-random: Evicts random keys (not recommended)
 * - volatile-random: Evicts random keys with TTL (not recommended)
 * - volatile-ttl: Evicts keys with shortest TTL first (alternative approach)
 * - noeviction: Returns errors when memory limit reached (NOT recommended)
 *
 * TO CHECK CURRENT CONFIGURATION:
 * redis-cli CONFIG GET maxmemory
 * redis-cli CONFIG GET maxmemory-policy
 *
 * TO UPDATE CONFIGURATION AT RUNTIME:
 * redis-cli CONFIG SET maxmemory 2gb
 * redis-cli CONFIG SET maxmemory-policy allkeys-lru
 *
 * TO MAKE PERMANENT: Add to redis.conf and restart Redis
 *
 * MONITORING:
 * redis-cli INFO memory | grep used_memory_human
 * redis-cli INFO stats | grep evicted_keys
 *
 * ============================================================================
 */
