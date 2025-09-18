const express = require('express');
const { sequelize } = require('../config/database');
const { body, validationResult } = require('express-validator');
const pdf = require('html-pdf'); 
// Model Imports
const Invoice = require('../models/Invoices');
const InvoiceItem = require('../models/InvoiceItem');
const Quote = require('../models/Quote');
const QuoteItem = require('../models/QuoteItem');
const Lead = require('../models/Lead');
const { authenticateToken,isAdmin } = require('../middleware/auth');
const puppeteer = require('puppeteer');
const router = express.Router();
const  {  notifyAdminsOfSuccess  }= require('../utils/emailService')
const Member = require('../models/Member')
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
// A simple utility to escape HTML characters
function esc(str) {
    if (typeof str !== 'string') return '';
    return str.replace(`/[&<>"']/g`, match => {
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return match;
        }
    });
}

function buildInvoiceHTML({ invoice, items, creator }) {
    const inv = invoice || {};
    const it = Array.isArray(items) ? items : [];
    const salesPerson = creator?.name || 'N/A';

    const dateStr = inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-GB') : '';

    const rows = it.map((row, idx) => {
        const qty = Number(row.quantity || 0).toFixed(2);
        const rate = Number(row.itemRate || 0).toFixed(2);
        const taxableAmount = (Number(qty) * Number(rate)).toFixed(2);
        const taxAmount = Number(row.taxAmount || 0).toFixed(2);
        const lineTotal = Number(row.lineTotal || 0).toFixed(2);
        return `
            <tr>
                <td>${idx + 1}</td>
                <td class="item-desc">
                    <strong>${esc(row.product)}</strong><br>
                    <span class="text-muted">${esc(row.description || '')}</span>
                </td>
                <td class="text-right">${qty}</td>
                <td class="text-right">${rate}</td>
                <td class="text-right">${taxableAmount}</td>
                
                <td class="text-right">${taxAmount}</td>
                <td class="text-right">${lineTotal}</td>
            </tr>`;
    }).join('');

    const subtotal = Number(inv.subtotal || 0).toFixed(2);
    const discount = Number(inv.discountAmount || 0).toFixed(2);
    const vat = Number(inv.vatAmount || 0).toFixed(2);
    const grand = Number(inv.grandTotal || 0).toFixed(2);
    const quoteNumberDisplay = esc(inv.quote?.quoteNumber || 'N/A');

    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Invoice ${esc(inv.invoiceNumber)}</title>
    <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #333; margin: 0; }
        .container { padding: 30px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
        .header .company-details { font-size: 11px; line-height: 1.5; }
        .header .invoice-title { text-align: right; }
        .invoice-title h1 { font-size: 24px; color: #A9A9A9; margin: 0; font-weight: bold; }
        .bill-to { margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; word-break: break-word; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .text-right { text-align: right; }
        .item-desc .text-muted { color: #6c757d; }
        .totals-section { display: flex; justify-content: flex-end; margin-top: 20px; }
        .totals-table { width: 40%; }
        .totals-table td { border: none; padding: 4px 8px; }
        .totals-table tr td:first-child { font-weight: bold; }
        .footer-section { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-start; font-size: 9px; page-break-inside: avoid; }
        .footer-section > div { width: 48%; }
        .pre-wrap { white-space: pre-wrap; } /* This style is key for preserving line breaks */
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="company-details">
                <strong>ARTIFLEX INFORMATION TECHNOLOGY LLC</strong><br>
                Dubai, United Arab Emirates<br>
                TRN: 104342158300003<br>
                +971558086462<br>
                accounts@artiflexit.com<br>
                https://artiflexit.com
            </div>
            <div class="invoice-title">
                <h1>PROFORMA INVOICE</h1>
                <p>
                    <strong>Quote#:</strong> ${quoteNumberDisplay}<br>
                    <strong>INVOICE#:</strong> ${esc(inv.invoiceNumber || 'N/A')}<br>
                    <strong>Date:</strong> ${dateStr}<br>
                    <strong>Sales person:</strong> ${esc(salesPerson)}
                </p>
            </div>
        </div>
        <div class="bill-to">
            <strong>Bill To</strong><br>
            ${esc(inv.customerName)}<br>
            <div class="pre-wrap">${esc(inv.address)}</div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Item & Description</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Rate</th>
                    <th class="text-right">Taxable Amount</th>
                    
                    <th class="text-right">Tax</th>
                    <th class="text-right">Total</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        <div class="totals-section">
            <table class="totals-table">
                <tr><td>Sub Total</td><td class="text-right">AED ${subtotal}</td></tr>
                ${discount > 0 ? `<tr><td>Discount</td><td class="text-right">AED ${discount}</td></tr>` : ''}
                <tr><td>Total Tax (VAT)</td><td class="text-right">AED ${vat}</td></tr>
                <tr><td><strong>Grand Total</strong></td><td class="text-right"><strong>AED ${grand}</strong></td></tr>
            </table>
        </div>
        
        
        <div class="footer-section">
            <div>
                <strong>Notes</strong>
                <p class="pre-wrap">${esc(inv.notes || 'Thank you for your business.')}</p>
                <br>
                <strong>Bank details</strong>
                <p>
                    Bank Name: Abu Dhabi Commercial Bank<br>
                    Account Name: Artiflex Information Technology LLC<br>
                    Account Number: 13416209820001<br>
                    IBAN: AE510030013416209820001<br>
                    Currency: AED
                </p>
            </div>
            <div>
                <strong>Terms & Conditions</strong>
                <div class="pre-wrap">${esc(inv.termsAndConditions || '100% advance payment is required.')}</div>
            </div>
        </div>
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
    // 1. Determine the user's role and ID from the authentication token.
    const isUserAdmin = isAdmin(req);
    const userId = req.subjectId; // Assuming your token middleware provides this ID

    // 2. Create a dynamic 'where' clause for the database query.
    const whereClause = {};
    if (!isUserAdmin) {
      // If the user is NOT an admin, restrict the query to their own invoices.
      whereClause.createdById = userId;
    }

    // 3. Execute the query using the dynamic where clause.
    const invoices = await Invoice.findAll({
      where: whereClause, // This applies the role-based filter.
      order: [['invoiceDate', 'DESC']],
      include: [
        { model: InvoiceItem, as: 'items' },
        {
          model: Quote,
          as: 'quote',
          attributes: ['id', 'quoteNumber'],
          required: false
        }
      ]
    });

    res.json({ success: true, invoices });

  } catch (error) {
    console.error('List Invoices Error:', error); // Good practice to log the error
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
});


// router.get('/:id/download', authenticateToken, async (req, res) => {
//   try {
//     const invoice = await Invoice.findByPk(req.params.id, {
//       include: [
//         { model: InvoiceItem, as: 'items' },
//         { model: Quote, as: 'quote', attributes: ['id', 'quoteNumber'], required: false }
//       ]
//     });

//     if (!invoice) {
//       return res.status(404).json({ success: false, message: 'Invoice not found' });
//     }

//     // 1. Generate HTML content
//     const html = buildInvoiceHTML({ 
//       invoice: invoice.toJSON(), 
//       items: (invoice.items || []).map(i => i.toJSON()) 
//     });
    
//     const invoiceNumber = invoice.invoiceNumber || 'invoice';

//     const options = {
//       format: 'A4',
//       border: {
//         top: '20px',
//         right: '20px',
//         bottom: '20px',
//         left: '20px'
//       }
//     };

//     // 2. Use pdf.create with a callback, just like your quote route
//     pdf.create(html, options).toBuffer((err, buffer) => {
//       if (err) {
//         // This is the source of the instability and timeout errors.
//         console.error('html-pdf generation error:', err);
//         return res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
//       }
      
//       // 3. Set headers and send the response if successful
//       res.setHeader('Content-Type', 'application/pdf');
//       res.setHeader('Content-Disposition', `attachment; filename=${invoiceNumber}.pdf`);
//       res.send(buffer);
//     });

//   } catch (e) {
//     // This outer catch block may not be reached if PhantomJS crashes the entire process.
//     console.error('Outer PDF Download Error:', e);
//     res.status(500).json({ success: false, message: 'An unexpected server error occurred while generating the PDF.' });
//   }
// });


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
    // --- Validation Rules ---
    body('manualData.customerId').isUUID().withMessage('A valid customer must be selected.'),
    body('manualData.invoiceDate').isISO8601().withMessage('A valid invoice date is required.'),
    body('manualData.items').isArray({ min: 1 }).withMessage('Invoice must have at least one item.'),
    body('manualData.salesmanId').isUUID().withMessage('A valid salesman must be assigned.'),
    body('manualData.termsAndConditions').optional({ checkFalsy: true }).isString().withMessage('Terms and conditions must be a string.'),
    
    // This rule validates that if 'customerType' is sent, it must be 'Vendor' or 'Customer'.
    body('manualData.customerType').optional({ checkFalsy: true }).isIn(['Vendor', 'Customer']).withMessage('Invalid customer type specified.'),

], async (req, res) => {
   
    

    const errors = validationResult(req);

    // --- (2) Error Handling: Check for and log validation errors ---
    if (!errors.isEmpty()) {
      
        
        return res.status(400).json({ 
            success: false, 
            message: 'Validation failed. Please check the data.', 
            errors: errors.array() 
        });
    }

    // --- (3) Transaction and Data Processing ---
    const { manualData } = req.body;
    const transaction = await sequelize.transaction();

    try {
        if (!manualData) {
            // This case should be rare since the body is not empty, but it's good practice.
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Request must include `manualData`.' });
        }

        // --- (4) Sanitize and Prepare Data ---
        // Explicitly destructure `customerType` to handle it safely.
        const { items, termsAndConditions, customerType, ...invoiceData } = manualData;

        // Ensure `customerType` is a valid ENUM value or null before it reaches the database.
        const finalCustomerType = ['Vendor', 'Customer'].includes(customerType) ? customerType : null;
        
        const TAX_PERCENT = 5;

        // --- (5) Invoice Calculation Logic ---
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

        // --- (6) Database Creation ---
        const newInvoice = await Invoice.create({
            ...invoiceData,
            customerType: finalCustomerType, // Use the sanitized value
            invoiceNumber: await generateInvoiceNumber(),
            subtotal: calculatedSubtotal.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            vatAmount: calculatedVatAmount.toFixed(2),
            grandTotal: calculatedGrandTotal.toFixed(2),
            status: 'Draft',
            createdById: manualData.salesmanId, 
            termsAndConditions: termsAndConditions || '', // Ensure it's not null if model doesn't allow it
        }, { transaction });
        
        const finalInvoiceItems = invoiceItemsData.map(item => ({ ...item, invoiceId: newInvoice.id }));
        await InvoiceItem.bulkCreate(finalInvoiceItems, { transaction });

        await transaction.commit();
        
        // --- (7) Success Response ---
        const fullInvoice = await Invoice.findByPk(newInvoice.id, { include: 'items' });
       
        res.status(201).json({ success: true, invoice: fullInvoice });

    } catch (error) {
        await transaction.rollback();
        console.error('--- FAILED TO CREATE INVOICE (CATCH BLOCK) ---', error);
        res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
    }
});

/**
 * PATCH /api/invoices/:id/status
 * Updates the status of a single invoice.
 */
// routes/invoices.js
router.patch('/:id/status', authenticateToken, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    const allowedStatuses = ['Draft', 'Sent', 'Paid', 'Cancelled', 'Overdue'];
    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }

    try {
        const result = await sequelize.transaction(async (t) => {
            // --- FIX: Use the correct lowercase aliases ---
            const invoice = await Invoice.findByPk(id, {
                include: [{
                    model: Quote,
                    as: 'quote', // Use lowercase 'q' as specified in the error
                    include: [{
                        model: Lead,
                        as: 'lead' // Use lowercase 'l' for consistency
                    }]
                }],
                transaction: t
            });

            if (!invoice) {
                throw new Error('Invoice not found.');
            }

            if (invoice.status === 'Paid' || invoice.status === 'Cancelled') {
                const error = new Error(`Cannot change status of a ${invoice.status} invoice.`);
                error.status = 403;
                throw error;
            }

            invoice.status = status;
            if (invoice.status === 'Paid') {
                invoice.paidAt = new Date();
            }
            await invoice.save({ transaction: t });

            // --- FIX: Access the properties using the correct lowercase aliases ---
            if (status === 'Paid' && invoice.quote && invoice.quote.lead) {
                const lead = invoice.quote.lead;
                lead.stage = 'Deal Closed';
                await lead.save({ transaction: t });
            }
            
            if (status === 'Paid') {
                t.afterCommit(() => {
                    notifyAdminsOfSuccess(
                        `Invoice Paid: #${invoice.invoiceNumber}`,
                        `Invoice #${invoice.invoiceNumber} for customer '${invoice.customerName}' has been successfully paid and the corresponding deal is now closed.`
                    );
                });
            }

            return invoice;
        });

        res.json({ success: true, invoice: result });

    } catch (error) {
        console.error('Failed to update status:', error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Server Error' });
    }
});



