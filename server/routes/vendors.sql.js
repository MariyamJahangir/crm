// src/routes/vendors.js

const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { authenticateToken, isAdmin } = require('../middleware/auth');
<<<<<<< HEAD

=======
const {  notifyAssignment  } = require('../utils/emailService')
>>>>>>> origin/main
const Vendor = require('../models/Vendor');
const VendorContact = require('../models/VendorContact');
const Member = require('../models/Member');

const router = express.Router();

// --- LIST ALL VENDORS (Corrected and Final) ---
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { search, status, category, industry, sortBy = 'vendorName', order = 'ASC' } = req.query;
        const where = {};

        // **FIX 1: Use req.subjectType for Role-Based Filtering**
        // If the user is not an admin, only show vendors assigned to them.
        if (req.subjectType !== 'ADMIN') {
            where.assignedTo = req.subjectId;
        }

        // **FIX 2: Handle Search and use correct operator for MySQL**
        // This prevents 'undefined' from entering the query.
        if (search && typeof search === 'string' && search.trim() !== '' && search.trim() !== 'undefined') {
            const searchQuery = `%${search.trim()}%`;
            // Use Op.like for MySQL. It is case-insensitive by default in most standard collations.
            where[Op.or] = [
                { vendorName: { [Op.like]: searchQuery } },
                { email: { [Op.like]: searchQuery } },
                { city: { [Op.like]: searchQuery } },
            ];
        }

        // Add other filters if they are provided
        if (status) where.status = status;
        if (category) where.category = category;
        if (industry) where.industry = industry;

        const vendors = await Vendor.findAll({
            where,
            include: [
                { model: Member, as: 'assignedMember', attributes: ['id', 'name'] },
                { model: VendorContact, as: 'contacts' }
            ],
            order: [[sortBy, order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC']],
        });

        res.json({ success: true, vendors });
    } catch (e) {
        console.error('List Vendors Error:', e);
        res.status(500).json({ success: false, message: 'Server error while fetching vendors.' });
    }
});

