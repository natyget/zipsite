const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const KnexSessionStore = require('connect-session-knex')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const knex = require('./db/knex');
const { attachLocals } = require('./middleware/context');
const { initializeFirebaseAdmin } = require('./lib/firebase-admin');

// +++ 1. ADD THIS LINE +++
const ejsLayouts = require('express-ejs-layouts');

const authRoutes = require('./routes/auth');
const applyRoutes = require('./routes/apply');
const dashboardRoutes = require('./routes/dashboard');
const portfolioRoutes = require('./routes/portfolio');
const pdfRoutes = require('./routes/pdf');
const uploadRoutes = require('./routes/upload');
const agencyRoutes = require('./routes/agency');
const proRoutes = require('./routes/pro');

const app = express();

// Handle unhandled promise rejections gracefully (especially for session cleanup)
// This prevents crashes from cleanup errors in serverless environments
process.on('unhandledRejection', (reason, promise) => {
  // Check if it's a session cleanup error (expected in serverless)
  if (reason && typeof reason === 'object' && reason.message) {
    if (
      reason.message.includes('Connection terminated') ||
      reason.message.includes('delete from "sessions"') ||
      reason.message.includes('expired') ||
      (reason.message.includes('connection') && reason.message.includes('unexpectedly'))
    ) {
      // Log session cleanup errors but don't crash (non-critical)
      console.error('[Unhandled Rejection] Session cleanup error (expected in serverless):', reason.message);
      return; // Don't crash - this is expected behavior in serverless
    }
  }

  // For other unhandled rejections, log them but don't crash
  console.error('[Unhandled Rejection]', reason);
});

// Only create uploads directory if not in serverless environment
// In serverless, we use /tmp which is already available
if (!config.isServerless) {
  try {
    fs.mkdirSync(config.uploadsDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.warn(`Warning: Could not create upload directory: ${err.message}`);
    }
  }
}

// Trust proxy settings for serverless environments (Netlify Functions)
// In serverless, we need to trust all proxies to correctly parse client IP from headers
// Setting to true trusts all proxies (safe in serverless where proxy chain is controlled)
app.set('trust proxy', true);

// +++ 2. SET UP THE NEW LAYOUT ENGINE +++
app.use(ejsLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('layout', 'layout'); // Default to public layout (dashboard routes explicitly use 'layouts/dashboard')
// Disable EJS cache in development to see template changes immediately
if (process.env.NODE_ENV !== 'production') {
  app.set('view cache', false);
}

// CRITICAL: Middleware to ensure req.ip is ALWAYS set BEFORE any rate limiters
// This MUST be the first middleware after trust proxy to prevent "undefined IP" errors
// In serverless (Netlify Functions), req.ip might be undefined even with trust proxy
app.use((req, res, next) => {
  // Express should set req.ip automatically with trust proxy, but verify it's set
  // In serverless, we need to manually extract IP from headers
  let ip = req.ip;

  // If req.ip is not set or invalid, get it from headers
  if (!ip || ip === undefined || ip === null || ip === '') {
    // Netlify Functions provide x-forwarded-for header with client IP
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // x-forwarded-for format: "client-ip, proxy1-ip, proxy2-ip"
      // Take the first IP (client IP)
      ip = forwardedFor.split(',')[0]?.trim();
    }
  }

  // Fallback to other headers if still no IP
  if (!ip || ip === undefined || ip === null || ip === '') {
    ip = req.headers['x-real-ip'] ||
      req.headers['cf-connecting-ip'] ||
      req.headers['x-client-ip'] ||
      null;
  }

  // Clean up IP if we have one (remove IPv6 prefix, port, brackets, etc.)
  if (ip && typeof ip === 'string') {
    // Remove brackets if present (e.g., "[2001:db8::1]" -> "2001:db8::1")
    ip = ip.replace(/^\[|\]$/g, '');
    // Remove IPv6 prefix if present (e.g., "::ffff:192.168.1.1" -> "192.168.1.1")
    ip = ip.replace(/^::ffff:/, '');
    // Remove port if present (e.g., "192.168.1.1:8080" -> "192.168.1.1")
    const parts = ip.split(':');
    if (parts.length === 2 && !ip.includes('::')) {
      // IPv4 with port: "192.168.1.1:8080"
      const port = parts[1];
      if (/^\d+$/.test(port) && parseInt(port) < 65536) {
        ip = parts[0];
      }
    } else if (parts.length > 2) {
      // IPv6: check if last segment is a port
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart) && parseInt(lastPart) < 65536 && parseInt(lastPart) > 0) {
        // Last segment is a port, remove it
        ip = parts.slice(0, -1).join(':');
      }
    }
  }

  // CRITICAL: Always set req.ip to a valid string value
  // express-rate-limit requires req.ip to be defined, even if we use a custom keyGenerator
  req.ip = (ip && typeof ip === 'string' && ip !== '') ? ip : '127.0.0.1';

  // Also ensure req.connection.remoteAddress is set (some libraries check this)
  if (!req.connection) {
    req.connection = {};
  }
  if (!req.connection.remoteAddress) {
    req.connection.remoteAddress = req.ip;
  }

  // Ensure req.socket.remoteAddress is set (additional fallback)
  if (!req.socket) {
    req.socket = {};
  }
  if (!req.socket.remoteAddress) {
    req.socket.remoteAddress = req.ip;
  }

  next();
});

