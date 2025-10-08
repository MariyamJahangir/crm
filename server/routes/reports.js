const express = require('express');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const Lead = require('../models/Lead');
const Member = require('../models/Member');
const Quote = require('../models/Quote');
const { Op, fn, col, literal } = require('sequelize');
const { startOfDay, endOfDay, add, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } = require('date-fns');


const router = express.Router();


const getDateRange = (filter) => {
    const now = new Date();
    switch (filter) {
        case 'today': return { start: startOfDay(now), end: endOfDay(now) };
        case 'tomorrow': const tomorrow = add(now, { days: 1 }); return { start: startOfDay(tomorrow), end: endOfDay(tomorrow) };
        case 'this_week': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
        case 'next_week': const nextWeek = add(now, { weeks: 1 }); return { start: startOfWeek(nextWeek, { weekStartsOn: 1 }), end: endOfWeek(nextWeek, { weekStartsOn: 1 }) };
        case 'this_month': return { start: startOfMonth(now), end: endOfMonth(now) };
        case 'this_quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) };
        case 'this_year': return { start: startOfYear(now), end: endOfYear(now) };
        case 'next_month': const nextMonth = add(now, { months: 1 }); return { start: startOfMonth(nextMonth), end: endOfMonth(nextMonth) };
        case 'next_quarter': const nextQuarter = add(now, { quarters: 1 }); return { start: startOfQuarter(nextQuarter), end: endOfQuarter(nextQuarter) };
        case 'next_year': const nextYear = add(now, { years: 1 }); return { start: startOfYear(nextYear), end: endOfYear(nextYear) };
        default: return null;
    }
};


router.post('/leads', authenticateToken, async (req, res) => {
    try {
        const { dateFilter, customStartDate, customEndDate, filters, sortBy, sortOrder, page = 1, pageSize = 20 } = req.body;
        
        let where = { [Op.and]: [] };
        const offset = (page - 1) * pageSize;
        const limit = parseInt(pageSize, 10);


        if (!isAdmin(req)) {
            where[Op.or] = [{ 'creatorId': req.subjectId }, { 'salesmanId': req.subjectId }];
        }


        let dateRange = null;
        if (dateFilter === 'custom' && customStartDate && customEndDate) {
            dateRange = { start: startOfDay(new Date(customStartDate)), end: endOfDay(new Date(customEndDate)) };
        } else if (dateFilter !== 'all_time') {
            dateRange = getDateRange(dateFilter);
        }

        // **FIX START: Robust Closing Date Filter**
        if (dateRange) {
            // Use a CASE statement to safely extract the last closing date, preventing errors on empty arrays.
            const latestClosingDateExpression = `
                CASE
                    WHEN \`Lead\`.\`closingDates\` IS NOT NULL AND JSON_LENGTH(\`Lead\`.\`closingDates\`) > 0 THEN
                        CAST(JSON_UNQUOTE(JSON_EXTRACT(\`Lead\`.\`closingDates\`, CONCAT('$[', JSON_LENGTH(\`Lead\`.\`closingDates\`) - 1, ']'))) AS DATETIME)
                    ELSE
                        NULL
                END
            `;
            // Use a raw literal for the WHERE clause to avoid issues with Sequelize's query generation
            where[Op.and].push(
                literal(`(${latestClosingDateExpression}) BETWEEN '${dateRange.start.toISOString()}' AND '${dateRange.end.toISOString()}'`)
            );
        }
        // **FIX END**
        
        if (filters && Array.isArray(filters)) {
            filters.forEach(filter => {
                const { field, include } = filter;
                if (!include || include.length === 0) return;
                
                if (['stage', 'forecastCategory', 'companyName'].includes(field)) {
                    where[Op.and].push({ [field]: { [Op.in]: include } });
                } else if (field === 'salesmanName') {
                    where[Op.and].push({ '$salesman.name$': { [Op.in]: include } });
                } 
                // **FIX START: Robust GP% Filter**
                else if (field === 'gpPercentage') {
                    const gpSubquery = `(SELECT profitPercent FROM quotes WHERE quotes.leadId = Lead.id AND quotes.quoteNumber = Lead.quoteNumber LIMIT 1)`;
                    
                    const rangeOrConditions = include.map(rangeStr => {
                        const [min, max] = rangeStr.split('-').map(Number);
                        if (isNaN(min) || isNaN(max)) return null;
                        return literal(`(${gpSubquery} BETWEEN ${min} AND ${max})`);
                    }).filter(Boolean);

                    if (rangeOrConditions.length > 0) {
                        where[Op.and].push({ [Op.or]: rangeOrConditions });
                    }
                }
                // **FIX END**
            });
        }
        
        // **FIX START: Robust Sorting Logic**
        let order;
        if (sortBy) {
            const direction = sortOrder || 'ASC';
            if (sortBy === 'closingDate') {
                const latestClosingDateExpression = `
                    CASE
                        WHEN \`Lead\`.\`closingDates\` IS NOT NULL AND JSON_LENGTH(\`Lead\`.\`closingDates\`) > 0 THEN
                            CAST(JSON_UNQUOTE(JSON_EXTRACT(\`Lead\`.\`closingDates\`, CONCAT('$[', JSON_LENGTH(\`Lead\`.\`closingDates\`) - 1, ']'))) AS DATETIME)
                        ELSE
                            NULL
                    END
                `;
                order = [[literal(latestClosingDateExpression), direction]];
            } else if (sortBy === 'salesmanName') {
                order = [[{ model: Member, as: 'salesman' }, 'name', direction]];
            } else if (['quoteValue', 'gpAmount', 'gpPercentage'].includes(sortBy)) {
                order = [[literal(sortBy), direction]];
            } else {
                order = [[sortBy, direction]];
            }
        } else {
            order = [['createdAt', 'DESC']];
        }
        // **FIX END**
        
        if (where[Op.and].length === 0) delete where[Op.and];
        
        const { count, rows } = await Lead.findAndCountAll({
            attributes: [
                'id', 'companyName', 'uniqueNumber', 'stage', 'forecastCategory', 'createdAt', 'closingDates', 'quoteNumber', 'previewUrl',
                [col('salesman.name'), 'salesmanName'],
                [literal(`(SELECT currency FROM quotes WHERE quotes.leadId = Lead.id AND quotes.quoteNumber = Lead.quoteNumber LIMIT 1)`), 'currencySymbol'],
                [literal(`(SELECT grandTotal FROM quotes WHERE quotes.leadId = Lead.id AND quotes.quoteNumber = Lead.quoteNumber LIMIT 1)`), 'quoteValue'],
                [literal(`(SELECT grossProfit FROM quotes WHERE quotes.leadId = Lead.id AND quotes.quoteNumber = Lead.quoteNumber LIMIT 1)`), 'gpAmount'],
                [literal(`(SELECT profitPercent FROM quotes WHERE quotes.leadId = Lead.id AND quotes.quoteNumber = Lead.quoteNumber LIMIT 1)`), 'gpPercentage']
            ],
            include: [
                { model: Member, as: 'salesman', attributes: [] },
            ],
            where,
            order,
            group: ['Lead.id'],
            subQuery: false,
            offset,
            limit,
        });

        res.json({ success: true, results: rows, totalRows: count.length });

    } catch (e) {
        console.error('Reports Error:', e.message, e.stack);
        res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
    }
});


