const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { generateToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/register ────────────────────────────────────────
router.post('/register', (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' });
  }

  const existing = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Email đã được sử dụng' });
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  const displayName = name || email.split('@')[0];
  const signupCredits = 10;

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, credits)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, email, hash, displayName, signupCredits);

  db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), id, signupCredits, 'signup_bonus', 'Tặng credits khi đăng ký');

  const user = db.prepare('SELECT id, email, name, role, credits, created_at FROM users WHERE id = ?').get(id);
  const token = generateToken(user);

  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 86400000 });
  res.json({ user, token });
});

// ── POST /api/auth/login ───────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
  }
  if (!row.is_active) {
    return res.status(403).json({ error: 'Tài khoản đã bị khóa' });
  }
  if (!bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
  }

  const user = { id: row.id, email: row.email, name: row.name, role: row.role, credits: row.credits, created_at: row.created_at };
  const token = generateToken(user);

  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 86400000 });
  res.json({ user, token });
});

// ── GET /api/auth/me ───────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── POST /api/auth/logout ──────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

module.exports = router;
