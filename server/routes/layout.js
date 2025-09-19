const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth'); // Your auth middleware
const Admin = require('../models/Admin');
const Member = require('../models/Member');

/**
 * @route   GET /api/layout
 * @desc    Get dashboard layout for the authenticated user (Admin or Member)
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { subjectId, role } = req; // Assuming authenticateToken adds role ('admin' or 'member')
        let user;

        if (role === 'admin') {
            user = await Admin.findByPk(subjectId, { attributes: ['dashboardLayout'] });
        } else {
            user = await Member.findByPk(subjectId, { attributes: ['dashboardLayout'] });
        }

        if (user && user.dashboardLayout) {
            res.json({ success: true, layout: JSON.parse(user.dashboardLayout) });
        } else {
            res.json({ success: true, layout: null });
        }
    } catch (error) {
        console.error("Failed to retrieve layout:", error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

/**
 * @route   PUT /api/layout
 * @desc    Save dashboard layout for the authenticated user (Admin or Member)
 * @access  Private
 */
router.put('/', authenticateToken, async (req, res) => {
    const { layout } = req.body;
    if (!layout) {
        return res.status(400).json({ success: false, message: 'Layout data is required.' });
    }

    try {
        const { subjectId, role } = req;
        let user;

        if (role === 'admin') {
            user = await Admin.findByPk(subjectId);
        } else {
            user = await Member.findByPk(subjectId);
        }
        
        if (user) {
            await user.update({ dashboardLayout: JSON.stringify(layout) });
            res.json({ success: true, message: 'Layout saved.' });
        } else {
            res.status(404).json({ success: false, message: 'User not found.' });
        }
    } catch (error) {
        console.error("Failed to save layout:", error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;
