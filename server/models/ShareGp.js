const { Model, DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

class ShareGp extends Model {}

ShareGp.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    quoteId: {
      type: DataTypes.UUID,
      allowNull: true, // A lead can be shared before a quote is created
    },
    memberId: { // The member who initiated the share (the creator)
      type: DataTypes.UUID,
      allowNull: false,
    },
    sharedMemberId: { // The member with whom the lead is shared
      type: DataTypes.UUID,
      allowNull: false,
    },
    profitPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    profitAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'share_gp',
    timestamps: true, // Adds createdAt and updatedAt automatically
    indexes: [
      {
        unique: true,
        fields: ['leadId', 'sharedMemberId'], // Prevent sharing the same lead with the same member multiple times
      },
    ],
  }
);

module.exports = ShareGp;
