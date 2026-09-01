/**
 * Auction Model Definition
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {DataTypes} DataTypes - Sequelize DataTypes
 * @returns {Model} Auction model
 */
module.exports = (sequelize, DataTypes) => {
  const Auction = sequelize.define('Auction', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    starting_price: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false
    },
    top_bid_amount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    top_user_id: {
      type: DataTypes.BIGINT,
      allowNull: true
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'CLOSED'),
      allowNull: false,
      defaultValue: 'ACTIVE'
    }
  }, {
    tableName: 'auctions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    version: true // Enable optimistic locking
  });

  return Auction;
};
