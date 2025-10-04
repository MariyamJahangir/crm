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
        console.log('[DEBUG] Missing year or month in query parameters');
        return res.status(400).json({ success: false, message: 'Year and month query parameters are required.' });
    }

    console.log(`[DEBUG] Fetching achievements for Year: ${year}, Month: ${month}`);

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 1));

    try {
        // Step 1: Fetch all members and their specific targets for the month.
        const members = await Member.findAll({
            where: { isBlocked: false },
            attributes: ['id', 'name'],
            include: [{ model: SalesTarget, where: { year, month }, required: false }]
        });
        console.log(`[DEBUG] Found ${members.length} active members.`);

        // Step 2: Fetch all invoices paid within the month, including related quote, lead, and sharing data.
        const paidInvoicesInMonth = await Invoice.findAll({
            where: {
                status: 'Paid',
                paidAt: { [Op.between]: [startDate, endDate] }
            },
            include: [{
                model: Quote,
                required: true,
                include: [{
                    model: Lead,
                    required: true,
                    include: [{ model: ShareGp, as: 'ShareGps', required: false }]
                }]
            }]
        });
        console.log(`[DEBUG] Found ${paidInvoicesInMonth.length} paid invoices in the specified month.`);
        if (paidInvoicesInMonth.length > 0) {
            console.log(`[DEBUG] Sample Invoice: ${JSON.stringify(paidInvoicesInMonth[0], null, 2)}`);
        }

        // Step 3: Pre-calculate profits for each member in a single pass.
        const memberProfits = new Map();

        for (const invoice of paidInvoicesInMonth) {
            const quote = invoice.Quote;
            if (!quote || !quote.Lead) continue;

            // The lead owner is the main salesman from the Lead table
            const leadOwnerId = quote.Lead.salesmanId;
            
            // Find share info for this lead (if any)
            const shareInfo = quote.Lead.ShareGps && quote.Lead.ShareGps.length > 0 
                ? quote.Lead.ShareGps[0] 
                : null;

            // Initialize profit tracking for both members if not exists
            if (!memberProfits.has(leadOwnerId)) {
                memberProfits.set(leadOwnerId, { directProfitAED: 0, sharedProfitAED: 0 });
            }
            if (shareInfo && shareInfo.sharedMemberId && shareInfo.profitPercentage > 0) {
                if (!memberProfits.has(shareInfo.sharedMemberId)) {
                    memberProfits.set(shareInfo.sharedMemberId, { directProfitAED: 0, sharedProfitAED: 0 });
                }
            }

            // Get the gross profit from the quote
            const grossProfit = parseFloat(quote.grossProfit) || 0;
            const grossProfitAED = convertToAED(grossProfit, quote.currency);

            // Check if this lead is shared
            if (shareInfo && shareInfo.profitPercentage > 0 && shareInfo.sharedMemberId) {
                // Calculate profit split
                const sharedPercentage = parseFloat(shareInfo.profitPercentage);
                const sharedMemberProfit = grossProfitAED * (sharedPercentage / 100);
                const ownerProfit = grossProfitAED - sharedMemberProfit; // Remaining percentage

                // Owner gets their percentage as direct profit
                const ownerRecord = memberProfits.get(leadOwnerId);
                ownerRecord.directProfitAED += ownerProfit;

                // Shared member gets their percentage as shared profit
                const sharedMemberRecord = memberProfits.get(shareInfo.sharedMemberId);
                sharedMemberRecord.sharedProfitAED += sharedMemberProfit;

                console.log(`[DEBUG] Shared Lead: Owner ${leadOwnerId} gets ${ownerProfit.toFixed(2)} AED (${100 - sharedPercentage}%), Shared Member ${shareInfo.sharedMemberId} gets ${sharedMemberProfit.toFixed(2)} AED (${sharedPercentage}%)`);
            } else {
                // No sharing - owner gets 100% as direct profit
                const ownerRecord = memberProfits.get(leadOwnerId);
                ownerRecord.directProfitAED += grossProfitAED;

                console.log(`[DEBUG] Non-Shared Lead: Owner ${leadOwnerId} gets ${grossProfitAED.toFixed(2)} AED (100%)`);
            }
        }
        console.log('[DEBUG] Calculated profits for members:', JSON.stringify(Array.from(memberProfits.entries()), null, 2));

        // Step 4: Map profits and lead counts to each member.
        const achievementPromises = members.map(async (member) => {
            const profits = memberProfits.get(member.id) || { directProfitAED: 0, sharedProfitAED: 0 };
            
            const leadCount = await Lead.count({
                where: {
                    salesmanId: member.id,
                    createdAt: { [Op.between]: [startDate, endDate] }
                }
            });

            const target = member.SalesTargets && member.SalesTargets[0];
            let achievedValue = 0;
            if (target) {
                switch (target.targetType) {
                    case 'INVOICE_VALUE':
                        // Achievement is total profit (direct + shared)
                        achievedValue = profits.directProfitAED + profits.sharedProfitAED;
                        break;
                    case 'LEADS':
                        achievedValue = leadCount;
                        break;
                }
            }

            return {
                memberId: member.id,
                memberName: member.name,
                targetType: target ? target.targetType : 'N/A',
                targetValue: target ? parseFloat(target.targetValue) : 0,
                targetCurrency: target ? target.currency : 'AED',
                achievedValue: parseFloat(achievedValue.toFixed(2)),
                achievementDetails: {
                    directProfitAED: parseFloat(profits.directProfitAED.toFixed(2)),
                    sharedProfitAED: parseFloat(profits.sharedProfitAED.toFixed(2)),
                    totalProfitAED: parseFloat((profits.directProfitAED + profits.sharedProfitAED).toFixed(2)),
                    leadCount: leadCount
                }
            };
        });

        const results = await Promise.all(achievementPromises);
        console.log('[DEBUG] Final achievement results:', JSON.stringify(results, null, 2));
        
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