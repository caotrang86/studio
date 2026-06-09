const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { execSync } = require('child_process');

// ── Ensure required directories exist ──────────────────────────────
fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'data'), { recursive: true });

// ── Check system dependencies ──────────────────────────────────────
function checkDependency(cmd, name, installHint) {
  try {
    execSync(`which ${cmd} || where ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    // Fallback: try running the command directly
    try {
      execSync(`${cmd} -version`, { stdio: 'pipe', timeout: 5000 });
      return true;
    } catch {
      console.warn(`⚠️  ${name} chưa cài đặt — một số công cụ sẽ không hoạt động.`);
      console.warn(`   Cài đặt: ${installHint}`);
      return false;
    }
  }
}

const deps = {
  ffmpeg: checkDependency('ffmpeg', 'ffmpeg',
    'Windows: choco install ffmpeg | Mac: brew install ffmpeg | Linux: sudo apt install ffmpeg'),
  ytdlp: checkDependency('yt-dlp', 'yt-dlp',
    'pip install yt-dlp | hoặc: https://github.com/yt-dlp/yt-dlp#installation'),
};

// Export so processors can check availability
global.__dependencies = deps;

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

// ── Health check ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dependencies: {
      sharp: true,
      ffmpeg: deps.ffmpeg,
      ytdlp: deps.ytdlp,
    },
  });
});

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
  console.log(`\n🚀 CaoTrangAI running at http://localhost:${PORT}`);
  console.log(`   Image tools (sharp): ✅ ready`);
  console.log(`   Video/Audio tools (ffmpeg): ${deps.ffmpeg ? '✅ ready' : '❌ chưa cài ffmpeg'}`);
  console.log(`   Download tools (yt-dlp): ${deps.ytdlp ? '✅ ready' : '❌ chưa cài yt-dlp'}`);
  console.log('');
});

module.exports = app;
