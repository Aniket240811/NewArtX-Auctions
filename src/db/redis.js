const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

/**
 * Get the Redis client
 * @returns {RedisClient} Redis client instance
 */
function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      },
      username: process.env.REDIS_USER,
      password: process.env.REDIS_PASS
    });

    // Add error event listener for connection drops
    redisClient.on('error', (error) => {
      logger.error('Redis connection error', error);
    });

    // Add connection event listeners
    redisClient.on('connect', () => {
      logger.debug('Redis client connecting');
    });

    redisClient.on('ready', () => {
      logger.debug('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.debug('Redis connection closed');
    });
  }
  return redisClient;
}

/**
 * Initialize and connect to Redis
 * @returns {Promise<void>}
 */
async function initRedis() {
  try {
    const client = getRedisClient();
    await client.connect();
    logger.info('Redis connection established successfully');
  } catch (error) {
    logger.error('Redis connection failed', error);
    throw error;
  }
}

module.exports = {
  getRedisClient,
  initRedis
};
