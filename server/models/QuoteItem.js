const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database'); // Corrected import

class QuoteItem extends Model {}

QuoteItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  quoteId: { type: DataTypes.UUID, allowNull: false },
  slNo: { type: DataTypes.INTEGER, allowNull: false },
  product: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  unit: { type: DataTypes.STRING, allowNull: true },
  quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, defaultValue: 1.000 },
  itemCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },
  itemRate: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },
  lineDiscountPercent: { type: DataTypes.DECIMAL(7, 3), allowNull: false, defaultValue: 0.000 },
  lineDiscountAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },
  lineGross: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0.00 },
  lineCostTotal: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0.00 },
  lineGP: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0.00 },
  lineProfitPercent: { type: DataTypes.DECIMAL(7, 3), allowNull: false, defaultValue: 0.000 },
}, { sequelize, tableName: 'quote_items' });

// All association lines (hasMany, belongsTo) have been removed from this file.

module.exports = QuoteItem;
