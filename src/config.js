const path = require('path');
require('dotenv').config();

const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || '0.25');
const MAX_UPLOAD_MB = parseFloat(process.env.MAX_UPLOAD_MB || '8');

const rootUploads = process.env.UPLOAD_DIR
  ? path.isAbsolute(process.env.UPLOAD_DIR)
    ? process.env.UPLOAD_DIR
    : path.join(__dirname, '..', '..', process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads');

module.exports = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'zipsite-secret',
  dbClient: (process.env.DB_CLIENT || 'sqlite3').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL || 'sqlite://./dev.sqlite3',
  commissionRate: Number.isFinite(COMMISSION_RATE) ? COMMISSION_RATE : 0.25,
  uploadsDir: rootUploads,
  maxUploadBytes: Number.isFinite(MAX_UPLOAD_MB) ? MAX_UPLOAD_MB * 1024 * 1024 : 8 * 1024 * 1024,
  pdfBaseUrl: process.env.PDF_BASE_URL || 'http://localhost:3000'
};
