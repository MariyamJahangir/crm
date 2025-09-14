// utils/leadNumber.js
const { Op } = require('sequelize');
const Lead = require('../models/Lead');

async function generateUniqueLeadNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  // Day bounds in UTC (adjust if storing local time)
  const start = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  const end = new Date(`${yyyy}-${mm}-${dd}T23:59:59.999Z`);

  // Count leads created today
  const count = await Lead.count({
    where: { createdAt: { [Op.gte]: start, [Op.lte]: end } },
  });

  const seq = String(count + 1).padStart(4, '0');
  const candidate = `L-${yyyy}${mm}${dd}-${seq}`;

  // Collision guard if unique constraint races occur
  const exists = await Lead.findOne({ where: { uniqueNumber: candidate }, attributes: ['id'] });
  if (exists) return `${candidate}-${Date.now().toString().slice(-4)}`;

  return candidate;
}

module.exports = { generateUniqueLeadNumber };
