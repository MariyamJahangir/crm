
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class InvoiceItem extends Model {}

InvoiceItem.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  slNo: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  product: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false
  },
  itemRate: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  taxPercent: {
    type: DataTypes.DECIMAL(5, 2), 
    allowNull: false,
    defaultValue: 5.00 
  },
  taxAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  lineTotal: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false
  },
}, {
  sequelize,
  tableName: 'invoice_items',
  indexes: []
});

module.exports = InvoiceItem;
