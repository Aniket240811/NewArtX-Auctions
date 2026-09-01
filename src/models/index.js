const { getReadConnection, getWriteConnection } = require('../db/mysql');
const AuctionModel = require('./auction');
const BidModel = require('./bid');

// Initialize models on both read and write connections
const writeSequelize = getWriteConnection();
const readSequelize = getReadConnection();

// Write connection models (for transactions and updates)
const Auction = AuctionModel(writeSequelize, require('sequelize').DataTypes);
const Bid = BidModel(writeSequelize, require('sequelize').DataTypes);

// Register models on read connection (for read-only queries)
const AuctionRead = AuctionModel(readSequelize, require('sequelize').DataTypes);
const BidRead = BidModel(readSequelize, require('sequelize').DataTypes);

module.exports = {
  Auction,     // Write connection auction model
  Bid,         // Write connection bid model
  AuctionRead, // Read connection auction model
  BidRead,     // Read connection bid model
  writeSequelize, // Write connection for transactions
  readSequelize   // Read connection for queries
};
