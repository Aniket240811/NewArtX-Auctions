/**
 * Bid Model Definition
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {DataTypes} DataTypes - Sequelize DataTypes
 * @returns {Model} Bid model
 */
module.exports = (sequelize, DataTypes) => {
  const Bid = sequelize.define('Bid', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    auction_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false
    },
    request_id: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    created_at: {
      type: DataTypes.DATE,
      primaryKey: true, // Part of composite primary key due to partitioning
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'bids',
    timestamps: false // We only use created_at, no updatedAt
    // Note: No explicit foreign key constraints or associations defined
  });

  return Bid;
};
