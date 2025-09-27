const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Member = require('../models/Member');
const { notifyUserCreated} = require('../utils/emailService')
const router = express.Router();


router.post(
  '/users',
  authenticateToken,
  [
    body('name').trim().isLength({ min: 2 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('designation').optional().isString().trim(),
  ],
  async (req, res) => {
    try {
      if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });

      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });

      const { name, email, password, designation } = req.body;
      const existing = await Member.findOne({ where: { email } });
      if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);

      const created = await Member.create({
        name,
        email,
        password: hash,
        designation: designation || '',
        parentAdmin: req.subjectId,
      });
await notifyUserCreated(created, password); 
      res.status(201).json({
        success: true,
        user: {
          id: created.id,
          name: created.name,
          email: created.email,
          isBlocked: created.isBlocked,
          designation: created.designation,
          role: 'MEMBER',
          parent: created.parentAdmin,
          createdAt: created.createdAt,
        },
      });
    } catch (e) {
      console.error('Create member error:', e);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

router.get('/for-selection', authenticateToken, async (req, res) => {
    try {
        const users = await Member.findAll({
            where: {
                isBlocked: false, 
            },
            attributes: ['id', 'name', 'isBlocked'], // Send only necessary data
            order: [['name', 'ASC']],
        });
        res.json({ success: true, users });
    } catch (e) {
        console.error("Fetch members for selection error:", e);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
router.get('/users', authenticateToken, async (req, res) => {
  try {
      const whereClause = { isDeleted: false}; 
    if (isAdmin(req)) {
     const users = await Member.findAll({
                where: whereClause,
                attributes: ['id', 'name', 'email', 'designation', 'parentAdmin', 'isBlocked', 'createdAt'],
                order: [['createdAt', 'DESC']],
            });
            return res.json({ success: true, users });
    } else {
    whereClause.id = req.subjectId; // Non-admin can only see themselves
            const user = await Member.findOne({
                where: whereClause,
                attributes: ['id', 'name', 'email', 'designation', 'parentAdmin', 'isBlocked', 'createdAt'],
            });
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      return res.json({ success: true, users: [user] });
    }
  } catch (e) {
    console.error('List users error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Get single user by ID
router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const user = await Member.findByPk(req.params.id, {
      attributes: ['id', 'name', 'email', 'designation', 'parentAdmin', 'createdAt', 'isBlocked'],
    });
     if (!user || user.isDeleted) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }
    if (!isAdmin(req) && String(user.id) !== String(req.subjectId))
      return res.status(403).json({ success: false, message: 'Forbidden' });
     const { password, isDeleted, ...userData } = user.get({ plain: true });
        res.json({ success: true, user: userData });
  } catch (e) {
    console.error('Get user error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update user by ID
router.put(
  '/users/:id',
  authenticateToken,
  [
    body('name').optional().trim().isLength({ min: 2 }),
    body('email').optional().isEmail(),
    body('designation').optional().isString().trim(),
    body('password').optional().isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const user = await Member.findByPk(req.params.id);
      
        if (!user || user.isDeleted) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }

      const ownUser = String(user.id) === String(req.subjectId);
      if (!isAdmin(req) && !ownUser) return res.status(403).json({ success: false, message: 'Forbidden' });

      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });

      const { name, email, designation, password } = req.body;

      if (email) {
        const exists = await Member.findOne({ where: { email } });
        if (exists && String(exists.id) !== String(user.id))
          return res.status(400).json({ success: false, message: 'Email already in use' });
      }

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email;
      if (designation !== undefined) updates.designation = designation;
      if (password) {
        const salt = await bcrypt.genSalt(10);
        updates.password = await bcrypt.hash(password, salt);
      }

      await user.update(updates);

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          designation: user.designation,
          role: 'MEMBER',
          parent: user.parentAdmin,
          createdAt: user.createdAt,
        },
      });
    } catch (e) {
      console.error('Update user error:', e);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

// Delete user by ID - admin only
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const user = await Member.findByPk(req.params.id);
     if (!user || user.isDeleted) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }
         await user.update({ isDeleted: true });
    res.status(204).send();
  } catch (e) {
    console.error('Delete user error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.post('/users/:id/block', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const user = await Member.findByPk(req.params.id);
    if (!user || user.isDeleted) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }
    if (String(user.id) === String(req.subjectId))
      return res.status(400).json({ success: false, message: 'Cannot block yourself' });
    if (!user.isBlocked) {
      await user.update({ isBlocked: true });
    }
    res.json({ success: true, user: { id: user.id, isBlocked: user.isBlocked } });
  } catch (e) {
    console.error('Block user error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/users/:id/unblock', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const user = await Member.findByPk(req.params.id);
  if (!user || user.isDeleted) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }
    if (user.isBlocked) {
      await user.update({ isBlocked: false });
    }
    res.json({ success: true, user: { id: user.id, isBlocked: user.isBlocked } });
  } catch (e) {
    console.error('Unblock user error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


module.exports = router;
