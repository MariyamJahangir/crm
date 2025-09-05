// routes/chat.sql.js
const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Lead = require('../models/Lead');
const ChatMessage = require('../models/ChatMessage');

const router = express.Router();

async function canTalk(req, lead) {
  if (isAdmin(req)) return true;
  return (lead.creatorType === 'MEMBER' && String(lead.creatorId) === String(req.subjectId)) ||
         (String(lead.salesmanId) === String(req.subjectId));
}

router.get('/leads/:id/chat', authenticateToken, async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) return res.status(404).json({ success:false, message:'Not found' });
  if (!await canTalk(req, lead)) return res.status(403).json({ success:false, message:'Forbidden' });
  const msgs = await ChatMessage.findAll({ where: { leadId: lead.id }, order: [['createdAt','ASC']] });
  res.json({ success:true, messages: msgs });
});

router.post('/leads/:id/chat', authenticateToken, async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) return res.status(404).json({ success:false, message:'Not found' });
  if (!await canTalk(req, lead)) return res.status(403).json({ success:false, message:'Forbidden' });

  const text = (req.body.text || '').trim();
  const attachments = Array.isArray(req.body.attachments) ? req.body.attachments : [];
  const msg = await ChatMessage.create({ leadId: lead.id, fromType: req.subjectType, fromId: req.subjectId, text, attachments });

  const io = req.app.get('io');
  io?.to(`lead:${String(lead.id)}`).emit('chat:new', msg);
  res.status(201).json({ success:true, message: msg });
});

module.exports = router;
