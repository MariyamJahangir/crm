const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

const STAGES = [
  'Discover',
  'Solution Validation',
  'Quote Negotiation',
  'Deal Closed',
  'Deal Lost',
  'Fake Lead'
];

const FORECASTS = ['Pipeline', 'BestCase', 'Commit'];

class Lead extends Model {}

Lead.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },

    stage: {
      type: DataTypes.ENUM(...STAGES),
      allowNull: false,
      defaultValue: 'Discover',
    },

    forecastCategory: {
      type: DataTypes.ENUM(...FORECASTS),
      allowNull: false,
      defaultValue: 'Pipeline',
    },

    customerId: { type: DataTypes.UUID, allowNull: false },
    salesmanId: { type: DataTypes.UUID, allowNull: false },
    source: { type: DataTypes.STRING(80), defaultValue: 'Website' },

    // ⚡ FIXED: removed `unique: true` here
    uniqueNumber: { type: DataTypes.STRING(40), allowNull: false },
closingDates: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      get() {
        const raw = this.getDataValue('closingDates');
        return raw || [];
      },
      set(val) {
        this.setDataValue('closingDates', val || []);
      }
    },
    quoteNumber: { type: DataTypes.STRING(80) },
    previewUrl: { type: DataTypes.TEXT },
    actualDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    contactPerson: { type: DataTypes.STRING(160) },
    mobile: { type: DataTypes.STRING(50) },
    mobileAlt: { type: DataTypes.STRING(50) },
    email: { type: DataTypes.STRING(180) },
    city: { type: DataTypes.STRING(120) },
    description: { type: DataTypes.TEXT },

    nextFollowupAt: { type: DataTypes.DATE, allowNull: true },
    lostReason: { type: DataTypes.STRING(300), allowNull: true },

    creatorType: { type: DataTypes.ENUM('ADMIN', 'MEMBER'), allowNull: false },
    creatorId: { type: DataTypes.UUID, allowNull: false },
    companyName: { type: DataTypes.STRING(200), allowNull: false, defaultValue: '' },
  country: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    attachmentsJson: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue('attachmentsJson');
        if (!raw) return [];
        try {
          return JSON.parse(raw);
        } catch {
          return [];
        }
      },
      set(val) {
        this.setDataValue('attachmentsJson', JSON.stringify(val || []));
      },
    },
  },
  {
    sequelize,
    tableName: 'leads',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['uniqueNumber'], 
      },
    ],
  }
);

Lead.STAGES = STAGES;
Lead.FORECASTS = FORECASTS;

module.exports = Lead;
