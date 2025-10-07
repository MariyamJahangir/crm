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
const Admin = require('../models/Admin');
const { createNotification, notifyAdmins } = require('../utils/notify');
const {  notifyAssignment, notifyAllRelevantParties ,notifyLeadUpdate  } = require('../utils/emailService')
const BASE_DIR = path.resolve(process.cwd());
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');
const STAGES = Lead.STAGES;
const FORECASTS = Lead.FORECASTS;
const { sequelize } = require('../config/database');
const Counter = require('../models/Counter');
const ShareGp= require('../models/ShareGp')
function canViewLead(req, lead) {
    

    // Check 1: Is the user an admin?
    if (isAdmin(req)) {
        
        return true;
    }

    const currentUserId = String(req.subjectId);
  

    // Check 2: Is the user the creator?

    if (String(lead.creatorId) === currentUserId) {

        return true;
    }

    // Check 3: Is the user the salesman?
  
    if (String(lead.salesmanId) === currentUserId) {
     
        return true;
    }


    
    // Does the `lead.sharedWith` property exist and is it an array?
    if (Array.isArray(lead.sharedWith)) {
      
        
        const isShared = lead.sharedWith.some(member => String(member.id) === currentUserId);
        
        if (isShared) {
          
            return true;
        } 
      }
      
    return false;
}



function canManageLead(req, lead) {
    if (isAdmin(req)) return true;
    const currentUserId = String(req.subjectId);
    return String(lead.creatorId) === currentUserId || String(lead.salesmanId) === currentUserId;
}