// Custom key generator for rate limiting that works in serverless environments
// This ensures we always return a valid key for rate limiting
function rateLimitKeyGenerator(req) {
  // Use req.ip (which we ensure is set above) as primary identifier
  // This should now always be set thanks to our middleware
  let ip = req.ip;

  // Clean up IP if needed (remove IPv6 prefix, port, etc.)
  if (ip && ip !== '0.0.0.0') {
    // Remove IPv6 prefix if present
    ip = ip.replace(/^::ffff:/, '');
    // Remove port if present
    const parts = ip.split(':');
    if (parts.length > 2) {
      // IPv6 with port
      ip = parts.slice(0, -1).join(':');
    } else if (parts.length === 2 && !ip.includes('::')) {
      // IPv4 with port
      ip = parts[0];
    }
    return ip;
  }

  // Fallback to session ID if available (more reliable in serverless)
  if (req.session && req.sessionID) {
    return `session:${req.sessionID}`;
  }

  // Fallback to user ID if authenticated
  if (req.session && req.session.userId) {
    return `user:${req.session.userId}`;
  }

  // Final fallback: use a combination that's unique enough
  // This should rarely be used since we ensure req.ip is set
  const userAgent = (req.headers['user-agent'] || 'unknown').substring(0, 50);
  const path = req.path || req.url || 'unknown';
  return `fallback:${path}:${userAgent}`;
}

// --- 3. COMMENT OUT YOUR OLD MIDDLEWARE ---
/*
app.use((req, res, next) => {
  const originalRender = res.render.bind(res);
  res.render = (view, options = {}, callback) => {
    const layout = options.layout === undefined ? 'layout' : options.layout;
    const renderOptions = { ...res.locals, ...options };
    const done = callback || ((err, html) => (err ? next(err) : res.send(html)));

    req.app.render(view, renderOptions, (err, html) => {
      if (err) return done(err);
      if (!layout) return done(null, html);
      return req.app.render(layout, { ...renderOptions, body: html }, done);
    });
  };
  res.renderWithLayout = originalRender;
  next();
});
*/
// --- END OF COMMENTED-OUT BLOCK ---

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Configure session store with serverless-friendly settings
const sessionStoreConfig = {
  knex,
  tablename: 'sessions'
};

