// routes/quotes.sql.js
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
const { setTimeout: delay } = require('timers/promises');
const { createNotification, notifyAdmins } = require('../utils/notify');

const router = express.Router();

// Actor helpers
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

// Utils
function formatMoney(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildQuoteHTML({ quote, items, lead, customer }) {
  const styles = `
  <style>
    body { font-family: Arial, sans-serif; color: #111; font-size: 12px; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px 0; }
    h2 { font-size: 14px; margin: 0 0 6px 0; }
    .muted { color: #666; }
    .row { display: flex; gap: 16px; }
    .col { flex: 1; }
    .box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 10px; }
    .kv { display: grid; grid-template-columns: 160px 1fr; gap: 6px 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e5e7eb; padding: 6px 8px; }
    th { background: #f9fafb; text-align: left; }
    .right { text-align: right; }
    .small { font-size: 11px; }
    @page { size: A4; margin: 16mm 12mm; }
    html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>`;
  const head = `
    <div class="row" style="justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
      <div>
        <h1>Quotation</h1>
        <div class="muted small">Quote #: ${quote.quoteNumber}</div>
        <div class="muted small">Lead #: ${lead?.uniqueNumber || '-'}</div>
      </div>
      <div class="small muted" style="text-align:right">
        <div>Date: ${new Date(quote.quoteDate).toLocaleDateString()}</div>
        <div>Valid Until: ${quote.validityUntil ? new Date(quote.validityUntil).toLocaleDateString() : '-'}</div>
        <div>Salesman: ${quote.salesmanName || '-'}</div>
      </div>
    </div>
  `;
  const party = `
    <div class="row">
      <div class="col box">
        <h2>Party Details</h2>
        <div class="kv small">
          <div>Company</div><div>${quote.customerName || '-'}</div>
          <div>Contact Person</div><div>${quote.contactPerson || '-'}</div>
          <div>Phone</div><div>${quote.phone || '-'}</div>
          <div>Email</div><div>${quote.email || '-'}</div>
          <div>Address</div><div>${(quote.address || '').replace(/\n/g,'<br/>') || '-'}</div>
        </div>
      </div>
      <div class="col box">
        <h2>Notes</h2>
        <div class="small">${(quote.description || '-').replace(/\n/g,'<br/>')}</div>
      </div>
    </div>
  `;
  const rows = (items || []).map(it => {
    const qty = Number(it.quantity);
    const cost = Number(it.itemCost);
    const rate = Number(it.itemRate);
    const lineTotal = Number(it.lineGross);
    const discPct = Number(it.lineDiscountPercent || 0);
    const discAmt = Number(it.lineDiscountAmount || 0);
    const gp = Number(it.lineGP || (lineTotal - Number(it.lineCostTotal || qty * cost)));
    const pp = Number(it.lineProfitPercent || (lineTotal > 0 ? (gp/lineTotal)*100 : 0));
    return `
      <tr>
        <td class="right">${it.slNo}</td>
        <td>${it.product}</td>
        <td>${it.description || ''}</td>
        <td class="right">${it.unit || ''}</td>
        <td class="right">${qty}</td>
        <td class="right">${formatMoney(cost)}</td>
        <td class="right">${formatMoney(rate)}</td>
        <td class="right">${discPct ? discPct.toFixed(2) + '%' : '-'}</td>
        <td class="right">${discAmt ? formatMoney(discAmt) : '-'}</td>
        <td class="right">${formatMoney(lineTotal)}</td>
        <td class="right">${formatMoney(gp)}</td>
        <td class="right">${pp.toFixed(2)}%</td>
      </tr>
    `;
  }).join('');
  const summary = `
    <table class="small" style="margin-top:10px">
      <tbody>
        <tr><td class="right" style="width:85%">Subtotal</td><td class="right" style="width:15%">${formatMoney(quote.subtotal)}</td></tr>
        <tr><td class="right">Total Cost</td><td class="right">${formatMoney(quote.totalCost)}</td></tr>
        <tr><td class="right">Discount ${quote.discountMode === 'PERCENT' ? `(${Number(quote.discountValue).toFixed(2)}%)` : ''}</td><td class="right">-${formatMoney(quote.discountAmount)}</td></tr>
        <tr><td class="right">VAT (${Number(quote.vatPercent).toFixed(2)}%)</td><td class="right">${formatMoney(quote.vatAmount)}</td></tr>
        <tr><td class="right">Gross Profit (GP)</td><td class="right">${formatMoney(quote.grossProfit)}</td></tr>
        <tr><td class="right">Profit %</td><td class="right">${Number(quote.profitPercent).toFixed(2)}%</td></tr>
        <tr><td class="right">Grand Total</td><td class="right">${formatMoney(quote.grandTotal)}</td></tr>
      </tbody>
    </table>
  `;
  const table = `
    <table>
      <thead>
        <tr>
          <th>Sl</th><th>Product</th><th>Description</th><th>Unit</th><th>Qty</th><th>Cost</th><th>Rate</th><th>Disc %</th><th>Disc Amt</th><th>Line Total</th><th>GP</th><th>Profit %</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  return `
    <!doctype html><html><head><meta charset="utf-8" />${styles}</head>
    <body>
      ${head}
      ${party}
      ${table}
      ${summary}
      <div class="small muted" style="margin-top:8px;">Generated on ${new Date().toLocaleString()}</div>
    </body></html>
  `;
}

// Puppeteer helpers: reuse in dev; unique profile dir in prod to avoid locks
const isProd = process.env.NODE_ENV === 'production';
let sharedBrowser = null;

async function launchBrowser() {
  const userDataDir = path.join(os.tmpdir(), `pptr_profile_${Date.now()}_${Math.random().toString(16).slice(2)}`);
  const browser = await puppeteer.launch({
    headless: 'new',
    timeout: 0, // disable 30s launch timeout
    userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu'
    ]
  });
  return browser;
}

async function getBrowser() {
  if (!isProd) {
    if (sharedBrowser) return sharedBrowser;
    sharedBrowser = await launchBrowser();
    return sharedBrowser;
  }
  return launchBrowser();
}

async function safeRemoveDir(dir) {
  if (!dir) return;
  for (let i = 0; i < 5; i++) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (process.platform === 'win32' && err && err.code === 'EBUSY') {
        await delay(200 + i * 200);
        continue;
      }
      throw err;
    }
  }
}

// ROUTES

// List all quotes: GET /api/quotes
router.get('/', authenticateToken, async (req, res) => {
  const where = {};
  if (req.query.leadId) where.leadId = String(req.query.leadId);
  const quotes = await Quote.findAll({
    where,
    include: [{ model: QuoteItem, as: 'items' }],
    order: [['createdAt', 'DESC']],
  });
  res.json({ success: true, quotes });
});

// List quotes for a lead: GET /api/quotes/leads/:leadId/quotes
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

// Get one quote: GET /api/quotes/leads/:leadId/quotes/:quoteId
router.get('/leads/:leadId/quotes/:quoteId', authenticateToken, async (req, res) => {
  const quote = await Quote.findByPk(req.params.quoteId, {
    include: [{ model: QuoteItem, as: 'items' }]
  });
  if (!quote || String(quote.leadId) !== String(req.params.leadId)) {
    return res.status(404).json({ success:false, message:'Quote not found' });
  }
  res.json({ success:true, quote });
});

// Create quote: POST /api/quotes/leads/:leadId/quotes
router.post('/leads/:leadId/quotes', authenticateToken, [
  body('quoteDate').optional().isISO8601(),
  body('validityUntil').optional().isISO8601(),
  body('salesmanId').optional().isString(),
  body('customerId').optional().isString(),
  body('customerName').trim().notEmpty(),
  body('discountMode').isIn(['PERCENT','AMOUNT']),
  body('discountValue').isFloat({ min: 0 }),
  body('vatPercent').isFloat({ min: 0 }),
  body('items').isArray({ min: 1 }),
  body('items.*.slNo').isInt({ min: 1 }),
  body('items.*.product').trim().notEmpty(),
  body('items.*.quantity').isFloat({ gt: 0 }),
  body('items.*.itemCost').isFloat({ min: 0 }),
  body('items.*.itemRate').isFloat({ min: 0 }),
  body('items.*.lineDiscountPercent').optional().isFloat({ min: 0 }),
  body('items.*.lineDiscountAmount').optional().isFloat({ min: 0 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success:false, message:'Validation failed', errors: errors.array() });

    const lead = await Lead.findByPk(req.params.leadId, { include: [{ model: Customer, as:'customer' }, { model: Member, as:'salesman' }] });
    if (!lead) return res.status(404).json({ success:false, message:'Lead not found' });

    // Resolve salesman
    let salesmanId = String(req.subjectId);
    let salesmanName = (lead.salesman && lead.salesman.name) || '';
    if (isAdmin(req) && req.body.salesmanId) {
      const sm = await Member.findByPk(req.body.salesmanId);
      if (!sm) return res.status(400).json({ success:false, message:'Invalid salesman' });
      salesmanId = sm.id;
      salesmanName = sm.name || '';
    }

    const {
      quoteDate, validityUntil,
      customerId, customerName, contactPerson, phone, email, address, description,
      discountMode, discountValue, vatPercent, items,preparedBy, approvedBy, status
    } = req.body;

    // Per-line
    let subtotal = 0, totalCost = 0;
    const computedItems = items.map(it => {
      const qty = Number(it.quantity);
      const rate = Number(it.itemRate);
      const cost = Number(it.itemCost);
      const ldPct = Number(it.lineDiscountPercent || 0);
      let ldAmt = Number(it.lineDiscountAmount || 0);

      const grossBeforeDiscount = qty * rate;
      if (!ldAmt && ldPct > 0) ldAmt = (grossBeforeDiscount * ldPct) / 100;
      if (ldAmt > grossBeforeDiscount) ldAmt = grossBeforeDiscount;

      const lineGross = grossBeforeDiscount - ldAmt;
      const lineCostTotal = qty * cost;
      const lineGP = lineGross - lineCostTotal;
      const lineProfitPercent = lineGross > 0 ? (lineGP / lineGross) * 100 : 0;

      subtotal += lineGross;
      totalCost += lineCostTotal;

      return {
        slNo: it.slNo,
        product: it.product,
        description: it.description || '',
        unit: it.unit || '',
        quantity: qty,
        itemCost: cost,
        itemRate: rate,
        lineDiscountPercent: ldPct || (grossBeforeDiscount > 0 ? (ldAmt / grossBeforeDiscount) * 100 : 0),
        lineDiscountAmount: ldAmt,
        lineGross,
        lineCostTotal,
        lineGP,
        lineProfitPercent,
        
      };
    });

    // Overall
    let discountAmount = 0;
    if (discountMode === 'PERCENT') discountAmount = (subtotal * Number(discountValue)) / 100;
    else discountAmount = Number(discountValue);
    if (discountAmount > subtotal) discountAmount = subtotal;

    const netAfterDiscount = subtotal - discountAmount;
    const vatAmount = (netAfterDiscount * Number(vatPercent)) / 100;
    const grandTotal = netAfterDiscount + vatAmount;

    const grossProfit = netAfterDiscount - totalCost;
    const profitPercent = netAfterDiscount > 0 ? (grossProfit / netAfterDiscount) * 100 : 0;
    const totalQty = items.reduce((s, it) => s + Number(it.quantity), 0);
    const profitRate = totalQty > 0 ? grossProfit / totalQty : 0;

    const quoteNumber = await (async () => `Q-${new Date().getFullYear()}-${Date.now()}`)();

    const created = await Quote.create({
      quoteNumber,
      leadId: lead.id,
      quoteDate: quoteDate ? new Date(quoteDate) : new Date(),
      validityUntil: validityUntil ? new Date(validityUntil) : null,
      salesmanId,
      salesmanName,

      customerId: customerId || (lead.customer && lead.customer.id) || null,
      customerName,
      contactPerson: contactPerson || '',
      phone: phone || '',
      email: email || '',
      address: address || '',
      description: description || '',

      discountMode, discountValue, vatPercent,
      subtotal: subtotal.toFixed(2),
      totalCost: totalCost.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      grossProfit: grossProfit.toFixed(2),
      profitPercent: profitPercent.toFixed(3),
      profitRate: profitRate.toFixed(4),
      preparedBy: preparedBy || null,
approvedBy: approvedBy || null,
status: status || 'Draft',
    });

    await QuoteItem.bulkCreate(computedItems.map(ci => ({ ...ci, quoteId: created.id })));

    await writeLeadLog(req, lead.id, 'QUOTE_CREATED', `${actorLabel(req)} created quote #${created.quoteNumber}`);
notifyAdmins(req.app.get('io'), {
  event: 'QUOTE_CREATED',
  entityType: 'QUOTE',
  entityId: String(created.id),
  title: `Quote #${created.quoteNumber} created`,
  message: `${actorLabel(req)} created a quote for ${customerName}`,
}); // admin broadcast [1]

if (lead.salesmanId) {
  await createNotification({
    toType: 'MEMBER',
    toId: String(lead.salesmanId),
    event: 'QUOTE_CREATED',
    entityType: 'QUOTE',
    entityId: String(created.id),
    title: `Quote #${created.quoteNumber}`,
    message: `Quote created for Lead #${lead.uniqueNumber}`,
  }, req.app.get('io'));
}
    res.status(201).json({ success:true, quoteId: created.id, quoteNumber: created.quoteNumber });
  } catch (e) {
    console.error('Create Quote Error:', e.message);
    res.status(500).json({ success:false, message:'Server error' });
  }
});
// PUT /api/quotes/leads/:leadId/quotes/:quoteId
router.put('/leads/:leadId/quotes/:quoteId', authenticateToken, [
  body('status').optional().isIn(['Draft','Sent','Accepted','Rejected','Expired']),
  body('preparedBy').optional().isString(),
  body('approvedBy').optional().isString(),
], async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.quoteId);
    if (!quote || String(quote.leadId) !== String(req.params.leadId)) {
      return res.status(404).json({ success:false, message:'Quote not found' });
    }
    const up = {};
    ['status','preparedBy','approvedBy','description','validityUntil','quoteDate'].forEach(k => {
      if (req.body[k] !== undefined) up[k] = k.endsWith('Date') || k === 'validityUntil' ? new Date(req.body[k]) : req.body[k];
    });
    await quote.update(up);

    const lead = await Lead.findByPk(quote.leadId, { attributes: ['id','uniqueNumber','salesmanId'] });
    notifyAdmins(req.app.get('io'), {
      event: 'QUOTE_UPDATED',
      entityType: 'QUOTE',
      entityId: String(quote.id),
      title: `Quote #${quote.quoteNumber} updated`,
      message: `${actorLabel(req)} updated quote status/details`,
    }); // admin broadcast [1]
    if (lead?.salesmanId) {
      await createNotification({
        toType: 'MEMBER',
        toId: String(lead.salesmanId),
        event: 'QUOTE_UPDATED',
        entityType: 'QUOTE',
        entityId: String(quote.id),
        title: `Quote #${quote.quoteNumber} updated`,
        message: `Status: ${quote.status}`,
      }, req.app.get('io'));
    }
    res.json({ success:true });
  } catch (e) {
    console.error('Update Quote Error:', e.message);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

// Preview: GET /api/quotes/leads/:leadId/quotes/:quoteId/preview
router.get('/leads/:leadId/quotes/:quoteId/preview', authenticateToken, async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.quoteId, { include: [{ model: QuoteItem, as: 'items' }] });
    if (!quote || String(quote.leadId) !== String(req.params.leadId)) {
      return res.status(404).json({ success:false, message:'Quote not found' });
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
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    console.error('Quote Preview Error:', e.message);
    res.status(500).json({ success:false, message:'Failed to build preview' });
  }
});