async function canModifyLead(req, lead) {
    // 1. Admins can always modify.
    if (isAdmin(req)) {
        return true;
    }

    const currentUserId = String(req.subjectId);

    // 2. The creator or assigned salesman can modify.
    if (String(lead.creatorId) === currentUserId || String(lead.salesmanId) === currentUserId) {
        return true;
    }

    // 3. A shared member can modify (this requires a DB check).
    const share = await ShareGp.findOne({
        where: {
            leadId: lead.id,
            sharedMemberId: currentUserId,
        },
    });
    
    // If a 'share' record exists, the user has permission.
    return !!share;
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
    return `L-${String(counter.currentValue).padStart(4, '0')}`;
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

router.delete('/:id/attachments', authenticateToken, async (req, res) => {
    try {
        const { filename, url } = req.body || {};
        if (!filename || !url) return res.status(400).json({ success: false, message: 'filename and url are required' });

        const lead = await Lead.findByPk(req.params.id);
        if (!lead) return res.status(404).json({ success: false, message: 'Not found' });

        // UPDATED: Use canViewLead for broader permissions
        if (!(await canViewLead(req, lead))) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

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
            }
        }
        
        const io = req.app.get('io');
        io?.to(`lead:${lead.id}`).emit('attachment:deleted', { leadId: String(lead.id), attachment: removed });

        await writeLeadLog(req, lead.id, 'ATTACHMENT_DELETED', `${actorLabel(req)} removed attachment ${removed.filename}`);
const actorName = await resolveActorName(req);
    const subject = `Attachment Removed from Lead: ${lead.companyName}`;
    const message = `<p>The attachment <strong>${removed.filename}</strong> was removed.</p>`;

    await notifyAllRelevantParties(lead, subject, message, actorName);
        res.json({ success: true });
    } catch (e) {
        console.error('Delete attachment error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete attachment (POST alias for frontend flexibility)
router.post('/:id/attachments/delete', authenticateToken, async (req, res) => {
    try {
        const { filename, url } = req.body || {};
        if (!filename || !url) return res.status(400).json({ success: false, message: 'filename and url are required' });

        const lead = await Lead.findByPk(req.params.id);
        if (!lead) return res.status(404).json({ success: false, message: 'Not found' });

        // UPDATED: Use canViewLead for broader permissions
        if (!(await canViewLead(req, lead))) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

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
            }
        }

        const io = req.app.get('io');
        io?.to(`lead:${lead.id}`).emit('attachment:deleted', { leadId: String(lead.id), attachment: removed });

        await writeLeadLog(req, lead.id, 'ATTACHMENT_DELETED', `${actorLabel(req)} removed attachment ${removed.filename}`);
        
        res.json({ success: true });
    } catch (e) {
        console.error('Delete attachment (POST) error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


router.post('/:id/attachments', authenticateToken, upload.array('files', 10), async (req, res) => {
    try {
        const lead = await Lead.findByPk(req.params.id);
        if (!lead) return res.status(404).json({ success: false, message: 'Not found' });
        
        // UPDATED: Use canViewLead for broader permissions
        if (!(await canViewLead(req, lead))) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const files = req.files || [];
        if (!files.length) return res.status(400).json({ success: false, message: 'No files uploaded' });

        const newAttachments = files.map(f => ({
            filename: f.originalname,
            url: toPublicUrl(f.path),
            createdAt: new Date().toISOString(),
            uploadedBy: req.subjectId,
        }));

        const current = Array.isArray(lead.attachmentsJson) ? lead.attachmentsJson : [];
        const added = [];
        for (const att of newAttachments) {
            if (!current.some(x => x.url === att.url)) {
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
        const actorName = await resolveActorName(req);
    const subject = `Attachment Added to Lead: ${lead.companyName}`;
    const message = `<p>${actorName} added ${added.length} new attachment(s).</p>`;
    
    await notifyAllRelevantParties(lead, subject, message, actorName);
        res.json({ success: true, attachments: added });
    } catch (e) {
        console.error('Upload attachments error:', e);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const { search, sortBy = 'createdAt', sortDir = 'DESC' } = req.query;
        const { stage, forecastCategory, followup } = req.query;

        const where = {
            [Op.and]: [],
        };

        // 1. Permission-based filtering
        if (!isAdmin(req)) {
            const sharedLeadsSubQuery = sequelize.literal(
                `(SELECT "leadId" FROM "share_gp" WHERE "sharedMemberId" = '${req.subjectId}')`
            );
            
            where[Op.and].push({
                [Op.or]: [
                    { salesmanId: req.subjectId },
                    { id: { [Op.in]: sharedLeadsSubQuery } }
                ]
            });
        }

        // 2. Search term condition
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
        
        // 3. Filters for 'stage' and 'forecastCategory'
        if (stage) {
            where[Op.and].push({ stage: { [Op.in]: String(stage).split(',') } });
        }
        if (forecastCategory) {
            where[Op.and].push({ forecastCategory: { [Op.in]: String(forecastCategory).split(',') } });
        }

        // 4. Complex filter logic for 'followup' status
        if (followup) {
            const followupConditions = String(followup).split(',');
            const leadIdSubqueries = [];

            if (followupConditions.includes('Upcoming')) {
                leadIdSubqueries.push({ id: { [Op.in]: sequelize.literal(`(SELECT DISTINCT "leadId" FROM "lead_followups" WHERE "scheduledAt" > NOW())`) } });
            }
            if (followupConditions.includes('Overdue')) {
                leadIdSubqueries.push({
                    [Op.and]: [
                        { id: { [Op.in]: sequelize.literal(`(SELECT DISTINCT "leadId" FROM "lead_followups" WHERE "scheduledAt" < NOW())`) } },
                        { id: { [Op.notIn]: sequelize.literal(`(SELECT DISTINCT "leadId" FROM "lead_followups" WHERE "scheduledAt" > NOW())`) } }
                    ]
                });
            }
            if (followupConditions.includes('No Followup')) {
                leadIdSubqueries.push({ id: { [Op.notIn]: sequelize.literal(`(SELECT DISTINCT "leadId" FROM "lead_followups")`) } });
            }
            if (leadIdSubqueries.length > 0) {
                where[Op.and].push({ [Op.or]: leadIdSubqueries });
            }
        }
        
        // --- Fetch Leads with the corrected query ---
        const leads = await Lead.findAll({
            where: where[Op.and].length > 0 ? where : {},
            include: [
                { model: Member, as: 'salesman', attributes: ['id', 'name', 'email'], required: false },
                { model: Customer, as: 'customer', attributes: ['id', 'companyName'], required: false },
                { model: Member, as: 'creator', attributes: ['id', 'name', 'email'], required: false },
                {
                    model: Member,
                    as: 'sharedWith',
                    attributes: ['id', 'name', 'email'],
                    through: { attributes: [] },
                    required: false
                }
            ],
            order: [[sortBy, sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
            distinct: true,
            subQuery: false
        });

        // --- Post-query processing for 'nextFollowupAt' ---
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

        // --- Map the final response ---
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
                creator: l.creator ? { id: l.creator.id, name: l.creator.name, email: l.creator.email } : null,
                sharedWith: l.sharedWith ? l.sharedWith.map(m => ({ id: m.id, name: m.name, email: m.email })) : [],
                description: l.description,
                attachments: Array.isArray(l.attachmentsJson) ? l.attachmentsJson : [],
                nextFollowupAt: nextByLead.get(l.id) || null,
                createdAt: l.createdAt,
                updatedAt: l.updatedAt,
                createdBy: l.createdBy || null
            }))
        });

    } catch (e) {
        console.error('List Leads Error:', e.message, e.stack);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});






router.get('/my-leads', authenticateToken, async (req, res) => {
  // Admins are redirected to the main list which shows all leads
  if (isAdmin(req)) {
    return res.redirect('/api/leads'); 
  }
 
  try {
    const currentUserId = req.subjectId;

    const leads = await Lead.findAll({
      // The WHERE clause now includes a check on the 'shares' association
      where: {
        [Op.or]: [
          { salesmanId: currentUserId },
          { creatorId: currentUserId, creatorType: 'MEMBER' },
          // This special syntax checks the associated ShareGp model
          { '$shares.sharedMemberId$': currentUserId }
        ]
      },
      include: [
        { 
          model: Customer, 
          as: 'customer', 
          attributes: ['id', 'companyName'] 
        },
        { 
          model: Member, 
          as: 'salesman', 
          attributes: ['id', 'name'] 
        },
        // This include is REQUIRED for the '$shares.sharedMemberId$' filter to work.
        // `required: false` makes it a LEFT JOIN, so leads that aren't shared are still included.
        {
          model: ShareGp,
          as: 'shares',
          attributes: [], // We only need it for filtering, no need to return its data
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      // Use 'distinct' to prevent duplicate leads if they match multiple conditions
      distinct: true, 
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
                { model: Member, as: 'salesman', required: false },
                { model: Customer, as: 'customer', required: false },
                { model: Member, as: 'creator', required: false },
                {
                    model: Member,
                    as: 'sharedWith',
                    attributes: ['id', 'name'], // Select only 'id' and 'name' from the Member table
                    through: {
                        // --- THIS IS THE CRUCIAL FIX ---
                        // Fetch 'profitPercentage' from the junction table (ShareGp)
                        attributes: ['profitPercentage', 'memberId', 'sharedMemberId'], 
                    },
                    required: false,
                },
                { model: LeadFollowup, as: 'followups', separate: true, order: [['createdAt', 'DESC']] },
                { model: LeadLog, as: 'logs', separate: true, order: [['createdAt', 'DESC']] },
            ],
        });

        if (!lead) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }

        if (!(await canViewLead(req, lead))) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        // The 'toJSON' call will now correctly nest the junction table attributes
        const leadJson = lead.toJSON();

        // The 'sharedWith' array will now look like this:
        // {
        //   "id": "...",
        //   "name": "...",
        //   "ShareGp": { "profitPercentage": "50.00", "memberId": "...", "sharedMemberId": "..." }
        // }

        res.json({
            success: true,
            lead: leadJson
        });

    } catch (e) {
        console.error('Get Lead Error:', e.message, e.stack);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});



router.post(
  '/',
  authenticateToken,
  [
    body('customerId').trim().notEmpty().withMessage('Customer is required.'),
    body('shareGpData.sharedMemberId')
      .optional()
      .isUUID()
      .withMessage('A valid member must be selected for sharing.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    let resolvedSalesmanId = null;
    let resolvedCreatorId = null;
    let resolvedCreatorType = null;
    let sharingInitiatorId = null;
    let customer = null;
    const t = await sequelize.transaction();

    try {
      if (isAdmin(req)) {
        if (!req.body.salesmanId) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'Salesman is required for admin-created leads.' });
        }

        const assignedSalesman = await Member.findByPk(req.body.salesmanId, { transaction: t });
        if (!assignedSalesman) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'Invalid primary salesman.' });
        }

        resolvedSalesmanId = assignedSalesman.id;
        resolvedCreatorId = assignedSalesman.id;
        resolvedCreatorType = 'MEMBER';
        sharingInitiatorId = assignedSalesman.id;
      } else {
        const creator = await Member.findByPk(req.subjectId, { transaction: t });
        if (!creator) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'Invalid creator: Your user account could not be found.' });
        }

        resolvedSalesmanId = req.subjectId;
        resolvedCreatorId = req.subjectId;
        resolvedCreatorType = 'MEMBER';
        sharingInitiatorId = req.subjectId;
      }

      customer = await Customer.findByPk(req.body.customerId, { transaction: t });
      if (!customer) {
        await t.rollback();
        return res.status(400).json({ success: false, message: 'Invalid customer.' });
      }

    
   let createdByName = 'System';
if (req.subjectType === 'ADMIN') {
  // Fetch admin user's name from Admin model or similar
  const admin = await Admin.findByPk(req.subjectId, { attributes: ['name'] });
  createdByName = admin?.name || 'Admin';
} else if (req.subjectType === 'MEMBER') {
  const member = await Member.findByPk(req.subjectId, { attributes: ['name'] });
  createdByName = member?.name || 'Member';
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
        description: req.body.description,
        closingDate: req.body.closingDate || null,
        salesmanId: resolvedSalesmanId,
        creatorId: resolvedCreatorId,
        creatorType: resolvedCreatorType,
        createdBy: createdByName,        // Add creator's name here
      };

      const lead = await Lead.create(leadData, { transaction: t });

      if (req.body.shareGpData && req.body.shareGpData.sharedMemberId) {
        if (req.body.shareGpData.sharedMemberId === resolvedSalesmanId) {
          await t.rollback();
          return res.status(400).json({ success: false, message: 'You cannot share a lead with the primary salesman.' });
        }

        await ShareGp.create(
          {
            leadId: lead.id,
            memberId: sharingInitiatorId,
            sharedMemberId: req.body.shareGpData.sharedMemberId,
          },
          { transaction: t }
        );
      }

      await t.commit();

      try {
        await writeLeadLog(req, lead.id, 'LEAD_CREATED', `${actorLabel(req)} created lead #${lead.uniqueNumber}`);
      } catch (logError) {
        console.error('Failed to write lead log:', logError);
      }

      try {
        const newLead = await Lead.findByPk(lead.id, {
          include: [{ model: Member, as: 'salesman', attributes: ['name', 'email'] }],
        });

        if (newLead) {
          const actorName = await resolveActorName(req);
          const subject = `New Lead Created: ${newLead.companyName}`;
          const message = `<p>A new lead has been created for <strong>${newLead.companyName}</strong> and assigned to <strong>${newLead.salesman?.name || 'N/A'}</strong>.</p>`;

          await notifyAllRelevantParties(newLead, subject, message, actorName);
        }
      } catch (emailError) {
        console.error('Failed to send lead creation email:', emailError);
      }

      return res.status(201).json({ success: true, id: lead.id, uniqueNumber: lead.uniqueNumber });
    } catch (e) {
      if (t && !t.finished) {
        try {
          await t.rollback();
        } catch (rollbackErr) {
          console.error('Rollback error:', rollbackErr);
        }
      }
      console.error('Create Lead Error:', e);
      return res.status(500).json({ success: false, message: e.message || 'Server error during lead creation.' });
    }
  }
);



 
// router.put('/:id', authenticateToken, async (req, res) => {
//   const t = await sequelize.transaction();

