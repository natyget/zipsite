const express = require('express');
const knex = require('../db/knex');
const { requireRole } = require('../middleware/auth');
const { toFeetInches } = require('../lib/stats');
const { talentProfileUpdateSchema } = require('../lib/validation');
const { normalizeMeasurements, curateBio } = require('../lib/curate');
const { addMessage } = require('../middleware/context');
const { upload, processImage } = require('../lib/uploader');
const { sendRejectedApplicantEmail, sendApplicationStatusChangeEmail, sendAgencyInviteEmail } = require('../lib/email');
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
  // Preprocess req.body to merge "_other" fields into main fields before validation
  // This is needed because the form submits both the select value and the "_other" text input
  // We need to merge them into the main field before Zod validation
  const processedBody = { ...req.body };
  
  // Merge "Other" fields into main fields
  // If the main field value is "Other" and an "_other" field exists with a value, use the "_other" value
  const otherFieldMappings = [
    { main: 'shoe_size', other: 'shoe_size_other' },
    { main: 'eye_color', other: 'eye_color_other' },
    { main: 'hair_color', other: 'hair_color_other' },
    { main: 'skin_tone', other: 'skin_tone_other' },
    { main: 'work_status', other: 'work_status_other' }
  ];
  
  for (const { main, other } of otherFieldMappings) {
    if (processedBody[main] === 'Other' && processedBody[other] && processedBody[other].trim()) {
      processedBody[main] = processedBody[other].trim();
      console.log(`[Dashboard/Talent POST] Merged "${other}" into "${main}":`, processedBody[main]);
    }
    // Remove the "_other" field to avoid strict validation errors
    delete processedBody[other];
  }
  
  // Convert empty strings to undefined for optional fields
  // This is needed because HTML forms send empty strings for empty inputs,
  // but Zod optional() expects undefined, not empty strings
  const optionalFields = [
    'city_secondary', 'phone', 'bust', 'waist', 'hips', 'shoe_size', 'eye_color', 'hair_color',
    'hair_length', 'skin_tone', 'dress_size', 'ethnicity', 'union_membership', 'training',
    'portfolio_url', 'instagram_handle', 'twitter_handle', 'tiktok_handle',
    'reference_name', 'reference_email', 'reference_phone',
    'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
    'work_status', 'bio', 'date_of_birth'
  ];
  
  // Enum fields that need special handling - empty strings should be undefined
  const enumFields = [
    'availability_schedule', 'experience_level', 'gender', 'work_eligibility'
  ];
  
  for (const field of optionalFields) {
    if (processedBody[field] === '') {
      processedBody[field] = undefined;
    }
  }
  
  for (const field of enumFields) {
    if (processedBody[field] === '') {
      processedBody[field] = undefined;
    }
  }
  
  // Remove fields that aren't in the validation schema to avoid .strict() errors
  // These are UI helper fields or calculated fields that shouldn't be validated
  const fieldsToRemove = [
    'age', // Calculated from date_of_birth, not a form field
    'language_other_input' // UI helper field, not stored directly
  ];
  
  for (const field of fieldsToRemove) {
    delete processedBody[field];
  }
  
  console.log('[Dashboard/Talent POST] Processing profile update request:', {
    userId: req.session.userId,
    bodyKeys: Object.keys(req.body),
    processedBodyKeys: Object.keys(processedBody),
    hasCity: !!processedBody.city,
    hasPhone: !!processedBody.phone,
    hasHeight: !!processedBody.height_cm
  });
  
  const parsed = talentProfileUpdateSchema.safeParse(processedBody);
  if (!parsed.success) {
    console.error('[Dashboard/Talent POST] Validation failed:', {
      errors: parsed.error.flatten().fieldErrors,
      body: processedBody
    });
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
          values: processedBody,
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
        values: processedBody
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
      
      // Extract all fields from parsed data (now optional)
      // Note: "_other" fields have already been merged into main fields during preprocessing
      const {
        first_name, last_name, city, city_secondary, height_cm, bio,
        gender, date_of_birth, weight_kg, weight_lbs, dress_size, hair_length, skin_tone,
        languages, availability_travel, availability_schedule, experience_level, training, portfolio_url,
        instagram_handle, twitter_handle, tiktok_handle,
        reference_name, reference_email, reference_phone,
        emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
        work_eligibility, work_status, union_membership, ethnicity, tattoos, piercings, comfort_levels, previous_representations,
        phone, bust, waist, hips, shoe_size, eye_color, hair_color, specialties, experience_details
      } = parsed.data;
      
      // Use provided names or placeholders
      const finalFirstName = first_name || placeholderFirstName;
      const finalLastName = last_name || placeholderLastName;
      
      const profileId = uuidv4();
      const slug = await ensureUniqueSlug(knex, 'profiles', `${finalFirstName}-${finalLastName}`);
      
      console.log('[Dashboard/Talent POST] Creating profile with data:', {
        userId: req.session.userId,
        firstName: finalFirstName,
        lastName: finalLastName,
        city: city || null,
        phone: phone || null,
        height_cm: height_cm || null,
        hasBio: !!bio
      });
      
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
      // Use provided values or defaults
      const curatedBio = bio ? curateBio(bio, finalFirstName, finalLastName) : null;
      
      // Database requires certain fields to be non-null, so use placeholders if not provided
      const finalCity = city || 'Not specified';
      const finalHeightCm = height_cm || 0; // Default to 0 if not provided
      const finalBioRaw = bio || ''; // Empty string if not provided
      const finalBioCurated = curatedBio || ''; // Empty string if not provided
      
      await knex('profiles').insert({
        id: profileId,
        user_id: req.session.userId,
        slug,
        first_name: finalFirstName,
        last_name: finalLastName,
        city: finalCity,
        city_secondary: city_secondary || null,
        phone: phone || null,
        height_cm: finalHeightCm,
        bust: bust || null,
        waist: waist || null,
        hips: hips || null,
        shoe_size: shoe_size || null,
        eye_color: eye_color || null,
        hair_color: hair_color || null,
        bio_raw: finalBioRaw,
        bio_curated: finalBioCurated,
        specialties: specialtiesJson,
        experience_details: typeof experience_details === 'string' ? experience_details : (experience_details ? JSON.stringify(experience_details) : null),
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
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        emergency_contact_relationship: emergency_contact_relationship || null,
        work_eligibility: work_eligibility || null,
        work_status: work_status || null,
        union_membership: union_membership || null,
        ethnicity: ethnicity || null,
        tattoos: tattoos || null,
        piercings: piercings || null,
        comfort_levels: comfort_levels && Array.isArray(comfort_levels) && comfort_levels.length > 0 ? JSON.stringify(comfort_levels) : null,
        previous_representations: typeof previous_representations === 'string' ? previous_representations : (previous_representations ? JSON.stringify(previous_representations) : null),
        is_pro: false,
        pdf_theme: null,
        pdf_customizations: null
      });
      
      console.log('[Dashboard/Talent POST] Created profile successfully:', {
        profileId,
        userId: req.session.userId,
        slug,
        firstName: finalFirstName,
        lastName: finalLastName,
        city: city || null,
        phone: phone || null
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
    // Extract all fields from parsed data (now optional)
    const {
      first_name, last_name, city, city_secondary, height_cm, measurements, bio,
      gender, date_of_birth, weight_kg, weight_lbs, dress_size, hair_length, skin_tone,
      languages, availability_travel, availability_schedule, experience_level, training, portfolio_url,
      instagram_handle, twitter_handle, tiktok_handle,
      reference_name, reference_email, reference_phone, reference_relationship,
      emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
      nationality, union_membership, ethnicity, tattoos, piercings,
      phone, bust, waist, hips, shoe_size, eye_color, hair_color, specialties
    } = parsed.data;
    
    // Update first_name and last_name if provided, otherwise keep existing
    const updatedFirstName = first_name !== undefined ? first_name : profile.first_name;
    const updatedLastName = last_name !== undefined ? last_name : profile.last_name;
    
    const curatedBio = bio ? curateBio(bio, updatedFirstName, updatedLastName) : profile.bio_curated;
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
    
    // Check if user is Studio+ to determine if we should generate social media URLs
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
      // Studio+ users get URLs - generate from handles if URL not provided and handle exists
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
    
    // Handle name updates - if name changes, we may need to update the slug
    let needsSlugUpdate = false;
    if (first_name !== undefined && first_name !== profile.first_name) {
      updateData.first_name = first_name || null;
      needsSlugUpdate = true;
    }
    if (last_name !== undefined && last_name !== profile.last_name) {
      updateData.last_name = last_name || null;
      needsSlugUpdate = true;
    }
    
    // Only update fields that are explicitly in parsed.data (were submitted in form)
    if (city !== undefined) updateData.city = city || null;
    if (city_secondary !== undefined) updateData.city_secondary = city_secondary || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (height_cm !== undefined) updateData.height_cm = height_cm;
    if (bust !== undefined) updateData.bust = bust || null;
    if (waist !== undefined) updateData.waist = waist || null;
    if (hips !== undefined) updateData.hips = hips || null;
    if (shoe_size !== undefined) updateData.shoe_size = shoe_size || null;
    if (eye_color !== undefined) updateData.eye_color = eye_color || null;
    if (hair_color !== undefined) updateData.hair_color = hair_color || null;
    if (bio !== undefined) {
      updateData.bio_raw = bio;
      updateData.bio_curated = curatedBio;
    }
    if (specialties !== undefined) updateData.specialties = specialtiesJson;
    if (experience_details !== undefined) {
      updateData.experience_details = typeof experience_details === 'string' 
        ? experience_details 
        : (experience_details ? JSON.stringify(experience_details) : null);
    }
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
    if (emergency_contact_name !== undefined) updateData.emergency_contact_name = emergency_contact_name || null;
    if (emergency_contact_phone !== undefined) updateData.emergency_contact_phone = emergency_contact_phone || null;
    if (emergency_contact_relationship !== undefined) updateData.emergency_contact_relationship = emergency_contact_relationship || null;
    if (work_eligibility !== undefined) updateData.work_eligibility = work_eligibility || null;
    if (work_status !== undefined) {
      // Note: work_status_other has already been merged into work_status during preprocessing
      updateData.work_status = work_status || null;
    }
    if (union_membership !== undefined) updateData.union_membership = union_membership || null;
    if (ethnicity !== undefined) updateData.ethnicity = ethnicity || null;
    if (tattoos !== undefined) updateData.tattoos = tattoos || null;
    if (piercings !== undefined) updateData.piercings = piercings || null;
    if (comfort_levels !== undefined) {
      updateData.comfort_levels = comfort_levels && Array.isArray(comfort_levels) && comfort_levels.length > 0 
        ? JSON.stringify(comfort_levels) 
        : null;
    }
    if (previous_representations !== undefined) {
      updateData.previous_representations = typeof previous_representations === 'string' 
        ? previous_representations 
        : (previous_representations ? JSON.stringify(previous_representations) : null);
    }

    // Update slug if name changed (only if slug was auto-generated from name)
    if (needsSlugUpdate && (first_name !== undefined || last_name !== undefined)) {
      const finalFirstName = first_name !== undefined ? first_name : profile.first_name;
      const finalLastName = last_name !== undefined ? last_name : profile.last_name;
      
      // Only update slug if the current slug matches the old name pattern
      const oldNameSlug = `${profile.first_name}-${profile.last_name}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      if (profile.slug === oldNameSlug || profile.slug.startsWith(`${oldNameSlug}-`)) {
        const newNameSlug = `${finalFirstName}-${finalLastName}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
        const uniqueSlug = await ensureUniqueSlug(knex, 'profiles', newNameSlug);
        updateData.slug = uniqueSlug;
        console.log('[Dashboard/Talent POST] Updating slug due to name change:', {
          oldSlug: profile.slug,
          newSlug: uniqueSlug,
          oldName: `${profile.first_name} ${profile.last_name}`,
          newName: `${finalFirstName} ${finalLastName}`
        });
      }
    }
    
    await knex('profiles')
      .where({ id: profile.id })
      .update(updateData);
    
    console.log('[Dashboard/Talent POST] Profile updated successfully:', {
      profileId: profile.id,
      userId: req.session.userId,
      updatedFields: Object.keys(updateData),
      slugChanged: !!updateData.slug
    });

    // Log activity (non-blocking)
    logActivity(req.session.userId, 'profile_updated', {
      profileId: profile.id,
      slug: updateData.slug || profile.slug,
      nameChanged: needsSlugUpdate
    }).catch(err => {
      console.error('[Dashboard] Error logging activity:', err);
    });

    addMessage(req, 'success', 'Profile updated successfully.');
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

    // Ensure userId exists in session
    if (!req.session || !req.session.userId) {
      console.error('[Dashboard/Media Upload] No userId in session');
      return res.status(401).json({ 
        error: 'Session expired. Please log in again.',
        success: false 
      });
    }

    let profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    
    // If profile doesn't exist, create a minimal one
    if (!profile) {
      console.log('[Dashboard/Media Upload] Profile not found, creating minimal profile for user:', req.session.userId);
      
      try {
        const currentUser = await knex('users').where({ id: req.session.userId }).first();
        if (!currentUser) {
          console.error('[Dashboard/Media Upload] User not found:', req.session.userId);
          return res.status(404).json({ 
            error: 'User not found.',
            success: false 
          });
        }
        
        // Extract a name from email as placeholder
        const emailParts = currentUser.email.split('@')[0];
        const placeholderFirstName = emailParts.charAt(0).toUpperCase() + emailParts.slice(1).split('.')[0];
        const placeholderLastName = 'User';
        
        const profileId = uuidv4();
        const slug = await ensureUniqueSlug(knex, 'profiles', `${placeholderFirstName}-${placeholderLastName}`);
        
        // Database requires certain fields to be non-null, so use placeholders if not provided
        const placeholderCity = 'Not specified';
        const placeholderHeightCm = 0;
        const placeholderBioRaw = '';
        const placeholderBioCurated = '';
        
        await knex('profiles').insert({
          id: profileId,
          user_id: req.session.userId,
          slug,
          first_name: placeholderFirstName,
          last_name: placeholderLastName,
          city: placeholderCity,
          height_cm: placeholderHeightCm,
          bio_raw: placeholderBioRaw,
          bio_curated: placeholderBioCurated,
          is_pro: false,
          pdf_theme: null,
          pdf_customizations: null
        });
        
        console.log('[Dashboard/Media Upload] Created minimal profile:', {
          profileId,
          userId: req.session.userId,
          slug
        });
        
        // Reload profile
        profile = await knex('profiles').where({ id: profileId }).first();
        
        if (!profile) {
          console.error('[Dashboard/Media Upload] Failed to reload created profile');
          return res.status(500).json({ 
            error: 'Failed to create profile. Please try again.',
            success: false 
          });
        }
        
        // Log activity (non-blocking)
        logActivity(req.session.userId, 'profile_created', {
          profileId: profileId,
          slug: slug,
          action: 'created_via_upload'
        }).catch(err => {
          console.error('[Dashboard] Error logging activity:', err);
        });
      } catch (createError) {
        console.error('[Dashboard/Media Upload] Error creating profile:', {
          message: createError.message,
          stack: createError.stack,
          userId: req.session.userId
        });
        return res.status(500).json({ 
          error: 'Failed to create profile. Please try again.',
          success: false,
          details: process.env.NODE_ENV !== 'production' ? createError.message : undefined
        });
      }
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
        console.error('[Dashboard/Media Upload] Error processing file:', {
          message: fileError.message,
          stack: fileError.stack,
          fileName: file.originalname,
          fileSize: file.size,
          fileMimetype: file.mimetype,
          profileId: profile.id
        });
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
    console.error('[Dashboard/Media Upload] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
      userId: req.session?.userId,
      hasFiles: !!req.files,
      fileCount: req.files?.length || 0
    });
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
      // Return empty analytics when no profile exists (instead of 404)
      return res.json({
        success: true,
        analytics: {
          views: {
            total: 0,
            thisWeek: 0,
            thisMonth: 0
          },
          downloads: {
            total: 0,
            thisWeek: 0,
            thisMonth: 0,
            byTheme: []
          }
        }
      });
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
      view = 'applicants', // 'applicants' or 'scout'
      sort = 'az',
      city = '',
      letter = '',
      search = '',
      min_height = '',
      max_height = '',
      status = '',
      board_id = '' // Filter by board
    } = req.query;

    const agencyId = req.session.userId;

    // Fetch boards for this agency
    const boards = await knex('boards')
      .where({ agency_id: agencyId })
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');

    // Get application counts per board
    const boardsWithCounts = await Promise.all(boards.map(async (board) => {
      const applicationCount = await knex('board_applications')
        .where({ board_id: board.id })
        .count('* as count')
        .first();
      return {
        ...board,
        application_count: parseInt(applicationCount?.count || 0)
      };
    }));

    // Calculate dashboard statistics (for both views)
    const allApplications = await knex('applications')
      .where({ agency_id: agencyId })
      .select('status', 'created_at');
    
    const stats = {
      total: allApplications.length,
      pending: allApplications.filter(a => !a.status || a.status === 'pending').length,
      accepted: allApplications.filter(a => a.status === 'accepted').length,
      declined: allApplications.filter(a => a.status === 'declined').length,
      archived: allApplications.filter(a => a.status === 'archived').length,
      newToday: allApplications.filter(a => {
        const created = new Date(a.created_at);
        const today = new Date();
        return created.toDateString() === today.toDateString();
      }).length,
      newThisWeek: allApplications.filter(a => {
        const created = new Date(a.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
      }).length
    };

    let query;
    let profiles = [];

    if (view === 'scout') {
      // Scout Talent: Only discoverable profiles that don't have an application to this agency
      const existingApplicationProfileIds = await knex('applications')
        .where({ agency_id: agencyId })
        .pluck('profile_id');

      query = knex('profiles')
        .select('profiles.*', 'users.email as owner_email')
        .leftJoin('users', 'profiles.user_id', 'users.id')
        .where({ 'profiles.is_discoverable': true })
        .whereNotNull('profiles.bio_curated');

      // Exclude profiles that already have applications
      if (existingApplicationProfileIds.length > 0) {
        query = query.whereNotIn('profiles.id', existingApplicationProfileIds);
      }
    } else {
      // My Applicants: Only profiles with applications to this agency
      query = knex('profiles')
        .select(
          'profiles.*',
          'users.email as owner_email',
          'applications.status as application_status',
          'applications.id as application_id',
          'applications.created_at as application_created_at',
          'applications.accepted_at',
          'applications.declined_at',
          'applications.invited_by_agency_id',
          'board_applications.match_score as board_match_score',
          'board_applications.match_details as board_match_details'
        )
        .leftJoin('users', 'profiles.user_id', 'users.id')
        .innerJoin('applications', (join) => {
          join.on('applications.profile_id', '=', 'profiles.id')
            .andOn('applications.agency_id', '=', knex.raw('?', [agencyId]));
        })
        .leftJoin('board_applications', (join) => {
          join.on('board_applications.application_id', '=', 'applications.id');
          if (board_id) {
            join.on('board_applications.board_id', '=', knex.raw('?', [board_id]));
          }
        })
        .whereNotNull('profiles.bio_curated');

      // Filter by board if specified
      if (board_id) {
        query = query.where('board_applications.board_id', board_id);
      }

      // Filter by application status (only for My Applicants view)
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
    }

    // Apply common filters (for both views)
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

    const minHeightNumber = parseInt(min_height, 10);
    const maxHeightNumber = parseInt(max_height, 10);
    if (!Number.isNaN(minHeightNumber)) {
      query = query.where('profiles.height_cm', '>=', minHeightNumber);
    }
    if (!Number.isNaN(maxHeightNumber)) {
      query = query.where('profiles.height_cm', '<=', maxHeightNumber);
    }

    // Sort by match score if board is selected, otherwise use default sort
    if (board_id && sort !== 'az' && sort !== 'city') {
      // When board is selected, default to match score sorting
      query = query.orderBy('board_applications.match_score', 'desc');
      query = query.orderBy('profiles.last_name', 'asc');
    } else if (sort === 'city') {
      query = query.orderBy(['profiles.city', 'profiles.last_name']);
    } else if (sort === 'newest') {
      query = query.orderBy('profiles.created_at', 'desc');
    } else if (sort === 'match_score' && board_id) {
      query = query.orderBy('board_applications.match_score', 'desc');
      query = query.orderBy('profiles.last_name', 'asc');
    } else {
      query = query.orderBy(['profiles.last_name', 'profiles.first_name']);
    }

    profiles = await query;

    // Fetch images for each profile
    const profileIds = profiles.map(p => p.id);
    const allImages = profileIds.length > 0 
      ? await knex('images')
          .whereIn('profile_id', profileIds)
          .orderBy(['profile_id', 'sort', 'created_at'])
      : [];
    
    // Group images by profile_id
    const imagesByProfile = {};
    allImages.forEach(img => {
      if (!imagesByProfile[img.profile_id]) {
        imagesByProfile[img.profile_id] = [];
      }
      imagesByProfile[img.profile_id].push(img);
    });

    // Attach images to profiles
    profiles.forEach(profile => {
      profile.images = imagesByProfile[profile.id] || [];
    });

    // Fetch notes and tags counts for applications (My Applicants view only)
    if (view !== 'scout' && profiles.length > 0) {
      const applicationIds = profiles
        .map(p => p.application_id)
        .filter(id => id);

      if (applicationIds.length > 0) {
        // Get notes counts
        const notesCounts = await knex('application_notes')
          .select('application_id')
          .count('id as count')
          .whereIn('application_id', applicationIds)
          .groupBy('application_id');

        const notesCountsMap = {};
        notesCounts.forEach(item => {
          notesCountsMap[item.application_id] = parseInt(item.count, 10);
        });

        // Get tags for each application
        const allTags = await knex('application_tags')
          .whereIn('application_id', applicationIds)
          .where({ agency_id: agencyId })
          .orderBy('created_at', 'desc');

        const tagsByApplication = {};
        allTags.forEach(tag => {
          if (!tagsByApplication[tag.application_id]) {
            tagsByApplication[tag.application_id] = [];
          }
          tagsByApplication[tag.application_id].push(tag);
        });

        // Attach notes counts and tags to profiles
        profiles.forEach(profile => {
          if (profile.application_id) {
            profile.application_notes_count = notesCountsMap[profile.application_id] || 0;
            profile.application_tags = tagsByApplication[profile.application_id] || [];
          }
        });
      }
    }

    // Get current user data with agency branding
    const currentUser = await knex('users')
      .where({ id: agencyId })
      .first();

    return res.render('dashboard/agency', {
      title: 'Agency Dashboard',
      profiles,
      boards: boardsWithCounts,
      view, // 'applicants' or 'scout'
      filters: { sort, city, letter, search, min_height, max_height, status, board_id },
      stats,
      user: currentUser,
      currentUser,
      isDashboard: true,
      layout: 'layouts/dashboard'
    });
  } catch (error) {
    return next(error);
  }
});

