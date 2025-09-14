const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Admin extends Model {}
Admin.init({
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(120), allowNull: false },
  email: { type: DataTypes.STRING(180), allowNull: false },
  password: { type: DataTypes.STRING(255), allowNull: false },
  isVerified: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, tableName: 'admins', timestamps: true });



module.exports = Admin;
