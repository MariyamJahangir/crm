const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Lead = require('../models/Lead');
const Member = require('../models/Member');
const Customer = require('../models/Customer');
const CustomerContact = require('../models/CustomerContact');
const Notification = require('../models/Notification');
const { Op } = require('sequelize');
const { makeUploader } = require('../upload/uploader');
const LeadFollowup = require('../models/LeadFollowup');
const LeadLog = require('../models/LeadLog');
const fs = require('fs/promises');
const path = require('path');
const router = express.Router();
const { createNotification, notifyAdmins } = require('../utils/notify');
const {  notifyAssignment ,notifyLeadUpdate  } = require('../utils/emailService')
const BASE_DIR = path.resolve(process.cwd());
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
const STAGES = Lead.STAGES;
const FORECASTS = Lead.FORECASTS;
const { sequelize } = require('../config/database');
const Counter = require('../models/Counter');
const ShareGp= require('../models/ShareGp')

async function canViewLead(req, lead) {
  if (isAdmin(req)) return true;
  const currentUserId = String(req.subjectId);

  if (String(lead.creatorId) === currentUserId || String(lead.salesmanId) === currentUserId) {
    return true;
  }
  const share = await ShareGp.findOne({
    where: {
      leadId: lead.id,
      sharedMemberId: currentUserId,
    },
  });

  return !!share;
}

function canModifyLead(req, lead) {
  if (isAdmin(req)) return true;
  const self = String(req.subjectId);
  return (String(lead.salesmanId) === self) || (lead.creatorType === 'MEMBER' && String(lead.creatorId) === self);
}

const { upload, toPublicUrl } = makeUploader('lead_attachments');

async function generateUniqueLeadNumber(transaction) {
    const counter = await Counter.findOne({
      where: { name: 'leadNumber' },
      lock: transaction.LOCK.UPDATE,
      transaction: transaction,
    });

    if (!counter) {
      throw new Error('The "leadNumber" counter has not been initialized in the database.');
    }

    counter.currentValue += 1;
    await counter.save({ transaction: transaction });
    return `L-${String(counter.currentValue).padStart(6, '0')}`;
}


// Logging helpers
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

// Compute nearest future follow-up (returns Date or null)
function nearestFutureFollowup(rows) {
    const now = new Date();
    // Ensure all items are plain objects
    const flat = rows.map(r => (typeof r.get === 'function' ? r.get({ plain: true }) : r));
    
    // Filter for dates in the future and sort them to find the soonest
    const future = flat
      .filter(r => r.scheduledAt && new Date(r.scheduledAt) > now)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  
    // CORRECTED: Return the 'scheduledAt' property of the first item in the sorted array
    return future.length > 0 ? future[0].scheduledAt : null;
}

