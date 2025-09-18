const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { Op } = require('sequelize');
const Customer = require('../models/Customer');
const CustomerContact = require('../models/CustomerContact');
const Vendor = require('../models/Vendor');
const VendorContact = require('../models/VendorContact');
const Lead = require('../models/Lead');
const router = express.Router();

// --- HIGH-LEVEL & SPECIFIC ROUTES FIRST ---

// GET /contacts -> Lists all individual customer contacts.
router.get('/', authenticateToken, async (req, res) => {
    try {
        const search = String(req.query.search || '').trim();
        const where = {};
        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { mobile: { [Op.like]: `%${search}%` } },
            ];
        }
        const contacts = await CustomerContact.findAll({
            where,
            include: [{ model: Customer, attributes: ['id', 'companyName'] }],
            order: [['createdAt', 'DESC']],
        });
        res.json({ success: true, contacts });
    } catch (e) {
        console.error('List Contacts Error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// POST /contacts -> Creates a new CustomerContact.
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { customerId, name, ...otherFields } = req.body;
        if (!customerId || !name) {
            return res.status(400).json({ success: false, message: 'Customer ID and Name are required' });
        }
        const customer = await Customer.findByPk(customerId);
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }
        const newContact = await CustomerContact.create({ customerId, name, ...otherFields });
        res.status(201).json({ success: true, contact: newContact });
    } catch (e) {
        console.error('Create Contact Error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// GET /contacts/search -> Unified search for the entity selection modal.
// This route is critical and MUST come before the dynamic '/:id' route.
router.get('/search', authenticateToken, async (req, res) => {
    const { query = '' } = req.query;
    const { subjectId: userId, subjectType: userRole } = req;
    const searchCondition = { [Op.like]: `%${query}%` };

    try {
        let vendorWhere = {};
        let leadWhere = {};

        if (userRole !== 'ADMIN') {
            vendorWhere.assignedTo = userId;
            leadWhere.salesmanId = userId;
        }

        const vendorSearch = { ...vendorWhere, [Op.or]: [{ vendorName: searchCondition }, { email: searchCondition }] };
        const leadSearch = { ...leadWhere, [Op.or]: [{ companyName: searchCondition }, { contactPerson: searchCondition }, { email: searchCondition }, { uniqueNumber: searchCondition }] };

        const [vendors, leads] = await Promise.all([
            Vendor.findAll({ where: vendorSearch, limit: 10 }),
            Lead.findAll({ where: leadSearch, limit: 10 })
        ]);

        const results = [
            ...vendors.map(v => ({ id: v.id, companyName: v.vendorName, entityType: 'Vendor' })),
            ...leads.map(l => ({ id: l.id, companyName: l.companyName, entityType: 'Lead', uniqueNumber: l.uniqueNumber }))
        ];
        
        const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());
        res.json({ success: true, contacts: uniqueResults });
    } catch (error) {
        console.error('Unified Contact Search Error:', error);
        res.status(500).json({ success: false, message: 'Server error during contact search.' });
    }
});

// POST /contacts/bulk-delete -> Bulk delete for CustomerContacts.
router.post('/bulk-delete', authenticateToken, async (req, res) => {
    try {
        const { contactIds } = req.body;
        if (!Array.isArray(contactIds) || contactIds.length === 0) {
            return res.status(400).json({ success: false, message: 'contactIds must be a non-empty array' });
        }
        await CustomerContact.destroy({ where: { id: contactIds } });
        res.json({ success: true });
    } catch (e) {
        console.error('Bulk Delete Contacts Error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// --- DYNAMIC ROUTES LAST ---

// GET /contacts/:id -> This is the consolidated, intelligent endpoint.
// It fetches contacts for any entity type (Vendor, Lead, Customer) based on the ID.
router.get('/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Check if ID belongs to a Vendor
        const vendor = await Vendor.findByPk(id);
        if (vendor) {
            const vendorContacts = await VendorContact.findAll({ where: { vendorId: id } });
            let contacts = vendorContacts.map(c => ({ id: c.id, name: c.name, email: c.email, phone: c.phone, isPrimary: vendor.contactPerson === c.name, entityType: 'Vendor', companyId: vendor.id, companyName: vendor.vendorName, address: vendor.address }));
            if (contacts.length === 0 && vendor.contactPerson) {
                contacts.push({ id: vendor.id, name: vendor.contactPerson, email: vendor.email, phone: vendor.phone, isPrimary: true, entityType: 'Vendor', companyId: vendor.id, companyName: vendor.vendorName, address: vendor.address });
            }
            return res.json({ success: true, contacts });
        }

        // 2. Check if ID belongs to a Lead
        const lead = await Lead.findByPk(id, { include: [{ model: Customer, as: 'customer' }] });
        if (lead) {
            if (lead.customer) { // Lead is linked to an existing Customer
                const customerContacts = await CustomerContact.findAll({ where: { customerId: lead.customer.id } });
                const contacts = customerContacts.map((c, index) => ({ id: c.id, name: c.name, email: c.email, phone: c.mobile, isPrimary: lead.contactPerson === c.name || index === 0, entityType: 'Customer', companyId: lead.customer.id, companyName: lead.customer.companyName, address: lead.customer.address }));
                return res.json({ success: true, contacts });
            } else { // Standalone Lead (not yet converted to a customer)
                const contact = { id: lead.id, name: lead.contactPerson, email: lead.email, phone: lead.mobile, isPrimary: true, entityType: 'Lead', companyId: lead.id, companyName: lead.companyName, address: lead.city };
                return res.json({ success: true, contacts: [contact] });
            }
        }

        // 3. Check if ID belongs to a Customer
        const customer = await Customer.findByPk(id);
        if (customer) {
            const customerContacts = await CustomerContact.findAll({ where: { customerId: id } });
            const contacts = customerContacts.map((c, index) => ({ id: c.id, name: c.name, email: c.email, phone: c.mobile, isPrimary: index === 0, entityType: 'Customer', companyId: customer.id, companyName: customer.companyName, address: customer.address }));
            return res.json({ success: true, contacts });
        }

        // 4. Check if ID belongs to a specific CustomerContact (for fetching single contact details)
        const contact = await CustomerContact.findByPk(id, { include: [{ model: Customer, attributes: ['id', 'companyName'] }] });
        if (contact) {
            return res.json({ success: true, contact: contact }); // Note: sending 'contact', not 'contacts'
        }
        
        // 5. If no entity is found, return 404
        return res.status(404).json({ success: false, message: 'No Vendor, Lead, Customer, or Contact found with this ID.' });

    } catch (error) {
        console.error('Error fetching entity by ID:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching entity.' });
    }
});

// PUT /contacts/:id -> Updates a specific CustomerContact.
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const [updatedCount] = await CustomerContact.update(req.body, { where: { id: req.params.id } });
        if (updatedCount === 0) {
            return res.status(404).json({ success: false, message: 'CustomerContact not found or no changes made' });
        }
        const updatedContact = await CustomerContact.findByPk(req.params.id);
        res.json({ success: true, contact: updatedContact });
    } catch (e) {
        console.error('Update Contact Error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// DELETE /contacts/:id -> Deletes a specific CustomerContact.
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const count = await CustomerContact.destroy({ where: { id: req.params.id } });
        if (!count) {
            return res.status(404).json({ success: false, message: 'CustomerContact not found' });
        }
        res.status(204).send();
    } catch (e) {
        console.error('Delete Contact Error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
