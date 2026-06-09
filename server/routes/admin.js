const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/admin/stats ───────────────────────────────────────────
router.get('/stats', requireAdmin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
  const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
  const totalCreditsUsed = db.prepare("SELECT COALESCE(SUM(ABS(amount)),0) as total FROM credit_transactions WHERE type = 'usage'").get().total;
  const todayJobs = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE created_at >= date('now')").get().count;
  const todayRegistrations = db.prepare("SELECT COUNT(*) as count FROM users WHERE created_at >= date('now')").get().count;

  // Most popular apps
  const popularApps = db.prepare(`
    SELECT app_slug, COUNT(*) as count
    FROM jobs
    GROUP BY app_slug
    ORDER BY count DESC
    LIMIT 10
  `).all();

  res.json({
    total_users: totalUsers,
    active_users: activeUsers,
    total_jobs: totalJobs,
    total_credits_used: totalCreditsUsed,
    today_jobs: todayJobs,
    today_registrations: todayRegistrations,
    popular_apps: popularApps,
  });
});

// ── GET /api/admin/users ───────────────────────────────────────────
router.get('/users', requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  let query = 'SELECT id, email, name, role, credits, is_active, created_at FROM users';
  let countQuery = 'SELECT COUNT(*) as total FROM users';
  const params = [];

  if (search) {
    const clause = ' WHERE email LIKE ? OR name LIKE ?';
    query += clause;
    countQuery += clause;
    params.push(`%${search}%`, `%${search}%`);
  }

  const total = db.prepare(countQuery).get(...params).total;
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  const users = db.prepare(query).all(...params, limit, offset);

  res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
});

// ── PUT /api/admin/users/:id ───────────────────────────────────────
router.put('/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, role, is_active, credits } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User không tồn tại' });

  if (name !== undefined) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
  if (role !== undefined) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  if (is_active !== undefined) db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
  if (credits !== undefined) {
    const diff = credits - user.credits;
    db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(credits, id);
    if (diff !== 0) {
      db.prepare(`
        INSERT INTO credit_transactions (id, user_id, amount, type, description)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), id, diff, 'admin_grant', `Admin điều chỉnh credits`);
    }
  }

  db.prepare("UPDATE users SET updated_at = datetime('now') WHERE id = ?").run(id);
  const updated = db.prepare('SELECT id, email, name, role, credits, is_active, created_at FROM users WHERE id = ?').get(id);
  res.json({ user: updated });
});

// ── GET /api/admin/jobs ────────────────────────────────────────────
router.get('/jobs', requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) as total FROM jobs').get().total;
  const jobs = db.prepare(`
    SELECT j.*, u.email as user_email, u.name as user_name
    FROM jobs j
    JOIN users u ON j.user_id = u.id
    ORDER BY j.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  res.json({ jobs, total, page, limit, pages: Math.ceil(total / limit) });
});

module.exports = router;