// In serverless environments, disable automatic cleanup to prevent connection errors
// Automatic cleanup runs on a timer and can execute after connections are closed
// In serverless, functions are short-lived and connections can terminate unexpectedly
if (config.isServerless) {
  // Disable automatic cleanup in serverless to prevent connection errors
  // In connect-session-knex, cleanupInterval defaults to 15 minutes (900000 ms)
  // Setting it to 0 explicitly disables the cleanup interval
  sessionStoreConfig.cleanupInterval = 0; // 0 = disabled (no cleanup)

  console.log('[Session Store] Automatic cleanup disabled for serverless environment (cleanupInterval: 0)');
}

const sessionStore = new KnexSessionStore(sessionStoreConfig);

// Add error handler for session store events (safety net)
// This catches any errors during session operations, including cleanup if it runs
sessionStore.on('error', (error) => {
  // Log session store errors but don't crash
  // Connection errors are expected in serverless environments when functions end
  if (error && error.message) {
    const isCleanupError = (
      error.message.includes('Connection terminated') ||
      error.message.includes('delete from "sessions"') ||
      error.message.includes('expired') ||
      (error.message.includes('connection') && error.message.includes('unexpectedly'))
    );

    if (isCleanupError) {
      // These are expected in serverless - connections close when functions end
      // Log but don't throw - cleanup errors are non-critical
      console.error('[Session Store] Cleanup error (expected in serverless, ignored):', error.message);
    } else {
      // Other errors should be logged but not cause crashes
      console.error('[Session Store] Error:', error.message);
    }
  } else {
    console.error('[Session Store] Unknown error:', error);
  }
});

app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

// Initialize Firebase Admin SDK
initializeFirebaseAdmin();

app.use(attachLocals);

// Rate limiters with custom key generator for serverless compatibility
// Note: req.ip is always set by our middleware above, preventing "undefined IP" errors
// In serverless environments (Netlify Functions), req.ip might be undefined initially
// We provide a custom keyGenerator that always returns a valid key, so we can safely
// disable IP validation to prevent "undefined request.ip" errors
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator
  // Note: We don't disable validation because express-rate-limit v7 requires req.ip
  // Our middleware above ensures req.ip is always set before this runs
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator
  // Note: We don't disable validation because express-rate-limit v7 requires req.ip
  // Our middleware above ensures req.ip is always set before this runs
});

app.use(['/login', '/signup'], authLimiter);
app.use('/upload', uploadLimiter);

