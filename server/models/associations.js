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
const SalesTarget = require('./SalesTarget');
const Admin = require('./Admin');
const ShareGp= require('./ShareGp')

function applyAssociations() {
    // --- Customer & Salesman Associations ---
    // Part of a cycle (Customer -> Member -> Lead -> Customer). Disable constraints.
    Customer.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId', constraints: false });
    Member.hasMany(Customer, { as: 'customers', foreignKey: 'salesmanId' });

    // --- Customer & Contact Associations ---
    Customer.hasMany(CustomerContact, { as: 'contacts', foreignKey: 'customerId', onDelete: 'CASCADE' });
    CustomerContact.belongsTo(Customer, { foreignKey: 'customerId' });

    // --- Lead Associations ---
    // Part of a cycle (Lead -> Member -> ... and Lead -> Customer -> ...). Disable constraints.
    Lead.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId', constraints: false });
    Member.hasMany(Lead, { as: 'assignedLeads', foreignKey: 'salesmanId' });
    
    // THIS IS THE NEW ASSOCIATION TO FIX THE ERROR
    Lead.belongsTo(Member, { as: 'creator', foreignKey: 'creatorId', constraints: false });
    Member.hasMany(Lead, { as: 'createdLeads', foreignKey: 'creatorId' });

    Lead.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', constraints: false });
    Customer.hasMany(Lead, { as: 'leads', foreignKey: 'customerId' });

    // Part of a cycle via its parent, Lead. Disable constraints.
    Lead.hasMany(LeadFollowup, { foreignKey: 'leadId', as: 'followups', onDelete: 'CASCADE' });
    LeadFollowup.belongsTo(Lead, { foreignKey: 'leadId', constraints: false });

    // --- Lead -> Quote -> Invoice Workflow Associations ---
    Lead.hasMany(Quote, { foreignKey: 'leadId', as: 'quotes' });
    // Part of a cycle via its parent, Lead. Disable constraints.
    Quote.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead', constraints: false });

    Quote.hasOne(Invoice, { foreignKey: 'quoteId', as: 'invoice', constraints: false });
    Invoice.belongsTo(Quote, { foreignKey: 'quoteId', as: 'quote', constraints: false });
    
    // --- Quote & QuoteItem Associations ---
    Quote.hasMany(QuoteItem, { foreignKey: 'quoteId', as: 'items', onDelete: 'CASCADE' });
    QuoteItem.belongsTo(Quote, { foreignKey: 'quoteId' });

    Lead.hasMany(ShareGp, { as: 'shares', foreignKey: 'leadId', onDelete: 'CASCADE' });
    ShareGp.belongsTo(Lead, { foreignKey: 'leadId' });

    // A share can optionally be linked to a Quote
    Quote.hasMany(ShareGp, { foreignKey: 'quoteId' });
    ShareGp.belongsTo(Quote, { foreignKey: 'quoteId' });

    // Link to the member who is sharing
    Member.hasMany(ShareGp, { as: 'initiatedShares', foreignKey: 'memberId' });
    ShareGp.belongsTo(Member, { as: 'sharingMember', foreignKey: 'memberId' });

    // Link to the member receiving the share
    Member.hasMany(ShareGp, { as: 'receivedShares', foreignKey: 'sharedMemberId' });
    ShareGp.belongsTo(Member, { as: 'sharedWithMember', foreignKey: 'sharedMemberId' });

    // --- Sales Target Associations ---
    Member.hasMany(SalesTarget, { foreignKey: 'memberId', as: 'salesTargets' });
    SalesTarget.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });

    // Part of a cycle via Member. Disable constraints.
    Quote.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId', constraints: false });

    // --- Invoice & InvoiceItem Associations ---
    Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items', onDelete: 'CASCADE' });
    InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });

    // Part of a cycle via Member. Disable constraints.
    Invoice.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId', constraints: false });

    // --- Polymorphic Creator Association for Invoices ---
    Invoice.belongsTo(Admin, { foreignKey: 'createdById', constraints: false, as: 'adminCreator' });
    Invoice.belongsTo(Member, { foreignKey: 'createdById', constraints: false, as: 'memberCreator' });
    Admin.hasMany(Invoice, { foreignKey: 'createdById', constraints: false, scope: { creatorType: 'ADMIN' }, as: 'createdInvoices' });
    Member.hasMany(Invoice, { foreignKey: 'createdById', constraints: false, scope: { creatorType: 'MEMBER' }, as: 'createdInvoices' });

    // --- Vendor Associations ---
    Vendor.belongsTo(Member, { foreignKey: 'assignedTo', as: 'assignedMember' });
    Member.hasMany(Vendor, { foreignKey: 'assignedTo', as: 'assignedVendors' });

    Vendor.hasMany(VendorContact, { foreignKey: 'vendorId', as: 'contacts', onDelete: 'CASCADE' });
    VendorContact.belongsTo(Vendor, { foreignKey: 'vendorId' });
}

module.exports = { applyAssociations };
