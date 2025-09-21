const express = require('express');
const { sequelize } = require('../config/database');
const { body, validationResult } = require('express-validator');
const pdf = require('html-pdf'); 
// Model Imports
const { Op } = require("sequelize");
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
const Customer = require('../models/Customer')
const Admin = require('../models/Admin')
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
/**
 * PATCH /api/invoices/:id/status
 * Updates the status of a single invoice.
 */
// routes/invoices.js

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




router.get('/', authenticateToken, async (req, res) => {
    try {
        const isUserAdmin = (req) => req.subjectType !== 'MEMBER';
        const userId = req.subjectId;

        let whereClause = {};

        // ★★★ FIX: This is the core of the new logic for non-admins ★★★
        if (!isUserAdmin(req)) {
            whereClause = {
                [Op.or]: [
                    // Condition 1: The user is the direct salesman on the invoice itself.
                    { salesmanId: userId },
                    // Condition 2: The invoice is linked to a quote where the user is the salesman.
                    // We use '$related_model.field$' syntax for this.
                    { '$quote.salesmanId$': userId }
                ]
            };
        }

        const invoices = await Invoice.findAll({
            where: whereClause,
            order: [['invoiceDate', 'DESC']],
            // The includes must contain the models referenced in the where clause.
            include: [
                { model: InvoiceItem, as: 'items' },
                {
                    model: Quote,
                    as: 'quote',
                    attributes: ['id', 'quoteNumber', 'salesmanId'], // Ensure salesmanId is included
                    required: false, // Use LEFT JOIN to not exclude invoices without quotes
                    include: [{
                        model: Lead,
                        as: 'lead',
                        attributes: ['id', 'previewUrl'],
                        required: false
                    }]
                },
                { model: Member, as: 'salesman', attributes: ['id', 'name'], required: false },
                { model: Member, as: 'memberCreator', attributes: ['id', 'name'], required: false },
                { model: Admin, as: 'adminCreator', attributes: ['id', 'name'], required: false },
            ],
            // ★★★ FIX: This prevents errors when ordering/filtering by an included column ★★★
            subQuery: false
        });

        // The mapping logic can now be simplified as the filtering is done in the database.
        const results = invoices.map(invoice => {
            const plainInvoice = invoice.get({ plain: true });
            const creator = plainInvoice.memberCreator || plainInvoice.adminCreator;

            return {
                ...plainInvoice,
                salesmanName: plainInvoice.salesman?.name || 'N/A',
                creatorName: creator?.name || 'N/A',
                previewUrl: plainInvoice.quote?.lead?.previewUrl || null
            };
        });

        res.json({ success: true, invoices: results });

    } catch (error) {
        console.error('List Invoices Error:', error);
        res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
    }
});





router.post('/from-quote/:quoteId', authenticateToken, async (req, res) => {
    const { quoteId } = req.params;
    const loggedInUserId = req.subjectId;
    const loggedInUserType = req.subjectType;

    const transaction = await sequelize.transaction();

    try {
        // --- 1. Fetch Quote with associated Lead and Salesman ---
        const quote = await Quote.findByPk(quoteId, {
            include: [
                { model: QuoteItem, as: 'items' },
                {
                    model: Lead,
                    as: 'lead',
                    attributes: ['id', 'salesmanId', 'customerId'],
                    include: [
                        { model: Customer, as: 'customer', attributes: ['id', 'companyName', 'address'] },
                        // ★★★ FIX: Include the salesman's data from the lead
                        { model: Member, as: 'salesman', attributes: ['id', 'name'] }
                    ]
                }
            ],
            transaction
        });

        // --- 2. Perform All Validations ---
        if (!quote) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Quote not found.' });
        }

        const isAdmin = loggedInUserType === 'ADMIN';
        const isAssignedSalesman = quote.lead && String(quote.lead.salesmanId) === String(loggedInUserId);

        if (!isAdmin && !isAssignedSalesman) {
            await transaction.rollback();
            return res.status(403).json({
                success: false,
                message: 'Forbidden: You do not have permission to convert this quote.'
            });
        }

        if (quote.status !== 'Accepted') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Only an "Accepted" quote can be converted to an invoice.' });
        }
        
        if (!quote.lead || !quote.lead.customer) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Data consistency error: The quote is not linked to a valid customer or lead.' });
        }

        const existingInvoice = await Invoice.findOne({ where: { quoteId: quote.id }, transaction });
        if (existingInvoice) {
            await transaction.rollback();
            return res.status(409).json({ success: false, message: `This quote has already been converted to Invoice #${existingInvoice.invoiceNumber}.` });
        }

        // --- 3. Calculations (remains the same) ---
        const FIXED_TAX_PERCENT = 5;
        let calculatedSubtotal = 0;
        let calculatedVatAmount = 0;
        const invoiceItemsData = quote.items.map((item, index) => {
            const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.itemRate) || 0) - (Number(item.lineDiscountAmount) || 0);
            const taxAmount = lineSubtotal * (FIXED_TAX_PERCENT / 100);
            calculatedSubtotal += lineSubtotal;
            calculatedVatAmount += taxAmount;
            return {
                slNo: index + 1,
                product: item.product,
                description: item.description,
                quantity: item.quantity,
                itemRate: item.itemRate,
                taxPercent: FIXED_TAX_PERCENT,
                taxAmount: taxAmount.toFixed(2),
                lineTotal: (lineSubtotal + taxAmount).toFixed(2),
            };
        });
        const overallDiscountAmount = Number(quote.discountAmount) || 0;
        const calculatedGrandTotal = (calculatedSubtotal - overallDiscountAmount) + calculatedVatAmount;

        // --- 4. Database Creation with Correct Salesman ---
        const newInvoice = await Invoice.create({
            quoteId: quote.id,
            invoiceNumber: await generateInvoiceNumber(),
            invoiceDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            customerId: quote.lead.customerId,
            customerName: quote.lead.customer.companyName, 
            address: quote.lead.customer.address,
            subtotal: calculatedSubtotal.toFixed(2),
            discountAmount: overallDiscountAmount.toFixed(2),
            vatAmount: calculatedVatAmount.toFixed(2),
            grandTotal: calculatedGrandTotal.toFixed(2),
            status: 'Draft',
            createdById: loggedInUserId,
            creatorType: loggedInUserType,
            // ★★★ FIX: Populate salesman details from the included lead data
            salesmanId: quote.lead.salesmanId,
            salesmanName: quote.lead.salesman ? quote.lead.salesman.name : 'N/A',
        }, { transaction });

        const finalInvoiceItems = invoiceItemsData.map(item => ({ ...item, invoiceId: newInvoice.id }));
        await InvoiceItem.bulkCreate(finalInvoiceItems, { transaction });
        
        await quote.update({ invoiceId: newInvoice.id }, { transaction });

        // --- 5. Commit and Respond ---
        await transaction.commit();

        const fullInvoice = await Invoice.findByPk(newInvoice.id, { include: ['items', 'quote', 'salesman'] });
        res.status(201).json({ success: true, message: 'Quote successfully converted to invoice.', invoice: fullInvoice });

    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        console.error(`[CONVERT_QUOTE] FAILED AND ROLLED BACK. Error: ${errorMessage}`, error);
        res.status(500).json({ success: false, message: 'Failed to convert quote to invoice: ' + errorMessage });
    }
});


