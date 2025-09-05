// utils/otp.sql.js
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const Otp = require('../models/Otp');

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hashCode(code) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(code, salt);
}

async function verifyCode(code, codeHash) {
  return bcrypt.compare(code, codeHash);
}

// Create or update an OTP for a subject/purpose, invalidating prior active ones
async function createOrUpdateOtp(subjectType, subjectId, purpose) {
  // Invalidate prior active
  await Otp.update(
    { isUsed: true },
    { where: { subjectType, subjectId, purpose, isUsed: false } }
  );

  const code = generateOTP();
  const codeHash = await hashCode(code);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min
  const resendAfter = new Date(now.getTime() + 60 * 1000);     // 60 sec

  const rec = await Otp.create({
    subjectType,
    subjectId,
    purpose,
    codeHash,
    expiresAt,
    resendAfter,
    attempts: 0,
    maxAttempts: 5,
    isUsed: false,
  });

  return { code, record: rec };
}

// Cooldown check before resending OTP
async function canResend(subjectType, subjectId, purpose) {
  const current = await Otp.findOne({
    where: { subjectType, subjectId, purpose, isUsed: false },
    order: [['createdAt', 'DESC']],
  });
  if (!current) return true;
  const now = new Date();
  return now >= current.resendAfter;
}

// Verify and consume an OTP
// Returns { ok: boolean, reason?: 'EXPIRED' | 'MAX_ATTEMPTS' | 'INVALID' }
async function verifyOtp(subjectType, subjectId, purpose, code) {
  const rec = await Otp.findOne({
    where: { subjectType, subjectId, purpose, isUsed: false },
    order: [['createdAt', 'DESC']],
  });
  if (!rec) return { ok: false, reason: 'INVALID' };

  const now = new Date();
  if (rec.expiresAt < now) {
    await rec.update({ isUsed: true });
    return { ok: false, reason: 'EXPIRED' };
  }
  if (rec.attempts >= rec.maxAttempts) {
    await rec.update({ isUsed: true });
    return { ok: false, reason: 'MAX_ATTEMPTS' };
  }

  const ok = await verifyCode(code, rec.codeHash);
  await rec.update({ attempts: rec.attempts + 1 });

  if (!ok) return { ok: false, reason: 'INVALID' };

  await rec.update({ isUsed: true });
  return { ok: true };
}

module.exports = { generateOTP, hashCode, verifyCode, createOrUpdateOtp, verifyOtp, canResend };
