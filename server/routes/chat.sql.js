const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Lead = require('../models/Lead');
const ChatMessage = require('../models/ChatMessage');

const router = express.Router();

/**
 * Checks if the current user (req) can access and talk in the lead chat.
 * Admins have access to everything.
 * Members can access if they created the lead or are the assigned salesman.
 */
async function canTalk(req, lead) {
  if (isAdmin(req)) return true;

  const userId = String(req.subjectId);
  return (
    (lead.creatorType === 'MEMBER' && String(lead.creatorId) === userId) ||
    (String(lead.salesmanId) === userId)
  );
}

/**
 * GET /leads/:id/chat
 * Returns all chat messages for a lead if the user has access.
 */
router.get('/leads/:id/chat', authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = await Lead.findByPk(leadId);
    if (!lead) return res.status(404).json({ success: false, message: 'not found' });

    const access = await canTalk(req, lead);
    if (!access) return res.status(403).json({ success: false, message: 'forbidden' });

    const messages = await ChatMessage.findAll({
      where: { leadId: lead.id },
      order: [['createdAt', 'ASC']],
    });

    res.json({ success: true, messages }); // Returns raw DB objects; no change to field names
  } catch (error) {
    console.error('Chat messages fetch error:', error);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

/**
 * POST /leads/:id/chat
 * Creates a new chat message in the lead if the user has access.
 */
router.post('/leads/:id/chat', authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = await Lead.findByPk(leadId);
    if (!lead) return res.status(404).json({ success: false, message: 'not found' });

    const access = await canTalk(req, lead);
    if (!access) return res.status(403).json({ success: false, message: 'forbidden' });

    const { text = '', attachments = [] } = req.body;

    if (typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({ success: false, message: 'text is required and must not be empty' });
    }

    const message = await ChatMessage.create({
      leadId: lead.id,
      fromType: req.subjectType,
      fromId: req.subjectId,
      text: text.trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    // Emit via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`lead:${String(lead.id)}`).emit('chat:new', message);
    }

    res.status(201).json({ success: true, message }); // Return created message unaltered
  } catch (error) {
    console.error('Chat message create error:', error);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

module.exports = router;