router.post('/', authenticateToken, [
    // Validation rules remain the same
    body('manualData.customerId').isUUID().withMessage('A valid customer must be selected.'),
    body('manualData.invoiceDate').isISO8601().withMessage('A valid invoice date is required.'),
    body('manualData.items').isArray({ min: 1 }).withMessage('Invoice must have at least one item.'),
    body('manualData.salesmanId').isUUID().withMessage('A valid salesman must be assigned.'),
    body('manualData.termsAndConditions').optional({ checkFalsy: true }).isString().withMessage('Terms and conditions must be a string.'),
    body('manualData.customerType').optional({ checkFalsy: true }).isIn(['Vendor', 'Customer']).withMessage('Invalid customer type specified.'),
], async (req, res) => {
    const errors = validationResult(req);
    console.log(errors)
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed.', errors: errors.array() });
    }

    const { manualData } = req.body;
    const transaction = await sequelize.transaction();

    try {
        const { items, termsAndConditions, customerType, ...invoiceData } = manualData;
        
        // --- FIX ---
        // Default to 'Customer' if the type is not 'Vendor' or is invalid
        const finalCustomerType = customerType === 'Vendor' ? 'Vendor' : 'Customer';
        
        const TAX_PERCENT = 5;

        // --- Invoice Calculation & Item Preparation ---
        let calculatedSubtotal = 0;
        let calculatedVatAmount = 0;
        
        const invoiceItemsData = items.map((item, index) => {
            const quantity = Number(item.quantity) || 0;
            const itemRate = Number(item.itemRate) || 0;
            const lineSubtotal = quantity * itemRate;
            const taxAmount = lineSubtotal * (TAX_PERCENT / 100);

            calculatedSubtotal += lineSubtotal;
            calculatedVatAmount += taxAmount;

            return {
                slNo: index + 1,
                product: item.product,
                description: item.description,
                quantity: quantity,
                itemRate: itemRate,
                taxPercent: TAX_PERCENT,
                taxAmount: taxAmount.toFixed(2),
                lineTotal: (lineSubtotal + taxAmount).toFixed(2),
            };
        });
        
        const discountAmount = Number(invoiceData.discountAmount) || 0;
        const calculatedGrandTotal = (calculatedSubtotal - discountAmount) + calculatedVatAmount;

        // --- Database Creation ---
        const newInvoice = await Invoice.create({
            ...invoiceData,
            customerType: finalCustomerType,
            invoiceNumber: await generateInvoiceNumber(),
            subtotal: calculatedSubtotal.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            vatAmount: calculatedVatAmount.toFixed(2),
            grandTotal: calculatedGrandTotal.toFixed(2),
            status: 'Draft',
            termsAndConditions: termsAndConditions || '',
            salesmanId: manualData.salesmanId,
            createdById: req.subjectId,
            creatorType: req.subjectType,
        }, { transaction });
        
        const finalInvoiceItems = invoiceItemsData.map(item => ({ ...item, invoiceId: newInvoice.id }));

        await InvoiceItem.bulkCreate(finalInvoiceItems, { transaction });

        await transaction.commit();
        
        const fullInvoice = await Invoice.findByPk(newInvoice.id, { include: 'items' });
        res.status(201).json({ success: true, invoice: fullInvoice });

    } catch (error) {
        await transaction.rollback();
        console.error('--- FAILED TO CREATE INVOICE (CATCH BLOCK) ---', error);
        res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
    }
});




