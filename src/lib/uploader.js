const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const config = require('../config');

fs.mkdirSync(config.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadsDir);
  },
  filename: (req, file, cb) => {
    const original = file.originalname || 'file';
    const ext = path.extname(original).toLowerCase();
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});

const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname((file.originalname || '').toLowerCase());
  const ok = allowedExt.has(ext) || allowedMime.has(file.mimetype);
  cb(ok ? null : new Error('Unsupported file type — only JPG/PNG/WEBP allowed'), ok);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.maxUploadBytes }
});

async function processImage(filePath) {
  if (!/\.(png|jpe?g|webp)$/i.test(filePath)) return filePath;

  const targetPath = `${filePath.replace(/\.[^.]+$/, '')}.webp`;

  await sharp(filePath)
    .resize({ width: 2000, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(targetPath);

  await fs.promises.unlink(filePath);

  // Extract just the filename and return a clean path
  // This avoids path.relative() issues that can produce paths with ../ sequences
  const filename = path.basename(targetPath);
  return `/uploads/${filename}`;
}

module.exports = { upload, processImage };
