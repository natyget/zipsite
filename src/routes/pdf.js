const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { renderCompCard, loadProfile, toFeetInches } = require('../lib/pdf');
const { getTheme, isProTheme, getDefaultTheme, mergeThemeWithCustomization, generateThemeFontsUrl, validateCustomization } = require('../lib/themes');
const { getFontFamilyCSS } = require('../lib/fonts');
const { generateLayoutClasses, getImageGridCSS, validateLayout } = require('../lib/pdf-layouts');
const { requireRole } = require('../middleware/auth');
const knex = require('../db/knex');
const QRCode = require('qrcode');
const config = require('../config');

const router = express.Router();

// Helper function to detect database connection errors
function isDatabaseError(error) {
  if (!error) return false;

  // Check for database connection error codes
  const dbErrorCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'];
  if (dbErrorCodes.includes(error.code)) {
    return true;
  }

  // Check for PostgreSQL error codes
  // 42P01 = relation does not exist (missing tables - need to run migrations)
  // 42P07 = relation already exists
  // 3D000 = database does not exist
  // 28P01 = authentication failed
  const pgErrorCodes = ['42P01', '42P07', '3D000', '28P01'];
  if (pgErrorCodes.includes(error.code)) {
    return true;
  }

  // Check for database-related error messages
  if (error.message) {
    const dbErrorKeywords = [
      'connect',
      'connection',
      'DATABASE_URL',
      'database',
      'Cannot find module \'pg\'',
      'Knex: run',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'relation "',
      'does not exist',
      'table',
      'relation does not exist'
    ];

    const errorMessage = error.message.toLowerCase();
    return dbErrorKeywords.some(keyword => errorMessage.includes(keyword.toLowerCase()));
  }

  return false;
}

// Helper function to detect missing tables error (needs migrations)
function isMissingTablesError(error) {
  if (!error) return false;

  // PostgreSQL error code for "relation does not exist"
  if (error.code === '42P01') {
    return true;
  }

  // Check error message for "relation" or "does not exist"
  if (error.message && (
    error.message.includes('relation') && error.message.includes('does not exist') ||
    error.message.includes('table') && error.message.includes('does not exist')
  )) {
    return true;
  }

  return false;
}

// Helper function to verify profile ownership
async function verifyProfileOwnership(req, profileSlug) {
  if (!req.session || !req.session.userId) {
    return { authorized: false, error: 'Not authenticated' };
  }

  const profile = await knex('profiles').where({ slug: profileSlug }).first();
  if (!profile) {
    return { authorized: false, error: 'Profile not found' };
  }

  if (profile.user_id !== req.session.userId) {
    return { authorized: false, error: 'Not authorized' };
  }

  return { authorized: true, profile };
}

// Multer configuration for agency logo uploads
const agencyLogoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.session.userId;
    const logoDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'agency-logos', userId);
    try {
      fs.mkdirSync(logoDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        return cb(err);
      }
    }
    cb(null, logoDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || 'logo.png').toLowerCase();
    cb(null, `logo${ext}`);
  }
});

const agencyLogoUpload = multer({
  storage: agencyLogoStorage,
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.jpg', '.jpeg', '.png', '.svg', '.webp'];
    const allowedMime = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'];
    const ext = path.extname((file.originalname || '').toLowerCase());
    const ok = allowedExt.includes(ext) || allowedMime.includes(file.mimetype);
    cb(ok ? null : new Error('Unsupported file type — only JPG/PNG/SVG/WEBP allowed'), ok);
  },
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit for logos
});