// POST /dashboard/agency/applications/:applicationId/accept
// POST /dashboard/agency/applications/:applicationId/decline
// POST /dashboard/agency/applications/:applicationId/archive
router.post('/dashboard/agency/applications/:applicationId/:action', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId, action } = req.params; // accept, archive, decline

    if (!['accept', 'archive', 'decline'].includes(action)) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ error: 'Invalid action' });
      }
      addMessage(req, 'error', 'Invalid action');
      return res.redirect('/dashboard/agency');
    }

    // Check if application exists and belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: req.session.userId })
      .first();

    if (!application) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ error: 'Application not found' });
      }
      addMessage(req, 'error', 'Application not found');
      return res.redirect('/dashboard/agency');
    }

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

    // Update application
    await knex('applications')
      .where({ id: applicationId })
      .update(updateData);

    // Send email notifications
    try {
      // Get profile and user info for email
      const profile = await knex('profiles')
        .where({ id: application.profile_id })
        .first();
      
      if (profile) {
        const talentUser = await knex('users')
          .where({ id: profile.user_id })
          .first();
        
        const agency = await knex('users')
          .where({ id: req.session.userId })
          .first();

        if (talentUser && agency) {
          if (action === 'decline') {
            // Send decline email with Pro upsell
            await sendRejectedApplicantEmail({
              talentEmail: talentUser.email,
              talentName: `${profile.first_name} ${profile.last_name}`,
              agencyName: agency.agency_name || agency.email,
              agencyEmail: agency.email
            });
          } else if (action === 'accept') {
            // Send acceptance notification
            await sendApplicationStatusChangeEmail({
              talentEmail: talentUser.email,
              talentName: `${profile.first_name} ${profile.last_name}`,
              agencyName: agency.agency_name || agency.email,
              status: 'accepted'
            });
          }
        }
      }
    } catch (emailError) {
      // Log error but don't fail the request
      console.error('[Application] Email send error:', emailError);
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

// POST /dashboard/agency/scout/:profileId/invite - Invite talent from Scout Talent
router.post('/dashboard/agency/scout/:profileId/invite', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { profileId } = req.params;
    const agencyId = req.session.userId;

    // Check if profile exists and is discoverable
    const profile = await knex('profiles')
      .where({ id: profileId, is_discoverable: true })
      .first();

    if (!profile) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(404).json({ error: 'Profile not found or not discoverable' });
      }
      addMessage(req, 'error', 'Profile not found or not discoverable');
      return res.redirect('/dashboard/agency?view=scout');
    }

    // Check if application already exists
    const existingApplication = await knex('applications')
      .where({ profile_id: profileId, agency_id: agencyId })
      .first();

    if (existingApplication) {
      if (req.headers.accept?.includes('application/json')) {
        return res.status(409).json({ error: 'Application already exists' });
      }
      addMessage(req, 'error', 'You have already invited this talent');
      return res.redirect('/dashboard/agency?view=scout');
    }

    // Create application with invited_by_agency_id set
    const applicationId = uuidv4();
    await knex('applications').insert({
      id: applicationId,
      profile_id: profileId,
      agency_id: agencyId,
      status: 'pending',
      invited_by_agency_id: agencyId, // Mark as scout invite
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });

    // Send invite notification email
    try {
      const talentUser = await knex('users')
        .where({ id: profile.user_id })
        .first();
      
      const agency = await knex('users')
        .where({ id: agencyId })
        .first();

      if (talentUser && agency) {
        await sendAgencyInviteEmail({
          talentEmail: talentUser.email,
          talentName: `${profile.first_name} ${profile.last_name}`,
          agencyName: agency.agency_name || agency.email
        });
      }
    } catch (emailError) {
      console.error('[Scout Invite] Email send error:', emailError);
      // Don't fail the request if email fails
    }

    if (req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, applicationId });
    }

    addMessage(req, 'success', 'Invitation sent successfully');
    return res.redirect('/dashboard/agency?view=applicants');
  } catch (error) {
    console.error('[Scout Invite] Error:', error);
    return next(error);
  }
});

