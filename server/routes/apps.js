const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── Multer config ──────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|gif|mp4|mov|webm)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Định dạng file không được hỗ trợ'));
    }
  },
});

// ── App metadata ───────────────────────────────────────────────────
const APP_CREDITS = {
  'xoa-nen-anh':        1,
  'nang-cap-anh-4k':    2,
  'xoa-vat-the':        2,
  'doi-background':     1,
  'lam-mo-hau-canh':    1,
  'mo-rong-anh':        2,
  'phuc-che-anh-cu':    2,
  'to-mau-anh-cu':      2,
  'anh-chan-dung':       1,
  'anh-the-ai':         1,
  'mac-vest-ai':        2,
  'model-ai-ao':        2,
  'thay-do-ai':         2,
  'thay-kieu-toc':      2,
  'ghep-mat-ai':        2,
  'tao-anh-san-pham':   2,
  'tao-nen-san-pham':   1,
  'tao-video-san-pham': 5,
  'tao-video-tu-anh':   5,
  'ai-animal-dancing':  3,
  'ai-nhay-tu-nen-anh': 3,
  'ai-clone-video-aff': 5,
  'xoa-watermark':      1,
};

// ── GET /api/apps — list all apps ──────────────────────────────────
router.get('/', (req, res) => {
  const apps = Object.entries(APP_CREDITS).map(([slug, credits]) => ({
    slug,
    credits_per_use: credits,
    url: `/apps/${slug}`,
  }));
  res.json({ apps });
});

// ── POST /api/apps/:slug/process — submit a job ───────────────────
router.post('/:slug/process', requireAuth, upload.single('file'), (req, res) => {
  const { slug } = req.params;
  const creditsNeeded = APP_CREDITS[slug];

  if (creditsNeeded === undefined) {
    return res.status(404).json({ error: 'Ứng dụng không tồn tại' });
  }

  if (req.user.credits < creditsNeeded) {
    return res.status(402).json({
      error: 'Không đủ credits',
      credits_needed: creditsNeeded,
      credits_available: req.user.credits,
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'Vui lòng chọn file' });
  }

  const jobId = uuidv4();
  const inputPath = `/uploads/${req.file.filename}`;

  // Deduct credits
  db.prepare('UPDATE users SET credits = credits - ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(creditsNeeded, req.user.id);

  db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), req.user.id, -creditsNeeded, 'usage', `Sử dụng: ${slug}`);

  // Create job — in a real system this would queue async processing.
  // For now, immediately mark done and return the input as "output" (stub).
  db.prepare(`
    INSERT INTO jobs (id, user_id, app_slug, status, input_file, output_file, credits_used)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(jobId, req.user.id, slug, 'done', inputPath, inputPath, creditsNeeded);

  const updatedUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);

  res.json({
    job_id: jobId,
    status: 'done',
    output_url: inputPath,
    credits_remaining: updatedUser.credits,
    message: `Xử lý thành công! (demo — kết nối AI API thật để có kết quả thực)`,
  });
});

// ── GET /api/apps/:slug/info ───────────────────────────────────────
router.get('/:slug/info', (req, res) => {
  const { slug } = req.params;
  const credits = APP_CREDITS[slug];
  if (credits === undefined) {
    return res.status(404).json({ error: 'Ứng dụng không tồn tại' });
  }
  res.json({ slug, credits_per_use: credits });
});

module.exports = router;
