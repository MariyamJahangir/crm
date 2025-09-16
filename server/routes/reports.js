const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Member = require('../models/Member');
const Lead = require('../models/Lead');
const Invoice = require('../models/Invoices');
const sequelize = require('../config/database');
const { Op } = require('sequelize');
// Import subDays and startOfDay for daily calculations
const { subDays, format, startOfDay } = require('date-fns');

const router = express.Router();

router.get('/sales-by-member', authenticateToken, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    const members = await Member.findAll({ attributes: ['id', 'name'] });

    if (members.length === 0) {
      return res.json({ success: true, report: [] });
    }

    const memberIds = members.map(m => m.id);
    // --- CHANGE: Set the time window to the last 30 days ---
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 29));

    const leads = await Lead.findAll({
      where: {
        createdAt: { [Op.gte]: thirtyDaysAgo },
        creatorId: { [Op.in]: memberIds }
      },
      attributes: ['creatorId', 'createdAt'],
    });

    const invoices = await Invoice.findAll({
      where: {
        status: 'Paid',
        createdAt: { [Op.gte]: thirtyDaysAgo },
        createdById: { [Op.in]: memberIds }
      },
      attributes: ['createdById', 'grandTotal', 'createdAt'],
    });

    const report = members.map(member => {
      const memberId = member.id;

      const memberLeads = leads.filter(l => l.creatorId === memberId);
      const memberInvoices = invoices.filter(i => i.createdById === memberId);

      // --- NOTE: These totals still reflect the 30-day window ---
      const dealsTotalValue = memberInvoices.reduce((sum, inv) => sum + parseFloat(inv.grandTotal), 0);
      const dealsWon = memberInvoices.length;
      const dealsAverageValue = dealsWon > 0 ? dealsTotalValue / dealsWon : 0;

      const conversionRateHistory = [];
      // --- CHANGE: Loop through the last 30 days ---
      for (let i = 29; i >= 0; i--) {
        const date = subDays(new Date(), i);
        // Use 'yyyy-MM-dd' to group by day
        const dayKey = format(date, 'yyyy-MM-dd');

        // Filter leads and invoices for the specific day
        const dailyLeads = memberLeads.filter(l => format(new Date(l.createdAt), 'yyyy-MM-dd') === dayKey).length;
        const dailyDeals = memberInvoices.filter(i => format(new Date(i.createdAt), 'yyyy-MM-dd') === dayKey).length;

        const dailyConversionRate = dailyLeads > 0 ? (dailyDeals / dailyLeads) * 100 : 0;
        conversionRateHistory.push(dailyConversionRate);
      }

      return {
        memberId: member.id,
        memberName: member.name,
        dealsWon,
        dealsTotalValue,
        dealsAverageValue,
        conversionRateHistory, // This array now contains 30 data points
      };
    });

    res.json({ success: true, report });

  } catch (e) {
    console.error('Sales by member report error:', e);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
