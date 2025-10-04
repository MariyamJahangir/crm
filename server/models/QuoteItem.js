const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class QuoteItem extends Model {}

QuoteItem.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  quoteId: { type: DataTypes.UUID, allowNull: false, references: { model: 'quotes', key: 'id' }, onDelete: 'CASCADE' },
  slNo: { type: DataTypes.INTEGER, allowNull: false },
  product: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  
  // --- Fields to Perfectly Match Your Business Logic ---
  
  // Base Input Fields
  unitCost: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  totalCost: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  marginPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  vatPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: false },

  // Stored Calculated Fields
  unitPrice: {
    // Final selling price per unit, including margin.
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },
  totalPrice: {
    // Final selling price for the line, including margin.
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
  },
  
}, {
  sequelize,
  modelName: 'QuoteItem',
  tableName: 'quote_items',
  timestamps: true,
});

module.exports = QuoteItem;
