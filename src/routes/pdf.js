const express = require('express');
const { renderCompCard, loadProfile, toFeetInches } = require('../lib/pdf');
const { getTheme, isProTheme, getDefaultTheme } = require('../lib/themes');
const knex = require('../db/knex');
const QRCode = require('qrcode');

const router = express.Router();

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
    
    // Get theme from query parameter, default to profile's saved theme or 'ink'
    let themeKey = req.query.theme || profile.pdf_theme || getDefaultTheme();
    
    // Validate theme exists
    const theme = getTheme(themeKey);
    if (!theme) {
      themeKey = getDefaultTheme();
    }
    
    // Check if Pro theme is selected but user is not Pro
    if (isProTheme(themeKey) && !profile.is_pro) {
      themeKey = getDefaultTheme();
    }
    
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
            dark: themeKey === 'noir' || themeKey === 'slate' ? '#FAF9F7' : '#0F172A',
            light: '#FFFFFF'
          }
        });
      } catch (error) {
        console.error('QR code generation failed:', error);
      }
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
      theme: themeKey,
      baseUrl,
      isPro: profile.is_pro,
      qrCode: qrCodeDataUrl,
      portfolioUrl: `${baseUrl}/portfolio/${profile.slug}`
    });
  } catch (error) {
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
    const theme = getTheme(themeKey);
    if (!theme) {
      themeKey = getDefaultTheme();
    }
    
    // Check if Pro theme is selected but user is not Pro
    if (isProTheme(themeKey) && !profile.is_pro) {
      themeKey = getDefaultTheme();
    }
    
    // Save theme preference if user is logged in and owns this profile
    if (req.session.userId && profile.user_id === req.session.userId && themeKey !== profile.pdf_theme) {
      await knex('profiles')
        .where({ id: profile.id })
        .update({ pdf_theme: themeKey });
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
    return next(error);
  }
});

module.exports = router;
