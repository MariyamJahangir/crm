// routes/followups.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Lead = require('../models/Lead');
const Member = require('../models/Member');
const LeadFollowup = require('../models/LeadFollowup');
const router = express.Router();
const LeadLog = require('../models/LeadLog');
function canViewLead(req, lead) {
  if (isAdmin(req)) return true;
  const self = String(req.subjectId);
  return (String(lead.creatorId) === self && lead.creatorType === 'MEMBER') || (String(lead.salesmanId) === self);
}
function actorLabel(req) { return req.subjectType === 'ADMIN' ? 'Admin' : 'Member'; }
async function resolveActorName(req) {
  if (req.subjectType === 'ADMIN') return 'Admin';
  if (req.subjectType === 'MEMBER') {
    const m = await Member.findByPk(req.subjectId, { attributes: ['name'] });
    return m?.name || 'Member';
  }
  return 'System';
}
async function writeLeadLog(req, leadId, action, message) {
  const actorName = await resolveActorName(req);
  const created = await LeadLog.create({
    leadId,
    action,
    message,
    actorType: req.subjectType,
    actorId: req.subjectId,
    actorName
  });
  req.app.get('io')?.to(`lead:${leadId}`).emit('log:new', {
    leadId: String(leadId),
    log: {
      id: created.id,
      action: created.action,
      message: created.message,
      actorType: created.actorType,
      actorId: created.actorId,
      actorName: created.actorName,
      createdAt: created.createdAt
    }
  });
  return created;
}
function canModifyLead(req, lead) {
  if (isAdmin(req)) return true;
  const self = String(req.subjectId);
  return (String(lead.salesmanId) === self) || (lead.creatorType === 'MEMBER' && String(lead.creatorId) === self);
}

// GET /api/followups/:leadId -> list followups ordered by createdAt DESC
// router.get('/:leadId', authenticateToken, async (req, res) => {
//   try {
//     const lead = await Lead.findByPk(req.params.leadId, {
//       include: [{ model: Member, as: 'salesman', attributes: ['id','name','email'] }]
//     });
//     if (!lead) return res.status(404).json({ success:false, message:'Not found' });
//     if (!canViewLead(req, lead)) return res.status(403).json({ success:false, message:'Forbidden' });

//     const rows = await LeadFollowup.findAll({
//       where: { leadId: lead.id },
//       order: [['createdAt','DESC']]
//     });

//     res.json({
//       success: true,
//       followups: rows.map(f => ({
//         id: f.id,
//         status: f.status,
//         description: f.description || '',
//         scheduledAt: f.scheduledAt,
//         createdAt: f.createdAt
//       }))
//     });
//   } catch (e) {
//     console.error('Followups list error:', e);
//     res.status(500).json({ success:false, message:'Server error' });
//   }
// });

// POST /api/followups/:leadId -> create followup
router.post('/:leadId', authenticateToken, [
  body('status').trim().isIn(['Followup', 'Meeting Scheduled', 'No Requirement', 'No Response']),
  body('description').optional().isString(),
  body('scheduledAt').optional().isISO8601(),
], async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.leadId, {
      include: [{ model: Member, as: 'salesman', attributes: ['id','name','email'] }]
    });
    if (!lead) return res.status(404).json({ success:false, message:'Not found' });
    if (!canModifyLead(req, lead)) return res.status(403).json({ success:false, message:'Forbidden' });

    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success:false, message:'Validation failed', errors: errors.array() });

    const { status, description, scheduledAt } = req.body;

    const created = await LeadFollowup.create({
      leadId: lead.id,
      status,
      description: description || '',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      createdByType: req.subjectType,
      createdById: req.subjectId
    });
await writeLeadLog(req, lead.id, 'FOLLOWUP_ADDED', `${actorLabel(req)} added followup: ${created.status}`);
    // Socket notify room subscribers
    const io = req.app.get('io');
    io?.to(`lead:${lead.id}`).emit('followup:new', {
      leadId: String(lead.id),
      followup: {
        id: created.id,
        status: created.status,
        description: created.description || '',
        scheduledAt: created.scheduledAt,
        createdAt: created.createdAt
      }
    });

    res.status(201).json({
      success: true,
      followup: {
        id: created.id,
        status: created.status,
        description: created.description || '',
        scheduledAt: created.scheduledAt,
        createdAt: created.createdAt
      }
    });
  } catch (e) {
    console.error('Followup create error:', e);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

module.exports = router;
