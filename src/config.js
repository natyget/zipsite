const path = require('path');
const os = require('os');
require('dotenv').config();

const COMMISSION_RATE = parseFloat(process.env.COMMISSION_RATE || '0.25');
const MAX_UPLOAD_MB = parseFloat(process.env.MAX_UPLOAD_MB || '8');

// Detect serverless environment (Netlify Functions, AWS Lambda, etc.)
const isServerless = Boolean(
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NETLIFY ||
  process.env.NETLIFY_DEV ||
  process.env.VERCEL ||
  process.env._HANDLER
);

// In serverless environments, use /tmp for temporary file storage
// Note: Files in /tmp are deleted after function execution, so cloud storage is required for persistence
const rootUploads = process.env.UPLOAD_DIR
  ? path.isAbsolute(process.env.UPLOAD_DIR)
    ? process.env.UPLOAD_DIR
    : path.join(__dirname, '..', '..', process.env.UPLOAD_DIR)
  : isServerless
    ? path.join(os.tmpdir(), 'zipsite-uploads')
    : path.join(__dirname, '..', '..', 'uploads');

module.exports = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'zipsite-secret',
  dbClient: (process.env.DB_CLIENT || 'sqlite3').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL || 'sqlite://./dev.sqlite3',
  commissionRate: Number.isFinite(COMMISSION_RATE) ? COMMISSION_RATE : 0.25,
  uploadsDir: rootUploads,
  isServerless,
  maxUploadBytes: Number.isFinite(MAX_UPLOAD_MB) ? MAX_UPLOAD_MB * 1024 * 1024 : 8 * 1024 * 1024,
  // PDF Base URL: Use Netlify environment variables for proper URL resolution
  // DEPLOY_PRIME_URL is available for branch deployments (e.g., branch--site.netlify.app)
  // URL is the main production URL
  // PDF_BASE_URL can be used as a custom override
  // Fall back to localhost for local development
  pdfBaseUrl: process.env.DEPLOY_PRIME_URL || process.env.URL || process.env.PDF_BASE_URL || 'http://localhost:3000'
};
