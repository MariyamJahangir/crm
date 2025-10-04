const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');


// Import all necessary models
const Member = require('../models/Member');
const Admin = require('../models/Admin');
const Invoice = require('../models/Invoices');
const Lead = require('../models/Lead');
const Quote = require('../models/Quote');
const SalesTarget = require('../models/SalesTarget');
const ShareGp = require('../models/ShareGp');


// --- Helper: Date Ranges ---
const getDateRange = (period) => {
    const now = new Date();
    let startDate, endDate;


    switch (period) {
        case 'this_quarter':
            const currentQuarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            endDate = new Date(now.getFullYear(), currentQuarter * 3 + 3, 0, 23, 59, 59);
            break;
        case 'last_month':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;
        case 'last_quarter':
             const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
            if (lastQuarter < 0) {
                startDate = new Date(now.getFullYear() - 1, 9, 1);
                endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
            } else {
                startDate = new Date(now.getFullYear(), lastQuarter * 3, 1);
                endDate = new Date(now.getFullYear(), lastQuarter * 3 + 3, 0, 23, 59, 59);
            }
            break;
        case 'all_time':
            startDate = new Date(0); // The beginning of time
            endDate = new Date();
            break;
        case 'this_month':
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            break;
    }
    return { startDate, endDate };
};


// --- Helper: Currency Conversion to USD ---
const exchangeRates = { 'INR': 0.012, 'EUR': 1.08, 'AED': 0.27, 'USD': 1 };
const convertToUSD = (amount, currency) => {
    const rate = exchangeRates[currency] || 1;
    return parseFloat(amount || 0) * rate;
};


