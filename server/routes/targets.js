const express = require('express');
const router = express.Router();
const { authenticateToken, isAdmin } = require('../middleware/auth');
const SalesTarget = require('../models/SalesTarget');
const Member = require('../models/Member');

// GET all active members
router.get('/members', authenticateToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });
    try {
        const members = await Member.findAll({ 
            attributes: ['id', 'name'], 
            where: { isBlocked: false } 
        });
        res.json({ success: true, data: members });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error fetching members.' });
    }
});

// POST to set or update a sales target
router.post('/', authenticateToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { memberId, year, month, targetAmount } = req.body;

    if (!memberId || !year || !month || targetAmount === undefined) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const [target, created] = await SalesTarget.findOrCreate({
            where: { memberId, year, month },
            defaults: { targetAmount: parseFloat(targetAmount) }
        });

        if (!created) {
            target.targetAmount = parseFloat(targetAmount);
            await target.save();
        }
        res.json({ success: true, message: `Target successfully ${created ? 'set' : 'updated'}.` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to set sales target.' });
    }
});

// NEW: POST to set a target for all members
router.post('/bulk', authenticateToken, async (req, res) => {
    if (!isAdmin(req)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const { year, month, targetAmount } = req.body;
    if (!year || !month || targetAmount === undefined) {
        return res.status(400).json({ success: false, message: 'Year, month, and target amount are required.' });
    }

    try {
        const members = await Member.findAll({ where: { isBlocked: false } });
        const promises = members.map(async (member) => {
            const [target, created] = await SalesTarget.findOrCreate({
                where: { memberId: member.id, year, month },
                defaults: { targetAmount: parseFloat(targetAmount) }
            });

            if (!created) {
                target.targetAmount = parseFloat(targetAmount);
                await target.save();
            }
        });
        
        await Promise.all(promises);
        res.json({ success: true, message: `Targets successfully set/updated for all ${members.length} members.` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to set bulk sales targets.' });
    }
});

module.exports = router;