//   try {
//     const lead = await Lead.findByPk(req.params.id, { transaction: t });
//     if (!lead) {
//       await t.rollback();
//       return res.status(404).json({ success: false, message: 'Lead not found.' });
//     }

//     const isOwner = String(lead.creatorId) === String(req.subjectId);
//     const isSalesman = String(lead.salesmanId) === String(req.subjectId);

//     if (!isAdmin(req) && !isOwner && !isSalesman) {
//       await t.rollback();
//       return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to edit this lead.' });
//     }

//     const updatableFields = [
//       'stage', 'forecastCategory', 'source', 'quoteNumber', 'previewUrl',
//       'contactPerson', 'mobile', 'mobileAlt', 'email', 'city', 'country', 'address',
//       'description', 'lostReason'
//     ];
    
//     const updateData = {};
//     updatableFields.forEach(field => {
//       if (req.body[field] !== undefined) {
//         updateData[field] = req.body[field];
//       }
//     });

//     // --- MODIFIED: Logic to handle the closingDates array ---
//     if (req.body.closingDate) {
//         const existingDates = lead.closingDates || [];
//         const newDate = new Date(req.body.closingDate);
//         const lastDate = existingDates.length > 0 ? new Date(existingDates[existingDates.length - 1]) : null;
        
//         // Only add the new date if it's different from the most recent one
//         if (!lastDate || lastDate.getTime() !== newDate.getTime()) {
//             updateData.closingDates = [...existingDates, newDate.toISOString()];
//         }
//     }
//     // --- END MODIFICATION ---

