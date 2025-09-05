const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Otp extends Model {}
Otp.init({
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  subjectType: { type: DataTypes.ENUM('ADMIN','MEMBER'), allowNull: false },
  subjectId: { type: DataTypes.CHAR(36), allowNull: false },
  purpose: { type: DataTypes.ENUM('RESET','LOGIN_2FA'), allowNull: false },
  codeHash: { type: DataTypes.STRING(255), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  resendAfter: { type: DataTypes.DATE, allowNull: false },
  attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  maxAttempts: { type: DataTypes.INTEGER, defaultValue: 5 },
  isUsed: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { sequelize, tableName: 'otps', timestamps: true });

module.exports = Otp;
