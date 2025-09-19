const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Member extends Model {}

Member.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    name: { type: DataTypes.STRING(120), allowNull: false },
    email: { type: DataTypes.STRING(180), allowNull: false },
    
    password: { type: DataTypes.STRING(255), allowNull: false },
    designation: { type: DataTypes.STRING(120) },
    isBlocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    parentAdmin: { type: DataTypes.UUID, allowNull: true },
     dashboardLayout: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    sequelize,
    tableName: 'members',
    timestamps: true,

    // Define one named unique index instead
    indexes: [
      { name: 'uniq_members_email', unique: true, fields: ['email'] },
    ],
  }
);

module.exports = Member;