//     if (isAdmin(req)) {
//       if (req.body.customerId) {
//         const newCustomer = await Customer.findByPk(req.body.customerId, { transaction: t });
//         if (!newCustomer) {
//           await t.rollback();
//           return res.status(400).json({ success: false, message: 'Invalid customer.' });
//         }
//         updateData.customerId = newCustomer.id;
//         updateData.companyName = newCustomer.companyName;
//       }
//       if (req.body.salesmanId) {
//         const sm = await Member.findByPk(req.body.salesmanId, { transaction: t });
//         if (!sm) {
//           await t.rollback();
//           return res.status(400).json({ success: false, message: 'Invalid salesman.' });
//         }
//         updateData.salesmanId = sm.id;
//       }
//     }
    
//     await lead.update(updateData, { transaction: t });

//     const canManageShares = isOwner || isAdmin(req);
//     const existingShare = await ShareGp.findOne({ where: { leadId: lead.id }, transaction: t });

//     if (canManageShares && !existingShare && req.body.accompaniedMemberId) {
//       const { accompaniedMemberId } = req.body;
//       const memberToShareWith = await Member.findByPk(accompaniedMemberId, { transaction: t });

//       if (memberToShareWith) {
//         await ShareGp.create({
//           leadId: lead.id,
//           memberId: accompaniedMemberId,
//           sharedMemberId: accompaniedMemberId,
//           sharedById: req.subjectId,
//         }, { transaction: t });
//       }
//     }
    