// Demo profile data for elara-k (fallback when database is empty)
function getDemoProfile(slug) {
  if (slug !== 'elara-k') return null;

  return {
    profile: {
      id: 'demo-elara-k',
      slug: 'elara-k',
      user_id: 'demo-user',
      first_name: 'Elara',
      last_name: 'Keats',
      city: 'Los Angeles, CA',
      height_cm: 180,
      measurements: '32-25-35',
      bio_raw: 'Elara is a collaborative creative professional with a background in editorial campaigns and on-set leadership. Based in Los Angeles, she balances editorial edge with commercial versatility.',
      bio_curated: 'Elara Keats brings a polished presence to every production. Based in Los Angeles, she balances editorial edge with commercial versatility. Standing at 5\'11" with measurements of 32-25-35, she brings a commanding presence to both high-fashion editorials and commercial campaigns.',
      hero_image_path: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=2000&q=80',
      is_pro: false,
      pdf_theme: null,
      pdf_customizations: null,
      phone: null,
      bust: null,
      waist: null,
      hips: null,
      shoe_size: null,
      eye_color: null,
      hair_color: null,
      specialties: null,
      partner_agency_id: null,
      created_at: new Date(),
      updated_at: new Date()
    },
    images: [
      {
        id: 'demo-img-1',
        profile_id: 'demo-elara-k',
        path: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=80',
        label: 'Headshot',
        sort: 1,
        created_at: new Date()
      },
      {
        id: 'demo-img-2',
        profile_id: 'demo-elara-k',
        path: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80',
        label: 'Editorial',
        sort: 2,
        created_at: new Date()
      },
      {
        id: 'demo-img-3',
        profile_id: 'demo-elara-k',
        path: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1000&q=80',
        label: 'Runway',
        sort: 3,
        created_at: new Date()
      },
      {
        id: 'demo-img-4',
        profile_id: 'demo-elara-k',
        path: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1000&q=80',
        label: 'Portfolio',
        sort: 4,
        created_at: new Date()
      }
    ]
  };
}

// Helper function to render simple HTML error page (for iframe compatibility)
function renderSimpleError(res, statusCode, title, message) {
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + title + '</title><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5;color:#666}.error{text-align:center;padding:2rem;max-width:600px}.error h1{margin:0 0 0.5rem 0;font-size:1.5rem;color:#c9a55a}.error p{margin:0.5rem 0;font-size:0.9rem}</style></head><body><div class="error"><h1>' + title + '</h1><p>' + message + '</p></div></body></html>';
  return res.status(statusCode).send(html);
}

