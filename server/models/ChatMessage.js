const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class ChatMessage extends Model {}
ChatMessage.init({
  id: { type: DataTypes.CHAR(36), primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  leadId: { type: DataTypes.CHAR(36), allowNull: false },
  fromType: { type: DataTypes.ENUM('ADMIN','MEMBER'), allowNull: false },
  fromId: { type: DataTypes.CHAR(36), allowNull: false },
  text: { type: DataTypes.TEXT, defaultValue: '' },
  attachments: { type: DataTypes.JSON, defaultValue: [] },
}, { sequelize, tableName: 'chat_messages', timestamps: true });

module.exports = ChatMessage;
