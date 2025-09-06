// routes/leads.sql.js
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

const BASE_DIR = path.resolve(process.cwd());
const UPLOADS_DIR = path.join(BASE_DIR, 'uploads');

const STAGES = Lead.STAGES;
const FORECASTS = Lead.FORECASTS;

function canViewLead(req, lead) {
  if (isAdmin(req)) return true;
  const self = String(req.subjectId);
  return (String(lead.creatorId) === self && lead.creatorType === 'MEMBER') || (String(lead.salesmanId) === self);
}

function canModifyLead(req, lead) {
  if (isAdmin(req)) return true;
  const self = String(req.subjectId);
  return (String(lead.salesmanId) === self) || (lead.creatorType === 'MEMBER' && String(lead.creatorId) === self);
}

const { upload, toPublicUrl } = makeUploader('lead_attachments');

async function generateUniqueLeadNumber() { return `L-${Date.now()}`; }

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

// Delete attachment (DELETE variant)
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

    // Safe unlink under /uploads
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

    // Safe unlink
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
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Not found' });

    if (!canModifyLead(req, lead)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ success: false, message: 'No files uploaded' });

    const now = new Date();
    const newAttachments = files.map(f => ({
      filename: f.originalname,
      url: toPublicUrl(f.path),
      createdAt: now.toISOString(),
      uploadedBy: req.subjectId,
    }));

    // De-duplicate
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

    res.json({ success: true, attachments: added });
  } catch (e) {
    console.error('Upload attachments error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// List leads
router.get('/', authenticateToken, async (req, res) => {
  try {
    const where = isAdmin(req) ? {} : { [Op.or]: [{ salesmanId: req.subjectId }] };
const search = String(req.query.search || '').trim();
if (search) {
  where[Op.or] = [
    ...(where[Op.or] || []),
    { uniqueNumber: { [Op.like]: `%${search}%` } },
    { companyName:  { [Op.like]: `%${search}%` } },
    { contactPerson:{ [Op.like]: `%${search}%` } },
    { email:        { [Op.like]: `%${search}%` } },
    { mobile:       { [Op.like]: `%${search}%` } },
    { city:         { [Op.like]: `%${search}%` } },
  ];
}
const sortBy = String(req.query.sortBy || 'createdAt');
const sortDir = String(req.query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
const leads = await Lead.findAll({
  where,
  include: [
    { model: Member, as: 'salesman', attributes: ['id','name','email'] },
    { model: Customer, as: 'customer', attributes: ['id','companyName'] },
  ],
  order: [[sortBy, sortDir]],
});

    res.json({ success:true, leads: leads.map(l => ({
      id: l.id,
      stage: l.stage,
      forecastCategory: l.forecastCategory,
      division: l.customer ? l.customer.companyName : '',
      companyName: l.companyName || (l.customer ? l.customer.companyName : ''),
      source: l.source,
      uniqueNumber: l.uniqueNumber,
      quoteNumber: l.quoteNumber,
      previewUrl: l.previewUrl,
      actualDate: l.actualDate,
      contactPerson: l.contactPerson,
      mobile: l.mobile,
      mobileAlt: l.mobileAlt,
      email: l.email,
      city: l.city,
      salesman: l.salesman ? { id: l.salesman.id, name: l.salesman.name, email: l.salesman.email } : null,
      description: l.description,
      attachments: Array.isArray(l.attachmentsJson) ? l.attachmentsJson : [],
      createdAt: l.createdAt,
      updatedAt: l.updatedAt
    }))});
  } catch (e) {
    console.error('List Leads Error:', e.message);
    res.status(500).json({ success:false, message:'Server error' });
  }
});


router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        { model: Member, as:'salesman', attributes:['id','name','email'] },
        { model: Customer, as:'customer', attributes:['id','companyName'] },
      ],
    });
    if (!lead) return res.status(404).json({ success:false, message:'Not found' }); // [attached_file:1]
    if (!canViewLead(req, lead)) return res.status(403).json({ success:false, message:'Forbidden' }); // [attached_file:1]

    const followups = await LeadFollowup.findAll({
      where: { leadId: lead.id },
      order: [['createdAt','DESC']]
    }); // [attached_file:1]

    const logs = await LeadLog.findAll({
      where: { leadId: lead.id },
      order: [['createdAt','DESC']]
    }); // [attached_file:1]

    res.json({ success:true, lead: {
      id: lead.id,

      // core status
      stage: lead.stage,
      forecastCategory: lead.forecastCategory,

      // identity and numbers
      uniqueNumber: lead.uniqueNumber,
      quoteNumber: lead.quoteNumber,

      // customer/company
      customerId: lead.customer?.id,
      division: lead.customer ? lead.customer.companyName : '',
      companyName: lead.companyName || (lead.customer ? lead.customer.companyName : ''),

      // source and preview
      source: lead.source,
      previewUrl: lead.previewUrl,

      // dates
      actualDate: lead.actualDate,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,

      // contact snapshot
      contactPerson: lead.contactPerson,
      mobile: lead.mobile,
      mobileAlt: lead.mobileAlt,
      email: lead.email,
      city: lead.city,

      // attachments
      attachments: Array.isArray(lead.attachmentsJson) ? lead.attachmentsJson : [],

      // owner/sales
      salesman: lead.salesman ? { id: lead.salesman.id, name: lead.salesman.name, email: lead.salesman.email } : null,
      creatorType: lead.creatorType,
      creatorId: lead.creatorId,

      // description
      description: lead.description,

      // followups and logs
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
        actorType: l.actorType,
        actorId: l.actorId,
        actorName: l.actorName,
        createdAt: l.createdAt
      })),
    }}); // [attached_file:1]
  } catch (e) {
    console.error('Get Lead Error:', e.message);
    res.status(500).json({ success:false, message:'Server error' });
  }
});