// --- GET A SINGLE VENDOR BY ID ---
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const vendor = await Vendor.findByPk(req.params.id, {
            include: [{ model: Member, as: 'assignedMember' }, { model: VendorContact, as: 'contacts' }]
        });
        if (!vendor) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        // **FIX: Use req.subjectType for authorization check**
        if (req.subjectType !== 'ADMIN' && vendor.assignedTo !== req.subjectId) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        res.json({ success: true, vendor });
    } catch (e) {
        console.error('Get Vendor Error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

<<<<<<< HEAD
router.post('/', authenticateToken, [
    // --- Validations ---
=======
// router.post('/', authenticateToken, [
//     // --- Validations ---
//     body('vendorName').trim().notEmpty().withMessage('Vendor name is required'),
//     body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please provide a valid email address'),
//     body('website').optional({ checkFalsy: true }).isURL().withMessage('Please provide a valid website URL'),
//     body('contacts').optional().isArray().withMessage('Contacts must be an array')
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ success: false, errors: errors.array() });
//     }

//     const transaction = await sequelize.transaction();

//     try {
//       const { contacts = [], ...vendorData } = req.body;

//       // --- Logic for Ownership and Primary Contact ---

//       // 1. Determine who the vendor is assigned to
//       let assignedToId = (req.subjectType === 'ADMIN' && vendorData.assignedTo)
//         ? vendorData.assignedTo
//         : req.subjectId;

//       // 2. Intelligently set the primary contact person's name
//       const primaryContactName = (contacts.length > 0 && contacts[0].name)
//         ? contacts[0].name
//         : vendorData.vendorName;

//       // --- Database Operations ---

//       // 3. Create the main Vendor record within the transaction
//       const vendor = await Vendor.create({
//         ...vendorData,
//         contactPerson: primaryContactName, // Guaranteed to have a value
//         assignedTo: assignedToId,
//       }, { transaction });

//       // 4. If contacts were provided, create them in bulk
//       if (contacts.length > 0) {
//         const contactPayload = contacts
//           .filter(c => c && c.name) // Ensure contact has a name
//           .map(c => ({
//             ...c,
//             id: undefined, // Let the DB generate the ID
//             vendorId: vendor.id // Link to the newly created vendor
//           }));
        
//         if (contactPayload.length > 0) {
//           await VendorContact.bulkCreate(contactPayload, { transaction });
//         }
//       }

//       // 5. Commit the transaction if all operations were successful
//       await transaction.commit();

//       // --- Final Response ---

//       // 6. Fetch the complete vendor object with all its associations
//       const newVendor = await Vendor.findByPk(vendor.id, {
//         include: [
//           { association: 'assignedMember' }, // Assuming 'assignedMember' is the alias for the Member model
//           { association: 'contacts' }        // Assuming 'contacts' is the alias for the VendorContact model
//         ]
//       });

//       res.status(201).json({ success: true, vendor: newVendor });

//     } catch (error) {
//       // If any error occurred, roll back the transaction
//       await transaction.rollback();
//       console.error('Create Vendor Error:', error);
//       res.status(500).json({ success: false, message: 'Failed to create vendor.' });
//     }
//   }
// );


router.post('/', authenticateToken, [
>>>>>>> origin/main
    body('vendorName').trim().notEmpty().withMessage('Vendor name is required'),
    body('email').optional({ checkFalsy: true }).isEmail().withMessage('Please provide a valid email address'),
    body('website').optional({ checkFalsy: true }).isURL().withMessage('Please provide a valid website URL'),
    body('contacts').optional().isArray().withMessage('Contacts must be an array')
<<<<<<< HEAD
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
=======
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
>>>>>>> origin/main
    }

    const transaction = await sequelize.transaction();

    try {
<<<<<<< HEAD
      const { contacts = [], ...vendorData } = req.body;

      // --- Logic for Ownership and Primary Contact ---

      // 1. Determine who the vendor is assigned to
      let assignedToId = (req.subjectType === 'ADMIN' && vendorData.assignedTo)
        ? vendorData.assignedTo
        : req.subjectId;

      // 2. Intelligently set the primary contact person's name
      const primaryContactName = (contacts.length > 0 && contacts[0].name)
        ? contacts[0].name
        : vendorData.vendorName;

      // --- Database Operations ---

      // 3. Create the main Vendor record within the transaction
      const vendor = await Vendor.create({
        ...vendorData,
        contactPerson: primaryContactName, // Guaranteed to have a value
        assignedTo: assignedToId,
      }, { transaction });

      // 4. If contacts were provided, create them in bulk
      if (contacts.length > 0) {
        const contactPayload = contacts
          .filter(c => c && c.name) // Ensure contact has a name
          .map(c => ({
            ...c,
            id: undefined, // Let the DB generate the ID
            vendorId: vendor.id // Link to the newly created vendor
          }));
        
        if (contactPayload.length > 0) {
          await VendorContact.bulkCreate(contactPayload, { transaction });
        }
      }

      // 5. Commit the transaction if all operations were successful
      await transaction.commit();

      // --- Final Response ---

      // 6. Fetch the complete vendor object with all its associations
      const newVendor = await Vendor.findByPk(vendor.id, {
        include: [
          { association: 'assignedMember' }, // Assuming 'assignedMember' is the alias for the Member model
          { association: 'contacts' }        // Assuming 'contacts' is the alias for the VendorContact model
        ]
      });

      res.status(201).json({ success: true, vendor: newVendor });

    } catch (error) {
      // If any error occurred, roll back the transaction
      await transaction.rollback();
      console.error('Create Vendor Error:', error);
      res.status(500).json({ success: false, message: 'Failed to create vendor.' });
    }
  }
);
=======
        const { contacts = [], ...vendorData } = req.body;

        // 1. Determine who the vendor is assigned to
        let assignedToId;
        let assignedMember = null;
        const isAdminRequest = req.subjectType === 'ADMIN';

        if (isAdminRequest && vendorData.assignedTo) {
            assignedToId = vendorData.assignedTo;
            // Fetch the member to get their email for the notification
            assignedMember = await Member.findByPk(assignedToId);
            if (!assignedMember) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Assigned member not found.' });
            }
        } else {
            assignedToId = req.subjectId;
        }

        // 2. Intelligently set the primary contact person's name
        const primaryContactName = (contacts.length > 0 && contacts[0].name)
            ? contacts[0].name
            : vendorData.vendorName;

        // 3. Create the main Vendor record
        const vendor = await Vendor.create({
            ...vendorData,
            contactPerson: primaryContactName,
            assignedTo: assignedToId,
        }, { transaction });

        // 4. Create associated contacts if provided
        if (contacts.length > 0) {
            const contactPayload = contacts
                .filter(c => c && c.name)
                .map(c => ({ ...c, id: undefined, vendorId: vendor.id }));
            
            if (contactPayload.length > 0) {
                await VendorContact.bulkCreate(contactPayload, { transaction });
            }
        }

        // --- EMAIL NOTIFICATION LOGIC ---
        // If an admin created this and assigned it to another member, send an email.
        if (isAdminRequest && assignedMember && assignedMember.id !== req.subjectId) {
            // **Send the email notification**
            await notifyAssignment(assignedMember, 'Vendor', vendor);
        }

        // 5. Commit the transaction
        await transaction.commit();

        // 6. Fetch and return the complete new vendor object
        const newVendor = await Vendor.findByPk(vendor.id, {
            include: [{ association: 'assignedMember' }, { association: 'contacts' }]
        });

        res.status(201).json({ success: true, vendor: newVendor });

    } catch (error) {
        await transaction.rollback();
        console.error('Create Vendor Error:', error);
        res.status(500).json({ success: false, message: 'Failed to create vendor.' });
    }
});
>>>>>>> origin/main

