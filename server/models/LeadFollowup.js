// models/LeadFollowup.js
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class LeadFollowup extends Model {}

LeadFollowup.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  leadId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('Followup', 'Meeting Scheduled', 'No Requirement', 'No Response'),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // New field to store the reminder preference
  scheduleReminder: {
    type: DataTypes.ENUM('30m', '1hr', '3hr', '5hr', '7hr', '10hr', '12hr', '24hr'),
    allowNull: true,
  },
  createdByType: {
    type: DataTypes.ENUM('ADMIN','MEMBER'),
    allowNull: false
  },
  createdById: {
    type: DataTypes.UUID,
    allowNull: false
  }
}, {
  sequelize,
  tableName: 'lead_followups',
  timestamps: true
});

module.exports = LeadFollowup;
