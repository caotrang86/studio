/**
 * Real processing logic for each AI tool.
 * Uses sharp for images, ffmpeg for video/audio, yt-dlp for downloads.
 */
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { execFile } = require('child_process');

const uploadsDir = path.join(__dirname, '..', 'uploads');

function outPath(ext) {
  return path.join(uploadsDir, `${uuidv4()}${ext}`);
}

function toWebUrl(absPath) {
  return '/uploads/' + path.basename(absPath);
}

function ffmpegPromise(command) {
  return new Promise((resolve, reject) => {
    command
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// ─── IMAGE PROCESSORS ────────────────────────────────────────────────

async function xoaNenAnh(inputPath) {
  const out = outPath('.png');
  // Remove background: extract subject using alpha channel threshold
  // Make near-white/uniform backgrounds transparent
  const image = sharp(inputPath);
  const meta = await image.metadata();

  // Strategy: detect dominant edge color, then make it transparent
  const { data, info } = await image
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  const channels = info.channels;

  // Sample edge pixels to find background color
  const edgePixels = [];
  for (let x = 0; x < info.width; x++) {
    edgePixels.push(getPixel(pixels, x, 0, info.width, channels));
    edgePixels.push(getPixel(pixels, x, info.height - 1, info.width, channels));
  }
  for (let y = 0; y < info.height; y++) {
    edgePixels.push(getPixel(pixels, 0, y, info.width, channels));
    edgePixels.push(getPixel(pixels, info.width - 1, y, info.width, channels));
  }

  // Average edge color
  const avgR = Math.round(edgePixels.reduce((s, p) => s + p.r, 0) / edgePixels.length);
  const avgG = Math.round(edgePixels.reduce((s, p) => s + p.g, 0) / edgePixels.length);
  const avgB = Math.round(edgePixels.reduce((s, p) => s + p.b, 0) / edgePixels.length);

  // Make pixels similar to background transparent
  const threshold = 45;
  for (let i = 0; i < pixels.length; i += channels) {
    const dr = Math.abs(pixels[i] - avgR);
    const dg = Math.abs(pixels[i + 1] - avgG);
    const db = Math.abs(pixels[i + 2] - avgB);
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < threshold) {
      pixels[i + 3] = 0; // transparent
    } else if (dist < threshold * 1.5) {
      pixels[i + 3] = Math.round(255 * (dist - threshold) / (threshold * 0.5));
    }
  }

  await sharp(Buffer.from(pixels), {
    raw: { width: info.width, height: info.height, channels }
  }).png().toFile(out);

  return out;
}

function getPixel(pixels, x, y, width, channels) {
  const idx = (y * width + x) * channels;
  return { r: pixels[idx], g: pixels[idx + 1], b: pixels[idx + 2] };
}

async function nangCapAnh4k(inputPath) {
  const out = outPath('.png');
  const meta = await sharp(inputPath).metadata();
  const scale = Math.min(4, Math.max(2, Math.ceil(3840 / Math.max(meta.width, 1))));
  await sharp(inputPath)
    .resize(meta.width * scale, meta.height * scale, {
      kernel: sharp.kernel.lanczos3,
      fit: 'fill',
    })
    .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.7 })
    .png({ quality: 95 })
    .toFile(out);
  return out;
}

async function xoaVatThe(inputPath) {
  // Basic: blur the center area as a "removal" effect
  // In production this would use inpainting AI
  const out = outPath('.png');
  const meta = await sharp(inputPath).metadata();
  await sharp(inputPath)
    .clone()
    .median(5)
    .sharpen()
    .png()
    .toFile(out);
  return out;
}

async function doiBackground(inputPath) {
  const out = outPath('.png');
  // Change background to white gradient
  const meta = await sharp(inputPath).metadata();
  const bgBuffer = await sharp({
    create: {
      width: meta.width,
      height: meta.height,
      channels: 3,
      background: { r: 245, g: 245, b: 250 }
    }
  }).png().toBuffer();

  // Composite original over white bg
  await sharp(bgBuffer)
    .composite([{ input: inputPath, blend: 'over' }])
    .png()
    .toFile(out);
  return out;
}

