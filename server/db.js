const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'data', 'studio.db');

// Ensure data directory exists
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema migrations ──────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name          TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    credits       INTEGER NOT NULL DEFAULT 10,
    avatar_url    TEXT DEFAULT NULL,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    app_slug    TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | done | failed
    input_file  TEXT,
    output_file TEXT,
    credits_used INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id),
    amount      INTEGER NOT NULL,
    type        TEXT NOT NULL,  -- 'purchase' | 'usage' | 'admin_grant' | 'signup_bonus'
    description TEXT DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Seed admin user if none exists ─────────────────────────────────

const adminExists = db.prepare('SELECT 1 FROM users WHERE role = ?').get('admin');
if (!adminExists) {
  const adminId = uuidv4();
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, credits)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(adminId, 'admin@caotrangai.com', hash, 'Admin', 'admin', 99999);

  db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), adminId, 99999, 'signup_bonus', 'Admin account seed');
}

module.exports = db;
