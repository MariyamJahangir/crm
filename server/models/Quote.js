const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database'); // Corrected import

class Quote extends Model {}

Quote.init({
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  quoteNumber: { type: DataTypes.STRING, unique: true, allowNull: false },
  leadId: { type: DataTypes.UUID, allowNull: false },
  quoteDate: { type: DataTypes.DATE, allowNull: false },
  validityUntil: { type: DataTypes.DATE, allowNull: true },
  salesmanId: { type: DataTypes.UUID, allowNull: false },
  salesmanName: { type: DataTypes.STRING, allowNull: true },
  customerId: { type: DataTypes.UUID, allowNull: true },
  customerName: { type: DataTypes.STRING, allowNull: false },
  contactPerson: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: true },
  address: { type: DataTypes.TEXT, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  discountMode: { type: DataTypes.ENUM('PERCENT', 'AMOUNT'), allowNull: false, defaultValue: 'PERCENT' },
  discountValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0.00 },
  vatPercent: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0.00 },
  subtotal: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0.00 },
  totalCost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0.00 },
  discountAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0.00 },
  vatAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0.00 },
  grandTotal: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0.00 },
  grossProfit: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0.00 },
  profitPercent: { type: DataTypes.DECIMAL(7, 3), allowNull: false, defaultValue: 0.000 },
  profitRate: { type: DataTypes.DECIMAL(14, 4), allowNull: false, defaultValue: 0.0000 },
  status: { type: DataTypes.ENUM('Draft','Sent','Accepted','Rejected','Expired'), allowNull: false, defaultValue: 'Draft' },
preparedBy: { type: DataTypes.STRING, allowNull: true },
approvedBy: { type: DataTypes.STRING, allowNull: true },
}, { sequelize, tableName: 'quotes' });

// All association lines (hasMany, belongsTo) have been removed from this file.

module.exports = Quote;