// GET /api/talent/applications - Get talent's applications
router.get('/api/talent/applications', requireRole('TALENT'), async (req, res, next) => {
  try {
    const profile = await knex('profiles')
      .where({ user_id: req.session.userId })
      .first();

    if (!profile) {
      return res.json([]);
    }

    const applications = await knex('applications')
      .select(
        'applications.*',
        'users.agency_name',
        'users.email as agency_email'
      )
      .leftJoin('users', 'applications.agency_id', 'users.id')
      .where({ profile_id: profile.id })
      .orderBy('applications.created_at', 'desc');

    return res.json(applications.map(app => ({
      id: app.id,
      agencyName: app.agency_name || app.agency_email,
      agencyEmail: app.agency_email,
      status: app.status || 'pending',
      createdAt: app.created_at,
      acceptedAt: app.accepted_at,
      declinedAt: app.declined_at,
      invitedByAgency: !!app.invited_by_agency_id
    })));
  } catch (error) {
    console.error('[Talent Applications API] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// POST /api/talent/discoverability - Toggle discoverability (Pro only)
router.post('/api/talent/discoverability', requireRole('TALENT'), async (req, res, next) => {
  try {
    const { isDiscoverable } = req.body;
    const profile = await knex('profiles')
      .where({ user_id: req.session.userId })
      .first();

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check if user has Pro subscription
    if (!profile.is_pro) {
      return res.status(403).json({ error: 'Studio+ subscription required to enable discoverability' });
    }

    // Update discoverability
    await knex('profiles')
      .where({ id: profile.id })
      .update({ is_discoverable: !!isDiscoverable });

    return res.json({ success: true, isDiscoverable: !!isDiscoverable });
  } catch (error) {
    console.error('[Discoverability API] Error:', error);
    return res.status(500).json({ error: 'Failed to update discoverability' });
  }
});

// ============================================
// Application Notes & Tags API Endpoints
// ============================================

// GET /api/agency/applications/:applicationId/notes - Get all notes for an application
router.get('/api/agency/applications/:applicationId/notes', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const notes = await knex('application_notes')
      .where({ application_id: applicationId })
      .orderBy('created_at', 'desc');

    return res.json(notes);
  } catch (error) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// POST /api/agency/applications/:applicationId/notes - Create a new note
router.post('/api/agency/applications/:applicationId/notes', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { note } = req.body;
    const agencyId = req.session.userId;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const noteId = uuidv4();
    const [newNote] = await knex('application_notes')
      .insert({
        id: noteId,
        application_id: applicationId,
        note: note.trim(),
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      })
      .returning('*');

    return res.json(newNote);
  } catch (error) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: 'Failed to create note' });
  }
});

