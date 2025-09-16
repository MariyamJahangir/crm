// routes/notifications.sql.js
const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Notification = require('../models/Notification');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { memberId, unread } = req.query;
    let where = {};
    if (isAdmin(req)) {
      if (memberId) where = { toType: 'MEMBER', toId: String(memberId) };
    } else {
      where = { toType: 'MEMBER', toId: String(req.subjectId) };
    }
    if (unread === 'true') where.read = false;

    const notifications = await Notification.findAll({ where, order: [['createdAt','DESC']], limit: 200 });
    res.json({ success: true, notifications });
  } catch (e) {
    console.error('List notifications error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const n = await Notification.findByPk(req.params.id);
    if (!n) return res.status(404).json({ success:false, message:'Not found' });
    const canMark = isAdmin(req) || (n.toType === req.subjectType && String(n.toId) === String(req.subjectId));
    if (!canMark) return res.status(403).json({ success:false, message:'Forbidden' });
    await n.update({ read: true });
    res.json({ success:true });
  } catch (e) {
    console.error('Mark read error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

router.post('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    // This action is only available for non-admin members for their own notifications.
    if (isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Admins cannot use this feature directly.' });
    }

    const whereClause = {
      toType: 'MEMBER',
      toId: String(req.subjectId),
      read: false // Only update unread notifications
    };

    await Notification.update({ read: true }, { where: whereClause });

    res.json({ success: true });
  } catch (e) {
    console.error('Mark all read error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
