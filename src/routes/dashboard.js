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
const { ensureUniqueSlug } = require('../lib/slugify');
const { calculateAge, generateSocialMediaUrl, parseSocialMediaHandle, convertKgToLbs, convertLbsToKg } = require('../lib/profile-helpers');

const router = express.Router();

// Helper function to determine dashboard redirect based on user role
function getDashboardRedirect(role) {
  if (role === 'TALENT') return '/dashboard/talent';
  if (role === 'AGENCY') return '/dashboard/agency';
  return '/';
}

// Redirect /dashboard to appropriate dashboard based on user role
router.get('/dashboard', async (req, res, next) => {
  try {
    // Check if user is logged in
    if (!req.session || !req.session.userId) {
      return res.redirect('/login');
    }
    
    // Get user role
    const user = await knex('users').where({ id: req.session.userId }).first();
    if (!user) {
      return res.redirect('/login');
    }
    
    // Redirect based on role - dashboard routes handle empty states internally
    return res.redirect(getDashboardRedirect(user.role));
  } catch (error) {
    console.error('[Dashboard] Error redirecting /dashboard:', error);
    // On error, try to redirect based on session role if available
    if (req.session && req.session.role) {
      return res.redirect(getDashboardRedirect(req.session.role));
    }
    return res.redirect('/login');
  }
});