// PDF: GET /api/quotes/leads/:leadId/quotes/:quoteId/pdf
router.get('/leads/:leadId/quotes/:quoteId/pdf', authenticateToken, async (req, res) => {
  let browser = null;
  try {
    const quote = await Quote.findByPk(req.params.quoteId, {
      include: [{ model: QuoteItem, as: 'items' }]
    });
    if (!quote || String(quote.leadId) !== String(req.params.leadId)) {
      return res.status(404).json({ success:false, message:'Quote not found' });
    }
    const lead = await Lead.findByPk(quote.leadId, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id','companyName','address'] },
        { model: Member, as: 'salesman', attributes: ['id','name','email'] },
      ]
    });

    browser = await getBrowser();
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(120000);
    page.setDefaultTimeout(120000);

    const html = buildQuoteHTML({
      quote: quote.toJSON(),
      items: (quote.items || []).map(i => i.toJSON()),
      lead: lead ? lead.toJSON() : null,
      customer: (lead && lead.customer) ? lead.customer.toJSON() : null
    });

    // Deterministic render: avoid long waits on external resources
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: 'html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}' });

    // Wait for fonts to be ready if available
    try {
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (document.fonts && 'ready' in document.fonts) {
            document.fonts.ready.then(() => setTimeout(resolve, 50));
          } else {
            setTimeout(resolve, 50);
          }
        });
      });
    } catch { /* ignore */ }

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' }
    });

    await page.close();

    // Non-blocking log
    writeLeadLog(req, quote.leadId, 'QUOTE_DOWNLOADED', `${actorLabel(req)} downloaded quote #${quote.quoteNumber} PDF`).catch(() => {});

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
    res.send(pdf);

    // If prod, close and cleanup isolated profile to avoid EBUSY
    if (isProd && browser) {
      const spawnargs = browser.process && browser.process() && browser.process().spawnargs || [];
      const udArg = (spawnargs || []).find(a => typeof a === 'string' && a.startsWith('--user-data-dir='));
      const userDataDir = udArg ? udArg.split('=')[22] : null;
      await browser.close().catch(() => {});
      if (userDataDir) {
        await safeRemoveDir(userDataDir).catch(() => {});
      }
    }

  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.error('Quote PDF Error:', msg);
    if (msg.includes('WS endpoint') || msg.includes('Timed out')) {
      return res.status(500).json({ success:false, message:'PDF renderer timed out starting the browser. Please retry.' });
    }
    if (msg.includes('EBUSY')) {
      return res.status(500).json({ success:false, message:'PDF created but cleanup was blocked by the OS. Please retry if it persists.' });
    }
    res.status(500).json({ success:false, message:'Failed to generate PDF' });
  }
});

module.exports = router;