router.patch('/:id/status', authenticateToken, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    // 1. Validate the incoming status
    const allowedStatuses = ['Draft', 'Sent', 'Paid', 'Cancelled', 'Overdue'];
    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status provided.' });
    }

    try {
        // 2. Use a transaction for data consistency
        const result = await sequelize.transaction(async (t) => {
            const invoice = await Invoice.findByPk(id, {
                include: [{
                    model: Quote,
                    as: 'quote',
                    include: [{ model: Lead, as: 'lead' }]
                }],
                transaction: t
            });

            if (!invoice) {
                throw new Error('Invoice not found.');
            }

            // 3. Prevent changing status of a finalized invoice
            if (invoice.status === 'Paid' || invoice.status === 'Cancelled') {
                const error = new Error(`Cannot change status of a ${invoice.status} invoice.`);
                error.status = 403; // Forbidden
                throw error;
            }

            // 4. Update the status in memory
            invoice.status = status;

            // --- THIS IS THE KEY LOGIC ---
            // 5. If the status is 'Paid', set the 'paidAt' timestamp
            if (status === 'Paid') {
               
                invoice.paidAt = new Date(); // Set the current date and time
                console.log('done')
                // Also update the related lead's stage
                if (invoice.quote && invoice.quote.lead) {
                    const lead = invoice.quote.lead;
                    lead.stage = 'Deal Closed';
                    await lead.save({ transaction: t });
                }
            }

            // 6. Save all changes to the database
            // Because the Invoice model is now fixed, Sequelize will correctly save the 'paidAt' field.
            await invoice.save({ transaction: t });

            // 7. Queue a notification to be sent only if the transaction succeeds
            if (status === 'Paid') {
                t.afterCommit(() => {
                    notifyAdminsOfSuccess(
                        `Invoice Paid: #${invoice.invoiceNumber}`,
                        `Invoice #${invoice.invoiceNumber} for customer '${invoice.customerName}' has been paid.`
                    );
                });
            }

            return invoice;
        });

        // 8. Return the updated invoice on success
        res.json({ success: true, invoice: result });

    } catch (error) {
        console.error('Failed to update status:', error);
        res.status(error.status || 500).json({ success: false, message: error.message || 'Server Error' });
    }
});



router.get('/:id/download', authenticateToken, async (req, res) => {
    try {
        const invoice = await Invoice.findByPk(req.params.id, {
            // FIX: Use the same robust include as the preview route.
            include: [
                { model: InvoiceItem, as: 'items' },
                { model: Quote, as: 'quote', required: false },
                { model: Member, as: 'salesman', attributes: ['name'], required: false },
                { model: Member, as: 'memberCreator', attributes: ['id', 'name'], required: false },
                { model: Admin, as: 'adminCreator', attributes: ['id', 'name'], required: false },
            ]
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        
        const creator = invoice.memberCreator || invoice.adminCreator;

        const html = buildInvoiceHTML({
            invoice: invoice.toJSON(),
            creator: creator ? creator.toJSON() : null,
            salesman: invoice.salesman ? invoice.salesman.toJSON() : null
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
        res.status(500).json({ success: false, message: 'An unexpected error occurred: ' + e.message });
    }
});

// --- UPDATED: GET /:id/preview Route ---
router.get('/:id/preview', authenticateToken, async (req, res) => {
    try {
        const invoice = await Invoice.findByPk(req.params.id, {
            // FIX: Explicitly include all required associations using their correct aliases.
            include: [
                { model: InvoiceItem, as: 'items' },
                { model: Quote, as: 'quote', required: false },
                { model: Member, as: 'salesman', attributes: ['name'], required: false },
                { model: Member, as: 'memberCreator', attributes: ['id', 'name'], required: false },
                { model: Admin, as: 'adminCreator', attributes: ['id', 'name'], required: false },
            ]
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        
        // FIX: Correctly determine the creator from the eager-loaded associations.
        const creator = invoice.memberCreator || invoice.adminCreator;
        
        const html = buildInvoiceHTML({
            invoice: invoice.toJSON(),
            creator: creator ? creator.toJSON() : null,
            salesman: invoice.salesman ? invoice.salesman.toJSON() : null
        });
        
        res.json({ success: true, html });

    } catch (e) {
        res.status(500).json({ success: false, message: 'Failed to generate preview: ' + e.message });
    }
});

module.exports = router;
