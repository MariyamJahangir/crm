const jwt = require('jsonwebtoken');
const Member = require('../models/Member');

const authenticateToken = async (req, res, next) => {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header) return res.status(401).json({ success: false, message: 'Access token required' });

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ success: false, message: 'Access token is required' });

  const secret = process.env.JWT_SECRET || 'your-secret-key';
  try {
    const payload = jwt.verify(token, secret);
    if (!payload || !payload.subjectType || !payload.subjectId) {
      return res.status(403).json({ success: false, message: 'Invalid token payload' });
    }
    req.subjectType = payload.subjectType; // 'ADMIN' | 'MEMBER'
    req.subjectId = payload.subjectId;

    // Blocked check only for members
    if (req.subjectType === 'MEMBER') {
      const m = await Member.findByPk(req.subjectId, { attributes: ['id','isBlocked'] });
      if (!m) return res.status(401).json({ success:false, message:'Account not found' });
      if (m.isBlocked) {
        return res.status(403).json({ success:false, message:'Account is blocked' });
      }
    }
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

const isAdmin = (req) => req.subjectType === 'ADMIN';
const isMember = (req) => req.subjectType === 'MEMBER';

module.exports = { authenticateToken, isAdmin, isMember };