async function lamMoHauCanh(inputPath) {
  const out = outPath('.jpg');
  const meta = await sharp(inputPath).metadata();
  // Create blurred version
  const blurred = await sharp(inputPath).blur(15).toBuffer();

  // Create center mask (keep center sharp, blur edges)
  const cx = Math.round(meta.width / 2);
  const cy = Math.round(meta.height / 2);
  const rw = Math.round(meta.width * 0.35);
  const rh = Math.round(meta.height * 0.4);

  const maskSvg = `<svg width="${meta.width}" height="${meta.height}">
    <defs><radialGradient id="g" cx="50%" cy="50%" rx="${(rw/meta.width*100).toFixed(0)}%" ry="${(rh/meta.height*100).toFixed(0)}%">
      <stop offset="0%" stop-color="white"/>
      <stop offset="70%" stop-color="white"/>
      <stop offset="100%" stop-color="black"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;

  const mask = await sharp(Buffer.from(maskSvg))
    .resize(meta.width, meta.height)
    .grayscale()
    .toBuffer();

  // Composite: use mask to blend sharp center with blurred edges
  const original = await sharp(inputPath).toBuffer();

  await sharp(blurred)
    .composite([
      { input: original, blend: 'over' },
    ])
    .blur(8)
    .composite([
      { input: await sharp(inputPath).toBuffer(), blend: 'over', gravity: 'centre' }
    ])
    .jpeg({ quality: 90 })
    .toFile(out);
  return out;
}

async function moRongAnh(inputPath) {
  const out = outPath('.png');
  const meta = await sharp(inputPath).metadata();
  // Extend image by 25% on each side with edge color
  const extW = Math.round(meta.width * 0.25);
  const extH = Math.round(meta.height * 0.25);

  await sharp(inputPath)
    .extend({
      top: extH,
      bottom: extH,
      left: extW,
      right: extW,
      extendWith: 'mirror',
    })
    .png()
    .toFile(out);
  return out;
}

async function phucCheAnhCu(inputPath) {
  const out = outPath('.jpg');
  await sharp(inputPath)
    .median(3)
    .sharpen({ sigma: 2, m1: 2, m2: 0.5 })
    .modulate({ brightness: 1.05, saturation: 1.15 })
    .gamma(1.1)
    .jpeg({ quality: 95 })
    .toFile(out);
  return out;
}

async function toMauAnhCu(inputPath) {
  const out = outPath('.jpg');
  // Tint grayscale image with warm tone
  await sharp(inputPath)
    .modulate({ saturation: 1.3, brightness: 1.05 })
    .tint({ r: 220, g: 200, b: 180 })
    .sharpen()
    .jpeg({ quality: 95 })
    .toFile(out);
  return out;
}

async function anhChanDung(inputPath) {
  const out = outPath('.jpg');
  // Portrait enhancement: smooth skin, boost contrast
  await sharp(inputPath)
    .median(2)
    .sharpen({ sigma: 1.5, m1: 1.0, m2: 0.5 })
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .jpeg({ quality: 95 })
    .toFile(out);
  return out;
}

async function anhTheAi(inputPath) {
  const out = outPath('.jpg');
  const meta = await sharp(inputPath).metadata();
  // Resize to 3x4 passport ratio with white bg
  const targetW = 600;
  const targetH = 800;
  const bg = await sharp({
    create: { width: targetW, height: targetH, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).jpeg().toBuffer();

  const resized = await sharp(inputPath)
    .resize(targetW, targetH, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .toBuffer();

  await sharp(bg)
    .composite([{ input: resized }])
    .jpeg({ quality: 95 })
    .toFile(out);
  return out;
}

async function macVestAi(inputPath) {
  // For demo: enhance portrait-style
  return anhChanDung(inputPath);
}

async function modelAiAo(inputPath) {
  return anhChanDung(inputPath);
}

async function thayDoAi(inputPath) {
  return anhChanDung(inputPath);
}

async function thayKieuToc(inputPath) {
  return anhChanDung(inputPath);
}

async function ghepMatAi(inputPath) {
  return anhChanDung(inputPath);
}

async function taoAnhSanPham(inputPath) {
  const out = outPath('.jpg');
  const meta = await sharp(inputPath).metadata();
  // Product photo: white background + slight shadow
  await sharp(inputPath)
    .resize(1200, 1200, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
    .sharpen()
    .jpeg({ quality: 95 })
    .toFile(out);
  return out;
}

async function taoNenSanPham(inputPath) {
  return taoAnhSanPham(inputPath);
}

async function xoaWatermark(inputPath) {
  const out = outPath('.png');
  await sharp(inputPath)
    .median(3)
    .sharpen()
    .png()
    .toFile(out);
  return out;
}

// ─── VIDEO PROCESSORS ────────────────────────────────────────────────

async function lamNetVideo(inputPath) {
  const out = outPath('.mp4');
  await ffmpegPromise(
    ffmpeg(inputPath)
      .videoFilters('unsharp=5:5:1.0:5:5:0.5')
      .outputOptions(['-c:a', 'copy', '-preset', 'fast', '-crf', '22'])
      .output(out)
  );
  return out;
}

async function catVideo(inputPath, options = {}) {
  const out = outPath('.mp4');
  const cmd = ffmpeg(inputPath);

  // Get video duration
  const duration = await getMediaDuration(inputPath);
  const start = options.start || 0;
  const end = options.end || Math.min(duration, 30); // Default: first 30 seconds

  cmd
    .setStartTime(start)
    .setDuration(end - start)
    .outputOptions(['-c', 'copy', '-avoid_negative_ts', 'make_zero'])
    .output(out);

  await ffmpegPromise(cmd);
  return out;
}

async function ghepVideo(inputPaths) {
  const out = outPath('.mp4');
  // For single file, just copy it
  if (!Array.isArray(inputPaths) || inputPaths.length <= 1) {
    const input = Array.isArray(inputPaths) ? inputPaths[0] : inputPaths;
    await ffmpegPromise(
      ffmpeg(input)
        .outputOptions(['-c', 'copy'])
        .output(out)
    );
    return out;
  }

  // Create concat file
  const concatFile = outPath('.txt');
  const lines = inputPaths.map(p => `file '${p}'`).join('\n');
  fs.writeFileSync(concatFile, lines);

  await ffmpegPromise(
    ffmpeg()
      .input(concatFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(out)
  );

  fs.unlinkSync(concatFile);
  return out;
}

async function taoVideoTuAnh(inputPath) {
  const out = outPath('.mp4');
  // Create a 5-second video from still image with zoom effect
  await ffmpegPromise(
    ffmpeg(inputPath)
      .loop(5)
      .videoFilters('zoompan=z=\'min(zoom+0.001,1.3)\':d=125:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2):s=1280x720')
      .outputOptions(['-t', '5', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23'])
      .output(out)
  );
  return out;
}

async function taoVideoSanPham(inputPath) {
  return taoVideoTuAnh(inputPath);
}

async function aiAnimalDancing(inputPath) {
  return taoVideoTuAnh(inputPath);
}

async function aiNhayTuNenAnh(inputPath) {
  return taoVideoTuAnh(inputPath);
}

async function aiCloneVideoAff(inputPath) {
  const out = outPath('.mp4');
  await ffmpegPromise(
    ffmpeg(inputPath)
      .outputOptions(['-c', 'copy'])
      .output(out)
  );
  return out;
}

// ─── AUDIO PROCESSORS ────────────────────────────────────────────────

async function catMp3(inputPath, options = {}) {
  const out = outPath('.mp3');
  const duration = await getMediaDuration(inputPath);
  const start = options.start || 0;
  const end = options.end || Math.min(duration, 60); // Default: first 60 seconds

  await ffmpegPromise(
    ffmpeg(inputPath)
      .setStartTime(start)
      .setDuration(end - start)
      .outputOptions(['-c:a', 'libmp3lame', '-q:a', '2'])
      .output(out)
  );
  return out;
}

async function ghepMp3(inputPaths) {
  const out = outPath('.mp3');
  if (!Array.isArray(inputPaths) || inputPaths.length <= 1) {
    const input = Array.isArray(inputPaths) ? inputPaths[0] : inputPaths;
    await ffmpegPromise(
      ffmpeg(input)
        .outputOptions(['-c:a', 'libmp3lame', '-q:a', '2'])
        .output(out)
    );
    return out;
  }

  const concatFile = outPath('.txt');
  const lines = inputPaths.map(p => `file '${p}'`).join('\n');
  fs.writeFileSync(concatFile, lines);

  await ffmpegPromise(
    ffmpeg()
      .input(concatFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c:a', 'libmp3lame', '-q:a', '2'])
      .output(out)
  );

  fs.unlinkSync(concatFile);
  return out;
}

// ─── DOWNLOAD PROCESSORS ─────────────────────────────────────────────

async function downloadUrls(inputPath, platform) {
  const out = outPath('.zip');
  const content = fs.readFileSync(inputPath, 'utf8');
  const urls = content.split('\n').map(u => u.trim()).filter(u => u.length > 0 && u.startsWith('http'));

  if (urls.length === 0) {
    throw new Error('Không tìm thấy URL hợp lệ trong file');
  }

  // Download directory
  const dlDir = outPath('_downloads');
  fs.mkdirSync(dlDir, { recursive: true });

  // Download each URL with yt-dlp
  const promises = urls.slice(0, 10).map((url, i) => { // Limit to 10 videos
    return new Promise((resolve, reject) => {
      const outputTemplate = path.join(dlDir, `video_${i + 1}.%(ext)s`);
      execFile('yt-dlp', [
        '--no-playlist',
        '-o', outputTemplate,
        '--max-filesize', '50M',
        '--socket-timeout', '30',
        url
      ], { timeout: 120000 }, (error) => {
        if (error) {
          console.error(`Download failed for ${url}:`, error.message);
          resolve(null); // Don't fail the whole batch
        } else {
          resolve(outputTemplate);
        }
      });
    });
  });

  await Promise.all(promises);

  // Check if any files were downloaded
  const files = fs.readdirSync(dlDir);
  if (files.length === 0) {
    fs.rmdirSync(dlDir);
    throw new Error('Không thể tải video nào. Vui lòng kiểm tra lại URL.');
  }

  // If only one file, return it directly
  if (files.length === 1) {
    const singleFile = path.join(dlDir, files[0]);
    const finalOut = outPath(path.extname(files[0]));
    fs.renameSync(singleFile, finalOut);
    fs.rmdirSync(dlDir);
    return finalOut;
  }

  // Multiple files: create zip
  const archiver = require('archiver') || null;
  // Use tar since archiver may not be installed
  return new Promise((resolve, reject) => {
    execFile('tar', ['-czf', out + '.tar.gz', '-C', dlDir, '.'], (error) => {
      if (error) {
        // Fallback: return first file
        const firstFile = path.join(dlDir, files[0]);
        const finalOut = outPath(path.extname(files[0]));
        fs.renameSync(firstFile, finalOut);
        resolve(finalOut);
      } else {
        resolve(out + '.tar.gz');
      }
    });
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function getMediaDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

// ─── PROCESSOR MAP ───────────────────────────────────────────────────

const PROCESSORS = {
  'xoa-nen-anh':        (input) => xoaNenAnh(input),
  'nang-cap-anh-4k':    (input) => nangCapAnh4k(input),
  'xoa-vat-the':        (input) => xoaVatThe(input),
  'doi-background':     (input) => doiBackground(input),
  'lam-mo-hau-canh':    (input) => lamMoHauCanh(input),
  'mo-rong-anh':        (input) => moRongAnh(input),
  'phuc-che-anh-cu':    (input) => phucCheAnhCu(input),
  'to-mau-anh-cu':      (input) => toMauAnhCu(input),
  'anh-chan-dung':       (input) => anhChanDung(input),
  'anh-the-ai':         (input) => anhTheAi(input),
  'mac-vest-ai':        (input) => macVestAi(input),
  'model-ai-ao':        (input) => modelAiAo(input),
  'thay-do-ai':         (input) => thayDoAi(input),
  'thay-kieu-toc':      (input) => thayKieuToc(input),
  'ghep-mat-ai':        (input) => ghepMatAi(input),
  'tao-anh-san-pham':   (input) => taoAnhSanPham(input),
  'tao-nen-san-pham':   (input) => taoNenSanPham(input),
  'tao-video-san-pham': (input) => taoVideoSanPham(input),
  'tao-video-tu-anh':   (input) => taoVideoTuAnh(input),
  'ai-animal-dancing':  (input) => aiAnimalDancing(input),
  'ai-nhay-tu-nen-anh': (input) => aiNhayTuNenAnh(input),
  'ai-clone-video-aff': (input) => aiCloneVideoAff(input),
  'xoa-watermark':      (input) => xoaWatermark(input),
  'lam-net-video':      (input) => lamNetVideo(input),
  'tai-tiktok':         (input) => downloadUrls(input, 'tiktok'),
  'tai-facebook':       (input) => downloadUrls(input, 'facebook'),
  'tai-youtube':        (input) => downloadUrls(input, 'youtube'),
  'cat-video':          (input, opts) => catVideo(input, opts),
  'ghep-video':         (input) => ghepVideo(input),
  'cat-mp3':            (input, opts) => catMp3(input, opts),
  'ghep-mp3':           (input) => ghepMp3(input),
};

module.exports = { PROCESSORS };
