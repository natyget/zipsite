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
      'ECONNRESET'
    ];

    const errorMessage = error.message.toLowerCase();
    return dbErrorKeywords.some(keyword => errorMessage.includes(keyword.toLowerCase()));
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

router.get('/pdf/view/:slug', async (req, res, next) => {
  try {
    const data = await loadProfile(req.params.slug);
    if (!data) {
      return res.status(404).render('errors/404', {
        title: 'Profile not found',
        layout: 'layout'
      });
    }
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

    // Load customizations from database (Pro users only)
    let customizations = null;
    if (profile.is_pro && profile.pdf_customizations) {
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

    // Generate QR code for Pro users linking to portfolio
    let qrCodeDataUrl = null;
    if (profile.is_pro) {
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

    // Get agency logo (Pro users only)
    let agencyLogo = null;
    if (profile.is_pro && customizations && customizations.agencyLogo) {
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
  } catch (error) {
    // Log database connection errors for debugging
    console.error('[PDF View Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });

    // Check if it's a database connection error
    if (isDatabaseError(error)) {
      console.error('[PDF View Route] Database connection error detected');
      // Return a more helpful error for database connection issues
      return res.status(500).render('errors/500', {
        title: 'Database Connection Error',
        layout: 'layout',
        error: {
          message: 'Unable to connect to the database. Please check your database configuration.',
          code: error.code,
          name: error.name,
          details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        },
        isDevelopment: process.env.NODE_ENV !== 'production',
        isDatabaseError: true
      });
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
