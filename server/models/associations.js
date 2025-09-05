// models/associations.js (your applyAssociations file)
const Customer = require('./Customer');
const CustomerContact = require('./CustomerContact');
const Member = require('./Member');
const Lead = require('./Lead');
const Quote = require('./Quote');
const QuoteItem = require('./QuoteItem');
const LeadFollowup = require('./LeadFollowup');

function applyAssociations() {
  // Existing
  Customer.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId' });
  Customer.hasMany(CustomerContact, { as: 'contacts', foreignKey: 'customerId', onDelete: 'CASCADE' });
  CustomerContact.belongsTo(Customer, { foreignKey: 'customerId' });

  Member.hasMany(Lead, { as: 'leads', foreignKey: 'salesmanId' });
  Lead.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId' });
  Lead.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId' });

  Lead.hasMany(Quote, { foreignKey: 'leadId', as: 'quotes' });
  Quote.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

  Quote.hasMany(QuoteItem, { foreignKey: 'quoteId', as: 'items', onDelete: 'CASCADE' });
  QuoteItem.belongsTo(Quote, { foreignKey: 'quoteId', as: 'quote' });

  // New: Lead followups
  Lead.hasMany(LeadFollowup, { foreignKey: 'leadId', as: 'followups', onDelete: 'CASCADE' });
  LeadFollowup.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
}

module.exports = { applyAssociations };