// Route handlers - must come BEFORE static middleware to prevent static HTML files from overriding routes
app.get('/', async (req, res, next) => {
  try {
    // Load Elara Keats data for homepage demo (main featured talent)
    // Use fallback data if database query fails
    let elaraProfile = null;
    let elaraImages = [];

    try {
      elaraProfile = await knex('profiles').where({ slug: 'elara-k' }).first();
      if (elaraProfile) {
        elaraImages = await knex('images').where({ profile_id: elaraProfile.id }).orderBy('sort', 'asc');
      }
    } catch (dbError) {
      console.error('[Homepage] Database error loading Elara profile:', dbError.message);
      // Continue with fallback data below
    }

    // Load additional talent profiles for floating cards (limit to 4)
    // Use database-agnostic random ordering
    let floatingTalents = [];
    let floatingTalentsWithImages = [];

    try {
      if (config.dbClient === 'pg') {
        floatingTalents = await knex('profiles')
          .whereNot({ slug: 'elara-k' })
          .whereNotNull('hero_image_path')
          .limit(4)
          .orderByRaw('RANDOM()');
      } else {
        // SQLite: use a simple approach - get all and shuffle in JS, or just order by id
        floatingTalents = await knex('profiles')
          .whereNot({ slug: 'elara-k' })
          .whereNotNull('hero_image_path')
          .limit(10)
          .orderBy('created_at', 'desc');
        // Shuffle and take first 4
        floatingTalents = floatingTalents.sort(() => Math.random() - 0.5).slice(0, 4);
      }

      // For each floating talent, get their first image
      floatingTalentsWithImages = await Promise.all(
        floatingTalents.map(async (talent) => {
          try {
            const images = await knex('images')
              .where({ profile_id: talent.id })
              .orderBy('sort', 'asc')
              .limit(1);
            return {
              ...talent,
              hero_image: images.length > 0 ? images[0].path : talent.hero_image_path
            };
          } catch (imgError) {
            console.warn(`[Homepage] Error loading images for talent ${talent.id}:`, imgError.message);
            return {
              ...talent,
              hero_image: talent.hero_image_path
            };
          }
        })
      );
    } catch (err) {
      console.warn('[Homepage] Error loading floating talents:', err.message);
      // Will use fallback data below
      floatingTalentsWithImages = [];
    }

    // Set in res.locals so layout can access it
    res.locals.isHomepage = true;
    res.locals.currentPage = 'home';

    // Ensure elaraProfile has all required fields for transformation hero
    const elaraProfileForHero = elaraProfile || {
      first_name: 'Elara',
      last_name: 'Keats',
      city: 'Los Angeles, CA',
      slug: 'elara-k',
      bio_raw: 'hi!!!\n\ni saw on insta you guys are looking for new faces?? im elara keats and im a model based in LA (but i can travel anywhere, i have a passport!!) im really looking to get into more editorial and runway work.\n\na bit about me:\n\nim 5\'11"\nmy measurements are 32-25-35\nmy shoe is a 9\ni have brown hair/green eyes.\n\nMy insta is @elara.k -- i post most of my new work there. im a super hard worker and everyone says im professional, i have a background in some smaller campaigns. i was with [Agency Name] last year but left, it wasnt a good fit.\n\nI put my best photos (some are digitals my friend took, some are from real shoots but they are not edited yet) in this google drive. hope you can see them?\n\nhere is the link:\n\nhttps://www.google.com/search?q=https://drive.google.com/drive/folders/1aBcD-THIS-IS-A-MESSY-LINK-xyz\n\nI also have a portfolio on a wix site i made, i think this is the link:\n\nhttps://www.google.com/search?q=elara-portfolio.wixsite.com/mysite\n\nLet me know what you think! Thx so much!! 🙏 I\'m free for a meeting basically any time next week.\n\n-Elara K.',
      bio_curated: 'Elara Keats is an emerging model based in Los Angeles with a strong foundation in editorial and runway work. Standing at 5\'11" with measurements of 32-25-35, she brings a commanding presence to both high-fashion editorials and commercial campaigns. With brown hair and green eyes, Elara\'s versatile look has made her a sought-after talent for diverse creative projects. Her professional approach and extensive experience in smaller campaigns demonstrate her commitment to excellence. Elara is available for travel and actively seeking opportunities in editorial and runway work, bringing dedication and professionalism to every project.',
      hero_image_path: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=2000&q=80',
      height_cm: 180,
      measurements: '32-25-35'
    };

    res.render('public/home', {
      title: 'ZipSite — AI-Curated Portfolios for Talent & Agencies',
      layout: 'layout',
      currentPage: 'home',
      elaraProfile: elaraProfileForHero,
      elaraImages: elaraImages.length > 0 ? elaraImages : [],
      floatingTalents: floatingTalentsWithImages.length > 0 ? floatingTalentsWithImages : [
        {
          first_name: 'Aiko',
          last_name: 'Ren',
          city: 'Tokyo / New York',
          hero_image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80',
          slug: 'aiko-ren'
        },
        {
          first_name: 'Bianca',
          last_name: 'Cole',
          city: 'Los Angeles',
          hero_image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80',
          slug: 'bianca-cole'
        },
        {
          first_name: 'Cruz',
          last_name: 'Vega',
          city: 'Mexico City',
          hero_image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',
          slug: 'cruz-vega'
        },
        {
          first_name: 'Daphne',
          last_name: 'Noor',
          city: 'Amsterdam',
          hero_image: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=900&q=80',
          slug: 'daphne-noor'
        }
      ],
      isHomepage: true // Keep this for the view template
    });
  } catch (error) {
    console.error('[Homepage Route] Error:', error);
    return next(error);
  }
});

