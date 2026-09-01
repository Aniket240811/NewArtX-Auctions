const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

let readConnection = null;
let writeConnection = null;

/**
 * Get read-only database connection
 * @returns {Sequelize} Read-only Sequelize instance
 */
function getReadConnection() {
  if (!readConnection) {
    readConnection = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_READ_USER,
      process.env.DB_READ_PASS,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );
  }
  return readConnection;
}

/**
 * Get read-write database connection
 * @returns {Sequelize} Read-write Sequelize instance
 */
function getWriteConnection() {
  if (!writeConnection) {
    writeConnection = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_WRITE_USER,
      process.env.DB_WRITE_PASS,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: false,
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );
  }
  return writeConnection;
}

/**
 * Initialize and validate both MySQL connections
 * @returns {Promise<void>}
 */
async function initMysql() {
  try {
    const readConn = getReadConnection();
    const writeConn = getWriteConnection();

    // Test both connections simultaneously
    await Promise.all([
      readConn.authenticate(),
      writeConn.authenticate()
    ]);

    logger.info('MySQL connections established successfully', {
      read_connection: 'authenticated',
      write_connection: 'authenticated'
    });
  } catch (error) {
    logger.error('MySQL connection failed', error);
    throw error;
  }
}

module.exports = {
  getReadConnection,
  getWriteConnection,
  initMysql
};
