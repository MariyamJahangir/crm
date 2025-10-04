// routes/leadFollowup.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Lead = require('../models/Lead');
const Member = require('../models/Member');
const LeadFollowup = require('../models/LeadFollowup');
const LeadLog = require('../models/LeadLog');
const { notifyLeadUpdate, scheduleFollowupReminders } = require('../utils/emailService');
const ShareGp = require('../models/ShareGp');
const router = express.Router();

async function canAccessLead(req, lead) {
    if (isAdmin(req)) return true;

    const userId = String(req.subjectId);
    if (String(lead.creatorId) === userId || String(lead.salesmanId) === userId) {
        return true;
    }
    
    // Check if the lead is shared with the current user
    const share = await ShareGp.findOne({
        where: { leadId: lead.id, sharedMemberId: userId },
    });
    return !!share;
}

function canViewLead(req, lead) {
  if (isAdmin(req)) return true;
  const userId = String(req.subjectId);
  return (
    (lead.creatorType === 'MEMBER' && String(lead.creatorId) === userId) ||
    (String(lead.salesmanId) === userId)
  );
}

function canModifyLead(req, lead) {
  if (isAdmin(req)) return true;
  const userId = String(req.subjectId);
  return (
    (lead.creatorType === 'MEMBER' && String(lead.creatorId) === userId) ||
    (String(lead.salesmanId) === userId)
  );
}

function actorLabel(req) {
  return req?.subjectType === 'ADMIN' ? 'Admin' : 'Member';
}

async function resolveActorName(req) {
  if (req.subjectType === 'ADMIN') return 'Admin';
  if (req.subjectType === 'MEMBER') {
    const user = await Member.findByPk(req.subjectId, { attributes: ['name'] });
    return user?.name || 'Member';
  }
  return 'System';
}

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
        const lead = await Lead.findByPk(req.params.leadId);
        if (!lead) return res.status(404).json({ success: false, message: 'Not found' });

        // UPDATED: Use the new async permission check
        if (!(await canAccessLead(req, lead))) {
            return res.status(403).json({ success: false, message: 'Forbfghfidden' });
        }

        const followups = await LeadFollowup.findAll({
            where: { leadId: lead.id },
            order: [['createdAt', 'DESC']],
        });

        res.json({
            success: true,
            followups: followups.map(fu => fu.toJSON()),
        });
    } catch (error) {
        console.error('Error fetching followups:', error);
        res.status(500).json({ success: false, message: 'Server error' });
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
        body('scheduleReminder').optional().isIn(['30m', '1hr', '3hr', '5hr', '7hr', '10hr', '12hr', '24hr']),
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        try {
            // UPDATED: Include creator, salesman, AND sharedWith
            const lead = await Lead.findByPk(req.params.leadId, {
                include: [
                    { model: Member, as: 'salesman' },
                    { model: Member, as: 'creator' },
                    { model: Member, as: 'sharedWith' }, 
                ],
            });
            if (!lead) return res.status(404).json({ success: false, message: 'Not found' });

            // UPDATED: Use the new async permission check
            if (!(await canAccessLead(req, lead))) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }

            const { status, description, scheduledAt, scheduleReminder } = req.body;
            const newFollowup = await LeadFollowup.create({
                leadId: lead.id,
                status,
                description: description || '',
                scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
                scheduleReminder: scheduleReminder || null,
                createdByType: req.subjectType,
                createdById: req.subjectId,
            });

            await writeLeadLog(req, lead.id, 'FOLLOWUP_ADDED', `${actorLabel(req)} added follow-up: ${status}`);

            if (newFollowup.scheduledAt) {
                // CORRECTLY gathers all relevant recipients
                const recipients = new Set();
                if (lead.salesman?.email) recipients.add(lead.salesman.email);
                if (lead.creator?.email) recipients.add(lead.creator.email);
                lead.sharedWith?.forEach(member => {
                    if (member.email) recipients.add(member.email);
                });
                
                if (recipients.size > 0) {
                    await scheduleFollowupReminders(newFollowup, lead, Array.from(recipients));
                }
            }

            req.app.get('io')?.to(`lead:${lead.id}`).emit('followup:new', {
                leadId: String(lead.id),
                followup: newFollowup.toJSON(),
            });

            res.status(201).json({
                success: true,
                followup: newFollowup.toJSON(),
            });
        } catch (error) {
            console.error('Error creating followup:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
);

module.exports = router;
