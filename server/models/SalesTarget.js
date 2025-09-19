// models/SalesTarget.js
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class SalesTarget extends Model {}

SalesTarget.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  memberId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'members',
      key: 'id'
    }
  },
  year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  month: { // 1 for January, 12 for December
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  targetAmount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00
  },
}, {
  sequelize,
  tableName: 'sales_targets',
  timestamps: true,
  indexes: [{
    unique: true,
    fields: ['memberId', 'year', 'month']
  }]
});

module.exports = SalesTarget;
