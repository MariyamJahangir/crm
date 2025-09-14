const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Notification extends Model {}
Notification.init({
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  toType: { type: DataTypes.ENUM('ADMIN','MEMBER'), allowNull: false },
  toId: { type: DataTypes.CHAR(36), allowNull: false },
  event: { type: DataTypes.STRING(80), allowNull: false },
  entityType: { type: DataTypes.STRING(80), allowNull: false },
  entityId: { type: DataTypes.CHAR(36), allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  message: { type: DataTypes.STRING(400), allowNull: false },
  read: { type: DataTypes.BOOLEAN, defaultValue: false },
  meta: { type: DataTypes.JSON },
}, { sequelize, tableName: 'notifications', timestamps: true });

module.exports = Notification;