// Helper function to render PDF view with profile data
async function renderPdfView(req, res, data, isDemo) {
  const { profile, images } = data;
  const hero = profile.hero_image_path || (images[0] ? images[0].path : null);
  const gallery = hero ? images.filter((img) => img.path !== hero) : images;

  // Get theme from query parameter, default to profile's saved theme or default
  let themeKey = req.query.theme || profile.pdf_theme || getDefaultTheme();

  // Validate theme exists
  let theme = getTheme(themeKey);
  if (!theme) {
    themeKey = getDefaultTheme();
    theme = getTheme(themeKey);
  }

  // Check if Pro theme is selected but user is not Pro
  if (isProTheme(themeKey) && !profile.is_pro) {
    themeKey = getDefaultTheme();
    theme = getTheme(themeKey);
  }

  // Load customizations from database (Pro users only) - skip for demo
  let customizations = null;
  if (!isDemo && profile.is_pro && profile.pdf_customizations) {
    try {
      customizations = typeof profile.pdf_customizations === 'string'
        ? JSON.parse(profile.pdf_customizations)
        : profile.pdf_customizations;
    } catch (error) {
      console.error('Error parsing PDF customizations:', error);
      customizations = null;
    }
  }

  // Merge theme with customizations
  const mergedTheme = mergeThemeWithCustomization(theme, customizations);

  // Build base URL for images
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  // Generate QR code for Pro users linking to portfolio - skip for demo (not pro)
  let qrCodeDataUrl = null;
  if (!isDemo && profile.is_pro) {
    try {
      const portfolioUrl = `${baseUrl}/portfolio/${profile.slug}`;
      qrCodeDataUrl = await QRCode.toDataURL(portfolioUrl, {
        width: 120,
        margin: 1,
        color: {
          dark: mergedTheme.colors.background === '#000000' || mergedTheme.colors.background === '#1A1A1A' || mergedTheme.colors.background === '#2C3E50' ? '#FAF9F7' : '#0F172A',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('QR code generation failed:', error);
    }
  }

  // Get font CSS values
  const fontCSS = {
    nameFont: getFontFamilyCSS(mergedTheme.fonts.name),
    bioFont: getFontFamilyCSS(mergedTheme.fonts.bio),
    statsFont: getFontFamilyCSS(mergedTheme.fonts.stats)
  };

  // Generate Google Fonts URL
  const googleFontsUrl = generateThemeFontsUrl(mergedTheme);

  // Generate layout classes
  const layoutClasses = generateLayoutClasses(mergedTheme.layout);
  const imageGridCSS = getImageGridCSS(mergedTheme.layout);

  // Get agency logo (Pro users only) - skip for demo
  let agencyLogo = null;
  if (!isDemo && profile.is_pro && customizations && customizations.agencyLogo) {
    agencyLogo = customizations.agencyLogo;
  }

  // Disable layout for PDF view - it's a standalone HTML document
  res.locals.layout = false;
  return res.render('pdf/compcard', {
    layout: false,
    title: `${profile.first_name} ${profile.last_name} - Comp Card`,
    profile,
    images: gallery,
    hero,
    heightFeet: toFeetInches(profile.height_cm),
    watermark: !profile.is_pro,
    theme: mergedTheme,
    themeKey: themeKey,
    baseUrl,
    isPro: profile.is_pro,
    qrCode: qrCodeDataUrl,
    portfolioUrl: `${baseUrl}/portfolio/${profile.slug}`,
    fontCSS,
    googleFontsUrl,
    layoutClasses,
    imageGridCSS,
    agencyLogo
  });
}

router.get('/pdf/view/:slug', async (req, res, next) => {
  const slug = req.params.slug;
  let data = null;
  let isDemo = false;

  try {
    console.log('[PDF View] Loading profile for slug:', slug);

    // Try to load from database first
    try {
      data = await loadProfile(slug);
      console.log('[PDF View] Profile loaded from database:', data ? 'found' : 'not found');
    } catch (dbError) {
      // If database error, check if it's a missing tables error or connection error
      if (isMissingTablesError(dbError) || isDatabaseError(dbError)) {
        console.log('[PDF View] Database error, checking demo fallback for:', slug);
        // For demo slug, use fallback data
        const demoData = getDemoProfile(slug);
        if (demoData) {
          data = demoData;
          isDemo = true;
          console.log('[PDF View] Using demo profile data due to database error');
        } else {
          // Not a demo slug and database is unavailable - return error
          return renderSimpleError(res, 500, 'Database Error', 'Unable to connect to the database. Please check your database configuration.');
        }
      } else {
        // Other database errors - rethrow to be caught by outer catch
        throw dbError;
      }
    }

    // If profile not found in database, try demo fallback
    if (!data) {
      console.log('[PDF View] Profile not found in database, checking demo fallback');
      const demoData = getDemoProfile(slug);
      if (demoData) {
        data = demoData;
        isDemo = true;
        console.log('[PDF View] Using demo profile fallback for slug:', slug);
      } else {
        console.log('[PDF View] Profile not found and no demo fallback available for slug:', slug);
        return renderSimpleError(res, 404, 'Profile not found', 'The profile "' + slug + '" does not exist.');
      }
    }

    // Render PDF view with profile data
    console.log('[PDF View] Rendering PDF for profile:', {
      slug: data.profile.slug,
      name: data.profile.first_name + ' ' + data.profile.last_name,
      isDemo: isDemo,
      imageCount: data.images.length
    });

    return await renderPdfView(req, res, data, isDemo);
  } catch (error) {
    // Log errors for debugging
    console.error('[PDF View Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      slug: slug
    });

    // Check if it's a database error and we haven't tried demo fallback yet
    if ((isMissingTablesError(error) || isDatabaseError(error)) && !isDemo) {
      const demoData = getDemoProfile(slug);
      if (demoData) {
        console.log('[PDF View Route] Using demo fallback in catch handler');
        try {
          return await renderPdfView(req, res, demoData, true);
        } catch (renderError) {
          console.error('[PDF View Route] Error rendering demo PDF:', renderError.message);
          return renderSimpleError(res, 500, 'Error', 'Unable to render PDF preview.');
        }
      }
    }

    // For database errors without demo fallback, return error page
    if (isMissingTablesError(error) || isDatabaseError(error)) {
      return renderSimpleError(res, 500, 'Database Error', 'Unable to connect to the database. Please check your database configuration.');
    }

    // For other errors, pass to error handler
    return next(error);
  }
});

router.get('/pdf/:slug', async (req, res, next) => {
  try {
    const data = await loadProfile(req.params.slug);
    if (!data) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const { profile } = data;

    // Get theme from query parameter
    let themeKey = req.query.theme || profile.pdf_theme || getDefaultTheme();

    // Validate theme exists
    let theme = getTheme(themeKey);
    if (!theme) {
      themeKey = getDefaultTheme();
      theme = getTheme(themeKey);
    }

    // Check if Pro theme is selected but user is not Pro
    if (isProTheme(themeKey) && !profile.is_pro) {
      themeKey = getDefaultTheme();
      theme = getTheme(themeKey);
    }

    // Save theme preference if user is logged in and owns this profile
    if (req.session.userId && profile.user_id === req.session.userId && themeKey !== profile.pdf_theme) {
      try {
        await knex('profiles')
          .where({ id: profile.id })
          .update({ pdf_theme: themeKey });
      } catch (dbError) {
        // Log database error but don't fail PDF generation
        console.error('[PDF Download Route] Error saving theme preference:', dbError.message);
      }
    }

    // Build URL with theme parameter (customizations are loaded in the view route)
    const url = new URL(`/pdf/view/${req.params.slug}`, config.pdfBaseUrl);
    if (themeKey) {
      url.searchParams.set('theme', themeKey);
    }

    const buffer = await renderCompCard(req.params.slug, themeKey);
    if (req.query.download) {
      res.setHeader('Content-Disposition', `attachment; filename="ZipSite-${req.params.slug}-compcard.pdf"`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }
    res.contentType('application/pdf');
    return res.send(buffer);
  } catch (error) {
    // Log database connection errors for debugging
    console.error('[PDF Download Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    // Check if it's a missing tables error (needs migrations)
    if (isMissingTablesError(error)) {
      console.error('[PDF Download Route] Missing tables error detected - migrations need to be run');
      return res.status(500).json({
        error: 'Database setup required',
        message: 'Database tables do not exist. Please run migrations to set up the database.',
        code: error.code,
        migrationRequired: true,
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
        instructions: 'Call POST /api/migrate to run database migrations.'
      });
    }

    // Check if it's a database connection error
    if (isDatabaseError(error)) {
      console.error('[PDF Download Route] Database connection error detected');
      // Return JSON error response for download endpoint
      return res.status(500).json({
        error: 'Database connection error',
        message: 'Unable to connect to the database. Please check your database configuration.',
        code: error.code,
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }

    // Check if it's a Puppeteer error (browser launch, navigation, PDF generation)
    if (error.message && (
      error.message.includes('browser') ||
      error.message.includes('puppeteer') ||
      error.message.includes('navigation') ||
      error.message.includes('timeout') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED')
    )) {
      console.error('[PDF Download Route] Puppeteer error detected');
      return res.status(500).json({
        error: 'PDF generation error',
        message: 'Unable to generate PDF. Please try again later.',
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }

    // For other errors, pass to error handler
    return next(error);
  }
});

// API Endpoints for PDF Customization (Pro users only)

// GET /api/pdf/customize/:slug - Get current customizations
router.get('/api/pdf/customize/:slug', requireRole('TALENT'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { authorized, profile, error } = await verifyProfileOwnership(req, slug);

    if (!authorized) {
      return res.status(403).json({ error: error || 'Not authorized' });
    }

    if (!profile.is_pro) {
      return res.status(403).json({ error: 'Pro account required' });
    }

    let customizations = null;
    if (profile.pdf_customizations) {
      try {
        customizations = typeof profile.pdf_customizations === 'string'
          ? JSON.parse(profile.pdf_customizations)
          : profile.pdf_customizations;
      } catch (err) {
        console.error('Error parsing customizations:', err);
        customizations = null;
      }
    }

    return res.json({
      ok: true,
      customizations: customizations || {},
      theme: profile.pdf_theme || getDefaultTheme()
    });
  } catch (error) {
    // Log database connection errors for debugging
    console.error('[PDF Customize GET Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    // Check if it's a database connection error
    if (isDatabaseError(error)) {
      console.error('[PDF Customize GET Route] Database connection error detected');
      return res.status(500).json({
        error: 'Database connection error',
        message: 'Unable to connect to the database. Please check your database configuration.',
        code: error.code,
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }

    // For other errors, pass to error handler
    return next(error);
  }
});

// POST /api/pdf/customize/:slug - Save PDF customizations
router.post('/api/pdf/customize/:slug', requireRole('TALENT'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { authorized, profile, error } = await verifyProfileOwnership(req, slug);

    if (!authorized) {
      return res.status(403).json({ error: error || 'Not authorized' });
    }

    if (!profile.is_pro) {
      return res.status(403).json({ error: 'Pro account required' });
    }

    const { theme, customizations } = req.body;

    // Validate theme if provided
    if (theme) {
      const themeObj = getTheme(theme);
      if (!themeObj) {
        return res.status(400).json({ error: 'Invalid theme' });
      }

      // Check if Pro theme is selected
      if (isProTheme(theme) && !profile.is_pro) {
        return res.status(403).json({ error: 'Pro theme requires Pro account' });
      }
    }

    // Validate customizations if provided
    if (customizations) {
      const themeKey = theme || profile.pdf_theme || getDefaultTheme();
      const themeObj = getTheme(themeKey);
      const validation = validateCustomization(customizations, themeObj);

      if (!validation.valid) {
        return res.status(400).json({
          error: 'Invalid customizations',
          errors: validation.errors
        });
      }

      // Validate layout if provided
      if (customizations.layout && !validateLayout(customizations.layout)) {
        return res.status(400).json({ error: 'Invalid layout configuration' });
      }
    }

    // Prepare update object
    const updates = {};
    if (theme) {
      updates.pdf_theme = theme;
    }
    if (customizations) {
      updates.pdf_customizations = JSON.stringify(customizations);
    }

    // Update profile
    await knex('profiles')
      .where({ id: profile.id })
      .update(updates);

    return res.json({
      ok: true,
      message: 'Customizations saved successfully'
    });
  } catch (error) {
    // Log database connection errors for debugging
    console.error('[PDF Customize POST Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    // Check if it's a database connection error
    if (isDatabaseError(error)) {
      console.error('[PDF Customize POST Route] Database connection error detected');
      return res.status(500).json({
        error: 'Database connection error',
        message: 'Unable to connect to the database. Please check your database configuration.',
        code: error.code,
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }

    // For other errors, pass to error handler
    return next(error);
  }
});

// POST /api/pdf/agency-logo/:slug - Upload agency logo
router.post('/api/pdf/agency-logo/:slug', requireRole('TALENT'), agencyLogoUpload.single('logo'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { authorized, profile, error } = await verifyProfileOwnership(req, slug);

    if (!authorized) {
      return res.status(403).json({ error: error || 'Not authorized' });
    }

    if (!profile.is_pro) {
      return res.status(403).json({ error: 'Pro account required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Logo file required' });
    }

    const userId = req.session.userId;
    const logoDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'agency-logos', userId);
    const logoPath = path.join(logoDir, req.file.filename);

    // Process and optimize logo
    try {
      const fileExt = path.extname(req.file.filename).toLowerCase();
      const isSvg = fileExt === '.svg';

      let logoUrl;

      if (isSvg) {
        // For SVG, keep as-is (no processing with Sharp)
        logoUrl = `/uploads/agency-logos/${userId}/logo.svg`;
      } else {
        // For raster images, convert to WebP and optimize
        const optimizedPath = logoPath.replace(/\.[^.]+$/, '.webp');
        await sharp(logoPath)
          .resize({ width: 400, height: 200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 })
          .toFile(optimizedPath);

        // Delete original if it's not webp
        if (!logoPath.endsWith('.webp')) {
          fs.unlinkSync(logoPath);
        }

        logoUrl = `/uploads/agency-logos/${userId}/logo.webp`;
      }

      // Update customizations with logo path
      let customizations = null;
      if (profile.pdf_customizations) {
        try {
          customizations = typeof profile.pdf_customizations === 'string'
            ? JSON.parse(profile.pdf_customizations)
            : profile.pdf_customizations;
        } catch (err) {
          customizations = {};
        }
      } else {
        customizations = {};
      }

      customizations.agencyLogo = {
        type: 'upload',
        path: logoUrl,
        position: customizations.agencyLogo?.position || 'bottom-right',
        size: customizations.agencyLogo?.size || 'small'
      };

      await knex('profiles')
        .where({ id: profile.id })
        .update({ pdf_customizations: JSON.stringify(customizations) });

      return res.json({
        ok: true,
        logoUrl,
        message: 'Logo uploaded successfully'
      });
    } catch (processError) {
      console.error('Error processing logo:', processError);
      // Clean up uploaded file
      if (fs.existsSync(logoPath)) {
        try {
          fs.unlinkSync(logoPath);
        } catch (unlinkError) {
          console.error('Error deleting logo file:', unlinkError);
        }
      }
      return res.status(500).json({ error: 'Error processing logo' });
    }
  } catch (error) {
    // Log database connection errors for debugging
    console.error('[PDF Agency Logo Upload Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    // Check if it's a database connection error
    if (isDatabaseError(error)) {
      console.error('[PDF Agency Logo Upload Route] Database connection error detected');
      return res.status(500).json({
        error: 'Database connection error',
        message: 'Unable to connect to the database. Please check your database configuration.',
        code: error.code,
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }

    // For other errors, pass to error handler
    return next(error);
  }
});

// POST /api/pdf/agency-logo-url/:slug - Set agency logo from URL
router.post('/api/pdf/agency-logo-url/:slug', requireRole('TALENT'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { authorized, profile, error } = await verifyProfileOwnership(req, slug);

    if (!authorized) {
      return res.status(403).json({ error: error || 'Not authorized' });
    }

    if (!profile.is_pro) {
      return res.status(403).json({ error: 'Pro account required' });
    }

    const { url, position, size } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Logo URL required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Update customizations with logo URL
    let customizations = null;
    if (profile.pdf_customizations) {
      try {
        customizations = typeof profile.pdf_customizations === 'string'
          ? JSON.parse(profile.pdf_customizations)
          : profile.pdf_customizations;
      } catch (err) {
        customizations = {};
      }
    } else {
      customizations = {};
    }

    customizations.agencyLogo = {
      type: 'url',
      path: url,
      position: position || 'bottom-right',
      size: size || 'small'
    };

    await knex('profiles')
      .where({ id: profile.id })
      .update({ pdf_customizations: JSON.stringify(customizations) });

    return res.json({
      ok: true,
      message: 'Logo URL saved successfully'
    });
  } catch (error) {
    // Log database connection errors for debugging
    console.error('[PDF Agency Logo URL Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    // Check if it's a database connection error
    if (isDatabaseError(error)) {
      console.error('[PDF Agency Logo URL Route] Database connection error detected');
      return res.status(500).json({
        error: 'Database connection error',
        message: 'Unable to connect to the database. Please check your database configuration.',
        code: error.code,
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }

    // For other errors, pass to error handler
    return next(error);
  }
});

// DELETE /api/pdf/agency-logo/:slug - Remove agency logo
router.delete('/api/pdf/agency-logo/:slug', requireRole('TALENT'), async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { authorized, profile, error } = await verifyProfileOwnership(req, slug);

    if (!authorized) {
      return res.status(403).json({ error: error || 'Not authorized' });
    }

    if (!profile.is_pro) {
      return res.status(403).json({ error: 'Pro account required' });
    }

    // Load customizations
    let customizations = null;
    if (profile.pdf_customizations) {
      try {
        customizations = typeof profile.pdf_customizations === 'string'
          ? JSON.parse(profile.pdf_customizations)
          : profile.pdf_customizations;
      } catch (err) {
        customizations = {};
      }
    }

    if (customizations && customizations.agencyLogo) {
      // Delete uploaded logo file if it exists
      if (customizations.agencyLogo.type === 'upload' && customizations.agencyLogo.path) {
        const logoPath = path.join(__dirname, '..', '..', 'public', customizations.agencyLogo.path);
        try {
          if (fs.existsSync(logoPath)) {
            fs.unlinkSync(logoPath);
          }
        } catch (err) {
          console.error('Error deleting logo file:', err);
        }
      }

      // Remove logo from customizations
      delete customizations.agencyLogo;

      // Update profile
      await knex('profiles')
        .where({ id: profile.id })
        .update({ pdf_customizations: JSON.stringify(customizations) });
    }

    return res.json({
      ok: true,
      message: 'Logo removed successfully'
    });
  } catch (error) {
    // Log database connection errors for debugging
    console.error('[PDF Agency Logo Delete Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    // Check if it's a database connection error
    if (isDatabaseError(error)) {
      console.error('[PDF Agency Logo Delete Route] Database connection error detected');
      return res.status(500).json({
        error: 'Database connection error',
        message: 'Unable to connect to the database. Please check your database configuration.',
        code: error.code,
        details: process.env.NODE_ENV !== 'production' ? error.message : undefined
      });
    }

    // For other errors, pass to error handler
    return next(error);
  }
});

module.exports = router;
