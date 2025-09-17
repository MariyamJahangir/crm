const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Member = require('../models/Member');
const CustomerContact = require('../models/CustomerContact');
const { Op } = require('sequelize');
const { createNotification, notifyAdmins } = require('../utils/notify');
const {  notifyAssignment  } = require('../utils/emailService')
const router = express.Router();

// Helper to add unique member id to customer's contactedBy array
async function pushContactedBy(customer, memberId) {
  try {
    if (!memberId) return;
    const arr = Array.isArray(customer.contactedBy) ? customer.contactedBy : [];
    if (!arr.includes(memberId)) {
      arr.push(memberId);
      customer.contactedBy = arr;
      await customer.save();
    }
  } catch (e) {
    console.warn('Failed to update contactedBy:', e.message);
  }
}

// Helper: resolve member IDs to names for contactedBy
async function resolveContactedByNames(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const uniqIds = [...new Set(ids.map(String))];
  const users = await Member.findAll({
    where: { id: { [Op.in]: uniqIds } },
    attributes: ['id', 'name'],
  });
  const idNameMap = new Map(users.map(u => [String(u.id), u.name]));
  return uniqIds.map(id => idNameMap.get(id)).filter(Boolean);
}

// GET /customers - list customers with optional search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const where = {};

    if (search) {
      where[Op.or] = [
        { companyName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { vatNo: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
        { industry: { [Op.like]: `%${search}%` } },
        { website: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
      ];
    }

    const customers = await Customer.findAll({
      where,
      include: [
        { model: Member, as: 'salesman', attributes: ['id', 'name', 'email'] },
        { model: CustomerContact, as: 'contacts' }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Enrich each customer with resolved contactedByNames
    const result = await Promise.all(customers.map(async c => {
      const contactedBy = Array.isArray(c.contactedBy) ? c.contactedBy : [];
      const contactedByNames = await resolveContactedByNames(contactedBy);

      return {
        id: c.id,
        companyName: c.companyName,
        contactNumber: c.contactNumber,
        email: c.email,
        vatNo: c.vatNo,
        address: c.address,
        industry: c.industry || null,
        website: c.website || null,
        category: c.category || null,
        contactedBy,
        contactedByNames,
        salesman: c.salesman ? {
          id: c.salesman.id,
          name: c.salesman.name,
          email: c.salesman.email
        } : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        contacts: (c.contacts || []).map(ct => ({
          id: ct.id,
          name: ct.name,
          designation: ct.designation,
          department: ct.department,
          mobile: ct.mobile,
          fax: ct.fax,
          email: ct.email,
          social: ct.social,
        })),
      };
    }));

    res.json({ success: true, customers: result });

  } catch (err) {
    console.error('Error listing customers:', err);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

// POST /customers - create new customer
// router.post('/', authenticateToken, [
//   body('companyName').trim().notEmpty().withMessage('Company name is required'),
//   body('email').optional().trim().isEmail().withMessage('Invalid email'),
// ], async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty())
//       return res.status(400).json({ success: false, message: 'validation failed', errors: errors.array() });

//     const {
//       companyName, contactNumber, email, vatNo,
//       address, industry, website, category,
//       salesmanId: requestedSalesmanId
//     } = req.body;

//     let resolvedSalesmanId = null;

//     if (isAdmin(req)) {
//       if (!requestedSalesmanId)
//         return res.status(400).json({ success: false, message: 'Salesman is required' });

//       const salesman = await Member.findByPk(requestedSalesmanId);
//       if (!salesman)
//         return res.status(400).json({ success: false, message: 'Invalid salesman' });

//       resolvedSalesmanId = salesman.id;

//     } else {
//       // Member creates customer for self only
//       const self = await Member.findByPk(req.subjectId);
//       if (!self)
//         return res.status(400).json({ success: false, message: 'Invalid member' });

//       if (requestedSalesmanId && requestedSalesmanId !== self.id)
//         return res.status(403).json({ success: false, message: 'Cannot assign other salesman' });

//       resolvedSalesmanId = self.id;
//     }

//     const created = await Customer.create({
//       companyName,
//       contactNumber: contactNumber || '',
//       email: email || '',
//       vatNo: vatNo || '',
//       address: address || '',
//       industry: industry || null,
//       website: website || null,
//       category: category || null,
//       salesmanId: resolvedSalesmanId,
//       contactedBy: [] // initialize empty
//     });

   
//     await pushContactedBy(created, resolvedSalesmanId);

//     notifyAdmins(req.app.get('io'), {
//       event: 'CUSTOMER_CREATED',
//       entityType: 'customer',
//       entityId: created.id,
//       title: 'New Customer Created',
//       message: `Customer ${companyName} was created.`,
//     });

//     if (isAdmin(req) && resolvedSalesmanId) {
//       await createNotification({
//         toType: 'MEMBER',
//         toId: resolvedSalesmanId,
//         event: 'CUSTOMER_ASSIGNED',
//         entityType: 'customer',
//         entityId: created.id,
//         title: 'Customer Assigned',
//         message: `Customer ${companyName} assigned to you.`,
//       }, req.app.get('io'));
//     }

//     res.status(201).json({ success: true, customerId: created.id });

//   } catch (err) {
//     console.error('Error creating customer:', err);
//     res.status(500).json({ success: false, message: 'server error' });
//   }
// });
  

router.post('/', authenticateToken, [
    body('companyName').trim().notEmpty().withMessage('Company name is required'),
    body('email').optional().trim().isEmail().withMessage('Invalid email'),
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'validation failed', errors: errors.array() });
        }

        const {
            companyName, contactNumber, email, vatNo,
            address, industry, website, category,
            salesmanId: requestedSalesmanId
        } = req.body;

        let resolvedSalesmanId = null;
        let assignedSalesman = null;

        if (isAdmin(req)) {
            if (!requestedSalesmanId) {
                return res.status(400).json({ success: false, message: 'Salesman is required' });
            }
            assignedSalesman = await Member.findByPk(requestedSalesmanId);
            if (!assignedSalesman) {
                return res.status(400).json({ success: false, message: 'Invalid salesman' });
            }
            resolvedSalesmanId = assignedSalesman.id;
        } else {
            const self = await Member.findByPk(req.subjectId);
            if (!self) {
                return res.status(400).json({ success: false, message: 'Invalid member' });
            }
            if (requestedSalesmanId && requestedSalesmanId !== self.id) {
                return res.status(403).json({ success: false, message: 'Cannot assign other salesman' });
            }
            resolvedSalesmanId = self.id;
            assignedSalesman = self;
        }

        const createdCustomer = await Customer.create({
            companyName,
            contactNumber: contactNumber || '',
            email: email || '',
            vatNo: vatNo || '',
            address: address || '',
            industry: industry || null,
            website: website || null,
            category: category || null,
            salesmanId: resolvedSalesmanId,
            contactedBy: []
        });

        await pushContactedBy(createdCustomer, resolvedSalesmanId);

        // Your existing socket.io notification
        notifyAdmins(req.app.get('io'), {
            event: 'CUSTOMER_CREATED',
            entityType: 'customer',
            entityId: createdCustomer.id,
            title: 'New Customer Created',
            message: `Customer ${companyName} was created.`,
        });

        // --- EMAIL NOTIFICATION LOGIC ---
        // If an admin created this customer for another member, send an email.
        if (isAdmin(req) && assignedSalesman) {
            // Your existing in-app notification
            await createNotification({
                toType: 'MEMBER',
                toId: resolvedSalesmanId,
                event: 'CUSTOMER_ASSIGNED',
                entityType: 'customer',
                entityId: createdCustomer.id,
                title: 'Customer Assigned',
                message: `Customer ${companyName} assigned to you.`,
            }, req.app.get('io'));

            // **Send the email notification**
            await notifyAssignment(assignedSalesman, 'Customer', createdCustomer);
        }

        res.status(201).json({ success: true, customerId: createdCustomer.id });

    } catch (err) {
        console.error('Error creating customer:', err);
        res.status(500).json({ success: false, message: 'server error' });
    }
});

// --- UPDATED: Create New Contact for a Customer Route ---
router.post('/:id/contacts', authenticateToken, [
    body('name').trim().notEmpty().withMessage('Name is required'),
], async (req, res) => {
    try {
        const customerId = req.params.id;
        const customer = await Customer.findByPk(customerId, { include: 'salesman' });
        if (!customer) {
            return res.status(404).json({ success: false, message: 'Customer not found' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: 'validation failed', errors: errors.array() });
        }

        const { name, designation, department, mobile, fax, email, social } = req.body;

        const newContact = await CustomerContact.create({
            customerId, name, designation, department, mobile, fax, email, social,
        });

        // --- EMAIL NOTIFICATION LOGIC ---
        // If an admin adds a contact to a customer assigned to a member, notify the member.
        if (isAdmin(req) && customer.salesman && customer.salesmanId !== req.subjectId) {
            // **Send the email notification**
            await notifyAssignment(customer.salesman, 'Contact', newContact);
        }

        res.status(201).json({ success: true, contact: newContact });

    } catch (err) {
        console.error('Error creating contact:', err);
        res.status(500).json({ success: false, message: 'server error' });
    }
});

// GET /customers/:id - get detail customer info
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const c = await Customer.findByPk(req.params.id, {
      include: [
        { model: Member, as: 'salesman', attributes: ['id', 'name', 'email'] },
        { model: CustomerContact, as: 'contacts' }
      ]
    });

    if (!c)
      return res.status(404).json({ success: false, message: 'not found' });

    const contactedBy = Array.isArray(c.contactedBy) ? c.contactedBy : [];
    const contactedByNames = await resolveContactedByNames(contactedBy);

    res.json({
      success: true,
      customer: {
        id: c.id,
        companyName: c.companyName,
        contactNumber: c.contactNumber,
        email: c.email,
        vatNo: c.vatNo,
        address: c.address,
        industry: c.industry || null,
        website: c.website || null,
        category: c.category || null,
        contactedBy,
        contactedByNames,
        salesman: c.salesman ? {
          id: c.salesman.id,
          name: c.salesman.name,
          email: c.salesman.email
        } : null,
        contacts: (c.contacts || []).map(ct => ({
          id: ct.id,
          name: ct.name,
          designation: ct.designation,
          department: ct.department,
          mobile: ct.mobile,
          fax: ct.fax,
          email: ct.email,
          social: ct.social,
        }))
      }
    });

  } catch (err) {
    console.error('Error fetching customer:', err);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

// PUT /customers/:id - update customer info
router.put('/:id', authenticateToken, [
  body('companyName').optional().trim().notEmpty().withMessage('Company name cannot be empty'),
  body('salesmanId').optional().trim(),
  body('email').optional().trim().isEmail().withMessage('Invalid email address'),
], async (req, res) => {
  try {
    const c = await Customer.findByPk(req.params.id);
    if (!c)
      return res.status(404).json({ success: false, message: 'not found' });

    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, message: 'validation failed', errors: errors.array() });

    const {
      companyName, contactNumber, email, vatNo, address,
      industry, website, category, salesmanId
    } = req.body;

    // --- SOLUTION ---
    // Update fields, converting empty strings for ENUMs to null
    if (companyName !== undefined) c.companyName = companyName;
    if (contactNumber !== undefined) c.contactNumber = contactNumber;
    if (email !== undefined) c.email = email;
    if (vatNo !== undefined) c.vatNo = vatNo;
    if (address !== undefined) c.address = address;
    if (website !== undefined) c.website = website;
    
    // Convert empty strings to null for ENUM columns
    if (industry !== undefined) {
      c.industry = industry === '' ? null : industry;
    }
    if (category !== undefined) {
      c.category = category === '' ? null : category;
    }
    // --- END SOLUTION ---

    if (salesmanId !== undefined) {
      if (!isAdmin(req))
        return res.status(403).json({ success: false, message: 'only admins can change salesman' });

      if (salesmanId) {
        const sm = await Member.findByPk(salesmanId);
        if (!sm)
          return res.status(400).json({ success: false, message: 'invalid salesman' });

        c.salesmanId = salesmanId;
        await pushContactedBy(c, salesmanId);
      } else {
        c.salesmanId = null;
      }
    }

    notifyAdmins(req.app.get('io'), {
      event: 'CUSTOMER_UPDATED',
      entity: 'customer',
      entityId: c.id,
      title: 'Customer Updated',
      message: `Customer ${c.companyName} was updated.`,
    });

    if (isAdmin(req) && salesmanId && salesmanId !== c.salesmanId) {
      await createNotification({
        toType: 'MEMBER',
        toId: salesmanId,
        event: 'CUSTOMER_ASSIGNED',
        entity: 'customer',
        entityId: c.id,
        title: 'Customer Assigned',
        message: `Customer ${c.companyName} assigned to you.`,
      }, req.app.get('io'));
    }

    await c.save();

    res.json({ success: true });

  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ success: false, message: 'server error' });
  }
});


