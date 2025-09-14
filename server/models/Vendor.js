const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Vendor extends Model {}

Vendor.init({
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  // Basic Info
  vendorName: { type: DataTypes.STRING(200), allowNull: false },
  contactPerson: { type: DataTypes.STRING(160), allowNull: true },
  email: { type: DataTypes.STRING(180), allowNull: true, validate: { isEmail: true } },
  phone: { type: DataTypes.STRING(50), allowNull: true },
  website: { type: DataTypes.STRING(200), allowNull: true, validate: { isUrl: true } },
  address: { type: DataTypes.TEXT, allowNull: true },
  city: { type: DataTypes.STRING(120), allowNull: true },
  state: { type: DataTypes.STRING(120), allowNull: true },
  country: { type: DataTypes.STRING(120), allowNull: true },
  zipCode: { type: DataTypes.STRING(20), allowNull: true },
  // Business Info
  industry: { type: DataTypes.STRING(120), allowNull: true },
  category: {
    type: DataTypes.ENUM('Manufacturer','Distributor','ServiceProvider','Other'),
    allowNull: true
  },
  productsServices: { type: DataTypes.TEXT, allowNull: true },
  gstNo: { type: DataTypes.STRING(80), allowNull: true },
  vatNo: { type: DataTypes.STRING(80), allowNull: true },
  panNo: { type: DataTypes.STRING(80), allowNull: true },
  registrationNo: { type: DataTypes.STRING(100), allowNull: true },
  // Financial
  paymentTerms: {
    type: DataTypes.ENUM('Advance','Net15','Net30','Net60'),
    allowNull: true
  },
  preferredPaymentMethod: {
    type: DataTypes.ENUM('BankTransfer','UPI','Cheque','Cash','Other'),
    allowNull: true
  },
  currency: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'INR' },
  creditLimit: { type: DataTypes.DECIMAL(14,2), allowNull: true },
  bankName: { type: DataTypes.STRING(120), allowNull: true },
  bankAccountNo: { type: DataTypes.STRING(50), allowNull: true },
  ifscSwiftCode: { type: DataTypes.STRING(50), allowNull: true },
  // Relationship
  status: {
    type: DataTypes.ENUM('Active','Inactive','OnHold','Blacklisted'),
    defaultValue: 'Active'
  },
  rating: { type: DataTypes.DECIMAL(3,2), allowNull: true, defaultValue: 0.00, validate: { min: 0, max: 5 } },
  lastOrderDate: { type: DataTypes.DATE, allowNull: true },
  totalOrders: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  // Foreign Key for Member association
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'members', // table name
      key: 'id'
    }
  },
}, {
  sequelize,
  tableName: 'vendors',
  timestamps: true,
  indexes: [
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['industry'] },
    { fields: ['assignedTo'] }
  ]
});

module.exports = Vendor;
