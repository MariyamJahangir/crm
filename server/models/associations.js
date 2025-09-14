// models/associations.js
const Customer = require('./Customer');
const CustomerContact = require('./CustomerContact');
const Member = require('./Member');
const Lead = require('./Lead');
const Quote = require('./Quote');
const QuoteItem = require('./QuoteItem');
const LeadFollowup = require('./LeadFollowup');
const Vendor = require('./Vendor');
const VendorContact = require('./VendorContact');
const Invoice = require('./Invoices');
const InvoiceItem = require('./InvoiceItem');

function applyAssociations() {
  // --- Customer & Salesman Associations ---
  Customer.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId' });
  Member.hasMany(Customer, { as: 'customers', foreignKey: 'salesmanId' });

  // --- Customer & Contact Associations ---
  Customer.hasMany(CustomerContact, { as: 'contacts', foreignKey: 'customerId', onDelete: 'CASCADE' });
  CustomerContact.belongsTo(Customer, { foreignKey: 'customerId' });

  // --- Lead Associations ---
  Lead.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId' });
  Member.hasMany(Lead, { as: 'assignedLeads', foreignKey: 'salesmanId' });
  
  Lead.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId' });
  Customer.hasMany(Lead, { as: 'leads', foreignKey: 'customerId' });

  Lead.hasMany(LeadFollowup, { foreignKey: 'leadId', as: 'followups', onDelete: 'CASCADE' });
  LeadFollowup.belongsTo(Lead, { foreignKey: 'leadId' });

  // --- Lead -> Quote -> Invoice Workflow Associations ---
  
  // A Lead can have multiple Quotes
  Lead.hasMany(Quote, { foreignKey: 'leadId', as: 'quotes' });
  Quote.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

  // A Quote can have one Invoice (optional relationship)
  Quote.hasOne(Invoice, {
    foreignKey: 'quoteId',
    as: 'invoice',
    constraints: false // Doesn't enforce a DB-level foreign key constraint, useful for flexibility.
  });
  Invoice.belongsTo(Quote, {
    foreignKey: 'quoteId',
    as: 'quote',
    constraints: false
  });
  
  // --- Quote & QuoteItem Associations ---
  Quote.hasMany(QuoteItem, { foreignKey: 'quoteId', as: 'items', onDelete: 'CASCADE' });
  QuoteItem.belongsTo(Quote, { foreignKey: 'quoteId' });

  // --- Invoice & InvoiceItem Associations ---
  Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items', onDelete: 'CASCADE' });
  InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });

  // --- Vendor Associations ---
  Vendor.belongsTo(Member, { foreignKey: 'assignedTo', as: 'assignedMember' });
  Member.hasMany(Vendor, { foreignKey: 'assignedTo', as: 'assignedVendors' });

  Vendor.hasMany(VendorContact, { foreignKey: 'vendorId', as: 'contacts', onDelete: 'CASCADE' });
  VendorContact.belongsTo(Vendor, { foreignKey: 'vendorId' });
}

module.exports = { applyAssociations };