// Render static pages using EJS with universal header
['features', 'pricing', 'press', 'legal'].forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    res.locals.currentPage = page;
    const pageTitle = page === 'press' ? 'Contact Us' : (page.charAt(0).toUpperCase() + page.slice(1));
    res.render(`public/${page}`, {
      title: pageTitle + ' — ZipSite',
      layout: 'layout',
      currentPage: page
    });
  });
});

// Demo page with PDF themes data
app.get('/demo', async (req, res) => {
  try {
    const { getAllThemes, getFreeThemes, getProThemes } = require('./lib/themes');
    const allThemes = getAllThemes();
    const freeThemes = getFreeThemes();
    const proThemes = getProThemes();
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    res.locals.currentPage = 'demo';
    res.render('public/demo', {
      title: 'Demo — ZipSite',
      layout: 'layout',
      currentPage: 'demo',
      allThemes,
      freeThemes,
      proThemes,
      baseUrl,
      demoSlug: 'elara-k'
    });
  } catch (error) {
    console.error('[Demo Route] Error:', error);
    // Fallback to basic demo page if theme loading fails
    res.locals.currentPage = 'demo';
    res.render('public/demo', {
      title: 'Demo — ZipSite',
      layout: 'layout',
      currentPage: 'demo',
      allThemes: {},
      freeThemes: [],
      proThemes: [],
      baseUrl: `${req.protocol}://${req.get('host')}`,
      demoSlug: 'elara-k'
    });
  }
});

// Migration endpoint (protected by secret token)
// Call this once after deployment to set up database tables
app.post('/api/migrate', async (req, res) => {
  try {
    // Check for migration secret (required for security)
    const migrationSecret = process.env.MIGRATION_SECRET;
    const providedSecret = req.query.secret || req.headers['x-migration-secret'];

    if (migrationSecret && providedSecret !== migrationSecret) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid migration secret. Set MIGRATION_SECRET in environment variables and provide it as ?secret=... or X-Migration-Secret header.'
      });
    }

    // If no secret is set, warn but allow (for initial setup)
    if (!migrationSecret) {
      console.warn('[Migration] WARNING: MIGRATION_SECRET not set. Migration endpoint is unprotected!');
    }

    console.log('[Migration] Starting database migrations...');

    // Run migrations
    const [batchNo, log] = await knex.migrate.latest();

    console.log('[Migration] Migrations completed:', {
      batchNo,
      migrationsRun: log.length,
      log: log
    });

    // Get migration status
    const currentVersion = await knex.migrate.currentVersion();
    const status = await knex.migrate.status();

    return res.json({
      success: true,
      message: 'Migrations completed successfully',
      batchNo,
      migrationsRun: log.length,
      currentVersion,
      status: status === 0 ? 'up to date' : `${status} migrations pending`,
      log: log
    });
  } catch (error) {
    console.error('[Migration] Error running migrations:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: error.message,
      code: error.code,
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

// Migration status endpoint (read-only, no secret required)
app.get('/api/migrate/status', async (req, res) => {
  try {
    const currentVersion = await knex.migrate.currentVersion();
    const status = await knex.migrate.status();
    const list = await knex.migrate.list();

    return res.json({
      currentVersion,
      status: status === 0 ? 'up to date' : `${Math.abs(status)} migrations ${status > 0 ? 'pending' : 'ahead'}`,
      pending: status,
      list: list
    });
  } catch (error) {
    console.error('[Migration Status] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to get migration status',
      message: error.message,
      code: error.code
    });
  }
});

app.use('/', authRoutes);
app.use('/', applyRoutes);
app.use('/', dashboardRoutes);
app.use('/', portfolioRoutes);
app.use('/', pdfRoutes);
app.use('/', uploadRoutes);
app.use('/', agencyRoutes);
app.use('/', proRoutes);

// Static file serving - AFTER routes so routes take precedence over static HTML files
// Disable caching for CSS/JS in development
const staticOptions = process.env.NODE_ENV === 'production' ? {} : {
  etag: false,
  lastModified: false,
  setHeaders: (res, path) => {
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('X-Content-Type-Options', 'nosniff');
    }
  }
};
app.use(express.static(path.join(__dirname, '..', 'public'), staticOptions));

