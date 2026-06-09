const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { PROCESSORS } = require('../processors');

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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|webp|gif|mp4|mov|webm|mp3|wav|ogg|aac|flac|txt)$/i;
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
  'lam-net-video':      2,
  'tai-tiktok':         1,
  'tai-facebook':       1,
  'tai-youtube':        1,
  'cat-video':          1,
  'ghep-video':         1,
  'cat-mp3':            1,
  'ghep-mp3':           1,
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
router.post('/:slug/process', requireAuth, upload.single('file'), async (req, res) => {
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
  const inputWebPath = `/uploads/${req.file.filename}`;
  const inputAbsPath = path.join(uploadsDir, req.file.filename);

  // Deduct credits
  db.prepare('UPDATE users SET credits = credits - ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(creditsNeeded, req.user.id);

  db.prepare(`
    INSERT INTO credit_transactions (id, user_id, amount, type, description)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), req.user.id, -creditsNeeded, 'usage', `Sử dụng: ${slug}`);

  // Create job as processing
  db.prepare(`
    INSERT INTO jobs (id, user_id, app_slug, status, input_file, output_file, credits_used)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(jobId, req.user.id, slug, 'processing', inputWebPath, null, creditsNeeded);

  try {
    const processor = PROCESSORS[slug];
    if (!processor) {
      throw new Error('Processor not found for: ' + slug);
    }

    // Parse processing options from request body
    const options = {};
    if (req.body.start) options.start = parseFloat(req.body.start);
    if (req.body.end) options.end = parseFloat(req.body.end);

    const outputAbsPath = await processor(inputAbsPath, options);
    const outputWebPath = '/uploads/' + path.basename(outputAbsPath);

    // Update job as done
    db.prepare('UPDATE jobs SET status = ?, output_file = ? WHERE id = ?')
      .run('done', outputWebPath, jobId);

    const updatedUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);

    res.json({
      job_id: jobId,
      status: 'done',
      output_url: outputWebPath,
      credits_remaining: updatedUser.credits,
      message: 'Xử lý thành công!',
    });
  } catch (err) {
    console.error(`Processing error [${slug}]:`, err.message);

    // Update job as failed
    db.prepare('UPDATE jobs SET status = ? WHERE id = ?')
      .run('failed', jobId);

    // Refund credits on failure
    db.prepare('UPDATE users SET credits = credits + ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(creditsNeeded, req.user.id);
    db.prepare(`
      INSERT INTO credit_transactions (id, user_id, amount, type, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), req.user.id, creditsNeeded, 'refund', `Hoàn credits: ${slug} (lỗi xử lý)`);

    const updatedUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(req.user.id);

    res.status(500).json({
      error: 'Xử lý thất bại: ' + err.message,
      credits_remaining: updatedUser.credits,
      message: 'Credits đã được hoàn lại.',
    });
  }
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