// --- Main Data Fetching Logic ---
const getDashboardData = async (user, period) => {
    const isAdmin = user.subjectType !== 'MEMBER';
    const { startDate, endDate } = getDateRange(period);
    const dateFilter = { [Op.between]: [startDate, endDate] };


    // 1. Get user maps for name lookups
    const [members, admins] = await Promise.all([
         Member.findAll({ attributes: ['id', 'name'], where: { isBlocked: false }, raw: true }),
         Admin.findAll({ attributes: ['id', 'name'], raw: true })
    ]);
    const userMap = new Map([...members.map(m => [m.id, m.name]), ...admins.map(a => [a.id, a.name])]);
    const userIdToName = (id) => userMap.get(id) || 'Unknown User';


    // 2. Fetch all data concurrently with detailed associations
    const [invoicesWithShares, leadsWithShares, quotesWithStatus, leadDetailsForBreakdown, targets] = await Promise.all([
        Invoice.findAll({
            where: { status: 'Paid', paidAt: dateFilter },
            include: [{ model: Quote, as: 'quote', required: true, include: [{ model: Lead, as: 'lead', required: true, include: [{ model: ShareGp, as: 'shares', required: false }] }] }],
        }),
        Lead.findAll({ where: { createdAt: dateFilter }, include: [{ model: ShareGp, as: 'shares', attributes: ['id'] }] }),
        Quote.findAll({ attributes: ['salesmanId', 'status', [fn('COUNT', 'id'), 'count']], where: { createdAt: dateFilter }, group: ['salesmanId', 'status'], raw: true }),
        Lead.findAll({
            where: { createdAt: dateFilter },
            include: [
                { model: Quote, as: 'quotes', attributes: ['grandTotal', 'currency'], required: false },
                { model: Member, as: 'salesman', attributes: ['name'], required: false }
            ]
        }),
        SalesTarget.findAll({ where: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }, raw: true })
    ]);


    // 3. Process Sales by Salesman
    const salesResults = {};
    for (const id of userMap.keys()) { salesResults[id] = { individualSales: 0, sharedSales: 0, individualDeals: 0, sharedDeals: 0 }; }
    invoicesWithShares.forEach(inv => {
        const usdAmount = convertToUSD(inv.grandTotal, inv.currency);
        const shares = inv.quote?.lead?.shares?.filter(s => s.profitPercentage > 0) || [];
        if (shares.length > 0) {
            const ownerId = shares[0].memberId;
            const totalSharedPercentage = shares.reduce((sum, share) => sum + parseFloat(share.profitPercentage), 0);
            const ownerRetainedPercentage = 100 - totalSharedPercentage;
            if (salesResults[ownerId]) {
                salesResults[ownerId].sharedSales += (usdAmount * ownerRetainedPercentage) / 100;
                salesResults[ownerId].sharedDeals++;
            }
            shares.forEach(share => {
                const sharedMemberId = share.sharedMemberId;
                if (salesResults[sharedMemberId]) {
                    salesResults[sharedMemberId].sharedSales += (usdAmount * parseFloat(share.profitPercentage)) / 100;
                    salesResults[sharedMemberId].sharedDeals++;
                }
            });
        } else {
            const creatorId = inv.createdById;
            if (salesResults[creatorId]) {
                salesResults[creatorId].individualSales += usdAmount;
                salesResults[creatorId].individualDeals++;
            }
        }
    });
    const salesBySalesman = { labels: [], details: [] };
    for (const [userId, data] of Object.entries(salesResults)) {
        const totalSales = data.individualSales + data.sharedSales;
        if (totalSales > 0) {
            salesBySalesman.labels.push(userIdToName(userId));
            salesBySalesman.details.push({ totalSales, ...data });
        }
    }


    // 4. Process Leads by Salesman (Individual vs. Shared)
    const leadsBySalesmanMap = new Map();
    leadsWithShares.forEach(lead => {
        const salesmanId = lead.salesmanId;
        if (!leadsBySalesmanMap.has(salesmanId)) leadsBySalesmanMap.set(salesmanId, { individual: 0, shared: 0 });
        if (lead.shares && lead.shares.length > 0) leadsBySalesmanMap.get(salesmanId).shared++;
        else leadsBySalesmanMap.get(salesmanId).individual++;
    });
    const leadsBySalesman = { labels: [], details: [] };
    for (const [salesmanId, counts] of leadsBySalesmanMap.entries()) {
        leadsBySalesman.labels.push(userIdToName(salesmanId));
        leadsBySalesman.details.push(counts);
    }
    
    // 5. Process Quotes by Salesman (Status Breakdown)
    const quotesBySalesmanMap = new Map();
    quotesWithStatus.forEach(item => {
        const salesmanId = item.salesmanId;
        if (!quotesBySalesmanMap.has(salesmanId)) quotesBySalesmanMap.set(salesmanId, { total: 0, statuses: {} });
        const data = quotesBySalesmanMap.get(salesmanId);
        data.total += item.count;
        data.statuses[item.status] = item.count;
    });
    const quotesBySalesman = { labels: [], details: [] };
    for (const [salesmanId, detail] of quotesBySalesmanMap.entries()) {
        quotesBySalesman.labels.push(userIdToName(salesmanId));
        quotesBySalesman.details.push(detail);
    }


    // 6. Process Leads by Stage & Forecast (Member Breakdown)
    const leadsByStageData = {}, leadsByForecastData = {};
    leadDetailsForBreakdown.forEach(lead => {
        const salesmanName = lead.salesman?.name || 'Unassigned';
        const bestQuote = lead.quotes.length > 0 ? lead.quotes.reduce((max, q) => parseFloat(q.grandTotal) > parseFloat(max.grandTotal) ? q : max, lead.quotes[0]) : null;
        const usdValuation = bestQuote ? convertToUSD(bestQuote.grandTotal, bestQuote.currency) : 0;
        
        const stage = lead.stage, forecast = lead.forecastCategory;
        if (!leadsByStageData[stage]) leadsByStageData[stage] = { count: 0, valuation: 0, members: {} };
        leadsByStageData[stage].count++;
        leadsByStageData[stage].valuation += usdValuation;
        leadsByStageData[stage].members[salesmanName] = (leadsByStageData[stage].members[salesmanName] || 0) + 1;


        if (!leadsByForecastData[forecast]) leadsByForecastData[forecast] = { count: 0, valuation: 0, members: {} };
        leadsByForecastData[forecast].count++;
        leadsByForecastData[forecast].valuation += usdValuation;
        leadsByForecastData[forecast].members[salesmanName] = (leadsByForecastData[forecast].members[salesmanName] || 0) + 1;
    });
    const formatBreakdownData = data => ({ labels: Object.keys(data), details: Object.values(data) });
    const leadsByStage = formatBreakdownData(leadsByStageData);
    const leadsByForecast = formatBreakdownData(leadsByForecastData);


    // 7. Process Targets
    const memberTargetAchievements = [];
    const achievementMap = new Map();
    invoicesWithShares.forEach(inv => {
        const usdVal = convertToUSD(inv.grandTotal, inv.currency);
        achievementMap.set(inv.createdById, (achievementMap.get(inv.createdById) || 0) + usdVal);
    });
    if (isAdmin) {
        const targetMap = new Map(targets.map(t => [t.memberId, parseFloat(t.targetAmount)]));
        members.forEach(member => {
            const achieved = achievementMap.get(member.id) || 0;
            const target = targetMap.get(member.id) || 0;
            memberTargetAchievements.push({ id: member.id, name: member.name, achieved, target, isAchieved: achieved >= target && target > 0 });
        });
    } else {
        const memberId = user.subjectId;
        const achieved = achievementMap.get(memberId) || 0;
        const myTarget = targets.find(t => t.memberId === memberId);
        const target = myTarget ? parseFloat(myTarget.targetAmount) : 0;
        memberTargetAchievements.push({ id: memberId, name: 'Your Achievement', achieved, target, isAchieved: achieved >= target && target > 0 });
    }
    
    return { isAdmin, memberTargetAchievements, salesBySalesman, leadsBySalesman, quotesBySalesman, leadsByStage, leadsByForecast };
};


// --- API Endpoint ---
router.get('/', authenticateToken, async (req, res) => {
    try {
        const period = req.query.period || 'this_month';
        const user = { subjectId: req.subjectId, subjectType: req.subjectType };
        const data = await getDashboardData(user, period);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching dashboard data.' });
    }
});


module.exports = router;
