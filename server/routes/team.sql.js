// routes/team.sql.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Member = require('../models/Member');

const router = express.Router();

router.post('/users', authenticateToken, [
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('designation').optional().isString().trim(),
], async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success:false, message:'Forbidden' });
    const errors = validationResult(req); if (!errors.isEmpty())
      return res.status(400).json({ success:false, message:'Validation failed', errors: errors.array() });

    const { name, email, password, designation } = req.body;
    const exists = await Member.findOne({ where: { email } });
    if (exists) return res.status(400).json({ success:false, message:'Email already in use' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const created = await Member.create({ name, email, password: hash, designation: designation || '', parentAdmin: req.subjectId });
    res.status(201).json({ success:true, user: { id: created.id, name: created.name, email: created.email, designation: created.designation, role: 'MEMBER', parent: created.parentAdmin, createdAt: created.createdAt } });
  } catch (e) {
    console.error('Create member error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.get('/users', authenticateToken, async (req, res) => {
  try {
    if (isAdmin(req)) {
      const users = await Member.findAll({ attributes: ['id','name','email','designation','parentAdmin','createdAt'], order: [['createdAt','DESC']] });
 
      return res.json({ success:true, users });
    } else {
      const u = await Member.findByPk(req.subjectId, { attributes: ['id','name','email','designation','parentAdmin','createdAt'] });
      if (!u) return res.status(404).json({ success:false, message:'User not found' });
      return res.json({ success:true, users: [u] });
    }
  } catch (e) {
    console.error('List users error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const u = await Member.findByPk(req.params.id, { attributes: ['id','name','email','designation','parentAdmin','createdAt'] });
    if (!u) return res.status(404).json({ success:false, message:'Not found' });
    if (!isAdmin(req) && String(u.id) !== String(req.subjectId)) return res.status(403).json({ success:false, message:'Forbidden' });
    res.json({ success:true, user: u });
  } catch (e) {
    console.error('Get user error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.put('/users/:id', authenticateToken, [
  body('name').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail(),
  body('designation').optional().isString().trim(),
  body('password').optional().isLength({ min: 6 }),
], async (req, res) => {
  try {
    const u = await Member.findByPk(req.params.id);
    if (!u) return res.status(404).json({ success:false, message:'Not found' });
    const own = String(u.id) === String(req.subjectId);
    if (!isAdmin(req) && !own) return res.status(403).json({ success:false, message:'Forbidden' });

    const { name, email, designation, password } = req.body;
    if (email) {
      const exists = await Member.findOne({ where: { email } });
      if (exists && String(exists.id) !== String(u.id)) return res.status(400).json({ success:false, message:'Email already in use' });
    }
    const up = {};
    if (name !== undefined) up.name = name;
    if (email !== undefined) up.email = email;
    if (designation !== undefined) up.designation = designation;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      up.password = await bcrypt.hash(password, salt);
    }
    await u.update(up);
    res.json({ success:true, user: { id: u.id, name: u.name, email: u.email, designation: u.designation, role: 'MEMBER', parent: u.parentAdmin, createdAt: u.createdAt } });
  } catch (e) {
    console.error('Update user error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (!isAdmin(req)) return res.status(403).json({ success:false, message:'Forbidden' });
    const u = await Member.findByPk(req.params.id);
    if (!u) return res.status(404).json({ success:false, message:'Not found' });
    await u.destroy();
    res.status(204).send();
  } catch (e) {
    console.error('Delete user error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

module.exports = router;
