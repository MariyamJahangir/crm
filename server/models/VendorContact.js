// models/VendorContact.js
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class VendorContact extends Model {}

VendorContact.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING(160),
    allowNull: false
  },
  designation: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(180),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  // Foreign key for Vendor association
  vendorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'vendors', // This is the table name
      key: 'id'
    }
  }
}, {
  sequelize,
  tableName: 'vendor_contacts',
  timestamps: true,
  indexes: [
    { fields: ['vendorId'] }
  ]
});

module.exports = VendorContact;
