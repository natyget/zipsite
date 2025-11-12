const express = require('express');
const knex = require('../db/knex');
const { requireRole } = require('../middleware/auth');
const { toFeetInches } = require('../lib/stats');
const { talentProfileUpdateSchema } = require('../lib/validation');
const { normalizeMeasurements, curateBio } = require('../lib/curate');
const { addMessage } = require('../middleware/context');
const { upload, processImage } = require('../lib/uploader');
const { sendRejectedApplicantEmail } = require('../lib/email');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const { getAllThemes, getFreeThemes, getProThemes, getTheme, getDefaultTheme, getAvailableFonts, getAvailableColorPalettes } = require('../lib/themes');
const { getAllLayoutPresets } = require('../lib/pdf-layouts');

const router = express.Router();

router.get('/dashboard/talent', requireRole('TALENT'), async (req, res, next) => {
  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      return res.redirect('/apply');
    }
    const images = await knex('images').where({ profile_id: profile.id }).orderBy('sort', 'asc');
    
    // Debug: Log image count and paths for troubleshooting
    if (process.env.NODE_ENV === 'development' && images.length > 0) {
      console.log(`[Dashboard] Loaded ${images.length} images for profile ${profile.id}`);
    }

    const completeness = {
      basics: Boolean(profile.first_name && profile.last_name && profile.city && profile.bio_curated),
      imagery: images.length >= 2,
      hero: Boolean(profile.hero_image_path || images.length > 0)
    };

    const shareUrl = `${req.protocol}://${req.get('host')}/portfolio/${profile.slug}`;
    const currentUser = await knex('users')
      .where({ id: req.session.userId })
      .first();
    
    // Get themes for PDF theme selector modal
    const allThemes = getAllThemes();
    const freeThemes = getFreeThemes();
    const proThemes = getProThemes();
    const currentTheme = profile.pdf_theme || getDefaultTheme();
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    return res.render('dashboard/talent', {
      title: 'Talent Dashboard',
      profile,
      images,
      completeness,
      stats: { heightFeet: toFeetInches(profile.height_cm) },
      shareUrl,
      user: currentUser,
      currentUser,
      isDashboard: true,
      layout: 'layouts/dashboard',
      allThemes,
      freeThemes,
      proThemes,
      currentTheme,
      baseUrl
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/dashboard/talent', requireRole('TALENT'), async (req, res, next) => {
  const parsed = talentProfileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    try {
      const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
      const images = await knex('images').where({ profile_id: profile.id }).orderBy('sort');
      const completeness = {
        basics: Boolean(profile.first_name && profile.last_name && profile.city && profile.bio_curated),
        imagery: images.length >= 2,
        hero: Boolean(profile.hero_image_path || images.length > 0)
      };
      const shareUrl = `${req.protocol}://${req.get('host')}/portfolio/${profile.slug}`;
      return res.status(422).render('dashboard/talent', {
        title: 'Talent Dashboard',
        profile,
        images,
        completeness,
        stats: { heightFeet: toFeetInches(profile.height_cm) },
        shareUrl,
        isDashboard: true,
        formErrors: fieldErrors,
        values: req.body,
        layout: 'layouts/dashboard'
      });
    } catch (error) {
      return next(error);
    }
  }

  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      addMessage(req, 'error', 'Profile not found.');
      return res.redirect('/apply');
    }

    const { city, height_cm, measurements, bio } = parsed.data;
    const curatedBio = curateBio(bio, profile.first_name, profile.last_name);
    const cleanedMeasurements = normalizeMeasurements(measurements);

    await knex('profiles')
      .where({ id: profile.id })
      .update({
        city,
        height_cm,
        measurements: cleanedMeasurements,
        bio_raw: bio,
        bio_curated: curatedBio,
        updated_at: knex.fn.now()
      });

    addMessage(req, 'success', 'Profile updated.');
    return res.redirect('/dashboard/talent');
  } catch (error) {
    return next(error);
  }
});

// POST route for uploading multiple media files
router.post('/dashboard/talent/media', requireRole('TALENT'), upload.array('media', 12), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      addMessage(req, 'error', 'Please select at least one image to upload.');
      return res.redirect('/dashboard/talent');
    }

    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      addMessage(req, 'error', 'Profile not found.');
      return res.redirect('/apply');
    }

    const countResult = await knex('images')
      .where({ profile_id: profile.id })
      .count({ total: '*' })
      .first();
    let nextSort = Number(countResult?.total || 0) + 1;

    const uploadedFiles = [];
    let heroSet = false;
    for (const file of req.files) {
      try {
        const storedPath = await processImage(file.path);
        const imageId = uuidv4();
        await knex('images').insert({
          id: imageId,
          profile_id: profile.id,
          path: storedPath,
          label: 'Portfolio image',
          sort: nextSort++
        });
        uploadedFiles.push(storedPath);

        // Set first uploaded image as hero if no hero exists
        if (!profile.hero_image_path && !heroSet && uploadedFiles.length === 1) {
          await knex('profiles').where({ id: profile.id }).update({ hero_image_path: storedPath });
          heroSet = true;
        }
      } catch (fileError) {
        console.error('Error processing file:', fileError);
        console.error('File details:', { name: file.originalname, size: file.size, mimetype: file.mimetype });
        // Continue with other files even if one fails
      }
    }

    if (uploadedFiles.length > 0) {
      addMessage(req, 'success', `Successfully uploaded ${uploadedFiles.length} image${uploadedFiles.length > 1 ? 's' : ''}.`);
      // Force a fresh page load to show new images
      return res.redirect(303, '/dashboard/talent');
    } else {
      addMessage(req, 'error', 'Failed to upload images. Please try again.');
      return res.redirect('/dashboard/talent');
    }
  } catch (error) {
    return next(error);
  }
});