// Create lead
router.post('/', authenticateToken, [
  body('customerId').trim().notEmpty(),
  body('stage').optional().isIn(STAGES),
  body('forecastCategory').optional().isIn(FORECASTS),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success:false, message:'Validation failed', errors: errors.array() });

    let resolvedSalesmanId = null;

    if (isAdmin(req)) {
      const requested = String(req.body.salesmanId || '').trim();
      if (!requested) {
        return res.status(400).json({ success:false, message:'Salesman is required for admin-created leads' });
      }
      const sm = await Member.findByPk(requested, { attributes: ['id'] });
      if (!sm) {
        return res.status(400).json({ success:false, message:'Invalid salesman (not found in members)' });
      }
      resolvedSalesmanId = sm.id;
    } else {
      const self = await Member.findByPk(String(req.subjectId), { attributes: ['id'] });
      if (!self) {
        return res.status(400).json({ success:false, message:'Current member not found in system' });
      }
      if (req.body.salesmanId && String(req.body.salesmanId) !== String(self.id)) {
        return res.status(403).json({ success:false, message:'Members can only assign themselves as salesman' });
      }
      resolvedSalesmanId = self.id;
    }

    const customer = await Customer.findByPk(req.body.customerId);
    if (!customer) return res.status(400).json({ success:false, message:'Invalid customer' });

    const snap = {
      contactPerson: req.body.contactPerson || '',
      mobile: req.body.mobile || '',
      mobileAlt: req.body.mobileAlt || '',
      email: req.body.email || '',
      city: req.body.city || '',
    };

    if (!req.body.contactPerson) {
      let selected = null;
      if (req.body.contactId) {
        selected = await CustomerContact.findOne({ where: { id: req.body.contactId, customerId: customer.id } });
      } else {
        selected = await CustomerContact.findOne({ where: { customerId: customer.id }, order: [['createdAt','ASC']] });
      }
      if (selected) {
        if (!snap.contactPerson) snap.contactPerson = selected.name || '';
        if (!snap.mobile) snap.mobile = selected.mobile || '';
        if (!snap.email) snap.email = selected.email || '';
      }
    }

    const uniqueNumber = await generateUniqueLeadNumber();
    const lead = await Lead.create({
      stage: req.body.stage || 'Discover',
      forecastCategory: req.body.forecastCategory || 'Pipeline',
      customerId: customer.id,
      companyName: customer.companyName,
      source: req.body.source || 'Website',
      uniqueNumber,
      quoteNumber: req.body.quoteNumber || '',
      previewUrl: req.body.previewUrl || '',
      actualDate: new Date(),
      ...snap,
      salesmanId: resolvedSalesmanId,
      description: req.body.description || '',
      creatorType: req.subjectType,
      creatorId: req.subjectId,
      nextFollowupAt: req.body.nextFollowupAt ? new Date(req.body.nextFollowupAt) : null,

    });

    notifyAdmins(req.app.get('io'), {
  event: 'LEAD_CREATED',
  entityType: 'LEAD',
  entityId: String(lead.id),
  title: `Lead #${lead.uniqueNumber} created`,
  message: `${actorLabel(req)} created a lead`,
}); 

