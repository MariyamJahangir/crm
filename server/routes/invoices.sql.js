const express = require('express');
const { sequelize } = require('../config/database');
const { body, validationResult } = require('express-validator');

// Model Imports
const Invoice = require('../models/Invoices');
const InvoiceItem = require('../models/InvoiceItem');
const Quote = require('../models/Quote');
const QuoteItem = require('../models/QuoteItem');
const Lead = require('../models/Lead');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// --- Helper Functions ---

/**
 * Generates a unique, sequential invoice number.
 * @returns {Promise<string>} A new invoice number (e.g., "INV-00001").
 */
async function generateInvoiceNumber() {
  const lastInvoice = await Invoice.findOne({
    order: [['createdAt', 'DESC']],
    paranoid: false, // Include soft-deleted records to ensure uniqueness
  });

  if (lastInvoice && lastInvoice.invoiceNumber.includes('-')) {
    const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[1], 10);
    return `INV-${(lastNumber + 1).toString().padStart(5, '0')}`;
  }
  return 'INV-00001';
}

/**
 * Safely escapes a value to be injected into HTML.
 * @param {*} v The value to escape.
 * @returns {string} The escaped string.
 */
function esc(v) { return (v ?? '').toString(); }

/**
 * Builds the HTML content for an invoice preview.
 * @param {object} data - The invoice and its items.
 * @returns {string} The full HTML document for the invoice.
 */
