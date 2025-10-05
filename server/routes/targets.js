const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Import all necessary models
const SalesTarget = require('../models/SalesTarget');
const Member = require('../models/Member');
const Lead = require('../models/Lead');
const Invoice = require('../models/Invoices');
const Quote = require('../models/Quote');
const ShareGp = require('../models/ShareGp');

// --- HELPER FUNCTION ---
/**
 * Converts a given amount from a source currency to AED.
 * @param {number} amount The amount to convert.
 * @param {string} currency The source currency (e.g., 'USD', 'EUR').
 * @returns {number} The converted amount in AED.
 */
const convertToAED = (amount, currency) => {
    if (amount === null || isNaN(amount)) return 0;
    const upperCaseCurrency = currency ? currency.toUpperCase() : 'AED';

    // Define conversion rates relative to AED
    const rates = {
        USD: 3.67,
        EUR: 4.00,
        AED: 1,
    };

    return amount * (rates[upperCaseCurrency] || 1);
};

// --- ROUTES ---

/**
 * @route   GET /api/sales-targets/members
 * @desc    Get all active (not blocked) members for populating UI selectors
 * @access  Private (Admin)
 */
router.get('/members', authenticateToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });
    try {
        const members = await Member.findAll({
            attributes: ['id', 'name'],
            where: { isBlocked: false }
        });
        res.json({ success: true, data: members });
    } catch (error) {
        console.error('Server error fetching members:', error);
        res.status(500).json({ success: false, message: 'Server error fetching members.' });
    }
});

/**
 * @route   GET /api/sales-targets/achievements
 * @desc    Get sales targets and calculated achievements for all members for a given month/year
 * @access  Private (Admin)
 */
router.get('/achievements', authenticateToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { year, month } = req.query;
    if (!year || !month) {
        return res.status(400).json({ success: false, message: 'Year and month query parameters are required.' });
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    try {
        // Step 1: Fetch all active members and their targets for the specified month.
        const members = await Member.findAll({
            where: { isBlocked: false },
            attributes: ['id', 'name'],
            include: [{ model: SalesTarget, where: { year, month }, required: false }]
        });

        // Step 2: Fetch ALL 'Paid' invoices within the date range.
        // We use a LEFT JOIN for the Quote model (required: false) to ensure we get invoices
        // that were created directly, not just those from a quote.
        const paidInvoicesInMonth = await Invoice.findAll({
            where: {
                status: 'Paid',
                paidAt: { [Op.between]: [startDate, endDate] }
            },
            include: [{
                model: Quote,
                required: false, // This is crucial for including direct invoices
                include: [{
                    model: Lead,
                    required: false, // A quote might not always have a lead
                    include: [{ model: ShareGp, as: 'ShareGps', required: false }]
                }]
            }]
        });

        // Step 3: Create a map to hold the calculated sales values for each member.
        const memberSales = new Map();

        // Process each paid invoice to distribute the sales value.
        for (const invoice of paidInvoicesInMonth) {
            // The salesperson listed on the INVOICE is the one who gets credit for the sale.
            const salespersonId = invoice.salesmanId;
            if (!salespersonId) continue; // Skip if the invoice has no assigned salesperson.

            // Convert the invoice's grand total to AED for consistent calculation.
            const invoiceTotal = parseFloat(invoice.grandTotal) || 0;
            const invoiceTotalAED = convertToAED(invoiceTotal, invoice.currency);

            // Ensure the salesperson exists in our tracking map.
            if (!memberSales.has(salespersonId)) {
                memberSales.set(salespersonId, { directSalesAED: 0, sharedSalesAED: 0 });
            }

            // Check for sharing information ONLY if the invoice came from a quote.
            const quote = invoice.Quote;
            const shareInfo = quote?.Lead?.ShareGps?.[0];

            // A deal is considered "shared" if shareInfo exists, has a percentage, and a shared member ID.
            if (shareInfo && shareInfo.profitPercentage > 0 && shareInfo.sharedMemberId) {
                // --- This is a SHARED SALE ---
                const sharedMemberId = shareInfo.sharedMemberId;
                
                // Ensure the shared member also exists in our tracking map.
                if (!memberSales.has(sharedMemberId)) {
                    memberSales.set(sharedMemberId, { directSalesAED: 0, sharedSalesAED: 0 });
                }

                // Split the total invoice value based on the percentage.
                const sharedPercentage = parseFloat(shareInfo.profitPercentage);
                const sharedValue = invoiceTotalAED * (sharedPercentage / 100);
                const ownerValue = invoiceTotalAED - sharedValue;

                // Credit the primary salesperson (on the invoice) with their portion.
                const ownerRecord = memberSales.get(salespersonId);
                ownerRecord.directSalesAED += ownerValue;

                // Credit the shared member with their portion.
                const sharedMemberRecord = memberSales.get(sharedMemberId);
                sharedMemberRecord.sharedSalesAED += sharedValue;

            } else {
                // --- This is a DIRECT or NON-SHARED SALE ---
                // 100% of the invoice value goes to the salesperson on the invoice.
                const ownerRecord = memberSales.get(salespersonId);
                ownerRecord.directSalesAED += invoiceTotalAED;
            }
        }

        // Step 4: Map the calculated sales and lead counts to the final member list for the response.
        const achievementPromises = members.map(async (member) => {
            const sales = memberSales.get(member.id) || { directSalesAED: 0, sharedSalesAED: 0 };
            
            // Count the number of leads created by this member in the given month.
            const leadCount = await Lead.count({
                where: { salesmanId: member.id, createdAt: { [Op.between]: [startDate, endDate] } }
            });

            const target = member.SalesTargets?.[0];
            let achievedValue = 0;
            if (target) {
                switch (target.targetType) {
                    case 'INVOICE_VALUE':
                        achievedValue = sales.directSalesAED + sales.sharedSalesAED;
                        break;
                    case 'LEADS':
                        achievedValue = leadCount;
                        break;
                }
            }

            // Construct the final JSON object for this member.
            return {
                memberId: member.id,
                memberName: member.name,
                targetType: target ? target.targetType : 'N/A',
                targetValue: target ? parseFloat(target.targetValue) : 0,
                targetCurrency: target ? target.currency : 'AED',
                achievedValue: parseFloat(achievedValue.toFixed(2)),
                achievementDetails: {
                    directSalesAED: parseFloat(sales.directSalesAED.toFixed(2)),
                    sharedSalesAED: parseFloat(sales.sharedSalesAED.toFixed(2)),
                    totalSalesAED: parseFloat((sales.directSalesAED + sales.sharedSalesAED).toFixed(2)),
                    leadCount: leadCount
                }
            };
        });

        const results = await Promise.all(achievementPromises);
        res.json({ success: true, data: results });

    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ success: false, message: 'Server error fetching achievements.' });
    }
});

