const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const LeadLog = sequelize.define('LeadLog', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  leadId: { 
    type: DataTypes.CHAR(36),
    allowNull: false,
    references: {
      model: 'leads', // Exact table name in your DB
      key: 'id',
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
  action: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  actorType: {
    type: DataTypes.ENUM('ADMIN', 'MEMBER'),
    allowNull: false,
  },
  actorId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  actorName: {
    type: DataTypes.STRING(191),
    allowNull: false,
  },
}, {
  tableName: 'lead_logs',
  underscored: true,
  timestamps: true,
});

module.exports = LeadLog;
