const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { Op } = require('sequelize');
const Customer = require('../models/Customer');
const CustomerContact = require('../models/CustomerContact');

const router = express.Router();

// GET /contacts?search=
// List contacts with optional search across multiple fields
router.get('/', authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const where = {};

    if (search) {
      where[Op.or] = [
        { name:       { [Op.like]: `%${search}%` } },
        { designation:{ [Op.like]: `%${search}%` } },
        { department: { [Op.like]: `%${search}%` } },
        { email:      { [Op.like]: `%${search}%` } },
        { mobile:     { [Op.like]: `%${search}%` } },
        { fax:        { [Op.like]: `%${search}%` } },
        { social:     { [Op.like]: `%${search}%` } },
      ];
    }

    const contacts = await CustomerContact.findAll({
      where,
      include: [
        // No alias to match default association
        { model: Customer, attributes: ['id', 'companyName', 'industry', 'category', 'website'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      contacts: contacts.map(ct => ({
        id: ct.id,
        name: ct.name,
        designation: ct.designation,
        department: ct.department,
        email: ct.email,
        mobile: ct.mobile,
        fax: ct.fax,
        social: ct.social,
        customer: ct.Customer ? {
          id: ct.Customer.id,
          companyName: ct.Customer.companyName,
          industry: ct.Customer.industry,
          category: ct.Customer.category,
          website: ct.Customer.website,
        } : null,
        createdAt: ct.createdAt,
        updatedAt: ct.updatedAt,
      })),
    });
  } catch (e) {
    console.error('List Contacts Error:', e);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

// DELETE /contacts/:id
// Delete a specific contact by id
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const count = await CustomerContact.destroy({ where: { id: req.params.id } });
    if (!count) return res.status(404).json({ success: false, message: 'not found' });
    res.status(204).send();
  } catch (e) {
    console.error('Delete Contact Error:', e);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

// POST /contacts/bulk-delete
// Delete multiple contacts by IDs
router.post('/bulk-delete', authenticateToken, async (req, res) => {
  try {
    const ids = (req.body.contactIds || []).map(String);
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'contactIds must be a non-empty array' });
    }

    await CustomerContact.destroy({ where: { id: ids } });
    res.json({ success: true });
  } catch (e) {
    console.error('Bulk Delete Contacts Error:', e);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

module.exports = router;
