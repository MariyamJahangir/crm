const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function signSubject(subjectType, subjectId, opts = {}) {
  return jwt.sign({ subjectType, subjectId }, JWT_SECRET, { expiresIn: '24h', ...opts });
}

module.exports = { signSubject };
