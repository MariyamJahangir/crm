const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Lead = require('../models/Lead');
const Member = require('../models/Member');
const LeadFollowup = require('../models/LeadFollowup');
const LeadLog = require('../models/LeadLog');

const router = express.Router();

/**
 * Check if user can view the given lead.
 * Admins always can. Members if they are creator or assigned salesman.
 */
function canViewLead(req, lead) {
  if (isAdmin(req)) return true;
  const userId = String(req.subjectId);
  return (
    (lead.creatorType === 'MEMBER' && String(lead.creatorId) === userId) ||
    (String(lead.salesmanId) === userId)
  );
}

/**
 * Check if user can modify the given lead.
 * Same as canView except members must be creator or salesman.
 */
function canModifyLead(req, lead) {
  if (isAdmin(req)) return true;
  const userId = String(req.subjectId);
  return (
    (lead.creatorType === 'MEMBER' && String(lead.creatorId) === userId) ||
    (String(lead.salesmanId) === userId)
  );
}

/**
 * Get textual label for actor type.
 */
function actorLabel(req) {
  return req?.subjectType === 'ADMIN' ? 'Admin' : 'Member';
}

/**
 * Resolve actor's display name for logs.
 */
async function resolveActorName(req) {
  if (req.subjectType === 'ADMIN') return 'Admin';
  if (req.subjectType === 'MEMBER') {
    const user = await Member.findByPk(req.subjectId, { attributes: ['name'] });
    return user?.name || 'Member';
  }
  return 'System';
}

/**
 * Write a log entry for lead action and emit via socket.
 */
async function writeLeadLog(req, leadId, action, message) {
  const actorName = await resolveActorName(req);
  const logEntry = await LeadLog.create({
    leadId,
    action,
    message,
    actorType: req.subjectType,
    actorId: req.subjectId,
    actorName,
  });
  req.app.get('io')?.to(`lead:${leadId}`).emit('log:new', {
    leadId: String(leadId),
    log: {
      id: logEntry.id,
      action: logEntry.action,
      message: logEntry.message,
      actorType: logEntry.actorType,
      actorId: logEntry.actorId,
      actorName: logEntry.actorName,
      createdAt: logEntry.createdAt,
    },
  });
  return logEntry;
}

/**
 * GET /:leadId
 * List all follow-ups for given lead if authorized.
 */
router.get('/:leadId', authenticateToken, async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.leadId, {
      include: [{ model: Member, as: 'salesman', attributes: ['id', 'name', 'email'] }],
    });
    if (!lead) return res.status(404).json({ success: false, message: 'not found' });

    if (!canViewLead(req, lead)) return res.status(403).json({ success: false, message: 'forbidden' });

    const followups = await LeadFollowup.findAll({
      where: { leadId: lead.id },
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      followups: followups.map(fu => ({
        id: fu.id,
        status: fu.status,
        description: fu.description || '',
        scheduledAt: fu.scheduledAt,
        createdAt: fu.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching followups:', error);
    res.status(500).json({ success: false, message: 'server error' });
  }
});

/**
 * POST /:leadId
 * Add a new follow-up for the lead if authorized.
 */
router.post(
  '/:leadId',
  authenticateToken,
  [
    body('status').trim().isIn(['Followup', 'Meeting Scheduled', 'No Requirement', 'No Response']),
    body('description').optional().isString(),
    body('scheduledAt').optional().isISO8601(),
  ],
  async (req, res) => {
    try {
      const lead = await Lead.findByPk(req.params.leadId, {
        include: [{ model: Member, as: 'salesman', attributes: ['id', 'name', 'email'] }],
      });
      if (!lead) return res.status(404).json({ success: false, message: 'not found' });

      if (!canModifyLead(req, lead)) return res.status(403).json({ success: false, message: 'forbidden' });

      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, message: 'validation failed', errors: errors.array() });

      const { status, description, scheduledAt } = req.body;
      const newFollowup = await LeadFollowup.create({
        leadId: lead.id,
        status,
        description: description || '',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdByType: req.subjectType,
        createdById: req.subjectId,
      });

      await writeLeadLog(req, lead.id, 'FOLLOWUP_ADDED', `${actorLabel(req)} added follow-up: ${status}`);

      req.app.get('io')?.to(`lead:${lead.id}`).emit('followup:new', {
        leadId: String(lead.id),
        followup: {
          id: newFollowup.id,
          status: newFollowup.status,
          description: newFollowup.description || '',
          scheduledAt: newFollowup.scheduledAt,
          createdAt: newFollowup.createdAt,
        },
      });

      res.status(201).json({
        success: true,
        followup: {
          id: newFollowup.id,
          status: newFollowup.status,
          description: newFollowup.description || '',
          scheduledAt: newFollowup.scheduledAt,
          createdAt: newFollowup.createdAt,
        },
      });
    } catch (error) {
      console.error('Error creating followup:', error);
      res.status(500).json({ success: false, message: 'server error' });
    }
  }
);

module.exports = router;
