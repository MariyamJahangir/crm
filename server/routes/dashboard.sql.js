const express = require('express');
const router = express.Router();
const { sequelize } = require('../config/database'); 
const { Op, fn, col } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');
const Member = require('../models/Member');
const Invoice = require('../models/Invoices');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const SalesTarget = require('../models/SalesTarget');

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
const getDashboardData = async (user) => { 
    const isAdmin = user && user.subjectType !== 'MEMBER';
    const memberId = !isAdmin ? user.subjectId : null;
    
    const thisMonth = getPeriodDates('this_month');
    const lastMonth = getPeriodDates('last_month');

    if (isAdmin) {
        const [
            totalLeads, projectsInProgress, totalClients, completedProjects,
            salesByMember, leadStagesData, revenueByMember, targetsData,
            memberAchievements
        ] = await Promise.all([
            Lead.count(),
            Lead.count({ where: { stage: { [Op.notIn]: ['Deal Closed', 'Deal Lost', 'Cancelled'] } } }),
            Customer.count(),
            Lead.count({ where: { stage: 'Deal Closed' } }),
            Invoice.findAll({
                attributes: [
                    'createdById',
                    [sequelize.literal(`SUM(CASE WHEN paidAt >= '${lastMonth.startDate.toISOString()}' AND paidAt <= '${lastMonth.endDate.toISOString()}' THEN grandTotal ELSE 0 END)`), 'lastMonthSales'],
                    [sequelize.literal(`SUM(CASE WHEN paidAt >= '${thisMonth.startDate.toISOString()}' AND paidAt <= '${thisMonth.endDate.toISOString()}' THEN grandTotal ELSE 0 END)`), 'thisMonthSales']
                ],
                where: { status: 'Paid' },
                group: ['createdById'],
                include: [{ model: Member, as: 'creator', attributes: ['name'] }] 
            }),
            Lead.findAll({ attributes: ['stage', [fn('COUNT', 'id'), 'count']], group: ['stage'], raw: true }),
            Invoice.findAll({
                attributes: [
                    'createdById', [fn('YEAR', col('paidAt')), 'year'], [fn('MONTH', col('paidAt')), 'month'],
                    [fn('SUM', col('grandTotal')), 'totalRevenue']
                ],
                where: { status: 'Paid', paidAt: { [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 6)) } },
                group: ['createdById', fn('YEAR', col('paidAt')), fn('MONTH', col('paidAt'))],
                order: [[fn('YEAR', col('paidAt')), 'ASC'], [fn('MONTH', col('paidAt')), 'ASC']],
                include: [{ model: Member, as: 'creator', attributes: ['name'] }]
            }),
            SalesTarget.findAll({
                where: {
                    year: new Date().getFullYear(),
                    month: { [Op.gte]: new Date().getMonth() - 4, [Op.lte]: new Date().getMonth() + 1 }
                },
                include: [{ model: Member, as: 'member', attributes: ['name'] }]
            }),
            // Fetch data for member achievement speedometers
            Member.findAll({
                attributes: ['id', 'name'],
                where: { isBlocked: false },
                include: [
                    {
                        model: SalesTarget,
                        // --- FIX: Corrected alias from 'targets' to 'salesTargets' ---
                        as: 'salesTargets',
                        attributes: ['targetAmount'],
                        where: { year: thisMonth.startDate.getFullYear(), month: thisMonth.startDate.getMonth() + 1 },
                        required: false
                    },
                    {
                        model: Invoice,
                        as: 'createdInvoices',
                        attributes: [[fn('SUM', col('grandTotal')), 'achievedAmount']],
                        where: {
                            status: 'Paid',
                            paidAt: { [Op.between]: [thisMonth.startDate, thisMonth.endDate] }
                        },
                        required: false
                    }
                ],
                group: ['Member.id', 'salesTargets.id', 'createdInvoices.id']
            })
        ]);

        const overallStats = { queries: totalLeads, inProgress: projectsInProgress, clients: totalClients, completed: completedProjects };

        const totalSalesComparison = {
            labels: ['Last Month', 'This Month'],
            datasets: salesByMember.map((item, index) => ({
                label: item.creator ? item.creator.name : 'Unknown', 
                data: [parseFloat(item.dataValues.lastMonthSales) || 0, parseFloat(item.dataValues.thisMonthSales) || 0],
            }))
        };
        
        const leadPipeline = {
            labels: leadStagesData.map(item => item.stage),
            values: leadStagesData.map(item => parseInt(item.count, 10)),
        };

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const revenueLabels = Array.from({ length: 6 }).map((_, i) => {
            const d = new Date(); d.setMonth(d.getMonth() - 5 + i);
            return monthNames[d.getMonth()];
        });

        const revenueAndTargets = {};
        revenueByMember.forEach(item => {
            const memberName = item.creator ? item.creator.name : 'Unknown';
            if (!revenueAndTargets[memberName]) {
                revenueAndTargets[memberName] = { revenueData: Array(6).fill(0), targetData: Array(6).fill(null) };
            }
            const monthIndex = revenueLabels.findIndex(label => label === monthNames[item.dataValues.month - 1]);
            if (monthIndex !== -1) {
                revenueAndTargets[memberName].revenueData[monthIndex] += parseFloat(item.dataValues.totalRevenue);
            }
        });

        targetsData.forEach(target => {
            const memberName = target.member ? target.member.name : 'Unknown';
            if (!revenueAndTargets[memberName]) {
                revenueAndTargets[memberName] = { revenueData: Array(6).fill(0), targetData: Array(6).fill(null) };
            }
            const monthIndex = revenueLabels.findIndex(label => label === monthNames[target.month - 1]);
            if (monthIndex !== -1) {
                revenueAndTargets[memberName].targetData[monthIndex] = parseFloat(target.targetAmount);
            }
        });

        const revenueLastSixMonths = {
            labels: revenueLabels,
            datasets: Object.entries(revenueAndTargets).flatMap(([name, data], index) => [
                {
                    type: 'bar',
                    label: `${name} Revenue`,
                    data: data.revenueData,
                    backgroundColor: `hsla(${210 + index * 40}, 80%, 60%, 0.7)`,
                    order: 2,
                },
                {
                    type: 'line',
                    label: `${name} Target`,
                    data: data.targetData,
                    borderColor: `hsl(${10 + index * 40}, 90%, 55%)`,
                    fill: false,
                    tension: 0.4,
                    order: 1,
                }
            ])
        };

        const memberTargetAchievements = memberAchievements.map(m => ({
            name: m.name,
            // --- FIX: Corrected property access from 'targets' to 'salesTargets' ---
            target: m.salesTargets[0]?.targetAmount || 0,
            achieved: m.createdInvoices[0]?.dataValues.achievedAmount || 0,
        }));
        
        return { overallStats, totalSalesComparison, leadPipeline, revenueLastSixMonths, memberTargetAchievements, isAdmin };

    } else { // Member-specific data
        const [
            totalLeads, projectsInProgress, totalClients, completedProjects,
            thisMonthSales, lastMonthSales, leadStagesData, revenueData, memberTargets
        ] = await Promise.all([
            Lead.count({ where: { salesmanId: memberId } }),
            Lead.count({ where: { salesmanId: memberId, stage: { [Op.notIn]: ['Deal Closed', 'Deal Lost', 'Cancelled'] } } }),
            Customer.count({ where: { salesmanId: memberId } }),
            Lead.count({ where: { salesmanId: memberId, stage: 'Deal Closed' } }),
            Invoice.sum('grandTotal', { where: { createdById: memberId, status: 'Paid', paidAt: { [Op.between]: [thisMonth.startDate, thisMonth.endDate] } } }),
            Invoice.sum('grandTotal', { where: { createdById: memberId, status: 'Paid', paidAt: { [Op.between]: [lastMonth.startDate, lastMonth.endDate] } } }),
            Lead.findAll({ attributes: ['stage', [fn('COUNT', 'id'), 'count']], where: { salesmanId: memberId }, group: ['stage'], raw: true }),
            Invoice.findAll({
                attributes: [[fn('MONTH', col('paidAt')), 'month'], [fn('SUM', col('grandTotal')), 'totalRevenue']],
                where: { createdById: memberId, status: 'Paid', paidAt: { [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 6)) } },
                group: [fn('MONTH', col('paidAt'))], raw: true,
            }),
            SalesTarget.findAll({ where: { memberId, year: new Date().getFullYear() }})
        ]);
        
        const overallStats = { queries: totalLeads || 0, inProgress: projectsInProgress || 0, clients: totalClients || 0, completed: completedProjects || 0 };
        const totalSalesComparison = {
            labels: ['Last Month', 'This Month'],
            values: [lastMonthSales || 0, thisMonthSales || 0],
        };
        const leadPipeline = {
            labels: leadStagesData.map(item => item.stage),
            values: leadStagesData.map(item => parseInt(item.count, 10)),
        };
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const revenueLabels = Array.from({ length: 6 }).map((_, i) => {
            const d = new Date(); d.setMonth(d.getMonth() - 5 + i);
            return monthNames[d.getMonth()];
        });
        const revenueValues = Array(6).fill(0);
        const targetValues = Array(6).fill(null);

        revenueData.forEach(d => {
            const monthIndex = revenueLabels.findIndex(label => label === monthNames[d.month - 1]);
            if (monthIndex !== -1) revenueValues[monthIndex] = parseFloat(d.totalRevenue);
        });

        memberTargets.forEach(target => {
            const monthIndex = revenueLabels.findIndex(label => label === monthNames[target.month - 1]);
            if (monthIndex !== -1) targetValues[monthIndex] = parseFloat(target.targetAmount);
        });
        
        const revenueLastSixMonths = {
            labels: revenueLabels,
            datasets: [
                { type: 'bar', label: 'Your Revenue', data: revenueValues, backgroundColor: 'hsla(210, 80%, 60%, 0.7)', order: 2 },
                { type: 'line', label: 'Your Target', data: targetValues, borderColor: 'hsl(10, 90%, 55%)', fill: false, tension: 0.4, order: 1 }
            ]
        };

        const currentMonthTarget = memberTargets.find(t => t.month === new Date().getMonth() + 1)?.targetAmount || 0;
        const memberTargetAchievements = [{
            name: 'Your Achievement',
            target: currentMonthTarget,
            achieved: thisMonthSales || 0
        }];

        return { overallStats, totalSalesComparison, leadPipeline, revenueLastSixMonths, memberTargetAchievements, isAdmin };
    }
};

// --- API ROUTES ---
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = { subjectId: req.subjectId, subjectType: req.subjectType };
        const data = await getDashboardData(user);
        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching dashboard data.' });
    }
});

module.exports = router;
