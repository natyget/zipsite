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

app.set('trust proxy', 1);

// +++ 2. SET UP THE NEW LAYOUT ENGINE +++
app.use(ejsLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.set('layout', 'layout'); // Default to public layout (dashboard routes explicitly use 'layouts/dashboard')
// Disable EJS cache in development to see template changes immediately
if (process.env.NODE_ENV !== 'production') {
  app.set('view cache', false);
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

const sessionStore = new KnexSessionStore({
  knex,
  tablename: 'sessions'
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

app.use(attachLocals);

const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
app.use(['/login', '/signup'], authLimiter);
app.use('/upload', rateLimit({ windowMs: 60 * 1000, max: 20 }));

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
    res.render(`public/${page}`, {
      title: page.charAt(0).toUpperCase() + page.slice(1) + ' — ZipSite',
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
  
  // Check if it's a database connection error
  const isDatabaseError = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || 
                          err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' ||
                          (err.message && (
                            err.message.includes('DATABASE_URL') ||
                            err.message.includes('database') ||
                            err.message.includes('connect') ||
                            err.message.includes('connection') ||
                            err.message.includes('Cannot find module \'pg\'') ||
                            err.message.includes('Knex: run')
                          ));
  
  // In production, show generic error; in development, show more details
  // BUT: Always show database connection errors with helpful messages
  const isDevelopment = config.nodeEnv !== 'production';
  const showErrorDetails = isDevelopment || isDatabaseError;
  
  const errorDetails = showErrorDetails ? {
    message: err.message,
    code: err.code,
    name: err.name,
    stack: isDevelopment ? err.stack : undefined
  } : null;
  
  if (req.accepts('html')) {
    // Tell 500 page to use the old 'layout' file
    return res.status(500).render('errors/500', {
      title: isDatabaseError ? 'Database Connection Error' : 'Server error',
      layout: 'layout', // Use simple layout for error
      error: errorDetails,
      isDevelopment: showErrorDetails,
      isDatabaseError: isDatabaseError
    });
  }
  return res.status(500).json({ 
    error: isDatabaseError ? 'Database connection error' : 'Server error',
    message: showErrorDetails ? err.message : undefined,
    code: showErrorDetails ? err.code : undefined
  });
});

module.exports = app;

