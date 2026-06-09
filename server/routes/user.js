const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/user/profile ──────────────────────────────────────────
router.get('/profile', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ── PUT /api/user/profile ──────────────────────────────────────────
router.put('/profile', requireAuth, (req, res) => {
  const { name } = req.body;
  if (name !== undefined) {
    db.prepare('UPDATE users SET name = ?, updated_at = datetime(\'now\') WHERE id = ?').run(name, req.user.id);
  }
  const updated = db.prepare('SELECT id, email, name, role, credits, avatar_url, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: updated });
});

// ── GET /api/user/credits ──────────────────────────────────────────
router.get('/credits', requireAuth, (req, res) => {
  const balance = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);
  const history = db.prepare(`
    SELECT id, amount, type, description, created_at
    FROM credit_transactions WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  res.json({ credits: balance.credits, history });
});

// ── POST /api/user/purchase-credits ────────────────────────────────
router.post('/purchase-credits', requireAuth, (req, res) => {
  const { package_id } = req.body;

  const packages = {
    starter:  { credits: 100,  price: 99000,  name: 'Starter' },
    pro:      { credits: 500,  price: 299000, name: 'Pro' },
    business: { credits: 2000, price: 799000, name: 'Business' },
  };

  const pkg = packages[package_id];
  if (!pkg) return res.status(400).json({ error: 'Gói không hợp lệ' });

  // In production, integrate real payment (MoMo, bank transfer).
  // For now, grant credits immediately as a demo.
  db.prepare('UPDATE users SET credits = credits + ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(pkg.credits, req.user.id);

  db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), req.user.id, pkg.credits, 'purchase', `Mua gói ${pkg.name} — ${pkg.price.toLocaleString()}đ`);

  const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);
  res.json({ credits: user.credits, message: `Đã nạp ${pkg.credits} credits` });
});

// ── GET /api/user/jobs ─────────────────────────────────────────────
router.get('/jobs', requireAuth, (req, res) => {
  const jobs = db.prepare(`
    SELECT id, app_slug, status, input_file, output_file, credits_used, created_at
    FROM jobs WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  res.json({ jobs });
});

module.exports = router;
