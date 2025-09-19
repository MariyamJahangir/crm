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
const pdf = require('html-pdf');
const router = express.Router();
<<<<<<< HEAD

=======
const  { notifyAdminsOfApprovalRequest, notifyMemberOfQuoteDecision, notifyAdminsOfSuccess }= require('../utils/emailService')
>>>>>>> origin/main
// --- Constants ---
const APPROVAL_LIMIT = 500; // Quotes with a grand total LESS than this require admin approval for non-admins
const FINAL_STATES = new Set(['Accepted', 'Rejected', 'Expired']);

// --- Actor & Logging Helpers ---
function actorLabel(req) { return req.subjectType === 'ADMIN' ? 'Admin' : 'Member'; }
async function canModifyLead(req, lead) {
  // An admin can always modify.
  const isAdmin = req.subjectType === 'ADMIN';
  if (isAdmin) {
    return true;
  }

  // A non-admin can modify if they are the creator or the assigned salesman.
  const selfId = String(req.subjectId);
  const isCreator = String(lead.creatorId) === selfId && lead.creatorType === 'MEMBER';
  const isSalesman = String(lead.salesmanId) === selfId;

  return isCreator || isSalesman;
}
<<<<<<< HEAD
=======

>>>>>>> origin/main
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

<<<<<<< HEAD
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
=======
function buildQuoteInternalPreviewHTML({ quote, items, customer }) {
    const q = quote || {};
    const c = customer || {};
    const it = Array.isArray(items) ? items : [];

    // Helper to escape HTML characters
    const esc = (str) => 
        String(str || '').replace(/[&<>"']/g, s => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[s]));

    const rows = it.map(row => 
        `<tr>
            <td>${esc(row.product)}<div class="desc">${esc(row.description)}</div></td>
            <td class="right">${Number(row.quantity || 0).toFixed(2)}</td>
            <td class="right">${Number(row.itemCost || 0).toFixed(2)}</td>
            <td class="right">${Number(row.itemRate || 0).toFixed(2)}</td>
            <td class="right">${Number(row.lineDiscountAmount || 0).toFixed(2)}</td>
             <td class="right">${Number(row.lineGP || 0).toFixed(2)}</td>
            <td class="right">${Number(row.lineGross || 0).toFixed(2)}</td>
           
        </tr>`
    ).join('');

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Internal Preview - ${esc(q.quoteNumber)}</title>
    <style>
        body {
            font-family: 'Helvetica Neue', 'Helvetica', Helvetica, Arial, sans-serif;
            font-size: 13px;
            line-height: 1.6;
            color: #555;
            padding: 40px;
        }
        .invoice-box {
            max-width: 800px;
            margin: auto;
            padding: 30px;
            border: 1px solid #eee;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        .header .company-details {
            text-align: right;
        }
        .header .company-details h3 {
            margin: 0;
            font-weight: bold;
            color: #333;
        }
        .quote-title {
            font-size: 45px;
            line-height: 1.2;
            font-weight: bold;
            color: #333;
        }
        .quote-details {
            margin-top: 20px;
        }
        .quote-details table {
            width: 300px;
        }
        .quote-details td {
            padding: 5px 0;
        }
        .billing-details {
            margin-bottom: 40px;
        }
        .billing-details h4 {
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
        }
        .items-table thead th {
            background: #f7f7f7;
            border-bottom: 2px solid #ddd;
            font-weight: bold;
            padding: 10px;
            text-align: left;
        }
        .items-table tbody tr td {
            padding: 10px;
            border-bottom: 1px solid #eee;
        }
        .items-table tbody tr:last-child td {
            border-bottom: none;
        }
        .right {
            text-align: right;
        }
        .desc {
            font-size: 11px;
            color: #777;
            margin-top: 3px;
        }
        .footer {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
        }
        .footer .notes-section {
            width: 60%;
        }
        .footer .notes-section h5 {
            margin: 0 0 10px 0;
            font-weight: bold;
            color: #333;
        }
        .footer .totals-section {
            width: 35%;
        }
        .totals-table {
            width: 100%;
        }
        .totals-table td {
            padding: 8px 5px;
        }
        .totals-table tr.total-row td {
            font-weight: bold;
            color: #333;
            border-top: 2px solid #eee;
        }
        .totals-table tr.gp-row td {
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="invoice-box">
        <div class="header">
            <div>
                <div class="quote-title">QUOTE</div>
                <div class="quote-details">
                    <table>
                        <tr><td>Quote #:</td><td>${esc(q.quoteNumber)}</td></tr>
                        <tr><td>Quote Date:</td><td>${new Date(q.quoteDate || Date.now()).toLocaleDateString()}</td></tr>
                        <tr><td>Sales Person:</td><td>${esc(q.salesmanName || 'N/A')}</td></tr>
                    </table>
                </div>
            </div>
            <div class="company-details">
                <h3>ARTIFLEX INFORMATION TECHNOLOGY LLC</h3>
                <div>Dubai, United Arab Emirates</div>
                <div>TRN: 104342158300003</div>
                <div>+971558086462</div>
                <div>accounts@artiflexit.com</div>
            </div>
        </div>

        <div class="billing-details">
            <h4>Bill To</h4>
            <strong>${esc(q.customerName || c.companyName)}</strong>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th class="right">Qty</th>
                    <th class="right">Cost</th>
                    <th class="right">Rate</th>
                    <th class="right">Discount</th>
                     <th class="right">Line GP</th>
                    <th class="right">Line Total</th>
                   
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>

        <div class="footer">
            <div class="notes-section">
                <h5>Notes</h5>
                <p>Thank you for the opportunity. We look forward to your response.</p>
                <h5>Terms & Conditions</h5>
                <p>100% advance payment.</p>
            </div>
            <div class="totals-section">
                <table class="totals-table">
                    <tr><td>Subtotal</td><td class="right">${Number(q.subtotal || 0).toFixed(2)}</td></tr>
                    <tr><td>Total Discount</td><td class="right">${Number(q.discountAmount || 0).toFixed(2)}</td></tr>
                    <tr><td>Net Amount</td><td class="right">${(Number(q.subtotal || 0) - Number(q.discountAmount || 0)).toFixed(2)}</td></tr>
                    <tr><td>VAT (${Number(q.vatPercent || 0).toFixed(2)}%)</td><td class="right">${Number(q.vatAmount || 0).toFixed(2)}</td></tr>
                    <tr class="total-row"><td>Grand Total</td><td class="right">${Number(q.grandTotal || 0).toFixed(2)}</td></tr>
                    
                    <tr><td colspan="2">&nbsp;</td></tr>

                    <tr class="gp-row"><td>Total Cost</td><td class="right">${Number(q.totalCost || 0).toFixed(2)}</td></tr>
                    <tr class="total-row"><td>Total Gross Profit (GP)</td><td class="right">${Number(q.grossProfit || 0).toFixed(2)}</td></tr>
                </table>
            </div>
        </div>
    </div>
</body>
</html>`;
}

 
function buildQuoteHTML({ quote, items, lead, customer }) {
    const q = quote || {};
    const it = Array.isArray(items) ? items : [];
    const l = lead || {};
    const c = customer || {};

    const dateStr = q.quoteDate ? new Date(q.quoteDate).toLocaleDateString('en-GB') : '';
    const salesman = esc(q.salesmanName || (l.salesman && l.salesman.name));

    const rows = it.map((row, idx) => {
        const qty = Number(row.quantity || 0);
        const rate = Number(row.itemRate || 0);
        const amount = qty * rate; // Simplified calculation for display, details are in the quote object
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <b>${esc(row.product)}</b>
                    <div class="item-description">${esc(row.description || '')}</div>
                </td>
                <td class="center">${qty.toFixed(2)}</td>
                <td class="right">${rate.toFixed(2)}</td>
                <td class="right">${amount.toFixed(2)}</td>
            </tr>`;
    }).join('');

    const subtotal = Number(q.subtotal || 0);
    const vatAmount = Number(q.vatAmount || 0);
    const grandTotal = Number(q.grandTotal || 0);
    const totalItems = it.reduce((acc, item) => acc + Number(item.quantity || 0), 0);

    // Placeholder for number-to-words conversion.
    // This requires a library like 'num-words' or a custom function.
    const grandTotalInWords = "--- Grand total in words placeholder ---";

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Quote ${esc(q.quoteNumber)}</title>
    <style>
        :root { color-scheme: light; }
        body {
            margin: 0;
            padding: 25mm 15mm;
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #333;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #007bff;
            padding-bottom: 15px;
        }
        .company-details { text-align: left; }
        .company-details h1 {
            color: #007bff;
            margin: 0;
            font-size: 24px;
        }
        .company-details div { margin: 2px 0; font-size: 11px; }
        .quote-info { text-align: right; }
        .quote-info h2 {
            margin: 0 0 10px 0;
            font-size: 32px;
            font-weight: bold;
            color: #555;
        }
        .quote-info-table {
            border-collapse: collapse;
            width: 280px;
        }
        .quote-info-table td {
            padding: 4px 8px;
            border: 1px solid #ccc;
        }
        .bill-to {
            margin-top: 20px;
            border: 1px solid #ccc;
            padding: 8px;
            display: inline-block;
            background-color: #f9f9f9;
        }
        .bill-to h3 { margin: 0 0 5px 0; font-size: 12px; }
        .item-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .item-table th, .item-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .item-table th { background-color: #f2f2f2; }
        .item-description { font-size: 11px; color: #666; white-space: pre-wrap; }
        .totals-section {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
        }
        .summary-notes, .summary-totals { width: 48%; }
        .summary-totals table {
            width: 100%;
            border-collapse: collapse;
        }
        .summary-totals td {
            padding: 6px 8px;
            border: 1px solid #ddd;
        }
        .summary-totals td:last-child { text-align: right; }
        .total-in-words { margin-top: 10px; font-weight: bold; }
        .footer {
            margin-top: 30px;
            font-size: 11px;
        }
        .footer h4 { margin: 10px 0 5px 0; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
        .right { text-align: right; }
        .center { text-align: center; }
        b { font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-details">
            <h1>ARTIFLEX INFORMATION TECHNOLOGY LLC</h1>
            <div>Dubai, United Arab Emirates</div>
            <div>TRN 104342158300003</div>
            <div>+971558086462</div>
            <div>accounts@artiflexit.com</div>
            <div>https://artiflexit.com</div>
        </div>
        <div class="quote-info">
            <h2>QUOTE</h2>
            <table class="quote-info-table">
                <tr><td>Quote#</td><td>${esc(q.quoteNumber)}</td></tr>
                <tr><td>Quote Date</td><td>${dateStr}</td></tr>
                <tr><td>Sales person</td><td>${salesman}</td></tr>
            </table>
        </div>
    </div>

    <div class="bill-to">
        <h3>Bill To</h3>
        <div><b>${esc(q.customerName || c.companyName)}</b></div>
    </div>

    <table class="item-table">
        <thead>
            <tr>
                <th style="width:5%;">#</th>
                <th>Item & Description</th>
                <th style="width:8%;" class="center">Qty</th>
                <th style="width:12%;" class="right">Rate</th>
                <th style="width:15%;" class="right">Amount</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>

    <div class="totals-section">
        <div class="summary-notes">
            <div>Items in Total ${totalItems.toFixed(2)}</div>
            <div class="total-in-words">
                <b>Total In Words</b><br>
                UAE Dirham ${grandTotalInWords}
            </div>
        </div>
        <div class="summary-totals">
            <table>
                <tr>
                    <td>Sub Total</td>
                    <td>${subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Standard Rate (${Number(q.vatPercent || 0).toFixed(2)}%)</td>
                    <td>${vatAmount.toFixed(2)}</td>
                </tr>
                <tr>
                    <td><b>Total</b></td>
                    <td><b>AED ${grandTotal.toFixed(2)}</b></td>
                </tr>
            </table>
        </div>
    </div>
    
    <div class="footer">
        <h4>Notes</h4>
        <div>Thank you for the opportunity and looking forward for your response</div>

        <h4>Bank details</h4>
        <div>Bank Name : Abu Dhabi Commercial Bank</div>
        <div>Account Name : Artiflex Information Technology LLC</div>
        <div>Account Number: 13416209820001</div>
        <div>IBAN : AE510030013416209820001</div>
        <div>Currency: AED</div>

        <h4>Terms & Conditions</h4>
        <div><b>Payment Terms</b></div>
        <div>100% advance payment</div>
    </div>
>>>>>>> origin/main
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
  let browser;
  try {
    // Launch a new browser instance for every request. This is more stable.
    browser = await puppeteer.launch({
      headless: "new",
      // These arguments are important for stability, especially in production
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      // Set a generous timeout for the browser to launch
      timeout: 60000, 
    });
    
    const page = await browser.newPage();
    // It's better to set the timeout on the page itself
    await page.setDefaultNavigationTimeout(60000); 
    await page.setDefaultTimeout(60000);

    return await fn(page);
  } finally {
    // Ensure the browser is always closed, even if an error occurs
    if (browser) {
      await browser.close();
    }
  }
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
    const leadWhereClause = {};
    if (!isAdmin(req)) {
      const self = String(req.subjectId);
      leadWhereClause[Op.or] = [
        { creatorId: self },
        { salesmanId: self }
      ];
    }

    const quotes = await Quote.findAll({
      include: [{
        model: Lead,
        as: 'lead',
        where: leadWhereClause,
        required: true // Ensures that only quotes with a matching lead are returned
      }],
      order: [['createdAt', 'DESC']]
    });

    res.json({ success: true, quotes });
  } catch (e) {
    console.error('List Quotes Error:', e); // Added more specific error logging
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Create quote with approval logic
router.post('/leads/:leadId/quotes', authenticateToken, [
<<<<<<< HEAD
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

    // **EDIT: Update the lead's stage to 'Quote'**
    if (lead.stage !== 'Quote') {
        await lead.update({ stage: 'Quote' });
    }

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
router.post('/:leadId/:quoteId/approve', authenticateToken,  async (req, res) => {
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
      status: 'Draft',
      approvedBy: await resolveActorName(req),
      rejectNote: null,
    });
    
    await writeLeadLog(req, quote.leadId, 'QUOTE_APPROVED', `Approved quote #${quote.quoteNumber}`);
    res.json({ success: true, quote });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


router.post('/:leadId/:quoteId/reject', authenticateToken,  [
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
      status: 'Rejected', // Correctly set status to 'Rejected'
      approvedBy: null,
      rejectNote: note,
    });

    await writeLeadLog(req, quote.leadId, 'QUOTE_REJECTED', `Rejected quote #${quote.quoteNumber} with reason: ${note}`);
    res.json({ success: true, quote });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

=======
    // Validation rules are correct and enforce data integrity
    body('items.*.itemCost').isFloat({ min: 0 }).withMessage('Item cost must be a non-negative number.'),
    body('items.*.itemRate').isFloat({ gt: 0 }).withMessage('Item rate must be a positive number.'),
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
    // Optional: Uncomment these lines for debugging if issues arise
    // console.log('--- QUOTE REQUEST BODY ---', JSON.stringify(req.body, null, 2));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // console.log('--- QUOTE VALIDATION ERRORS ---', errors.array());
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    try {
        const lead = await Lead.findByPk(req.params.leadId);
        if (!lead) {
            return res.status(404).json({ success: false, message: 'Lead not found' });
        }

        const { items, discountMode, discountValue,  salesmanId, vatPercent } = req.body;
        console.log(req.body)
        let quoteSubtotal = 0;
        let quoteTotalCost = 0;

        // 1. Calculate detailed metrics for each line item
        const computedItems = items.map((it, index) => {
            const qty = Number(it.quantity || 0);
            const cost = Number(it.itemCost || 0);
            const rate = Number(it.itemRate || 0);
            const grossBeforeDiscount = qty * rate;

            let lineDiscount = 0;
            if (it.lineDiscountMode === 'AMOUNT') {
                lineDiscount = Number(it.lineDiscountAmount || 0);
            } else { // Default to PERCENT
                lineDiscount = (grossBeforeDiscount * Number(it.lineDiscountPercent || 0)) / 100;
            }
            lineDiscount = Math.min(lineDiscount, grossBeforeDiscount); // Cap discount

            const lineGross = grossBeforeDiscount - lineDiscount;
            const lineCostTotal = qty * cost;
            const lineGP = lineGross - lineCostTotal;
            const lineProfitPercent = lineGross > 0 ? (lineGP / lineGross) * 100 : 0;
            
            quoteSubtotal += lineGross;
            quoteTotalCost += lineCostTotal;

            return {
                ...it,
                slNo: index + 1,
                lineDiscountAmount: lineDiscount.toFixed(2),
                lineGross: lineGross.toFixed(2),
                lineCostTotal: lineCostTotal.toFixed(2),
                lineGP: lineGP.toFixed(2),
                lineProfitPercent: lineProfitPercent.toFixed(3),
            };
        });

        // 2. Calculate overall quote totals
        const overallDiscount = discountMode === 'PERCENT'
            ? (quoteSubtotal * Number(discountValue || 0)) / 100
            : Math.min(Number(discountValue || 0), quoteSubtotal);
        
        const netAfterDiscount = quoteSubtotal - overallDiscount;
        const vatAmount = netAfterDiscount * (Number(vatPercent || 0) / 100);
        const grandTotal = netAfterDiscount + vatAmount;
        const grossProfit = netAfterDiscount - quoteTotalCost;
        const profitPercent = netAfterDiscount > 0 ? (grossProfit / netAfterDiscount) * 100 : 0;

        // 3. Determine approval status
        let isApproved = true;
        let initialStatus = 'Draft';
        if (!isAdmin(req) && grandTotal < APPROVAL_LIMIT) {
            isApproved = false;
            initialStatus = 'PendingApproval';
        }

        const member = await Member.findByPk(salesmanId);
        if (!member) {
            return res.status(403).json({ success: false, message: 'Creator not found.' });
        }

        const quoteNumber = `Q-${new Date().getFullYear()}-${Date.now()}`;
        
        // 4. Create the Quote record
        const createdQuote = await Quote.create({
            ...req.body,
            quoteNumber,
            leadId: lead.id,
            isApproved,
            status: initialStatus,
            subtotal: quoteSubtotal.toFixed(2),
            totalCost: quoteTotalCost.toFixed(2),
            discountAmount: overallDiscount.toFixed(2),
            vatAmount: vatAmount.toFixed(2),
            grandTotal: grandTotal.toFixed(2),
            grossProfit: grossProfit.toFixed(2),
            profitPercent: profitPercent.toFixed(3),
            salesmanName: member.name,
            approvedBy: isApproved ? 'Auto-approved' : null,
            rejectNote: null,
        });

        // 5. Create all QuoteItem records
        await QuoteItem.bulkCreate(computedItems.map(ci => ({ ...ci, quoteId: createdQuote.id })));

        if (lead.stage !== 'Quote') {
            await lead.update({ stage: 'Quote' });
        }
        
        if (initialStatus === 'PendingApproval') {
            await notifyAdminsOfApprovalRequest(createdQuote, lead, member);
        }

        await writeLeadLog(req, lead.id, 'QUOTE_CREATED', `Created quote #${quoteNumber}. Status: ${initialStatus}`);
        
        res.status(201).json({
            success: true,
            quoteId: createdQuote.id,
            quoteNumber: createdQuote.quoteNumber,
            isApproved: createdQuote.isApproved,
            status: createdQuote.status,
        });

    } catch (e) {
        console.error('Create Quote Error:', e);
        res.status(500).json({ success: false, message: 'Server error', error: e.message });
    }
});


// ADMIN APPROVE QUOTE
router.post('/:leadId/:quoteId/approve', authenticateToken, async (req, res) => {
    try {
        // --- FIX: Eagerly load the 'lead' association ---
        const quote = await Quote.findByPk(req.params.quoteId, {
            include: [{ model: Lead, as: 'lead' }] // Ensure 'lead' is the correct alias
        });
        
        if (!quote || String(quote.leadId) !== req.params.leadId) {
            return res.status(404).json({ success: false, message: 'Quote not found.' });
        }
        
        // Assuming FINAL_STATES is a valid Set
        if (FINAL_STATES.has(quote.status)) {
            return res.status(409).json({ success: false, message: 'Decision is already final.' });
        }

        await quote.update({
            isApproved: true,
            status: 'Draft',
            approvedBy: await resolveActorName(req), // Assuming resolveActorName exists
            rejectNote: null,
        });

        // The 'lead' object is now guaranteed to exist on the 'quote' model
        const member = await Member.findByPk(quote.lead.salesmanId);
        if (member) {
            await notifyMemberOfQuoteDecision(member, quote, true);
        }

        await writeLeadLog(req, quote.leadId, 'QUOTE_APPROVED', `Approved quote #${quote.quoteNumber}`);
        
        res.json({ success: true, quote });
    } catch (e) {
        console.error('Approve Quote Error:', e);
        res.status(500).json({ success: false, message: 'Server error', error: e.message });
    }
});


router.post('/:leadId/:quoteId/reject', authenticateToken, [
    body('note').trim().notEmpty().withMessage('Rejection reason is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    try {
        // --- FIX: Eagerly load the 'lead' association ---
        const quote = await Quote.findByPk(req.params.quoteId, {
            include: [{ model: Lead, as: 'lead' }] // Use the correct alias for your association
        });

        if (!quote || String(quote.leadId) !== req.params.leadId) {
            return res.status(404).json({ success: false, message: 'Quote not found.' });
        }
        
        // Assuming FINAL_STATES is a valid Set
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

        // Now, quote.lead is guaranteed to exist
        const member = await Member.findByPk(quote.lead.salesmanId);
        if (member) {
            await notifyMemberOfQuoteDecision(member, quote, false);
        }

        await writeLeadLog(req, quote.leadId, 'QUOTE_REJECTED', `Rejected quote #${quote.quoteNumber} with reason: ${note}`);
        
        res.json({ success: true, quote });
    } catch (e) {
        console.error('Reject Quote Error:', e);
        res.status(500).json({ success: false, message: 'Server error', error: e.message });
    }
});


>>>>>>> origin/main
// GET Quote as HTML for preview
router.get('/leads/:leadId/quotes/:quoteId/preview', authenticateToken, async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.quoteId, { include: [{ model: QuoteItem, as: 'items' }] });
<<<<<<< HEAD
=======
  
>>>>>>> origin/main
    if (!quote || String(quote.leadId) !== String(req.params.leadId)) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    const lead = await Lead.findByPk(quote.leadId, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id','companyName','address'] },
        { model: Member, as: 'salesman', attributes: ['id','name','email'] },
      ]
    });

<<<<<<< HEAD
    const html = buildQuoteHTML({
      quote: quote.toJSON(),
      items: (quote.items || []).map(i => i.toJSON()),
      lead: lead ? lead.toJSON() : null,
=======
  const html = buildQuoteInternalPreviewHTML({
      quote: quote.toJSON(),
      items: (quote.items || []).map(i => i.toJSON()),
>>>>>>> origin/main
      customer: (lead && lead.customer) ? lead.customer.toJSON() : null
    });

    res.json({ success: true, html });
  } catch (e) {
    console.error('Quote HTML Preview Error:', e.message);
    res.status(500).json({ success: false, message: 'Failed to generate preview.' });
  }
});

router.post('/leads/:leadId/main-quote', authenticateToken, [
  body('quoteNumber').isString().notEmpty().withMessage('A valid quoteNumber is required.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { leadId } = req.params;
  const { quoteNumber } = req.body;


  try {
    const lead = await Lead.findByPk(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    if (!(await canModifyLead(req, lead))) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    // This is the query that is failing
    const quote = await Quote.findOne({ where: { quoteNumber: quoteNumber, leadId: leadId } });

    // Check if the query failed
    if (!quote) {
      console.error('DATABASE LOOKUP FAILED: No quote found with the provided details.');
      return res.status(404).json({ success: false, message: 'Quote not found or does not belong to this lead' });
    }

    // If successful, update and save
    lead.quoteNumber = quote.quoteNumber;
    await lead.save();

    res.json({ 
      success: true, 
      message: `Quote ${quote.quoteNumber} is now the main quote.`,
      lead: lead
    });

  } catch (e) {
    console.error('Set main quote error:', e);
    res.status(500).json({ success: false, message: e.message || 'Server error' });
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
<<<<<<< HEAD
     const memberAllowed = new Set(['Draft', 'Sent']);
=======
     const memberAllowed = new Set(['Draft', 'Sent' ,'Accepted', 'Rejected', 'Expired']);
>>>>>>> origin/main
     if (isMember && (quote.status === 'PendingApproval' || !memberAllowed.has(newStatus))) {
       return res.status(403).json({ success: false, message: 'Not allowed to set this status' });
     }
     await quote.update({ status: newStatus });
<<<<<<< HEAD
=======
      if (newStatus === 'Accepted') {
                await notifyAdminsOfSuccess(
                    `Quote Accepted: #${quote.quoteNumber}`,
                    `The quote for lead '${quote.lead.companyName}' has been accepted by the customer.`
                );
            }
>>>>>>> origin/main
     await writeLeadLog(req, quote.leadId, 'QUOTE_UPDATED', `${actorLabel(req)} updated quote #${quote.quoteNumber} status to ${newStatus}`);
   }
   
   res.json({ success: true, quote });
 } catch (e) {
   console.error('Update Quote Error:', e.message);
   res.status(500).json({ success: false, message: 'Server error' });
 }
});

// THIS IS FOR DEBUGGING - THE FINAL CODE IS IN PART 2

router.get('/leads/:leadId/quotes/:quoteId/pdf', authenticateToken, async (req, res) => {
  console.log(`[PDF DEBUG] - 1. Request received for quote ${req.params.quoteId}`);
  try {
    const quote = await Quote.findByPk(req.params.quoteId, { include: [{ model: QuoteItem, as: 'items' }] });
    if (!quote || String(quote.leadId) !== String(req.params.leadId)) {
      console.error('[PDF DEBUG] - ERROR: Quote not found.');
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }
   

    if (!quote.isApproved && !isAdmin(req)) {
      console.error('[PDF DEBUG] - ERROR: Permission denied. Quote not approved.');
      return res.status(403).json({ success: false, message: 'Quote requires admin approval for download.' });
    }
   

    const lead = await Lead.findByPk(quote.leadId, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'companyName', 'address'] },
        { model: Member, as: 'salesman', attributes: ['id', 'name', 'email'] },
      ]
    });
    

    const html = buildQuoteHTML({
      quote: quote.toJSON(),
      items: (quote.items || []).map(i => i.toJSON()),
      lead: lead ? lead.toJSON() : null,
      customer: (lead && lead.customer) ? lead.customer.toJSON() : null
    });
  

    const options = {
      format: 'A4',
      border: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' }
    };
 

    pdf.create(html, options).toBuffer(async (err, buffer) => {
      if (err) {
        // This block might not even be reached if PhantomJS crashes hard.
        console.error('[PDF DEBUG] - FATAL ERROR inside pdf.create callback:', err);
        return res.status(500).json({ success: false, message: 'Failed to generate PDF inside callback.' });
      }
      
     
      await writeLeadLog(req, quote.leadId, 'QUOTE_DOWNLOADED', `${actorLabel(req)} downloaded quote #${quote.quoteNumber} PDF`).catch(() => {});
     

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
      res.send(buffer);
     
    });

  } catch (e) {
    console.error('[PDF DEBUG] - FATAL ERROR in outer try/catch block:', e);
    res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
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

