// routes/leads.search.sql.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Member = require('../models/Member');
const { Op } = require('sequelize');

const router = express.Router();

router.get('/search', authenticateToken, async (req, res) => {
  try {
    const q = String(req.query.query || '').trim();
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);

    // Show ALL leads to any authenticated user (intentionally no role filter)
    const where = {};
    if (q) {
      where[Op.or] = [
        { uniqueNumber: { [Op.like]: `%${q}%` } },
        { '$customer.companyName$': { [Op.like]: `%${q}%` } },
      ];
    }

    const include = [
      { model: Customer, as: 'customer', attributes: ['id','companyName'] },
      { model: Member, as: 'salesman', attributes: ['id','name','email'] },
    ];

    const { rows, count } = await Lead.findAndCountAll({
      where,
      include,
      order: [['createdAt','DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true,
      // subQuery: false, // Uncomment if your dialect paginates oddly with includes
    });

    const leads = rows.map(l => ({
      id: l.id,
      uniqueNumber: l.uniqueNumber,
      companyName: l.customer?.companyName || '',
      contactPerson: l.contactPerson || '',
      mobile: l.mobile || '',
      email: l.email || '',
      salesman: l.salesman ? { id: l.salesman.id, name: l.salesman.name, email: l.salesman.email } : null,
      customerId: l.customer?.id || null,
    }));

    res.json({ success: true, leads, page, pageSize, total: count });
  } catch (e) {
    console.error('Leads search error:', e.message);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

module.exports = router;
