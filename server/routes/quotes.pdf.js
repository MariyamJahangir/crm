const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Member = require('../models/Member');
const Quote = require('../models/Quote');
const QuoteItem = require('../models/QuoteItem');
const puppeteer = require('puppeteer');
const LeadLog = require('../models/LeadLog');
const router = express.Router();

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
    tfoot td { font-weight: bold; }
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

router.get('/lea/:leadId/quotes/:quoteId/pdf', authenticateToken, async (req, res) => {
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${quote.quoteNumber}.pdf"`);
    res.send(pdf); // send Buffer [9]
  } catch (e) {
    console.error('Quote PDF Error:', e.message);
    res.status(500).json({ success:false, message:'Failed to generate PDF' });
  }
});

module.exports = router;
