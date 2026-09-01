// Load environment variables based on NODE_ENV
require('dotenv').config({
  path: process.env.NODE_ENV === 'test'
    ? './environments/local/.env'
    : './environments/prod/.env'
});

const http = require('http');
const { initMysql } = require('./db/mysql');
const { initRedis } = require('./db/redis');
const { handlePostBidRoute } = require('./routes/post_bid_routes');
const { handleGetBidRoute } = require('./routes/get_bid_routes');
const logger = require('./utils/logger');

const PORT = 3000;

/**
 * Start the auction service server
 */
async function startServer() {
  try {
    // Initialize database connections
    logger.info('Initializing connections');
    await initMysql();
    await initRedis();

    // Create HTTP server with routing
    const server = http.createServer(async (req, res) => {
      try {
        // POST /bid - Place a new bid
        if (req.method === 'POST' && req.url === '/bid') {
          await handlePostBidRoute(req, res);
          return;
        }

        // GET /bid - Retrieve bids with optional filters
        if (req.method === 'GET' && req.url.startsWith('/bid')) {
          await handleGetBidRoute(req, res);
          return;
        }

        // GET / - Health check endpoint
        if (req.method === 'GET' && req.url === '/') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Connection': 'close'
          });
          res.end(JSON.stringify({
            success: true,
            message: 'Auction service is running',
            timestamp: new Date().toISOString()
          }));
          return;
        }

        // 404 Not Found for all other routes
        res.writeHead(404, {
          'Content-Type': 'application/json',
          'Connection': 'close'
        });
        res.end(JSON.stringify({
          success: false,
          message: 'Route not found',
          path: req.url,
          method: req.method
        }));

      } catch (error) {
        logger.error('Unhandled error in HTTP server', error);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Connection': 'close'
        });
        res.end(JSON.stringify({
          success: false,
          message: 'Internal server error',
          error: process.env.NODE_ENV === 'test' ? error.message : undefined
        }));
      }
    });

    // Start listening
    server.listen(PORT, () => {
      logger.info('Auction service started', {
        port: PORT,
        url: `http://localhost:${PORT}/`,
        status: 'ready'
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error('Port already in use', { port: PORT });
        process.exit(1);
      } else {
        logger.error('Server error', error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown handler
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

// Start the server
startServer();