function buildInvoiceHTML({ invoice, items }) {
  const inv = invoice || {};
  const it = Array.isArray(items) ? items : [];

  const title = `Invoice ${esc(inv.invoiceNumber)}`;
  const dateStr = inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '';
  const dueDateStr = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '';
  const quoteRefHtml = inv.quote ? `<div><b>From Quote:</b> ${esc(inv.quote.quoteNumber)}</div>` : '';

  const rows = it.map((row, idx) => {
    const qty = Number(row.quantity || 0);
    const rate = Number(row.itemRate || 0);
    const tax = Number(row.taxAmount || 0);
    const lineTotal = Number(row.lineTotal || 0);
    return `
      <tr>
        <td>${esc(row.slNo ?? idx + 1)}</td>
        <td>${esc(row.product)}</td>
        <td>${esc(row.description || '')}</td>
        <td style="text-align:right">${qty.toFixed(2)}</td>
        <td style="text-align:right">${rate.toFixed(2)}</td>
        <td style="text-align:right">${tax.toFixed(2)}</td>
        <td style="text-align:right">${lineTotal.toFixed(2)}</td>
      </tr>`;
  }).join('');

  const subtotal = Number(inv.subtotal || 0).toFixed(2);
  const discount = Number(inv.discountAmount || 0).toFixed(2);
  const vat = Number(inv.vatAmount || 0).toFixed(2);
  const grand = Number(inv.grandTotal || 0).toFixed(2);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" /><title>${title}</title>
  <style>
    body { margin:24px; font-family: Arial, sans-serif; font-size: 14px; }
    table { width:100%; border-collapse: collapse; }
    th, td { border:1px solid #ddd; padding:8px; }
    th { background:#f5f5f5; text-align:left; }
    .grid { display:flex; justify-content:space-between; gap:24px; margin-bottom: 24px; }
    .totals { display:flex; justify-content:flex-end; margin-top: 24px; }
    .totals table { width:auto; min-width: 300px; }
    .right { text-align:right; }
  </style>
</head>
<body>
  <h2>Invoice #${esc(inv.invoiceNumber)}</h2>
  <div class="grid">
    <div>
      <div><b>Billed To:</b> ${esc(inv.customerName)}</div>
      <div><b>Address:</b> ${esc(inv.address)}</div>
    </div>
    <div style="text-align: right;">
      <div><b>Invoice Date:</b> ${dateStr}</div>
      <div><b>Due Date:</b> ${dueDateStr}</div>
      ${quoteRefHtml}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Product</th><th>Description</th><th class="right">Qty</th>
        <th class="right">Rate</th><th class="right">Tax (5%)</th><th class="right">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <table>
      <tbody>
        <tr><td>Subtotal (Pre-tax)</td><td class="right">${subtotal}</td></tr>
        <tr><td>Discount</td><td class="right">${discount}</td></tr>
        <tr><td>Total Tax (VAT)</td><td class="right">${vat}</td></tr>
        <tr><td><b>Grand Total</b></td><td class="right"><b>${grand}</b></td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

// --- API Routes ---

/**
 * GET /api/invoices
 * Retrieves a list of all invoices.
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const invoices = await Invoice.findAll({
      order: [['invoiceDate', 'DESC']],
      include: [
        { model: InvoiceItem, as: 'items' },
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber'],
          required: false // This fixes the "not associated" error
        }
      ]
    });
    res.json({ success: true, invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
});

/**
 * POST /api/invoices/from-quote/:quoteId
 * Creates a new invoice from an existing, accepted quote.
 */
router.post('/from-quote/:quoteId', authenticateToken, async (req, res) => {
    const { quoteId } = req.params;
    const transaction = await sequelize.transaction();

    try {
        const quote = await Quote.findByPk(quoteId, {
            include: [{ model: QuoteItem, as: 'items' }, { model: Lead, as: 'lead' }],
            transaction
        });

        // --- Validations ---
        if (!quote) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Quote not found.' });
        }
        if (quote.status !== 'Accepted') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Only an "Accepted" quote can be converted to an invoice.' });
        }
        const existingInvoice = await Invoice.findOne({ where: { quoteId: quote.id }, transaction });
        if (existingInvoice) {
            await transaction.rollback();
            return res.status(409).json({ success: false, message: `This quote has already been converted to Invoice #${existingInvoice.invoiceNumber}.` });
        }

        // --- Server-Side Recalculation with Fixed 5% Tax ---

        const FIXED_TAX_PERCENT = 5;
        let calculatedSubtotal = 0;
        let calculatedVatAmount = 0;

        // First, prepare invoice item data and calculate totals
        const invoiceItemsData = quote.items.map((item, index) => {
            const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.itemRate) || 0) - (Number(item.lineDiscountAmount) || 0);
            const taxAmount = lineSubtotal * (FIXED_TAX_PERCENT / 100);

            // Aggregate totals for the main invoice record
            calculatedSubtotal += lineSubtotal;
            calculatedVatAmount += taxAmount;

            return {
                slNo: index + 1,
                product: item.product,
                description: item.description,
                quantity: item.quantity,
                itemRate: item.itemRate,
                taxPercent: FIXED_TAX_PERCENT, // Store the fixed 5% rate
                taxAmount: taxAmount.toFixed(2),
                lineTotal: (lineSubtotal + taxAmount).toFixed(2),
            };
        });
        
        const overallDiscountAmount = Number(quote.discountAmount) || 0;
        const calculatedGrandTotal = (calculatedSubtotal - overallDiscountAmount) + calculatedVatAmount;

        // --- Create Records in Database ---

        // Create the main Invoice record using the recalculated values
        const newInvoice = await Invoice.create({
            quoteId: quote.id,
            invoiceNumber: await generateInvoiceNumber(),
            invoiceDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            customerId: quote.lead?.customerId,
            customerName: quote.customerName,
            address: quote.address,
            // Use server-calculated values, not values from the quote
            subtotal: calculatedSubtotal.toFixed(2),
            discountAmount: overallDiscountAmount.toFixed(2),
            vatAmount: calculatedVatAmount.toFixed(2),
            grandTotal: calculatedGrandTotal.toFixed(2),
            status: 'Draft',
            createdById: req.subjectId,
        }, { transaction });

        // Add the new invoiceId to each item
        const finalInvoiceItems = invoiceItemsData.map(item => ({
            ...item,
            invoiceId: newInvoice.id,
        }));
        
        // Create the associated InvoiceItem records in bulk
        await InvoiceItem.bulkCreate(finalInvoiceItems, { transaction });
        
        // Update the original quote to link to this new invoice
        await quote.update({ invoiceId: newInvoice.id }, { transaction });

        // Commit the transaction if all operations succeed
        await transaction.commit();
        
        const fullInvoice = await Invoice.findByPk(newInvoice.id, { include: ['items', 'quote'] });
        res.status(201).json({ success: true, message: 'Quote successfully converted to invoice with 5% tax.', invoice: fullInvoice });

    } catch (error) {
        // If any error occurs, roll back the entire transaction
        await transaction.rollback();
        res.status(500).json({ success: false, message: 'Failed to convert quote to invoice: ' + error.message });
    }
});