// router.get('/:id/preview', authenticateToken, async (req, res) => {
//     try {
//         const invoice = await Invoice.findByPk(req.params.id, { 
//             include: [
//                 { model: InvoiceItem, as: 'items' },
//                 { model: Quote, as: 'quote', attributes: ['id', 'quoteNumber'], required: false }
//             ] 
//         });
//         if (!invoice) {
//             return res.status(404).json({ success: false, message: 'Invoice not found' });
//         }
//         const html = buildInvoiceHTML({ invoice: invoice.toJSON(), items: (invoice.items || []).map(i => i.toJSON()) });
//         res.json({ success: true, html });
//     } catch (e) {
//         res.status(500).json({ success: false, message: 'Failed to generate preview: ' + e.message });
//     }
// });
router.get('/:id/download', authenticateToken, async (req, res) => {
    try {
        const invoice = await Invoice.findByPk(req.params.id, {
            include: [
                { model: InvoiceItem, as: 'items' },
                { model: Quote, as: 'quote', required: false },
                // FIX: Eagerly load the creator (Member)
                { model: Member, as: 'creator', attributes: ['name'] }
            ]
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const html = buildInvoiceHTML({ 
            invoice: invoice.toJSON(), 
            items: (invoice.items || []).map(i => i.toJSON()),
            creator: invoice.creator ? invoice.creator.toJSON() : null // Pass creator to HTML builder
        });
        
        const options = { format: 'A4', border: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' } };

        pdf.create(html, options).toBuffer((err, buffer) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Failed to generate PDF.' });
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoiceNumber}.pdf`);
            res.send(buffer);
        });
    } catch (e) {
        res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
});

// --- UPDATED: GET /:id/preview Route ---
router.get('/:id/preview', authenticateToken, async (req, res) => {
    try {
        const invoice = await Invoice.findByPk(req.params.id, { 
            include: [
                { model: InvoiceItem, as: 'items' },
                { model: Quote, as: 'quote', required: false },
                // FIX: Eagerly load the creator (Member)
                { model: Member, as: 'creator', attributes: ['name'] }
            ] 
        });
        
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        const html = buildInvoiceHTML({ 
            invoice: invoice.toJSON(), 
            items: (invoice.items || []).map(i => i.toJSON()),
            creator: invoice.creator ? invoice.creator.toJSON() : null // Pass creator to HTML builder
        });
        res.json({ success: true, html });
    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to generate preview: ' + e.message });
    }
});

module.exports = router;
