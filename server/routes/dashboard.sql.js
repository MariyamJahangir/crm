const express = require('express');
const router = express.Router();
const { Op, fn, col } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');
const Member = require('../models/Member');
const Invoice = require('../models/Invoices');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');

// --- HELPER FUNCTIONS ---
const getPeriodDates = (period) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (period === 'this_month') {
        return { startDate: new Date(year, month, 1), endDate: new Date(year, month + 1, 0) };
    } else if (period === 'last_month') {
        return { startDate: new Date(year, month - 1, 1), endDate: new Date(year, month, 0) };
    }
    return { startDate: new Date(year, month, 1), endDate: new Date(year, month + 1, 0) };
};

// --- MAIN DATA FETCHING LOGIC ---
const getDashboardData = async (user = null) => {
    const isMember = user && user.type === 'MEMBER';
    const memberId = isMember ? user.id : null;

    // Define where clauses for filtering
    const leadWhere = memberId ? { salesmanId: memberId } : {};
    const invoiceWhere = { status: 'Paid', ...(memberId && { createdById: memberId }) };
    const customerWhere = memberId ? { salesmanId: memberId } : {};

    // --- Run all database queries in parallel for maximum efficiency ---
    const [
        totalLeads, projectsInProgress, totalClients, completedProjects,
        thisMonthSales, lastMonthSales, leadStagesData, revenueData
    ] = await Promise.all([
        Lead.count({ where: leadWhere }),
        Lead.count({ where: { ...leadWhere, stage: { [Op.notIn]: ['Deal Closed', 'Deal Lost', 'Cancelled'] } } }),
        Customer.count({ where: customerWhere }),
        Lead.count({ where: { ...leadWhere, stage: 'Deal Closed' } }),
        Invoice.sum('grandTotal', { where: { ...invoiceWhere, paidAt: { [Op.between]: getPeriodDates('this_month') } } }),
        Invoice.sum('grandTotal', { where: { ...invoiceWhere, paidAt: { [Op.between]: getPeriodDates('last_month') } } }),
        Lead.findAll({ attributes: ['stage', [fn('COUNT', 'id'), 'count']], where: leadWhere, group: ['stage'], raw: true }),
        Invoice.findAll({
            attributes: [
                [fn('YEAR', col('paidAt')), 'year'],
                [fn('MONTH', col('paidAt')), 'month'],
                [fn('SUM', col('grandTotal')), 'totalRevenue']
            ],
            where: { ...invoiceWhere, paidAt: { [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 6)) } },
            group: [fn('YEAR', col('paidAt')), fn('MONTH', col('paidAt'))],
            order: [[fn('YEAR', col('paidAt')), 'ASC'], [fn('MONTH', col('paidAt')), 'ASC']],
            raw: true,
        })
    ]);

    // --- Process and format the data ---
    const overallStats = {
        queries: totalLeads || 0,
        inProgress: projectsInProgress || 0,
        clients: totalClients || 0,
        completed: completedProjects || 0
    };

    const totalSalesComparison = {
        labels: ['Last Month', 'This Month'],
        values: [lastMonthSales || 0, thisMonthSales || 0],
    };

    const leadPipeline = { discovery: 0, quote: 0, deal_closed: 0 };
    leadStagesData.forEach(item => {
        const stageKey = item.stage.toLowerCase().replace(/\s+/g, '_');
        if (leadPipeline.hasOwnProperty(stageKey)) {
            leadPipeline[stageKey] = parseInt(item.count, 10);
        }
    });

    const revenueLabels = [];
    const revenueValues = [];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    for (let i = 0; i < 6; i++) {
        const date = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth() + i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        revenueLabels.push(monthNames[month]);
        const monthData = revenueData.find(d => d.year === year && d.month === month + 1);
        revenueValues.push(monthData ? parseFloat(monthData.totalRevenue) : 0);
    }
    
    const revenueLastSixMonths = { labels: revenueLabels, values: revenueValues };

    return { overallStats, totalSalesComparison, leadPipeline, revenueLastSixMonths };
};

// --- API ROUTES ---
const injectUser = (req, res, next) => {
    req.user = { id: req.subjectId, type: req.subjectType };
    next();
};

router.get('/', authenticateToken, injectUser, async (req, res) => {
    try {
        const data = await getDashboardData(req.user);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching dashboard data.' });
    }
});

module.exports = router;
