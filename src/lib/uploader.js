const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const config = require('../config');

// Ensure upload directory exists (with error handling for read-only filesystems)
try {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
} catch (err) {
  if (err.code !== 'EEXIST') {
    console.warn(`Warning: Could not create upload directory: ${err.message}`);
    if (config.isServerless) {
      console.warn('Note: In serverless environments, files are stored temporarily. Cloud storage integration is required for persistence.');
    }
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure directory exists for each upload (serverless may need this)
    try {
      fs.mkdirSync(config.uploadsDir, { recursive: true });
    } catch (err) {
      // Ignore EEXIST errors
      if (err.code !== 'EEXIST') {
        return cb(err);
      }
    }
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

  try {
    await sharp(filePath)
      .resize({ width: 2000, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(targetPath);

    await fs.promises.unlink(filePath);

    // Extract just the filename and return a clean path
    // This avoids path.relative() issues that can produce paths with ../ sequences
    const filename = path.basename(targetPath);
    
    // In serverless environments, files are in /tmp and won't persist
    // The path returned should work with cloud storage URLs or CDN
    // For now, return the standard path format
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Error processing image:', err);
    // If processing fails, return original path
    return filePath;
  }
}

module.exports = { upload, processImage };