// Delete attachment (DELETE)
router.delete('/:id/attachments', authenticateToken, async (req, res) => {
  try {
    const { filename, url } = req.body || {};
    if (!filename || !url) return res.status(400).json({ success: false, message: 'filename and url required' });

    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Not found' });
    if (!canModifyLead(req, lead)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const list = Array.isArray(lead.attachmentsJson) ? lead.attachmentsJson : [];
    const idx = list.findIndex(a => a.filename === filename && a.url === url);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Attachment not found' });

    const [removed] = list.splice(idx, 1);
    lead.attachmentsJson = list;
    await lead.save();

    if (/^\/uploads\//.test(url)) {
      const rel = url.replace(/^\/uploads\//, '');
      const filePath = path.join(UPLOADS_DIR, rel);
      if (filePath.startsWith(UPLOADS_DIR)) {
        try { await fs.unlink(filePath); } catch (e) { console.warn('unlink failed:', e?.message); }
      } else {
        console.warn('unlink skipped: path outside uploads:', filePath);
      }
    } else {
      console.warn('unlink skipped: non-uploads url', url);
    }

    const io = req.app.get('io');
    io?.to(`lead:${lead.id}`).emit('attachment:deleted', { leadId: String(lead.id), attachment: removed });

    await writeLeadLog(req, lead.id, 'ATTACHMENT_DELETED', `${actorLabel(req)} removed attachment ${removed.filename}`);

    res.json({ success: true });
  } catch (e) {
    console.error('Delete attachment error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete attachment (POST alias)
router.post('/:id/attachments/delete', authenticateToken, async (req, res) => {
  try {
    const { filename, url } = req.body || {};
    if (!filename || !url) return res.status(400).json({ success: false, message: 'filename and url required' });

    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Not found' });
    if (!canModifyLead(req, lead)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const list = Array.isArray(lead.attachmentsJson) ? lead.attachmentsJson : [];
    const idx = list.findIndex(a => a.filename === filename && a.url === url);
    if (idx === -1) return res.status(404).json({ success: false, message: 'Attachment not found' });

    const [removed] = list.splice(idx, 1);
    lead.attachmentsJson = list;
    await lead.save();

    if (/^\/uploads\//.test(url)) {
      const rel = url.replace(/^\/uploads\//, '');
      const filePath = path.join(UPLOADS_DIR, rel);
      if (filePath.startsWith(UPLOADS_DIR)) {
        try { await fs.unlink(filePath); } catch (e) { console.warn('unlink failed:', e?.message); }
      } else {
        console.warn('unlink skipped: path outside uploads:', filePath);
      }
    } else {
      console.warn('unlink skipped: non-uploads url', url);
    }

    const io = req.app.get('io');
    io?.to(`lead:${lead.id}`).emit('attachment:deleted', { leadId: String(lead.id), attachment: removed });

    await writeLeadLog(req, lead.id, 'ATTACHMENT_DELETED', `${actorLabel(req)} removed attachment ${removed.filename}`);

    res.json({ success: true });
  } catch (e) {
    console.error('Delete attachment error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Upload attachments
router.post('/:id/attachments', authenticateToken, upload.array('files', 10), async (req, res) => {
    try {
        // Include the salesman details in the initial query
        const lead = await Lead.findByPk(req.params.id, {
            include: { model: Member, as: 'salesman' }
        });
        if (!lead) return res.status(404).json({ success: false, message: 'Not found' });
        
        // Assuming canModifyLead is a valid function in your scope
        // if (!canModifyLead(req, lead)) return res.status(403).json({ success: false, message: 'Forbidden' });

        const files = req.files || [];
        if (!files.length) return res.status(400).json({ success: false, message: 'No files uploaded' });

        const now = new Date();
        const newAttachments = files.map(f => ({
            filename: f.originalname,
            url: toPublicUrl(f.path),
            createdAt: now.toISOString(),
            uploadedBy: req.subjectId,
        }));

        const current = Array.isArray(lead.attachmentsJson) ? lead.attachmentsJson : [];
        const added = [];
        for (const att of newAttachments) {
            if (!current.some(x => x.url === att.url && x.filename === att.filename)) {
                current.push(att);
                added.push(att);
            }
        }
        lead.attachmentsJson = current;
        await lead.save();

        const io = req.app.get('io');
        added.forEach(att => {
            io?.to(`lead:${lead.id}`).emit('attachment:new', { leadId: String(lead.id), attachment: att });
        });

        if (added.length) {
            await writeLeadLog(req, lead.id, 'ATTACHMENT_ADDED', `${actorLabel(req)} added ${added.length} attachment(s)`);
        }

        // --- EMAIL NOTIFICATION LOGIC ---
        if (isAdmin(req) && lead.salesman && lead.salesman.id !== req.subjectId) {
            await notifyLeadUpdate(lead.salesman, lead, 'new attachment');
        }

        res.json({ success: true, attachments: added });

    } catch (e) {
        console.error('Upload attachments error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// List leads
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { search, sortBy = 'createdAt', sortDir = 'DESC' } = req.query;
        // Destructure the new filter query parameters
        const { stage, forecastCategory, followup } = req.query;

        // --- Build a more robust `where` clause ---
        const where = {
            [Op.and]: [], // Start with an array to safely push all conditions
        };

        // 1. Add permission-based filtering first
        if (!isAdmin(req)) {
            where[Op.and].push({ salesmanId: req.subjectId });
        }

        // 2. Add search term condition
        if (search && String(search).trim()) {
            const searchTerm = `%${String(search).trim()}%`;
            where[Op.and].push({
                [Op.or]: [
                    { uniqueNumber: { [Op.like]: searchTerm } },
                    { companyName:  { [Op.like]: searchTerm } },
                    { contactPerson:{ [Op.like]: searchTerm } },
                    { email:        { [Op.like]: searchTerm } },
                    { mobile:       { [Op.like]: searchTerm } },
                    { city:         { [Op.like]: searchTerm } },
                ]
            });
        }
        
        // 3. Add filters for 'stage' and 'forecastCategory'
        if (stage) {
            where[Op.and].push({ stage: { [Op.in]: String(stage).split(',') } });
        }
        if (forecastCategory) {
            where[Op.and].push({ forecastCategory: { [Op.in]: String(forecastCategory).split(',') } });
        }

        // 4. Add complex filter logic for 'followup' status
        if (followup) {
            const followupConditions = String(followup).split(',');
            const leadIdSubqueries = [];

            if (followupConditions.includes('Upcoming')) {
                // Find leads that have at least one followup scheduled for the future
                leadIdSubqueries.push({
                    id: { [Op.in]: sequelize.literal(`(SELECT DISTINCT leadId FROM lead_followups WHERE scheduledAt > NOW())`) }
                });
            }
            if (followupConditions.includes('Overdue')) {
                // Find leads that have past followups but no future ones
                leadIdSubqueries.push({
                    [Op.and]: [
                        { id: { [Op.in]: sequelize.literal(`(SELECT DISTINCT leadId FROM lead_followups WHERE scheduledAt < NOW())`) } },
                        { id: { [Op.notIn]: sequelize.literal(`(SELECT DISTINCT leadId FROM lead_followups WHERE scheduledAt > NOW())`) } }
                    ]
                });
            }
            if (followupConditions.includes('No Followup')) {
                // Find leads that have no records in the followups table
                leadIdSubqueries.push({
                    id: { [Op.notIn]: sequelize.literal(`(SELECT DISTINCT leadId FROM lead_followups)`) }
                });
            }
            // Use Op.or to combine the different followup statuses
            if (leadIdSubqueries.length > 0) {
                where[Op.and].push({ [Op.or]: leadIdSubqueries });
            }
        }
        
        // --- Fetch Leads with the constructed query ---
        const leads = await Lead.findAll({
            where: where[Op.and].length > 0 ? where : {}, // Use the where clause only if it has conditions
            include: [
                { model: Member, as: 'salesman', attributes: ['id', 'name', 'email'] },
                { model: Customer, as: 'customer', attributes: ['id', 'companyName'] },
            ],
            order: [[sortBy, sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
        });

        // The rest of your code for calculating 'nextFollowupAt' is correct and remains unchanged...
        const leadIds = leads.map(l => l.id);
        const nextByLead = new Map();
        if (leadIds.length > 0) {
            const allFollowups = await LeadFollowup.findAll({
                where: {
                    leadId: { [Op.in]: leadIds },
                    scheduledAt: { [Op.gt]: new Date() }
                },
                attributes: ['leadId', 'scheduledAt']
            });
            const grouped = allFollowups.reduce((acc, f) => {
                if (!acc.has(f.leadId)) acc.set(f.leadId, []);
                acc.get(f.leadId).push(f);
                return acc;
            }, new Map());
            for (const [leadId, followups] of grouped.entries()) {
                const nearest = followups.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];
                if (nearest) nextByLead.set(leadId, nearest.scheduledAt);
            }
        }

        // Map the final response
        res.json({
            success: true,
            leads: leads.map(l => ({
                id: l.id,
                stage: l.stage,
                forecastCategory: l.forecastCategory,
                division: l.customer ? l.customer.companyName : '',
                companyName: l.companyName || (l.customer ? l.customer.companyName : ''),
                source: l.source,
                uniqueNumber: l.uniqueNumber,
                quoteNumber: l.quoteNumber,
                actualDate: l.actualDate,
                contactPerson: l.contactPerson,
                mobile: l.mobile,
                mobileAlt: l.mobileAlt,
                email: l.email,
                city: l.city,
                salesman: l.salesman ? { id: l.salesman.id, name: l.salesman.name, email: l.salesman.email } : null,
                description: l.description,
                attachments: Array.isArray(l.attachmentsJson) ? l.attachmentsJson : [],
                nextFollowupAt: nextByLead.get(l.id) || null,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt
            }))
        });

    } catch (e) {
        console.error('List Leads Error:', e.message, e.stack);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



router.get('/my-leads', authenticateToken, async (req, res) => {
  if (isAdmin(req)) {
    // Admins can see all leads, so we can redirect to the main list route
    return res.redirect('/api/leads');
  }
  
  try {
    const leads = await Lead.findAll({
      where: {
        [Op.or]: [
          { salesmanId: req.subjectId },
          { creatorId: req.subjectId, creatorType: 'MEMBER' }
        ]
      },
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'companyName'] },
        { model: Member, as: 'salesman', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, leads });
  } catch (e) {
    console.error('Fetch My Leads Error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Get one lead
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        { 
          model: Member, 
          as: 'salesman', 
          attributes: ['id', 'name', 'email'] 
        },
        { 
          model: Customer, 
          as: 'customer', 
          attributes: ['id', 'companyName'] 
        },
        // --- UPDATED: Eagerly load the shares and the associated member details ---
        {
          model: ShareGp,
          as: 'shares',
          include: [{
            model: Member,
            as: 'sharedWithMember',
            attributes: ['id', 'name']
          }]
        }
      ],
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (!canViewLead(req, lead)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Fetch follow-ups and logs in parallel for efficiency
    const [followups, logs] = await Promise.all([
      LeadFollowup.findAll({
        where: { leadId: lead.id },
        order: [['createdAt', 'DESC']]
      }),
      LeadLog.findAll({
        where: { leadId: lead.id },
        order: [['createdAt', 'DESC']]
      })
    ]);

    const nextFollowupAt = nearestFutureFollowup(followups);

    // Construct the final, detailed response object
    res.json({
      success: true,
      lead: {
        id: lead.id,
        stage: lead.stage,
        forecastCategory: lead.forecastCategory,
        uniqueNumber: lead.uniqueNumber,
        quoteNumber: lead.quoteNumber,
        companyName: lead.companyName || (lead.customer ? lead.customer.companyName : ''),
        contactPerson: lead.contactPerson,
        mobile: lead.mobile,
        mobileAlt: lead.mobileAlt,
        email: lead.email,
        city: lead.city,
        country: lead.country,
        address: lead.address,
        source: lead.source,
        previewUrl: lead.previewUrl,
        description: lead.description,
        lostReason: lead.lostReason,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        creatorId: lead.creatorId,
        salesman: lead.salesman,
        customer: lead.customer,
        nextFollowupAt,
        // --- FINAL: Map the included shares to the response ---
        shares: (lead.shares || []).map(share => ({
          id: share.id,
          sharedWithMember: {
            id: share.sharedWithMember?.id,
            name: share.sharedWithMember?.name || 'Unknown',
          }
        })),
        followups: followups.map(f => ({
          id: f.id,
          status: f.status,
          description: f.description || '',
          scheduledAt: f.scheduledAt,
          createdAt: f.createdAt
        })),
        logs: logs.map(l => ({
          id: l.id,
          action: l.action,
          message: l.message,
          actorName: l.actorName,
          createdAt: l.createdAt
        })),
      }
    });
  } catch (e) {
    console.error('Get Lead Error:', e.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create lead
router.post(
  '/',
  authenticateToken,
  [
    body('customerId').trim().notEmpty().withMessage('Customer is required.'),
    body('shareGpData.sharedMemberId').optional().isUUID().withMessage('A valid member must be selected for sharing.'),
  ],
 async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const t = await sequelize.transaction();

    try {
        let resolvedSalesmanId = null;
        let assignedSalesman=null
        if (isAdmin(req)) {
            
            if (!req.body.salesmanId) {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Salesman is required for admin-created leads.' });
            }
             assignedSalesman = await Member.findByPk(req.body.salesmanId, { transaction: t });
            if (!assignedSalesman) {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Invalid primary salesman.' });
            }
            resolvedSalesmanId = assignedSalesman.id;
        } else {
            // Member is assigned as the primary salesman for their own lead
            resolvedSalesmanId = req.subjectId;
        }

        const customer = await Customer.findByPk(req.body.customerId, { transaction: t });
        if (!customer) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'Invalid customer.' });
        }

        const uniqueNumber = await generateUniqueLeadNumber(t);

        const leadData = {
            stage: req.body.stage || 'Discover',
            forecastCategory: req.body.forecastCategory || 'Pipeline',
            customerId: customer.id,
            companyName: customer.companyName,
            source: req.body.source || 'Website',
            uniqueNumber,
            contactPerson: req.body.contactPerson,
            mobile: req.body.mobile,
            email: req.body.email,
            city: req.body.city,
            country: req.body.country,
            address: req.body.address,
            salesmanId: resolvedSalesmanId,
            description: req.body.description,
            creatorType: req.subjectType,
            creatorId: req.subjectId,
        };

        const lead = await Lead.create(leadData, { transaction: t });

        // --- CORRECTED SHARE LOGIC FOR ALL ROLES ---
        const { shareGpData } = req.body;
        if (shareGpData && shareGpData.sharedMemberId) {
            
            // The creator of the share is the primary salesman, not necessarily the logged-in user.
            const shareCreatorId = resolvedSalesmanId;

            // Prevent sharing a lead with the primary salesman
            if (shareGpData.sharedMemberId === shareCreatorId) {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Cannot accompany the lead with the primary salesman.' });
            }

            await ShareGp.create({
                leadId: lead.id,
                memberId: shareCreatorId, // This is always a valid Member ID now
                sharedMemberId: shareGpData.sharedMemberId,
            }, { transaction: t });
        }
      writeLeadLog(req, lead.id, 'LEAD_CREATED', `${actorLabel(req)} created lead #${lead.uniqueNumber}`);

      await t.commit(); // Commit transaction

      res.status(201).json({ success: true, id: lead.id, uniqueNumber: lead.uniqueNumber });

    } catch (e) {
      await t.rollback(); // Rollback on any error
      console.error('Create Lead Error:', e.message);
      res.status(500).json({ success: false, message: 'Server error during lead creation.' });
    }
  }
);


router.put('/:id', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const lead = await Lead.findByPk(req.params.id, { transaction: t });
    if (!lead) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const isOwner = String(lead.creatorId) === String(req.subjectId);
    const isSalesman = String(lead.salesmanId) === String(req.subjectId);

    if (!isAdmin(req) && !isOwner && !isSalesman) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to edit this lead.' });
    }

    const updatableFields = [
      'stage', 'forecastCategory', 'source', 'quoteNumber', 'previewUrl',
      'contactPerson', 'mobile', 'mobileAlt', 'email', 'city', 'country', 'address',
      'description', 'lostReason'
    ];
    const updateData = {};
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    if (isAdmin(req)) {
      if (req.body.customerId) {
        const newCustomer = await Customer.findByPk(req.body.customerId, { transaction: t });
        if (!newCustomer) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'Invalid customer.' });
        }
        updateData.customerId = newCustomer.id;
        updateData.companyName = newCustomer.companyName;
      }
      if (req.body.salesmanId) {
        const sm = await Member.findByPk(req.body.salesmanId, { transaction: t });
        if (!sm) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'Invalid salesman.' });
        }
        updateData.salesmanId = sm.id;
      }
    }

    await lead.update(updateData, { transaction: t });

    // --- FINAL CORRECTION: Provide BOTH memberId and sharedMemberId ---
    const canManageShares = isOwner || isAdmin(req);
    const existingShare = await ShareGp.findOne({ where: { leadId: lead.id }, transaction: t });

    if (canManageShares && !existingShare && req.body.accompaniedMemberId) {
      const { accompaniedMemberId } = req.body;
      const memberToShareWith = await Member.findByPk(accompaniedMemberId, { transaction: t });

      if (memberToShareWith) {
        await ShareGp.create({
          leadId: lead.id,
          memberId: accompaniedMemberId,       // The user the lead is being shared WITH
          sharedMemberId: accompaniedMemberId, // The user the lead is being shared WITH
          sharedById: req.subjectId,         // The user who is INITIATING the share
        }, { transaction: t });
      }
    }
    // --- END OF CORRECTION ---

    await t.commit();

    await writeLeadLog(req, lead.id, 'LEAD_UPDATED', `${actorLabel(req)} updated lead details`);
   

    res.json({ success: true });

  } catch (e) {
    if (t && !t.finished) {
      await t.rollback();
    }
    console.error('Update Lead Error:', e.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/leads/:leadId/quotes', authenticateToken, async (req, res) => {
  const lead = await Lead.findByPk(req.params.leadId);
  if (!lead) return res.status(404).json({ success:false, message:'Lead not found' });
  const quotes = await Quote.findAll({
    where: { leadId: lead.id },
    include: [{ model: QuoteItem, as: 'items' }],
    order: [['createdAt', 'DESC']],
  });
  res.json({ success:true, quotes });
});
router.post('/:id/share', authenticateToken, [
    body('sharedMemberId').isUUID().withMessage('A valid member must be selected.'),
    body('profitPercentage').optional({ checkFalsy: true }).isFloat({ min: 0, max: 100 }).withMessage('Profit percentage must be between 0 and 100.'),
    body('profitAmount').optional({ checkFalsy: true }).isFloat({ min: 0 }).withMessage('Profit amount must be a positive number.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: "Validation failed", errors: errors.array() });
    }

    try {
        const lead = await Lead.findByPk(req.params.id);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }

        // --- PERMISSION: Only the creator of the lead can share it ---
        if (String(lead.creatorId) !== String(req.subjectId)) {
            return res.status(403).json({ success: false, message: 'Forbidden: Only the lead creator can perform this action.' });
        }

        const { sharedMemberId, profitPercentage, profitAmount, quoteId } = req.body;
        
        // Prevent sharing with oneself
        if(sharedMemberId === String(req.subjectId)) {
            return res.status(400).json({ success: false, message: "You cannot share a lead with yourself." });
        }

        const [share, created] = await ShareGp.findOrCreate({
            where: { leadId: lead.id, sharedMemberId: sharedMemberId },
            defaults: {
                leadId: lead.id,
                memberId: req.subjectId, // The user performing the action
                sharedMemberId,
                profitPercentage,
                profitAmount,
                quoteId: quoteId || null,
            }
        });

        if (!created) {
            return res.status(409).json({ success: false, message: 'This lead is already shared with the selected member.' });
        }
        
        res.status(201).json({ success: true, message: 'Lead shared successfully.', data: share });

    } catch (e) {
        console.error("Share Lead Error:", e.message);
        res.status(500).json({ success: false, message: 'An error occurred while sharing the lead.' });
    }
});

module.exports = router;
