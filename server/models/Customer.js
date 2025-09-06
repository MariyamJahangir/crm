const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Customer extends Model {}

Customer.init({
  // --- THIS IS THE FIX ---
  id: {
    type: DataTypes.UUID, // Changed from CHAR(36)
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  // -----------------------
  companyName: { type: DataTypes.STRING(200), allowNull: false },
  contactNumber: { type: DataTypes.STRING(50) },
  email: { type: DataTypes.STRING(180) },
  vatNo: { type: DataTypes.STRING(80) },
  address: { type: DataTypes.TEXT },
  // models/Customer.js (append attributes)
industry: { type: DataTypes.STRING(120), allowNull: true },        // Industry / Business Type
website: { type: DataTypes.STRING(200), allowNull: true },         // Website
category: {                                                        // Customer Category
  type: DataTypes.ENUM('Enterprise','SMB','Individual'),
  allowNull: true
},

  // Also updated this for consistency
  salesmanId: { type: DataTypes.UUID, allowNull: true },
}, { sequelize, tableName: 'customers', timestamps: true });

module.exports = Customer;
