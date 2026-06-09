const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'tramsangtao-secret-key-change-in-production';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/** Middleware: require valid JWT (from header or cookie). */
function requireAuth(req, res, next) {
  const token =
    req.cookies.token ||
    (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));

  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, role, credits, avatar_url, is_active, created_at FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.is_active) return res.status(401).json({ error: 'Tài khoản không hợp lệ' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

/** Middleware: require admin role */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    next();
  });
}

/** Optional auth — attaches user if token present, but doesn't reject */
function optionalAuth(req, res, next) {
  const token =
    req.cookies.token ||
    (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, name, role, credits, avatar_url, is_active, created_at FROM users WHERE id = ?').get(decoded.id);
    if (user && user.is_active) req.user = user;
  } catch (err) { /* ignore invalid tokens */ }
  next();
}

module.exports = { JWT_SECRET, generateToken, requireAuth, requireAdmin, optionalAuth };