router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const c = await Customer.findByPk(req.params.id);
    if (!c)
      return res.status(404).json({ success: false, message: 'not found' });

    await c.destroy();
    res.status(204).send();
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

// GET /customers/:id/contacts - list contacts for a customer
router.get('/:id/contacts', authenticateToken, async (req, res) => {
  try {
    const customerId = req.params.id;
    const c = await Customer.findByPk(customerId);
    if (!c)
      return res.status(404).json({ success: false, message: 'not found' });

    const contacts = await CustomerContact.findAll({
      where: { customerId },
      order: [['createdAt', 'ASC']]
    });

    res.json({
      success: true,
      contacts: contacts.map(ct => ({
        id: ct.id,
        name: ct.name,
        designation: ct.designation,
        department: ct.department,
        mobile: ct.mobile,
        fax: ct.fax,
        email: ct.email,
        social: ct.social,
      }))
    });

  } catch (err) {
    console.error('Error getting contacts:', err);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

// POST /customers/:id/contacts - add contact to customer
// router.post('/:id/contacts', authenticateToken, [
//   body('name').trim().notEmpty().withMessage('Name is required'),
// ], async (req, res) => {
//   try {
//     const customerId = req.params.id;
//     const c = await Customer.findByPk(customerId);
//     if (!c)
//       return res.status(404).json({ success: false, message: 'not found' });

//     const errors = validationResult(req);
//     if (!errors.isEmpty())
//       return res.status(400).json({ success: false, message: 'validation failed', errors: errors.array() });

//     const { name, designation, department, mobile, fax, email, social } = req.body;

//     const newContact = await CustomerContact.create({
//       customerId,
//       name,
//       designation,
//       department,
//       mobile,
//       fax,
//       email,
//       social,
//     });

//     res.status(201).json({ success: true, contact: newContact });

//   } catch (err) {
//     console.error('Error creating contact:', err);
//     res.status(500).json({ success: false, message: 'server error' });
//   }
// });

// DELETE /customers/:id/contacts/:contactId - remove a contact
router.delete('/:id/contacts/:contactId', authenticateToken, async (req, res) => {
  try {
    const { id: customerId, contactId } = req.params;

    const count = await CustomerContact.destroy({ where: { id: contactId, customerId } });
    if (!count)
      return res.status(404).json({ success: false, message: 'not found' });

    res.status(204).send();

  } catch (err) {
    console.error('Error deleting contact:', err);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

// POST /customers/:id/contacts/bulk-delete - delete multiple contacts
router.post('/:id/contacts/bulk-delete', authenticateToken, [
  body('contactIds').isArray({ min: 1 }).withMessage('Provide contactIds array'),
], async (req, res) => {
  try {
    const customerId = req.params.id;
    const contactIds = req.body.contactIds;

    if (!Array.isArray(contactIds) || contactIds.length === 0)
      return res.status(400).json({ success: false, message: 'Invalid contactIds' });

    await CustomerContact.destroy({ where: { id: contactIds, customerId } });
    res.json({ success: true });

  } catch (err) {
    console.error('Error bulk deleting contacts:', err);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

module.exports = router;