// DELETE route for removing media
router.delete('/dashboard/talent/media/:id', requireRole('TALENT'), async (req, res, next) => {
  try {
    const mediaId = req.params.id;
    if (!mediaId || typeof mediaId !== 'string') {
      return res.status(400).json({ error: 'Invalid media ID' });
    }

    // Get the media record to verify ownership
    const media = await knex('images')
      .select('images.*', 'profiles.user_id')
      .leftJoin('profiles', 'images.profile_id', 'profiles.id')
      .where('images.id', mediaId)
      .first();

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Verify the current user owns this media
    if (media.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Delete the file from disk
    // media.path is like "/uploads/seed/file.webp" (relative to project root)
    // We need to resolve it to absolute path
    let filePath;
    if (media.path.startsWith('/uploads/')) {
      // Path is relative to project root, resolve from project root
      const relativePath = media.path.slice(1); // Remove leading '/'
      filePath = path.join(__dirname, '..', '..', relativePath);
    } else if (media.path.startsWith('/')) {
      // Other absolute path starting with /
      const relativePath = media.path.slice(1);
      filePath = path.join(__dirname, '..', '..', relativePath);
    } else {
      // Relative path, assume it's in uploads directory
      filePath = path.join(config.uploadsDir, media.path);
    }
    try {
      await fs.unlink(filePath);
    } catch (fileError) {
      // Log but don't fail if file doesn't exist
      console.warn(`Could not delete file ${filePath}:`, fileError.message);
    }

    // Delete from database
    await knex('images').where({ id: mediaId }).delete();

    // Check if this was the hero image and update profile if needed
    const profile = await knex('profiles').where({ id: media.profile_id }).first();
    if (profile && profile.hero_image_path === media.path) {
      // Set hero to next available image, or null
      const nextImage = await knex('images')
        .where({ profile_id: media.profile_id })
        .orderBy('sort')
        .first();

      await knex('profiles')
        .where({ id: media.profile_id })
        .update({
          hero_image_path: nextImage ? nextImage.path : null,
          updated_at: knex.fn.now()
        });
    }

    return res.json({ success: true, deleted: mediaId });
  } catch (error) {
    console.error('Media delete error:', error);
    return res.status(500).json({ error: 'Failed to delete media' });
  }
});

router.get('/dashboard/agency', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const {
      sort = 'az',
      city = '',
      letter = '',
      search = '',
      min_height = '',
      max_height = '',
      status = ''
    } = req.query;

    let query = knex('profiles')
      .select(
        'profiles.*',
        'users.email as owner_email',
        'applications.status as application_status',
        'applications.id as application_id'
      )
      .leftJoin('users', 'profiles.user_id', 'users.id')
      .leftJoin('applications', (join) => {
        join.on('applications.profile_id', '=', 'profiles.id')
          .andOn('applications.agency_id', '=', knex.raw('?', [req.session.userId]));
      })
      .whereNotNull('profiles.bio_curated');

    if (city) {
      query = query.whereILike('profiles.city', `%${city}%`);
    }

    if (letter) {
      query = query.whereILike('profiles.last_name', `${letter}%`);
    }

    if (search) {
      query = query.andWhere((qb) => {
        qb.whereILike('profiles.first_name', `%${search}%`)
          .orWhereILike('profiles.last_name', `%${search}%`);
      });
    }

    // Filter by application status
    if (status && status !== 'all') {
      if (status === 'pending') {
        query = query.where(function() {
          this.where('applications.status', 'pending')
            .orWhereNull('applications.status');
        });
      } else {
        query = query.where('applications.status', status);
      }
    }

    const minHeightNumber = parseInt(min_height, 10);
    const maxHeightNumber = parseInt(max_height, 10);
    if (!Number.isNaN(minHeightNumber)) {
      query = query.where('profiles.height_cm', '>=', minHeightNumber);
    }
    if (!Number.isNaN(maxHeightNumber)) {
      query = query.where('profiles.height_cm', '<=', maxHeightNumber);
    }

    if (sort === 'city') {
      query = query.orderBy(['profiles.city', 'profiles.last_name']);
    } else {
      query = query.orderBy(['profiles.last_name', 'profiles.first_name']);
    }

    const profiles = await query;

    const commissions = await knex('commissions')
      .where({ agency_id: req.session.userId })
      .sum({ total: 'amount_cents' })
      .first();

    const latestCommissions = await knex('commissions')
      .select('commissions.*', 'profiles.first_name', 'profiles.last_name', 'profiles.slug')
      .leftJoin('profiles', 'commissions.profile_id', 'profiles.id')
      .where('commissions.agency_id', req.session.userId)
      .orderBy('commissions.created_at', 'desc')
      .limit(5);

    // Get current user data with agency branding
    const currentUser = await knex('users')
      .where({ id: req.session.userId })
      .first();

    return res.render('dashboard/agency', {
      title: 'Agency Dashboard',
      profiles,
      filters: { sort, city, letter, search, min_height, max_height, status },
      commissionsTotal: ((commissions?.total || 0) / 100).toFixed(2),
      latestCommissions,
      user: currentUser,
      currentUser,
      isDashboard: true,
      layout: 'layouts/dashboard'
    });
  } catch (error) {
    return next(error);
  }
});

