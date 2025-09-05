// routes/auth.sql.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const Member = require('../models/Member');
const { authenticateToken } = require('../middleware/auth');
const { sendOTPEmail } = require('../utils/emailService');
const { createOrUpdateOtp, verifyOtp, canResend } = require('../utils/otp.sql');

const router = express.Router();
const sign = (subjectType, subjectId) =>
  jwt.sign({ subjectType, subjectId }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });

router.post('/login', [ body('email').isEmail(), body('password').isLength({ min: 1 }) ], async (req, res) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty())
      return res.status(400).json({ success:false, message:'Validation failed', errors: errors.array() });
    const { email, password } = req.body;

    let subjectType = 'ADMIN';
    let u = await Admin.findOne({ where: { email } });
    if (!u) { subjectType = 'MEMBER'; u = await Member.findOne({ where: { email } }); }
    if (!u) return res.status(400).json({ success:false, message:'Invalid credentials' });

    const ok = await bcrypt.compare(password, u.password);
    if (!ok) return res.status(400).json({ success:false, message:'Invalid credentials' });

    const token = sign(subjectType, u.id);
    res.json({ success:true, message:'Login successful', token, user: { id: u.id, name: u.name, email: u.email, type: subjectType } });
  } catch (e) {
    console.error('Login Error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.post('/forgot-password', [ body('email').isEmail() ], async (req, res) => {
  try {
    const { email } = req.body;
    let subjectType = 'ADMIN';
    let u = await Admin.findOne({ where: { email } });
    if (!u) { subjectType = 'MEMBER'; u = await Member.findOne({ where: { email } }); }
    if (!u) return res.status(404).json({ success:false, message:'User not found' });

    const { code } = await createOrUpdateOtp(subjectType, u.id, 'RESET');
    await sendOTPEmail(email, code, 'Password Reset');
    res.json({ success:true, message:'Password reset OTP sent to your email' });
  } catch (e) {
    console.error('Forgot Password Error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.post('/resend-otp', [ body('email').isEmail() ], async (req, res) => {
  try {
    const { email } = req.body;
    let subjectType = 'ADMIN';
    let u = await Admin.findOne({ where: { email } });
    if (!u) { subjectType = 'MEMBER'; u = await Member.findOne({ where: { email } }); }
    if (!u) return res.status(404).json({ success:false, message:'User not found' });

    const allowed = await canResend(subjectType, u.id, 'RESET');
    if (!allowed) return res.status(429).json({ success:false, message:'Please wait before resending' });

    const { code } = await createOrUpdateOtp(subjectType, u.id, 'RESET');
    await sendOTPEmail(email, code, 'Password Reset');
    res.json({ success:true, message:'OTP resent' });
  } catch (e) {
    console.error('Resend OTP Error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.post('/reset-password', [
  body('email').isEmail(),
  body('otp').isLength({ min: 6, max: 6 }),
  body('password').isLength({ min: 6 }),
  body('confirmPassword').custom((v, { req }) => v === req.body.password),
], async (req, res) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty())
      return res.status(400).json({ success:false, message:'Validation failed', errors: errors.array() });

    const { email, otp, password } = req.body;
    let subjectType = 'ADMIN';
    let u = await Admin.findOne({ where: { email } });
    if (!u) { subjectType = 'MEMBER'; u = await Member.findOne({ where: { email } }); }
    if (!u) return res.status(404).json({ success:false, message:'User not found' });

    const vr = await verifyOtp(subjectType, u.id, 'RESET', otp);
    if (!vr.ok) return res.status(400).json({ success:false, message: vr.reason === 'EXPIRED' ? 'OTP expired' : 'Invalid OTP' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await u.update({ password: hash });

    res.json({ success:true, message:'Password reset successfully' });
  } catch (e) {
    console.error('Reset Password Error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const Model = req.subjectType === 'ADMIN' ? Admin : Member;
    const u = await Model.findByPk(req.subjectId, { attributes: ['id','name','email'] });
    if (!u) return res.status(404).json({ success:false, message:'User not found' });
    res.json({ success:true, user: { id: u.id, name: u.name, email: u.email, subjectType: req.subjectType } });
  } catch (e) {
    console.error('Me Error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

module.exports = router;
