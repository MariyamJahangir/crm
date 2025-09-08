const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Lead = require('../models/Lead');
const Member = require('../models/Member');
const Customer = require('../models/Customer');
const Quote = require('../models/Quote');
const QuoteItem = require('../models/QuoteItem');
const LeadLog = require('../models/LeadLog');
const puppeteer = require('puppeteer');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const { Op } = require('sequelize');

const router = express.Router();

// --- Constants ---
const APPROVAL_LIMIT = 500; // Quotes with a grand total LESS than this require admin approval for non-admins
const FINAL_STATES = new Set(['Accepted', 'Rejected', 'Expired']);

// --- Actor & Logging Helpers ---
function actorLabel(req) { return req.subjectType === 'ADMIN' ? 'Admin' : 'Member'; }

async function resolveActorName(req) {
  if (req.subjectType === 'ADMIN') return 'Admin';
  if (req.subjectType === 'MEMBER') {
    const m = await Member.findByPk(req.subjectId, { attributes: ['name'] });
    return (m && m.name) || 'Member';
  }
  return 'System';
}

async function writeLeadLog(req, leadId, action, message) {
  try {
    const actorName = await resolveActorName(req);
    const created = await LeadLog.create({
      leadId, action, message,
      actorType: req.subjectType, actorId: req.subjectId, actorName
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
  } catch (e) {
    console.error("Failed to write lead log:", e.message);
  }
}

// --- Puppeteer & PDF Generation ---
function esc(v) { return (v ?? '').toString(); }

function buildQuoteHTML({ quote, items, lead, customer }) {
  const q = quote || {};
  const it = Array.isArray(items) ? items : [];
  const l = lead || {};
  const c = customer || {};

  const title = esc(q.quoteNumber) || 'Quote';
  const customerName = esc(q.customerName || c.companyName);
  const contact = esc(q.contactPerson || l.contactPerson);
  const address = esc(q.address || c.address);
  const phone = esc(q.phone || l.mobile);
  const email = esc(q.email || l.email);
  const salesman = esc(q.salesmanName || (l.salesman && l.salesman.name));
  const dateStr = q.quoteDate ? new Date(q.quoteDate).toLocaleDateString() : '';

  const rows = it.map((row, idx) => {
    const qty = Number(row.quantity || 0);
    const rate = Number(row.itemRate || 0);
    const disc = Number(row.lineDiscountAmount || 0);
    const lineTotal = Number(row.lineGross !== undefined ? row.lineGross : Math.max(0, qty * rate - disc));
    return `
      <tr>
        <td>${esc(row.slNo ?? idx + 1)}</td>
        <td>${esc(row.product)}</td>
        <td>${esc(row.description || '')}</td>
        <td>${esc(row.unit || '')}</td>
        <td style="text-align:right">${qty.toFixed(3)}</td>
        <td style="text-align:right">${rate.toFixed(2)}</td>
        <td style="text-align:right">${disc.toFixed(2)}</td>
        <td style="text-align:right">${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join('');

  const subtotal = Number(q.subtotal || 0).toFixed(2);
  const discount = Number(q.discountAmount || 0).toFixed(2);
  const vat = Number(q.vatAmount || 0).toFixed(2);
  const grand = Number(q.grandTotal || 0).toFixed(2);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    :root { color-scheme: light; }
    html, body { margin:0; padding:16px; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { margin: 0 0 12px 0; }
    .grid { display:flex; justify-content:space-between; gap:16px; font-size:12px; }
    .grid > div > div { margin: 2px 0; }
    .mt { margin-top:12px; }
    table { width:100%; border-collapse: collapse; }
    th, td { border:1px solid #ddd; padding:6px; font-size:12px; }
    th { background:#f5f5f5; text-align:left; }
    .totals { display:flex; justify-content:flex-end; }
    .totals table { width:auto; }
    .right { text-align:right; }
  </style>
</head>
<body>
  <h2>Quote ${esc(q.quoteNumber) || ''}</h2>
  <div class="grid">
    <div>
      <div><b>Customer:</b> ${customerName}</div>
      <div><b>Contact:</b> ${contact}</div>
      <div><b>Address:</b> ${address}</div>
    </div>
    <div>
      <div><b>Date:</b> ${dateStr}</div>
      <div><b>Salesman:</b> ${salesman}</div>
      <div><b>Phone:</b> ${esc(phone)}</div>
      <div><b>Email:</b> ${esc(email)}</div>
    </div>
  </div>
  <div class="mt">
    <table>
      <thead>
        <tr>
          <th>Sl</th><th>Product</th><th>Description</th><th>Unit</th>
          <th class="right">Qty</th><th class="right">Rate</th><th class="right">Disc Amt</th><th class="right">Line Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  </div>
  <div class="mt totals">
    <table>
      <tbody>
        <tr><td>Subtotal</td><td class="right">${subtotal}</td></tr>
        <tr><td>Discount</td><td class="right">${discount}</td></tr>
        <tr><td>VAT</td><td class="right">${vat}</td></tr>
        <tr><td><b>Grand Total</b></td><td class="right"><b>${grand}</b></td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

const isProd = process.env.NODE_ENV === 'production';
let sharedBrowser = null;
let launching = null;

async function launchBrowser() {
  const args = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (isProd) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-pdf-'));
    args.push(`--user-data-dir=${tmp}`);
  }
  return puppeteer.launch({ headless: 'new', args });
}

async function getBrowser() {
  try {
    if (sharedBrowser && sharedBrowser.isConnected()) {
      return sharedBrowser;
    }
  } catch { /* fallthrough */ }
  if (launching) return launching;
  launching = (async () => {
    try {
      sharedBrowser = await launchBrowser();
      return sharedBrowser;
    } finally { launching = null; }
  })();
  return launching;
}

async function withPage(fn) {
  const browser = await getBrowser();
  if (!browser) throw new Error('PDF renderer unavailable');
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);
  try { return await fn(page); }
  finally { try { await page.close(); } catch { /* ignore */ } }
}

async function canSeeLead(req, lead) {
  if (isAdmin(req)) return true;
  const self = String(req.subjectId);
  return String(lead.creatorId) === self || String(lead.salesmanId) === self;
}

// --- Routes ---

// List all quotes with role-based visibility
router.get('/', authenticateToken, async (req, res) => {
  try {
    const include = [{ model: Lead, as: 'lead' }];
    let quotes = await Quote.findAll({ include, order: [['createdAt','DESC']] });
    if (!isAdmin(req)) {
      const self = String(req.subjectId);
      quotes = quotes.filter(q => q.lead && (String(q.lead.creatorId) === self || String(q.lead.salesmanId) === self));
    }
    res.json({ success: true, quotes });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create quote with approval logic
router.post('/leads/:leadId/quotes', authenticateToken, [
  body('quoteDate').optional().isISO8601(),
  body('validityUntil').optional().isISO8601(),
  body('salesmanId').optional().isString(),
  body('customerName').trim().notEmpty(),
  body('discountMode').isIn(['PERCENT', 'AMOUNT']),
  body('discountValue').isFloat({ min: 0 }),
  body('vatPercent').isFloat({ min: 0 }),
  body('items').isArray({ min: 1 }),
  body('items.*.product').trim().notEmpty(),
  body('items.*.quantity').isFloat({ gt: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
  }
  try {
    const lead = await Lead.findByPk(req.params.leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    if (!(await canSeeLead(req, lead))) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const { items, discountMode, discountValue, vatPercent } = req.body;
    let subtotal = 0;
    const computedItems = items.map(it => {
      const qty = Number(it.quantity || 0);
      const rate = Number(it.itemRate || 0);
      const grossBefore = qty * rate;
      let ldAmt = (it.lineDiscountMode || 'PERCENT') === 'AMOUNT'
        ? Number(it.lineDiscountAmount || 0)
        : (grossBefore * Number(it.lineDiscountPercent || 0)) / 100;
      ldAmt = Math.min(ldAmt, grossBefore);
      subtotal += grossBefore - ldAmt;
      return { ...it, lineGross: grossBefore - ldAmt };
    });
    const overallDiscAmt = discountMode === 'PERCENT'
      ? (subtotal * Number(discountValue || 0)) / 100
      : Math.min(Number(discountValue || 0), subtotal);
    const netAfterDiscount = subtotal - overallDiscAmt;
    const vatAmount = netAfterDiscount * (Number(vatPercent || 0) / 100);
    const grandTotal = netAfterDiscount + vatAmount;

    // Approval Logic: if user is not admin and total is less than the limit, require approval
    let isApproved = true;
    let initialStatus = 'Draft';
    if (!isAdmin(req) && grandTotal < APPROVAL_LIMIT) {
      isApproved = false;
      initialStatus = 'PendingApproval';
    }

    const quoteNumber = `Q-${new Date().getFullYear()}-${Date.now()}`;
    const created = await Quote.create({
      ...req.body,
      quoteNumber,
      leadId: lead.id,
      isApproved,
      status: initialStatus,
      grandTotal: grandTotal.toFixed(2),
      subtotal: subtotal.toFixed(2),
      discountAmount: overallDiscAmt.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      rejectNote: null,
      approvedBy: isApproved ? 'Auto-approved' : null,
    });

    await QuoteItem.bulkCreate(computedItems.map(ci => ({ ...ci, quoteId: created.id })));
    await writeLeadLog(req, lead.id, 'QUOTE_CREATED', `Created quote #${quoteNumber}. Status: ${initialStatus}`);
    
    res.status(201).json({
      success: true,
      quoteId: created.id,
      quoteNumber: created.quoteNumber,
      isApproved: created.isApproved,
      status: created.status,
    });
  } catch (e) {
    console.error('Create Quote Error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN APPROVE QUOTE
router.post('/leads/:leadId/quotes/:quoteId/approve', authenticateToken, isAdmin, async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.quoteId);
    if (!quote || String(quote.leadId) !== req.params.leadId) {
      return res.status(404).json({ success: false, message: 'Quote not found.' });
    }
    if (FINAL_STATES.has(quote.status)) {
      return res.status(409).json({ success: false, message: 'Decision is already final.' });
    }

    await quote.update({
      isApproved: true,
      status: 'Accepted', // Change status to reflect approval
      approvedBy: await resolveActorName(req),
      rejectNote: null,
    });
    
    await writeLeadLog(req, quote.leadId, 'QUOTE_APPROVED', `Approved quote #${quote.quoteNumber}`);
    res.json({ success: true, quote });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ADMIN REJECT QUOTE
router.post('/leads/:leadId/quotes/:quoteId/reject', authenticateToken, isAdmin, [
  body('note').trim().notEmpty().withMessage('Rejection reason is required.')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  try {
    const quote = await Quote.findByPk(req.params.quoteId);
    if (!quote || String(quote.leadId) !== req.params.leadId) {
      return res.status(404).json({ success: false, message: 'Quote not found.' });
    }
    if (FINAL_STATES.has(quote.status)) {
      return res.status(409).json({ success: false, message: 'Decision is already final.' });
    }

    const note = req.body.note.slice(0, 500);
    await quote.update({
      isApproved: false,
      status: 'Rejected',
      approvedBy: null,
      rejectNote: note,
    });

    await writeLeadLog(req, quote.leadId, 'QUOTE_REJECTED', `Rejected quote #${quote.quoteNumber} with reason: ${note}`);
    res.json({ success: true, quote });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Update quote status
router.put('/leads/:leadId/quotes/:quoteId', authenticateToken, [
 body('status').optional().isIn(['Draft','Sent','Accepted','Rejected','Expired','PendingApproval']),
], async (req, res) => {
 try {
   const quote = await Quote.findByPk(req.params.quoteId, { include: [{ model: Lead, as: 'lead' }] });
   if (!quote || String(quote.leadId) !== String(req.params.leadId)) {
     return res.status(404).json({ success: false, message: 'Quote not found' });
   }
   if (!(await canSeeLead(req, quote.lead))) return res.status(403).json({ success: false, message: 'Forbidden' });
   if (FINAL_STATES.has(String(quote.status || ''))) return res.status(409).json({ success: false, message: 'Decision already final' });

   const { status: newStatus } = req.body;
   if (newStatus) {
     const isMember = !isAdmin(req);
     // Members cannot change status if it's pending, nor can they set a final status
     const memberAllowed = new Set(['Draft', 'Sent']);
     if (isMember && (quote.status === 'PendingApproval' || !memberAllowed.has(newStatus))) {
       return res.status(403).json({ success: false, message: 'Not allowed to set this status' });
     }
     await quote.update({ status: newStatus });
     await writeLeadLog(req, quote.leadId, 'QUOTE_UPDATED', `${actorLabel(req)} updated quote #${quote.quoteNumber} status to ${newStatus}`);
   }
   
   res.json({ success: true, quote });
 } catch (e) {
   console.error('Update Quote Error:', e.message);
   res.status(500).json({ success: false, message: 'Server error' });
 }
});


// Download PDF with approval check
router.get('/leads/:leadId/quotes/:quoteId/pdf', authenticateToken, async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.quoteId, { include: [{ model: QuoteItem, as: 'items' }] });
    if (!quote || String(quote.leadId) !== String(req.params.leadId)) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    // SECURITY: Enforce approval workflow
    if (!quote.isApproved && !isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Quote requires admin approval for download.' });
    }

    const lead = await Lead.findByPk(quote.leadId, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id','companyName','address'] },
        { model: Member, as: 'salesman', attributes: ['id','name','email'] },
      ]
    });

    const html = buildQuoteHTML({
      quote: quote.toJSON(),
      items: (quote.items || []).map(i => i.toJSON()),
      lead: lead ? lead.toJSON() : null,
      customer: (lead && lead.customer) ? lead.customer.toJSON() : null
    });

    const pdf = await withPage(async (page) => {
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      return await page.pdf({ format: 'A4', printBackground: true, margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' } });
    });

    writeLeadLog(req, quote.leadId, 'QUOTE_DOWNLOADED', `${actorLabel(req)} downloaded quote #${quote.quoteNumber} PDF`).catch(() => {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
    res.send(pdf);
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.error('Quote PDF Error:', msg);
    if (msg.includes('WS endpoint') || msg.includes('Timed out')) {
      return res.status(500).json({ success: false, message: 'PDF renderer timed out. Please retry.' });
    }
    res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
  }
});
router.get('/leads/:leadId/quotes', authenticateToken, async (req, res) => {
  const lead = await Lead.findByPk(req.params.leadId);
  if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
  if (!(await canSeeLead(req, lead))) return res.status(403).json({ success: false, message: 'Forbidden' });
  const quotes = await Quote.findAll({
    where: { leadId: lead.id },
    include: [{ model: QuoteItem, as: 'items' }],
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, quotes });
});
module.exports = router;