// POST /dashboard/agency/application/:action - Handle application status updates
router.post('/dashboard/agency/application/:action', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { action } = req.params; // accept, archive, decline
    const { profile_id } = req.body;

    if (!profile_id) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ error: 'Profile ID is required' });
      }
      addMessage(req, 'error', 'Invalid request');
      return res.redirect('/dashboard/agency');
    }

    if (!['accept', 'archive', 'decline'].includes(action)) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      addMessage(req, 'error', 'Invalid action');
      return res.redirect('/dashboard/agency');
    }

    // Check if application exists
    let application = await knex('applications')
      .where({ profile_id, agency_id: req.session.userId })
      .first();

    const updateData = {
      status: action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'archived',
      updated_at: knex.fn.now()
    };

    if (action === 'accept') {
      updateData.accepted_at = knex.fn.now();
      updateData.declined_at = null;
    } else if (action === 'decline') {
      updateData.declined_at = knex.fn.now();
      updateData.accepted_at = null;
    } else {
      updateData.declined_at = null;
      updateData.accepted_at = null;
    }

    if (application) {
      // Update existing application
      await knex('applications')
        .where({ id: application.id })
        .update(updateData);
    } else {
      // Create new application record
      await knex('applications').insert({
        id: uuidv4(),
        profile_id,
        agency_id: req.session.userId,
        ...updateData
      });
    }

    // If declined, trigger email to applicant
    if (action === 'decline') {
      try {
        // Get profile and user info for email
        const profile = await knex('profiles')
          .where({ id: profile_id })
          .first();
        
        if (profile) {
          const talentUser = await knex('users')
            .where({ id: profile.user_id })
            .first();
          
          const agency = await knex('users')
            .where({ id: req.session.userId })
            .first();

          if (talentUser && agency) {
            await sendRejectedApplicantEmail({
              talentEmail: talentUser.email,
              talentName: `${profile.first_name} ${profile.last_name}`,
              agencyName: agency.agency_name || agency.email,
              agencyEmail: agency.email
            });
          }
        }
      } catch (emailError) {
        // Log error but don't fail the request
        console.error('[Application] Email send error:', emailError);
      }
    }

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, action });
    }

    addMessage(req, 'success', `Application ${action}ed successfully`);
    return res.redirect('/dashboard/agency');
  } catch (error) {
    console.error('[Application] Error:', error);
    return next(error);
  }
});

// GET /dashboard/pdf-customizer - PDF Customizer Page (Pro users only)
router.get('/dashboard/pdf-customizer', requireRole('TALENT'), async (req, res, next) => {
  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      addMessage(req, 'error', 'Profile not found.');
      return res.redirect('/apply');
    }
    
    if (!profile.is_pro) {
      addMessage(req, 'error', 'Pro account required to customize PDF comp cards.');
      return res.redirect('/dashboard/talent');
    }
    
    // Load customizations
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
    
    // Get current theme
    const currentTheme = profile.pdf_theme || getDefaultTheme();
    const theme = getTheme(currentTheme);
    
    // Get all themes, fonts, color palettes, and layouts
    const allThemes = getAllThemes();
    const freeThemes = getFreeThemes();
    const proThemes = getProThemes();
    const availableFonts = getAvailableFonts();
    const colorPalettes = getAvailableColorPalettes();
    const layoutPresets = getAllLayoutPresets();
    
    const currentUser = await knex('users')
      .where({ id: req.session.userId })
      .first();
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    return res.render('dashboard/pdf-customizer', {
      title: 'PDF Customizer',
      profile,
      customizations: customizations || {},
      currentTheme,
      theme,
      allThemes,
      freeThemes,
      proThemes,
      availableFonts,
      colorPalettes,
      layoutPresets,
      user: currentUser,
      currentUser,
      isDashboard: true,
      layout: 'layouts/dashboard',
      baseUrl,
      profileSlug: profile.slug
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;