router.get('/dashboard/talent', requireRole('TALENT'), async (req, res, next) => {
  try {
    console.log('[Dashboard/Talent] Loading profile for user:', {
      userId: req.session.userId,
      role: req.session.role
    });
    
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    
    console.log('[Dashboard/Talent] Profile lookup result:', {
      userId: req.session.userId,
      profileFound: !!profile,
      profileId: profile?.id || null,
      profileSlug: profile?.slug || null,
      profileName: profile ? `${profile.first_name} ${profile.last_name}` : null
    });
    
    if (!profile) {
      // Logged-in user without profile - show dashboard with empty state
      // Don't redirect to /apply since /apply is only for logged-out users
      const currentUser = await knex('users')
        .where({ id: req.session.userId })
        .first();
      
      addMessage(req, 'info', 'Complete your profile to get started! Fill out the form below.');
      
      return res.render('dashboard/talent', {
        title: 'Talent Dashboard',
        profile: null,
        images: [],
        completeness: {
          basics: false,
          imagery: false,
          hero: false
        },
        stats: null,
        shareUrl: null,
        user: currentUser,
        currentUser,
        isDashboard: true,
        layout: 'layouts/dashboard',
        allThemes: getAllThemes(),
        freeThemes: getFreeThemes(),
        proThemes: getProThemes(),
        currentTheme: getDefaultTheme(),
        baseUrl: `${req.protocol}://${req.get('host')}`,
        showProfileForm: true // Flag to show profile creation form
      });
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
    // Log database connection errors for debugging
    console.error('[Dashboard/Talent] Database error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    // Check if it's a missing tables error (needs migrations)
    const isMissingTablesError = error.code === '42P01' || 
                                  (error.message && (
                                    error.message.includes('relation') && error.message.includes('does not exist') ||
                                    error.message.includes('table') && error.message.includes('does not exist')
                                  ));
    
    if (isMissingTablesError) {
      console.error('[Dashboard/Talent] Missing tables error detected - migrations need to be run');
      return res.status(500).render('errors/500', {
        title: 'Database Setup Required',
        layout: 'layout',
        error: {
          message: 'Database tables do not exist. Please run migrations to set up the database.',
          code: error.code,
          name: error.name,
          details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
          migrationRequired: true
        },
        isDevelopment: process.env.NODE_ENV !== 'production',
        isDatabaseError: true
      });
    }
    
    // Check if it's a database connection error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNRESET' || error.code === '42P01' || error.code === '42P07' || 
        error.code === '3D000' || error.code === '28P01' ||
        error.message && (
          error.message.includes('connect') || 
          error.message.includes('connection') || 
          error.message.includes('DATABASE_URL') || 
          error.message.includes('database') ||
          error.message.includes('Cannot find module \'pg\'') ||
          error.message.includes('Knex: run') ||
          (error.message.includes('relation') && error.message.includes('does not exist'))
        )) {
      console.error('[Dashboard/Talent] Database connection error detected');
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

router.post('/dashboard/talent', requireRole('TALENT'), async (req, res, next) => {
  const parsed = talentProfileUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    try {
      // Ensure userId exists in session
      if (!req.session || !req.session.userId) {
        console.error('[Dashboard/Talent POST] No userId in session');
        addMessage(req, 'error', 'Session expired. Please log in again.');
        return res.redirect('/login');
      }
      
      const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
      const currentUser = await knex('users')
        .where({ id: req.session.userId })
        .first();
      
      // Ensure currentUser exists (should always exist if requireRole passed, but be safe)
      if (!currentUser) {
        console.error('[Dashboard/Talent POST] User not found in database:', req.session.userId);
        addMessage(req, 'error', 'User account not found. Please log in again.');
        return res.redirect('/login');
      }
      
      // Handle case where profile doesn't exist (null check)
      if (!profile) {
        return res.status(422).render('dashboard/talent', {
          title: 'Talent Dashboard',
          profile: null,
          images: [],
          completeness: {
            basics: false,
            imagery: false,
            hero: false
          },
          stats: null,
          shareUrl: null,
          user: currentUser,
          currentUser,
          isDashboard: true,
          layout: 'layouts/dashboard',
          allThemes: getAllThemes(),
          freeThemes: getFreeThemes(),
          proThemes: getProThemes(),
          currentTheme: getDefaultTheme(),
          baseUrl: `${req.protocol}://${req.get('host')}`,
          formErrors: fieldErrors,
          values: req.body,
          showProfileForm: true
        });
      }
      
      // Profile exists - render with profile data
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
        user: currentUser,
        currentUser,
        isDashboard: true,
        layout: 'layouts/dashboard',
        allThemes: getAllThemes(),
        freeThemes: getFreeThemes(),
        proThemes: getProThemes(),
        currentTheme: profile.pdf_theme || getDefaultTheme(),
        baseUrl: `${req.protocol}://${req.get('host')}`,
        formErrors: fieldErrors,
        values: req.body
      });
    } catch (error) {
      console.error('[Dashboard/Talent POST] Error in validation error handler:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      return next(error);
    }
  }

  try {
    // Ensure userId exists in session
    if (!req.session || !req.session.userId) {
      console.error('[Dashboard/Talent POST] No userId in session');
      addMessage(req, 'error', 'Session expired. Please log in again.');
      return res.redirect('/login');
    }
    
    // Get user record for profile creation if needed
    const currentUser = await knex('users').where({ id: req.session.userId }).first();
    if (!currentUser) {
      console.error('[Dashboard/Talent POST] User not found:', req.session.userId);
      addMessage(req, 'error', 'User account not found. Please log in again.');
      return res.redirect('/login');
    }
    
    let profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    
    // If profile doesn't exist, create a minimal one with placeholder names
    // The user can update first_name/last_name later via /apply or a full profile form
    if (!profile) {
      console.log('[Dashboard/Talent POST] Profile not found, creating minimal profile for user:', req.session.userId);
      
      // Extract a name from email as placeholder (e.g., "john@example.com" -> "John User")
      const emailParts = currentUser.email.split('@')[0];
      const placeholderFirstName = emailParts.charAt(0).toUpperCase() + emailParts.slice(1).split('.')[0];
      const placeholderLastName = 'User';
      
      const profileId = uuidv4();
      const slug = await ensureUniqueSlug(knex, 'profiles', `${placeholderFirstName}-${placeholderLastName}`);
      
      // Extract all fields from parsed data
      const {
        city, height_cm, measurements, bio,
        gender, date_of_birth, weight_kg, weight_lbs, dress_size, hair_length, skin_tone,
        languages, availability_travel, availability_schedule, experience_level, training, portfolio_url,
        instagram_handle, twitter_handle, tiktok_handle,
        reference_name, reference_email, reference_phone, reference_relationship,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        nationality, union_membership, ethnicity, tattoos, piercings,
        phone, bust, waist, hips, shoe_size, eye_color, hair_color, specialties
      } = parsed.data;
      
      const curatedBio = curateBio(bio, placeholderFirstName, placeholderLastName);
      const cleanedMeasurements = normalizeMeasurements(measurements);
      
      // Calculate age from date of birth
      let age = null;
      if (date_of_birth) {
        age = calculateAge(date_of_birth);
      }
      
      // Handle weight conversion
      let finalWeightKg = weight_kg || null;
      let finalWeightLbs = weight_lbs || null;
      if (finalWeightKg && !finalWeightLbs) {
        finalWeightLbs = convertKgToLbs(finalWeightKg);
      } else if (finalWeightLbs && !finalWeightKg) {
        finalWeightKg = convertLbsToKg(finalWeightLbs);
      }
      
      // Handle languages - convert to JSON string
      const languagesJson = languages && Array.isArray(languages) && languages.length > 0
        ? JSON.stringify(languages)
        : null;
      
      // Handle specialties - convert to JSON string
      const specialtiesJson = specialties && Array.isArray(specialties) && specialties.length > 0
        ? JSON.stringify(specialties)
        : null;
      
      // Clean social media handles (Free users - no URLs)
      const cleanInstagramHandle = instagram_handle ? parseSocialMediaHandle(instagram_handle) : null;
      const cleanTwitterHandle = twitter_handle ? parseSocialMediaHandle(twitter_handle) : null;
      const cleanTiktokHandle = tiktok_handle ? parseSocialMediaHandle(tiktok_handle) : null;
      
      // Create minimal profile with the form data
      await knex('profiles').insert({
        id: profileId,
        user_id: req.session.userId,
        slug,
        first_name: placeholderFirstName,
        last_name: placeholderLastName,
        city,
        phone: phone || null,
        height_cm,
        bust: bust || null,
        waist: waist || null,
        hips: hips || null,
        shoe_size: shoe_size || null,
        eye_color: eye_color || null,
        hair_color: hair_color || null,
        measurements: cleanedMeasurements,
        bio_raw: bio,
        bio_curated: curatedBio,
        specialties: specialtiesJson,
        gender: gender || null,
        date_of_birth: date_of_birth || null,
        age: age,
        weight_kg: finalWeightKg,
        weight_lbs: finalWeightLbs,
        dress_size: dress_size || null,
        hair_length: hair_length || null,
        skin_tone: skin_tone || null,
        languages: languagesJson,
        availability_travel: availability_travel || null,
        availability_schedule: availability_schedule || null,
        experience_level: experience_level || null,
        training: training || null,
        portfolio_url: portfolio_url || null,
        instagram_handle: cleanInstagramHandle,
        instagram_url: null, // Free users don't get URLs
        twitter_handle: cleanTwitterHandle,
        twitter_url: null, // Free users don't get URLs
        tiktok_handle: cleanTiktokHandle,
        tiktok_url: null, // Free users don't get URLs
        reference_name: reference_name || null,
        reference_email: reference_email || null,
        reference_phone: reference_phone || null,
        reference_relationship: reference_relationship || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        emergency_contact_relationship: emergency_contact_relationship || null,
        nationality: nationality || null,
        union_membership: union_membership || null,
        ethnicity: ethnicity || null,
        tattoos: tattoos || null,
        piercings: piercings || null,
        is_pro: false,
        pdf_theme: null,
        pdf_customizations: null
      });
      
      console.log('[Dashboard/Talent POST] Created minimal profile:', {
        profileId,
        userId: req.session.userId,
        slug,
        firstName: placeholderFirstName,
        lastName: placeholderLastName
      });
      
      // Reload profile
      profile = await knex('profiles').where({ id: profileId }).first();
      
      // Log activity (non-blocking)
      logActivity(req.session.userId, 'profile_updated', {
        profileId: profileId,
        slug: slug,
        action: 'created'
      }).catch(err => {
        console.error('[Dashboard] Error logging activity:', err);
      });
      
      addMessage(req, 'success', 'Profile created! You can update your name and other details anytime.');
      return res.redirect('/dashboard/talent');
    }

    // Profile exists - update it
    // Extract all fields from parsed data
    const {
      city, height_cm, measurements, bio,
      gender, date_of_birth, weight_kg, weight_lbs, dress_size, hair_length, skin_tone,
      languages, availability_travel, availability_schedule, experience_level, training, portfolio_url,
      instagram_handle, twitter_handle, tiktok_handle,
      reference_name, reference_email, reference_phone, reference_relationship,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
      nationality, union_membership, ethnicity, tattoos, piercings,
      phone, bust, waist, hips, shoe_size, eye_color, hair_color, specialties
    } = parsed.data;
    
    const curatedBio = curateBio(bio, profile.first_name, profile.last_name);
    const cleanedMeasurements = normalizeMeasurements(measurements);
    
    // Calculate age from date of birth
    let age = profile.age || null;
    if (date_of_birth) {
      age = calculateAge(date_of_birth);
    } else if (profile.date_of_birth) {
      age = calculateAge(profile.date_of_birth);
    }
    
    // Handle weight conversion
    let finalWeightKg = weight_kg || null;
    let finalWeightLbs = weight_lbs || null;
    if (finalWeightKg && !finalWeightLbs) {
      finalWeightLbs = convertKgToLbs(finalWeightKg);
    } else if (finalWeightLbs && !finalWeightKg) {
      finalWeightKg = convertLbsToKg(finalWeightLbs);
    }
    
    // Handle languages - convert to JSON string (only if provided in form)
    let languagesJson = profile.languages; // Keep existing if not provided
    if (languages !== undefined) {
      languagesJson = languages && Array.isArray(languages) && languages.length > 0
        ? JSON.stringify(languages)
        : null;
    }
    
    // Handle specialties - convert to JSON string (only if provided in form)
    let specialtiesJson = profile.specialties; // Keep existing if not provided
    if (specialties !== undefined) {
      specialtiesJson = specialties && Array.isArray(specialties) && specialties.length > 0
        ? JSON.stringify(specialties)
        : null;
    }
    
    // Handle weight (only if provided in form)
    if (weight_kg === undefined && weight_lbs === undefined) {
      // Keep existing weight values
      finalWeightKg = profile.weight_kg;
      finalWeightLbs = profile.weight_lbs;
    }
    
    // Check if user is Pro to determine if we should generate social media URLs
    const isPro = profile.is_pro || false;
    
    // Clean social media handles (only if provided in form)
    let cleanInstagramHandle = profile.instagram_handle;
    let cleanTwitterHandle = profile.twitter_handle;
    let cleanTiktokHandle = profile.tiktok_handle;
    
    if (instagram_handle !== undefined) {
      cleanInstagramHandle = instagram_handle ? parseSocialMediaHandle(instagram_handle) : null;
    }
    if (twitter_handle !== undefined) {
      cleanTwitterHandle = twitter_handle ? parseSocialMediaHandle(twitter_handle) : null;
    }
    if (tiktok_handle !== undefined) {
      cleanTiktokHandle = tiktok_handle ? parseSocialMediaHandle(tiktok_handle) : null;
    }
    
    // Generate URLs for Pro users if handles are provided but URLs are not
    let finalInstagramUrl = profile.instagram_url || null;
    let finalTwitterUrl = profile.twitter_url || null;
    let finalTiktokUrl = profile.tiktok_url || null;
    
    if (isPro) {
      // Pro users get URLs - generate from handles if URL not provided and handle exists
      if (cleanInstagramHandle && !finalInstagramUrl) {
        finalInstagramUrl = generateSocialMediaUrl('instagram', cleanInstagramHandle);
      }
      if (cleanTwitterHandle && !finalTwitterUrl) {
        finalTwitterUrl = generateSocialMediaUrl('twitter', cleanTwitterHandle);
      }
      if (cleanTiktokHandle && !finalTiktokUrl) {
        finalTiktokUrl = generateSocialMediaUrl('tiktok', cleanTiktokHandle);
      }
    } else {
      // Free users don't get URLs - clear any URLs if handles are being updated
      if (instagram_handle !== undefined) finalInstagramUrl = null;
      if (twitter_handle !== undefined) finalTwitterUrl = null;
      if (tiktok_handle !== undefined) finalTiktokUrl = null;
    }
    
    // Build update object - only update fields that were provided in the form
    const updateData = {
      updated_at: knex.fn.now()
    };
    
    // Only update fields that are explicitly in parsed.data (were submitted in form)
    if (city !== undefined) updateData.city = city;
    if (phone !== undefined) updateData.phone = phone || null;
    if (height_cm !== undefined) updateData.height_cm = height_cm;
    if (bust !== undefined) updateData.bust = bust || null;
    if (waist !== undefined) updateData.waist = waist || null;
    if (hips !== undefined) updateData.hips = hips || null;
    if (shoe_size !== undefined) updateData.shoe_size = shoe_size || null;
    if (eye_color !== undefined) updateData.eye_color = eye_color || null;
    if (hair_color !== undefined) updateData.hair_color = hair_color || null;
    if (measurements !== undefined) updateData.measurements = cleanedMeasurements;
    if (bio !== undefined) {
      updateData.bio_raw = bio;
      updateData.bio_curated = curatedBio;
    }
    if (specialties !== undefined) updateData.specialties = specialtiesJson;
    if (gender !== undefined) updateData.gender = gender || null;
    if (date_of_birth !== undefined) {
      updateData.date_of_birth = date_of_birth || null;
      updateData.age = age; // Recalculate age if DOB changed
    }
    if (weight_kg !== undefined || weight_lbs !== undefined) {
      updateData.weight_kg = finalWeightKg;
      updateData.weight_lbs = finalWeightLbs;
    }
    if (dress_size !== undefined) updateData.dress_size = dress_size || null;
    if (hair_length !== undefined) updateData.hair_length = hair_length || null;
    if (skin_tone !== undefined) updateData.skin_tone = skin_tone || null;
    if (languages !== undefined) updateData.languages = languagesJson;
    if (availability_travel !== undefined) updateData.availability_travel = availability_travel || null;
    if (availability_schedule !== undefined) updateData.availability_schedule = availability_schedule || null;
    if (experience_level !== undefined) updateData.experience_level = experience_level || null;
    if (training !== undefined) updateData.training = training || null;
    if (portfolio_url !== undefined) updateData.portfolio_url = portfolio_url || null;
    if (instagram_handle !== undefined) {
      updateData.instagram_handle = cleanInstagramHandle;
      updateData.instagram_url = finalInstagramUrl;
    }
    if (twitter_handle !== undefined) {
      updateData.twitter_handle = cleanTwitterHandle;
      updateData.twitter_url = finalTwitterUrl;
    }
    if (tiktok_handle !== undefined) {
      updateData.tiktok_handle = cleanTiktokHandle;
      updateData.tiktok_url = finalTiktokUrl;
    }
    if (reference_name !== undefined) updateData.reference_name = reference_name || null;
    if (reference_email !== undefined) updateData.reference_email = reference_email || null;
    if (reference_phone !== undefined) updateData.reference_phone = reference_phone || null;
    if (reference_relationship !== undefined) updateData.reference_relationship = reference_relationship || null;
    if (emergency_contact_name !== undefined) updateData.emergency_contact_name = emergency_contact_name || null;
    if (emergency_contact_phone !== undefined) updateData.emergency_contact_phone = emergency_contact_phone || null;
    if (emergency_contact_relationship !== undefined) updateData.emergency_contact_relationship = emergency_contact_relationship || null;
    if (nationality !== undefined) updateData.nationality = nationality || null;
    if (union_membership !== undefined) updateData.union_membership = union_membership || null;
    if (ethnicity !== undefined) updateData.ethnicity = ethnicity || null;
    if (tattoos !== undefined) updateData.tattoos = tattoos || null;
    if (piercings !== undefined) updateData.piercings = piercings || null;

    await knex('profiles')
      .where({ id: profile.id })
      .update(updateData);

    // Log activity (non-blocking)
    logActivity(req.session.userId, 'profile_updated', {
      profileId: profile.id,
      slug: profile.slug
    }).catch(err => {
      console.error('[Dashboard] Error logging activity:', err);
    });

    addMessage(req, 'success', 'Profile updated.');
    return res.redirect('/dashboard/talent');
  } catch (error) {
    console.error('[Dashboard/Talent POST] Error updating profile:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
      userId: req.session.userId,
      body: req.body
    });
    return next(error);
  }
});

// POST route for uploading multiple media files
router.post('/dashboard/talent/media', requireRole('TALENT'), upload.array('media', 12), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'Please select at least one image to upload.',
        success: false 
      });
    }

    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      return res.status(404).json({ 
        error: 'Profile not found.',
        success: false 
      });
    }

    const countResult = await knex('images')
      .where({ profile_id: profile.id })
      .count({ total: '*' })
      .first();
    let nextSort = Number(countResult?.total || 0) + 1;

    const uploadedImages = [];
    let heroSet = false;
    let heroImageId = null;
    let heroImagePath = null;

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

        // Set first uploaded image as hero if no hero exists
        if (!profile.hero_image_path && !heroSet && uploadedImages.length === 0) {
          await knex('profiles').where({ id: profile.id }).update({ hero_image_path: storedPath });
          heroSet = true;
          heroImageId = imageId;
          heroImagePath = storedPath;
        }

        uploadedImages.push({
          id: imageId,
          path: storedPath,
          label: 'Portfolio image',
          sort: nextSort - 1,
          profile_id: profile.id,
          created_at: new Date().toISOString()
        });
      } catch (fileError) {
        console.error('Error processing file:', fileError);
        console.error('File details:', { name: file.originalname, size: file.size, mimetype: file.mimetype });
        // Continue with other files even if one fails
      }
    }

    if (uploadedImages.length > 0) {
      // Get updated profile to check if hero was set
      const updatedProfile = await knex('profiles').where({ id: profile.id }).first();
      
      const totalImages = Number(countResult?.total || 0) + uploadedImages.length;
      
      // Log activity (non-blocking)
      logActivity(req.session.userId, 'image_uploaded', {
        profileId: profile.id,
        imageCount: uploadedImages.length,
        totalImages: totalImages
      }).catch(err => {
        console.error('[Dashboard] Error logging activity:', err);
      });
      
      return res.json({ 
        success: true,
        message: `Successfully uploaded ${uploadedImages.length} image${uploadedImages.length > 1 ? 's' : ''}.`,
        images: uploadedImages,
        heroImagePath: updatedProfile.hero_image_path,
        totalImages: totalImages
      });
    } else {
      return res.status(500).json({ 
        error: 'Failed to upload images. Please try again.',
        success: false 
      });
    }
  } catch (error) {
    console.error('[Dashboard/Media Upload] Error:', error);
    return res.status(500).json({ 
      error: 'An error occurred while uploading images.',
      success: false,
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// PUT route for setting hero image
router.put('/dashboard/talent/media/:id/hero', requireRole('TALENT'), async (req, res, next) => {
  try {
    const imageId = req.params.id;
    if (!imageId || typeof imageId !== 'string') {
      return res.status(400).json({ error: 'Invalid image ID' });
    }

    // Get the image record to verify ownership
    const image = await knex('images')
      .select('images.*', 'profiles.user_id', 'profiles.id as profile_id')
      .leftJoin('profiles', 'images.profile_id', 'profiles.id')
      .where('images.id', imageId)
      .first();

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Verify the current user owns this image
    if (image.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update profile hero image
    await knex('profiles')
      .where({ id: image.profile_id })
      .update({
        hero_image_path: image.path,
        updated_at: knex.fn.now()
      });

    return res.json({ 
      success: true, 
      message: 'Hero image updated successfully',
      heroImagePath: image.path
    });
  } catch (error) {
    console.error('Set hero image error:', error);
    return res.status(500).json({ error: 'Failed to set hero image' });
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

    // Check if this was the hero image and update profile if needed
    const profile = await knex('profiles').where({ id: media.profile_id }).first();
    let newHeroImagePath = null;
    if (profile && profile.hero_image_path === media.path) {
      // Set hero to next available image, or null
      const nextImage = await knex('images')
        .where({ profile_id: media.profile_id })
        .whereNot('id', mediaId) // Exclude the image we're about to delete
        .orderBy('sort')
        .first();

      newHeroImagePath = nextImage ? nextImage.path : null;
      await knex('profiles')
        .where({ id: media.profile_id })
        .update({
          hero_image_path: newHeroImagePath,
          updated_at: knex.fn.now()
        });
    } else {
      // Keep existing hero image path
      newHeroImagePath = profile?.hero_image_path || null;
    }

    // Delete from database
    await knex('images').where({ id: mediaId }).delete();

    return res.json({ 
      success: true, 
      deleted: mediaId,
      heroImagePath: newHeroImagePath
    });
  } catch (error) {
    console.error('Media delete error:', error);
    return res.status(500).json({ error: 'Failed to delete media' });
  }
});

// GET route for analytics
router.get('/dashboard/talent/analytics', requireRole('TALENT'), async (req, res, next) => {
  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get analytics for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get view counts
    const views = await knex('analytics')
      .where({ profile_id: profile.id, event_type: 'view' })
      .where('created_at', '>=', thirtyDaysAgo)
      .count({ total: '*' })
      .first();

    // Get download counts
    const downloads = await knex('analytics')
      .where({ profile_id: profile.id, event_type: 'download' })
      .where('created_at', '>=', thirtyDaysAgo)
      .count({ total: '*' })
      .first();

    // Get views this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const viewsThisWeek = await knex('analytics')
      .where({ profile_id: profile.id, event_type: 'view' })
      .where('created_at', '>=', weekAgo)
      .count({ total: '*' })
      .first();

    // Get downloads this week
    const downloadsThisWeek = await knex('analytics')
      .where({ profile_id: profile.id, event_type: 'download' })
      .where('created_at', '>=', weekAgo)
      .count({ total: '*' })
      .first();

    // Get views this month
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const viewsThisMonth = await knex('analytics')
      .where({ profile_id: profile.id, event_type: 'view' })
      .where('created_at', '>=', monthAgo)
      .count({ total: '*' })
      .first();

    // Get downloads this month
    const downloadsThisMonth = await knex('analytics')
      .where({ profile_id: profile.id, event_type: 'download' })
      .where('created_at', '>=', monthAgo)
      .count({ total: '*' })
      .first();

    // Get downloads by theme
    const downloadsByTheme = await knex('analytics')
      .where({ profile_id: profile.id, event_type: 'download' })
      .where('created_at', '>=', thirtyDaysAgo)
      .select(knex.raw('metadata->>\'theme\' as theme'))
      .count({ total: '*' })
      .groupBy('theme');

    return res.json({
      success: true,
      analytics: {
        views: {
          total: Number(views?.total || 0),
          thisWeek: Number(viewsThisWeek?.total || 0),
          thisMonth: Number(viewsThisMonth?.total || 0)
        },
        downloads: {
          total: Number(downloads?.total || 0),
          thisWeek: Number(downloadsThisWeek?.total || 0),
          thisMonth: Number(downloadsThisMonth?.total || 0),
          byTheme: downloadsByTheme.map(item => ({
            theme: item.theme || 'unknown',
            count: Number(item.total || 0)
          }))
        }
      }
    });
  } catch (error) {
    console.error('[Dashboard/Analytics] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to load analytics',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// GET route for activity feed
router.get('/dashboard/talent/activity', requireRole('TALENT'), async (req, res, next) => {
  try {
    // Get recent activities for the user
    const activities = await knex('activities')
      .where({ user_id: req.session.userId })
      .orderBy('created_at', 'desc')
      .limit(10);

    // Format activities
    const formattedActivities = activities.map(activity => {
      const metadata = typeof activity.metadata === 'string' 
        ? JSON.parse(activity.metadata) 
        : activity.metadata || {};
      
      let message = '';
      let icon = '📝';
      
      switch (activity.activity_type) {
        case 'profile_updated':
          message = 'Profile updated';
          icon = '✏️';
          break;
        case 'image_uploaded':
          const imageCount = metadata.imageCount || 1;
          message = `${imageCount} image${imageCount > 1 ? 's' : ''} uploaded`;
          icon = '📷';
          break;
        case 'pdf_downloaded':
          const theme = metadata.theme || 'default';
          message = `PDF downloaded (${theme} theme)`;
          icon = '📄';
          break;
        case 'portfolio_viewed':
          message = 'Portfolio viewed';
          icon = '👁️';
          break;
        default:
          message = 'Activity recorded';
          icon = '📝';
      }
      
      return {
        id: activity.id,
        type: activity.activity_type,
        message,
        icon,
        metadata,
        createdAt: activity.created_at,
        timeAgo: getTimeAgo(activity.created_at)
      };
    });

    return res.json({
      success: true,
      activities: formattedActivities
    });
  } catch (error) {
    console.error('[Dashboard/Activity] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to load activity feed',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Helper function to format time ago
function getTimeAgo(date) {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now - then) / 1000);
  
  if (diffInSeconds < 60) {
    return 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else {
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

// Helper function to log activity
async function logActivity(userId, activityType, metadata = {}) {
  try {
    await knex('activities').insert({
      id: uuidv4(),
      user_id: userId,
      activity_type: activityType,
      metadata: JSON.stringify(metadata),
      created_at: knex.fn.now()
    });
  } catch (error) {
    console.error('[Dashboard] Error logging activity:', error);
    // Don't throw - activity logging is non-critical
  }
}

// Helper function to log analytics event
async function logAnalyticsEvent(profileId, eventType, metadata = {}, req = null) {
  try {
    await knex('analytics').insert({
      id: uuidv4(),
      profile_id: profileId,
      event_type: eventType,
      event_source: 'web',
      metadata: JSON.stringify(metadata),
      ip_address: req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null,
      user_agent: req?.headers?.['user-agent'] || null,
      created_at: knex.fn.now()
    });
  } catch (error) {
    console.error('[Dashboard] Error logging analytics:', error);
    // Don't throw - analytics logging is non-critical
  }
}

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