/**
 * @route   POST /api/sales-targets
 * @desc    Set or update a sales target for a single member for the current month
 * @access  Private (Admin)
 */
router.post('/', authenticateToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const { memberId, targetType, targetValue } = req.body;
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    if (!memberId || !targetType || targetValue === undefined) {
        return res.status(400).json({ success: false, message: 'Member ID, Target Type, and Target Value are required.' });
    }
    const validTypes = ['INVOICE_VALUE', 'LEADS'];
    if (!validTypes.includes(targetType.toUpperCase())) {
        return res.status(400).json({ success: false, message: `Invalid target type. Must be one of: ${validTypes.join(', ')}` });
    }

    try {
        const [target, created] = await SalesTarget.findOrCreate({
            where: { memberId, year, month },
            defaults: {
                targetType: targetType.toUpperCase(),
                targetValue: parseFloat(targetValue),
                currency: 'AED' // All targets are stored in AED
            }
        });

        if (!created) {
            target.targetType = targetType.toUpperCase();
            target.targetValue = parseFloat(targetValue);
            await target.save();
        }
        res.json({ success: true, message: `Target successfully ${created ? 'set' : 'updated'}.` });
    } catch (error) {
        console.error('Failed to set sales target:', error);
        res.status(500).json({ success: false, message: 'Failed to set sales target.' });
    }
});

/**
 * @route   POST /api/sales-targets/bulk
 * @desc    Set or update a uniform sales target for all active members for the current month
 * @access  Private (Admin)
 */
router.post('/bulk', authenticateToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const { targetType, targetValue } = req.body;
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;

    if (!targetType || targetValue === undefined) {
        return res.status(400).json({ success: false, message: 'Target Type and Target Value are required.' });
    }
    const validTypes = ['INVOICE_VALUE', 'LEADS'];
    if (!validTypes.includes(targetType.toUpperCase())) {
        return res.status(400).json({ success: false, message: `Invalid target type. Must be one of: ${validTypes.join(', ')}` });
    }

    try {
        const members = await Member.findAll({ where: { isBlocked: false } });
        const promises = members.map(async (member) => {
            const [target, created] = await SalesTarget.findOrCreate({
                where: { memberId: member.id, year, month },
                defaults: {
                    targetType: targetType.toUpperCase(),
                    targetValue: parseFloat(targetValue),
                    currency: 'AED'
                }
            });

            if (!created) {
                target.targetType = targetType.toUpperCase();
                target.targetValue = parseFloat(targetValue);
                await target.save();
            }
        });
        
        await Promise.all(promises);
        res.json({ success: true, message: `Targets successfully set/updated for all ${members.length} members.` });
    } catch (error) {
        console.error('Failed to set bulk sales targets:', error);
        res.status(500).json({ success: false, message: 'Failed to set bulk sales targets.' });
    }
});

module.exports = router;