/**
 * POST /api/invoices
 * Creates a new invoice manually.
 */
router.post('/', authenticateToken, [
    body('manualData.customerId').isUUID().withMessage('A valid customer must be selected.'),
    body('manualData.invoiceDate').isISO8601().withMessage('A valid invoice date is required.'),
    body('manualData.items').isArray({ min: 1 }).withMessage('Invoice must have at least one item.'),
    body('manualData.salesmanId').isUUID().withMessage('A valid salesman must be assigned.'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { manualData } = req.body;
    const transaction = await sequelize.transaction();

    try {
        if (!manualData) {
            throw new Error('Request must include `manualData`.');
        }

        const { items, ...invoiceData } = manualData;
        const TAX_PERCENT = 5;

        let calculatedSubtotal = 0;
        let calculatedVatAmount = 0;
        const invoiceItemsData = items.map((item, index) => {
            const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.itemRate) || 0);
            const taxAmount = lineSubtotal * (TAX_PERCENT / 100);
            calculatedSubtotal += lineSubtotal;
            calculatedVatAmount += taxAmount;
            return {
                ...item,
                slNo: index + 1,
                taxPercent: TAX_PERCENT,
                taxAmount: taxAmount.toFixed(2),
                lineTotal: (lineSubtotal + taxAmount).toFixed(2),
            };
        });
        
        const discountAmount = Number(invoiceData.discountAmount) || 0;
        const calculatedGrandTotal = (calculatedSubtotal - discountAmount) + calculatedVatAmount;

        const newInvoice = await Invoice.create({
            ...invoiceData,
            invoiceNumber: await generateInvoiceNumber(),
            subtotal: calculatedSubtotal.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            vatAmount: calculatedVatAmount.toFixed(2),
            grandTotal: calculatedGrandTotal.toFixed(2),
            status: 'Draft',
            createdById: manualData.salesmanId, 
        }, { transaction });
        
        const finalInvoiceItems = invoiceItemsData.map(item => ({ ...item, invoiceId: newInvoice.id }));
        await InvoiceItem.bulkCreate(finalInvoiceItems, { transaction });

        await transaction.commit();
        
        const fullInvoice = await Invoice.findByPk(newInvoice.id, { include: 'items' });
        res.status(201).json({ success: true, invoice: fullInvoice });

    } catch (error) {
        await transaction.rollback();
        res.status(500).json({ success: false, message: 'Failed to create invoice: ' + error.message });
    }
});

/**
 * PATCH /api/invoices/:id/status
 * Updates the status of a single invoice.
 */
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  const allowedStatuses = ['Draft', 'Sent', 'Paid', 'Cancelled', 'Overdue'];
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status provided.' });
  }

  try {
    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    if (invoice.status === 'Paid' || invoice.status === 'Cancelled') {
      return res.status(403).json({ 
        success: false, 
        message: `Cannot change status of a ${invoice.status} invoice.` 
      });
    }

    invoice.status = status;
    await invoice.save();

    res.json({ success: true, invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
});

/**
 * GET /api/invoices/:id/preview
 * Generates an HTML preview for a single invoice.
 */
router.get('/:id/preview', authenticateToken, async (req, res) => {
    try {
        const invoice = await Invoice.findByPk(req.params.id, { 
            include: [
                { model: InvoiceItem, as: 'items' },
                { model: Quote, as: 'quote', attributes: ['id', 'quoteNumber'], required: false }
            ] 
        });
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        const html = buildInvoiceHTML({ invoice: invoice.toJSON(), items: (invoice.items || []).map(i => i.toJSON()) });
        res.json({ success: true, html });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to generate preview: ' + e.message });
    }
});

module.exports = router;
