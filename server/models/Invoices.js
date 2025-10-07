
const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Invoice extends Model {}

Invoice.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  invoiceNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    
  },
quoteId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'quotes', 
      key: 'id'
    }
  },
  invoiceDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
   currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'USD'
  },
  paymentTerms: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'e.g., "Net 30", "Due on receipt"'
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  subtotal: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  discountAmount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  vatAmount: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  grandTotal: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM('Draft', 'Sent', 'Paid', 'Cancelled','Expired', 'Overdue'),
    allowNull: false,
    defaultValue: 'Draft'
  },
     customerType: {
    type: DataTypes.ENUM('Vendor', 'Customer'),
    allowNull: true 
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
   paidAt: {
    type: DataTypes.DATE,
    allowNull: true // It's null until the invoice is paid
  },
   termsAndConditions: {
    type: DataTypes.TEXT,
    allowNull: true
  },
   quoteId: { // This field is the foreign key for the Quote
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'quotes', // This should match the table name of the Quote model
      key: 'id'
    }
  },
    createdById: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Polymorphic foreign key to the user (Admin or Member) who created the invoice.'
  },
  creatorType: {
    type: DataTypes.STRING, // Use STRING to store 'ADMIN' or 'MEMBER'
    allowNull: false,
    comment: 'The type of the creator, e.g., "ADMIN" or "MEMBER".'
  },
}, {
  sequelize,
  tableName: 'invoices',
   indexes: [
    {
      unique: true,
      fields: ['invoiceNumber']
    }
  ]
});

module.exports = Invoice;
