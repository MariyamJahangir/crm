const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const { authenticateToken } = require('../middleware/auth');
const Member = require('../models/Member');
const Invoice = require('../models/Invoices');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const SalesTarget = require('../models/SalesTarget');

const getDashboardData = async (user) => {
    const isAdmin = user && user.subjectType !== 'MEMBER';
    const memberId = !isAdmin ? user.subjectId : null;
    const thisMonth = {
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)
    };

    const [overallStatsData, leadStagesData] = await Promise.all([
        Promise.all([
            Lead.count({ where: isAdmin ? {} : { salesmanId: memberId } }),
            Lead.count({ where: { stage: { [Op.notIn]: ['Deal Closed', 'Deal Lost', 'Cancelled'] }, ...(isAdmin ? {} : { salesmanId: memberId }) } }),
            Customer.count({ where: isAdmin ? {} : { salesmanId: memberId } }),
            Lead.count({ where: { stage: 'Deal Closed', ...(isAdmin ? {} : { salesmanId: memberId }) } })
        ]),
        Lead.findAll({
            attributes: ['stage', [fn('COUNT', 'id'), 'count']],
            where: isAdmin ? {} : { salesmanId: memberId },
            group: ['stage'],
            raw: true
        })
    ]);

    const overallStats = { queries: overallStatsData[0], inProgress: overallStatsData[1], clients: overallStatsData[2], completed: overallStatsData[3] };
    const leadPipeline = { labels: leadStagesData.map(i => i.stage), values: leadStagesData.map(i => parseInt(i.count, 10)) };

    if (isAdmin) {
        const members = await Member.findAll({ attributes: ['id', 'name'], where: { isBlocked: false }, raw: true });
        const memberMap = new Map(members.map(m => [m.id, m.name]));

        const [memberAchievementsData, teamSalesTrendData, monthlySalesData] = await Promise.all([
            Member.findAll({
                attributes: ['id', [fn('SUM', col('createdInvoices.grandTotal')), 'achieved'], [fn('MAX', col('salesTargets.targetAmount')), 'target']],
                include: [
                    { model: Invoice, as: 'createdInvoices', attributes: [], where: { status: 'Paid', paidAt: { [Op.between]: [thisMonth.startDate, thisMonth.endDate] } }, required: false },
                    { model: SalesTarget, as: 'salesTargets', attributes: [], where: { year: thisMonth.startDate.getFullYear(), month: thisMonth.startDate.getMonth() + 1 }, required: false }
                ],
                where: { id: { [Op.in]: Array.from(memberMap.keys()) } }, group: ['Member.id'], raw: true,
            }),
            Invoice.findAll({
                attributes: ['createdById', [fn('SUM', col('grandTotal')), 'total'], [literal('DATE(paidAt)'), 'date']],
                where: { status: 'Paid', paidAt: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                group: ['createdById', literal('DATE(paidAt)')], raw: true,
            }),
            Invoice.findAll({
                attributes: [[fn('YEAR', col('paidAt')), 'year'], [fn('MONTH', col('paidAt')), 'month'], [fn('SUM', col('grandTotal')), 'totalSales']],
                where: { status: 'Paid', paidAt: { [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 6)) } },
                group: [fn('YEAR', col('paidAt')), fn('MONTH', col('paidAt'))], order: [[fn('YEAR', col('paidAt')), 'ASC'], [fn('MONTH', col('paidAt')), 'ASC']], raw: true,
            })
        ]);

        const achievementsMap = new Map(memberAchievementsData.map(m => [m.id, { achieved: parseFloat(m.achieved || 0), target: parseFloat(m.target || 0) }]));
        
        // ★★★ FIX: Added 'id' to the member achievement object ★★★
        const memberTargetAchievements = members.map(m => {
            const ach = achievementsMap.get(m.id) || { achieved: 0, target: 0 };
            return {
                id: m.id, // This was the missing piece
                name: m.name,
                achieved: ach.achieved,
                target: ach.target,
                isAchieved: ach.achieved >= ach.target && ach.target > 0
            };
        });

        const trendLabels = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const salesByMemberByDay = {};
        teamSalesTrendData.forEach(s => {
            const memberName = memberMap.get(s.createdById);
            if (!memberName) return;
            if (!salesByMemberByDay[memberName]) salesByMemberByDay[memberName] = {};
            const dateLabel = new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            salesByMemberByDay[memberName][dateLabel] = parseFloat(s.total);
        });
        const teamSalesTrend = {
            labels: trendLabels,
            datasets: Object.keys(salesByMemberByDay).map(name => ({ label: name, data: trendLabels.map(label => salesByMemberByDay[name][label] || 0) }))
        };
        
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlySalesMap = new Map(monthlySalesData.map(d => [`${d.year}-${d.month}`, parseFloat(d.totalSales)]));
        const monthlySalesLabels = []; const monthlySalesValues = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            monthlySalesLabels.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
            monthlySalesValues.push(monthlySalesMap.get(`${d.getFullYear()}-${d.getMonth() + 1}`) || 0);
        }
        const monthlySales = { labels: monthlySalesLabels, values: monthlySalesValues };

        return { isAdmin, overallStats, leadPipeline, memberTargetAchievements, teamSalesTrend, monthlySales };

    } else {
        const [memberTargetData, memberDailySalesData, memberMonthlySalesData] = await Promise.all([
            Promise.all([
                SalesTarget.findOne({ where: { memberId, year: thisMonth.startDate.getFullYear(), month: thisMonth.startDate.getMonth() + 1 } }),
                Invoice.sum('grandTotal', { where: { createdById: memberId, status: 'Paid', paidAt: { [Op.between]: [thisMonth.startDate, thisMonth.endDate] } } })
            ]),
            Invoice.findAll({
                attributes: [[literal('DATE(paidAt)'), 'date'], [fn('SUM', col('grandTotal')), 'total']],
                where: { createdById: memberId, status: 'Paid', paidAt: { [Op.between]: [thisMonth.startDate, thisMonth.endDate] } },
                group: [literal('DATE(paidAt)')], order: [[literal('DATE(paidAt)'), 'ASC']], raw: true,
            }),
            Invoice.findAll({
                attributes: [[fn('YEAR', col('paidAt')), 'year'], [fn('MONTH', col('paidAt')), 'month'], [fn('SUM', col('grandTotal')), 'totalSales']],
                where: { createdById: memberId, status: 'Paid', paidAt: { [Op.gte]: new Date(new Date().setMonth(new Date().getMonth() - 6)) } },
                group: [fn('YEAR', col('paidAt')), fn('MONTH', col('paidAt'))], order: [[fn('YEAR', col('paidAt')), 'ASC'], [fn('MONTH', col('paidAt')), 'ASC']], raw: true,
            })
        ]);

        const target = parseFloat(memberTargetData[0]?.targetAmount || 0);
        const achieved = memberTargetData[1] || 0;
        const memberTargetAchievements = [{
            id: memberId,
            name: 'Your Achievement',
            target,
            achieved,
            isAchieved: achieved >= target && target > 0
        }];
        
        const daysInMonth = new Date(thisMonth.startDate.getFullYear(), thisMonth.startDate.getMonth() + 1, 0).getDate();
        const dailySalesLabels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
        const salesByDay = new Map(memberDailySalesData.map(d => [new Date(d.date).getDate(), parseFloat(d.total)]));
        
        const memberDailySales = {
            labels: dailySalesLabels,
            values: dailySalesLabels.map(dayLabel => salesByDay.get(parseInt(dayLabel)) || 0)
        };
        
        return { isAdmin, overallStats, leadPipeline, memberTargetAchievements, memberDailySales, memberMonthlySales: memberMonthlySalesData };
    }
};

router.get('/', authenticateToken, async (req, res) => {
    try {
        const data = await getDashboardData({ subjectId: req.subjectId, subjectType: req.subjectType });
        res.json({ success: true, data });
    } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching dashboard data.' });
    }
});

module.exports = router;
