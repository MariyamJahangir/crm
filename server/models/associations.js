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
const ShareGp = require('./ShareGp');
const LeadLog=require('./LeadLog')
console.log('Lead:', Lead?.name);
console.log('Quote:', Quote?.name);
console.log('LeadFollowup:', LeadFollowup?.name);
console.log('ShareGp:', ShareGp?.name);

function applyAssociations() {
    // --- Customer & Salesman Associations ---
    // A Customer is assigned to one Salesman (Member)
    // A Member can be assigned to many Customers
    Customer.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId', constraints: false });
    Member.hasMany(Customer, { as: 'customers', foreignKey: 'salesmanId' });


    // --- Customer & Contact Associations ---
    // A Customer can have many Contacts
    Customer.hasMany(CustomerContact, { as: 'contacts', foreignKey: 'customerId', onDelete: 'CASCADE' });
    CustomerContact.belongsTo(Customer, { foreignKey: 'customerId' });


    // --- Lead Associations ---
    // A Lead is assigned to one Salesman (Member)
    Lead.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId', constraints: false });
    Member.hasMany(Lead, { as: 'assignedLeads', foreignKey: 'salesmanId' });
    
    // A Lead is created by one Member. This enforces the foreign key constraint.
    Lead.belongsTo(Member, { as: 'creator', foreignKey: 'creatorId' });
    Member.hasMany(Lead, { as: 'createdLeads', foreignKey: 'creatorId' });


    // A Lead is associated with one Customer
    Lead.belongsTo(Customer, { as: 'customer', foreignKey: 'customerId', constraints: false });
    Customer.hasMany(Lead, { as: 'leads', foreignKey: 'customerId' });


    // A Lead can have many Follow-ups
    Lead.hasMany(LeadFollowup, { foreignKey: 'leadId', as: 'followups', onDelete: 'CASCADE' });
    LeadFollowup.belongsTo(Lead, { foreignKey: 'leadId', constraints: false });


    // --- Lead -> Quote -> Invoice Workflow ---
    Lead.hasMany(Quote, { foreignKey: 'leadId', as: 'quotes' });
    Quote.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead', constraints: false });


    Quote.hasOne(Invoice, { foreignKey: 'quoteId', as: 'invoice', constraints: false });
    Invoice.belongsTo(Quote, { foreignKey: 'quoteId', as: 'quote', constraints: false });
    
    // --- Quote & QuoteItem Associations ---
    Quote.hasMany(QuoteItem, { foreignKey: 'quoteId', as: 'items', onDelete: 'CASCADE' });
    QuoteItem.belongsTo(Quote, { foreignKey: 'quoteId' });


    // --- Sharing (ShareGp) Associations ---
    Lead.hasMany(ShareGp, { as: 'shares', foreignKey: 'leadId', onDelete: 'CASCADE' });
    ShareGp.belongsTo(Lead, { foreignKey: 'leadId' });


    Quote.hasMany(ShareGp, { foreignKey: 'quoteId' });
    ShareGp.belongsTo(Quote, { foreignKey: 'quoteId' });


    // The Member who initiates the share
    Member.hasMany(ShareGp, { as: 'initiatedShares', foreignKey: 'memberId' });
    ShareGp.belongsTo(Member, { as: 'sharingMember', foreignKey: 'memberId' });


    // The Member who receives the share
    Member.hasMany(ShareGp, { as: 'receivedShares', foreignKey: 'sharedMemberId' });
    ShareGp.belongsTo(Member, { as: 'sharedWithMember', foreignKey: 'sharedMemberId' });


    // --- Sales Target Associations ---
    Member.hasMany(SalesTarget, { foreignKey: 'memberId', as: 'salesTargets' });
    SalesTarget.belongsTo(Member, { foreignKey: 'memberId', as: 'member' });


    Quote.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId', constraints: false });


    // --- Invoice & InvoiceItem Associations ---
    Invoice.hasMany(InvoiceItem, { foreignKey: 'invoiceId', as: 'items', onDelete: 'CASCADE' });
    InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoiceId' });


    Invoice.belongsTo(Member, { as: 'salesman', foreignKey: 'salesmanId', constraints: false });


    // --- Polymorphic Creator Association for Invoices ---
    Invoice.belongsTo(Admin, { foreignKey: 'createdById', constraints: false, as: 'adminCreator' });
    Invoice.belongsTo(Member, { foreignKey: 'createdById', constraints: false, as: 'memberCreator' });
    Admin.hasMany(Invoice, { foreignKey: 'createdById', constraints: false, scope: { creatorType: 'ADMIN' }, as: 'createdInvoices' });
    Member.hasMany(Invoice, { foreignKey: 'createdById', constraints: false, scope: { creatorType: 'MEMBER' }, as: 'createdInvoices' });


    // --- Vendor Associations ---
    Vendor.belongsTo(Member, { foreignKey: 'assignedTo', as: 'assignedMember' });
    Member.hasMany(Vendor, { foreignKey: 'assignedTo', as: 'assignedVendors' });

    // --- Add Many-to-Many Association for Lead Sharing ---
    Lead.belongsToMany(Member, {
        as: 'sharedWith',
        through: ShareGp,
        foreignKey: 'leadId',
        otherKey: 'sharedMemberId'
    });
    Member.belongsToMany(Lead, {
        as: 'sharedLeads',
        through: ShareGp,
        foreignKey: 'sharedMemberId',
        otherKey: 'leadId'
    });
    // --- Lead Log Associations ---
    Lead.hasMany(LeadLog, { as: 'logs', foreignKey: 'leadId', onDelete: 'CASCADE' });
    LeadLog.belongsTo(Lead, { foreignKey: 'leadId' });

    Vendor.hasMany(VendorContact, { foreignKey: 'vendorId', as: 'contacts', onDelete: 'CASCADE' });
    VendorContact.belongsTo(Vendor, { foreignKey: 'vendorId' });
}


module.exports = { applyAssociations };