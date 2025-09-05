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

const router = express.Router();

// Actor helpers
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
  const rows = items.map(it => {
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

// ROUTES

// List all quotes at mount path root: GET /api/quotes
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
    const errors = validationResult(req); if (!errors.isEmpty())
      return res.status(400).json({ success:false, message:'Validation failed', errors: errors.array() });

    const lead = await Lead.findByPk(req.params.leadId, { include: [{ model: Customer, as:'customer' }, { model: Member, as:'salesman' }] });
    if (!lead) return res.status(404).json({ success:false, message:'Lead not found' });

    // Resolve salesman
    let salesmanId = String(req.subjectId);
    let salesmanName = lead.salesman?.name || '';
    if (isAdmin(req) && req.body.salesmanId) {
      const sm = await Member.findByPk(req.body.salesmanId);
      if (!sm) return res.status(400).json({ success:false, message:'Invalid salesman' });
      salesmanId = sm.id;
      salesmanName = sm.name || '';
    }

    const {
      quoteDate, validityUntil,
      customerId, customerName, contactPerson, phone, email, address, description,
      discountMode, discountValue, vatPercent, items
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

      customerId: customerId || lead.customer?.id || null,
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
    });

    await QuoteItem.bulkCreate(computedItems.map(ci => ({ ...ci, quoteId: created.id })));

    await writeLeadLog(req, lead.id, 'QUOTE_CREATED', `${actorLabel(req)} created quote #${created.quoteNumber}`);

    res.status(201).json({ success:true, quoteId: created.id, quoteNumber: created.quoteNumber });
  } catch (e) {
    console.error('Create Quote Error:', e.message);
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
      customer: lead?.customer ? lead.customer.toJSON() : null
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

    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    const html = buildQuoteHTML({
      quote: quote.toJSON(),
      items: (quote.items || []).map(i => i.toJSON()),
      lead: lead ? lead.toJSON() : null,
      customer: lead?.customer ? lead.customer.toJSON() : null
    });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' } });
    await browser.close();

    await writeLeadLog(req, quote.leadId, 'QUOTE_DOWNLOADED', `${actorLabel(req)} downloaded quote #${quote.quoteNumber} PDF`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
    res.send(pdf);
  } catch (e) {
    console.error('Quote PDF Error:', e.message);
    res.status(500).json({ success:false, message:'Failed to generate PDF' });
  }
});

module.exports = router;
