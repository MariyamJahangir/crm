const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const STAGES = ['Discover','Solution Validation','Quote','Negotiation','Deal Closed','Deal Lost','Fake Lead'];
const FORECASTS = ['Pipeline','BestCase','Commit'];

class Lead extends Model {}

Lead.init({
  // --- THIS IS THE FIX ---
  id: {
    type: DataTypes.UUID, // Changed from CHAR(36) to UUID
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  // -----------------------
  stage: { type: DataTypes.ENUM(...STAGES), allowNull: false, defaultValue: 'Discover' },
  forecastCategory: { type: DataTypes.ENUM(...FORECASTS), allowNull: false, defaultValue: 'Pipeline' },
  customerId: { type: DataTypes.UUID, allowNull: false }, // Also good practice to use UUID here
  salesmanId: { type: DataTypes.UUID, allowNull: false }, // And here
  source: { type: DataTypes.STRING(80), defaultValue: 'Website' },
  uniqueNumber: { type: DataTypes.STRING(40), unique: true, allowNull: false },
  quoteNumber: { type: DataTypes.STRING(80) },
  previewUrl: { type: DataTypes.TEXT },
  actualDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  contactPerson: { type: DataTypes.STRING(160) },
  mobile: { type: DataTypes.STRING(50) },
  // models/Lead.js (append attributes)
nextFollowupAt: { type: DataTypes.DATE, allowNull: true },        // planned next follow-up
lostReason: { type: DataTypes.STRING(300), allowNull: true },     // required if stage = 'Deal Lost'

  mobileAlt: { type: DataTypes.STRING(50) },
  email: { type: DataTypes.STRING(180) },
  city: { type: DataTypes.STRING(120) },
  description: { type: DataTypes.TEXT },
  creatorType: { type: DataTypes.ENUM('ADMIN','MEMBER'), allowNull: false },
  creatorId: { type: DataTypes.UUID, allowNull: false },
  companyName: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
  attachmentsJson: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      const raw = this.getDataValue('attachmentsJson');
      if (!raw) return [];
      try { return JSON.parse(raw); } catch { return []; }
    },
    set(val) {
      this.setDataValue('attachmentsJson', JSON.stringify(val || []));
    },
  },
}, { sequelize, tableName: 'leads', timestamps: true });

Lead.STAGES = STAGES;
Lead.FORECASTS = FORECASTS;

module.exports = Lead;