//     await t.commit();
    
//     await writeLeadLog(req, lead.id, 'LEAD_UPDATED', `${actorLabel(req)} updated lead details`);
    
//     res.json({ success: true });

//   } catch (e) {
//     if (t && !t.finished) {
//       await t.rollback();
//     }
//     console.error('Update Lead Error:', e.message);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });


router.put('/:id', authenticateToken, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Step 1: Fetch lead with shares inside the transaction to lock necessary rows
    const lead = await Lead.findByPk(req.params.id, {
      include: [{ model: ShareGp, as: 'shares' }],
      transaction: t,
      lock: t.LOCK.UPDATE, // Lock lead row for update
    });

    if (!lead) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    // Step 2: Permission check
    if (!(await canModifyLead(req, lead))) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to edit this lead.' });
    }

    // Step 3: Build updateData with allowed fields
    const updatableFields = [
      'stage',
      'forecastCategory',
      'source',
      'quoteNumber',
      'previewUrl',
      'contactPerson',
      'mobile',
      'mobileAlt',
      'email',
      'city',
      'country',
      'address',
      'description',
      'lostReason',
    ];
    const updateData = {};
    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    // Closing dates update logic with array comparison
    if (req.body.closingDate) {
      const existingDates = Array.isArray(lead.closingDates) ? lead.closingDates : [];
      const newDate = new Date(req.body.closingDate);
      const lastDate = existingDates.length ? new Date(existingDates[existingDates.length - 1]) : null;
      if (!lastDate || lastDate.getTime() !== newDate.getTime()) {
        updateData.closingDates = [...existingDates, newDate.toISOString()];
      }
    }

    // Admin-only updates for customer and salesman
    if (isAdmin(req)) {
      if (req.body.customerId) {
        const newCustomer = await Customer.findByPk(req.body.customerId, { transaction: t });
        if (!newCustomer) throw new Error('Invalid customer.');
        updateData.customerId = newCustomer.id;
        updateData.companyName = newCustomer.companyName;
      }
      if (req.body.salesmanId) {
        const sm = await Member.findByPk(req.body.salesmanId, { transaction: t });
        if (!sm) throw new Error('Invalid salesman.');
        updateData.salesmanId = sm.id;
      }
    }

    // Step 4: Update lead
    await lead.update(updateData, { transaction: t });

    // Step 5: Handle lead sharing if applicable - only if not already shared
    if (req.body.shareGpData?.sharedMemberId && lead.shares.length === 0) {
      const initiatorId = lead.creatorId; // Original creator initiates sharing

      const [share, created] = await ShareGp.findOrCreate({
        where: {
          leadId: lead.id,
          sharedMemberId: req.body.shareGpData.sharedMemberId,
        },
        defaults: {
          memberId: initiatorId,
        },
        transaction: t,
      });

      if (created) {
        const sharedMember = await Member.findByPk(req.body.shareGpData.sharedMemberId, {
          attributes: ['name'],
          transaction: t,
        });
        await writeLeadLog(req, lead.id, 'LEAD_SHARED', `${actorLabel(req)} shared the lead with ${sharedMember.name}.`, t);
      }
    }

    // Commit transaction after all DB changes
    await t.commit();

    // Step 6: Write lead updated log OUTSIDE transaction to reduce locking
    try {
      await writeLeadLog(req, lead.id, 'LEAD_UPDATED', `${actorLabel(req)} updated lead details`);
    } catch (logError) {
      console.error('Failed to write lead update log:', logError);
    }

    // Step 7: Notifications OUTSIDE transaction to avoid blocking
    try {
      const updatedLead = await Lead.findByPk(lead.id);
      const actorName = await resolveActorName(req);
      const subject = `Lead Updated: ${updatedLead.companyName}`;
      const message = `<p>The details for the lead have been updated.</p>`;

      await notifyAllRelevantParties(updatedLead, subject, message, actorName);

      if (lead.salesmanId !== req.subjectId) {
        const salesman = await Member.findByPk(lead.salesmanId);
        if (salesman) {
          await notifyLeadUpdate(salesman, lead, 'details updated');
        }
      }
    } catch (notifyError) {
      console.error('Failed to send lead update notifications:', notifyError);
    }

    return res.json({ success: true });
  } catch (e) {
    if (t && !t.finished) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error('Transaction rollback failure:', rollbackError);
      }
    }
    console.error('Update Lead Error:', e.message, e.stack);
    return res.status(500).json({ success: false, message: e.message || 'Server error' });
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

    const t = await sequelize.transaction(); // Start a transaction

    try {
        const lead = await Lead.findByPk(req.params.id, { transaction: t });
        if (!lead) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }

        // --- PERMISSION CHECK ---
        if (String(lead.creatorId) !== String(req.subjectId)) {
            await t.rollback();
            return res.status(403).json({ success: false, message: 'Forbidden: Only the lead creator can perform this action.' });
        }

        const { sharedMemberId, profitPercentage, profitAmount, quoteId } = req.body;
        
        // Prevent sharing with oneself
        if(sharedMemberId === String(req.subjectId)) {
            await t.rollback();
            return res.status(400).json({ success: false, message: "You cannot share a lead with yourself." });
        }

        // --- FETCH DETAILS FOR LOGGING ---
        const sharedMember = await Member.findByPk(sharedMemberId, { attributes: ['name'], transaction: t });
        if (!sharedMember) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'The member you are trying to share with does not exist.' });
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
            },
            transaction: t
        });

        if (!created) {
            await t.rollback();
            return res.status(409).json({ success: false, message: 'This lead is already shared with the selected member.' });
        }
        
        // --- CORRECTED LOGGING ---
        const actorName = actorLabel(req); // Use your existing actorLabel function
        await writeLeadLog(
            req,
            lead.id,
            'LEAD_SHARED',
            `${actorName} shared the lead with ${sharedMember.name}.`,
            t // Pass transaction to log function if it supports it
        );

        await t.commit(); // Commit the transaction

        res.status(201).json({ success: true, message: 'Lead shared successfully.', data: share });

    } catch (e) {
        if (t && !t.finished) {
            await t.rollback(); // Rollback on any error
        }
        console.error("Share Lead Error:", e.message);
        res.status(500).json({ success: false, message: 'An error occurred while sharing the lead.' });
    }
});


module.exports = router;