// PUT /api/agency/applications/:applicationId/notes/:noteId - Update a note
router.put('/api/agency/applications/:applicationId/notes/:noteId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId, noteId } = req.params;
    const { note } = req.body;
    const agencyId = req.session.userId;

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify note exists and belongs to this application
    const existingNote = await knex('application_notes')
      .where({ id: noteId, application_id: applicationId })
      .first();

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const [updatedNote] = await knex('application_notes')
      .where({ id: noteId })
      .update({
        note: note.trim(),
        updated_at: knex.fn.now()
      })
      .returning('*');

    return res.json(updatedNote);
  } catch (error) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/agency/applications/:applicationId/notes/:noteId - Delete a note
router.delete('/api/agency/applications/:applicationId/notes/:noteId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId, noteId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify note exists and belongs to this application
    const existingNote = await knex('application_notes')
      .where({ id: noteId, application_id: applicationId })
      .first();

    if (!existingNote) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await knex('application_notes')
      .where({ id: noteId })
      .delete();

    return res.json({ success: true });
  } catch (error) {
    console.error('[Notes API] Error:', error);
    return res.status(500).json({ error: 'Failed to delete note' });
  }
});

// GET /api/agency/applications/:applicationId/tags - Get all tags for an application
router.get('/api/agency/applications/:applicationId/tags', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const tags = await knex('application_tags')
      .where({ application_id: applicationId, agency_id: agencyId })
      .orderBy('created_at', 'desc');

    return res.json(tags);
  } catch (error) {
    console.error('[Tags API] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/agency/applications/:applicationId/tags - Add a tag
router.post('/api/agency/applications/:applicationId/tags', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { tag, color } = req.body;
    const agencyId = req.session.userId;

    if (!tag || !tag.trim()) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if tag already exists (unique constraint)
    const existingTag = await knex('application_tags')
      .where({ application_id: applicationId, agency_id: agencyId, tag: tag.trim() })
      .first();

    if (existingTag) {
      return res.status(409).json({ error: 'Tag already exists' });
    }

    const tagId = uuidv4();
    const [newTag] = await knex('application_tags')
      .insert({
        id: tagId,
        application_id: applicationId,
        agency_id: agencyId,
        tag: tag.trim(),
        color: color || null,
        created_at: knex.fn.now()
      })
      .returning('*');

    return res.json(newTag);
  } catch (error) {
    console.error('[Tags API] Error:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Tag already exists' });
    }
    return res.status(500).json({ error: 'Failed to create tag' });
  }
});

