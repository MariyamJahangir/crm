const jwt = require('jsonwebtoken');

/**
 * Authenticate using Authorization: Bearer <token>
 * Sets req.subjectType ('ADMIN'|'MEMBER') and req.subjectId (ObjectId string)
 */
const authenticateToken = (req, res, next) => {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header) return res.status(401).json({ success: false, message: 'Access token required' });

  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) return res.status(401).json({ success: false, message: 'Access token is required' });

  const secret = process.env.JWT_SECRET || 'your-secret-key';

  jwt.verify(token, secret, (err, payload) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    if (!payload || !payload.subjectType || !payload.subjectId) {
      return res.status(403).json({ success: false, message: 'Invalid token payload' });
    }
    req.subjectType = payload.subjectType; // 'ADMIN' | 'MEMBER'
    req.subjectId = payload.subjectId;
    next();
  });
};

const isAdmin = (req) => req.subjectType === 'ADMIN';
const isMember = (req) => req.subjectType === 'MEMBER';

module.exports = { authenticateToken, isAdmin, isMember };
