const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Member extends Model {}

Member.init({
  // --- THIS IS THE FIX ---
  id: {
    type: DataTypes.UUID, // Changed from CHAR(36)
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  // -----------------------
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(180), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  designation: { type: DataTypes.STRING(120) },
  // Also updated this for consistency
  parentAdmin: { type: DataTypes.UUID, allowNull: true },
}, { sequelize, tableName: 'members', timestamps: true });

module.exports = Member;