if (isAdmin(req) && String(resolvedSalesmanId) !== String(req.subjectId)) {
  await createNotification({
    toType: 'MEMBER',
    toId: resolvedSalesmanId,
    event: 'LEAD_ASSIGNED',
    entityType: 'LEAD',
    entityId: lead.id,
    title: `New lead #${lead.uniqueNumber}`,
    message: `Assigned by admin`,
  }, req.app.get('io'));
}

    await writeLeadLog(req, lead.id, 'LEAD_CREATED', `${actorLabel(req)} created lead #${lead.uniqueNumber}`);

    res.status(201).json({ success:true, id: lead.id, uniqueNumber: lead.uniqueNumber });
  } catch (e) {
    console.error('Create Lead Error:', e.message);
    res.status(500).json({ success:false, message:'Server error' });
  }
});
router.post('/:id/main-quote', authenticateToken, async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success:false, message:'Not found' });

    // Allow admins or the lead’s owner/salesman; reuse your policy
    const memberCan =
      (!isAdmin(req) &&
        (String(lead.creatorId) === String(req.subjectId) ||
         (lead.creatorType === 'MEMBER' && String(lead.salesmanId) === String(req.subjectId))));
    if (!isAdmin(req) && !memberCan) return res.status(403).json({ success:false, message:'Forbidden' });

    const { quoteNumber } = req.body; // pass null to clear
    await lead.update({ quoteNumber: quoteNumber || null });
    return res.json({ success:true });
  } catch (e) {
    console.error('Set main quote error:', e.message);
    res.status(500).json({ success:false, message:'Server error' });
  }
});
// Update lead
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ success:false, message:'Not found' });

    const memberCan = (!isAdmin(req)) && ((String(lead.creatorId) === String(req.subjectId) && lead.creatorType === 'MEMBER') || String(lead.salesmanId) === String(req.subjectId));
    if (!isAdmin(req) && !memberCan) return res.status(403).json({ success:false, message:'Forbidden' });
if (req.body.stage === 'Deal Lost' && !req.body.lostReason && !lead.lostReason) {
  return res.status(400).json({ success:false, message:'Lost reason is required when stage is Deal Lost' });
}
   const up = {};
['stage','forecastCategory','source','quoteNumber','previewUrl','contactPerson','mobile','mobileAlt','email','city','description','lostReason']
  .forEach(k => { if (req.body[k] !== undefined) up[k] = req.body[k]; });
if (req.body.nextFollowupAt !== undefined) up.nextFollowupAt = req.body.nextFollow

    if (req.body.customerId) {
      const newCustomer = await Customer.findByPk(req.body.customerId);
      if (!newCustomer) return res.status(400).json({ success:false, message:'Invalid customer' });
      up.customerId = newCustomer.id;
      up.companyName = newCustomer.companyName;
    }

    if (req.body.salesmanId) {
      if (isAdmin(req)) {
        const sm = await Member.findByPk(req.body.salesmanId);
        if (!sm) return res.status(400).json({ success:false, message:'Invalid salesman' });
        up.salesmanId = sm.id;
      } else {
        if (String(req.body.salesmanId) !== String(req.subjectId)) return res.status(403).json({ success:false, message:'Members can only assign themselves as salesman' });
        up.salesmanId = req.subjectId;
      }
    }

    await lead.update(up);

    await writeLeadLog(req, lead.id, 'LEAD_UPDATED', `${actorLabel(req)} updated lead details`);
notifyAdmins(req.app.get('io'), {
  event: 'LEAD_UPDATED',
  entityType: 'LEAD',
  entityId: String(lead.id),
  title: `Lead #${lead.uniqueNumber} updated`,
  message: `${actorLabel(req)} updated a lead`,
}); // admin broadcast [1]

if (isAdmin(req) && req.body.salesmanId) {
  await createNotification({
    toType: 'MEMBER',
    toId: up.salesmanId || req.body.salesmanId,
    event: 'LEAD_ASSIGNED',
    entityType: 'LEAD',
    entityId: lead.id,
    title: `Lead #${lead.uniqueNumber} assigned`,
    message: `Assigned by admin`,
  }, req.app.get('io'));
}
    res.json({ success:true });
  } catch (e) {
    console.error('Update Lead Error:', e.message);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

module.exports = router;
