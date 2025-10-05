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
const {sequelize}=require('../config/database')
const Counter = require('../models/Counter')
const ShareGp= require('../models/ShareGp')
const  { notifyAdminsOfApprovalRequest,notifySharedMemberOnQuoteCreation,  notifyMemberOfQuoteDecision, notifyAdminsOfSuccess }= require('../utils/emailService')
// --- Constants ---
const APPROVAL_LIMIT = 500; // Quotes with a grand total LESS than this require admin approval for non-admins
const FINAL_STATES = new Set(['Accepted', 'Rejected', 'Expired']);
const numWords = require('num-words');

async function generateUniqueQuoteNumber(transaction) {
  // Lock the 'quoteNumber' row for the duration of the transaction to prevent race conditions
  const counter = await Counter.findOne({
    where: { name: 'quoteNumber' },
    lock: transaction.LOCK.UPDATE,
    transaction
  });

  if (!counter) {
    // This error will be caught by the try-catch block and will roll back the transaction
    throw new Error("Quote number counter has not been initialized. Please run the initial SQL command.");
  }

  const nextValue = counter.currentValue + 1;
  counter.currentValue = nextValue;
  await counter.save({ transaction });

  return `Q-${nextValue}`;
}
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

function buildQuoteInternalPreviewHTML({ quote, items, customer, logoBase64, sharedMembers }) {
    // --- Initializations ---
        const esc = (str) =>
        String(str || '').replace(/[&<>"']/g, s => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[s]));

    const q = quote || {};
    const c = customer || {};
    const it = Array.isArray(items) ? items : [];
    const sm = Array.isArray(sharedMembers) ? sharedMembers : [];
    const currency = esc(q.currency || 'AED');

    // --- Helper to escape HTML characters ---

    // --- Build Table Rows for Quote Items ---
    const itemRows = it.map(row =>
        `<tr>
            <td>${esc(row.slNo)}</td>
            <td>
                <b>${esc(row.product)}</b>
                <div class="desc">${esc(row.description)}</div>
            </td>
            <td class="right">${Number(row.quantity || 0).toFixed(2)}</td>
            <td class="right"> ${Number(row.unitCost || 0).toFixed(2)}</td>
            <td class="right">${Number(row.totalCost || 0).toFixed(2)}</td>
            <td class="right">${Number(row.marginPercent || 0).toFixed(2)}%</td>
            <td class="right"> ${Number(row.unitPrice || 0).toFixed(2)}</td>
            <td class="right"> ${Number(row.totalPrice || 0).toFixed(2)}</td>
        </tr>`
    ).join('');

    // --- Build Table Rows for Profit Sharing ---
    const profitSharingRows = sm.map(member => {
        const sharedAmount = (Number(q.grossProfit || 0) * Number(member.percentage || 0)) / 100;
        return `<tr>
            <td>${esc(member.name)}</td>
            <td class="right">${Number(member.percentage || 0).toFixed(2)}%</td>
            <td class="right">${currency} ${sharedAmount.toFixed(2)}</td>
        </tr>`;
    }).join('');

    // --- Main HTML Template ---
    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Internal Preview - ${esc(q.quoteNumber)}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #333; margin: 0; padding: 20mm 15mm; }
        .container { max-width: 800px; margin: auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 20px; }
        .company-info { display: flex; align-items: flex-start; }
        .logo { width: 140px; height: auto; margin-right: 15px; }
        .company-details h1 { color: #007bff; margin: 0; font-size: 22px; }
        .company-details div { font-size: 10px; line-height: 1.4; }
        .quote-info { text-align: right; }
        .quote-info h2 { font-size: 28px; font-weight: bold; color: #444; margin: 0 0 10px 0; }
        .quote-info-table { width: 280px; border-collapse: collapse; font-size: 10px; }
        .quote-info-table td { border: 1px solid #ccc; padding: 5px 8px; }
        .quote-info-table td:first-child { font-weight: bold; }
        .billing-details { margin-bottom: 20px; padding: 8px 12px; display: inline-block; line-height: 1.5; }
        .billing-details strong { font-size: 12px; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f2f2f2; font-weight: bold; font-size: 10px; }
        .right { text-align: right; }
        .desc { font-size: 9px; color: #666; margin-top: 3px; white-space: pre-wrap; }
        .footer { margin-top: 20px; padding-top: 15px; border-top: 2px solid #ccc; display: flex; justify-content: space-between; align-items: flex-start; }
        .notes-section { width: 50%; font-size: 10px; }
        .notes-section h5 { margin: 0 0 8px 0; font-size: 11px; }
        .totals-section { width: 45%; }
        .totals-table { width: 100%; font-size: 10px; border-collapse: collapse; }
        .totals-table td { padding: 5px; }
        .totals-table td:last-child { text-align: right; }
        .totals-table .total-row td, .totals-table .gp-total-row td { font-weight: bold; font-size: 11px; border-top: 1px solid #ddd; }
        .totals-table .gp-section-row td { padding-top: 15px; }
        .profit-sharing-section { margin-top: 20px; }
        .profit-sharing-section h5 { margin-bottom: 8px; font-size: 11px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-info">
                 <img src="${logoBase64 || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='}" alt="Company Logo" class="logo">
                <div class="company-details">
                    <h1>ARTIFLEX INFORMATION TECHNOLOGY LLC</h1>
                    <div>Dubai, United Arab Emirates<br>TRN: 104342158300003<br>+971558086462<br>accounts@artiflexit.com</div>
                </div>
            </div>
            <div class="quote-info">
                <h2>INTERNAL QUOTE</h2>
                <table class="quote-info-table">
                    <tr><td>Quote #:</td><td>${esc(q.quoteNumber)}</td></tr>
                    <tr><td>Date:</td><td>${new Date(q.quoteDate || Date.now()).toLocaleDateString('en-GB')}</td></tr>
                    <tr><td>Status:</td><td>${esc(q.status)}</td></tr>
                    <tr><td>Sales Person:</td><td>${esc(q.salesmanName || 'N/A')}</td></tr>
                    <tr><td>Currency:</td><td>${currency}</td></tr>
                    <tr><td>Payment Terms:</td><td>${esc(q.paymentTerms || 'N/A')}</td></tr>
                </table>
            </div>
        </div>
        <div class="billing-details">
            <strong>Bill To:</strong> ${esc(q.customerName || (c && c.companyName))}<br>
            <small>Contact: ${esc(q.contactPerson || 'N/A')} (${esc(q.contactDesignation || 'N/A')})</small>
        </div>
        <table class="items-table">
            <thead>
                <tr>
                    <th>Sl.</th>
                    <th>Product & Description</th>
                    <th class="right">Qty</th>
                    <th class="right">Unit Cost</th>
                    <th class="right">Total Cost</th>
                    <th class="right">Margin %</th>
                    <th class="right">Unit Price </th>
                    <th class="right">Total Price</th>
                </tr>
            </thead>
            <tbody>${itemRows}</tbody>
        </table>
        <div class="footer">
            <div class="notes-section">
                <h5>Terms & Conditions</h5>
                <p style="white-space: pre-wrap;">${esc(q.termsAndConditions || 'N/A')}</p>
                 ${profitSharingRows.length > 0 ? `
                    <div class="profit-sharing-section">
                        <h5>Profit Sharing</h5>
                        <table class="totals-table">
                            <thead>
                                <tr>
                                    <th>Member</th>
                                    <th class="right">Share %</th>
                                    <th class="right">Shared Amount</th>
                                </tr>
                            </thead>
                            <tbody>${profitSharingRows}</tbody>
                        </table>
                    </div>` : ''}
            </div>
            <div class="totals-section">
                <table class="totals-table">
                    <tr><td>Subtotal</td><td class="right">${currency} ${Number(q.subtotal || 0).toFixed(2)}</td></tr>
                    <tr>
                        <td>Discount (${q.discountMode === 'PERCENT' ? `${Number(q.discountValue || 0).toFixed(2)}%` : 'Amount'})</td>
                        <td class="right">${currency} ${Number(q.discountAmount || 0).toFixed(2)}</td>
                    </tr>
                    <tr><td>Net Amount</td><td class="right">${currency} ${(Number(q.subtotal || 0) - Number(q.discountAmount || 0)).toFixed(2)}</td></tr>
                    <tr><td>VAT (${Number(q.vatPercent || 0).toFixed(2)}%)</td><td class="right">${currency} ${Number(q.vatAmount || 0).toFixed(2)}</td></tr>
                    <tr class="total-row"><td>Grand Total</td><td class="right">${currency} ${Number(q.grandTotal || 0).toFixed(2)}</td></tr>
                    
                    <tr class="gp-section-row"><td>Total Cost</td><td class="right">${currency} ${Number(q.totalCost || 0).toFixed(2)}</td></tr>
                    <tr class="gp-total-row"><td>Gross Profit (GP)</td><td class="right">${currency} ${Number(q.grossProfit || 0).toFixed(2)}</td></tr>
                    <tr class="gp-total-row"><td>GP Margin</td><td class="right">${Number(q.profitPercent || 0).toFixed(2)}%</td></tr>
                </table>
            </div>
        </div>
    </div>
</body>
</html>`;
}


 
function buildQuoteHTML({ quote, items, customer, logoBase64 }) {
    // --- Initializations ---
    const esc = (str) => String(str || '').replace(/[&<>"']/g, s => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
    const q = quote || {};
    const c = customer || {};
    const it = Array.isArray(items) ? items : [];
    const currency = esc(q.currency || 'AED');

    // --- Build Table Rows for Quote Items ---
    const itemRows = it.map((row, idx) =>
        `<tr>
            <td class="center">${idx + 1}</td>
            <td>
                <b>${esc(row.product)}</b>
                <div class="desc">${esc(row.description)}</div>
            </td>
            <td class="right">${Number(row.quantity || 0).toFixed(2)}</td>
            <td class="right">${currency} ${Number(row.unitPrice || 0).toFixed(2)}</td>
            <td class="right">${currency} ${Number(row.totalPrice || 0).toFixed(2)}</td>
        </tr>`
    ).join('');

    // --- Calculate Totals ---
    const subtotal = Number(q.subtotal || 0);
    const discountAmount = Number(q.discountAmount || 0);
    const netAmount = subtotal - discountAmount;
    const vatAmount = Number(q.vatAmount || 0);
    const grandTotal = Number(q.grandTotal || 0);
    
    // --- Dynamic "Amount in Words" Logic ---
    let grandTotalInWords;
    try {
        const getCurrencyUnits = (currencyCode) => {
            const units = {
                USD: ['Dollar', 'Cent'], INR: ['Rupee', 'Paise'], SAR: ['Riyal', 'Halala'],
                AED: ['Dirham', 'Fils'], QAR: ['Riyal', 'Dirham'], KWD: ['Dinar', 'Fils'],
                BHD: ['Dinar', 'Fils'], OMR: ['Rial', 'Baisa'],
            };
            return units[currencyCode.toUpperCase()] || [currencyCode.toUpperCase(), 'Cents'];
        };

        const [majorUnit, minorUnit] = getCurrencyUnits(currency);
        const total = parseFloat(grandTotal) || 0;
        const parts = total.toFixed(2).split('.');
        const integerPart = parseInt(parts[0], 10);
        const fractionalPart = parseInt(parts[1], 10);
        const integerWords = (numWords(integerPart) || 'Zero').replace(/^\w/, c => c.toUpperCase());
        
        grandTotalInWords = `${integerWords} ${majorUnit}`;
        if (fractionalPart > 0 && minorUnit) {
            const fractionalWords = numWords(fractionalPart).replace(/^\w/, c => c.toUpperCase());
            grandTotalInWords += ` and ${fractionalWords} ${minorUnit}`;
        }
    } catch (error) {
        console.error(`Error converting number to words. Input was: ${grandTotal}`, error);
        grandTotalInWords = grandTotal.toFixed(2);
    }

    // --- Conditional Discount Row Logic ---
    let discountRowHtml = '';
    if (discountAmount > 0) {
        discountRowHtml = `
            <tr>
                <td>Discount (${q.discountMode === 'PERCENT' ? `${Number(q.discountValue || 0).toFixed(2)}%` : 'Amount'})</td>
                <td class="right">${currency} ${discountAmount.toFixed(2)}</td>
            </tr>
            <tr>
                <td>Net Amount</td>
                <td class="right">${currency} ${netAmount.toFixed(2)}</td>
            </tr>
        `;
    }

    // --- Main HTML Template ---
    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8">
    <title>Quotation - ${esc(q.quoteNumber)}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #333; margin: 0; padding: 20mm 15mm; }
        .container { max-width: 800px; margin: auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 20px; }
        .company-info { display: flex; align-items: flex-start; }
        .logo { width: 140px; height: auto; margin-right: 15px; }
        .company-details h1 { color: #007bff; margin: 0; font-size: 22px; }
        .company-details div { font-size: 10px; line-height: 1.4; }
        .quote-info { text-align: right; }
        .quote-info h2 { font-size: 28px; font-weight: bold; color: #444; margin: 0 0 10px 0; }
        .quote-info-table { width: 280px; border-collapse: collapse; font-size: 10px; }
        .quote-info-table td { border: 1px solid #ccc; padding: 5px 8px; }
        .quote-info-table td:first-child { font-weight: bold; }
        .billing-details { margin-bottom: 20px; padding: 8px 12px; display: inline-block; line-height: 1.5; }
        .billing-details strong { font-size: 12px; }
        .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .items-table th { background-color: #f2f2f2; font-weight: bold; font-size: 10px; }
        .right { text-align: right; }
        .center { text-align: center; }
        .desc { font-size: 9px; color: #666; margin-top: 3px; white-space: pre-wrap; }
        .footer { margin-top: 20px; padding-top: 15px; border-top: 2px solid #ccc; display: flex; justify-content: space-between; align-items: flex-start; }
        .notes-section { width: 50%; font-size: 10px; }
        .notes-section h5 { margin: 0 0 8px 0; font-size: 11px; }
        .totals-section { width: 45%; }
        .totals-table { width: 100%; font-size: 10px; border-collapse: collapse; }
        .totals-table td { padding: 5px; }
        .totals-table td:last-child { text-align: right; }
        .totals-table .total-row td { font-weight: bold; font-size: 12px; border-top: 1px solid #333; border-bottom: 1px solid #333;}
        .total-in-words { margin-top: 15px; font-style: italic;}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-info">
                 <img src="${logoBase64 || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='}" alt="Company Logo" class="logo">
                <div class="company-details">
                    <h1>ARTIFLEX INFORMATION TECHNOLOGY LLC</h1>
                    <div>Dubai, United Arab Emirates<br>TRN: 104342158300003<br>+971558086462<br>accounts@artiflexit.com</div>
                </div>
            </div>
            <div class="quote-info">
                <h2>QUOTATION</h2>
                <table class="quote-info-table">
                    <tr><td>Quote #:</td><td>${esc(q.quoteNumber)}</td></tr>
                    <tr><td>Date:</td><td>${new Date(q.quoteDate || Date.now()).toLocaleDateString('en-GB')}</td></tr>
                     <tr><td>Valid Until:</td><td>${q.validityUntil ? new Date(q.validityUntil).toLocaleDateString('en-GB') : 'N/A'}</td></tr>
                    <tr><td>Sales Person:</td><td>${esc(q.salesmanName || 'N/A')}</td></tr>
                    <tr><td>Currency:</td><td>${currency}</td></tr>
                </table>
            </div>
        </div>
        <div class="billing-details">
            <strong>Bill To:</strong> ${esc(q.customerName || (c && c.companyName))}<br>
            <small>Contact: ${esc(q.contactPerson || 'N/A')} (${esc(q.contactDesignation || 'N/A')})</small>
        </div>
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width:5%;" class="center">Sl.</th>
                    <th>Product & Description</th>
                    <th class="right" style="width:8%;">Qty</th>
                    <th class="right" style="width:12%;">Rate</th>
                    <th class="right" style="width:15%;">Amount</th>
                </tr>
            </thead>
            <tbody>${itemRows}</tbody>
        </table>
        <div class="footer">
            <div class="notes-section">
                <h5>Terms & Conditions</h5>
                <p style="white-space: pre-wrap;">${esc(q.termsAndConditions || 'N/A')}</p>
                <div class="total-in-words">
                    <strong>Amount in Words:</strong> ${grandTotalInWords} Only.
                </div>
            </div>
            <div class="totals-section">
                <table class="totals-table">
                    <tr>
                        <td>Subtotal</td>
                        <td class="right">${currency} ${subtotal.toFixed(2)}</td>
                    </tr>
                    ${discountRowHtml}
                    <tr>
                        <td>VAT (${Number(q.vatPercent || 0).toFixed(2)}%)</td>
                        <td class="right">${currency} ${vatAmount.toFixed(2)}</td>
                    </tr>
                    <tr class="total-row">
                        <td>Grand Total</td>
                        <td class="right">${currency} ${grandTotal.toFixed(2)}</td>
                    </tr>
                </table>
            </div>
        </div>
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

// async function canSeeLead(req, lead) {
//   if (isAdmin(req)) return true;
//   const self = String(req.subjectId);
//   return String(lead.creatorId) === self || String(lead.salesmanId) === self;
// }

// --- Routes ---

// List all quotes with role-based visibility

async function canSeeLead(req, lead) {
    // 1. Admins can always see the lead.
    if (isAdmin(req)) {
        return true;
    }

    const currentUserId = String(req.subjectId);

    // 2. The creator or assigned salesman can see the lead.
    if (String(lead.creatorId) === currentUserId || String(lead.salesmanId) === currentUserId) {
        return true;
    }

    // 3. A shared member can see the lead (this requires a database query).
    const share = await ShareGp.findOne({
        where: {
            leadId: lead.id,
            sharedMemberId: currentUserId,
        },
    });

    // If a 'share' record is found, !!share will be true. Otherwise, it will be false.
    return !!share;
}

// router.get('/', authenticateToken, async (req, res) => {
//     try {
//         const userId = String(req.subjectId);

//         // If the user is an admin, fetch all quotes without restrictions.
//         if (isAdmin(req)) {
//             const allQuotes = await Quote.findAll({
//                 include: [{
//                     model: Lead,
//                     as: 'lead',
//                     // Also include lead's salesman for context in the UI
//                     include: [{ model: Member, as: 'salesman', attributes: ['name'] }]
//                 }],
//                 order: [['createdAt', 'DESC']]
//             });
//             return res.json({ success: true, quotes: allQuotes });
//         }

//         // For non-admin users, build a clause to find all leads they can access.
        
//         // 1. Get all lead IDs that are explicitly shared with the current user.
//         const sharedLeadRecords = await ShareGp.findAll({
//             attributes: ['leadId'],
//             where: { sharedMemberId: userId },
//             raw: true // Ensures we get plain objects like [{ leadId: '...' }]
//         });
//         const sharedLeadIds = sharedLeadRecords.map(record => record.leadId);

//         // 2. Define the complete `where` clause for the included Lead model.
//         // A user can see a quote if the associated lead meets any of these conditions:
//         const leadWhereClause = {
//             [Op.or]: [
//                 { creatorId: userId },          // They created the lead.
//                 { salesmanId: userId },         // They are the assigned salesman.
//                 { id: { [Op.in]: sharedLeadIds } } // The lead has been shared with them.
//             ]
//         };

//         // 3. Fetch only the quotes where the associated lead matches the access criteria.
//         const quotes = await Quote.findAll({
//             include: [{
//                 model: Lead,
//                 as: 'lead',
//                 where: leadWhereClause,
//                 required: true, // This creates an INNER JOIN, ensuring only quotes with an accessible lead are returned.
//                 include: [{ model: Member, as: 'salesman', attributes: ['name'] }]
//             }],
//             order: [['createdAt', 'DESC']]
//         });

//         res.json({ success: true, quotes });

//     } catch (e) {
//         console.error('List Quotes Error:', e);
//         res.status(500).json({ success: false, message: 'Server error while listing quotes.' });
//     }
// });


// Create quote with approval logic
// router.post('/leads/:leadId/quotes', authenticateToken, [
//     // Validation rules are correct and enforce data integrity
//     body('items.*.itemCost').isFloat({ min: 0 }).withMessage('Item cost must be a non-negative number.'),
//     body('items.*.itemRate').isFloat({ gt: 0 }).withMessage('Item rate must be a positive number.'),
//     body('quoteDate').optional().isISO8601(),
//     body('validityUntil').optional().isISO8601(),
//     body('salesmanId').optional().isString(),
//     body('customerName').trim().notEmpty(),
//     body('discountMode').isIn(['PERCENT', 'AMOUNT']),
//     body('discountValue').isFloat({ min: 0 }),
//     body('vatPercent').isFloat({ min: 0 }),
//     body('items').isArray({ min: 1 }),
//     body('items.*.product').trim().notEmpty(),
//     body('items.*.quantity').isFloat({ gt: 0 }),
// ], async (req, res) => {
//      const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//         return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
//     }

//     try {
//         const lead = await Lead.findByPk(req.params.leadId);
//         if (!lead) {
//             return res.status(404).json({ success: false, message: 'Lead not found' });
//         }

//         const { items, discountMode, discountValue,  salesmanId, vatPercent } = req.body;
//         console.log(req.body)
//         let quoteSubtotal = 0;
//         let quoteTotalCost = 0;

       
//         const computedItems = items.map((it, index) => {
//             const qty = Number(it.quantity || 0);
//             const cost = Number(it.itemCost || 0);
//             const rate = Number(it.itemRate || 0);
//             const grossBeforeDiscount = qty * rate;

//             let lineDiscount = 0;
//             if (it.lineDiscountMode === 'AMOUNT') {
//                 lineDiscount = Number(it.lineDiscountAmount || 0);
//             } else { // Default to PERCENT
//                 lineDiscount = (grossBeforeDiscount * Number(it.lineDiscountPercent || 0)) / 100;
//             }
//             lineDiscount = Math.min(lineDiscount, grossBeforeDiscount); // Cap discount

//             const lineGross = grossBeforeDiscount - lineDiscount;
//             const lineCostTotal = qty * cost;
//             const lineGP = lineGross - lineCostTotal;
//             const lineProfitPercent = lineGross > 0 ? (lineGP / lineGross) * 100 : 0;
            
//             quoteSubtotal += lineGross;
//             quoteTotalCost += lineCostTotal;

//             return {
//                 ...it,
//                 slNo: index + 1,
//                 lineDiscountAmount: lineDiscount.toFixed(2),
//                 lineGross: lineGross.toFixed(2),
//                 lineCostTotal: lineCostTotal.toFixed(2),
//                 lineGP: lineGP.toFixed(2),
//                 lineProfitPercent: lineProfitPercent.toFixed(3),
//             };
//         });

//         // 2. Calculate overall quote totals
//         const overallDiscount = discountMode === 'PERCENT'
//             ? (quoteSubtotal * Number(discountValue || 0)) / 100
//             : Math.min(Number(discountValue || 0), quoteSubtotal);
        
//         const netAfterDiscount = quoteSubtotal - overallDiscount;
//         const vatAmount = netAfterDiscount * (Number(vatPercent || 0) / 100);
//         const grandTotal = netAfterDiscount + vatAmount;
//         const grossProfit = netAfterDiscount - quoteTotalCost;
//         const profitPercent = netAfterDiscount > 0 ? (grossProfit / netAfterDiscount) * 100 : 0;

//         // 3. Determine approval status
//         let isApproved = true;
//         let initialStatus = 'Draft';
//         if (!isAdmin(req) && grandTotal < APPROVAL_LIMIT) {
//             isApproved = false;
//             initialStatus = 'PendingApproval';
//         }

//         const member = await Member.findByPk(salesmanId);
//         if (!member) {
//             return res.status(403).json({ success: false, message: 'Creator not found.' });
//         }

//         const quoteNumber = `Q-${new Date().getFullYear()}-${Date.now()}`;
        
//         // 4. Create the Quote record
//         const createdQuote = await Quote.create({
//             ...req.body,
//             quoteNumber,
//             leadId: lead.id,
//             isApproved,
//             status: initialStatus,
//             subtotal: quoteSubtotal.toFixed(2),
//             totalCost: quoteTotalCost.toFixed(2),
//             discountAmount: overallDiscount.toFixed(2),
//             vatAmount: vatAmount.toFixed(2),
//             grandTotal: grandTotal.toFixed(2),
//             grossProfit: grossProfit.toFixed(2),
//             profitPercent: profitPercent.toFixed(3),
//             salesmanName: member.name,
//             approvedBy: isApproved ? 'Auto-approved' : null,
//             rejectNote: null,
//         });

//         // 5. Create all QuoteItem records
//         await QuoteItem.bulkCreate(computedItems.map(ci => ({ ...ci, quoteId: createdQuote.id })));

//         if (lead.stage !== 'Quote') {
//             await lead.update({ stage: 'Quote Negotiation' });
//         }
        
//         if (initialStatus === 'PendingApproval') {
//             await notifyAdminsOfApprovalRequest(createdQuote, lead, member);
//         }

//         await writeLeadLog(req, lead.id, 'QUOTE_CREATED', `Created quote #${quoteNumber}. Status: ${initialStatus}`);
        
//         res.status(201).json({
//             success: true,
//             quoteId: createdQuote.id,
//             quoteNumber: createdQuote.quoteNumber,
//             isApproved: createdQuote.isApproved,
//             status: createdQuote.status,
//         });

//     } catch (e) {
//         console.error('Create Quote Error:', e);
//         res.status(500).json({ success: false, message: 'Server error', error: e.message });
//     }
// });

router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = String(req.subjectId);

        // If the user is an admin, fetch all quotes without restrictions.
        if (isAdmin(req)) {
            const allQuotes = await Quote.findAll({
                include: [{
                    model: Lead,
                    as: 'lead',
                    // Also include lead's salesman for context in the UI
                    include: [{ model: Member, as: 'salesman', attributes: ['name'] }]
                }],
                order: [['createdAt', 'DESC']]
            });
            return res.json({ success: true, quotes: allQuotes });
        }

        // For non-admin users, build a clause to find all leads they can access.
        
        // 1. Get all lead IDs that are explicitly shared with the current user.
        const sharedLeadRecords = await ShareGp.findAll({
            attributes: ['leadId'],
            where: { sharedMemberId: userId },
            raw: true // Ensures we get plain objects like [{ leadId: '...' }]
        });
        const sharedLeadIds = sharedLeadRecords.map(record => record.leadId);

        // 2. Define the complete `where` clause for the included Lead model.
        // A user can see a quote if the associated lead meets any of these conditions:
        const leadWhereClause = {
            [Op.or]: [
                { creatorId: userId },             // They created the lead.
                { salesmanId: userId },            // They are the assigned salesman.
                { id: { [Op.in]: sharedLeadIds } } // The lead has been shared with them.
            ]
        };

        // 3. Fetch only the quotes where the associated lead matches the access criteria.
        const quotes = await Quote.findAll({
            include: [{
                model: Lead,
                as: 'lead',
                where: leadWhereClause,
                required: true, // This creates an INNER JOIN, ensuring only quotes with an accessible lead are returned.
                include: [{ model: Member, as: 'salesman', attributes: ['name'] }]
            }],
            order: [['createdAt', 'DESC']]
        });

        res.json({ success: true, quotes });

    } catch (e) {
        console.error('List Quotes Error:', e);
        res.status(500).json({ success: false, message: 'Server error while listing quotes.' });
    }
});


router.post('/leads/:leadId/quotes',
  authenticateToken,
  [
    // --- Comprehensive Validation Rules ---
    body('quoteDate').optional().isISO8601().withMessage('Invalid quote date format.'),
    body('validityUntil').optional().isISO8601().withMessage('Invalid validity date format.'),
    body('salesmanId').isString().notEmpty().withMessage('Salesman ID is required.'),
    body('customerName').trim().notEmpty().withMessage('Customer name is required.'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
    body('paymentTerms').optional().isString().withMessage('Payment terms must be a string.'),
    body('items.*.product').trim().notEmpty().withMessage('Item product name is required.'),
    body('sharePercent').optional().isFloat({ min: 0, max: 100 }).withMessage('Invalid share percentage.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { leadId } = req.params;
    const { items, discountMode, discountValue, sharePercent, ...headerData } = req.body;
    const isAdmin = req.subjectType === 'ADMIN';

    let transaction;
    try {
      transaction = await sequelize.transaction();

      const lead = await Lead.findByPk(leadId, { transaction });
      if (!lead) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }

      // --- 1. Backend Calculation Logic ---
      let quoteSubtotal = 0, quoteTotalCost = 0, quoteVatAmount = 0;
      const computedItems = items.map((it, index) => {
        const quantity = Number(it.quantity || 0);
        const unitCost = Number(it.unitCost || 0);
        const marginPercent = Number(it.marginPercent || 0);
        const vatPercent = Number(it.vatPercent || 0);
        const unitPrice = unitCost * (1 + marginPercent / 100);
        const lineGross = unitPrice * quantity;
        quoteSubtotal += lineGross;
        quoteTotalCost += unitCost * quantity;
        quoteVatAmount += lineGross * (vatPercent / 100);
        return { ...it, slNo: index + 1, unitPrice, lineGross };
      });

      const discountAmount = discountMode === 'PERCENT' ? (quoteSubtotal * Number(discountValue || 0)) / 100 : Math.min(Number(discountValue || 0), quoteSubtotal);
      const netAfterDiscount = quoteSubtotal - discountAmount;
      const grandTotal = netAfterDiscount + quoteVatAmount;
      const grossProfit = netAfterDiscount - quoteTotalCost;
      
      const requiresApproval = computedItems.some(item => Number(item.marginPercent) < 8);
      const finalStatus = (requiresApproval && !isAdmin) ? 'PendingApproval' : 'Draft';

      const salesman = await Member.findByPk(headerData.salesmanId, { transaction });
      const uniqueQuoteNumber = await generateUniqueQuoteNumber(transaction);

      // --- 2. Create the Main Quote Record ---
      const createdQuote = await Quote.create({
        ...headerData,
        quoteNumber: uniqueQuoteNumber,
        leadId: lead.id,
        discountMode,
        discountValue,
        subtotal: quoteSubtotal,
        totalCost: quoteTotalCost,
        discountAmount,
        vatAmount: quoteVatAmount,
        grandTotal,
        grossProfit,
        profitPercent: netAfterDiscount > 0 ? (grossProfit / netAfterDiscount) * 100 : 0,
        sharePercent: sharePercent || 0,
        status: finalStatus,
        salesmanName: salesman ? salesman.name : 'N/A',
      }, { transaction });

      // --- 3. Create all associated QuoteItem records ---
      await QuoteItem.bulkCreate(computedItems.map(ci => ({ ...ci, quoteId: createdQuote.id })), { transaction });

      // --- 4. Update ShareGp records if the lead is shared ---
      if (sharePercent > 0) {
        await ShareGp.update(
          {
            quoteId: createdQuote.id,
            profitPercentage: sharePercent,
            profitAmount: (grossProfit * (sharePercent / 100)).toFixed(2),
          },
          {
            where: { leadId: lead.id },
            transaction,
          }
        );
      }
      
      // --- 5. Update Lead Status and Quote Number ---
      const leadUpdates = {
        stage: 'Quote Negotiation'
      };
      
      if (!lead.quoteNumber) {
        leadUpdates.quoteNumber = createdQuote.quoteNumber;
      }
      
      await lead.update(leadUpdates, { transaction });

      // --- 6. If everything is successful, commit the transaction ---
      await transaction.commit();
       try {
            const actorName = await resolveActorName(req);

            // 1. Check if the quote requires approval
            if (finalStatus === 'PendingApproval') {
                await notifyAdminsOfApprovalRequest(createdQuote, lead);
            }

            // 2. Check if the lead was shared and notify the relevant member
            if (sharePercent > 0) {
                await notifySharedMemberOnQuoteCreation(createdQuote, lead, sharePercent, actorName);
            }

        } catch (emailError) {
            // Log the error but don't fail the request, as the quote was created successfully.
            console.error('Failed to send quote creation notifications:', emailError);
        }
      res.status(201).json({
        success: true,
        message: `Quote created successfully with status: ${finalStatus}.`,
        quoteId: createdQuote.id,
        quoteNumber: createdQuote.quoteNumber,
      });

    } catch (e) {
      if (transaction) await transaction.rollback();
      console.error('Create Quote Error:', e);
      res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
    }
  }
);




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


router.get('/leads/:leadId/quotes/:quoteId/preview', authenticateToken, async (req, res) => {
  try {
    const { quoteId, leadId } = req.params;

    // Step 1: Fetch the Quote and its line items
    const quote = await Quote.findByPk(quoteId, {
      include: [{ model: QuoteItem, as: 'items' }]
    });

    // Validate the quote
    if (!quote || String(quote.leadId) !== String(leadId)) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    // Step 2: Fetch the Customer separately using the customerId from the quote object
    let customer = null;
    if (quote.customerId) {
        customer = await Customer.findByPk(quote.customerId, {
            attributes: ['id', 'companyName', 'address']
        });
    }

    // Step 3: Fetch the profit sharing data using the CORRECT alias from your associations file
    const shares = await ShareGp.findAll({
      where: { quoteId: quoteId },
      include: [{
        model: Member,
        as: 'sharedWithMember', // <<< THIS IS THE FIX. It now matches your association definition.
        attributes: ['name']
      }]
    });

    // Step 4: Format the sharing data using the correct property name
    const sharedMembersData = shares.map(share => ({
      name: share.sharedWithMember ? share.sharedWithMember.name : 'Unknown Member',
      percentage: share.profitPercentage
    }));
    
    // Placeholder for logo - you can fetch this from a config or database
    const logoBase64 = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABRAAAANgCAYAAABUbkR/AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAQsDSURBVHja7N13nCRnfefx7++p6jB5NgfFVc4SkiwEkpAQIDIi2hgMxmQwBwjb53DOvrON7QOBbTC2CfYBtu9sYxNsTBACRBCSEMqruCtt3p2d3LGqnuf+qFnFbWlD98z09Of9eo12tTNTXf3UU91V335+z2MhBAEAAAAAAADA/jiaAAAAAAAAAEArBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIA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AFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgBAAD//wMA2zakNoQOY/IAAAAASUVORK5CYII=`


    // Step 5: Build the HTML with all the correctly fetched data
    const html = buildQuoteInternalPreviewHTML({
      quote: quote.toJSON(),
      items: quote.items.map(i => i.toJSON()),
      customer: customer ? customer.toJSON() : null,
      sharedMembers: sharedMembersData,
      logoBase64: logoBase64
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
     const memberAllowed = new Set(['Draft', 'Sent' ,'Accepted', 'Rejected', 'Expired']);
     if (isMember && (quote.status === 'PendingApproval' || !memberAllowed.has(newStatus))) {
       return res.status(403).json({ success: false, message: 'Not allowed to set this status' });
     }
     await quote.update({ status: newStatus });
      if (newStatus === 'Accepted') {
                await notifyAdminsOfSuccess(
                    `Quote Accepted: #${quote.quoteNumber}`,
                    `The quote for lead '${quote.lead.companyName}' has been accepted by the customer.`
                );
            }
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
    try {
        const quote = await Quote.findByPk(req.params.quoteId, { include: [{ model: QuoteItem, as: 'items' }] });
        if (!quote || String(quote.leadId) !== String(req.params.leadId)) {
            return res.status(404).json({ success: false, message: 'Quote not found' });
        }
        
        if (!quote.isApproved && !isAdmin(req)) {
            return res.status(403).json({ success: false, message: 'Quote requires admin approval for download.' });
        }
        
        const lead = await Lead.findByPk(quote.leadId, {
            include: [
                { model: Customer, as: 'customer', attributes: ['id', 'companyName', 'address'] },
                { model: Member, as: 'salesman', attributes: ['id', 'name', 'email'] },
            ]
        });
        
        // --- ADD YOUR LOGO DATA HERE ---
        // TODO: Replace 'null' with your actual base64 encoded logo string.
        // This could be loaded from an environment variable, a config file, or a database settings table.
         const logoBase64 = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABRAAAANgCAYAAABUbkR/AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAQsDSURBVHja7N13nCRnfefx7++p6jB5NgfFVc4SkiwEkpAQIDIi2hgMxmQwBwjb53DOvrON7QOBbTC2CfYBtu9sYxNsTBACRBCSEMqruCtt3p2d3LGqnuf+qFnFbWlD98z09Of9eo12tTNTXf3UU91V335+z2MhBAEAAAAAAADA/jiaAAAAAAAAAEArBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQEgEiAAAAAAAAgJYIEAEAAAAAAAC0RIAIAAAAAAAAoCUCRAAAAAAAAAAtESACAAAAAAAAaIkAEQAAAAAAAEBLBIgAAAAAAAAAWiJABAAAAAAAANASASIAAAAAAACAlggQAQAAAAAAALREgAgAAAAAAACgJQJEAAAAAAAAAC0RIAIAAAAAAABoiQARAAAAAAAAQEsEiAAAAAAAAABaIkAEAAAAAAAA0BIBIgAAAAAAAICWCBABAAAAAAAAtESACAAAAAAAAKAlAkQAAAAAAAAALREgAgAAAAAAAGiJABEAAAAAAABASwSIAAAAAAAAAFoiQAQAAAAAAADQUkwToNf8z401GuEARCaVnJX/dXvjjd/bnbzYYpuOpHR9n7vnzJH4+ivXFe+4ZSrd9Zf313X6cKS3bSjrpEGnD95T04kDkc4fjfXR++t65opY547G+vcdTV23N9E5I7F+7aQ+7W54XT+R6qGqVz2TkhAkSX2xaU3JaUO/0zH9Tv2RKQ0cD0l649ElGgEAAAAAMO8IENFz9jQ9jfBULwxmqmahtL3mL9lc9S+Qs2eY1AhSNpWEM+6eyc7/Qmh+a1fdb4pMKkd213DBHlheNMUmeQI/AAAAAACWTk5AE6DX7KiTbj2ZyKT+SLaz4ddeszt5Tj3xz7TIVklSkDSVhGOmmun5902mZ0naXiiaKmn43p3T2Teqqd9YzdToi2w6NiVGcwIAAAAA0PUIENFzHKnWfoUgmUmxScVIfUWnowsm1U1Ve1z7BTPJ6VhJR2VBeqCSPe2vHqhfUY701cHYNi1bZdcWnN0v5aEjAAAAAADoXgSI6DlnDkc0wn4UzDSbet02nenO6ezIvU3/8roPl5nZysf/rD3y+hFLUtOr1Ez8ebPSykrRTX5lZ3LOaCH5eiULU6uK9pPhgk2ZCBMBAAAAAOhGBIjoOcf1EyDuT39s2l2X3TCRDd45nV5eT8LLFdtxBzJi05nyoYvSMbUsHHPzWHKcTGeOlN34por/chaybwZptmAaFzkiAAAAAABdhQARPafBCh/75TKp6VU06exyZC+uex17KNXeziQVbFDSxbNpCP+8rXnsaNE2nD4c3Vpydq2kPbQ2AAAAAADdgwARvdfpmQPxCYKkodhUy8xvrfuTKs1wnLnDmi7SJEVeUvA6Y28zxHfOZOXZZlg2GOvGlUX78VTCas0AAAAAAHQDAkT0nMmE1OrxIpMmmtngnbPZ+Vuq2fOTLKx1bVhtxiRZpEKQzhirh0QhXLKjFp72lZ3J3ywv2r1Dsc3Q+gAAAAAALG4EiOg52+ueRnic/sh002R6/Dd2J6+vZeEKxTbazu2bZOZ0rmS6dSo76dap2vKfPar0t8cMuGskeTEvIgAAAAAAixYBInpONSOrkqQQpIIz9UfScGzKggZmm35UzorW2TLvZQrhed/c1WwcPxz1ry+523wIDzSzh1d3BgAAAAAAiwgBInrOiYOswixJBZPGk6BNlUz3V/w5989mV0o6VXlFc8c4J0m2bHfNv3gyC0P14ehLowXXV3L2QNOHGkcGAAAAAIDFhQARPedpIwSIkjQYm26eyuxbu5OB6/amL6w2/WtdbEfP1+O7gi1vel1y81TWOGPIlq0s2jck3SEpEyXNAAAAAAAsGgSI6DnMgPhIO0SmUjnSMbEpSKrO9z6YtCwEXf7AbBbV+m3q2H4XOdktIQ8RAQAAAADAIkCAiJ7jevz5B+VzDQ7FpkoaRu+Zya5IvC4yp9H53hczOZNWVdNw0bZaKMam0tH9rlpyekBSk94KAAAAAMDCI0BEz6n1+Ng2s3wBlbFmKN45nZ2xcTJ7qSK72DkrLNQ+uUjr6qkuurfiqwORD2vKUdOZNolSZgAAAAAAFhwBInrOg9XeThBjJyVeunEyO+Ebu5tXKrIL5FRY6P0yp9EQ9Nw7J9PiYKzNZw9HW5xZQoIIAAAAAMDCIkBEz2n08CSIQdLAXN3wjyfT4+6bys612AYWw76ZFAVpZT0Ll9w5mdVHi2nzVeuL31hdcppJg9IgNX1QFvISbAAAAAAAMD8IENFzejlAdCZNJ6Ewnvij9jb9hQpav5jCOJNksa0aq/uXfmN34k8acDOzaXRL3atedFJ/ZCq6vAQbAAAAAADMDwJE9JwtPTwJYl9k2lz1a7+3N/nZ7TX/KkV25GLcT4ttoJGF5//15kY8FNufrSu7m44bcLpgeawN/ZHqGQkiAAAAAADzhQARPWc67a3wyYd83sM+Zyo5Uy0Lo5sr/mgFrTG3OF8DzOSyoFXTNf+C6ch2F5yS5UXdmnpW0QYAAAAAYL4RIKLnrC/3VgTlTKpn0ngz6MFqduTuur9U0gblCzIv6v32sY2WnV3hzDb2RbYtNk0EydOLAQAAAACYPwSI6DnnjvZWtx+ITQ/MZrp9OtENE8kle+v+jc7sHNniP/+dSfXUh8lEa0JwpzrTzZIq9GIAAAAAAOYPASJ6To8NQFRfJJWcSpF0ZDXTyjQLsYut0C37b05HTifhxTeNp4VzRuIH1yyzyp6GVGdFZgAAAAAA5gUBInpOry2hEklKg/p3NcIl8uFpFllfN+2/mQ2lXudvq/i+H4ynW0cK9oU0aOeKoqk/MrGeCgAAAAAAnUWAiJ7jezBwGk/Cilun0qdXm+GFLra13bb/zqRQsNOv3ZO8ceNMNn3KcPRPl60spCcMODU8CSIAAAAAAJ1EgIies63WG2twmOWjD7+/1x/9zbH0FXUfXihna7r2+UhKstA3mYZVZjrZSfcHqU6PBgAAAACgswgQ0XOmk94YsRY7qT8yXT+RbvjRnuQyF+kY6/b5H03LU6+Lt9e8T4P2DsW2M/VBzZCPLGU+RAAAAAAA2o8AET3HeiRlCkFW9yrXsnCCfFilyFLr8nPeOTuqlobR2yez6BnL/c2nDIU9da8sMqngpEA1MwAAAAAAbUeAiJ6zpbr0S5iLTppMwsDt09nL7prNXqfITlVe0dz9TEOSLv3PXc3pB6uZP37Afe/iFQUd1edUy+jfAAAAAAC0GwEies5Yc+kGiCap6EwjBdNUElbdPJmd2Uj96S62QS2R0XkuH0G6bOtMds5sGk5ZVizcVnCaHSmYj4whiAAAAAAAtBsBInrOaMEtyedlkryCGplUScOyahbOjkyrZEoVluQTtsh0fNOH87KgG7w0m5IfAgAAAADQdgSI6DnnjS7Nbl+KTONNr2v3JLplKj11rBF+ruHDM5yzVUvx+TpnJ0zV/cu/O5ZmL11bvGt5wc1W07yGmcVUAAAAAABoHwJE9JwVxaU5ArEvMvmgyEtrdjX8ibP1sMYKtn7JhmmmvtTr1LG6f+V/7krukezLIwVNhGBiICIAAAAAAO1DgIie0/RLL14KkmInJT6Ualm4IDY7W5GCSQ1JpSV7MJ0pMp325e3Nl1bScM9L1hWvT31QGhiFCAAAAABAuxAgoue4JZgsBUn9zhQ72X0Vf/x03T/XxXaCpOJSP5ZBCvVmWFvLwrrhyKkqryYBIgAAAAAAbUOAiJ6zo770VmEuOtPGmWT1DRPp83bW/ZVeOtkt8fDw0YLTqRtn/Gv/bUezuqHfXTdYsGriKWQGAAAAAKAdCBDRc/Y0l1awZJKGY+mHE+kxX9nefJk5XajYCj10SM1iW7mjmj3ni82w7WXrivce0+82zaZBGRkiAAAAAACHjQARPaewxNZQMUnlyORMyxRCXwjWdKZeChBlQQqmemyyogurS05b6qZUknyQjHpmAAAAAAAOGQEies722tIpYY5NanjZtyvJ8++czt4k03m2lBdNeRJmtrzpw/N+sDctPVgNjWMH3E/OGo40WnBLcuEcAAAAAADmCwEies7uxtIIECMz9UeymVQrrtubPKNW95e5olvTq8fVTP2ZdMam6TTZ3QzXrykX7j+iz1WO6It8JSVABAAAAADgUBEgoucUun0Z5iDJJCfJmfoj00mDsYVaZOOS1vTysTWpGSIb749snUlnNb1+XM9CrcEIRAAAAAAADhkBInrOOSNRV+9/waQkSDdPZrphIls+3vQvnk7D883ZkRxdxWZ25nTdx3fP+qlXRbpppGBq+CCmQQQAAAAA4BBvtmkC9Jpj+ro7QCxGQQ1vunkiG9pc9ZfN1LNXKLJTHQmZJDkzrW6kYeSBSjZ93d707loWbig6m2VFZgAAAAAADg0BInpOvcvLWb2khg+WSSeXnF48E9mpDK97/CublZo+XPYPWxrb9tQLY89cUbitmgWRIQIAAAAAcAi32TQBeq7Td3HYFiQNRKaSU9jZyI6ZqvsN5jimj2cmpV7FiZpf2/BheDg2JT4ok8haAQAAAAA4SASI6Dl7m907Di0yaVcj9G+uZGfeX8lelmThOEft8hOYpJCvM3P6vRX/sh9OpFPDse6MnXnWUwEAAAAA4OAQIKLnbK35rtvnfRHhQGy6ayY74qu7mq+eScMLFNtKjuj+OVMhxHbiXVPZa3Y3/PhlKwvbhgs22cgUyBABAAAAADhwBIjoOc0uG4IWJMVmKkfScGyKnQZm0jDsvZyjfPlJmaTgQxqCReVI6/qczSY+JPW5+RAZuwkAAAAAwFMjQETPOW24u1ZhLjjTZNPr3orXPTPJmffMZj/jgy6UaYCj+dTMaVk9C5fcNpU1lhXCxLqy23HiYKSCM6WMRQQAAAAA4CkRIKLnnD3SXQHiUGzaOCP7wURa+Nru5JKZevYqV3AnciQPjDlbWfV63q0T2ehQMdz9vNX2tVOGo+ZgZF2/IjcAAAAAAPOBABE9J+myKRCbXgpSsey0oRxZPGM2wVE8OCZFwXR20elFsen+1OvuxORTT9sAAAAAAPBUCBDRc6Ium/hupGDKgsq3TmWXVRJ/hUV2JEfx4JgkOfVVm/683Y1w0kBsd/U5UxIC8yACAAAAAPAUCBDRc2bTLilbNclk2lLzpVum0jNvnUpfqkzPdbEVOYqH1JyqpeGI+6vZs+6Zye5c3+ceDEFNL8qYAQAAAAB4MgSI6Dmbqt1RtxqZFJnpRxPp0V/f3XxpZHZxFqnAETysRl27q+5f9umHGlOXriz8/UkDbnM1I0AEAAAAAODJECCi53RDXhQkOZPKkemBSrb+/qnsLBfbsFFve1jMKWpmWrNpJjv23NF4pByZZtKgmg9KvUT7AgAAAADwRASI6DndMOLMmamahXh7LVu3ve4vU9AJkrxJjiN46ExSMJmCjt9Zyy69v2LjsWnLyqJTX9Qd4TIAAAAAAPONABE9Z2tt8Zcwl51pV8OPfmcsedWWmn+NYjtOhIdt4UwDMj3zh2PJ8APVbPaZywufOn801klDkSopCSIAAAAAAI9HgIies1gXUQkhL1vui0x9kUmy4Z31sDJJwzKLjPCwfUxSnGWhUM00FJuOKkfaWXZKMloZAAAAAIAnIEBEzzm6b3GmRJGZGj5oVyPontls/baaf34qnS1Tian52s8iKwcfztlS83vrXl8pOJvIWJEZAAAAAIAnIEBEz3na6OLs9v2RaWfDa+Nsomv3JOfuqfvXOaefcs5KHLX2M2fHTzfDyPXjqXvFev9jSROe/BAAAAAAgCcgQETPiWzx7ldsKhScHZVJa+TVlOMc7SizlVnQ8/91e/OuShqmTxiKtoYgLdYg8VkcMQAAAADAAiCcABaBIKnoTM7kdtaz85M0PMsirZ77FjrEnGTSmh+MJZeVnX5wdH+0teGDmj6fKBEAAAAAABAgogcli3ARZjOp5oPb0/Cr7pjOLphp+CtcwdZytDrc7vkfQZnWzaQ6vZaFG81UNVMgugUAAAAAIEeAiJ6zpb64EkSTVHLSPXuz9d8eS181lfgXK7JVHKl5PASRnXDPbPYzn32oMXPOaPSlFUU32fA0DAAAAAAAEgEielA1WzxDy4KkSFJf5HRPJVv7o7HkmXJ2gjlFHKn5Y0790w1/2o2ZP/voAff9ZQVNVtKgpg8iRwQAAAAA9DoCRPScRZQfyiQlkpto+vJsEk5T0HpJTePcnPfjEEyZyVZX0nD2TBr2BmlyqGCKRD0zAAAAAKC3EVKg52ytZotmXwpOqmQW/WQyfcnGmeznFdnTnKnMUZp/ztmKLOgF39mTjN5d9hNPG42+ddmqgtaUnGoZASIAAAAAoHcRIKLnTCQLGwYF7Zv30DRsptSHZffNZhtm6/44V7ABjtDCvR56adV03a/15jacLd01UrCxVUWXzmYUMgMAAAAAeviGmSZAr1lZdAv6+GZSCFIlC5pMwuhk6p9upqPlODYLzaQ0ROYL0umzaRhLvK5JQ5hNyA8BAAAAAD2MABE959zRhV2fpOCkupeu3Z3qe3vTY3Y3/c/UfLjMRbaGo7PgIufs7Kl6NnTHtMYkfbc/Ms1mQUbbAAAAAAB6FAEies5wYWGjoKKTipkUmdZNpeHkSsMPKbKVzjgfFwGTVPbSSbsb/sp/3tbcevGK+L/WlNzuJDAPIgAAAACgNxFYoOcsdDlqZJIP0mwazpQPz1RkQzI1JZU4OovlldHiptf5X97RfEkI4Z4XrCnunk2DqGQGAAAAAPTkbTJNgF5jCzgAMQSpYKamhWhTLdswUfeXuoKdzrm4uDhJXmoqC6NeWlmK8rJzHxa2/wAAAAAAsBAILdBzttcWbhxZyZnunvHLbp5Kn72p4l8VTCebVOCoLD4mFYPTOT+Zyl7vlDSO6XfX9kdKEyqZAQAAAAA9hgARPWeiOf8J0L5HXFaUNs6ma764o/k8H/R0i62PI7I4mRTJ2eods9mzvp2EjS9cU7htedF2VzKFLASF/GcAAAAAAFjyCBDRc6IFTH1c/scaHzSsoJRy2MXNJAVTteBUdqbjnWwmtlCNOHAAAAAAgB5CgIies7U+/yXMzvJRiN8e85ffPZ2+TdKzzDTE0Vj8zNn6Shpeet3edHhV0cZPG442Pm00VtmZWJkZAAAAANALCBDRc3Y35jdAjJ2pz8kFU98t0+kZe2eyC1zJredIdAczDTS9Tts2m+2ZKdtppw5HO48oR1NDBQuNjAARAAAAALD0ESCi5wzE81t+6oPkg/p80Bn9kQ3tjW2So9BdzDQbIquUnJ2eBY01fPh+IVPa8ASIAAAAAICljwARPedpI/PT7Z3l8y3ePJHphsm0bzIJl483w8vN2Ykche5iUr9MF07V/OCDVb9pMNZ3BmNTmgQWUgEAAAAALHkEiOg568rR/JxcJkVOumPKD+5uhEvGatmrZXaucxyDbnytNGll0+v8+yvZzm/uTh46eSj+cV+k2ZRBiAAAAACApX5TTBOg18xX2WlmUhSkptdxkfSSKLJzmTKv218xbXC8Ga743Jbm2AvXaM85o9Fds2kQh7U3uQ98vhObfUmb35u/LCntocOyTtLTF/H+1SQ15v4+K2lG0vjcV3YwG/Ifet1i7L+SdLGklbxCHLSvSaouwvOhKek/pQV7q1vs5/R8GpN03SJu54XuK7wXdYfrJe04zG2cIemEDuzbDZK2dUk7liS9sAPbnfAfet236aZoeTtME6DnOv081JwGSSUn9cdOY02/bryWHRcik6Petas5k3yQm0nCsHMaGI5NDR9Uz6Q0UM6Mw3aRpC+1eZuvlfRPPdJ+R0q6VtLxXbr/U5L2zt28bJa06VFfP5n7/mL3Lkkf41Q+JN9S/gFCdRGeD38l6d2a/2Co28/pTvh5SX+/iNt5ofoK70Xd435Jl0naeoi/X1L+4egxHdi36yQ9q0v6729L+o0ObDdzH/j86f5Dr7ubror9IUBEz9nd6Px7QmxSNQvlrbXs9Ntn0lclQae5/M2IjKnLmVQO0k/dOpm+LvEhXV1yPzlp0GlFMVKTRVV6S/sP91Ud2MsPqHcCxLd2+Q3byNzXcZIu2c/3N0m6ae7re+6qz//Af/h16SLqv5L0R7wwHLJnS7pC0r8twvPhnZI+qDzY5pxeWL+v9geIS6Gv8F7UPY6X9GpJVx/i779FnQkPpXwE/bsl/eUib8PzJf1qh7YdSfpdST9LV8X+ECCi5+yo+45u3yQNxqbNVb/iSzuaLxlvZi9UZKtp+aXBTGUznXrnRNL3YC3bcsXq4l2Xroybpw9HgQkRe01bj/exkl7RgZ28QNIzJP2A49X1Nsx9vXru/6fcVZ+7RtJXJX3Jf/j1Oxaw/wIAMB++pbxcvtih7X9Q0n8o/9BuMSpJ+ozyoK9T/otuhlYIENFzOjcPYZCTqeCkgdhUijTc8KFfXnIR7b7kmE30RaZypOODdH/i1Ug8zYJD9l5JnVpi6SoRIC5FI8pD51dI+ri76nPflPRJSV/wH359k+YBACxBdykfifs/O7T9AUmfknS5Fucnbb8h6fQObv8//Ydf/xm6GVohQETPOX24M2le0aSZNGjjTKY7ZpJTNleyNzR8eI6ZltHqS49Ftr6ShCtunsyyF6zRrtGia9SyjIbBoRhSXpLTKa9UXu7zIE29ZDlJz5v72uGu+txHJP2l//DrZ2kaAMAS80FJr5L0tA5t/zJJ71A+p+dico46M+/hPjPKpyEAWiJARM85ZbAzg3wGIqft9cxunkyL39+bnDtezV5kBXe2sXLKkmSmNbUkPHfjVFq6eTK985h+d13Th7pEYWDPCG070m+RNNzBPY0k/TdJv8xB6wnrJP2xpF927//s70v6uL/659IO9l8AAOZTKunNyldN7lSe8SfKS5kfWiTPuaC8dLmT+c0v+6t/7iG6F54MASJ6TqNDZaaRBSVehdi0oT+2kfHI9lpn5+jAQossMtMz/3V788rZNGy/aEV8pyQxFSIOglNevtxpb1U+KTYj0nrHSkkflfQL7v2ffau/+ud+TJMAXa9GEwCSpJ8oX7jrtzq0/SFJfyvp+VocYwN+Q9LZHdz+tZL+hm6Fp0KAiN7r9B0YEBgkjRRME4n8bdPZ+RM1/yIzO5lzbGkzk5lUemgmO+O+AXfEc1cX7mz4oMyz3HZvaMv15JXKF8botBFJvyDpzzluPedpkn7o3v9/fs1f/YYPtbn/AphfDZoAeNj/Uj5NS6fmBHye8g9gFzpYO0OdLV2uSXqzv/oNXBjgKRFuoOdMt3l4mElyMm1Ks/KNk9lpt01nL6kk4XJXsH5ae2mzR+7DN+yoh2ffOZPdP1qwLZFZklEeuPS15xBfNY97/D5JfymJ5X56T0HS/3bv+z/nSHqr/8gbmuSHAIAu11D+4egP1bmF6P5MeSnztgV6jrHy0uVOVrT9hv/IGzbRnXCgHRLoKVuq7b13Nkn9ken68eTI/9iVvKrpw+WKrY+W7qVXUjvq/kr2qk9vrs8+e1XhM0f1RdurGXfnS99hH+PzJF0yjzt8vKSXSvp3jl3PeoOkUfe+v3+18ik2AADoZjdI+pA6N8/zsKS/lvTiBXp+vzp3vdgp31c+3QlwYLe9NAF6jbWxtjQEyZk0VDBNpBp9aDY7SZENm1HB2mN9yqVpGNkprQjSUH9sqmZBtSwoC+3tc1hEDj8jvmoB9voqESD2updK+gdJPy2JpeMBAN3utyS9XNIJHdr+iyS9SflIwPl0iqTf7uD2G5Le4j/6RipTcMAIENFzppP2jQxzJqVebks9Per+SnaF8jk4yIt6jEkKplKQznyg4l8oZbWBWA+tLTuVIxODEZeqwzqw65UHOPPtUknnKJ98HL3rlcpXmPwlmgIA0OXqyldl/rY6Nw351ZK+rvkrZY7U+dLl3/Uf/fmNdB8cDAJE9Jyt9fZ9yFJypqnE939zT/LizRX/sxbbqYSHvck5G/VBl39vLBm9p5Jtu2xl4aGLlkc6os+Jcmbsxy8qn5duIXxA0hs5BD3vA5K+J+lfaQqga6Q0AbBf31U+z/N7OrT9kbntv3we36Of3sHt36R8fkfgoBAgoue0I8wxSeXI1BeZGt6GK2noVxZKFhMf9rhIXk0vLSs6HRubtkWmJKJbLE2HvlBOn6R3LuCev1bSf5e0k4PY8z6hPETcRVMAXWGWJgBa+nVJL5F0bIe2f6Wk10v6XIefx0mS/qCD208l/YL/8zfxgQQOGgEies7xA9Fh/X5kUhqkbTWvjTPpmj0N/7J6povMaYTW7XmZRVqZpOHiLTU/HaQvlpySSiYmxcSjvVHS8gV8/ILyEZC/xaHoeSuVlzL/PE0BAOhys5LeprzUuFM+Kumb6tyHsE7SJyWVOvgc/pf/8zfdRnfBoSBARM85e+TwAsSSkyqZtKmSRdftTU/bVfOvlOkS56xM6/a8yMxOnm6E5bdMZTM7Gv6GdWW3KfVicuKl6NBGIJqk9y2CvX+npD+UVONA9rw3Kp/b6WaaAgDQ5b4h6W8lvbVD218u6eOSXtGh7b9X0sUdbJ87JP0vugkOFQEieu+evw2/HyRXcDoqNh0paUbMSYNHc7ailoYX/sOW5v07a+H/nTTktjSJEJF7gaRTF8F+rJT0c5L+hkMCSb+rvDTrcG2VGI1/iLykHTQDABy2X1K+cvL6Dm3/5ZJeI+n/tXm7Jyr/cLdTMklv8n/xCwldBIeKABE953BKSYPyhVN8kN9RD6fNNsNzzXSC8pWygLyPObk06Ngb96bPXFd23z1lONrSyLwymmZpObQRiO9fRM/gfco/pWeVn/27XvnKjp3QpzxoG5a0TNJCj2B/maSTJd19mNt5gaQvSFo1z/u/UtJAG7f34AIcg/8x1+cAYCm7XZ2fQ3Ba0tslfbmDj/ExSddK2tPGW9S/nrs+6JT/LelGuiAOBwEiek7jMEaCmaSZJEQ7G2HFndPphVN1/xxXtCNoVTy+nwSpqRCOnkz8WeNNv9EHzepwlt3AInTQR/N0SVcsoidwuqTnSfoax3K/Xitp8zw91nLlIyWOVz5C9UxJF0o6bh6f77t1+OX1WyX91AIcq8+ovfM4Hkv3X5Iumeuj3azOYew575C0ewk9n+skjc3D43xF0meVV1t0wkrlIeJr2vgefFkH2+NuSb/D6YTDRYCInrOleujjwPoj0/2VbNW1Y+mVO+r+ZYptDS2K/TGpGCI74+bJ7A2VtNl42mj0L0Ox1RJPhLhkHPyhfP8ifBZXiQBxMRif+7pd0r8/6t/XKx8d+NOSnt3hfXidpF+WRGkTlqqtmr8PBYB2+Zr/2Fse02/duz9Jqxz4ddfzJHXqfu3Vkl4p6V8PczsbJH2ww1esbxUfQKANCBDRcw5nLrrRgmmsEYZvmEjPCV4bzHEOoSVzpr7Zht9wr7ThtGG3Yli2tZZJDR/kg2QszdzlDipBXKXOfQp+OF4g6RRJGzmei9J2SX8193W6pD9Q5yZuXynpUuUT0AMAlsb1Ry/bK+k9av9chY/2MUnfnnusQ7pfUD6dzEAH9/Gjykd+AoeN8AM951BKmPflPDvqfnhXI5wXvE4U+Q8OrPOYTMfubYRnOAvXxNLeFUUnZ1z+df/1+0EdwXdo4ee5a+Wquf3D4naH8pEOr1ZestuJm42XigARAJbS9Uev++e5r1d3aPtrlAd0rz/E33+rpMs7+Pw3K59jF2gLAkT0nEMpYY5NyoL046ns0junszeZ0zNNKtGaeCousnXVLLz422Pp6KqSPfSM5fHeC1fEGo5NdcqZe0VR0i8u4v17g6Tf0KF/eo75vxnaLenrc32rnZ5D8wIAlpj3KA/plndo+69TPsrx3w7y945WvrBJJ71ZUoUugHYhQETPmU4PLLQJc/8pRabBSBaZBnfW/dpqw69zBeujJXGgr7NZ0IpqGganIp3opG2Dsds+XJAvsixzdzvwEQCvlbR2ET+TPuUjEP+Qg9o1viPpVyR9pM3bPX3uBmucJgaArr/+QG6XpPcqX1SlUz6ufFXmyQP8+X2ly0Md3Ke/lfQtDj/aemNLE6DXrCu7A35Vl6TpJGisGQbrWbgk8eEsuUVbhohFyqQkOPXL68LpNEyFEHb6YD7xtE2XX8Ef6A9e1QVP5hcl/ZmkJse1a/yF8pEFZ7d5u0+T9E2aFwC6/voDj/icpJ+V9OIObX+tpKslvekAf/7nlS/w0ilbJP0Shx3tRoCInnPu6IF1+9jySQ6/vSfRTRPp6u0Nf2XT6yUuYuVlHByTyma6cKrul91f8fcFqRibUomJNHvg+v0ySee0+ZFvkrSzzRfB65Wv9PtZDmx38J94h3fv+MSfduCYnSkCRADo9usPPNE7lM8nPNKh7f+88lLmrzzFzx2hPGzspHdJmuaQo90IENFz+twBnhwmmZMKprXNoNPrqWJJZecU0Yo4SCYpDk4nbK37V35uS2PPTy2Lv7a27PY0KGNe6lfw7+/AA39Y7Q8Q9+0rAWJ39cF/VT63UTsXVDmWdgWArr/+wBNtk/TLkv6mg4/x18qnA5l8ip8Z6eA+/L2eOsQEDgkBInrOgeQ1IUjOpIJMM5mOa6bh8sjpKB94x8ahs8hKM0k4/z93Jg/0R3bbsqLbM5nknYqBiN14/f6ULwcnSHpZmx91u/JPt5uSblM+WqxdzpN0iaTvcnC7g//EO2vu7R//hqQr27jZY2lZAOjq6w+09knlFRedKh9eL+lPJb2txfffKOlFHXx+uyR9gMOMTiFARO/dcB3ge26QlHnpwarfsLvqL3JFO9dMjhbEobK8XzUVNByktSbd6kgOl/L1+3vV/mz4L/TIPIUflvSpNm//KhEgdls//JHaGyAeTasCQFdff+DJb/HeLul2tXf0/qO9VfmHvV973L+vnbt266R3SdrLYUanECCi52ytP/XKFSVn2tv0g7dOZs+6Yyb7GUV2mkR4iMNnpoEgPfP7Y0kYawZ38mD01diklIvBLr0GbWlE+QIX7VRTXvayz+cl/bGk1W18jJdL2iBpE8e3a/rhbW3e4HraFAC69voDT22zpF9V/qFsp/ytpDP02HkI/0rS8g4+5j9L+gKHF51EgIieM5089ZvuaEHaWQ8jX9uTPLPa9BdYZP20HNrBpNhMa3bOZj9V87r+iLL7ftFpppopJJ4Lwu66fn/S4/U2tf+T7b/XYz9Vbkj6mKTfbW8X1fvUmbkb0Zl++FCbt1imUQGga68/cGA+Jum1ki7u0PaPUl7K/I65/3+d2lst8Hjjkt7NYUWnESCi5xzIqrdJUNTwYYMPWiPJL9EqUz/31Y6nF5SP0GSU5oGKbLI/toE06GwX9OPYVCnF9nBjoiuu4J/svfW/deABr97Pv31c0q9LKrXxcd4s6bfF6n3d0g93tXmDQ7QpAHTl9QcOrhHfLOkWSX0deoy3S/pH5eXSH+nw83mvpD0cVnQaASJ6ztZq6xJmMyky6d5Z//S7p9J3JT5cYs5WdNPz8+FR1xUhPOrv+/597t8KbpuLtFmhDW+apppPw6lKw0qZ5ZGkPfy9R1Jb08Pf7nXmbMN4I7zsO2OJLSvYfeeOxpVzR2OZpIzrwm6/fn+F2j+P3H9K2riff98t6XNqb7n0kPL5ez7EQe6Kflhv8xb3fRjkaVwA6KrrDxyceyX9jqQ/6eBjfErSrZJWdvAxvjR3LQh0HAEies7ept/v+3DBTOVIVnQqb6pmx+2YzU6zkjvKFkHaFTRXrfDoAPCRC4itiszMFDspGYxtqi/SdNlZpRip0eesVo6sXnTKypGlg5F5M/kfjae37qxm2y2ywx65FNLQOG4o2vC00fiUahaskoao5lVsZKFYzUJfLdNAw4f+WqrRhg8Dfu61xwdlykIk07p9yWKvBIxmGmxk4ZxdVV9slKKNkekr68puyklKuDDskgv4lgfqqg482pNNun212j/f4n9T/ml5xoFe9P2w3oGtDkuapHEBoKuuP3DwPiTpVZKe3qHtHzv31SlTyhdOAeYFASJ6zkjhifGUydQMQU2vYhp0WsHsKMVWMymRVJjXa4L8j0xSum/cnpO8c0qdyUdymTN5ZwqR6X5J35lNg0sylVyk2rKiPbimZA+tLNqeZSU3vboYja0tuqmRojVWlkzH9js5k37p1op2TKey6PDjupAG/dTyWL9zSr+217y21r12NUJprOGHdjSy5btqfs3eZli5oxaOGU+01odQCpKVIjX6Cq4vk56Teq3PQoizoDjMjVsMUvGRY7QEmWTOTotNL2t63df04UcmAsQuuoLf3z8+XdIz2vxAt0v6xpN8/7a57z+3zRe8L5f0LxznRd8POzFnYZ12BYCuuv7AocmUV13cpEfdd3SRD0jaxmHEfCFARM952uhju71JKjvTj6dSfWcsdeNNf9F0olc5ZyfP5zkSJAWv/FNFr70y3arYSkEq9TkbX1+2jSuKbtuastuxqmjjy0tWOX4gmsiCxj98X033T6ROkfMhqOGDml5KsqAsCyFNQvCJl5peavggZ+0vk82C5h44KMm/GmkIzSxoyktbfVCsfJ62giQXkqBTV8bhZ44o9e1q+H+5ayY7bnM1O+WhajirloUBSYPKwtMkSU4KZktudKKbezKTteyoPc1o/VBsSkKQzyjz7o7r9/2eRJ0YffiRA7hbuFrtDRD3PRcCxMXfDzsxdxMBIgB01/UHDt3tkn5f0v/ssv3+uqRPc/gwnwgQ0XNWFh8bzZik/sip5DQ0mYSL99T9qyU7xzlFHXnP3/e+78O+GaY2K7J4ILap0bJtGynY2FF97uaGD3f8cDyN6oniKNLsQGTblhdt7/qymziqzyVry6azRyNlQRqM7OHZqvZVOvuQf2VzX+ncV+Lz4Krdlx5+btvJ3OPMPW7Ylyc+emrG/BekZQXT2SORNlftvokk/Gi86Y+ILByrTOWBkpUvWFU420zLt9X8ysnEr5pKtL6ehgFlIZPpGLk8UXRdnralQSfdPZu98is7m3uOHYhuHoysyijErnSUpFe3eZtjkj57AD/3H5LulnRyGx/7Ikk/JekGDu2itrbdL0k0KQCgx/yJpNdIOrtL9rci6W1iOCrmGQEies6jp0Dct3Rw0QU1vY5W0MviyC5IfXvDwyCFEFQzSZHJFyKrlwpW74tso6TvjTV9qeC085g+d8sJg9EDl68ubJ9IfPqTyUx17xVkSkO+77UsaDYNmk6l8WZ4OBzsuiFrlj+fySRoJg2qZ6GWBN0XpPvkg4YKTi9fX/zn2Cn6zp70uPtm0xMqqT+9EGnFir4ozUK4rJrpxKYPfVlQFCQLQWaWLwrTVc1RsJXbqv6Kf9ra3PHSdcXtJw5Gm2bT8HAYzGjEReqJIwDeI7X9g4eP68BGgwXlIxU/1ubHf7+k13OwF3U/PKrNW9xLowJAV11/4PAlkt6k/EPTbshIflXSgxw2zDcCRPScx49Wc5IGYtNsquV7a9mRmTPfzhFt+arIoSGvHwQz11e08WMH3M1njcQ3X7Ii3mjS1P+6u+621bI0C6o3fUiqWUhrWejpj5R8yMPSOChr+rA5C9peTcP1xw1G7t3HlQpjjfCF74wlF9w54y+cTv3aNJPJh1IwPUvOzLoodXOSfAi+6VUuRjY8EJsaPqiRSXl8TITYBRfwg5Le3oGL2b88iJ//O+XlN8vbuA8/Lem/i/l1FnM/PL3NWxyjUQGga64/0D4/UT4S8TcW+X5+V+3/wBg4IASI6Dk7G4+86cYm1bMQ/WAiPfPGyfSn06Dz7DAWTXm4PDkLs5K2KbLScMF2Hdsf3XhE2V1z82Q2O5GE2YHItq4puS0nDUbBJJWjvOT38eXHvW5fO4S8MjrxQZX+SDphMNJA5HeMFOzBgtMNPgvDxwxE7pzReHR73d/4YNWfM9YIR3kfMklrZFq+2OdPNNNIGvTs68eSbHfdf+boPnfrqcORRmNTk76wWK/gH/0/Py9ptM0P8HlJuw7i56uS/lrSr7X5OuE9kn6d471o++H5bd4gYTEAdM/1B9rr9yVdKen0Rbp/NUlvoRNgoRAgoufsrOevt86kgcg03gxDX9yRPGtHNXuBIlt3sCPX5oK+iqQscvJFZ9WRsvtekG7YU/elsrMHzhqJb7pwWXz/rmY93Tnhlc6NrptKgkztX9BkKUuDNJ3kZdxNr70+aK/PpOMGnF6xvqgbJtLvTqfJeVNJOH24YEGml9cyXdzwUhrCwyXBiy1MNLN+SWdunEji7Q1/++ja4j1H97nGsX1RmKWDLNLr94ePi5P0vg48wocP4Xf+QtIvqb2rx79D0h8oDyixmF433vi/C5Ke0+bN3kvLAkBXXH+g/RrKV2X+3tz13WLz27xPYyERIKL3brjmRqLFJpUiqei0MgQNySu4gzwjwiNv5DdJNl4wJUf0uduet7rwHSnc8ekHm416FtJ6FpLZNGSJp/07c1Dz+RRnkmC1LOytZuGaPmfXPWe563em026rhIsfqueBreZGempxjkjMFNnYQGSDBdOJide9dR/qDYajLtIL+If/9iJJJ7Z569+SdMsh/N42Sf9P0uvauC/LlI+w/DgHfdH1wedIGmnzVrkxAYDuuP5AZ/xQ+Ye4v7TI9ut6HdqHy0DbECCi55w/GqueBd0xneq6sey4LdXs5yea4fnm7ClXsvR5fXGmoI1yVhwo2OS6st15+nD89Qdm/aa7ZtKkYNq9rOh2SaHu9PDiyLzXd8DDAWASNJkENYPCtFfmm1kWzzYb08V41VTiB3bOZArBdMxArNGBghpy2tbwmmnMFY3PDUtcBKs5O3N24mTDv/iW6bT2svXF+0eLpkad3rPIr+A/0IGNX30Yv/thtTdAlPIRln/FS9mi64O/2IGN3ka7Yok6sov2dYfykVDAJnvDn3XjftckvUTSNV3a7r+tvJT5hEWyP03lpcsZpwQWEgEies5Jg5FmkqA7ptPS7VPpKdtnsmcptvOd2/+AtCApeEkKk3FklRXl6I7+SF/bUQsyac+Rfe62Z68s3BNZWrltKlUapHqWB1OsoNs5pnzUYdNLx41GevpopGWxdFyf08DySBPOhu4eb1z00Ex6fC0NKsdSMSqpv5gXMBeToIFg6is5eUlVP3fc9oWJC/S0zLS2loZld81kjR+Np3cWnX5sQTUGry5CeQnRWZKe3eYt3yvpy4fx+zdKuk7SxW3cp5OVj7T8Cgd+kbwG/tyfPn3u5qydvKQf0bpYor7bRfv6rbnzm6kj0K365q5lVimf6qnbVCW9WdJ3Fsn+/L6kO+hWWGgEiOg59Syo4UMk6ei+yI5QbBMyzUgafpJfm5Dsm8Ox3XPR8vj6U4aiGz+7pTH+UNWnTa8wnQZfZ566edcMQQUnvXNDSc9bGWsqDTq26DS8ekD3TBUKv3795PH1RlgVlZwSSZumE22aTiRJ5dh01HBR6/pKqjnTg7WgHakWR2lzZEUfdOlnH2rct7vhxy9aUbirQf9afPIA8aoObPmjemTw8qH6sNobIErS+0WAuFiU1JkVGG+XNEvzAgvu2cpHG/05TYEu1qf2zsk83/atdvzuBd6PW5SvDg0sOAJE9JyhgsksZHdOZ2fsrGQvM9O5MvU9+me8D7vktVWR9R/R5259xvL4W2eORDd+a08y0fBh70BkUxFDCxfUeCqdOhTpp9cWdO6IUyky9QcpMmll2WlPPfKSkkfPM515Kcz9QzNIu2cSzTa8miHIR05Hl2KtGoq1xzs9VPEPT1I93ys4m8myoIHts9mJ48vjZUMFe+wTwSIR1qj9pcKTkj7Thu38m6TNko5t4749V9KZosR1oZny+SjP7cC2/4vmBRaNiCYAFtyvSnqxpGMW6PFTSW+SlHAosBgQIKLn3D+ble+ezY6/bTp7aSUJz3ZFG5AkH1RX0KSZiqv7ou/G0jU7Gj4MFewnF66Ir3/RmmK4d9brwUqmhg9iXYsFEPJ30diZBl3QSWXp6cOmSup1b8M/PIdhJQ3aUU37fdDxchrY9+vOlKeBc+/G4/VM49VU8lK55DQYvCwOioPToJcGy5GaMk0lQZmfvzDR9PDMjKdsqmQvuGki3TUU22Yx78li64/vllRs81b/Vu0ZAeYlfUTtn2z7fcpXJ8TCKEj6S0m/0KHtf4kmBgDgYbOS3q6F+4DtTyT9hMOAxYIA8TB89P46jdBlhmLTTRPpmi/uSF4x1vRXqGADczfaikx3BdOPvA/Dpw9F31hetC//+47m7loWNJ0E7Wl4NXxYDAtt9Cyz/OP4Zha02nntrqX67u4nZmqDBdPW2Wx104fLZFq5321JitwjK6ckQXpoJtXmqVTl2LR2qKBjS07jcqqlQYkdfk3pQT1XKVbBTrhtKvuZ8UZj6vLVhU994LbqRO1RpcwfP2eATnE4bfyzf3w4v16W9K4271KmvHy5XT6pfM6coTZu8+ck/Yak3fSgefc05QvZXNCh7e+Q9H2aWQr/8Gu9/voGAHjE1+auqd4yz49759x1HLBoECAeTuMRJHXPzYDywGgkNmVBQ9tq2ak+6AhJTZ+FGxWZu3B5/I2VJfvi13Yl9SRod2TaQ8st8A2QpDRIM5k0nkjHFYKOSJu69kEv816NNDxhSJ4P0oqys2oaliU+FPaNODygfhLy3pJk0lglUbXplZppuBjpqNGiZl2kLY2gSiObl5WbTVLIQrGShb5SZMN9kU3Us6B6FsSiKu16ZThkr1M+MXg7/YukLW3c3ozyEY3tnKexJOmdXNDOm0jS85WPfriyw4/1d2KUM69vAID9+WVJL5S0fp4ezysPLFmNHYsKAeJhGG9ycdYt3Nyr8EPV9Pibp9JLfRaWSRpbPRDdsqJgn32w5mtrSu72E4fcHdfsTtTwQWkgIV4INveWOZsGNYK0rmA6d9C0Lo602qRReU0kkiKnqGiPuUUySYVI2jqbrb15b/O8WhYKdhDLKe8rcQ6SZptes3UvKWh5f6xmQUrkVA6mFSWnpnOaSqVakkd5nSptNqfBZtAz7phKp8fK7l9WFt22Y/ojFR195fDvr8PhdNNOLJ7yoQ5s86PKy47b2WN+UdIfS2rSidquIOl0SedLulzSFZJWzMfZoHx0BXh9AwA80aSk35T0qXl6vM9K+iHNjsWGAPEwbKsxBqhbFJ3U9HLf2NN8wX0z/tJi0bYnzfCfxw+4b1+wLP63f9ranJxOgyppeHi0IhaGl1SIpdVFkzNpfUE6dtQpmBQUKTzJ0TFJoyWn/3PP7DG3jzUusMj67BCGCD5S3pz/32TDa3xXTcqClg3GOqa/T9XI5L2UOSkLnRvrYc5WVrPwvB/sSQdX9rt7n7+msPOUIZctI0FcyBvs50g6o81780NJ13fgWW6W9AVJr2rjNlcrH4H5mSXeQ65QZ0q1Y+Vl5cvmvlYpX+zmGEnHa2FWrPy/ku7jRYHXNwDAfjlJb57Hx3uJpLWSdtL0WEwIEA8D9+9ddaxM0ppqppNGipadMxr/54/2pvc0srDDB03RQgvPlJcfV5tBF68s6N3HFDRYkMomRVE+vC88/JOh5Tb68p81+VAMzqwtJcZzm1QkVZpet++qKcmkoYGCzl1R0p5g2lKXmk3fqbLmVKbp2LSu4LQhSJs8pYbtuMM+1F/sxOjDD3fwiX5Y7Q0Q97XBZ5Z4B/lED50IH+T1gNc3AEBL75V08Tw+3nLl8x6/nKbHYkKAeBi2MAKxezq604rU69xKGm4ZLtietWX3/SjS3iR0dvQYDkwWpIqXEi8dWQg6wqWq10zbpr0aB3iaBUlOsrX9ke2sZqdJOk35fG2H7eHFm82UeGmimklZkFPQdCw1ZVpViFQejLU7kWaSIIXQtrJmk5ycjqs0w3O31vxEydl9ZVbzWaj765OVz4HTTg9J+tcOPtPvSbpReVlsu5ylvMT2GjpS1/u0pJtpBl7fAAD7daKkP1yAx71S0uslfY5DgMWCAPEwPFAlQOwWztTvg4bqXl8ckcbqWVAIlCovND93g1Ny0nAkHVE2HV02lbzXNbsbB3V8nElZUHTrRPOIuyeTS+TsROtMX5IikyLTTBJ05566nEkbRos6st+pkZgSy38w8fliJ4e7HyaVZDptpulXbpzJtm2p+ZucabuklF50ODfYh3SH/X61/6Xjz+fhWH5I0ufbvM33iwCx201J+nWagdc3AMD+L/2Vz3vYt0CP/1FJ3xSlzFgkCBAPQ0T61D2v/KadJn3V8lVJsYAePm2yoOksf1c+qhA0OuqUeFNRkUxB2UHe+/QVTON1H//d3bMX3zeZnOoi63hAbHOlzWbS1plUY7WKigWnk0bL6hso6tbpTLWmV3BtWmQlshV7G/7Fn3qwvu2ylYX/d+W64jZ61GHdYR/sLyyX9MY270RF+UrJnfbPkv5U0hFt3OZLJJ0k6R76Utd6pzozzyO67/UNAPBE8126vL9rT0qZsWgQIB5OeEATdNOxahorhi6Kc6aRV/fqsnUFPX9NrAEXVDLTilhy5pQd4m3PcNFpW5T56aZf2aj7ZVHZzc9rwNwLQSP1aiRSf+o1bnX1NzOtkCnuj9V0TjvqmXwmmTv01w5zimqZjrllIj37lMHoG5IIEA/r/vqge9rbJfW3eS8+pXxlv05LlI90/OM2nwLvlfQeOlNX+jtJ/0gz8PoGANivk7UwpcuPRykzFg0CRADzcy+jvEbTQlCfgi4YMZ1ZDto61XzSlZUP1GDBubF6tjrxOlI2/2UG0dychPVM2jrVlE0nOnoo1rJYarhYNSfVlKc4+0q3D/ZZzy0fExR0/J5GuOD3Nta2+hAmWy8r05tKpaKq1br+8bP/qftvvVfx8EA7brALan9QFpSXpsyXv5H022pvCPomSb8laYKe11W+r3z0IfZ3sr/2Ix1/jOQf39fhN13eFQDgcC7tlX/Q1rdI9uejyqeN2cGhwUIiQATQcUGSl1QL0ogLOtmlunVHpjt36aBLlVspx26gmfkLppv++Yps3UI9VzPJRfmy3zuqmbZXqhooxTphVVHVuKAHm0GVZnj4Zw+WM/WHyC74/niqPc1QPXck+sdiJKVMyfrIzX/m1ajOLcDTvoGor1F7y38l6UuS7pvHphlXvnLyu9u4zQFJb1VeHo3ucL/yUqg6TQEAwH59QNLTF9H+LFc+5c2LOTRYSASIADoqlSk26UjLNFqQCoWglWZqZFLdzy1KcpiKTto2m669b7p5+UyiY1xk0UI+531PqeklZUGzIdWOCckKqZYVYx05VNS2RtBs3cuigx6JaCaV6g2/enfBVjuLVjrT3oZXaPi5xYF6eH4F76XBcqS4v18WRU8+CufgRuhc1YHd/fACNNFHJL1L7Z2F471zz4VFfRa/2yVdEReX70mb47TGUsYIRAAL737lBTjd5hRJf7AI9+tFyis/PkPXwkIhQATQEWb5yEPzQf1ZpmWW6ciC5M2Uyqmv0L7HGi66aG+9ecR4JTtOkbPILY42iExSbPKStk0lip20Zsirv+i0KnJyBVMtSOncjd5BJTpOhTSE07fX/SX9kV0zGNvU+nI+8rGXByPGkVOlVtFDW3arXqnK4ifLkg/4BvsiSee3eVd/IunaBWiieyT9h9r7CfaRkl4l6Z945VvUrpP0yri4Ys9B9n90JY7vEpDRBJB0vbpzxHhV+dzRjS7b70h5QFdapPt3taSvi3nQsVD3WjQBgM7dvpj60lSFJFXqLB+eFNr6AJLJMh+WmWm1IqvIFt8oKJMUxaYgaWcl1c7KrM5YXdaaoaLuqkrTWT5Y5GACRBfZseONcOU1e5LiqqLbePmqwtR5y2I56+1y5tHhor71g4d0zT9/XWmjqahcfpL+c8CdcamMPtznQ2p/CcxVIkBczD4h6b1xaWXzEPo/uvINmOPb5b4l6ZM0AyS9NnzhDzY/5rryFb9Fq3TOYitdfrwRSX8tSpmxQAgQAbRVMXZKk1SVmURFmZY7yZeijtTVRk5KvMJPxhoX3TPRfK0zO1+mgcXcPlmQ5IO2TDY11PAaiJzWDJU0LdPO2XywgTuwEZQuBK1JMr2gEXRbbBovR9oV9fhy4/2xyWWpkulZKYqkQtz6RvrAbrCPlfSKTtwQSHrlQsYLam8Z89MlPUPSD3gVXFT2SHp7XF71b4fY/9GtOL7782JJ27tkX+9Wd5Z+gvO7my3W0uXHo5QZC4YAEcAh2beSsJubxNArTySmaqmmqqnSRqqis/z7pQ5MSRikvoKpkYbig7Pp8Xtm0vOicnTUYm+3yPL/jNcyTdYzLe+L5CLTSDlWKJsmU6nh83WpnyrdsfyH1mZpeO5MFm5wsl0hSL6HS9fSIMk5WbmkkPl2XGS/V+1ciuURL1yCzX+VCBAXi0z5qtu/FZdXjdEcgCTpTkmbaQYA+7tE1+IuXX68q0UpMxYAASKAQ/LwgMK5gKboTJkP2jze0J5KplLk5DUXNHbok9JGJtfIwvqis0iRzXTVVUqUN+BEw2tsR0VHjJZ0+to+3d0wbW9IdgBttu8YTNb9+q01f0riw/cjs8z38AfTPhxElfxTt/GQpLdwth+wV0o6RtKDNMWCCZL+WdIfxH2rbzvM/o+u7gkcX4DzGwdhsZcuPx6lzFgQBIgA9ssH5fW2ZlJscib5bO6iJTY9f9SpUW3qO7uaOm4g0mnFoCTxGqtn2lnLNBB3dingYmTaM52t3jiRvGZ3LXulRXZ0114DmmlvNdXGnVWVy7E2lAuacZHGal7Bh6cuaY7shHsq2Wv+z5bG2NnD8bdWldxko0dTxOmCtLc599ztQBr/Sb1F0jCvBgcskvQeSb9CU8y7SUmfl3R13L/mXm5AwfEFOL9xwLqldPnxKGXGvCNABHpUOnftEcxkJnkf8jrkudBlsGA6dSRStZlp82yqWuq1vj+Sk2lXPdUppaJm06Dv1BOtHJTWxkE+C2p6qZIGJR0IsIIkZ1LBmWKnaHfdH33H3uY5Mjsriq2/Gyt3zfLRiPXUa/tUplXNTEM+qFwqaF050lRqqjS9zLXOwyzSwETdn3vNnuSilUV3y7KCTU4lQUkI8qG9E90t2mvpR7qumi4+iN9qySkvX8bBeZuk35M0S1PMm3+Q9Oa4f2394M8aLO1XRQCc33gKnS5dnpH0gKSzO7T9q0UpM+YRASLQo0ouT0jMBwUFFcwUxfnIw6QZtKLP9NYjYj046fXZ8aa2zKQ6c6isgdjpa2N1zTYiVeUkZ0pkas4lOD7k8/z1d2gEYlC+ynAj01ofdKqLrOCDagrq7+qrF5dPaDjWCJpoNjTSl+qY1f0qlyI9mObZbiuWt0vmg9Y0vE5oBG1zpka/M7keu8z09UzN2gHmKE/+Cf6VkjbwSnHQRiT9gqQ/pynmzZXKS8fvPrgXU25Al3a+wPEFOL9xAP67Olu6/EvK54e+SVKxQ9ddlDJj3hAgAl1sLjjSjDfJOyWK1HCRstgUYpPFpmLBaajkNFIwFaKg1KTByHR+vzRWyLS92tRkLdPT1pR0ybqy7p5M9KPZuqIZJwuFA149OTIp9UGbpxNJ0unLijKzh/exHfoi0/ZKph/sbmjLbHra3nr2Kpme4ZZQmakpD2FnG173bqvo6FVlnTta0s3TqdK09QrNZrbMBz3v2l3Ngftno/Tc0eiaS1YUtLbPqZYt/QvNYiFWlmX69Jev13XfuVXO5eH2k1+AP+l3r+IV5pC9T9Jf6slzb7RPv6R/TGd3XBgPrmsc+A0oDbe0AwaaAOD8xlM4Q9LvdnD735L0t3NH7A87+FiUMmPeECAehlpHFuZcHG9I0dzquY8EQPnKBPl6GEEhSD4EeR/knKmvGMtMaqZeSeZVCF4F4/3tUNncnXc9HyOoxDmFKJIrOBWLkfrKTgN9TlHBpCTTpf2J7u2vq2lBcc2rVAuKYqe0FOtBF2lTiFSInC5aV9LKuKDtlVQjClodB401U6mWabUV9LRBp0ZVui3LpGZQ4qVk36IUlu9Ttm8HW+zzZNNrpOi0si9S1OYAcSA2zSahUM/C+q2V9Mqk6S+NCm54KdXo7strm1lQo55pbKKh9WY6OjZNOKeJTJIPMnvsYTBTQdKaPZXs5IZ0/Fkj0Q0riq5yRJ/zlWTpn4nlslOaSrse3K69D2xTfMTKvDHDIV2BnyfpEl6JDtnxkl4i6Ytd/jyul1Rv4/bOUT5SoBPOmbs5+SXuQMHxBTi/cUA5yGfUmVGBklRVPpf2voP1h8oXmzurQ493tShlxjydODhEKyxdcs9pX3iR+aA08fkr3lxpqs19Pw8VTc5JUezkfdDsTE0KUl/BaSSO1DSnZsijI9u3UYbbH9DlQFAexMWSlinVVMhUTk1RwykJppnUtLfhpIo0OFrUEWWnlw81tbVR0c5KQztnG5qsJmpYrGa5rAeaBd1VjSRFOqa8TGcORdo00dTeupeXyTuTIlNDpqk0qOqlzOypR2/tr/8on59QygOwyPSYAPFQe8C+PSk6KfFhJPXhOSVnz00iW7ILXDjLn/Cu2VRTjarOXFNSMS6o7k2py9e32Q+v2KplZ0dWs3BO3YcfN7NQqffCgiqZlGZBpf6yNFA+sA7X+jWJ0YeH7wPq/gDxtZI2t3F7L5P0751s83Rm29fioSP+68DecHhPXtoXFBxfgPMbT+JXlX9g3Cn/Q9KmR/1/ojxQ/KHyeRfbbUT5aMcXiYQZHUSAeBheE08suefk5hbU2LJ3Vg/umValmcr7oEJkKsWxioVI/aVYQ+WiRgdLOnrZkHZNVfVX37tdzdTr2aeu109tWKkfl1fr+82y4jRRuRDJOadmksplqSw8aqUOSJKsWJRcoplMagRTPYq1zNf1Yo1rLK1qpupVayYaq6XaVG8qSb1UT/ScM9fqLRccpSwEJWZKZfJmCuYky0eQRs4Uu/x7bi7M3XecO3ld40waLDg5kxIflIX8z9Q/EpS22oV933P5AtAquHwV6NFipKC09MBMelK16YdctPT7kYtMzRB0556GVgxkOnqgqEqhoD1Nr0byhBWanXN22ng9K/5wXLVXH1G8bbRgqmZhyZ9xcT6F5EE+z/1eX62X9NO8Kh22S5WPivsJTfGwL0r6hKR3dPAx/i6d2XpWPHTk7kPs/1g6CQNNAHB+Y//OkPTbHdz+DyR9dD//fqOkP1MeXnbCCyS9VdLfcIjRsXsumuDQHeuaS+457QuWmmlFeytT8rWmMh9ULDj1Fwoql2INhaKWRyWtDkEnFvtUVFPJ7t1qJplGNwzpuMKobn5os8J4plPXDWvjjklVag0du2ZUzTXr1RgYVNpMVGumMjOVYyeXpUvy0zSTVA+WlyJHkZoumltGuKBSuaCRoYIs8Uo23avjXKRXH7NWsa8rmqyrUa/riFBTKdS1u5lo92xD9emmdk/XVa8n0kxTW9f2K6SZsiBlMmUyeZlCPlT0MSFiqkdCQ+twmlSKpZkk6NrtVTWzoJV9kUaLTmv7I60sOxWjJ1/cw5SPsKulXnvqXjtrmWaaQd6HDffNJD891fAvCNKyqAdeZ/ZV4VYaXgqJlvkglbzW9Rc0W4g0Vsvmzt2HG68/zXTm1ppvfmlnck81Dd8cKbopH5b2B9alEJSmQfWDmXVv/+3xi5IKvMO1xVWSfp5meIwPSLpM0skd2v4aSZ9Op7e+JB4+MnD/Sb4AgPMbT8g/PqPOlS43JL1ZreeB/l1JL+/gdcD/lvRfkh7iUKNTJxAOUSUsvTkQnfI56+oWK40Lygp5OXMWO6VxrCSK1Yxi1V2sqiLNeFNVTq5closyJXFRVVfQ2P33KNo2rtMGT9Att96rsfEZnXvucdoWnCrDyzVoXqv6i8oyr5lKJl8qyzv38Nxu+Ztjd7075vME5qGdm1tR15tpZeS1WolUzzSSNDSYpNKM07icNlpZoVrT7B336LINo/rZlat1/3hdWyer2j2bqOJNNRer6YJ87BUVg8plr9ScUm/qLxU6nwYegnJsmml6fWFTRc2m10krSjpxONZAXNKxQ5FGik7R3IrN+xOZ1PTS7lrQWN3rJ2NNt2UmG3yoklycpOE1UWRnK+qdUawmKYpNlVSqziQarGVaH0nl/pLqsamWBfnwqK4QmZnpvH/d2nxZLQ0PvHBt8Sf7fmapKgav4KV60IGfE098jemT9E7e3drmZ5V/yr6TpnhYVdLrlJcwdSqofpGk90r6yEH2fyypgIHjC3B+Yz86Xbr8+5I2Psn368pHCX5HnSnJG1Jeyvx8ETWjAwgQ0REujqVCUYmLZMWiCgMDypzTQz+6WVNJ0IXHr9brLz5JE5Oz+vLmcVVPPkOVYlmh2VAxjqQsU0jTRRmOteLNSVEsiyMViwV5SWmc6ZKBqp5jM9q0s6kzp2samaprakdT11cauraZqpmkmpxuqNzfp0omNYMpuEguyqQk69rrGmdSf+yUeqkcmQpRXobsQz66cN8ow/3Z972gfDulyAb6C/bcvshtSLJsUvmneq7nzisnmfLAcNOuqlaMZDpzzYDuqXrtrXnZ3JDMuXZOqolfX8+0eig2+RCUhqU5eUAIQeU4UhRLceQO4sL6CT/3RknLeQVvm4LyEZ2/RVM8xo8l/aakD3bwMT6YTj10bTxy9C0H0f+xtF4ZaQKA8xuP1enS5R9L+pMD+LnrJP258g/7OuF5opQZHUKAiM6YG4kXNFdGG0UKMtWnplWbbaiwpk9HRJnKsZfGJ/TgD27SsUet1pHDRd21bULuyKNUXL9O1UpNceQUKygkySJ5yzYl5jQTnBRMSRTL+spat3u31m7dqoZJ33pAaiRe2VSqdWcu08qRsjY1GhpKGlqW1DRVqWlivKbdMw0p9ZI3RVEkv8QuCdzcWiy2n7npwgFcFgVJ5chiZzp6bz07rZ76S810onp0Es19T9qHfMGQ8ZmmypHTEcNFDQxGeqj6mHLmOEhn3zqd/syXdtjMUX3uxr7YknQJDkMslooa37xbd/5kozZv3iHXVzrAkzk8vnnfx4t3271T+cqDNZriMf5M+VxFz+7Q9kuS/iGdfPC8ePSY2gH0fyy5fIHjC3B+43G5x2fUudLlVPkiKQe6yur/UL642rEd2h9KmdGxEwmYtze6qFhU3GfyhYIqwdQolNTMvLbdeodOTyd14nGrdPvG+zUx29DKQqxVsVRvJKpbrGhoUJnPl99wZpL3nd1l6eEFSaLIqRhHclGkyBKNZE2dFDX1kMs0XG9oeiJVae8erdv1oHbOJPrBbEOqZ1Is+WNOV/3oYSmKlLhIDRdLcUGlUqa+TGqkmXw1ledi4DFMUsmZZlO/fmcle/buWnZu6sP5kVu6Ky8fcNtYvgJ6Iw3atLuq06Og1UMlTRdMM2m+YI0zuRDb6odmsyu+lIRNL1tXvH9N2e2eTZdeKfNgMdYdW8b01a/8QApe8fCADuFJvkDSqZx5bbdS0uuVl9PgEV75iNdbJS3r0GOcKunDoiwfAIBOly7/sQ5u4bhZSW+T9PUO7Q+lzOgIAkQsrBDyRT76yvLFkpqFkqKBAW2/414VJsb03POP1d2bd+u+aEgDP3WeggWFLJPNLQ7S6U/gvEzBmZxziiOnEMcq+rqOb87q58pNbWk2NLm3oe3bEu2drSuU+mSJUzkz1V0mWVBwEZ8UHmy3UB4glmPTvZPJabftbrzEx/bMyNkArfOIKDIpMt29u671SdDTVvXp1qq0t5HXKrs8pWiaVC44rSk5jTVMPl1iVxImqViIVRzqU7PWOPDw8LHn5fvpUR3zfkmf5AL2CbZKeruk/9fBx3hHOrH5q/GyY//tKfo/luD1FQDOb0jqfOnyHZL+5yH83jeUh3xv7dB+UcqMtiNAxCJMA0xZrS4/O6t+31RZmSYf2qa91YYuO+0IDUTSxrGqwobjVOkbUGW2pkLkVLKgQvCHfIfqtG/lX9OEFXSKJXr6zHYlu2u6ZlOmH1mmW8eaOmHtkEpnr9SKOKiiVLW0qfFaQ83mI3M2mqlHi2wP4Jpn7s+hglPB5XPzPfqY2dz3HppN9dl7Z6/40Y7629KgC13+SRr2I/VBu6ebihR05GBJ/X2RttS9ZJI5ra5k4cXf3pP2retzf33ioLv77JFIA5FTskQuQEeHpXTAyZk7yIjq4R8+XdIV9KSOOX3uIvZrNMUT/LPykqo3dfAxPplObLohXrZhW4v+jyX9bguA87unFSR9Vp0rXfbKQ7rGIf7+ryhf/Gx9h/aPUma0FQEiFulLfSwrFpVYJOvrU3Vmtya379ZRR8ZaM1DQfVt3aVdqWnH0Op0+XFKlVtPeEKsSlxUrSMErPMUopFQm75xcFElRpDSKNVIynT/ktdrqGqnM6LTamDbtnNSPd85qarImVRs65sINytwa1RWpJqfURYoKsaKm57gdgGhuPsTbJ5raW/MquHxxFVl+PeQlDcbWd/90ev6/b6q+q1nLXhT1RUWulZ6kTWOnehq0abyhU800OlDUTGyqeFMqDTa9zrlvKq3vabrvH91f3HpUn6uuLEWhmi6NRl05KD1YPoQ1dR55+u+nF3XcVSJAbOW/SbpE0vEd2v5ySZ9Nxzc9J16+wXP/Sb4AgPO7h/wPSWd3cPtXS/rhYfz+pPKpRr7Yof2jlBltRYCIxf8eGYJcHKnQ36dmVFCz2KfUIt1z3U16xQUb9K4rztAdm3frmnRId0ZlRQoH9PLoJFkICsFLPmgm9VrhTL+ytqnpyVlt3DujujklxbIGBlJVvJQ6JysUOCiHoTgXGP7f+yv65pa6VvRFKkVS5PIRoM1MSjOd1fD+vT7o2a4cFXi7e2pRlKewG8cbWpd4nTha0maLtDczhRAqimy8L7JjTDq14XVrPQvNxhKZDLGeSYk/pBcXSVol6efavEsV5SPLutkLJa1u4/ZeIOkUSRs5W59gVtLrJH1fUtShx7hM+fxPf/S4/o+le/FEGwCc373uHOUBYqfcJ+m32rCdL0n6/Ny1QCdQyoy2IUBE9753NpqK0lSDUR5KjU6NafChXdo9PqP+k0/U4DFHa3qmIuecyhakNJUVi6qXYqVK9ewwocL2Kd27KZHGarq/UtfX1g7oFy84UqNFJ8syGrmDqmlQ2vSajkzlyB4OEBMfLqkm4a0+C89xkY0YpeAHd15I2ltNFSStGCgoigvamVrJfDh3suaL989muwfi4o3Dsanpw5KotB/tl0aG+g/hojpI0jskldu8S59U96/o/CuS/qTN27xqrr3xRD+S9LuS/qCDj/H76d77vxmvOP5Hj+r/WNLvBgA4v3tWQfkUIZ3MO94mqdqmbb1P+XQ6Kzu0r5Qyoy0IENHFbwuxfBSp5qWGi1WsV9W3Y0zV7eOaTYOKkk4ZKalebWraCmoODSt9cKcGil7HHzuiEc1o6+Qe/XjXrDQxq6kdM7p1fFSTZ6/VQKmg4Bxt3EGlyKTY1B+bSpEpdurPgk6pJro4jnRRKi0jPDx4kTM10qAds6liHzQ8JKkQx3uaWltPwtA9s9me74yl9545HN1WdKpmXXwNum8xpe/ctkvfv/FuhRBk8UEM4MpfJn6xA1f1H1kCXelvJP2OpHYuXPQGSb8haS9n6n79kfISo4s7eM33D+nY/efEK4+f4f6TfAEA5/cS1unS5Y9LuraN2xubuyb9pw7tL6XMaNvFJLAk3km9ixTKZRWGBrX17k0anZnQpc89VbsmpnRj0qdasazkzju1ttzUeUefrU0mVeKSiuVEKqXSQKqBgbKcmQKlAfPNSTolC/rZWhaGkixUHeHhIcvLmaUts6mOcqb1o6YZi1Qt2MBUGp73qQfrO16ypjh1wfJ442wXz4MYx5GiyPS5r9ykG7/1Y8XLhhQVDuZtLbxW0to279YXJT2wBLrRpPJP7tsZsPYpH4H4h5yl+5UpD1lvkTTcocc4TtJfSnoj9w8kDAA4v5eoc9TZ0uUtkn6tA9v9v8rLmK/s0H4/T/l8ix+ni+CQ779oAixJPuRzJ0qKCgU1duzVnq17pbExRRuWyxRYJHkRKThd2MjCMycbYUUSwjPMdCStcvjMpN2VVImkk5eXtd1H2lnzpfHUr0uD+kdiUz3LV8HuxvMhtnxRnuCD5A9hEsQQrurAbn1oCXWhj0h6d5u7xy9K+jNJTc7Q/dos6V2SPtfBx3hDuuferyqfbwlLNl8gYMCCebXy0VTd4m5JP1jE+3ehPec9xy6xPpJJuk6dSULno3T57ZKmO7Ttdyqft3ikQ9v/U3vOe74avvkXm3ipwiHdf9EEWJIiJ4uifKXluKC0Vldly16p3pCKRWUyPrtbHIomnV5Nw4XVNDyjnoXjnNPJJvLddnDO1MiC9lRSjRQaWjFQkvW5wo5aOOf2qeyly4s2PRjbfZF1571m5IOiKB99rMLBvZ2le+69TPkn1O10s6TvLKEudK+kL0t6aRu3uV7ST0v6LGdoS5+X9CJJr+/gY3xc+aqRD9DcANodUHTZ/ibKQ88vLtL9+4cl2k/+SvmHlO2+Au106fLfSfpqB7e/U9L7JX26Q9sfkPQpe857Lg/f/Atuh3HQCBCx9IUgiyJFfWWplvKp/CIwlw4WJJ3npbfMNkOx6cPxkevoG35PiqI8LL97rKGTzbRhWak8k9qpt06mPz2W+D2Xryxs7YtVb2aPXMF1Q3obJMWRycXKJ3K0g35deH8HduvDS7ALXa32BoiauzAmQHxyv6h8LsRjOrT94blj8CxJKc29NK99AByQgqQPaPEGiEvVO5WHiLe0cZvnqLOly7vm+kqnfUZ5KfPzOrT9y5SHt39JN8TBIkAEMG98yFfMXlZ26ovsXPnwrtnEvygLkjP100KdYZIsMj040VQlk85e3afbKsFXslDsi21NnwtbE6+s2UXlzD5IFjsNDpRUKBQO6mY53X33CZJe1uZd2qHOTXy9kK6Zu7hvZ7h/nqRLJH2Xs7OlKeUjEL+jfI7YTniG8pWff5PmXooIEAF0xSVqu8xH6fK7JI3PU9u8VdIdkgY7tP0P2uXv/o9wzccoZcZBIUAEMG+3MqvKTnvqWd+/ba4+/e6J5M3m7KWJ16ijZrnjnJnqadCu6USDBdPavuLqpBBd8aOJtLA8ts9uGHA7ThmK5EzqhpWZy8VIeyYquuHbt2v3Q9vlSsWD6YzvVfu73Me0dOf1u1rtL6W5SgSIT+V7yhec6WTA9+uSvqalVXqPfW+6ANA7flOdLV3+Z0lfmMfn85DyhVr+okPbz0uZn/3uy8O3PsY7Bg4YASKAjjNJkSmupKHv1vH6Mz5x2/RVkp4dFVyJ1pk/UWxKfdDGnTWdtNZWDxeiS2+dSmdWFNx1xwy4iTOGo3rspMQv/ueybKSkG3bt0o++9l3Vp6qKRwYPaBRiumvjiKQ3t3l36srLcJaqz0v6oKTVbdzmyyVtkMQn30/u95SXMD29Q9t3yhdsOUvSBM29lHA/CKBnnK/Oli6PK59aZL59TNLPKK/a6ITLRCkzDhIBIoCO38IUnDQYu3VffLB60R1jzVcrdheZRHi4AJyTvDlt3lvXaOK3nbmq/6vBbEXmdXridVNQdwSIic+fR6FUVD1qHHgJc9DblH/q2k7/R9214uTBas5dXP5eG7dpkt6nfD5EtJYqL2X+iTpXxnSkpL9RvogAltKbLwAsfSXlpctRBx/jvZJ2L9Ar+VuUTyXT16HH+KBd9q7/CNd+nA90cUAIEAF0VDGylfUsPO3mvY0j7ptOX1mtZpdFJTdEyywcZ1Iz8ZqaTUaHS/WXJKXibelw/JXB2BQUdChrksz7c5h7Hs45yQ5sb9Odd8WS/lsHdufqHug2H5f0G2pv8P9mSb8taZqz8kndP3fz8qkOPsarJL1NeZCIJYEEEUBP+G1Jp3dw+19RPlJ/odwr6Xck/UmHtp+XMl/2zsvDtX/FGweeEgEigLZzJkVmsUkrnfSMsbp//o5KepRkzyA8XCTHKHZKs7DqoT21V5ZGwpq9w/F991bc1tGC7TFZ6hf5zWecSrXsoG+RXyHp6Dbvytck3dkDXWaP8lV739LGbQ4pnyT8Q5yRT+nTkl4o6TUdfIyrlc+FeDfNDQDoAudL+tUObn9a0jsWwfP8kPIqgQs6tP3LRCkzDvQejCYA0E5BUmSmgrM1zvTmasOva/qwKnJ2sTpXgoeDZJZX/WbBNJBk5z84Xr/q04kfvGh5/K/H9kW7a4t8JZXxSNpZ9/IHs2x0CFd1YFc+3EPd5iNqb4Ao5SNCPyIp46x8Su+Q9ExJR3Ro+/2S/lHShZIaNHe3vxkzkATAkjYfpcu/LGnbIniu2dz1102Sih16jA/ape/4j/DtT1DKjCflaAIAh8sHqT82reyLtKzojvrxWPPZ//JA9fWzafhZmV6Sej1d0jCvOYuM5YHvdC0tTcwmQyHxexXMZVLcDFKyCL+aQWr6ICtJhf4+2b4k9CmkO+58uqRntLkF75L0Xz3UY26T9I02b/NY5Quq4KlNSHqDOlubeo7ylZ8BAFjMOl26fI2kv11Ez/d2Sf+rg9vPS5kvfYfRtfBkGIEI4LD1xRZtmc1GJ5q1I8fq2UvvGE/OU9OfpKI7NYqNqZgWKZv7TzUJUj31R9ST42rNeFulaLPeh9nFudMmZ047tk7qwXsfUpZlsugAPnzuzOjDq9V7vftqSc9t8zavkvQvnJEH5FvK50HqZMnWB5SX5v8Xzd3FGIEIYOnqdOlyRfkUK4vthfSPJL1S0tkd2v5lopQZT4EAEcBhGym51d/aXn/293fWX5oGPScyjark8tGG3MMselFsqjX9iXfsqv+Oxe6PMrP7RmPNhrD4Dp9zToVyQd/77o9007d+pFAsKioVnvR30u13HKX2rzC7V/nqy73mP5TPkXdyG7d5kaSfknQDZ+MB+S1JV0h6Wgcf4+8knaWFWXUSAIBW5qN0+TclLcZS3kR5sPnDDj7/P7Fnvf1r4Tt/fS9dDftDgAjgoOwLlAZiU2Q60Xs969a9zUI908X1hn++YlsWOUa/dx2Ta2a+754d1fP7nH5w0ZH9P0iDKrXUq5k9MlpxobmQD6yZrTaUzlbllhVlTk+RdIb3dOBC6xOSaj36EvARSR9r83bfL+n1nIgHfAPxs5J+rHzewk5Yo3zhlpeIj4G6/N0aAJaUTpcuf1/SRxfx879R0p9K+rUObb9f0qfsWW+7NHznbzzdDY9HgAjgwF8wTCpFNmLSmrsmk4IPerFJb9gxnVbk7Mio6JbRSt3JmUmmMFtJz3lwonHlUYOFSed0y0jBkjVFJ79I7kedk0qRNFyKpVJRZk++X+m22wclvb3Nu5Got8s7/k75PDztPN9/WtJ/1+KYrLwb3K281PivOvgYL5L0XuWBMboN+SGApafTpcsN5YuVLPbg7PckvULtrQZ5tIvn3v+vpsvhCXkATQDgAJgkpUHLpXCJpMu/vrVeMtMZzukMOdZGWTLHuRQdPV7Lnve9LbObRktu60WrSztPGC4p8SFf8XiBOSf1F6Xhpxx1+PBd9M9LGm3zbvyTpO093E+qykdgtvPT71jSeyT9OqfhATbYEWd+It1224skvayDD/NBSddKuoUW7zYkiACWlLLyDzA7Wbr8e5I2dkFb1JUHnd9V5+qD/tAueetXwnf/llJmPPZejCYA8Hg+SJFJoyWnoYIbKThdEjv9ws17m1d/f1fjdxtZeLVCuDL4cDattcTeFEyqJX7DWDX9hSyE5xQjG3JzbxaL6etArpbSbbc5Se/rQDN9mJ6iv5CUtnmb71DnSnKXqrdI2tHB7Zck/YOkPpoaALCA/kDSaR3c/k3KS4O7xffU2VLrPkmfskveSl6Ex2AEIoD8xcCZ+mJT0VmxL7Y1s0lY8Y2tNbe75i+eTcJlkjaMVbJzJMnFJuY5XJpMkg8qNlKdMV7Jrphp+lvKsd2eJUFeCzsNYgiSc6ZyuaA4jp56ldGg4ySd2Obd+K7yued63TZJ/1fS69q4zWWSnq58pWEcyOv2EWeOpVtve5M6u2LyqXM3bTfR4l2EAYgAlpZXdHDbqfLFSdIua5PflHSlpGM7tP1nSFovaSvdDw9fe9IEQG+xx/410tygrkYWosmGX1FJ/YZiZM/YXklP+/TGmUjSxc7Z0aZ8tV4sfZEzBSnZOZWe/sBUcv7smtLdiVcawlNGdp3tuyZlqdfEdFW1RjMfLvlkb3BHnnlfuvXWv527KGwXRh8+4mq1N0D8qg4vPPzs3LE+og378nlJW7riQu7IM7+Wbr31auUL0XTCf2nxh4cfn7u5HG7Dtj64NE7PsBTOh548p7u8nbtRIulDtOe8+5KkOw/i539P0t93aF/+SNJPurANZ+f62jc6tP1Phus+SXiIx1530gTA0rcv9BksOC0vRxopOg0UzBWdnerMzowLtuqWvU23tZIuqyThubOJPyKTBud+bYQW7D0mxYrt1Nsmktd+7t7ZibNXlL4+WnTV5gJOhFgqFbV375S+d92Nuv++LYr6yvkiKk/uV5SXebTrVPp3esfDbpD0WrWvvPVrh/n790m6RNKlh7mdpvJ5LrMuOha/Nnfz04lPea7rgud/vfJJ3887zO1MxUee9YUl8b5/3Sfvs4vf0u3nQy+f093Yzt3qbkk/oD3nVTZ3TjYP4nc+N/ce1+6S2iDpH7u4Lb+pfBTi8g5s+yt0VTweASLQtXcHUjFyGikXVG16DRQj9RUilWJXKEauZOaci6MQhWh5HMerkxD1fWtnM9tR86t2VNJTphrZ0LbZ7NhaGo4z0+hkPbPJSlqSs2MVmSITZcq9zVxk/eOV7PSbfDjz+OHC9cMFV51NgppZUND8lzP3R6bd03XdfNeD8hNTipcNP2UZc3zkWZOSPsPh7Jh/WmT7s2nuq7cu5o48q6F8cvledtvcF/ZdJlz3yaVwPvTkOU070554Aq/OjUDsdl+kCTBv15w0AbA4mCRnJmcmM+37MssLNZ09sn5ELMnJmWYaadg0Xon3zCaDO2cag2OV5shkLRmdbWRDiYXYqekbqT8hSrLTChaNXLu50bg22PFydpY09wBurpY5snzlFOBRfVKS88GOnm6Gs4YLftqk6kjRydn8T7HVXzRVy7GWDfVrb7WqhS2oBgAAAIDeQYAILAYhqFSItKy/oKl6omozVj3xSjIfVwvRUDHOlsWRWxY5W2emIyUtc+XYbtoyWf+1L905lPpweZL5VWlQlPoQ+aAoSJI5NYJKwaLyYDmOlw30+b7B/lIjKmq7L6mSRQoKCiFICnK2sItkYPFxka2qZ/7FX9tSHTliKJ6+cHXph+eu6tNo0VTP5jfAGxks6Z56UUVn+VLhAAAAAIB5QYAIdFh/MdJoX0GDpXhfifFgIXKjzmyl8lVHY1eMddNDE8n/vuaeoal6ckalkQ1Wk6xYT7NiLfHlWjMbqKbZQKXplzVSv1zSgIudJivNZHKiWpZzx+RDGJ0eHrMoPTxCqxCZksSpnjTk6zUlUawsjTVQLGnlcEnFUlFVK2g8i1RL/Vw4Q6AIyUyFLGj9ZCVbH8d2rJndM1pykytLzlfnOUBcVnbaPTf6kRVGAQAAAGD+ECACB8nm5gaMnO0rOXbOzJkpNlMsqTD3ZWYK2yfrQ3fsmB7evLcysGe2Mby30lwzU0/WNzN/bJDWm1nJSpFufmi8fvMDe5bL7Bl5ECg9upZZzmSPKnFWkOLYSXFRj11J4tGpX/6XIKmaSbOzicJMU7IgZUErBktaFg+qL/RpwpU1mxZUiCJZwSkLTjUv+RDyXeHQ926fl+ohNkVBZ800/c7Uh++nPjSTeQwQg6QkSJkZ2SEAAAAAzDMCROBghKDIOfUXYzWamUoFFxUjNxJHNhw7t9yZrXVmR0la4yIrOXPJl2/ffunXN+46Mcm8ecmlPkTehygLKvgQIpNMISiKoxAKc8mhSfZwZGcPh4mHFOLZvj/yhVGC8iAyuKCZxOue3RWZq6qZBRWLsU5bN6IVy0a0W326fcorS6RggekRe5hJpSiy88dm0uHbxps7X3v8wA/KBadqls1bsByCVIqlvlJBzoz5DwEAAABgHhEgAvuEoMiZRvuL6itEGshLjsvFyK1yZkdKWmmlgrt313TyF9+6u6+R+HOm68nqWpKW64kv15Ksv5ZmQ9VmNpr5MGRmscyyydnGBqVeilxeWjw3mtDNjWDcJx9oODfW73EjCJ/g8SMOH/33J0t0HvVtM1Pmg5pZmv+D9zKfavdeabrSUFoo6ahCSf2D/ar8f/b+O0quI8/vRL8R16Qrb+A9QIDwoPfeNNlsw3bTdmak0Y40sysdaVZm3+7qvV251Z49WpnRvqfRtNTTPeqZ7mk/ZDfJbnpPggRIAiQMARQKhQJQvrIq7XUR74+IJApVedNnOfw+5yRRzJsZeW+4G/G9P8Nt9GcBEQgAJCZehTAA0YCxnYPp4PGfnM323dwbebUnyqfceYhFyBhDxLbw7sGzePXgR5hK58CjNrUKQRAEQRAEQRDEPEECInHVwRmDZXCYyg3Z4ozFGBBnBrdzXoD3BiYQMfmqvtH02tG00z2Rddc7frAdwFoeMY2BsUx+4MJUTLkaMyUMfuJmDHDOwWZYC5qWAVgG5giDi0CEY4zBLMRLNDgCxnAu6QBeDnbEwLbuODotD4YRR8Ln4KYJcAOpAJDk2nzVwSxmZTxxy0/PZB6TUp65b010KunOj4DYbhp44YOzePHX7wDdHTBti6wQCYIgCIIgCIIg5gkSEImrDh3D0OScJRjYWgBbwbDTjJgrx9IO+/fPHXcB3BUIuUcATEhpCAkOMM4AZppcSjNSSOPA2ExrQPbJf4r8cOgZFbE4ZBV8r9RxFnI+pctlAEyDQ5oGBIAzSQenki6iVhK9rTY29HYgZbfgvRSDlAxgkgTEqwgOIAB84YlVQmJF1ODHLR6ogdDsMcskWmI20BIH5+TCTBAEQRAEQRAEMZ+QgEgsT6SEyRnaYzYcTzDb5Js5Y9tM2+w4OTSNP3npZCLt+rcns+66tON3pF2/GwzxQEg2ncoHANaCMw7OlVUhY+CMf1J8uE5YEO7CXIzD3wo/NlP0m49y1REJwA0EpABEEGASATxfgNkZ9HAbve1xZMwY+nMAApW12eDU9ZY7DIhLjlvfHHa+5Us4m1qMt2yDw2+ioMcYQwI+0p4AOFm9EgRBEARBEARBzDckIBJLF6ms5WK2gYhpwDI4DM7aGEMbN43YdN4z3jk7FpnKedeOpvI3OX6wi1tG19BkVg6NpGxwdj04B0z+STxCzhh4ZMawYFevVMGgsk2Dq6y3SUdgMpuFaWTRm7ARMV34loeYZ6I1FoHLDCh3VmWVyEnlWZZwBlMyturcpHdvLpBHOzbGPkqYSGV8gUCi4daIEgDnDG6EIS+pUxEEQRAEQRAEQSwEJCASSxcGlQTEF/CEiAVCrhZS7pISuy3bXD80lbO+89qpAMD9EnKblCowoWlxHZOwUE4xt94iln5VWfeFHZunclmdFTurLAbAYMoaEwBG8wFGLk0jYmTQnYhgR2c3RnlcCYiMLMSugqEHcLgWQxtj2MQ4TpqcuUYzfkyq4AFcCjByWyYIgiAIgiAIglgQSEAklgQF3aAlaqEtZtsRi29KxKx9b3w81Po/p534VM69czrn9abyXkfG9TuEREIAPHB9AcZWMs5VAENWYWxBVuZAlbEFm15uRT8Y7rJc2TlePiYlEEgJVwSYyjo4NjCKlpYYrm9NINrWhr4sMJT0AEOCM3Y1G3IuW7jBNow74ou/Gcy3rI4bf7K/2+4/0G3DZKyh7syxiI3xqTR+8eKbOHHkFAzbunIcEwRBEARBEARBEE2HBERi0cIZQ8QyYBm8zTJYD4DW98+Ns/54audQMncX53zfxZFUy8VLU1EYfAcMAzAYmMFhcA6DscvZj4mGwhiDyZRrc9oXSE1k0eG4aGM+hAywxo6htcPCRMCRdAQCP4BhUDssrz6Alrwv956b9C7lfbnj+h57bEOLmbY4gycaJyC2JSIw82n0nTiDiYEhmCs6KYEKQRAEQRAEQRDEPEMCIrHYYFCOsiwQ0sw4fo/jBfsNg98mJbY89f75HONsD2e4mTEOM2bPSFzMypcc9kap5CRVZ0FuULklf6gKl+Wy51+s3MrcqxkAAwyImEj5wOGhLKQ3jZs2duLODT04muPokwxTgjr2shysDNPSZDmbs72+wEg+kO8FEg0VEC1fwBVALB4DojaJhwRBEARBEARBEAsACYjEokBKIGIZaIla3ZbBd0dtc+vwVLblJwf7eM4NPjWVdfcAiINBSCkTOpxheMzCou9f+ZFQKootWK81HSv9d9Wi5exzrNENumRm6TLlSqj/GBwnxzKYdAJEIxHcs6YDrh3HrwbzgCfBDEqwslxgDK0MuHt02ms9lzJPt9uJ9xiAlCcb5mZscQaTM7IjJgiCIAiCIAiCWEBIQCTmHSmV0VtL1EIgJCyDd9gm39w3PBUXUl4zkso/xjjbknP8WN+FSQ/c2MUtbnLGYBr8ckGkKCwqGNPWiAbHdC7AdD6NnlgeXZZEa7uPfQkDE4GFMVci7wmAAeTVvMTbHLAA9OYDeevxpDf43GCub3Ob+XHMZHm/QVaneRZgIh/AJ8NDgiAIgiAIgiCIBYMERGLe4RxMSFhDyaw5lXVX5Tz/DsvkDx0/P5E4fnGyk3PjPs4ZTLNEtuTZVGRRWENCkYooVhar8RzLnd88lVuP2zag2o4BEy7wyulJdLVmcN+WLoxHGXzBMS0BRyijRdIQlwE2b7uYEY/82cn0uc9tin13d5c9kHYbo/jFhY/RXKDcoil5CkEQBEEQBEEQxIJAAiIxr0gALVHL9AJx87956v3tE2nnU1NZ9ybHCzqYZXAABmOseXH7ylKsrAa7QS/GclGm3GoKmKVRMpsj5QV4+dwk4pE01nS0YmdvB95PBpjMBOAmiYhLHc4APxDmhCN7Tc7irRZH3g/qHo5SSsQiFloSMXDOKf4hQRAEQRAEQRDEAkECItF0JADOGSKmscI2+JqprHtX38j0Q+eGp9bC9fcialuGacDgXH+aWC4wAAZn8KXEWMpFJO9BCgE/ENjREsOEbeN0WiIQQmXPISVxybYzGFo9gXsOjjjDvsAPOm1+BgDq8WS2LBP9pwZx8thpTE9nwCMWVTZBEARBEARBEMQCQAIi0TSUIMSYwVir5wW9kxnngJC4L511P592/HWGZYLZJoonJ6ki8Uforxf5u+pMzbOP1VBuRe7ATSi3VD1U47LMyrxZgSu0wRhgcfgMOJ/M4/xkHvdt68TWtjaM5RhynMETDIGQJCIuUThnMQbsPXQp7ycd0XfPmug5KRH4ElLWaDmYaIngnWPncPiZN4CWOMwIZWEmCIIgCIIgCIJYCEhAJJqClMrqMGoZsbhtfm5qOnfgrTPDzPGCBwyLrwJ4FeHM6shYXPJYiXJrzoLcxHKrcS2u6neKnWONbtBFy2UzimYwdCKct89PY1W7i52dLchGEhjIGxjPeBCckYi4BLncZMwxOeIxk/UGAqMikL5Xo+YXSAnTNIBohFyYCYIgCIIgCIIgFhASEImGIaSEyRk64hF0JOxVI9O5a585MtB7cTLzdQG2bzrj5LhhbOGMG6Wt7kr8CCtxoGyylEVWbkUFoMrfqcGCs2ary9rKLcS4zLoCF6fy4FLCinnY0taKTYko3p/wELgChkUq4lKEGWzTSE585s1hJ99qsp9va7f9azosBFJWHaCgtcXGcMwEGIOk8AYEQRAEQRAEQRALBgmIRMOwTYPnvKDlyMBYYjyV/9JoKvfg8HgqAdO42YwYbepTJAoRevKxDOQD4PREHi2Wg90msL7XRK6VYzDDMO0LcFDi3aUG51g1mROPTOYcY1WL8fGOTvu9HR2W5wYSokoNsLPdwkdRZbFah3wYAdBapAgOwAWQQulQjYXvFzsNCcADkAPg13BuDIABIAYgOus8BIC0Lj8MQ5+bhfrCTYY2p66jrL4+WcV1tQKI65etX3zGZ3xdb66+zlSNddjMunAB5Ku89tlY+rwqCfLLdV3k6jjnOIBEhXUQ6N/z66ynsDE2mzyATIX9rq2J/brSuogBaClyDhyAA2C6nh+0vvYfoMd9q/6tiH6Zs+aYvP69rD7HbJ3XmtD9RBQZt4Hu97ka657pdosXaT9Pn38j2tTQfcScxz7i6/MPKqjLRv9uYa6sluiMfly4z/BZbZKb0eapGn+nVF1wXXa6jnKjIfNEvoL7b+Hai7WR0GMrV+Mcz/S9La77pJx1/0ij/uDuEd3Xo/pVbI5wZtRFusJ5tpb7SKHOUwu0xFyIuqiEFv2KzHgZs/pZZsZ55Sq4zzNdTlRfowyZrwtjOGhA3bbocmf/lvB++PcnaYdDfLKHpyogGkVbzG4bmsre/uTh/puTGeeLnLFtzLY448wqO0WGvVFrDMCq4vZVUW7ZL7Davjb7TVaHi3LF9TmP5YZNQFytR/ICOHwxhYspH5/fvQInWyw8ey4PYTAYJCAuPThsk7M7IwZ7lAFDTiAHPFG9gOgEEn79hoebATyoNxizN34DAJ7Si7owNgJ4SC8A/VkbWAfAKIBDAC7VVFNAJ4AbAGzXi0COy+LhywAullm0PgpgRQNEhWLEdB29A2C4CqGpB8DtAA4A2ANgPYC1eoFaYALAcX19bwN4FcDZOhfwjaoLptthAMBpfa5jNZbVA+AR3d+cMr8Z023+fh3nvg/AzbpPyxL9TgBIAnhJ9+F62Ajg4SJjbPZN4SSA1yrY6MT1mFvTpH49uy4kgMkidbEDwD26LsWsvnYSwDMNEI52AbhL/7sFwCYA7bMEnrMAzgA4qsfim3WIPACwH8AtRQQdU29yB/ScVotIYOp2u1H/m5shWA3qOm7Ehr5Dj6tu1Ce4V9pHAGBIn//UrPF2S5NECkOPqWHd9v01fH+v7ls36rl4i55nCozqefg8gGN6fB6vY+4pVhctek57scZyDwDYrccpm/FvFMAJ3VeTJeaVW/S5pYvUT0bP8e+VWQeEYesxe4Pui3l9bkyX+zLqf0BzrZ6HrgWwVf9e54zjPoBzAE4B+GjGHFHPuNgN4A49/8pZbfkhgGcXaHW5EHVRyTi7VdfXen1Om6CEzgJZAB/o8zquz+1wmXnc1OumfXou9Wa1hanLvajHwESd17FF1y2b0WcNfY4TAH5BmxtiZucjiJoQUiIeMdHVEkXUNO64OJ7aPJlxDgyNpz8LhmtM22SMVREDsKxLbI2xBcsKUMXKrTcGYFisxhrKZWXOtRnlsoorr3yFVOACLiQgfIHhVA5vnB7Fmt5WPLwuisNTwFhOAFLAoMCISwbOwCDRMZ4Orp9yxG86bT4w7Qm4QXVdyjYYAs8H0lmgLQGYZi1xEHcD+AO98BKzFv5H9aam1MZhJ4A/LPJ9rhdZGQD/F4Analx4dgF4DMD9ujymhaZjepF5scwm+ncBbEBpS8V61gjvAbgAYLyCjdBefR2FhfRKLegliny2V38mDeA2AJ/T1/wClJhY7dP0RtZFYQM4pRfOOb3B/gDAu1VusNfo/hMvc00Ml62p3q/hnC29AfiKFlYChAuITPf59/Rv1Ssg3hQyxmZP+E/rDXU5WgH8NoBtTerXldbFTQD+DuZaoNoAXgHwG9QmIHZCCaS3643wBiihuTNkXb5Gz2O3Avg0LguxL5aZH8K4C8DfKLJ55bq++wD8C93fa+mHmwB8XV9bYU7L6rH9doPEth4Af0vPMf489JGcrvN3cKWAeCeA30N9gm7orVRfW6Gd+6v47r36vrJf19UaPefyIvPwRihr2lEAn9X3nad1H6+GsLqwtfhQq4C4F8A3oIT1mQKiocdgnz7/sPn1EQCfCenvru7n/xzVC7SF/r5Dj6e1M/p7GsBfA3i9xv7ZpueI2/TYnzlHFDPKWK3H261QD9I+1r/9ItQDgWq5Tc99XpG579eYXwGxfUZd7KqxLl6DEv8HGnhePQA+pdc7u/V6pk2vRYwin18BJTSP6bF2RNfjKyj+oCzQ649rAfxNvS4URebrIQD/K+oTENcA+CKArxW2+Lgs0r8J4Ce0syFmbw4IovrVFANaohbOjaZajvSPXp9xvb8zMZVbg5TTaUTM7ST1ENUJTgzcYPAEcHhgCjk/wPUbOrE5YsKEgaTH4PiiIE4Ri31+UCvOIO2I3SeT7oNHJ9z+uMlGDM6CoAoBMMh4SHS0Y82OzRhLTiFwfTCDV3s6q/TiLuweaJX5/soS3y/wOS0+DNRQVTG9KN4165iLKy1FihGDsjbrbGJzBnpRbJQRfPZp0eDLus4qoeDivALAdQA+rzeLq7TQNITK3b/moy4+1JuQZ6CExOEKNz83VfEbt+vF+giqE1FtLRbcV6QvhTGF4q6B1QgcbVAWPrsr+Py03mSXs2aNQFlMrZ7HaatYXayHeoBQjElU/4TN0Nf/GS04VNMvOvRru27j2wBcA+BJ3S+dKsraojelpQSbQ1AWg+M1XGMHgOuhhMSZ88jHDdx3tOh+F5+n/iGhHiJYVdZlI+ivYpz2QgnEvw3g8Qq/k9Cv1Xoe/6zuZ51aeJmocB4uVRf11NEKKCvE1iLHzuu5v9RY3Fnm9zcCOAjgB7hSHK60v/fqsdwx6/79dg1zBNft8CiUGHtbDXPENVCWZHdAiZt/DSWSVmNhualEnZ2fr60BlLD1KJSAVk9d3D6jLo6gNmvTmWuN7VDC9Nf1fbfS763VL0B5xuyBEkRfhRLCZ87jQt9nxqAeNHeXKPslKMvLiRrr+TEo8XBPkePPQT3cJYgrNk8EUdvqLWLhiUNnb/zBSx/9UWBZ95hRKzHnZllVcpJ6E3RUkaUYFR4umUSkDjfohSi3EdaERc+RVVmf4W9yzoC4jZMTDoZy47hpTQs629pwKm/i/LQHn7LwLiUMZvPNxya9L373ZHr47jWRH6+MGZP5oIo2TKfRu2k9HvtcK5588gUMnbsEMxGr9jxKWYZUEp+oEsuSe6CEsz9G9dYGAnOfPmdRWQwyAeVm2EzRLIPS1mzQi/M/hLI+TNTTZ7S4shPAfwDwUyghrdJ6bGZdSH1e26CsIf4YwH+qoP8U4pdV2nHXQllOPIPq3K4K4lSlgkoatce5mzl53wjlSlYJXVBWSr/RG6NybTlfAmJYXThlxkW1bNLCzje02FIPe3R/3Ajg36M6a8FKNs9fgHK3+0kN46QQK3AmKV2fjbqJB7rM+RIQUygeFiDf5N8NMNeFPgxLiy3/XM8FssaFn4QSETcD+LcAflVmvFZSF/WEIijEEmwNKbdc3ZT77TiAr0K5HD9XQ115un90zOovtVilrtPzw+9AiVS1tiGgBLN/qOeIfwf10KsRc0R2nsbcel0Xv92AurgWSkws1MWhOs5rP4B/CfXAsp75R+o1014AfwXgv0I9DJrNawD+AkpEbQ0p67O6//6shvNYCfWwYWeRcfe2XoucBUHMgFMVEFXNdlKiLWbDNHj0v71y4qFfHz77d1xP3CuEbAdjJhgzLu8rqhCWiu5LWJm/qxGpCsfYDPGrSLmsUeXO+FK5Uy5XbtEP1nAPLeeyHOYKXdX5F3OFZlWXKyQwmfdxdDiN8YkkNpkObllpozNqIPAEDcQlAmPgjiu7L2b9VZyxlpjJICSQ9SVSnkS6zCvlBvC4CTMaBeOL+na1CcqVZdsyvK/aZa7pWwD+EZRVVGud119w490B4O/qzUPPYunOUCJdVJ/fHwD4JyUW9LWyUYtD1T7gDaAsstbNY50IKAGxUguMFijhLFFBXdvzeB0RLb400779AID/RY+Xa1DaorcSDF1HjwH4+1AWvI0yCjB1H7wXSvRdjHNaIcHAcuojYe1cSbtaWmAoCEZmHedaSISzT8/tn8b8CbULQRTKgvAuPTctVH/fDeB/hgrFca1ue9aAOeIRAH+k7w/WEmmTZtbFP6ijLh4C8E+hrDtb65zHC+ud1QB+S693it33zkI9TD2O8Acw10HFIa52PdIFJZ7vLXItHpSF++uYv0RVxBKBLBCJqohHLCQzbvfZkeQdT7537neDdP4Rsy0eB1mGEY1cMRsMgjFcmvaQ9dK4Rkr0dALbEhbOwcRIXt3LKMHK4oYBAEfCFfKmjye9oZwvnmi1+NCqmKHiG1YwbyRiDMPpAJ7rAZ5fPD/c4riX3qAXYn+K2hKqNANHv2pd5NpQbqfFrCrjUOLRH+jFdDHyuBw/cRzqiXbh0UE7lJXM+pBF8y6oGGc5AH+O+oOg5/Xvl6sLocWCcgLWXgD/PVS8sJdQfYbRQjbG1llrsZW6L8VQeRILC8oKcB+uFOcyuu3amiR8xPXGZW2Fn2/TfeZpKPfYUm0wpTcwYVY8BWsUu4RYInQZAS7HdJoN1/WcQv1ZLMNYi8uWNGGb1iGouFgjs/pSHMp1bZPe7M2mV28+GZRlzZEGnXMM6qHAp6GsWrJYXARQVnFxhMfJlLp9rRL1XmkfSaL6DNI+Llty1TL+CjHOHJQWtTq0MPJ39bwUNt/0Q7lDJvX1cv3d9fplFBFd9gP4fV3XTy3jpUoC6iHguwt0nav1+uF3EW6tPjxjjkjNGqtdUBaj3SEi0Zf13/8W9VnfzXddRBtcF91QcYJ5lXVhQlno/T7UQ5swpvRcPozLcTkLoWo6oFyyVxUZa2ugXIjP6vl2fNbYfQfAD6Hc+TcVWypDecI8qvtvusL55TqocBqzw85koWIfPovqw1gQVwEkIBLV3GK5wVjbe/2j979wdOCbzDTuM1ujFYiHFVjR1WShF5ZEpAHlsiadb7lyq1ZnQspiC+C2XUe5ski5HAAsjilP4shIFr0pF/vWd6G9K4ZXhpyqE3IQC4NhsC5X4KEXLuTaV7eYFx5cG3vqzlWW7Ilx5CpIsdyasHHet9DdEsG4aS5G8bBAO1Q8nDdRXey+ZnIcKi5OtI5rOqIXxbM3zrsB/O0SG1ahN2NP6MXvuzMWtQxKIHwMKu7h9VCi3ewRvQfKquZ9qCQXbp11MVBBXThQVo/Xa3GqlA32Cr0ZGUJ17mGFDdDHWlCb6XYdgbK46EHl7ttdevPQPuv9M7rtbmvSem8DlLVTMeGGhfSnW/UG8f0ybfCu/neyhIBkQAmnG0MEopRu82GEi8e2rqOP0JxMup168/6ZkHMsxNZ7AsBbULGwZsZSXaX7yNe1SNRe5DoSehN4XLd5o65jO4Bv6vM6g8U1+6ah3OsKCUCK4evxdA2UiGuGbPgH9FjzUVyos6BEtxOoLtbkmJ63JGp7iGPp3ztX4ncLc+k/KjMXvwMV4+8t3dcL42EPlPvi5/ScXsyq8x4o8fFFND/j9UJynRZx3tRtN1+06vvg51FcPJRQDyUL1mCv4UqX0l6oh06FOaKrSF+3oR5inIQKTTC9SNtgZl1EK6iLV3Fl8psV+t5dqi4iNdTFWgB/D8oqGyHnNabb5gU9Vk7NWLOs1mPtYX1e1xY5r80A/jc93p+dNd96AH4MZTm5MeT+uh7K9f04VILAcvRChRTZW2TeOw0lWA6AIIpAAiJRFimBqGUiapqrXjt56ZYT58e/BrB7GGNtoVmLq45h2Pz4ek0rt5FxBsPcoGs6x3LXvYDlVtw5GBiT8ITEWNbHBxeS2Nzr47H1rXh9xMfIlAcjQpEYFv0cAhgQ0pVAj83ZOs5wiTP4lSTEcRwPbYko/uhr9+Nnzx3Gs29+BB61wdiiU49NKPfMR/WC9uNFcE7/DSqmU62DxNIb7IszFsIcyurnIb0Qbivyvbxe7P4QKjbbJK60YJJ6M57UC+2v6QV/sZh3u6DiK/4z1BeH58/1wr5cXRQsEFdBuZ0+rjckxYjq9n4T1QuI43qhvxNz4za2QLnUDaOyp/+9up5mb7gG9evmJqz3uvU5zraKS2qRISx+4UooCwqOcGuuJID/W28mS1kgciiLkK+iuHXeOQB/qTeZGYRbl/lQYuNIg+vIwOXkQmFxIg8D+A5UXMgJzA2CPwSVpbMPKrHQb+v2LGYh+00ooe+nDZzTDkAJ/T9GbRmfm8UlAP9KCy6lLBDjUFbSn8dcgb2wUf5LLUaElVPoI1O6b1bKB1Bu67XGbiuMkXSJvrkawN0l+pcE8F39+lj3r8J1BlBi4qQWLP4B1AORYtwAZen6JOrL9rqYsfWc9mkoK+nRefhNQ8/dX4cS7ItxFCo+3q+1SDX7njCqhatzUNbw34LyCigmBn9VzxF/sQjrvxF1MdKEukhAPfh6EOEhVY7qMfacbo9RXGnRfglKqDwD9eDjD6HEO7vI/fEOvTaYmazG1/PvK3r+31RkTolDCYw367VSOSvEG/QartiaqJCJfQoEEbI4IIiSxGzDyrj+utNDyTvfPzf6BSfj3G/G7HYwMv8img/X/cwRwMVkHgwSnTbH/o4ozho2Tk97AGMwSEdctDBAwmAr8664ZzDjJw3OfmVzhixk2V2V6/uIWAbuuW41Puxbhd+8egRSYrFOPxZUMOs+LA4B8QM0zqVxRnPiQagkC8VchCb0Ivr/B2XtEkYA5d58QW/KJZQV1ewyW6FEvJf0hiE1j3VRsET5O1BWTMXigPXicobQDCp3cRyEErYeLnbbhUpMcwiVCYiroazU4rOEg1NQYnYzXHNXQYnIs9vrApQ4vBfKaiNRZJO4D8ra4kzYsNcbqEo4g3DrrKRu8zcWaPxtgxL1bsRcCzRXzxPfBfB9lLaCmYbKgnlaiz3/UG8UZ7NPj5U39QbWa8A1rIQSLfuwuATEHIonHCjGowgXoiegrGHfacI5DqG0pW0juAXAl1D8QU5O//6f67mmGD6UldGA3hPaUNays/vrVt2XD2H5CojQwszv63lzPgTEzbpeb8FckcvT5/E9qIeBpRLZpPWcWRCJTShheTa79L37Fd0/vUVU96XqwoUSBWupCwsqvmWtdbEfyrJvc5FjBQvhP9PjrNTYyOh5tA+Xw7ncPWusGVDWwCehHmzMREAJ/VsB/A9F6ohBCZxf1+P52ZDzKGQO/zSU1e1s+gA8v8jme2Kx7c2pCogyGBLY0D86/dDrJy9+wfGCB8yY3V50S1n0f8ok6Cjxdl3l1pP4o6ICyp3/zKQsIUlgSv0Eq7Nc1FtukYurSbCpMdN0kcMGB7jJcSHl4tlT4+hlDm5ZYSJqcnDSshc1DLA4Z3uS2eDRoxPOncO5YGUukNwXgFfmFUgGx5cYTgKpjIMl8OBiqxaFVi2Ce2xb45sS7VCWKMUWnlKLF/8JpcXD2ZyCssJ6P0Tsaod6Ur5rnutiDMqK8v/BlW5Ss1mnxaJqgrIPAziI4q5yUSh3p9UVtslqKJeoggVioMs/rctvhuvpaihrndn1eh5KQH4G4XEO9+vvNqI/xkuMM0ufX8sCra9v1xvUYgxCxUv9CSp3J3ShLAGfgrLoLdauB7Rg1tbAMX+D3oDbWHqBQ+JQgny5PtKMpD3NTPJSSHRyJ5RAXez6+rWocazCMl8B8G/092Y/CIlBPRRYv8z3joU6vRXNT+TE9Tz4FRQ36BnSwtRfobIs2IW5/6+hQiKkUPyB1l6oB51di0yPKFcX36mxLp5EePzSQl10hu2BoVz4Px1y/CLUQ6Afojph/QkAP8JcF2Gm5/A7UTy27ykoC/OBkOuRAB6AshqPhMzXHfoecXeROSoP4BcIf+BAEJ8MWIKYOwNJwDYNI2abGz48P37z8XPjjzLO7+OctVYkAJUVh0Li9tVTbj2Zm0v+Dgs5xyozTVdVbvGPVV4uULadalqvovpzLHP+sgrXclVNDJ6QeO7kBAbGpvDb26JYGTcRuJQkbNFjst6kKx777sn0l389mF8znAvQn/YrevWlPEy6AktELd4J5Zbbuww3V7v19RWL6eVDPbmuxZpnCMAvEW65eTvCXYmbSVIvqE+W+Ew3lHBcjYCYg3JrKrZZj0JZk62qUETYhCst/bK6DS40cRO8Rv/u7M3eJS1EfFBio7cXSiBdzmvrLt2GXSFj5WMo8bAWK6dXoVz/i4ntGwHcj8ZnB78TyjLGBrEYiEK5OpYaR8e02FCNsDGgBZdi1kdtUA9xuq+C+n0QKolQM+eIdj0X9obMEWf0HDFUQ/mFBBjFLG/XQolMnYtovuwoUxenoR6e1FMXXpV1YUE9GNxboux+3Ua1hL94Wb+KsRuXY0PP5rxeKw2X2Kjt12umYt/vhXqwdU2RY5d0XZ2jKZYoN2gJYg6JqAknECs/Gpy49/Sl5FczOfdug/MOzshvmVjgSYsBYAwjKRfHh1IYnkhhbxuwpdNC4AMBJQRftDCDGTkfWw8O5W/pm/J7GQOyvqzsFQBZxwfyDuTi8GEe1YusYsr1OqgMwnuXWROugLJEWlPkmAPlUngYtSVxmIKyFjgVcnw9VGyf+bYmKwRHP47wmEIRvbk2qizXg4o1NFJkbdYCZVXYUWKtZkCJubtw5eOWPFScpQE0xwpqtd6gRGZdT6DHxMd6YxRmgdiiz7ltmU51lq6f/SFtN6rb5zxqcy8/DBUzsVjZrVDC0pYayr2A8Azy+6Dc+NbRnWxRENPtHBYrbkCPwdEq+9gIVBbY80WOFSyjl0MfCHQdhQn4t0BZ2jdLLOV6fXBdyH1jHMpC/VSNc8RRqBh2xVbECShxadsiaQujTF2M6bo4U2NdHKmxLiJ6Dr8mpNwhqIc5p1BddvYCp6BirxbunyNQ7sPHoB5YhplfjEC5cpcKybJXz9drZ73foeeNWzE3ZvIolFXkYVSXLIq4GvfiVAXEJ5t7puLNcc6Qd/2Oc8NTdx3uG/lM3vUeMGNmV8kvqj8wx+qvJndalLD0q9KacM5XajjHWsqt2mow7FiY23ZNLRxSVoNdwBte7ly3bQbAiJsYy3h44sQ4Yn4Ou9o5EjYDZyifGJxYsBuOBHxIrJtyxZ4JRyR8IVkgJPwyL9cPEI3HEOvuADc4IBbc4vRtqCfP6ZCF5x4oS6DlZIW4EcrtpVimyGm9YR2uY0N3FqVj9m0FsAMLYwU1iXBX0wBKDKxm5ilcw/sIt7rciXBrz8KQugNzXbszenMxhOqsIivlOswVxwsxLc9CWaKe0RuksHpZp0WpKJYfBTfILSU294dQexzyKb3JnA6p21W6bqu1QnwK4XGzChvte9B460aiemx9jwm7v9SS2AlQDx+OoLiQ7EE9ROpZBvXnQAmlYa6abfpedyeKx75txHLoNoQLwMehRLNaHwCloB7oJUPmiJV6Dm9fJEvDO8rUxTt13PenoR7UlaqLPUXqIgoVviHME+AwVMKWWvF1G72m590fQ7lD/2eojOkzszjP7rsfQCWFC4sJ3Q0V9uXmWX3oOihL8o4i9+/DUPF4J0EQZaAkKnUgloNKIQHGGSyDwzI4YpYJ02B498zIgYMfDX6NG/w+xozEJ1NuTaJYA7MUX1FMDbH6yp1jM8plZephPmMLlj3GqiuzonKLn6usp1xVALjBIcHw0pkkdq4R+Oz6Vjxz0UcyK2BYNEctRjhDVBrs+rdHnN+dcoLc3i7rZ1GTS0+Unk952kfP1i243Yzg4KsHkR5PwohGFvJSDkJlAvw6wi2pHtMLvb9aJs23AurJdSJk43kSxWP6VcNZKOuLHsx9yNkB5drTj8qSizSSaImNZC2PdswZm5A+FA94vw5KND0UfgfHPsy1kEhBiVTDUGJWo811u3VfmL0Zeg9Xxoo8odtzS5H1ZidU7LYzCLd6W8pcj+KWuoCy7jqD2qxWCozrzedNISLDNgAb9Ma5Up6CejjwOyHH41ChGY5DCVTEwsGgHhzEQo6PoTZ3z8L8MREiXFhYHm7sBQHxegBfLHG/+4YWco41+PclVKy7MGvOi6jd+rBAUs8RnZj7oEbqe8smvUZZaPaXqIsLqN3Kr8CkrouOkLrYBvWA9Mise/SNUAJjMc7p+1s9HAHwN/W1OVAifaDXU/ky1/wk1APV3ws53goV6/CEvjcDSlC8t8j9eAwqbvUpfS8niIoWsEQNJCJLX6EwDIa8G+DSZAaDE2lMpvOWF4g73jo19PuZvHef2RKdlW25DjGw4lh9VcQVbFa5rMyb9ZxvyR+bJeDVbMVYps0WW7moso99EjpSWSNO5X2cHkvD5gz726Potwycmw7ADFCClcW36+GMIZHO+pvOcrnx2g6zx5ZyNOsL6QRqJVesyaSUaO9oRfvKXnDDgFx4C8QxLf48h+JPdAEldn0OSmw8v4QXZkyvFzYj3GIhq68zWedvndAL/bswV0DshLIUeBnzLyBuQHHhFHqRX+1Gr7D+GtHXjBAR6FYoa4RirNEiwswN0TSUVeOI7m/N8DS5Tm88Z2/CXp210T4NJWCtL7LeXAUVZ+xZLC8Bkem+shnh1p8noYTWep5Cj0OJeJsx102NQ1nzrEd1AuKgFi7e0uLG7I12Ie7eI2hugp7lQrNuUhEtHPSWGN8nUbuAKKBi2RaElxyUJdREmfmqWXURNKGfCT0Gk/p+c22ROaoVKtP8G3pcJBs4R6yDerASJsaeRu0uuwWSeo7YoeekYveXTVhYAbHSuuhrUF1sD6mLa3RdHJkxh24sM48fQ3iYjkrJ6uurheMAfgWVBKaYJXJc99/Duq/vgBIPiz3wfh7KApJcl4mqFrBEDcQjS7/6IrYB38/j4kQab318KXr0/Ni2yZTzOBgeNlpj7bQ2JJYCRtTEWNrDK7kkHt3Wgc2JKJIOQ8qXEJJExEUJZwxgWyYccZsr8YrN2WRPlIEzpmIcFiFmSOR9FyIIFsPUlNACzff1gvTeYl1Tb7i/BhWz5uI8n2PQwLI6tCBRaiFccF+thxG92L2zyLFWvaivxe211h4TgbJS2VdiIzGt27aaa2ezNkiDULEFZ7ord+rf7YaKTzTzGmL62GzriHNQLlFSn3sjR4qhNyoHMFdITkJZOcy0QD0PZT35UJGyWqCsO9agOpFr0S+r9Ca1lNvjJT1e6sHR420KxQXE9ag+fEKr7sf/BcA/wVyXwkLW609Dud3/DEpcIooz01qPVTEvFOKjihL3np0lyvT1PFBP2zwP9XBsbAHrovA8MYLGPwhhur9/DOU2+g8xN+s903Pw41AC1pMN+m1bizml4vkOobZYwjNx9b10EsVFs7UIt66bL2w9z8xXXSQrrItCcrJoiTE2AGUluJC8DxU7+guYG6+TQT2ou1evqz4NZek5e42YgsoKvZzuw0STIQGxDpaDC7MQEhKAYXDEbXNrS9S+N+34wg/ENJOyp644eKXWCc0otypLxSrPt+o9YY3uyqUsH5eS23bZv2vpDyXctiXATQOMAS/1TWP3WoF7V7Xg2aEAWVdWl9qAmBcMk21IuuLzL11yot0Rfvq2ldHJ21dGEDEY3BB35vaWKD7OWXjS9wHP122/YPNwYWH5mhZJ7g353FooN6gXMf8CotvAsrpQOvaZ06A1hV1i0R7VG7pazP9rtYDZDuB/wtw4gzMZhrJcqHUzcQHK6uthzLUOKIiIr88SBLq1iBAtstkqxE5qdHzBVqg4eB1F6rYPc+NfXoKyfhAl+tQW3Z7eMpna4gjPvDxTGKkXrtvXCLlrdqL6hEMFC9snAHwJ4THJ9gL4MpT1KAmI4bRBWXlJVO72a+jxUhCHi2GVmQMnUP+DnIlFUBeevqf0oDmruJieJ38JlTBldcjnbgXweajERU4D5wizCferaueIhY5nGtf3MmOB66Jj1nxZGGOyiWOsEQwA+BOoh3phCX92QSX1O4C5D/4moUJXHKfpmqgGEhCvcqQEOGdojVos4/lrJqazt0iJPYyxnqJCTbMEoIaUW0XcvrJU6K5c8TlWWe5CuG2XK7da9/USH5GlXKFrdIMuFJnzBM6OZQHJcGt3HKcywPmkD2Yxyhq1yO4/gcDarC8ejRjsOGdstMXiI1GDwQkREE3hY21nC37383fhxTc/xInTg2C2vVAJmQvdKQfgF3pT/XDIfXY7lEXdKcyv6+1noeI42VVcUwaXY+aIGSNvJcKD5xesDxth8TgCZY1XbNNQsNxI1FBuh94QlMv8a+hFdi+U5eHDUMlwEiFCkNuAdh2GsoS5r8ixdr3wPzZLrFkFFTexc9bnz0K5pAVofAKVNqig8r1F2uwg5gZf96GsPk5CuT2bRYSQ/VCxuE4sk3mtFcqq0g4RRBrlCpnVdZsqIQ6srnFOGwXw5/r7B4p8LqLnu9ugrNQyIIqxF8C/njGvVNoGEsD/gcsZWov1sZUh49uDeiBRb5sEDa6L/TXURaDrYxuaI3QV6vosgO/oe0Qx0Tyq56+boZJ51Gt1loB6sFgsdqmv59NGCLiOniOmQuaIdix8Ru2WeaqLvK6L6RJ1MdOSuwfhbtWNGmONoBB7+Df6/IvN+Rt0OxeLl3oRygL3NAiimg0cVUFDJKYlhcTljMtR28B0TpoDY6md50en78xknevMaGQ3Z+TzSSzFQclgRBjG0z6mvDQeihnYHI8g7xoY8wS5My++5gIMtloK+XDWF+9KYCSQKutysQnWy7uIx6N4/P69uDQ+hWMfnYVhL1g895kq59sA/kxvkorFpTIBfAYqptHP5/EcvwQlSlWSbYbp8x6Firl3BFeKeK0Id8vMQVm+NWLTOa7LkiHnuAq1BfF/QG+4u8u0acHiZR2UcLiiTLlvQcXIqocJXd+ZIufXpoWaF3ClBesGKBfglhnnnoMSIieatMbr1ecyW7TsR3hGyGkocXEz5grQUpf3OpaPgBjVm1EzZLN3EeGZM6vdEF8M2cQyPUY6a5zTOJS75nb9ihaZ03oAfBPKyvQg3c2KsgYqBm4tfB/hAmIMSuwyQsSNJBprfb7QddHse3gA4EdQllob9diZvQJZB5XsYhz1J1SxdfuFzRFDKC50VYtbZr4xoSwhF5JImbq41OC6SIcct2bVRRuUGGcugTEmoB5ibwXw1ZA6LkYaKi7ka1g+HgDEPEECYl273yV63rKweWeIWSbSea/1qff6PzNwcfJrZszeWtG1sUWW+KPihgpz2630HBeg3HrcwcvVQzUF1JppmtVbbpXu1RIwbA4hgefOJHHrxnbcs6YFvzzvIu+RO/NioiDmTmWDVYOZYDsDXucMXpghKuMMQghMpQM4jgssngcdPlTW21eh4r3NdhPhUK6fJ6HcReYrUHUvlCBVTUVFtPAw+zsBwl2JOBqX7ddEacs5D7W5gH4dyu2yEkNkNuOaUOZcfoL6BcRpKCFyFHPjM7VBZdqdHatqg25fNuNcPsaVWZAb7d+/FsoKZ7aQfAnAuyGbMxdKHBzBXAGRQSXF2b6MprVCQp0wAdxCY+5Chf7Jy8xLtV5DFsra6iiUC32sSL/8HJTIRQJi43Hr6GPmEt6hLAQBlJXem1APjXYUmft79D3kedQvIEo9Nps9R1RS1kK74Yp5rotK58ugxFpjMY6x9wC8BOArqDxe6GEAv0bzkj0RyxgSEOsgk1+aCTVNgyHnBjh1aRKXkpk1p4emHr+YzHxVcL6Ng/GKhZqSx+uMr1fRjzXADbrsOS4yt+1y9dCoTNNNctuW8+wO7gUSJ4YzcALgvpVxHJ0SGEx6MGxyZl5MSM4296e8L//VmczE3m7r+e4In3RDljQGl4j4PtKeXEzLNwllXfhfoOLSFctUbEFZA/4OlHVJbh4WoBzVB5+PoPGur4uBCCqzxKyUNIC/hHLhTDeg/yT1gn4zrrSEYFDWO1tmvLcdSnib2bYeVByjgSbV3yooISlRZAN4FsoNu9hmaxrAK1AxxHaFrEM36H99EItpTntbz1X/CnMFxEJyiy9DPRh5pp6VHUEsMAIqTvF2AP8s5F4ahbK6HYB6WEj9nShFq54fiz10K0cOShT8MSpz4fahHkL+HCrsSiUu/7/W9+aAmoqoFhIQ6yDvLc21blQayDgeOzM8ZT//4flrB0amHzRMY58RsehGSDR8ByKkBKTeWbIZBwr/z65cojEwMNaAdDYMMCwDoykXaV/i/qiBLQkbQli4mFMP7w1y1V8UcJO1TOSDW54ZyJ6OmfEPW7ojk0lXIBByzqNRziWiIkAy5wGeDykXjSFiHiqpwG+gxJZirrLboIJZvwclFi3GhVuY4MgWyWZpoc8hDZXh9HkowfjjBm5g34ByS57tVmYAuBbKCmYMSjzcOeszgd5AnGvSdW/X5xbgskVIQTz8EOHWjg6Uxc4ZKDfyYu23Dsrq52MsD1cqtkzOYwIqocqnoWK4FtuU3gbgW1AWqGMgEXgx7M8kVV9NDENltP00VPzKYqLPA1Axbz+AejgSXOVzxHKeL1mdYywO4FEoq8BaeApK5Ks0BuQpAP8Jyg3/xhKfc/X683nMb0xuYjnt26gK6qg8xpbki6l/zYhlbLINvh0qHkcu3FN2xr6RsRm79Xr3kzO/X8Rttxmu0AtRbtlqCnMHZ9WXxcLqdqY7cJXlstrLZQwwGIPBGUzOwAsvg4Gb+l/OwDmHwTmMQh9t4HrCiJrIC4mnTk/CDjzcvsqGzWmJvQh3254E2iCxlgGGwQDbYIgWeUUMhqhlApaBRaYBC70BeaXEpV4D4EEoN2FvEfZEL2RTJBfJuS7kOaSg4gX9aygrlQ/ROPcfD8qS60LI8c1QIiKg4jLOjs2Y05uCkSZd+yYoK0g2qy3e1eddCh9KQJwOab/VAO7C3OzOSxW5jM5jDMD3dF8veouFiv36gN4wOyAaQT1CLD0ZrZ3zUA+GwpJK2FqcuU3/7dIcsWznS1nnGBNQicWSNZzLNJRwWI1AnYEKKfFOmXn4ElTM7j4a7kStkAViHdjm0gumJqVEeyICNxDBB+fGDlwcnnqcG/w6xlidrl2sArfdWqbiBSq3nrh91a7fyp5/I6+7ceVKCQRSAkKbF/rCA8N7iFoG57AsxnIdcfNCZ9QaarWNpG3yfNTk+ZjF8xGDO6bBAk9IM+uJeN6XkbwvonlfxFOu6BzL+ZunXX81ZzwInCAPT/TC5JvAmQqcxzk4D7E8Y+ErgyNDaVwjJB5aG8O7Yz6Gp8mdebHAGWuTwH2vD+XNwWwgru2wXry518aquIF8cGXzcg5s/NR+XLcyjr94/n2kp7MwIovG6/YwVCyaR6FcnmbTAWWx8w7UE2DRxA3f21BWXS1VzEYuVBy92cKYW2KzJPSCtREbAR+lrdBcLFzMnqeg3DkvoDGZIWdf10cIFwD36tdrUBlB18767gmo4PvNYj/mCohC9/f3K/j+O1Cx8u7H3JhW66BihD69TIQfJ6SPFrJ2N8JKT1QwFhrxO1koN/27tGhSjK0A/oaeb/qrXwQtW14F8H/X+N13ShwzEB5z1oByLV9sG5RXAPzbGr/7JagkZJ3zcJ5JAL/S89S+EnPx7+By5vlq+3oA5bEQNkd4DRq7hfmmlAi10Bbfi6ku/Arn8cU6xqDr8ikoD4V7Q67xAz2nT4AgaoQExDoYSmaW3DkbnOFSMtNyfHDihmODE1/O5r27zJZInKyxiLJ3XwkEQqQANmUazLIMlm+3zWRrxJhM2GamJ26eAHDoyHDWSGY8k0WQb7GNiysS1nBv3E7GLO60RrjTHjVzLZYB22RwfInJfGCmvCCSdkR02vHjY1m/I+UFG6WDVcKXwbWrEvlN7ZEVE05wa9oVLWk3aM36si3tBd15T8QgpATnKxhnoRmWOQNgcIykHAhI3BIxsK3VBJcWLuUCgAEGbXcWFMZgMWDNpSn/hmkfuze0mId6YkZ6U6spMp68YhUIKbF2Yy+iJsOPXz4K6QfA4hEQU3qz9BsoS8PZblAcwG6oODXH9CK0WYv4X0LFJktU2gz6/IaLLJwnEJ7NMapFoEaMonaEJ34JoMS7fA3lvgZgsILP3QJl7VeMSaikEs1AQFkdnIAK6N+KK71E1kOJbG9AufvOjEk3rgWHVBPOy4Ryyd8V0o9cvbEvl62a67aTIW1+sy7j3BKfyrK6PbwSddnagN+J6PqKhWyW8w3cII7r+ew2KCF59sY5BmWBeC9U9uYAFFcLUC6Ff92EctO6TYKQPrYW1cdcazYf11EXa6DiB8+HgCigLLSeAXC9nmtn0wrgU1Bu/a/qObCaXVSuxBxhQIWqaG/AtVh6jkiEzBEulIXxQlKuLnobXBfxkLpwcKU7byPGWCFObGIe65NDCYQnUFxAzEM95BmgOZqod2FI1LoyGEouuXOO2xY+ODey5ZVjF76ec8VDPGYXEQ/LJ6co9r/ljzUyOUmRN8v5Mla1tWW1frGmZB+1XXsD2qmycgUAwRmTlsnfFhIfCCljEZNNrG+PnLi2J3Fic2f0/B0b2kYlIP/xb/qQTOaBiIFASLiBRN4XSqTjgMEDSAnYAYMTSGS8wM96ws/5IuMEYtwT8ryQOAoJSC/Ao9s68Xv7evDOpcz/c3rS6To14Ww8N5XffHIyf53rozcSNSEkHgyEXCs/SQIEBjA++9q4ZWAyH+Cl/iTu3tCBAz0RjF8M4AUge4lFc1diU3GTdfkSB5xAHs4HMp0P5q7NkxlgcjqrYmwuvliWfQC+o0WfAyG9604oN6njqN0NqhxHoFxM60VCZQgOi5eTgBJFow34rdVQ7rI8RJz5WP9bLf8HKrNw+zcA/ijk96/XQslbUO5CzeAYlCXiDbgy6QuDsjx8HHPja17Ubd0M99FWvRFZEbJZ2a/Prb1E35FaZFpTYqZdC2XJdghLOytkBkoodUM2sVt0H6+XBFRM1fYQEWRQCyGN4i0Afw7gfwnpCxZUVuZpLQrQ5rR5It6YngfdkDG5FvWHAygk4JKzxrFcgLpox/xbe72gx+o/QXGRvg0qQYavX9XMWVk9Zzsh42gDrrQwr5WIniM6Q+blIYSHzJjv+bLZdRGrsi5Suo2COsaY0Nc3GTJPM92vG923eYn7rKOvKYbmPHAkrpatGlVB7bj+0ljjSilhGhwx20RbzIKQaJ1O51uZaRoGrzXbcpEYgBULVLOPh8RBLPfdquMKlvgSq/G6P/mnweWyJp0vq7RRAF9IIBAAZ8mIbRxqjVhTd25se8oL5Bu/OT3h+0J6DEiDIQPA4WBNMWRlgI7diUCLGNMAzmQc8fY13TH7i9s7Y8fG8m+9fSlz31DW2wlXZsGwjZvGKsaubCcGBiElcr7EB8MpbOsWeGhtDG+NuBjP+DAscmdeaDhn25PZ4HPvjDje5zdGP+yOcDh+MEcktA0AQmAqlQVcD2iJKnf6xUEawMtQyVL2oHhW430AvgAlyi12G/CCgDhcZj3RifrdaE2EZ4FOQVmo5Wu8hkp4H+rp/TVFzqMXStg7huYJiBehLJf2YW7W6PV607p+1vuXoCwT0004nyhU7MXekI3KowDuKdFmM1NmJRAee9uEEiPfhkrMslTJQT1AKLVAbJlRJ/WMfTukPgsC4mgDr2scKjTDF6EE7GKb3nuhXPCfpTtZ00WXPpQWadvq/I3dAFbq9sxrEWT0KqrjIX0P/xKU9fXscWZBJVu5CBUflFU5R5xBac+DRlitcT1HGCHz8oUy9/T5nC/9JtcFq7IuMvo+JOsYY1koL5DTUIKdnDE/A+rh3O1Q1rWNXq81Yi1EECUX6kSNbOxpXRLnaZkcE6k8+ken8fHFyRvPDCW/CM73MwaTrK6IT3YcEhBCAkEwBoOnulvs1Nr2aN9w2n1rPOt9EDFZemtn7GMnkCMAEOjwh4GQ8IWEEwj1eLrBtyZfKAtGN1C/E0jpCAnHD+RkV8zEzWsScHzZ995I9kODsy271sT9QMh7T0+6D7leYANsLUxuGp8YqjJICVycdmEyjj22ga2tBgzGMJILwHSYRWJhYAytni+vP5/y5a/P509LyZ5rtdmklFf2rSxcIBbHI/dch8NHzmBkLAluLxo3ZgEVS+m/QWXEeyBERLhNb0A2N+k8Gvlk29WiRB7FLQ1tqLg751CbhWCBFbo+io3CJJS4Vkv5lcb5fQ9KjNsWcm6PA3gRjbXumkk/VCD0x0M2LHtmbQSk3oz2NWlj0AklEPaEbMpWNrCv3qPrfikLiIEe00NQmauLsV73pbE62iwKZbHZETL/nNXn0cjrOgHg21AC4u6QvnKv/rub7mZN7WOXoB6mhrEJKpt7rW7sN0BZlGb13F9I6nARyhr1w2Vex76+F3wbyiJ9U5HP9ECFKelF5XGGC+OzMEfsD/nMGihL5RHUbs1bsHjuKnGvWWgLxJl1sTfkM2t1XRQLrVIptq6LzhJ1MThrjF3Q57WmxjGWhwqdclDf38SM+3ahjVvReAGR1XmcIMpCAmIdbFvVviTOsyVm42j/GD8zPJU43Ddyfz7nfMGM2JvnWqPVao04682GJ/6o0pqw4vMPO8dFVi6rox4qv9f4JmeOZRtTNue/doU43x23L9y3uev5g4NTZ4anHQgpkfECuNqddMHvQAzwAolkPkDGE5m8L9+OcPb2pza1YSIfDF5MT56P21aLL+S9boD9AaQl1dc4Y7ACznEp6yF3YRrXrWnHtnYTk65AIOjh3II3rcmYwXDjL85mv5j25MBjG2Nve4HETE9mmfERibfgG5+/G5m8i6Hzw4tJQCzwEpT11h0obi3UChUcPr5EmuYSlIC3Q1/PTBJQLrbvo77sftfoOismfk5BZfzNNvEaB6Cs4L5YZOOVgBJ9t0MlD2mGm+ak3rimUT72k9SbqpNojnhoQIm516G4G1+j16N7dN0yLG0riSyUG/r1IcLCNigL0xfr+I1uLfJ0hWzKz6LxSXUcAD+Aild5TZE5AFAPTD6P+YlXdzWT1fPsjpC5cgeU5dxrNS4KdwD4bJF94jCA/w3LX0AE1AOr7+o5fy2KW1lfC/VAoL2GsXQMygKtmDXKFqjwJ8/XcZ/p0HN3T8i9ox+NfchQKzk9X95aoi7243LSuVrr4voSdXEWcx8KZnQb7Qy5/5UbYwKl3YQ7sTgTsRBERQs2okaWis4QCAHG0BK1jD22yVmeseniGlLIG/XE7Sv54SpFsJIiW4ly2QKUW7Hbdg31UPK3ZonBZdyrAyEhVRbl/pVtkedvWtf+5oNbu9555Vxy8s3z064nxJSQS2cfp5JBAykn+KA9YvT9zt5uPp4LXn+qb/qhSxl/v+MGDIx1GSbbbzAGXwBTToCz42msaI9jT5eFk0kfWTeAQVlVFgzOAAnIbD5YmQ9EV7vNkPYAJ5Cf9GYJBpMBMgggRTMTGdfN+3rhe3eRxXEhYPpS6WxDUDEV1xYRLmJ6oV2PcMCgYh6FubqmoGL9NVNAzOg26y8hzuzWdTDQpHOY1mWXi/0UQImNp5t0Hqv1BnQ++mfBxXmTbvulHEOvkOnyDhTP5LpRX2c919gLZYFYbAMagRKVm5EgIYBKHHELlIBpFPntXoS7qhONwYF6iLFX96fZbNbv1yIgRnX/LLZHPIXmWV8vRlL6/r0bxS3kEvreV21/F1AJuU5BCVuzWQclnNUTDqAH6mGFEbL/P43GP2Sodeleqi7Wz1NdzHbn9vT7I00YY4CyQl9FUxmxFCEBsQ6MJeLn2Baz4fhBa99w8h7XF3dx01hBrXe1ogw7AiEhnSBlJcyT69tjfYPJ/POcsbdWt9inr1/Tlj0zmYcbTKnPLTE7kEBKuIHM2gbL7u6J4VLaH4mb6bNCYtPadrs1YRk3n512Wz1PcAAJD7x3MOWCMY4V7Qxr4hyXGJBxBTgnW/+F7a5s58mk98WnB/KT61qM9+Mmy88MPWt6AQxHIuvJxbxdPQbgz6AsFYo9XV9KT6DP6c3Uw0WOxbWosAcqEUYtk9OdWnAp1pqTUMJes7NGCijx7gUoF6NiC/z7obIeN0tATEG5PW1F+ezG70El4mkGG1FcJAKUW2O1Qq42AkdrSJlcbxR3QQlgLpYmHpR14QMIFxDvAvBT3a+rZa3ug8WsnvJQ1jyn0Lzs7q/islWQUWQck1VN88npOequEHFjK5SA/TP92Uqx9Dy+tcgxXwsqA1dRPUsAv4ayuN0bct+qpb8HUDEW70e4aHYPgJ+gtjiFK/X8U+whmKPnh5NNnCOqwQfwCpQrb1hd3K3ny1rqYlUFdfFxkbrI6La/o8QYuxXAX6I2i/mb9f2VIJYcJCDWQSbvLerzY0zFDBsKZOzkxcl9/ZeSD4Abd5uWYdWc+CP0gw12WWZLvdw6ZKda3aArOP9ASpeD5WMWd1oT9gsbumK/6opbh0Yz7jEnEMj5ApM5DzkvWNJxABlTFsJTToCUGwSekCcCIU9s7YjYPXFzvH/ayyRsg5sGuzbty8dyvpSDKdeSkHZXWxwCHAOBhJDykx0vMf/NyC226ty0/+mfOpnhz2yID65vNQYznoTU7WIaEoZhIOOJxezwOA3gOSjBaQ2a7wraTKb0dZzTGxRz1npinV6ov47yiSRmYkBZB/wOlNBajIOYv+QMWQBPAbgJcwVEpjc5NwL4BZrT89JQ7u83o7SAmIMSD5tlEXQNlJg3e4N8GsqFcbTKG17BVHgnlNDcUeQzm3UfGsTSFRB9vSE9CuUGGplVR616U/qA3qBWkw0zBuAxAI/o+pzdNheg3Iyb6Zo4BOA3UAl99qG4KzPRXBxcTvh0d5F+0A71QOZeLc5UmvRpG4Cv6bl8NnmoB2JDV1ldn9f9/UtaSGrE3lnoe+QHutzorDmiEC7jQQBPonS8y9lEAXwKKoalETJ+f6Dv44uBQN9TytXFA1BJSWqpi8+i+IPJUnXhQMX7/ECPI3PWebXr87oJyhrYr/CcuF5X3IvisTUJYtFDAmIdnB6aWtyNazAEgcThsyMH3j499A1umbcBzCyvPJVwqa1aYKvQFboh5VbpXl2y3AbGGCznrlyrK3SV7tUSgHSD/sDkb6/riPf/wc3rnoia/OMfHh3Ke0KqrLbLHF9IL++LtwIpP7hrbUs8bhkP/6p/ugtCOllPbLyY8XdHzDw6oxF4CQPDWRXzkbyZFwZd7R4DjKjJumIGu+AEUrqBTvqjV2J5xwMcV60zF2f0tDyUJcF6LRwsZYahxK0NIZvMh6HiCf2rKgSgDqiMlo8gPOD7K1AJNuaDLC4LpcW6pamvP4rqrHuq+f2DKC8MjqJ8NtZ62Akl6M2+OzwB4E+q3MgVbkNMb5x+H8WTC62Hssr44TKYwt7TIs91mJvEZzWAP4QSSt+qYkq8ASrG4PYQcWBQt894k6/tIoC/0Jvoa+huFSoSNbPsFC4L+b1F+sNm3ccuQIV+KIcFZVH1hZB5eFT31dGrsC1PA/g+gP8O5UNLVDoXAkqcehfqgdTsh4vdM+aIl6soex9UEq6dIfv8IT1HDC+yfl2qLnoB/IHuy7XURVhc5UJdjJQo4yMoq9ti4nFhjP1/oITmSmgF8E0UT0RFEEsCEhDr2RF6/qI9NymBeMQEZ+CnhpLrhoantpvxSLzULr38sTCRqoa4iHXE7avpXCs+sXIfa3KimCaU6/tiAsCFWNQIbtnR86OIwZ+7lHYnNnTEzkQM9kk25asBCUghkQWQ7Ywa41HT+DWAc9f2RuMB2L2nJp32gWR+3dp2hlXxCByLYVwAQkrKzLxAcIYuN5APvD3s8PNp48/Wt5gndnVaaLEYfMnAGcO3HtiHt9stvHSkD77rg5uLTg13oFwad0C5QbVg6cYIm4Zy2dkCZakym5UAvqqv+Ycon1Blky7nGyguSGahnu6/hObGPpy9QUpDWZANQ1kBzp6Yt0IFwH8LlVv3VEohk+9gic9MQbmKjzTh+m0ogXQ75iYOcKDE1VN1lP8SLluUzKYFyjW2B0vf0ukgVCb2HZgrIMahHib8jwD+M1RogFK06Pr6G7iclGk2Z6GslU7Nw7WNQ7kUFmLwkRXiXKJQmdMliifgqGY+yuvX7Pdf1/eWr4f0mfsA/CMA/wXqIUwYnVCJo34fxa2eU1Cx3vqxtOOT1kpBMN+HcMu+WjgMlahlO+aKZjEod/J/oP9+pkxZcd3evwPl/hwp8plzeo44Xkc7RnR/8Woc9xyXBXCvirq4tca6uLvOungRyhL/Hxc51gWVCO+SnuvLhRNZD+ArAH5X32MJYklCAmI9d/RFrLpwzpDOe7HJdH5fKufdBMYoI95VhJRwJJBhgNWesF+zDPaCL2T2/q1dz0QNfv67713CRM5Dq22A4ep00XUCiQBikAGDu7ujhi8xcWrSyWZ8PDae89ZxhliPZScAYMyhPrVQMM5aPYmbjo86xmDGfL8zagxsbDFzq+OGTHsSgMTdd29FV8LGK0fPQniLUkAEgAkoF9y79OJ+qboyS6gn8k/o61hd5DM79Ka1FcCPobJZZqAsEg39aoWyXLodwG+jeIwhQMVp+vdQrnPzzdsA3oSy+JrNZr2RPInGC4gFzui6a8NcwXlQ96dmuEJE9WZttqBbcM09X2f547re/JB16BooF+fTRUSTpcSIHicPA3gIc7OtR/RmskUfO6Pbs2DVauj3O7SQ8BUol8ZiuFAu9U/M07X5uh88BWVheR3drYrOEd/Sc2YtQkvBnj4NZZn1QZHPHIcScm+EehgzW6hs0fNri+5v56AeArkzhJZVUIL+76N4nD9AWTD+CNVbHS8XPChh/ldQYtKOBpU7PmOO+AyUu+7sffrj+n4Zh3JZn9ZzhNRzREzPETdBuQA/GvJbgT7/n6I+EXi97teuvldUi6F//wmohx6V1oW1QHVxTn/u0yiefb5Hj5041EPTMT1mC2PMnjGPf1bX3bYZ6ymJy+E9KH4ssSQgAbEOprKLV1WIR0ycHppa+/JHg9/KON7nzKi15pPlyJV/XP67zvh6zYrbV7c1YejHG+Be3axyq3IHL7bDl2eFxGEI2XHDmrZfd8XNv36xbzI5mfPybbZZS+0tT3FK/5sPpPCEPMgYO76hzTqR9uRtJ5POrut6+a1W1IpmBIPjCwQCZIm4MO2Uh8nG4hZbYTLs9IT8KB/IvKsf4kxngXQ2X9l8s7D06QXyDVjasRABJax9G8AfoXhymHYAfxcqTtohKOuCi3oj2wEV3++WGZuBMN7RIsVC3HCPQFkYFhMQV+h2jDfx909r4eAezBUQR/SxZmzoLShhuL3IZvdNKDG8HgK9cRxD8SQ1hhZE3tebxKVMEsCfQrng3R7ymfv1WPgIyqLslN5UtkJZ49wGZfFaarPerzfEZ+f5+g5CJfMgAXEuewD86zrLEHre/HcoLiB6ug1+DCUUrg8p51Hd/97Uc+olPQ73QoUU2BIyjxfO4U2oWL7uVd6mr+jxuKOBZWagLERX6rYoxp1QsXePQ4XyKDyAacVla/hryqwrBgE8re8r9bATwL8E6g4RfqLIfFVtXbwO9VCrUBfbdPs0ui7OAfgegL+Ny+LfTLqg3Nu/qtcMhTEGfY/br+eD9bPWDB5UIi0PSjAlYx9iSUACYj139UWcnjaiLHDapzP5GIA2M2Kac+KC1Rpfr+x36yi3FvWnWFlVi36LvNwKf9QXABxvoL0j+k5P3H7h7ESuP2qyM60R84Lqs4s518SCIqVaGI8HEk8d6I29ZxvswPHxfNSy5NjmuD1xOoXf8SUDGNXgAmBxxnZPZwN5esqbjhrxo202hxMEYIzB4oDwA+RTWSAQQCyCRZo+fALKVfEBqKfsrUu4Tc5DPW1vgYrns3LWca6PbYMS266HclmyoSxh1mCuhcHsjfH3oGLt5RboGqegRLpTepNmzLq+7fq6LkJZHDSaI1ocuKfIsRG9cWrGhp7pDemaWe8noeJP1Zu0ReoyCuLo7HEQ0fW6DktfQMxo0aEQo+6WYks2/boTyoqsINDaemO6ssxvvK0FpoOoPJB/o7gAlQjmPqiYXhG6XV2+b6E+1+VPtht6Lg0bSxegXD83o7grM6DE56i+7+zR/VLouXltmf77X3X5eWpSnIVKqHInlOjaiPbN4fIDOVOXHTZH3A5lrT+u28+GEp1Wl/mN9wD8ByjBrd45woSyiq+XaAPqYoOeL8WM+XJVmd89DOCPq6yLUQB/pdczxQRErtcziVljDPq9FSF1Ng7gz/S53wv14IwgFj0kINaBF4hFd04FKen8eHrL8GTmbss21/iFVLLEsiUQMgnATUTM5JqexE/WtUfeznnBR/2T+TNOIODqvkrGcxWs5Hw5cU2HPbGp3R5481IuagVecn+b5Wc8tu5iDjc6Am2UVGXeMRjD2pwrOk5NeZPvjrofegJHGUNeSAlkfJixOHbt2YqBgWHkHAfMWJSeIBLKTfG7ekF511KedqAsAP5Eb6K+XGIT01blhqMfwKt6w/PhAl9nnz6XHsxNLNABJQZ/2KTzHISy3kzjSsuENJTlRDNiQlpaiDiAuQLvEJR1RbIBvzMC5YK9C3MFRFu/v3kZzF0FF9SfQQmINlRA/1jIEm49wq3IZpPW/e4/6c3tQiB0H/02VDxHSqjS+Pqd6Q4Z9plTUDH61kBZFYYlo4qHCCBh8/DTeh7uo6YAoASn1wH8OYD/Ho1JqAIosemvC+sdqFiLYQ/Y1lbxu1koy+ZvQz2QW2x1WaouCgnL9paoi3UoHjs5rNyPoCzCq62LACqRyl9BCZQ3I1yorHSMJaG8K/6Lvr5WkIBILBFIQKyDVG7xWfIb2r/y3TMjN/dfSn6N28YNBuf8k6Vp3clJwg40QFFhZcqt9RwXolxWbyVU5QLuM8neFlIMrmyxL/zhLeu/O5l3B358dFiQclxDCzAgH0ikXJE2OL4rJLuWM+y4tpX9i0DKfzSQwWOkxC4QFo/nffnA90+l+oeyseQNvZFTOV9CZnzEurrwO7/1EP7yZy/gyKHjMFsTi/UqAr0puxVLW0AscEYvyH2oZCir6yxvECpJy39G6SQi80UaSjS7LWRTvl+LJs0SOs9BWRjNFBBPoHkxIbuhrD4SIefSqDYZh3LzmoCy5LliKQMlsC8HAXFmP/prKCHoD1B/NvasFjL+A5RF1EIyCRUf7yGQgLiQPANlNf33AHwKc0MQVMMYlIX5v0XzM3ovNS7qunkYjRMQC2P6KSjr+z+EsuqtBwfKKvnfQ4U3WEpk9TkX6uLeOsvLz6iLp+oo5yU9l/8eVNKh3jrKegHAd/R9FVj4h6UEUTEkINZBKr9IBETtlhq1TLTFLNPgrDuQIi78ANwOMcNZ7LEFq4oB2Ixya8gsHfrh5rmA+27gAfLdHWva3sx54jVInI1HjP6szyVJh40YWQhcIfviJk8e6ImmNrQF/98XLrn9pyb9W8DYdYbFDNJo5w/OwFyB1sHpYEtqhexotZQbsy8B2zIRj9oIPA/I5oDLAmIpJXElymdDDvt+PS48AVQco3dR/IlzXC9MywXeN1FasJuPOIsCStD6NpQlUiFhRLVC4ltQblav6oX+QA3rmWbURRJK8P0mlFXcTCyoYO33Afh5yPcjIb/dVeHvT0NZ/+yZ8d4gKsu0yxEeY7IFyqpytgveVi0+zN4YTUJZb3gN6jculAiaLHEnvBPK0uMDhMfAbEO4i+8Kfe21PvIpNcZ7qyxXaiHmaS1APKQ3xTehusD5F6Bc/F6Dcl3+ENUnROho8BiRUELwc1Cu55tCfrMT858kgEEJad0l2jFWRx/paPZtT89rLRXeV94B8H9CxQ/9PIq7zJeiX9+XnoZyvR9tUF101VEHrSXm9m49h5Vqv+6Q87Hr6O8F1/1dISJSt+531c4RST2ORvQa4R7dhtW4Sg/rOeJ1fS99H9W7LbfPw9iMVlAXz+rreVjXxc011MUber48CBUWpB4XbqHr84/1OHkYKsvzyirKeEf3naf1mqfgzlh4MLhL33u6apwvDYTHUuzW45TMIIi6IAGxDvZt6F0U58EYwBnD8FQGFyczsZzj355zg1uYbbSh/iC3xCJDAr6UcgiAuaoz9v6W7tj3V7dGPj4xmv1g2vHdnBfACyQ1eoMIJHK2wS5saLMQt/jTwzlxqsUy7j455f9O1gluNSxOMZ/mcSco1T+7+1L+pz4Yd8diJus3OJP5jAshJVZuWIeRsRQmplN6fmQflRB3zqJ8fL3jId8/WOflHIKyHvoU5oqUDlSQ9OEyZSSh3KF7Qo6fmaem8XU9HdcL4GNQQebX681V/HLzfbIpzuvzT+vzfBUqNtHHNZ5Dubqo1QXP05vFH0CJaLO7pFXmnC9AuT3N3qy+UOHvT0BZuwzN2Kj+rMLryes6/SHmxqbLAziKudZFab3BmZz1nSNQ8TtntmO9TEFZrqVKjL1yAv9BqBhSxcSLk7ptahU93ykxdxxBbZlMx3XbfwgljN4MFUuzR28aIzPK5frvlK6rEb3hfENfd61PsV9B8fir9SZg+bUWBYpZVme0qJHF/FJwOY2EXPNRPZZqzUr7apPFloLwfKTCzzu6j/Tr151QLp49WlQwZ4xhrvtQWvexi3q+OKjrrJF18Wqd98rvhIgib+v6KdV+T2Nutvp0BffXUrhQFsUcKpnWbFKoPd7gJFSs2Q+1WHWrniN6df0WmyPS+h44rr9TEA9rjR/8Bur3JihHfxV18ZG+rltqqIuCeNioGJ7ujHXOMf0b10G5NLfqOdCEEgZnj7Fz+j76NOYmIzsGJUzera/rVVQfW1nq33kRxYXWlC7XA0HUAQmIdfDp6zYtivMwOINtGvjV4T68evxS7/mx6QfdQHzeNI2VzUtOUoOFXtlya3CvvuJ4mKVfvVJaBZaa9biAs6rKlQAuGIz9xgtEcPOG9he+smf1j1/tn0AyPwWDkWzYDNFKSCDvS4zlBTpsfvqO1ZGLP+3P4eDFIKYXjwbV1PzAGSLSZLvfG3W+NpYLJu9aE/1uq8kzjlDr9F03XwcejeGFp1+CEAKmaT4L9RS7Vl6oQuyphmEA39evWrkIlRVwMfGefgHKNfUmvYHluPyk3dLXf0yLFiMN+N1m18Wf6le1HINy7a6VcSjx8gc1fDelN7l/XcV3PkDxbK/N4tv6Vau48mP9agY/0a9mMAIl7P5Qb4Rv0BvjTlwWBk0tAPRBiakDDdr4/Vf9ajR9UMlc/t0imo8cqHhnzYr/9h39WmxMzpg3WqHiyO2BsmQ09FxsQAlrZ/XrHOpLytSsuviZftXKv2nCOckZAlKzGJ8xB7XoOeJaKMu0mXNEHkqM+0jPEY1wj/sL/VosjM2Y6+e7Lkrxhn61Q8U93ApljRiDEjOrGWMXoUK3/Oc6++UoVGzqP6EdA9EsSECsg0K8wcVwHgZnsEyjzTDY3ULiMUjZe4UCcuUfqDjGXkXCWE1x+8ocq+FcK5aDipVVhRt00ePzU67vBoN2xHxnfUfszIWp/KtS4oRpMDBG2ZXnAwmVfV0C2S9tSfyyJ2KIX/Zl/hCc3WRYjFEjzA8MAAJp5oWMRTnriZos6zhS5gOJCDiyXgAxnQGiNmBbSgEmFoKzeiMbK9KEDpTA5VA1EVc5U1Au/B9CWaqKGeMkgLLaS4Fu80RtpKAsC09rQWPmot3T/StD/WtRU7AMP15kjhC6DaevkjZcjHUxhcvWzBE9ziSNMWK5QgJiHfhi4bMwSwkwZsC2DCQzzvpkMnsf42wjl5waaDn1tUAAgRxa3R3/5fr22DO+kJcupdi7biCk4wsISX7q8wED4EuVZGVXuznC1sZ+PpIP+IfjXjbrilsNi0WpluapLTjryPvyjo8mvemuKP/5iqgxuqXNRNwOYG/qgXXvdXj7aB/yUxmYrTFati3QLQpKQJykqiCIK/F++Pdn/m8W8+/eS1w95NE4F05iYaA5YnHXhYvmWzwSxKKABMQ6WAT6IRgDfCHYVNYxTw8lD4yMTO822mM+56x421aRoGPO3w1K/FFVuaWv/sq/WZmTqfj8F0G57JPNtw9AmgYfiUaNJ+/e3PWTzrj92utnJ11fCBINF2LM6ddILkBnhE19ZWviR67I4MORfEyAXc8uxxgimgg32MqUJx95eyjf2hM3Tz2yPvbK7i47iJnA/p71uHP7KrhegEPvnkAgJBi59xMEQRAEQRAEQdQMCYh1kPf8BT+HmG3i4mQm8uLR8/ve6x/7PCLWTgYYNcbXq+BYneVW9IPNcK9e5OXO+RCDlDIIhHwDUrrXr+848tX9q78dABeODqXoCdcigAHwBBBIpG9bZb8kpOw8MuoKcHaLwUlAnCeiYOxm08DDFmenJTAoJWTO8QAJ/HdfvBvt8SieefotoC0OM2Irs22CIAiCIAiCIAiiKkhArINggeNqSSkRs014vjBe/Oj8/sHhqQM8YsapZZY+vhfkYPCjq9oib03lvCOdMeuDm9a3nzw1nkXOC6iCFsscIAFfSHRHed/2TuuplCft8xk/8H15nWGwBNVQc+EAJENrJiduG8kFL8QMdt42GFJuAIMzbF3bgc/dfx1E4OOV904hPz4FxCIwojYY5yQmEgRBEARBEARBVAgJiHUgF3TzycAYw3TONS9OZDZMZpwbEARtYZ7L+ivhb5RK/FHDuYX+XasbdMlzbEa5dbptV5K5ucjHJQAppBOxjXd7WiJ/vaEj2n96TL6Y9YKJyZwHxxfg5Iq5aCi0RMqVaDXZ2eu6I896QjpDGd8QwHUMoJiIzax/PfRTuWDTqWnvzsGMf7QnaowGEoHrC5wdTmPt6m586wv3YDTj4OzpC2CxCNKZLEQQKBGRIAiCIAiCIAiCKAsJiHWQX0BLMMYYopaB109eXPHLQ32P5t3gUVhWtz5aPm5f5b9Ugdtu6a9XXm4VbtCsxJv1uFezcm+yiqut/PG5ImgQSCDnntizvfcnN63v+MWx4fS044tpGm2LG+3O7Agpj1/TbrUBWDmY8gPG2W2cwaAaajI2X3Mh7X/+OyfSo3etjv5kc6s5lPMlJIChfAZCCNx778146AEDQyOT+NEvnoc3lYHZ3kJWiARBEARBEARBEBVAAmIdLJQFopSAaTC0x2xcGE/1HD0zfANMc61h8jJCRYUWh1ULgqxImZV+N+xYhXEFy5Vb8sNViqusCfWpEVKelp4UbQl7+r6dK/5k37r2Z91ADADKTZZYAvOBGpqZmMnfXxEzTCeQ0XFH8EDIvQZnrVRDzYNzWBlPbPxg3N29p9t+dgdnQ1NCIB9I+E4Ag3O0d3ciHovCSsTx4IO34c03PsB43yBgW3MnWNuEGYuosUvjjyAIgiAIgiAIggTEehALJCByxuD5AR8YTyUuTGRuCNzgWm6aPlk6LT2khA+Gcdvg7ziuf74tYvR/84a137dMw/nl8RFISel8l1R7AnACORE32ftrE2aHL/2xaSdgUmIfY6CYiE3iE9tjia2j2eDWC9lgFJATHTaHzRkEJCA9yIyHrgjHFx64AW0m8CZ8GPEo2IxRZpoMyXQel8amwTkDJzdngiAIgiAIgiAIEhDrYaFcmGO2ifF0PvLM+/23vtM38mVE7T2cM6vc7rr8cVZsS46aymVlYgDOc2zB8sfCYio2t9xAihHO+EudcSs5LvCSL+RrU47vtkiAk3K4ZPEFxiXw/LqEaV6EPDSelx5nuJOpvB9EEzA4a5XAXa9cyCXOpDznjpXRH+5bZ2Njm4GsJ6+Ymhhz8K07tuMrN26aY+Hc2xHFE6+fwP/1nWchDAYej5KbM0EQBEEQBEEQVz0kINbBQuwppQRitgXLdOXHlyY3TY6ntxgx29Zb4xn/NDheYTPLLfl3pWWhgliNi6tc3/GH4wn7jU1d8Rd9IU+NpN0jAFJSktfkkp8bgADAuMnwSk/UyHIm+LgjeCCx32Agd+bmwBkQzTuifcIR3QZj3XGTJVstHvDZI0pKtLfHYVmtcwZbPAo8cMN2uJ7AL145ioHBMfCYTbVLEARBEARBEMRVDQmIdRCI+Zd5DM4wnMzGT1yY2DeVdW8BZAcZqi25fiOllOPdbdGntvQmnupOWB+dT+aPL0R/IpqIBDwpB+MmC0xuRH2J0WlXGEJiN2doowpqDsxkBpPYeSnr3+EE8iUOTPtFnvb4roec6815P5mWWNfTgr/9mRtx8PgA+k+cJwGRIAiCIAiCIIirHhIQ68Bx/Xn/zUTUwrtnhjb98lDfV6dz7mM8Yq9oTHKS6hN/hH+hykQltbpC1+wGPR/lhteBFGISzPj1vdt6frKyNfLq0aHprE/i4bLFExhmwPOrYkYUwMHJfOCBsTtB7sxNgRvsmslc0PrakCM/vzF+NGLwaUBUPKUZnMHxJNLZPBzPL5/EiSAIgiAIgiAI4iqABMQlggTAGENbzEbeDWLDY9NrmG21c6MQ4b/OuH2hH2ywy3Kt8RYrKreGcw09XoHbdjXtJ+EIyMNwg44da9oPPXrtin/XEbPOXJp2UtS7lz0CwKjB8Hx31MhwoHXcCRjAbjAY4lQ9DceQwNq0Kz7zs/7s8Vwgf7KhxRgRUjVERTfGfB6+H+DxT90K07Tw9psfAi0xmBGb4iESBEEQBEEQBHFVQgJiHXhCzNtvccYQBAE7Nji+6uzo1B1gbBsYowy9S4BAyIzB2ccJy3wn7QQj69pjr31298rDHw2lcXI0TRV0FSABCInzUc5YV8SwAymHUp60hZTXcsbaqYYaCzMYOLDpxcHcQzZnh7++LT6SDyQ8UdkjACEDcMZw/e4NkIwhnXNwamAYbiYLWBYM0wDjjIKVEgRBEARBEARx1UACYh3k59GFOWIZSOVc+4l3++49OjD2dcO2rmcVpemt0LW4aovCYq7QrMLvhh2r0L26nnIbYE1Y/hznuEF/GLWMN7sT9lg67/8o5wenJrIe3ECAk3vkVYUn5IDB8JvVcTPGssGrk07ggOGu+jsjMRNtli18V6xLe+IaCbzNGZMGq0zxK4zLCyMpbFm/En/76w/hP37/1zh94hzMuL5tknhIEARBEARBEMRVBAmISwApJSKWASEsPp1zW4Oc12rGI/poje7KrNj/hLntVlguC/ufJpdb0QWX+1iDM00zwA8k4AZH1vW2vrW6LfrseNb5GFL2U4++6hkD8PSKmJE0OdpHcwEDYzcZDFGqmobCYbAdH066X//zj9Opfd2R57oiLO0EVSh/Eoi4DILZuP2uG3HTzQcwmUrj+effgjc6DkSjYZO2esAQjcC0THJ7JgiCIAiCIAhiyUMCYh2IedoUmpxjKJltO3Upeed0zr2LGbyban8RwwDfCTxuGUe2r+344ebuxNu+EB+NZZ0JsloipHomcCFqsre7mcF9iYlpV9iBkDsNzig7cwPhJmsdzwQ3vOrlb14TNw+1mkZ62pXwhKxY05O5PDjnWL1hLRItcUxOJDE6Po2p8QkYkUjx3zU4gkDgbN8gvOk0zARpwwRBEARBEARBLG1IQKwDL5ifGIgRy8DHlyY3PfHO2S/7gfgMt82OOR8qaTlXxjqvrGVdDeVWZAHZINfiZmSarthtu+iHA5Pjo03d8b/4/N6Vv5jM+Wc/uDBN2iFxBW4gz1sc+bUJIwbATzqBB+BWAAbIpbkh6GkmMBjrdgOxzQ34CGdw4mY18WPVJ6XrID3hwGIMDz9wExgLj4Fo2xYcx8WTT76Ek0dOQkhK5kwQBEEQBEEQxNKGBMQlQCJqweTcdl3PBOPMNHmNWZBRTdy+xpVb066/hnNkC1uulEAgASaCM5/atfI7D2xf8ZO064/mp13qxERRpMQ4GJ5eGzdSFkf3SCbgYOwmg8Oi2mkMnLNuN5CPPj+Yb13bYuYO9Nhv3bEqgu6IgXxQvazPGGAYhp7zin+fMw4hItj3jbvw4944fvbEW0AiCjMWIXdmgiAIgiAIgiCWJCQg1oEQzd0Ics4QCIn3z45tPzY4/hg428cYI2FhERIIed4yuGMyNurkg+9v7E78fP+a9kuv9Y/D9QVVEFEUCQhIjMRM9tbquJm3ORu5lA1YEMh9hsESVEP1wxjsAFg/kvK3ucA1e7utk11RY2pN3BAZX9bXemFHZABmMqxY1QX/vuuQy/s4ePwcJpNpcJumcIIgCIIgCIIglh4kINZBMA8CohDSePX4hTtODox+0YhY+1io5Vy9yUnCDjTA746VKbfWc5xTLqv8tMuWW9m5SiBgwJRl8DdjttHHgZOOw76fdQN/Ku99kkuBIErhBPJim8WneztsT8JNj2SCIJC4mTHYVDsNmYJcmMyJMFyT8+V1biDfdIXMOUEz53CJgZEstq/rwR9983784//4C4xfHCcBkSAIgiAIgiCIJQkJiIsUCcAyDJiGkWBMcgjhl0pijCuONcCduJ4YgLXGFmRlzrWqciuOV1ilRnplWUEgkuB4dU1bdMQ02KvJnPsWIH3qwUS1+BIZKeXBm3ojYycsL3pi1InC5NcbHJxqp24sztmB8UwQPzrhjX9tG3uz1ebI+UFTBX4p1SMfz/WQzuQB11XzEbkxEwRBEARBEASxxCABsQ6a6cJsGRxDyUznx5cmPzU6nXuEmeYaqvHFhZ/3JuItkVc3dcWfZIwNZFz/PQlMUM0QNc0nKjHwVIvFPzzQbedbTDZ5aMx1A1feZNgUuqBOGGNo8aXcdz7tP/5Ef/bMbasir3bafMoXaGqCo6SfRzYvcP9dByAl0Hd6EEjEYFomCYkEQRAEQRAEQSwZSECsg0A0L7Zd3DZxaTKz5rmjAw9ByE8Zltk6az9cwxY67H+Kue1W8VOlLB9rLbfUuZYrt6YKqdy9WkpIzjDV0Rr59faVbU+s64wdOjueOTURUKxDon6mPeFtazWPb2mzJj2J/KlxV2aFvJFzFiFv+DqxuJkP5G0/Op35fC6QAw+ujR7JeBLNHLky64Mzhgfu2g9umvhJKotk1oHwA3CDjEsJgiAIgiAIglgakIBYB83YzBfsUWyTI2IaCYNzLxAizyBbi7sKhwlfrPaTr7XcioTGGs+3mtao1b266PEry5USCHyRtaLWi186sO67PS2RN96/MOX4QoLEHaJR80ral4iZGP3taxI/etLmePlsplVEjH2kN9WHAUBIBHkvWCmk7Gq1OdwggGjSfK7mdOXGPDGZwXW7NqMlFsF3fvQcJi+Og3e2khUiQRAEQRAEQRBLAhIQ68BpgsWZwRgkJN4+PXTTsXNjvw3gLs55y5VJQ0JUh9BjZSztmlFuXbvxZiWKqaLcWW8JKX0h8VHcNpgPHGTAd1e0Rt7rjFnZQEqQBEA0kkACDAg6Inz6s5viT7ab8J84l/v9IC9uM6IGadX1zS624OyGQ6Pu1yKcZdclzHcjJhN+k5NiSemjJRFDy8qVuPP+2/DBOx9h8PxFMMsEo0xLBEEQBEEQBEEsckhArAOv0QKiBJjJAQbjg3Nj+/v7Rx8y22I7GKfN5UIipMxzzk4nLPO5uG1eTEnvZQF5KOsFiFkGWR4SDYcBEJAYywns7rKH1yVa/yLpAx+NON5kIG9iDHGqpRrrlsHkJltzdtJ7OOWK049tjJ9qj/DJrCchIJUZeJMG9VAuDdMwsPv6fRidmMbAx30Ai4EbBjjN8wRBEARBEARBLGLIIa7OymvkizGAMWYYnK2IR0wG25woLi2wMu7AZZSJsEzInxyrMXNz6A8WO8caXaFLnaOqwAaVe7miRCBPxSzz5Y2d8YG4bTzhBfII9X5iXuYYBozmA0Q48//p9e1/9dDm+B+LQB6WAFm91jMrKZHQNQxEbYOtsTkzTQ5wxsAZwMGa8jKYuuVmcznk8w4QCMAPIKQEyAqRIAiCIAiCIIhFDFkg1kHeCxpanmVyXJrMdJy4MPHFCxOZz3HL2Kp2u6V2wmXeZA0UA2t1WWaVljtP7tWVlMsYfD8A3ODjdStaX9jYHX8q74m+jOv3AaBsKcS8EUjA4JCr4mau1WbPg4HHTZbLB7LDD9BtcGyhWqoeztnqKUd+9qWL+fiKGP/2tR3W2b1dNmzO4Dc5LqFhSHTctA13buxANBrBk68excl3TgLxCBCPwIxYgCCJmCAIgiAIgiCIxQMJiHXgNtKFWQIRy+DJrLv6yNmRGyBxmxm1WinA/sLgu77PLeOjTWtafrRnddsrEZN/cGo0kwpoU0/MMwxKS0p7Ao4vp8Dwswhnrs3ZziyTN+YDmWBAD2cwqLaqqFeOtrwvbzw17qbHW4zXtndYI5tazUzCZMgHzY6HKLHt2rWIXbcJEUuFw4gGAmZrDKfPj2JqYhpmLEKNRBAEQRAEQRDEooEExDo39o0sTEi0cc42RKJWznH9acjZmZcrSChSzQ/OKYtVfnGlLB/rca/GApRb7EN+cHZ9T8uPvnXT+r9IO/75IxemSTkkFgcSIpD4ZXeET7VYsv1CJsgJiQcBrKbKqXIWZEhJk01FDbYdEpecQH5gMAgnaP5wd3MuUjkXAHDH/q2497prwA2Of/v95/Dyyx8AJCASBEEQBEEQBLGIIAGxDnKO16BNLANnDKeHkrv7hpJfE1LeZhi8q8JvX7EbLvp+ibfCj1UYr7BZ5Vatj9bhqq0/Hgg5LIFjpsGij1+/7qf3bF/5UwYMJLMu2YESiw0RSLzXafN0T8Q4cDzpxXL54B7D5r1UNdXMvYgz4JaJtB89l/bPt1nsvYjB4As5T5mRVdIW27YQsdXt+G9+9lZ0xyP42XPvAo4P2MYVHwdnYPEoDMMAWagTBEEQBEEQBDFfkIBYB+l8fQKihITJOSKWybmB2IXx9Jbh4am9Zkt0G2MclCZh/vADMR4xjSMRi7+U88XA9Ru7nn1wx4rh35wYRs4VlGmZWHR4Uk5bnB9anTCTcYsNn0p6qeFM8Flw9BiU0bciGGABWJP3ZOJk0rv42rDz8ZZW85TFWT6Q8xjq1HUh08oace3aHtx+x36cmczCdz0Y1uXbtGFwOK6HgcER5DI5MJO81gmCIAiCIAiCmB9IQKyDWKS+6lOxzSSEEFEPbJdp8JWwrWkAAQCjruQkLOx/mpicpCa35xLnWOpLtV77XBdwCSBjcP5qV8L+MGEbpwan8r+cynm5iawLSo5KLFYYAFdI5Hx55tZVkXNrE0b+Z2dzhh+IRwD06I9xqqkKsHn7SE488p2TmcFPr4t+d0+X1Z/2F+YBzoWzSTAjgq998b45x+KxCEZGk/juD3+N9MQUTDNGbUcQBEEQBEEQxLxAAmIdPLhvY83f5YwhYho41DeMV44Nssl0/sbxjPO4YfJdczf9yyW2YI0uy6xMWaz2cn3Hz4Hz12/c1P1C1DJeG0hmz0vIHPVuYimR8aS/v9t+e3ObPfaTvjQ/M+bulSZPc45bGM3zFczHgBeI2FBWrpYMiVabIxcEC3c+BmCbXE9gl4XMqGXCMhicXB5wXKAlTm7MBEEQBEEQBEHMC7SxrIOtqzrq2LAyxCMmzgwnY1M598bBifQXIeTNZsS0yHO5uQgpHSkxyBjsjStaD+5Y2fZnK1sjJ4dTzmmfsiwTS5CsJ9ETNVJ7u833nxvM/ikYu7EjwrckXZGAlDsMzshUrQRMvaJS4JajE+7nIgbLtpjsLGcMYsEEurkCpu1IpFyJ7ft2whdAcnQCRjwKxjkJiQRBEARBEARBNBUSEOvZtNeRRIUzZVmS9/zVkPLTUcu8M+8Hl8XDqt2BK0ym0rDkJHUkVgk9xya6V+t/pITPOTtjMP6s4wbBjes7n/vCgbVPv3ZmHFP5NMU6JJYknAFOIDHpCDiBfJWZrG9VnH+eMySnPZEXAjcwBotqqkQdchYHsP+dobwczYlLd62KDhicBb6Qi+eZTiYPbpg4cMfNkIaJd19+CwKAFGKekr4QBEEQBEEQBHG1QgJifRvOmr4nJWAaHO3xCKYybu/w8NQ1gW0ygxc8l8vG7bvicOWUF9gq/vrsA7W6QYceb457deD4/bGWyKGNnfEzZ8czr7hCnvUDASkliYfEskFIOWxy9vN7V0dXHZt0gxPDTjsifCclV6mk8ljAgGjcZCsZZ8NpVwbeIrJMZr7EVDqLDTu2QRoG3nruDSCbgdneSlaIBEEQBEEQBEE0DRIQ6yCdc2urdINjKuObR/pH1x4+O/IZxxc3GjYMMiBpHr4bAEKcu2Ztx4/XdSaencp7I4yxj3whsagsjAiiEUj4DLjUEeHDD66L5Te2msPvjrq/PZ4PVgCIGpytpUoqDjOwetIRDx0ec3OtNvv5hhZzemubMg5fDPqchDqReG8bru26FptjwMuvf4CLZ4eAiAVEbZiWSWIiQRAEQRAEQRANhQTEOqhFQJQAWiIWRqay0b967eTtHw2OPcZi9vor3M8qEhJZkQ9XaaFYqxt0s8qtx227+N9SSuQYQ5CIWec7W+yfPrJr1U8Mzo88e3IYgSCrQ2L5IiUw7ghxx+r48bvWRPsGMsn8VF5cY5pssyvkQ5DoZIyyNM+Gc7Ym6YhPvzOcj6xIGCe2tJqH9nbZvpAS/mLS5KQHM2bjts/cDC4FfpNzYCTimM7kkM874IZBjUkQBEEQBEEQRMMgAbGujWb1e28pJWK2hYhlGsmcs8rP+wkjZuujFcQYrFi4C3NRXkLlli2g9McCKfPSx+vMwOi91/a+8a1bNv54MutNvX52nDovcVXAAHhCIutJ1xXyZysSxrWdEf7QR+NuDFLebVi8k8xvi1ZcxGDsbttgj3CGS56QA0JKBIusrgI/wPhUDndcdw1u3LkRhmXiv/70JXzw1kfgvZ3qgQ1ZIhIEQRAEQRAE0QBIQKyDTL66JCoMgGVyHBkY7X3n9PDD4+n8Z2Hw1aysyBYWA5CV+d48l1s0VmMNYmDoRyuzZJQAgpybQ8R6Y8+69idH086Rtph1cs/q9pH3B5NwfUGdl7hqEBIIJKSUmJLA++tazPTmNuvNjybcfH/Su0NylmQM2zhDlGpLwRkYgNapTHBL0pHPt9l8IOsLOIHEogo1ISVkEGBlZwtisQgYgK89cgvaLROvHP4YcD3AMqsuE6YBMxohAZIgCIIgCIIgiE8gAbEOqsnCLAFwMLQaNo6cG9v0zOGzjzGD32HYpk012bC9tCuBjGEAXR3xNzb0tvxo58q2d98dmDyWcnxMZl24gdAZsAniKpyzfOm0mOyj+9fFPsoHMnJ2wj0fj3DuBjLwJa41GCJUS588kpCpvNh+asq76/SUdyJu8knGZCDkYmxXF8i4kBLYs3MDfG6ibyIDJ5+HaVd3izEMjlzOwWRyGkBtlvYEQRAEQRAEQSw/SECsg6o2VlKCM4aIZYAxtMhARBjnLuOwP9my1pwFGSUs8ppYbo278qrPscLzD6Q8B7C3I4wHv3Xjhh/tW9f58qunR92M61OsQ4LQQyWQQMYTyPviBVj81MYW8+HBtN+ScgIOk++lWpox+9l844mk9+X/ciI9ds/q6M/WJPh43l+cFnmFs7p0bgqeGcWXv/gApJSo1mSyNRHDsRNn8bNfvAj4Hng8RlaIBEEQBEEQBEGQgFgPqSqSqJgGg+MG/OCZodsO9Y18gxn8JsZZJHSbX9QdeJYSUEolKHugAZLanHOsIhFMKRflku7Vc7/lCwlkvQudPfE3VrfFnrkwlevriNvHVrVGMwzKhZMgiMtI9cpD4pTJIO5aHT04mg8uHhp1o0LILDjrMRiu+kzNjMPMuWL16Slv0x2rIvGowcdTXoC8r+IhLkZjZil9WIaBREcbGBiqzTFv2xY2bFmPhx+5Cy+/egjOpVGY3W3kzkwQBEEQBEEQVzkkINZBrkIXZgkgHrGQcfzEa8cv3DI8MvWAmYispxqsD1/IaQY4iag1tao78bMtvS0vAzgyNJ0fTDk+Mq4PCZD1IUGETk4SnpBn9nbbZ8adIHNo1E3FLNYqwW7Ie6KFcdbOr+IBpJ9lRAIp95xL+fdZnD0VNTC2Mm7A5lh0SVVmzZC1dQnXw9buBHY9dAN67ACvvvw+ziczYAaHYXJQ0h2CIAiCIAiCuDohAbEOKo2lp+MfcsbYatPkNjjPzVG2ak5OUuXuvqTlX5kTqsrqsbKEJ3WUK8BwUAo5sLo1OviHd2/9XtoJBp48ckEISaIhQVRD1pfIePIEGM6sTph3SQn77JSAlLgXDK1Xc90YBusMJB569ny248SUNfHw2ugv71wVxaq4gay/PNU0NX+6uOWLN+Ga7gT+2Xd+Den7gEEhewmCIAiCIAjiaoUExDqYzlfmwhwxDZwdmd744fmxb02knU8ZlrHusqjWxLiCn/xTrxv0PJXLyhfg65SykYhx8Pp1XU8nc96bgRAjbVGrLxDkrkwQdSAAOI4v371pRWTwnjXR9a9dyk+dnvR2AYgzg117lVojMgAx35NGPpAdtsG6IgabihgsWK7zTcHt2WAG7t6/Bf/0bzyMHzz3Hvr6h2HEKc8OQRAEQRAEQVyNkIBYB6ViIEoJcM5gGRwRyzAuJtMbT50duRER6wbTMgyqverwhZQQcrQlbmcCX3wAxn6yvbf13YvTuZOnxtLIugHcQIASLBNEfWR9mVzXYiZvWRk5cWLSzY1E+bXtEb51NCced3yxA4yxq1BIDJjJ2jxf3Ho+7Y8IKV82GYJgmccEnJjOYW13At+4fx+effdjnMnkABIQCYIgCIIgCOKqhATEOrDNcB2Q4ZNQUcwLxAqT8zWIWhnGWApSdpRUukomESn3PSydciuCSQDgjF0wLP7MmvZYf9b1nx9LO29lXR+OL8hdmSAaCGeAE0gkHYGUJ1/b3GYd3ttl3fD0+RzLu/iSYWJrhTPDcsLgnO0dSwddb4+4ma9sFUfWA0PL3uKZMWQcgelMHowxsIhFA4QgCIIgCIIgrlJIQKyD23asDj0Ws02cHZ7Ca8cvygsTqVuGp7LfNDi7HmCJK+IX1pSt+PLmrvgHF7Dcin+0jMsyA3whPXjBe+DMP7Ch653bt/R8r288M3awf2KUeh9BzA+cIWtw9p6QuNAZNU60RvinBpLeegA3GBaLXlWVYbDVSSf4zPc+Tp+4f03sl5tbzVFXyGWdV8TMCviBwOOfvgOmFcFrL78HtMZgRmzKykwQBEEQBEEQVxEkINbBxt620GNtcRvTWTeScbyVZ4anrvFy7nYzZq8CY5TFMhQGKSUCKS8wKXlb3D6/tj3+wwvT2UvdLZHjt27u/mAi6yHvB1RVBDFPCAn4QqaFRNrk7OKGFvPkllZzzflM8JWz094tQkgLjK00+PK/nzCDcTfA9ufP5+7rsI3DG1rN0ZQnESzjxE1S+mCcYceWVfDvvx6O6+GDjwfgZnIwE1G6nxEEQRAEQRDEVQIJiHWQc/3QY5bB4fhBVyDkfVHL7PX8YPryLrTo1rRMtmVUma24inJr20rP/bucu3KZ85eAYIyNRgz2nOv4+e5EpP/+HSuffvHUyMnpvCeTOQ9eIMAZg6BdK0HMOylP5Ntt9ubXtrbg+Qu58YsZ/xQzWLsj5CMANuuPGVimehoHIABf+nJzyhM78oE8JgFvOftyM/3Qa3BkGuvW9OKbX74Pqb/8DU4d6yfxkCAIgiAIgiCuIkhArAOjRCaBjpYIfCGsExcndmfz7qOGwTfN2VNXLQgWiy3YgK1rqYzQNYmWKO0GPestCSAQEsg5aUTs13dv6DwyOJl90wvkOQmMS9qmEsSiQgLI+vLd3hjvu3d1rPedUcc+PubcCsZSMNh1BkNiuV47Y7AlZ/sPjjjfdAOZ3tdtP9ticc9b5gERpQQsJwcpGe556A7EWlrw/qFjYJYBzjkNCoIgCIIgCIJY5pCAWAeTGWfOe5wpN9yzI9MrX/7owqdSGecRAHtMgzZYsxESEK4vwNiZrvbY8N5tK15Z3RF/Ie14Q4PJ3DFfShkICUlxtghiUVBIDuUJCSeQ6bjJ0ts7rIFjk64Zs/gbmzustkvZQE7mgmsg4cNg6wy27OqAc4O1jqf9ve8DO69pt9+Km5hIexJusLzjIcp8ANPgWLV+LeInz0GmspAdCXDDoHiIBEEQBEEQBLHMIQGxDsamc3PeswwOKYFfHDy99/XjF75kWMbeTzZWbPZWfMa/czIZ17q9R5msyOW/3uxyhVIEc5Zh+HZr9GhbzHqyJxH56Bs3b3r9mpWtk//xxVPIOD46S2S5JghiYWEMCCSQ9gTSvny7LcrfvmNVdNsLF3I8lRdb41FmOAE+7Qm5ChKcMUSWzbWrCjAAbJzyxAGb420OZDoi/BORdTm3O3Ny6Iqa6FjVhZTnQwYBGFkhEgRBEARBEMSyhgTEeipvllWhlEDUMmByA44fdPh5t82MR8rHBgzfol7esRV7v8j/liqmdLmYl3J9IQHHy4OzFzp7Yx//1g0bn9uxsvXdnxw+nx/POJl1XhxSytqqjCCIBYFBWRR7Qg5kffkX61vNxF1rolveGMrL05PuDkjWAgO3Gnz5jGxusNXTjnj86XOZ9tUJc/z2lZEPbl4RRdzkcJe5OzNnEvvu34Ob1rXj//zzZ5EdTcLsaiMrRIIgCIIgCIJYxpCAWAcTqfwV/2+ZHEOTbuLsyPSd50anvwCDb728vb46N1ZSAoEfjEIiaUVMY21H9NTuNavfWNMRf/XE8NSllW3R07tXd/hPmheQ9wMVC5EgiCWJkHB9ifG4xcfXJYxRzjC1oc3q2dpubTiZ9KYupv1NCGQnTLaSc7akM60wBssTWJ3MBKsMg23jwGCHzSdabS7zwTKexyQgIdHeEkdiz2b84Zfuws9+cwhnz1wE72gBNzgJiQRBEARBEASxDCEBsQ7GU1e6MLfGLJweSq7+1aG+Tztu8IgRsbpmbDev/Lfm5CRh/8NqsBq8cjfcqHIlACGkC4a8xQ3ZkbCfd3151PEFW90ee/23btj4+oENXd6/+NURDE3lkMy5CITycSQIYmnDoCyNM77MZXz53s52C49ujLVPuWI058utEYNdk/bFI1lfdgZCxhhjEb5Ehz5nyAuTmYbEDWlfjvlSvuoJKb1g+Qtoo1MZ2JaBbz2yHxLAX/wsizHXh/ADJSISBEEQBEEQBLGsIAGxDmZnYbYtg0dMo5MpDS3PZu6ow7baRT/UgJiFzSq37N+AlBLSE2fBcSQSt/wHrl39RMYNXnnmo4tZxw+cjOP70zkPPomGBLGsYVAJVzK+TE274rl71kRfvnmFve7nZ7N974y6u+GJ66XJ9wnOsBRFRMYQNxi7bTzlt5+e9vpszl6OGgxOILHcZzbOGISQGJ3I47HbdqErHsG/+t5vkEulwdtbyAqRIAiCIAiCIJYZJCDWgRcIvZECGGN4v2/kwPGB8W8FEvdxztsvb6Fn7ahL7bZLvVlPLMSSP8YqL6TIR6QEgkAAjufCMD7s6U6M37y751e+kG+/0z8WtEatfts0RgufFVJC0OaSIK4KJAAhIQKJbEeEY03CmOLA1Gc2xlesTfAt7466d52Z9m9M5oK1EMjDwFaDs6Vyb+IAYgFju/um/S/+4Exm8PqeyJs9UT7lXgVWiBLqgVFXWwKrN63DVz53N37zwiEM9V+E0dUGxhgJiQRBEARBEASxTCABsQ68QAASMA0Gy2Tm8cGJ3afPjt5ntsf2cpMt27CHBRFQSpkGgx+xzKA9FpnoXNn2dixiviCFvHTP9pUHpcTEO+fGkMr7kKBNJEFczTAATiAx7UqkPTn45dXRwXvXRg57IvXKhUxwn22wa3pbDaQ9+ZlpV2yXUhoA2jhjiz6pErNYdCIf3PGj05nTHKzvtlX2VNK5eua80eEUohETD9x5AK4f4EXXxWgmDwkJbhjU+QmCIAiCIAhiGUACYp0bYijrQ5MztjJmmzZscxJAAAnj8oeu+Mblv9mcDxT/aPmzKP13TbER2ZUXOeN9CQkpJSDlQQg5GYkZqT3rOn/9zVs2v2lbfPg/Pn9SDKfyftzSVUBGKARBzJxFGJD2BCbyAjlfjmc88de9McP+/Mb4moOjrvfuqHMdJFrAcK8EEovdHZgDCCQCN5DdjKEzwjksHlw9DcoZZBBgfHIad9+8G4loBN/78XPwcy54wgA9PyIIgiAIgiCIpQ8JiHXg+gK2yTGeyiU+vjj52Pmx1Be5bezQ+8kiu+ay2+oK/q6gLFbijSrdoAMhIQMBeAEg5VHE7GBtZ2JgS2/L+7vXdLx1+NzE2PuDk27E4P29rdEp2+LgDBCCbA4JgiiNLEwzQGBy5NttnnED+Vc7O63nHlwbTfSl/Gc/mvBuHcz4O31HSEjsgMlibBHGTGSMtUgp73r5Um4q4wmxsdV8hzOG4Gp5eiLVf1qkiba1a3Dfp+7GwdcPYWpwCGZnm7q/0E2BIAiCIAiCIJYsJCDWgS8EYtzgmby38mj/2D7hBbeYcbtjqZrbSQkEUgAC44xzYRpcxi0j1xq1Jrpbox/FbOPVvtF0ELfNvr1rOw99Zv/6aceXONg/Bi8QyDg+PMEhJUC5UQiCqBQGQEggH8gg7Yn+7R1W/5e2xPH6kPv6xUzwxlie7d+4IiLBcPNINrgl7cmenC9sSMTA0MLYwguKnMECY+vPjnv3eQHe74rwDzhnbt4X8CVwtUyJw7k0YtEIdh3YhZzr4mggMDWdUg1sGjBNcmkmCIIgCIIgiKUICYj1bnqFbGMMW+IR009LOQ0pOy4fnfnJYn+Xf3vusWJu0I0plzHAAJ+QBp4VQM7g8LsSkYF967veenTf2vfXdSYm/8Uvj8j+sbTMuj4mMg6yrk9qIUEQDYMzFStxPC+Q8kQw7Yp3EyY79Ld3tcJi7Fc/PZu58ci4e1cuYN1gWM+BB8BgLKILyJuctQHYzIGzJmfu1SWZMUjfQybt4fqb9iIejeLZX70IKQMYBqcOThAEQRAEQRBLFBIQ68D1A/SPTG0/fXHyq14gbjcM3jtjD1Vuj4XwmIWszPfKHStd7iduyVICnsgA+BAxO76yPd63Y3X7W1t7W99648zI+OlLUz5jLGMZbCxum9lExILJGcUzJAhi3pCAZICMmwwWY0Oc4eVcII8/vC4WuWVlpOvouPvTY5Pe9efT/m5PyFbfky6kXAuDrVkIV2dusC3DueArzw7m490x/qfX9USGru+2ISERyKun0QAgGjOxaf8G7O/5FFrjEbzy3ik89/RBdbAlBjMWoQC5BEEQBEEQBLFEIAGxDoRE11Ayc83wyNQBMxHdzo2FF9dUdmSorMdSb+SkBDiDaZmXAKAlaqXaYvZYS9RKrWiLvu/54oP3BiZihsH6t65oO3rrlt7RM2MpnDw/ASklfCGR9wLkXB+BkGRwSBDEvFEInZcPJAIG+EKmnECmdnVZeGxDHBx4bSwndg1m/F0SaN3WZfktFr92KBfcP+WINTlPxCHAwNENBkC7OzdrGmMMbTlX7ulzvP50YOy8qTeS2dBipiQkPHF1tZ2UPlb1JrBn/S60twCxqI10Kgc7YqH/4jgG+ofAojYM0yAhkSAIgiAIgiAWOSQg1oEQYq9tGt2wrVEwlpUSkctbXnAUfIyrSngydzda/MMMYBCYFZbe4EwycAkGyRgkAwNTgfz7hMTzAERXItK/d333u9esbO1/YNfai1M5N/gff/A2UnkPOdfHVM6F6wtyTSYIYlHCGZDxJMbyAdKegCvkMU/IY4EEHl4XY1vbrFXPDOZeeHfUecDxsSoS4aYAHpRSdkuACflJoiuGsKRXdZ0gUgZjns3Yzb7AVD6QhyUkfHH1tZXr+Mg4PiamgI2ruvFP/uaj6GiL4gfPvIs/uzCGoBAAk243BEEQBEEQBLGoIQGxDi5MpHflvWB9NGKlAinfl4wZvh/4yLkMwO3gHGB8xva0SMxCVuIYUERAlEAgAc7B4vYJwzBGIWVUSsls08h0xCNDXS3Ri50Je6S7JTbWkYikNve0ZI8MTk78/FD/CAAJhhxjSDLGcryQfIBRgkyCIJY+jDHJGBtiwHTaFadvXBGJfGN7i9k/5f3lySl/Y3/K33Ex6+9I+7IlEFgDT2xTMiIDeGOsEzlDJ4AHRlN+51AuONIZ4cj5ElkpwK7SBzNSSpgGg2lwuE6Ah26+Fq0RC3/681eRHhwF4tHCBwHTgBGLgHFOlokEQRAEQRAEsUggAbEOprPuCT+QF03TeCvwfCYcj63sbvFvumkrYxIvTOfdtY4vDCGllhDLJD1hIe9JgDEGw+DCMnjQFrOCrBtkD/WPHp5OO5PcNCIAYDCWi0fMse6WyOjqjvjEuq6W5Kr2uLxuQzfyvoTUGzEpVRxEPxBw/ACuL1TmZGpSgiCWOL6Q8ISUgUTGC2RmTcLEA2tjeN/mx1wBa9qVm8acYKN0RKLV5iv2rIzd4AvZcSkb9E65YoUToN0NhIFAMoCtLtiSV+P6zAAbwCrHl7d8NOH2/+Z87ty6hHkmasLxr2o9TADwIYRET3sCe/Zux93D0xgZmgCP2gCAiG1hbHwKx0+cBRwPuCJrs1TtYFvgBrk9EwRBEARBEMR8QgJiPZVn8BcZwyfCnMi52Njbhn/yuRvBgJ+dHk5iMuManh8YsiAPVisgQocw5FxGLMNvj9ti64p2DE1l8f/6q7eQHM+A6w2WhBIGXV8g7wXIOD5SeQ8TGQcZx6MGIwji6oKp2Ilj+QBTrkDWl54n5CkhcUr4Et1tHF/dmvh21hOdL15ydn885e4dzogNlsEjrVHGhcR9vpTrAgkuJIxASlNKGHpatnClfflcbN7dN+195s9Opgcf3xT73tZ262LGI9ELAIZz0+CM4e47rwfnHAUb+JZEHCc+7sfYxBSy0xmYWlhUt0gGKSXyeRdBEFCYDYIgCIIgCIKYR0hArIOj/+53Sx6/c+daAAj0q+F8+eYtFX/2K7dswR9/67bQ479zxzVX/P8/fnRv0c99dv/6K/7/m7duwQ//zt1XvPdbN2z65O9/+fiB0N984NqVn/z9+f3rLv/G3rWh3/l7924veZ3/66d2XvH/X7/hyvO9a2sPfu/WTXO+97eKvAcAd2/prq+N9q2u+btfP7CmeB3cvnHOe797w9zP/u8Pbgst+589uPWTv7+2b+Wc45/b2YNvlzi3//r4taHHvrizpynj7fpVidBjf2NvD/7kkY2hx//ft62q6Tf/+e0rFtWcc9vKXnzvvsvJ3vf/+AJNxHUgJeBLCU/ISSHlYSlxwvVEZG9vhP+tXS3GZD74wcdJb9XFbLBmOCvWX8gGO6ddsYpx5IQvDyCQnQXrROhQEGAABwNjgMGAIEBr2hOrbIPFO20OgwmqeABSqvi8BpdgTHxiTSjyWazvbcfvfeV+BMGVLt9R20I6m8dPn3kTA2cvwiy4PRMEQRAEQRAE0XRIQCQIgiCuSiQAX6iwskIiK4GsCCQ6Ixw39dq4lAn63UAikGjN+egdzgfrpEQnAunu6LSv2dpubpt0RDTjyVjWF3FHyHjWl+1ZT3a6QiagjObSjpDr3x5xfvdcKvhFPpCHqOZLtImUME0DsWgnmHVlDETLtpH3ssgzC0ySEEsQBEEQBEEQ8wkJiARBEARRgAGukJhwBKZcgYwvkQ9kyhMyJSX6AAkZSOzstJ77zMZYy6kpv20oG3SO5oPupCs6R3NinS+Cja6Q3Sr6BBNSAodG3QOAexIACYgVkSmyYrEAJw+W82GYnKqIIAiCIAiCIOZzqyQpCDlBEARBEARBEARBEARBECHQI3yCIAiCIAiCIAiCIAiCIEIhAZEgCIIgCIIgCIIgCIIgiFBIQCQIgiAIgiAIgiAIgiAIIhQSEAmCIAiCIAiCIAiCIAiCCIUERIIgCIIgCIIgCIIgCIIgQiEBkSAIgiAIgiAIgiAIgiCIUEhAJAiCIAiCIAiCIAiCIAgiFBIQCYIgCIIgCIIgCIIgCIIIhQREgiAIgiAIgiAIgiAIgiBCIQGRIAiCIAiCIAiCIAiCIIhQSEAkCIIgCIIgCIIgCIIgCCIUEhAJgiAIgiAIgiAIgiAIggiFBESCIAiCIAiCIAiCIAiCIEIhAZEgCIIgCIIgCIIgCIIgiFBIQCQIgiAIgiAIgiAIgiAIIhQSEAmCIAiCIAiCIAiCIAiCCIUERIIgCIIgCIIgCIIgCIIgQiEBkSAIgiAIgiAIgiAIgiCIUEhAJAiCIAiCIAiCIAiCIAgiFBIQCYIgCIIgCIIgCIIgCIIIhQREgiAIgiAIgiAIgiAIgiBCIQGRIAiCIAiCIAiCIAiCIIhQSEAkCIIgCIIgCIIgCIIgCCIUEhAJgiAIgiAIgiAIgiAIggiFBESCIAiCIAiCIAiCIAiCIEIhAZEgCIIgCIIg/v/s2IEAAAAAgCB/6wk2KIwAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgCEQAAAABYAhEAAAAAWAIRAAAAAFgBAAD//wMA2zakNoQOY/IAAAAASUVORK5CYII=`

        
        const html = buildQuoteHTML({
            quote: quote.toJSON(),
            items: (quote.items || []).map(i => i.toJSON()),
            customer: (lead && lead.customer) ? lead.customer.toJSON() : null,
            logoBase64: logoBase64 // Pass the logo data to the function
        });

        const options = {
            format: 'A4',
            border: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' }
        };

        pdf.create(html, options).toBuffer(async (err, buffer) => {
            if (err) {
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
  try {
    const { leadId } = req.params;

    // It's good practice to validate the lead exists first
    const lead = await Lead.findByPk(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    // Your authorization check
    if (!(await canSeeLead(req, lead))) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // The corrected findAll call
    const quotes = await Quote.findAll({
      where: { leadId: lead.id },
    
      attributes: [
        'id',
        'quoteNumber',
        'status',
        'grandTotal',
        'quoteDate',
        'validityUntil',
        'createdAt',
        'leadId'
      ],
      include: [
        {
          model: QuoteItem,
          as: 'items',
          // **FIX**: Explicitly define attributes for the included 'QuoteItem' model
          attributes: ['id', 'product', 'quantity', 'unitCost', 'marginPercent', 'vatPercent']
        }
      ],
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, quotes });

  } catch (error) {
    // **IMPROVEMENT**: Add proper error handling
    console.error('Failed to fetch quotes:', error);
    res.status(500).json({ success: false, message: 'An internal server error occurred.' });
  }
});



// router.post('/:quoteId/clone',
//   authenticateToken,
//   [
//     // --- Validation Rules ---
//     body('salesmanId').isString().notEmpty().withMessage('Salesman ID is required.'),
//     body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
//     body('sharePercent').optional().isFloat({ min: 0, max: 100 }),
//     body('paymentTerms').optional().isString(),
//     body('termsAndConditions').optional().isString(),
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
//     }

//     const { quoteId: originalQuoteId } = req.params;
//     const { items, discountMode, discountValue, sharePercent, ...headerData } = req.body;
//     const isAdmin = req.subjectType === 'ADMIN';

//     let transaction;
//     try {
//       transaction = await sequelize.transaction();

//       // 1. Find the original quote by its primary key
//       const originalQuote = await Quote.findByPk(originalQuoteId, { transaction });

//       if (!originalQuote) {
//         await transaction.rollback();
//         return res.status(404).json({ success: false, message: 'Original quote to clone not found.' });
//       }

//       // 2. Expire the original quote
//       originalQuote.status = 'Expired';
//       await originalQuote.save({ transaction });
      
//       // 3. Backend Calculation Logic for the new quote
//       let quoteSubtotal = 0, quoteOverallTotalCost = 0, quoteVatAmount = 0;
      
//       const computedItems = items.map((it, index) => {
//         const quantity = Number(it.quantity || 0);
//         const unitCost = Number(it.unitCost || 0);
//         const marginPercent = Number(it.marginPercent || 0);
//         const vatPercent = Number(it.vatPercent || 0);
        
//         const unitPrice = unitCost * (1 + marginPercent / 100);
//         const itemTotalPrice = unitPrice * quantity; // This is the total price for the line item
//         const itemTotalCost = unitCost * quantity;    // This is the total cost for the line item

//         quoteSubtotal += itemTotalPrice; // Aggregate for the quote's subtotal
//         quoteOverallTotalCost += itemTotalCost; // Aggregate for the quote's total cost
//         quoteVatAmount += itemTotalPrice * (vatPercent / 100);
        
//         // ** THE FIX: Ensure both 'totalCost' and 'totalPrice' are included **
//         return { 
//           ...it, 
//           slNo: index + 1, 
//           unitPrice, 
//           totalPrice: itemTotalPrice, // Added 'totalPrice' field
//           totalCost: itemTotalCost   // 'totalCost' is also present
//         };
//       });

//       const discountAmount = discountMode === 'PERCENT' ? (quoteSubtotal * Number(discountValue || 0)) / 100 : Math.min(Number(discountValue || 0), quoteSubtotal);
//       const netAfterDiscount = quoteSubtotal - discountAmount;
//       const grandTotal = netAfterDiscount + quoteVatAmount;
//       const grossProfit = netAfterDiscount - quoteOverallTotalCost;
      
//       const requiresApproval = computedItems.some(item => Number(item.marginPercent) < 8);
//       const finalStatus = (requiresApproval && !isAdmin) ? 'PendingApproval' : 'Draft';

//       const salesman = await Member.findByPk(headerData.salesmanId, { transaction });
//       const uniqueQuoteNumber = await generateUniqueQuoteNumber(transaction);

//       // 4. Create the New (Cloned) Quote Record
//       const newQuote = await Quote.create({
//         ...headerData,
//         leadId: originalQuote.leadId,
//         quoteNumber: uniqueQuoteNumber,
//         status: finalStatus,
//         salesmanName: salesman ? salesman.name : 'N/A',
//         subtotal: quoteSubtotal,
//         totalCost: quoteOverallTotalCost,
//         discountAmount,
//         vatAmount: quoteVatAmount,
//         grandTotal,
//         grossProfit,
//         profitPercent: netAfterDiscount > 0 ? (grossProfit / netAfterDiscount) * 100 : 0,
//         sharePercent: sharePercent || 0,
//       }, { transaction });

//       // 5. Create new items for the cloned quote (this will now succeed)
//       await QuoteItem.bulkCreate(computedItems.map(ci => ({ ...ci, quoteId: newQuote.id })), { transaction });

//       // 6. Update ShareGp record if the lead is shared
//       if (sharePercent > 0) {
//         await ShareGp.update(
//           {
//             quoteId: newQuote.id,
//             profitPercentage: sharePercent,
//             profitAmount: (grossProfit * (sharePercent / 100)).toFixed(2),
//           },
//           {
//             where: { leadId: originalQuote.leadId },
//             transaction,
//           }
//         );
//       }
      
//       // 7. Commit the transaction
//       await transaction.commit();
      
//       res.status(201).json({
//         success: true,
//         message: 'Quote cloned successfully.',
//         newQuoteId: newQuote.id,
//       });

//     } catch (e) {
//       if (transaction) await transaction.rollback();
//       console.error('Clone Quote Error:', e);
//       res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
//     }
//   }
// );

router.post('/:quoteId/clone',
  authenticateToken,
  [
    // --- Validation Rules ---
    body('salesmanId').isString().notEmpty().withMessage('Salesman ID is required.'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
    body('sharePercent').optional().isFloat({ min: 0, max: 100 }),
    body('paymentTerms').optional().isString(),
    body('termsAndConditions').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { quoteId: originalQuoteId } = req.params;
    const { items, discountMode, discountValue, sharePercent, ...headerData } = req.body;
    const isAdmin = req.subjectType === 'ADMIN';

    let transaction;
    try {
      transaction = await sequelize.transaction();

      // 1. Find the original quote by its primary key
      const originalQuote = await Quote.findByPk(originalQuoteId, { transaction });

      if (!originalQuote) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'Original quote to clone not found.' });
      }

      // 2. Expire the original quote
      originalQuote.status = 'Expired';
      await originalQuote.save({ transaction });
      
      // 3. Backend Calculation Logic for the new quote
      let quoteSubtotal = 0, quoteOverallTotalCost = 0, quoteVatAmount = 0;
      
      const computedItems = items.map((it, index) => {
        const quantity = Number(it.quantity || 0);
        const unitCost = Number(it.unitCost || 0);
        const marginPercent = Number(it.marginPercent || 0);
        const vatPercent = Number(it.vatPercent || 0);
        
        const unitPrice = unitCost * (1 + marginPercent / 100);
        const itemTotalPrice = unitPrice * quantity; // This is the total price for the line item
        const itemTotalCost = unitCost * quantity;    // This is the total cost for the line item

        quoteSubtotal += itemTotalPrice; // Aggregate for the quote's subtotal
        quoteOverallTotalCost += itemTotalCost; // Aggregate for the quote's total cost
        quoteVatAmount += itemTotalPrice * (vatPercent / 100);
        
        // ** THE FIX: Ensure both 'totalCost' and 'totalPrice' are included **
        return { 
          ...it, 
          slNo: index + 1, 
          unitPrice, 
          totalPrice: itemTotalPrice, // Added 'totalPrice' field
          totalCost: itemTotalCost   // 'totalCost' is also present
        };
      });

      const discountAmount = discountMode === 'PERCENT' ? (quoteSubtotal * Number(discountValue || 0)) / 100 : Math.min(Number(discountValue || 0), quoteSubtotal);
      const netAfterDiscount = quoteSubtotal - discountAmount;
      const grandTotal = netAfterDiscount + quoteVatAmount;
      const grossProfit = netAfterDiscount - quoteOverallTotalCost;
      
      const requiresApproval = computedItems.some(item => Number(item.marginPercent) < 8);
      const finalStatus = (requiresApproval && !isAdmin) ? 'PendingApproval' : 'Draft';

      const salesman = await Member.findByPk(headerData.salesmanId, { transaction });
      const uniqueQuoteNumber = await generateUniqueQuoteNumber(transaction);

      // 4. Create the New (Cloned) Quote Record
      const newQuote = await Quote.create({
        ...headerData,
        leadId: originalQuote.leadId,
        quoteNumber: uniqueQuoteNumber,
        status: finalStatus,
        salesmanName: salesman ? salesman.name : 'N/A',
        subtotal: quoteSubtotal,
        totalCost: quoteOverallTotalCost,
        discountAmount,
        vatAmount: quoteVatAmount,
        grandTotal,
        grossProfit,
        profitPercent: netAfterDiscount > 0 ? (grossProfit / netAfterDiscount) * 100 : 0,
        sharePercent: sharePercent || 0,
      }, { transaction });

      // 5. Create new items for the cloned quote (this will now succeed)
      await QuoteItem.bulkCreate(computedItems.map(ci => ({ ...ci, quoteId: newQuote.id })), { transaction });

      // 6. Update ShareGp record if the lead is shared
      if (sharePercent > 0) {
        await ShareGp.update(
          {
            quoteId: newQuote.id,
            profitPercentage: sharePercent,
            profitAmount: (grossProfit * (sharePercent / 100)).toFixed(2),
          },
          {
            where: { leadId: originalQuote.leadId },
            transaction,
          }
        );
      }
      
      // 7. Commit the transaction
      await transaction.commit();
      
      res.status(201).json({
        success: true,
        message: 'Quote cloned successfully.',
        newQuoteId: newQuote.id,
      });

    } catch (e) {
      if (transaction) await transaction.rollback();
      console.error('Clone Quote Error:', e);
      res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
    }
  }
);



router.get('/:quoteId',
  authenticateToken,
  async (req, res) => {
    const { quoteId } = req.params;
    try {
      const quote = await Quote.findByPk(quoteId, {
        include: [{ model: QuoteItem, as: 'items' }]
      });

      if (!quote) {
        return res.status(404).json({ success: false, message: 'Quote not found' });
      }
      
      // Fetch associated shares separately to ensure we always get them
       const shares = await ShareGp.findAll({
        where: {
          leadId: quote.leadId,
          quoteId: quote.id // This is the crucial addition
        }
      });
      
      const quoteData = quote.toJSON();
      quoteData.shares = shares.map(s => s.toJSON());
      quoteData.isShared = quoteData.shares.length > 0;
      
      res.status(200).json({ success: true, quote: quoteData });

    } catch (error) {
      console.error('Error fetching quote for cloning:', error);
      res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
    }
  }
);
router.put('/:quoteId',
  authenticateToken,
  [
    // --- Validation for the incoming payload ---
    body('salesmanId').isString().notEmpty().withMessage('Salesman ID is required.'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required for the quote.'),
    body('customerName').trim().notEmpty().withMessage('Customer name is required.'),
    body('validityUntil').optional().isISO8601().withMessage('Invalid validity date format.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { quoteId } = req.params;
    const { items, discountMode, discountValue, sharePercent, ...headerData } = req.body;
    const isAdmin = req.subjectType === 'ADMIN';

    let transaction;
    try {
      transaction = await sequelize.transaction();

      // 1. Find the existing quote to update
      const quoteToUpdate = await Quote.findByPk(quoteId, { transaction });
      if (!quoteToUpdate) {
        await transaction.rollback();
        return res.status(404).json({ success: false, message: 'The quote you are trying to edit was not found.' });
      }

      // 2. Perform backend calculations with the new data
      let quoteSubtotal = 0, quoteOverallTotalCost = 0, quoteVatAmount = 0;
      
      const computedItems = items.map((it, index) => {
        const quantity = Number(it.quantity || 0);
        const unitCost = Number(it.unitCost || 0);
        const marginPercent = Number(it.marginPercent || 0);
        const vatPercent = Number(it.vatPercent || 0);
        
        const unitPrice = unitCost * (1 + marginPercent / 100);
        const itemTotalPrice = unitPrice * quantity;
        const itemTotalCost = unitCost * quantity;

        quoteSubtotal += itemTotalPrice;
        quoteOverallTotalCost += itemTotalCost;
        quoteVatAmount += itemTotalPrice * (vatPercent / 100);
        
        // ** THE FIX: Ensure all required fields are included **
        return { 
          ...it, 
          slNo: index + 1, 
          unitPrice, 
          totalPrice: itemTotalPrice,
          totalCost: itemTotalCost 
        };
      });

      const discountAmount = discountMode === 'PERCENT' ? (quoteSubtotal * Number(discountValue || 0)) / 100 : Math.min(Number(discountValue || 0), quoteSubtotal);
      const netAfterDiscount = quoteSubtotal - discountAmount;
      const grandTotal = netAfterDiscount + quoteVatAmount;
      const grossProfit = netAfterDiscount - quoteOverallTotalCost;

      const requiresApproval = computedItems.some(item => Number(item.marginPercent) < 8);
      const finalStatus = (requiresApproval && !isAdmin) ? 'PendingApproval' : quoteToUpdate.status;

      // 3. Update the main Quote record
      await quoteToUpdate.update({
        ...headerData,
        status: finalStatus,
        isApproved: !requiresApproval,
        subtotal: quoteSubtotal,
        totalCost: quoteOverallTotalCost,
        discountAmount,
        vatAmount: quoteVatAmount,
        grandTotal,
        grossProfit,
        profitPercent: netAfterDiscount > 0 ? (grossProfit / netAfterDiscount) * 100 : 0,
        sharePercent: sharePercent || 0,
      }, { transaction });

      // 4. Replace the old quote items with the new ones
      await QuoteItem.destroy({ where: { quoteId: quoteToUpdate.id }, transaction });
      await QuoteItem.bulkCreate(computedItems.map(ci => ({ ...ci, quoteId: quoteToUpdate.id })), { transaction });

      // 5. Update ShareGp record if the lead is shared
      if (sharePercent > 0) {
        await ShareGp.update(
          {
            profitPercentage: sharePercent,
            profitAmount: (grossProfit * (sharePercent / 100)).toFixed(2),
          },
          {
            where: { leadId: quoteToUpdate.leadId }, // Find by leadId
            transaction,
          }
        );
      }

      // 6. Commit the transaction
      await transaction.commit();

      res.status(200).json({
        success: true,
        message: 'Quote updated successfully.',
        quoteId: quoteToUpdate.id,
      });

    } catch (e) {
      if (transaction) await transaction.rollback();
      console.error('Update Quote Error:', e);
      res.status(500).json({ success: false, message: 'An unexpected server error occurred while updating the quote.' });
    }
  }
);



module.exports = router;