router.get('/filter-options', authenticateToken, async (req, res) => {
    try {
        const totalValuationInUSD = literal(`(
    SELECT
        CASE
            WHEN currency = 'INR' THEN grandTotal / 83.0
            WHEN currency = 'EUR' THEN grandTotal / 0.92
            WHEN currency = 'GBP' THEN grandTotal / 0.79
            WHEN currency = 'AED' THEN grandTotal / 3.67
            WHEN currency = 'QAR' THEN grandTotal / 3.64
            WHEN currency = 'KWD' THEN grandTotal / 0.305
            WHEN currency = 'BHD' THEN grandTotal / 0.376
            WHEN currency = 'OMR' THEN grandTotal / 0.384
            ELSE grandTotal
        END
    FROM quotes
    WHERE quotes.leadId = Lead.id AND quotes.quoteNumber = Lead.quoteNumber
    LIMIT 1
)`);

        const [salesmen, leadNames, dbStats, valuationsByStage, valuationsByForecast] = await Promise.all([
            Member.findAll({ attributes: [[fn('DISTINCT', col('name')), 'name']], raw: true }),
            Lead.findAll({ attributes: [[fn('DISTINCT', col('companyName')), 'companyName']], raw: true }),
            Quote.findOne({
                attributes: [
                    [fn('MIN', col('grandTotal')), 'minQuoteValue'], [fn('MAX', col('grandTotal')), 'maxQuoteValue'],
                ],
                raw: true,
            }),
            Lead.findAll({
                attributes: [
                    'stage',
                    [fn('SUM', totalValuationInUSD), 'totalValuation']
                ],
                where: { quoteNumber: { [Op.ne]: null } },
                group: ['Lead.stage'],
                raw: true,
            }),
            Lead.findAll({
                attributes: [
                    'forecastCategory',
                    [fn('SUM', totalValuationInUSD), 'totalValuation']
                ],
                where: { quoteNumber: { [Op.ne]: null } },
                group: ['Lead.forecastCategory'],
                raw: true,
            })
        ]);
        
        const stageValuationMap = valuationsByStage.reduce((acc, item) => {
            acc[item.stage] = parseFloat(item.totalValuation) || 0;
            return acc;
        }, {});
        
        const forecastValuationMap = valuationsByForecast.reduce((acc, item) => {
            acc[item.forecastCategory] = parseFloat(item.totalValuation) || 0;
            return acc;
        }, {});

        const generateRanges = (min, max, steps = 5) => {
            if (typeof min !== 'number' || typeof max !== 'number' || min >= max) return [];
            const ranges = [];
            const step = Math.ceil((max - min) / steps);
            if (step === 0) return [`${Math.floor(min)}-${Math.ceil(max)}`];
            for (let i = 0; i < steps; i++) {
                const start = Math.floor(min + (i * step));
                const end = i === steps - 1 ? Math.ceil(max) : Math.floor(min + ((i + 1) * step) - 1);
                if (start < end) ranges.push(`${start}-${end}`);
            }
            return ranges;
        };

        res.json({
            success: true,
            salesmen: salesmen.map(s => s.name).filter(Boolean).sort(),
            leadNames: leadNames.map(l => l.companyName).filter(Boolean).sort(),
            stages: Lead.STAGES.map(stage => ({
                name: stage,
                valuation: stageValuationMap[stage] || 0,
            })),
            forecasts: Lead.FORECASTS.map(forecast => ({
                name: forecast,
                valuation: forecastValuationMap[forecast] || 0,
            })),
            quoteValueRanges: generateRanges(dbStats?.minQuoteValue, dbStats?.maxQuoteValue),
            gpPercentageRanges: ['0-10', '11-20', '21-30', '31-40', '41-50', '51-100'],
        });
    } catch (e) {
        console.error('Filter Options Error:', e.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;