// routes/customers.sql.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Member = require('../models/Member');
const CustomerContact = require('../models/CustomerContact');
const { Op } = require('sequelize'); // import Op for LIKE [web:6][web:12][web:9]
const { createNotification, notifyAdmins } = require('../utils/notify');

const router = express.Router();

// List
router.get('/', authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
const where = {};
if (search) {
  where[Op.or] = [
    { companyName: { [Op.like]: `%${search}%` } },
    { email:       { [Op.like]: `%${search}%` } },
    { vatNo:       { [Op.like]: `%${search}%` } },
    { address:     { [Op.like]: `%${search}%` } },
    { industry:    { [Op.like]: `%${search}%` } },
    { website:     { [Op.like]: `%${search}%` } },
    { category:    { [Op.like]: `%${search}%` } },
  ];
}

    if (search) where.companyName = { [Op.like]: `%${search}%` }; // use Op.like [web:6][web:12][web:9]

    const customers = await Customer.findAll({
      where,
      include: [
        { model: Member, as: 'salesman', attributes: ['id', 'name', 'email'] },
        { model: CustomerContact, as: 'contacts' }
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      customers: customers.map(c => ({
        id: c.id,
        companyName: c.companyName,
        contactNumber: c.contactNumber,
        salesman: c.salesman ? { id: c.salesman.id, name: c.salesman.name, email: c.salesman.email } : null,
        email: c.email,
        vatNo: c.vatNo,
        address: c.address,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        contacts: (c.contacts || []).map(ct => ({
          id: ct.id, name: ct.name, designation: ct.designation, mobile: ct.mobile, fax: ct.fax, email: ct.email
        })),
      })),
    });
  } catch (e) {
    console.error('List Customers Error:', e.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create: admin chooses salesman; member auto-assigns to self
router.post(
  '/',
  authenticateToken,
  [
    body('companyName').trim().notEmpty().withMessage('Company name is required'),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail().withMessage('Invalid email')
      .bail()
      .optional({ nullable: true, checkFalsy: true }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { companyName, contactNumber, email, vatNo, address, industry, website, category } = req.body;

      // Resolve a valid salesmanId that exists in members
      let resolvedSalesmanId = null;

      if (isAdmin(req)) {
        const salesmanId = String(req.body.salesmanId || '').trim();
        if (!salesmanId) {
          return res.status(400).json({ success: false, message: 'Salesman is required for admin-created customers' });
        }
        const salesman = await Member.findByPk(salesmanId, { attributes: ['id'] });
        if (!salesman) {
          return res.status(400).json({ success: false, message: 'Invalid salesman (not found in members)' });
        }
        resolvedSalesmanId = salesman.id;
      } else {
        // Member path: enforce that the current subject is a Member row
        const subjectId = String(req.subjectId);
        const self = await Member.findByPk(subjectId, { attributes: ['id'] });
        if (!self) {
          return res.status(400).json({ success: false, message: 'Current member not found in system' });
        }
        // If a payload salesmanId is provided and differs, block it
        if (req.body.salesmanId && String(req.body.salesmanId) !== String(self.id)) {
          return res.status(403).json({ success: false, message: 'Members can only assign themselves as salesman' });
        }
        resolvedSalesmanId = self.id;
      }

      // Create customer after salesmanId is confirmed valid (prevents FK errors)
      const created = await Customer.create({
  companyName,
  contactNumber: contactNumber || '',
  salesmanId: resolvedSalesmanId,
  email: email || '',
  vatNo: vatNo || '',
  address: address || '',
  industry: industry || null,
  website: website || null,
  category: category || null,
});
notifyAdmins(req.app.get('io'), {
  event: 'CUSTOMER_CREATED',
  entityType: 'CUSTOMER',
  entityId: String(created.id),
  title: `Customer created`,
  message: `${companyName} added`,
}); // admin broadcast [1]

// if admin created for member, notify member
if (isAdmin(req) && resolvedSalesmanId) {
  await createNotification({
    toType: 'MEMBER',
    toId: resolvedSalesmanId,
    event: 'CUSTOMER_ASSIGNED',
    entityType: 'CUSTOMER',
    entityId: created.id,
    title: `New customer assigned`,
    message: `${companyName} assigned by admin`,
  }, req.app.get('io'));
}

      return res.status(201).json({ success: true, customerId: created.id });
    } catch (e) {
      // Helpful server log, client-friendly message
      console.error('Create Customer Error:', e.message);
      return res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);


// Get one
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const c = await Customer.findByPk(req.params.id, {
      include: [
        { model: Member, as: 'salesman', attributes: ['id', 'name', 'email'] },
        { model: CustomerContact, as: 'contacts' }
      ]
    });
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({
      success: true, customer: {
        id: c.id,
        companyName: c.companyName,
        contactNumber: c.contactNumber,
        email: c.email,
        vatNo: c.vatNo,
        address: c.address,
        salesman: c.salesman ? { id: c.salesman.id, name: c.salesman.name, email: c.salesman.email } : null,
        contacts: (c.contacts || []).map(ct => ({
          id: ct.id, name: ct.name, designation: ct.designation, mobile: ct.mobile, fax: ct.fax, email: ct.email
        })),
      }
    });
  } catch (e) {
    console.error('Get Customer Error:', e.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update (only admins can change salesman)
router.put('/:id',
  authenticateToken,
  [
    body('companyName').optional({ nullable: true, checkFalsy: true }).trim().notEmpty().withMessage('Company name cannot be empty if provided'), // optional+trim [web:7][web:10]
    body('salesmanId').optional({ nullable: true, checkFalsy: true }).trim().notEmpty().withMessage('Invalid salesman id'), // presence only if provided [web:7][web:10]
    body('email').optional({ nullable: true, checkFalsy: true }).isEmail().withMessage('Invalid email'), // optional email validation [web:10][web:7]
  ],
  async (req, res) => {
    try {
      const c = await Customer.findByPk(req.params.id);
      if (!c) return res.status(404).json({ success: false, message: 'Not found' });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { companyName, contactNumber, salesmanId, email, vatNo, address, industry, website, category } = req.body;


      if (companyName !== undefined) c.companyName = companyName;
      if (contactNumber !== undefined) c.contactNumber = contactNumber;
      if (email !== undefined) c.email = email;
      if (vatNo !== undefined) c.vatNo = vatNo;
      if (address !== undefined) c.address = address;
if (industry !== undefined) c.industry = industry;
if (website !== undefined) c.website = website;
if (category !== undefined) c.category = category;
      if (salesmanId !== undefined) {
        if (!isAdmin(req)) {
          return res.status(403).json({ success: false, message: 'Only admins can change salesman' });
        }
        if (salesmanId) {
          const sm = await Member.findByPk(salesmanId);
          if (!sm) return res.status(400).json({ success: false, message: 'Invalid salesman' });
          c.salesmanId = salesmanId;
        } else {
          c.salesmanId = null;
        }
      }
notifyAdmins(req.app.get('io'), {
  event: 'CUSTOMER_UPDATED',
  entityType: 'CUSTOMER',
  entityId: String(c.id),
  title: `Customer updated`,
  message: `${c.companyName} updated`,
}); // admin broadcast [1]

if (isAdmin(req) && salesmanId !== undefined && salesmanId) {
  await createNotification({
    toType: 'MEMBER',
    toId: String(c.salesmanId),
    event: 'CUSTOMER_ASSIGNED',
    entityType: 'CUSTOMER',
    entityId: String(c.id),
    title: `Customer assigned`,
    message: `${c.companyName} assigned by admin`,
  }, req.app.get('io'));
}
      await c.save();
      res.json({ success: true });
    } catch (e) {
      console.error('Update Customer Error:', e.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// Delete
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const c = await Customer.findByPk(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    await c.destroy();
    res.status(204).send();
  } catch (e) {
    console.error('Delete Customer Error:', e.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Contacts list
router.get('/:id/contacts', authenticateToken, async (req, res) => {
  try {
    const c = await Customer.findByPk(req.params.id);
    if (!c) return res.status(404).json({ success: false, message: 'Not found' });
    const contacts = await CustomerContact.findAll({ where: { customerId: c.id }, order: [['createdAt', 'ASC']] });
    res.json({ success: true, contacts });
  } catch (e) {
    console.error('Get Contacts Error:', e.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Contacts create
router.post('/:id/contacts',
  authenticateToken,
  [body('name').trim().notEmpty().withMessage('Contact name is required')], // keep simple required [web:10]
  async (req, res) => {
    try {
      const c = await Customer.findByPk(req.params.id);
      if (!c) return res.status(404).json({ success: false, message: 'Not found' });
      const { name, designation, mobile, fax, email } = req.body;
      const created = await CustomerContact.create({ customerId: c.id, name, designation, mobile, fax, email });
      res.status(201).json({ success: true, contact: created });
    } catch (e) {
      console.error('Create Contact Error:', e.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// Contacts delete one
router.delete('/:id/contacts/:contactId', authenticateToken, async (req, res) => {
  try {
    const count = await CustomerContact.destroy({ where: { id: req.params.contactId, customerId: req.params.id } });
    if (!count) return res.status(404).json({ success: false, message: 'Not found' });
    res.status(204).send();
  } catch (e) {
    console.error('Delete Contact Error:', e.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Contacts bulk delete
router.post('/:id/contacts/bulk-delete',
  authenticateToken,
  [body('contactIds').isArray({ min: 1 }).withMessage('contactIds must be a non-empty array')], // basic guard [web:10]
  async (req, res) => {
    try {
      const ids = (req.body.contactIds || []).map(String);
      await CustomerContact.destroy({ where: { id: ids, customerId: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      console.error('Bulk Delete Contacts Error:', e.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

module.exports = router;