router.put('/:id', authenticateToken, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const vendor = await Vendor.findByPk(req.params.id);
        if (!vendor) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }

        // **FIX: Use req.subjectType for authorization check**
        if (req.subjectType !== 'ADMIN' && vendor.assignedTo !== req.subjectId) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const { contacts, ...vendorData } = req.body;
        // Prevent non-admins from changing assignment
        if (req.subjectType !== 'ADMIN') {
            delete vendorData.assignedTo;
        }

        await vendor.update(vendorData, { transaction });

        if (Array.isArray(contacts)) {
            await VendorContact.destroy({ where: { vendorId: req.params.id }, transaction });
            const contactPayload = contacts.filter(c => c && c.name).map(c => ({ ...c, id: undefined, vendorId: vendor.id }));
            if (contactPayload.length > 0) {
                await VendorContact.bulkCreate(contactPayload, { transaction });
            }
        }

        await transaction.commit();
        const updatedVendor = await Vendor.findByPk(req.params.id, { include: ['assignedMember', 'contacts'] });
        res.json({ success: true, vendor: updatedVendor });
    } catch (e) {
        await transaction.rollback();
        console.error('Update Vendor Error:', e);
        res.status(500).json({ success: false, message: 'Failed to update vendor.' });
    }
});

router.delete('/:id', authenticateToken, isAdmin, async (req, res) => {
    try {
        const count = await Vendor.destroy({ where: { id: req.params.id } });
        if (count === 0) {
            return res.status(404).json({ success: false, message: 'Vendor not found' });
        }
        res.status(200).json({ success: true, message: 'Vendor deleted.' });
    } catch (e) {
        console.error('Delete Vendor Error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete vendor.' });
    }
});

router.post('/bulk-delete', authenticateToken, isAdmin, [
    body('ids').isArray({ min: 1 }).withMessage('Vendor IDs must be an array')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { ids } = req.body;
        await Vendor.destroy({ where: { id: { [Op.in]: ids } } });
        res.status(200).json({ success: true, message: `${ids.length} vendors deleted.` });
    } catch (e) {
        console.error('Bulk Delete Error:', e);
        res.status(500).json({ success: false, message: 'Failed to delete vendors.' });
    }
});

module.exports = router;