// DELETE /api/agency/applications/:applicationId/tags/:tagId - Remove a tag
router.delete('/api/agency/applications/:applicationId/tags/:tagId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId, tagId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify tag exists and belongs to this application and agency
    const existingTag = await knex('application_tags')
      .where({ id: tagId, application_id: applicationId, agency_id: agencyId })
      .first();

    if (!existingTag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    await knex('application_tags')
      .where({ id: tagId })
      .delete();

    return res.json({ success: true });
  } catch (error) {
    console.error('[Tags API] Error:', error);
    return res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// GET /api/agency/applications/:applicationId/details - Get full application details
router.get('/api/agency/applications/:applicationId/details', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const agencyId = req.session.userId;

    // Verify application belongs to this agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get full profile with all details
    const profile = await knex('profiles')
      .where({ id: application.profile_id })
      .first();

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get all images
    const images = await knex('images')
      .where({ profile_id: profile.id })
      .orderBy(['sort', 'created_at']);

    // Get user info
    const user = await knex('users')
      .where({ id: profile.user_id })
      .first();

    // Get notes
    const notes = await knex('application_notes')
      .where({ application_id: applicationId })
      .orderBy('created_at', 'desc');

    // Get tags
    const tags = await knex('application_tags')
      .where({ application_id: applicationId, agency_id: agencyId })
      .orderBy('created_at', 'desc');

    // Update viewed_at timestamp
    await knex('applications')
      .where({ id: applicationId })
      .update({ viewed_at: knex.fn.now() });

    return res.json({
      application: {
        id: application.id,
        status: application.status,
        created_at: application.created_at,
        accepted_at: application.accepted_at,
        declined_at: application.declined_at,
        viewed_at: application.viewed_at,
        invited_by_agency_id: application.invited_by_agency_id
      },
      profile: {
        ...profile,
        images,
        user_email: user?.email || null
      },
      notes,
      tags
    });
  } catch (error) {
    console.error('[Application Details API] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch application details' });
  }
});

// PUT /api/agency/profile - Update agency profile
router.put('/api/agency/profile', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { agency_name, agency_location, agency_website, agency_description } = req.body;

    const updateData = {};
    if (agency_name !== undefined) updateData.agency_name = agency_name || null;
    if (agency_location !== undefined) updateData.agency_location = agency_location || null;
    if (agency_website !== undefined) updateData.agency_website = agency_website || null;
    if (agency_description !== undefined) updateData.agency_description = agency_description || null;

    await knex('users')
      .where({ id: agencyId })
      .update(updateData);

    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('[Agency Profile API] Error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/agency/branding - Update agency branding (logo and color)
router.post('/api/agency/branding', requireRole('AGENCY'), upload.single('agency_logo'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { agency_brand_color, remove_logo } = req.body;

    const updateData = {};
    
    if (remove_logo === 'true') {
      // Remove existing logo
      const user = await knex('users').where({ id: agencyId }).first();
      if (user && user.agency_logo_path) {
        // Delete file from storage if needed
        updateData.agency_logo_path = null;
      }
    } else if (req.file) {
      // Process and save new logo
      const processedImage = await processImage(req.file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 90
      });
      updateData.agency_logo_path = processedImage.path;
    }

    if (agency_brand_color !== undefined) {
      updateData.agency_brand_color = agency_brand_color || null;
    }

    if (Object.keys(updateData).length > 0) {
      await knex('users')
        .where({ id: agencyId })
        .update(updateData);
    }

    return res.json({ 
      success: true, 
      message: 'Branding updated successfully',
      logo_path: updateData.agency_logo_path || null
    });
  } catch (error) {
    console.error('[Agency Branding API] Error:', error);
    return res.status(500).json({ error: 'Failed to update branding' });
  }
});