// Only serve uploads directory if not in serverless environment
// In serverless, uploads should be served via CDN or cloud storage
// Netlify will serve static files from the public directory automatically
if (!config.isServerless) {
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
} else {
  // In serverless, files in /tmp are temporary and not accessible via HTTP
  // For production, configure cloud storage (S3, Netlify Blob, etc.)
  // and update image paths in the database to use cloud storage URLs
  app.use('/uploads', (req, res) => {
    res.status(404).json({
      error: 'File not found',
      message: 'Uploads are not available in serverless environment. Cloud storage integration required for file persistence.'
    });
  });
}

app.use((req, res) => {
  if (req.accepts('html')) {
    // Tell 404 page to use the old 'layout' file, not the dashboard
    return res.status(404).render('errors/404', {
      title: 'Not found',
      layout: 'layout' // Use simple layout for error
    });
  }
  return res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  // Log detailed error information
  console.error('[Error Handler]', {
    message: err.message,
    stack: err.stack,
    code: err.code,
    name: err.name,
    url: req.url,
    method: req.method
  });

  if (res.headersSent) {
    return next(err);
  }

  // Check if it's a missing tables error (needs migrations)
  const isMissingTablesError = err.code === '42P01' ||
    (err.message && (
      err.message.includes('relation') && err.message.includes('does not exist') ||
      err.message.includes('table') && err.message.includes('does not exist')
    ));

  // Check if it's a database connection error
  const isDatabaseError = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' ||
    err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' ||
    err.code === '42P01' || // PostgreSQL: relation does not exist
    err.code === '42P07' || // PostgreSQL: relation already exists
    err.code === '3D000' || // PostgreSQL: database does not exist
    err.code === '28P01' || // PostgreSQL: authentication failed
    (err.message && (
      err.message.includes('DATABASE_URL') ||
      err.message.includes('database') ||
      err.message.includes('connect') ||
      err.message.includes('connection') ||
      err.message.includes('Cannot find module \'pg\'') ||
      err.message.includes('Knex: run') ||
      (err.message.includes('relation') && err.message.includes('does not exist'))
    ));

  // In production, show generic error; in development, show more details
  // BUT: Always show database connection errors with helpful messages
  const isDevelopment = config.nodeEnv !== 'production';
  const showErrorDetails = isDevelopment || isDatabaseError;

  const errorDetails = showErrorDetails ? {
    message: err.message,
    code: err.code,
    name: err.name,
    stack: isDevelopment ? err.stack : undefined,
    migrationRequired: isMissingTablesError
  } : null;

  if (req.accepts('html')) {
    // Tell 500 page to use the old 'layout' file
    let title = 'Server error';
    if (isMissingTablesError) {
      title = 'Database Setup Required';
    } else if (isDatabaseError) {
      title = 'Database Connection Error';
    }

    return res.status(500).render('errors/500', {
      title: title,
      layout: 'layout', // Use simple layout for error
      error: errorDetails,
      isDevelopment: showErrorDetails,
      isDatabaseError: isDatabaseError
    });
  }

  // JSON error response
  if (isMissingTablesError) {
    return res.status(500).json({
      error: 'Database setup required',
      message: 'Database tables do not exist. Please run migrations to set up the database.',
      code: err.code,
      migrationRequired: true,
      instructions: 'Call POST /api/migrate to run database migrations.'
    });
  }

  return res.status(500).json({
    error: isDatabaseError ? 'Database connection error' : 'Server error',
    message: showErrorDetails ? err.message : undefined,
    code: showErrorDetails ? err.code : undefined
  });
});

module.exports = app;

