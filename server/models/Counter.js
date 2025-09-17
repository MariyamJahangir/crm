// models/Counter.js
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Counter extends Model {}

Counter.init({
  name: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  currentValue: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  sequelize,
  tableName: 'counters',
  timestamps: false,
});

module.exports = Counter;
