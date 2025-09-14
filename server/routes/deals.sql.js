const express = require('express');
const { Op } = require('sequelize');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Lead = require('../models/Lead');
const Member =require('../models/Member');
const Customer = require('../models/Customer');
const Quote = require('../models/Quote');
const QuoteItem = require('../models/QuoteItem');
const Invoice = require('../models/Invoices');

const router = express.Router();

// GET /api/deals - Fetches a list of all closed deals for the table view
router.get('/', authenticateToken, async (req, res) => {
  try {
    const whereClause = { stage: 'Deal Closed' };
    if (!isAdmin(req)) {
      whereClause.salesmanId = req.subjectId;
    }

    const deals = await Lead.findAll({
      where: whereClause,
      attributes: ['id', 'uniqueNumber', 'contactPerson', 'updatedAt'],
      include: [
        { model: Member, as: 'salesman', attributes: ['id', 'name'] },
        { model: Customer, as: 'customer', attributes: ['id', 'companyName'] },
        {
          model: Quote,
          as: 'quotes',
          attributes: ['id', 'grandTotal'],
          where: { status: 'Accepted' },
          required: false,
          include: [{
            model: Invoice,
            as: 'invoice',
            attributes: ['invoiceNumber'],
            required: false
          }]
        }
      ],
      order: [['updatedAt', 'DESC']],
    });

    const formattedDeals = deals.map(deal => {
        const plainDeal = deal.toJSON();
        const acceptedQuote = plainDeal.quotes?.[0];
        plainDeal.quote = acceptedQuote || null;
        if (acceptedQuote) {
            plainDeal.invoice = acceptedQuote.invoice;
        }
        delete plainDeal.quotes;
        return plainDeal;
    });

    res.json({ success: true, deals: formattedDeals });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
});

// GET /api/deals/:id - Fetches all details for a single deal
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const whereClause = { id: req.params.id, stage: 'Deal Closed' };
        if (!isAdmin(req)) {
            whereClause.salesmanId = req.subjectId;
        }

        const deal = await Lead.findOne({
            where: whereClause,
            attributes: { exclude: ['stage', 'forecastCategory'] },
            include: [
                { model: Member, as: 'salesman', attributes: ['id', 'name'] },
                { model: Customer, as: 'customer' },
                {
                    model: Quote,
                    as: 'quotes',
                    where: { status: 'Accepted' },
                    required: false,
                    include: [
                        { model: QuoteItem, as: 'items' },
                        { model: Invoice, as: 'invoice', required: false }
                    ]
                }
            ]
        });

        if (!deal) {
            return res.status(404).json({ success: false, message: 'Deal not found or you do not have permission to view it.' });
        }
        
        const plainDeal = deal.toJSON();
        plainDeal.quote = plainDeal.quotes?.[0] || null;
        delete plainDeal.quotes;

        res.json({ success: true, deal: plainDeal });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
    }
});

module.exports = router;
