// utils/seedAdmins.js
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

async function seedAdmins() {
  if (!process.env.ADMIN_SEED_JSON) return;
  let entries = [];
  try {
    entries = JSON.parse(process.env.ADMIN_SEED_JSON); // [{ name, email, password }, ...]
  } catch (e) {
    console.error('Invalid ADMIN_SEED_JSON:', e.message);
    return;
  }

  for (const a of entries) {
    if (!a?.email || !a?.name || !a?.password) continue;
    const existing = await Admin.findOne({ where: { email: a.email }, attributes: ['id'] });
    if (existing) continue;

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(a.password, salt);

    await Admin.create({
      name: a.name,
      email: a.email,
      password: hash,
      isVerified: true,
    });
  }
}

module.exports = { seedAdmins };