// PUT /api/agency/settings - Update agency settings
router.put('/api/agency/settings', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { notify_new_applications, notify_status_changes, default_view } = req.body;

    const updateData = {};
    if (notify_new_applications !== undefined) updateData.notify_new_applications = !!notify_new_applications;
    if (notify_status_changes !== undefined) updateData.notify_status_changes = !!notify_status_changes;
    if (default_view !== undefined) updateData.default_view = default_view || null;

    await knex('users')
      .where({ id: agencyId })
      .update(updateData);

    return res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('[Agency Settings API] Error:', error);
    return res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/agency/export - Export applications as CSV or JSON
router.get('/api/agency/export', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { format = 'csv', status = '', city = '', search = '' } = req.query;

    // Build query similar to main dashboard route
    let query = knex('profiles')
      .select(
        'profiles.first_name',
        'profiles.last_name',
        'profiles.email',
        'profiles.city',
        'profiles.country',
        'profiles.height_cm',
        'profiles.measurements',
        'profiles.age',
        'profiles.bio_curated',
        'applications.id as application_id',
        'applications.status as application_status',
        'applications.created_at as application_created_at',
        'applications.accepted_at',
        'applications.declined_at',
        'users.email as owner_email'
      )
      .leftJoin('users', 'profiles.user_id', 'users.id')
      .innerJoin('applications', (join) => {
        join.on('applications.profile_id', '=', 'profiles.id')
          .andOn('applications.agency_id', '=', knex.raw('?', [agencyId]));
      })
      .whereNotNull('profiles.bio_curated');

    // Apply filters
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

    if (city) {
      query = query.whereILike('profiles.city', `%${city}%`);
    }

    if (search) {
      query = query.andWhere((qb) => {
        qb.whereILike('profiles.first_name', `%${search}%`)
          .orWhereILike('profiles.last_name', `%${search}%`);
      });
    }

    const applications = await query.orderBy(['profiles.last_name', 'profiles.first_name']);

    // Get notes and tags for each application
    const applicationIds = applications.map(app => app.application_id).filter(Boolean);
    
    let notesMap = {};
    let tagsMap = {};

    if (applicationIds.length > 0) {
      // Fetch aggregated notes
      const notes = await knex('application_notes')
        .select('application_id')
        .select(knex.raw('string_agg(note, \' | \' ORDER BY created_at) as notes'))
        .whereIn('application_id', applicationIds)
        .groupBy('application_id');

      notes.forEach(note => {
        notesMap[note.application_id] = note.notes || '';
      });

      // Fetch tags
      const tags = await knex('application_tags')
        .select('application_id')
        .select(knex.raw('string_agg(tag, \', \' ORDER BY created_at) as tags'))
        .whereIn('application_id', applicationIds)
        .groupBy('application_id');

      tags.forEach(tag => {
        tagsMap[tag.application_id] = tag.tags || '';
      });
    }

    // Format data for export
    const exportData = applications.map(app => ({
      name: `${app.first_name} ${app.last_name}`,
      email: app.owner_email || app.email || '',
      city: app.city || '',
      country: app.country || '',
      height_cm: app.height_cm || '',
      measurements: app.measurements || '',
      age: app.age || '',
      bio: app.bio_curated || '',
      notes: notesMap[app.application_id] || '',
      tags: tagsMap[app.application_id] || '',
      application_status: app.application_status || 'pending',
      applied_date: app.application_created_at ? new Date(app.application_created_at).toISOString() : '',
      accepted_date: app.accepted_at ? new Date(app.accepted_at).toISOString() : '',
      declined_date: app.declined_at ? new Date(app.declined_at).toISOString() : ''
    }));

    if (format === 'json') {
      return res.json({
        exported_at: new Date().toISOString(),
        total: exportData.length,
        applications: exportData
      });
    } else {
      // CSV format
      const csvHeaders = [
        'Name',
        'Email',
        'City',
        'Country',
        'Height (cm)',
        'Measurements',
        'Age',
        'Bio',
        'Notes',
        'Tags',
        'Application Status',
        'Applied Date',
        'Accepted Date',
        'Declined Date'
      ];

      const csvRows = exportData.map(app => {
        const escapeCSV = (str) => {
          if (!str) return '';
          const string = String(str);
          if (string.includes(',') || string.includes('"') || string.includes('\n')) {
            return `"${string.replace(/"/g, '""')}"`;
          }
          return string;
        };

        return [
          escapeCSV(app.name),
          escapeCSV(app.email),
          escapeCSV(app.city),
          escapeCSV(app.country),
          escapeCSV(app.height_cm),
          escapeCSV(app.measurements),
          escapeCSV(app.age),
          escapeCSV(app.bio),
          escapeCSV(app.notes),
          escapeCSV(app.tags),
          escapeCSV(app.application_status),
          escapeCSV(app.applied_date ? new Date(app.applied_date).toLocaleDateString() : ''),
          escapeCSV(app.accepted_date ? new Date(app.accepted_date).toLocaleDateString() : ''),
          escapeCSV(app.declined_date ? new Date(app.declined_date).toLocaleDateString() : '')
        ].join(',');
      });

      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      const filename = `pholio-applications-${new Date().toISOString().split('T')[0]}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(csvContent);
    }
  } catch (error) {
    console.error('[Export API] Error:', error);
    return res.status(500).json({ error: 'Failed to export applications' });
  }
});

// GET /api/agency/applications - Get filtered applications as JSON
router.get('/api/agency/applications', requireRole('AGENCY'), async (req, res, next) => {
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
        'applications.id as application_id',
        'applications.created_at as application_created_at'
      )
      .leftJoin('users', 'profiles.user_id', 'users.id')
      .leftJoin('applications', (join) => {
        join.on('applications.profile_id', '=', 'profiles.id')
          .andOn('applications.agency_id', '=', knex.raw('?', [req.session.userId]));
      })
      .whereNotNull('profiles.bio_curated');

    // Apply filters (same logic as main route)
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

    // Fetch images
    const profileIds = profiles.map(p => p.id);
    const allImages = profileIds.length > 0 
      ? await knex('images')
          .whereIn('profile_id', profileIds)
          .orderBy(['profile_id', 'sort', 'created_at'])
      : [];
    
    const imagesByProfile = {};
    allImages.forEach(img => {
      if (!imagesByProfile[img.profile_id]) {
        imagesByProfile[img.profile_id] = [];
      }
      imagesByProfile[img.profile_id].push(img);
    });

    profiles.forEach(profile => {
      profile.images = imagesByProfile[profile.id] || [];
    });

    return res.json({ profiles, count: profiles.length });
  } catch (error) {
    console.error('[API/Agency/Applications] Error:', error);
    return next(error);
  }
});

// GET /api/agency/stats - Get dashboard statistics
router.get('/api/agency/stats', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const allApplications = await knex('applications')
      .where({ agency_id: req.session.userId })
      .select('status', 'created_at');
    
    const stats = {
      total: allApplications.length,
      pending: allApplications.filter(a => !a.status || a.status === 'pending').length,
      accepted: allApplications.filter(a => a.status === 'accepted').length,
      declined: allApplications.filter(a => a.status === 'declined').length,
      archived: allApplications.filter(a => a.status === 'archived').length,
      newToday: allApplications.filter(a => {
        const created = new Date(a.created_at);
        const today = new Date();
        return created.toDateString() === today.toDateString();
      }).length,
      newThisWeek: allApplications.filter(a => {
        const created = new Date(a.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
      }).length
    };

    const commissions = await knex('commissions')
      .where({ agency_id: req.session.userId })
      .sum({ total: 'amount_cents' })
      .first();

    return res.json({
      stats,
      commissionsTotal: ((commissions?.total || 0) / 100).toFixed(2)
    });
  } catch (error) {
    console.error('[API/Agency/Stats] Error:', error);
    return next(error);
  }
});

// GET /dashboard/pdf-customizer - PDF Customizer Page (Studio+ users only)
router.get('/dashboard/pdf-customizer', requireRole('TALENT'), async (req, res, next) => {
  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      addMessage(req, 'error', 'Profile not found.');
      return res.redirect('/apply');
    }
    
    if (!profile.is_pro) {
      addMessage(req, 'error', 'Studio+ account required to customize PDF comp cards.');
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

// ==================== SETTINGS ROUTES ====================

// GET /dashboard/settings - Main settings page (defaults to account section)
router.get('/dashboard/settings', requireRole('TALENT'), async (req, res, next) => {
  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    const currentUser = await knex('users')
      .where({ id: req.session.userId })
      .first();
    
    // Allow settings access even without profile - user can set account preferences
    return res.render('dashboard/settings/index', {
      title: 'Settings',
      profile: profile || null,
      user: currentUser,
      currentUser,
      currentPage: 'settings',
      layout: 'layouts/dashboard',
      section: 'account' // Default section
    });
  } catch (error) {
    return next(error);
  }
});

// GET /dashboard/settings/:section - Section-specific settings page
router.get('/dashboard/settings/:section', requireRole('TALENT'), async (req, res, next) => {
  try {
    const { section } = req.params;
    const validSections = ['account', 'profile', 'notifications', 'privacy', 'billing'];
    
    if (!validSections.includes(section)) {
      addMessage(req, 'error', 'Invalid settings section.');
      return res.redirect('/dashboard/settings');
    }
    
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    const currentUser = await knex('users')
      .where({ id: req.session.userId })
      .first();
    
    // Allow settings access even without profile - user can set account preferences
    return res.render('dashboard/settings/index', {
      title: `${section.charAt(0).toUpperCase() + section.slice(1)} Settings`,
      profile: profile || null,
      user: currentUser,
      currentUser,
      currentPage: 'settings',
      layout: 'layouts/dashboard',
      section
    });
  } catch (error) {
    return next(error);
  }
});

// POST /dashboard/settings/slug - Update portfolio slug
router.post('/dashboard/settings/slug', requireRole('TALENT'), async (req, res, next) => {
  try {
    const { slug } = req.body;
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    
    if (!profile) {
      addMessage(req, 'error', 'Profile not found.');
      return res.redirect('/dashboard/settings');
    }
    
    if (!slug || slug.trim().length === 0) {
      addMessage(req, 'error', 'Portfolio slug is required.');
      return res.redirect('/dashboard/settings/profile');
    }
    
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    if (cleanSlug !== profile.slug) {
      const uniqueSlug = await ensureUniqueSlug(knex, 'profiles', cleanSlug);
      await knex('profiles')
        .where({ id: profile.id })
        .update({ slug: uniqueSlug, updated_at: knex.fn.now() });
      
      addMessage(req, 'success', 'Portfolio slug updated successfully.');
    }
    
    return res.redirect('/dashboard/settings/profile');
  } catch (error) {
    console.error('[Settings] Error updating slug:', error);
    addMessage(req, 'error', 'Failed to update portfolio slug.');
    return res.redirect('/dashboard/settings/profile');
  }
});

// POST /dashboard/settings/visibility - Update portfolio visibility
router.post('/dashboard/settings/visibility', requireRole('TALENT'), async (req, res, next) => {
  try {
    const { visibility } = req.body;
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    
    if (!profile) {
      addMessage(req, 'error', 'Profile not found.');
      return res.redirect('/dashboard/settings');
    }
    
    const isPublic = visibility === 'public';
    
    // Check if is_public column exists before updating
    try {
      await knex('profiles')
        .where({ id: profile.id })
        .update({ is_public: isPublic, updated_at: knex.fn.now() });
      
      addMessage(req, 'success', `Portfolio is now ${isPublic ? 'public' : 'private'}.`);
    } catch (updateError) {
      // If column doesn't exist, log warning but don't fail
      if (updateError.code === '42703' || updateError.message?.includes('column "is_public" does not exist')) {
        console.log('[Settings] is_public column does not exist, skipping visibility update');
        addMessage(req, 'info', 'Portfolio visibility feature is not yet available. Your portfolio is currently public.');
      } else {
        throw updateError;
      }
    }
    
    return res.redirect('/dashboard/settings/profile');
  } catch (error) {
    console.error('[Settings] Error updating visibility:', error);
    addMessage(req, 'error', 'Failed to update portfolio visibility.');
    return res.redirect('/dashboard/settings/profile');
  }
});

// ============================================
// Boards / Divisions API Endpoints
// ============================================

const { calculateMatchScore } = require('../lib/match-scoring');

// GET /api/agency/boards - List all boards for agency
router.get('/api/agency/boards', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    
    const boards = await knex('boards')
      .where({ agency_id: agencyId })
      .orderBy('sort_order', 'asc')
      .orderBy('created_at', 'asc');
    
    // Get application counts for each board
    const boardsWithCounts = await Promise.all(boards.map(async (board) => {
      const count = await knex('board_applications')
        .where({ board_id: board.id })
        .count('* as count')
        .first();
      return {
        ...board,
        application_count: parseInt(count?.count || 0)
      };
    }));
    
    return res.json(boardsWithCounts);
  } catch (error) {
    console.error('[Boards API] Error fetching boards:', error);
    return res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// GET /api/agency/boards/:boardId - Get board details with requirements and weights
router.get('/api/agency/boards/:boardId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Get requirements
    const requirements = await knex('board_requirements')
      .where({ board_id: boardId })
      .first();
    
    // Get scoring weights
    const scoring_weights = await knex('board_scoring_weights')
      .where({ board_id: boardId })
      .first();
    
    // Parse JSON fields
    const parsedRequirements = requirements ? {
      ...requirements,
      genders: requirements.genders ? JSON.parse(requirements.genders) : null,
      body_types: requirements.body_types ? JSON.parse(requirements.body_types) : null,
      comfort_levels: requirements.comfort_levels ? JSON.parse(requirements.comfort_levels) : null,
      experience_levels: requirements.experience_levels ? JSON.parse(requirements.experience_levels) : null,
      skills: requirements.skills ? JSON.parse(requirements.skills) : null,
      locations: requirements.locations ? JSON.parse(requirements.locations) : null
    } : null;
    
    return res.json({
      ...board,
      requirements: parsedRequirements,
      scoring_weights
    });
  } catch (error) {
    console.error('[Boards API] Error fetching board:', error);
    return res.status(500).json({ error: 'Failed to fetch board' });
  }
});

// POST /api/agency/boards - Create new board
router.post('/api/agency/boards', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const agencyId = req.session.userId;
    const { name, description, is_active = true, sort_order = 0, requirements, scoring_weights } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Board name is required' });
    }
    
    // Create board
    const [board] = await knex('boards')
      .insert({
        id: require('crypto').randomUUID(),
        agency_id: agencyId,
        name: name.trim(),
        description: description || null,
        is_active: !!is_active,
        sort_order: parseInt(sort_order) || 0,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      })
      .returning('*');
    
    // Create default requirements if provided
    if (requirements) {
      await knex('board_requirements').insert({
        id: require('crypto').randomUUID(),
        board_id: board.id,
        min_age: requirements.min_age || null,
        max_age: requirements.max_age || null,
        min_height_cm: requirements.min_height_cm || null,
        max_height_cm: requirements.max_height_cm || null,
        genders: requirements.genders ? JSON.stringify(requirements.genders) : null,
        min_bust: requirements.min_bust || null,
        max_bust: requirements.max_bust || null,
        min_waist: requirements.min_waist || null,
        max_waist: requirements.max_waist || null,
        min_hips: requirements.min_hips || null,
        max_hips: requirements.max_hips || null,
        body_types: requirements.body_types ? JSON.stringify(requirements.body_types) : null,
        comfort_levels: requirements.comfort_levels ? JSON.stringify(requirements.comfort_levels) : null,
        experience_levels: requirements.experience_levels ? JSON.stringify(requirements.experience_levels) : null,
        skills: requirements.skills ? JSON.stringify(requirements.skills) : null,
        locations: requirements.locations ? JSON.stringify(requirements.locations) : null,
        min_social_reach: requirements.min_social_reach || null,
        social_reach_importance: requirements.social_reach_importance || null,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
    
    // Create default scoring weights
    const defaultWeights = scoring_weights || {
      age_weight: 0,
      height_weight: 0,
      measurements_weight: 0,
      body_type_weight: 0,
      comfort_weight: 0,
      experience_weight: 0,
      skills_weight: 0,
      location_weight: 0,
      social_reach_weight: 0
    };
    
    await knex('board_scoring_weights').insert({
      id: require('crypto').randomUUID(),
      board_id: board.id,
      ...defaultWeights,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });
    
    return res.json(board);
  } catch (error) {
    console.error('[Boards API] Error creating board:', error);
    return res.status(500).json({ error: 'Failed to create board' });
  }
});

// PUT /api/agency/boards/:boardId - Update board
router.put('/api/agency/boards/:boardId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    const { name, description, is_active, sort_order } = req.body;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Update board
    const updates = {
      updated_at: knex.fn.now()
    };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (is_active !== undefined) updates.is_active = !!is_active;
    if (sort_order !== undefined) updates.sort_order = parseInt(sort_order) || 0;
    
    await knex('boards')
      .where({ id: boardId })
      .update(updates);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error updating board:', error);
    return res.status(500).json({ error: 'Failed to update board' });
  }
});

// PUT /api/agency/boards/:boardId/requirements - Update board requirements
router.put('/api/agency/boards/:boardId/requirements', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    const requirements = req.body;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Check if requirements exist
    const existing = await knex('board_requirements')
      .where({ board_id: boardId })
      .first();
    
    const requirementsData = {
      min_age: requirements.min_age || null,
      max_age: requirements.max_age || null,
      min_height_cm: requirements.min_height_cm || null,
      max_height_cm: requirements.max_height_cm || null,
      genders: requirements.genders ? JSON.stringify(requirements.genders) : null,
      min_bust: requirements.min_bust || null,
      max_bust: requirements.max_bust || null,
      min_waist: requirements.min_waist || null,
      max_waist: requirements.max_waist || null,
      min_hips: requirements.min_hips || null,
      max_hips: requirements.max_hips || null,
      body_types: requirements.body_types ? JSON.stringify(requirements.body_types) : null,
      comfort_levels: requirements.comfort_levels ? JSON.stringify(requirements.comfort_levels) : null,
      experience_levels: requirements.experience_levels ? JSON.stringify(requirements.experience_levels) : null,
      skills: requirements.skills ? JSON.stringify(requirements.skills) : null,
      locations: requirements.locations ? JSON.stringify(requirements.locations) : null,
      min_social_reach: requirements.min_social_reach || null,
      social_reach_importance: requirements.social_reach_importance || null,
      updated_at: knex.fn.now()
    };
    
    if (existing) {
      await knex('board_requirements')
        .where({ board_id: boardId })
        .update(requirementsData);
    } else {
      await knex('board_requirements').insert({
        id: require('crypto').randomUUID(),
        board_id: boardId,
        ...requirementsData,
        created_at: knex.fn.now()
      });
    }
    
    // Recalculate match scores for all applications in this board
    await recalculateBoardScores(boardId, agencyId);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error updating requirements:', error);
    return res.status(500).json({ error: 'Failed to update requirements' });
  }
});

// PUT /api/agency/boards/:boardId/weights - Update scoring weights
router.put('/api/agency/boards/:boardId/weights', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    const weights = req.body;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Validate weights (0-5)
    const weightFields = ['age_weight', 'height_weight', 'measurements_weight', 'body_type_weight', 
                          'comfort_weight', 'experience_weight', 'skills_weight', 'location_weight', 'social_reach_weight'];
    const weightsData = {};
    weightFields.forEach(field => {
      if (weights[field] !== undefined) {
        const val = parseFloat(weights[field]);
        weightsData[field] = Math.max(0, Math.min(5, val));
      }
    });
    
    // Check if weights exist
    const existing = await knex('board_scoring_weights')
      .where({ board_id: boardId })
      .first();
    
    if (existing) {
      await knex('board_scoring_weights')
        .where({ board_id: boardId })
        .update({
          ...weightsData,
          updated_at: knex.fn.now()
        });
    } else {
      await knex('board_scoring_weights').insert({
        id: require('crypto').randomUUID(),
        board_id: boardId,
        age_weight: 0,
        height_weight: 0,
        measurements_weight: 0,
        body_type_weight: 0,
        comfort_weight: 0,
        experience_weight: 0,
        skills_weight: 0,
        location_weight: 0,
        social_reach_weight: 0,
        ...weightsData,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
    
    // Recalculate match scores
    await recalculateBoardScores(boardId, agencyId);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error updating weights:', error);
    return res.status(500).json({ error: 'Failed to update weights' });
  }
});

// DELETE /api/agency/boards/:boardId - Delete board
router.delete('/api/agency/boards/:boardId', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Delete board (cascade will handle requirements, weights, and board_applications)
    await knex('boards')
      .where({ id: boardId })
      .delete();
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error deleting board:', error);
    return res.status(500).json({ error: 'Failed to delete board' });
  }
});

// POST /api/agency/boards/:boardId/duplicate - Duplicate board
router.post('/api/agency/boards/:boardId/duplicate', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    
    // Get original board
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    // Get requirements and weights
    const requirements = await knex('board_requirements')
      .where({ board_id: boardId })
      .first();
    
    const weights = await knex('board_scoring_weights')
      .where({ board_id: boardId })
      .first();
    
    // Create new board
    const newBoardId = require('crypto').randomUUID();
    await knex('boards').insert({
      id: newBoardId,
      agency_id: agencyId,
      name: `${board.name} (Copy)`,
      description: board.description,
      is_active: false, // Inactive by default
      sort_order: board.sort_order,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });
    
    // Copy requirements
    if (requirements) {
      const newReq = { ...requirements };
      delete newReq.id;
      delete newReq.board_id;
      delete newReq.created_at;
      delete newReq.updated_at;
      await knex('board_requirements').insert({
        id: require('crypto').randomUUID(),
        board_id: newBoardId,
        ...newReq,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
    
    // Copy weights
    if (weights) {
      const newWeights = { ...weights };
      delete newWeights.id;
      delete newWeights.board_id;
      delete newWeights.created_at;
      delete newWeights.updated_at;
      await knex('board_scoring_weights').insert({
        id: require('crypto').randomUUID(),
        board_id: newBoardId,
        ...newWeights,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now()
      });
    }
    
    return res.json({ id: newBoardId, success: true });
  } catch (error) {
    console.error('[Boards API] Error duplicating board:', error);
    return res.status(500).json({ error: 'Failed to duplicate board' });
  }
});

// POST /api/agency/boards/:boardId/calculate-scores - Recalculate all match scores for a board
router.post('/api/agency/boards/:boardId/calculate-scores', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { boardId } = req.params;
    const agencyId = req.session.userId;
    
    // Verify board belongs to agency
    const board = await knex('boards')
      .where({ id: boardId, agency_id: agencyId })
      .first();
    
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }
    
    await recalculateBoardScores(boardId, agencyId);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error calculating scores:', error);
    return res.status(500).json({ error: 'Failed to calculate scores' });
  }
});

// POST /api/agency/applications/:applicationId/assign-board - Assign application to board
router.post('/api/agency/applications/:applicationId/assign-board', requireRole('AGENCY'), async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const { board_id } = req.body;
    const agencyId = req.session.userId;

    // Verify application belongs to agency
    const application = await knex('applications')
      .where({ id: applicationId, agency_id: agencyId })
      .first();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify board belongs to agency
    if (board_id) {
      const board = await knex('boards')
        .where({ id: board_id, agency_id: agencyId })
        .first();

      if (!board) {
        return res.status(404).json({ error: 'Board not found' });
      }
    }

    // Remove from all boards first
    await knex('board_applications')
      .where({ application_id: applicationId })
      .delete();

    // Assign to new board if provided
    if (board_id) {
      // Check if already exists
      const existing = await knex('board_applications')
        .where({ board_id, application_id: applicationId })
        .first();

      if (!existing) {
        // Get board requirements and weights
        const board = await knex('boards')
          .where({ id: board_id, agency_id: agencyId })
          .first();

        const requirements = await knex('board_requirements')
          .where({ board_id })
          .first();

        const scoring_weights = await knex('board_scoring_weights')
          .where({ board_id })
          .first();

        // Get profile
        const profile = await knex('profiles')
          .where({ id: application.profile_id })
          .first();

        let matchScore = 0;
        let matchDetails = null;

        // Calculate match score if requirements and weights exist
        if (requirements && scoring_weights && profile) {
          const { calculateMatchScore } = require('../lib/match-scoring');
          
          const parsedRequirements = {
            ...requirements,
            genders: requirements.genders ? JSON.parse(requirements.genders) : null,
            body_types: requirements.body_types ? JSON.parse(requirements.body_types) : null,
            comfort_levels: requirements.comfort_levels ? JSON.parse(requirements.comfort_levels) : null,
            experience_levels: requirements.experience_levels ? JSON.parse(requirements.experience_levels) : null,
            skills: requirements.skills ? JSON.parse(requirements.skills) : null,
            locations: requirements.locations ? JSON.parse(requirements.locations) : null
          };

          const matchResult = calculateMatchScore(profile, {
            requirements: parsedRequirements,
            scoring_weights
          });

          matchScore = matchResult.score;
          matchDetails = JSON.stringify(matchResult.details);
        }

        // Create board_applications entry
        await knex('board_applications').insert({
          id: require('crypto').randomUUID(),
          board_id,
          application_id: applicationId,
          match_score: matchScore,
          match_details: matchDetails,
          created_at: knex.fn.now(),
          updated_at: knex.fn.now()
        });

        // Update applications table cache
        await knex('applications')
          .where({ id: applicationId })
          .update({
            board_id,
            match_score: matchScore,
            match_calculated_at: knex.fn.now()
          });
      }
    } else {
      // Remove board_id from application if unassigning
      await knex('applications')
        .where({ id: applicationId })
        .update({
          board_id: null,
          match_score: null,
          match_calculated_at: null
        });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[Boards API] Error assigning application to board:', error);
    return res.status(500).json({ error: 'Failed to assign application to board' });
  }
});

// Helper function to recalculate match scores for all applications in a board
async function recalculateBoardScores(boardId, agencyId) {
  // Get board with requirements and weights
  const board = await knex('boards')
    .where({ id: boardId, agency_id: agencyId })
    .first();
  
  if (!board) return;
  
  const requirements = await knex('board_requirements')
    .where({ board_id: boardId })
    .first();
  
  const scoring_weights = await knex('board_scoring_weights')
    .where({ board_id: boardId })
    .first();
  
  if (!requirements || !scoring_weights) return;
  
  // Parse JSON fields
  const parsedRequirements = {
    ...requirements,
    genders: requirements.genders ? JSON.parse(requirements.genders) : null,
    body_types: requirements.body_types ? JSON.parse(requirements.body_types) : null,
    comfort_levels: requirements.comfort_levels ? JSON.parse(requirements.comfort_levels) : null,
    experience_levels: requirements.experience_levels ? JSON.parse(requirements.experience_levels) : null,
    skills: requirements.skills ? JSON.parse(requirements.skills) : null,
    locations: requirements.locations ? JSON.parse(requirements.locations) : null
  };
  
  // Get all applications in this board
  const boardApplications = await knex('board_applications')
    .where({ board_id: boardId })
    .select('application_id');
  
  // Calculate scores for each application
  for (const ba of boardApplications) {
    const application = await knex('applications')
      .where({ id: ba.application_id, agency_id: agencyId })
      .first();
    
    if (!application) continue;
    
    const profile = await knex('profiles')
      .where({ id: application.profile_id })
      .first();
    
    if (!profile) continue;
    
    // Calculate match score
    const matchResult = calculateMatchScore(profile, {
      requirements: parsedRequirements,
      scoring_weights
    });
    
    // Update board_applications table
    await knex('board_applications')
      .where({ board_id: boardId, application_id: application.id })
      .update({
        match_score: matchResult.score,
        match_details: JSON.stringify(matchResult.details),
        updated_at: knex.fn.now()
      });
    
    // Update applications table (cache)
    await knex('applications')
      .where({ id: application.id })
      .update({
        match_score: matchResult.score,
        match_calculated_at: knex.fn.now()
      });
  }
}

module.exports = router;