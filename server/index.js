const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

// Initialize database (runs migrations + seeds)
require('./db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const appsRoutes = require('./routes/apps');
const adminRoutes = require('./routes/admin');
const { optionalAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── API routes ─────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/apps', appsRoutes);
app.use('/api/admin', adminRoutes);

// ── Serve uploaded files ───────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Serve static site ──────────────────────────────────────────────
// The existing static HTML is served from the repo root.
// Express will look for route/index.html automatically.
app.use(express.static(path.join(__dirname, '..'), {
  extensions: ['html'],
  index: 'index.html',
}));

// Fallback: try route/index.html for clean URLs like /pricing, /apps, etc.
app.get('*', (req, res, next) => {
  // Skip API routes and file requests
  if (req.path.startsWith('/api/') || req.path.includes('.')) return next();

  const htmlPath = path.join(__dirname, '..', req.path, 'index.html');
  res.sendFile(htmlPath, (err) => {
    if (err) next();
  });
});

// ── Error handling ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Lỗi server' });
});

// ── Start ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Trạm Sáng Tạo running at http://localhost:${PORT}`);
});

module.exports = app;
