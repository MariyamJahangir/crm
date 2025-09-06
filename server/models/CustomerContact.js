const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class CustomerContact extends Model {}

CustomerContact.init({
  // --- THIS IS THE FIX ---
  id: {
    type: DataTypes.UUID, // Changed from CHAR(36)
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: { type: DataTypes.STRING(160), allowNull: false },
  designation: { type: DataTypes.STRING(120) },
  mobile: { type: DataTypes.STRING(50) },
  fax: { type: DataTypes.STRING(50) },
  email: { type: DataTypes.STRING(180) },
  // models/CustomerContact.js (append attributes)
department: { type: DataTypes.STRING(120), allowNull: true },      // Department
social: { type: DataTypes.STRING(240), allowNull: true },          // LinkedIn / Social link/handle

  customerId: {
    type: DataTypes.UUID, // Changed from CHAR(36)
    allowNull: false
  },
  // -----------------------
}, { sequelize, tableName: 'customer_contacts', timestamps: true });

module.exports = CustomerContact;
