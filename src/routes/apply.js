const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const knex = require('../db/knex');
const { applyProfileSchema, signupSchema } = require('../lib/validation');
const { normalizeMeasurements, curateBio } = require('../lib/curate');
const { ensureUniqueSlug } = require('../lib/slugify');
const { addMessage } = require('../middleware/context');
const { upload, processImage } = require('../lib/uploader');

const router = express.Router();

router.get('/apply', (req, res) => {
  const defaults = req.currentProfile
    ? {
        first_name: req.currentProfile.first_name,
        last_name: req.currentProfile.last_name,
        city: req.currentProfile.city,
        phone: req.currentProfile.phone || '',
        measurements: req.currentProfile.measurements,
        height_cm: req.currentProfile.height_cm,
        bust: req.currentProfile.bust || '',
        waist: req.currentProfile.waist || '',
        hips: req.currentProfile.hips || '',
        shoe_size: req.currentProfile.shoe_size || '',
        eye_color: req.currentProfile.eye_color || '',
        hair_color: req.currentProfile.hair_color || '',
        bio: req.currentProfile.bio_raw,
        specialties: req.currentProfile.specialties ? JSON.parse(req.currentProfile.specialties) : [],
        partner_agency_email: '',
        email: req.currentUser?.email || '',
        password: '',
        password_confirm: ''
      }
    : {
        first_name: '',
        last_name: '',
        city: '',
        phone: '',
        measurements: '',
        height_cm: '',
        bust: '',
        waist: '',
        hips: '',
        shoe_size: '',
        eye_color: '',
        hair_color: '',
        bio: '',
        specialties: [],
        partner_agency_email: '',
        email: '',
        password: '',
        password_confirm: ''
      };

  return res.render('apply/index', {
    title: 'Start your ZipSite profile',
    values: defaults,
    errors: {},
    layout: 'layout',
    isLoggedIn: Boolean(req.currentUser)
  });
});

// Multer error handler middleware
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('[Apply] Multer error:', {
      message: err.message,
      code: err.code,
      field: err.field,
      name: err.name
    });
    // If it's a multer error, continue anyway (we don't require photos)
    // Only fail if it's a critical error
    if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT') {
      // These are warnings, not critical errors
      console.warn('[Apply] File upload warning:', err.message);
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      // Unexpected file field - ignore it
      console.warn('[Apply] Unexpected file field:', err.field);
    } else {
      // Other multer errors - log and continue
      console.error('[Apply] Multer error (non-critical):', err.message);
    }
  }
  next();
};

router.post('/apply', upload.array('photos', 12), handleMulterError, async (req, res, next) => {
  try {
    console.log('[Apply] POST /apply route hit');
    console.log('[Apply] Request method:', req.method);
    console.log('[Apply] Request URL:', req.url);
    console.log('[Apply] Request body keys:', Object.keys(req.body || {}));
    console.log('[Apply] Request body values:', {
      email: req.body?.email ? `${req.body.email.substring(0, 10)}...` : 'missing',
      first_name: req.body?.first_name || 'missing',
      last_name: req.body?.last_name || 'missing',
      has_password: !!req.body?.password,
      has_password_confirm: !!req.body?.password_confirm,
      city: req.body?.city || 'missing',
      height_cm: req.body?.height_cm || 'missing',
      measurements: req.body?.measurements || 'missing',
      bio: req.body?.bio ? `${req.body.bio.substring(0, 20)}...` : 'missing'
    });
    console.log('[Apply] Is logged in:', Boolean(req.currentUser));
    console.log('[Apply] Files uploaded:', req.files?.length || 0);
  
    const isLoggedIn = Boolean(req.currentUser);
    let user = null;
    let userId = null;
    let signupParsed = null; // Store signup validation result for use in success message
    let normalizedEmail = null; // Store normalized email for use in success message

  // If not logged in, validate account creation fields
  if (!isLoggedIn) {
    console.log('[Apply] User is not logged in, validating signup...');
    
    // Check password confirmation
    if (req.body.password !== req.body.password_confirm) {
      console.log('[Apply] Password confirmation mismatch');
      return res.status(422).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: req.body,
        errors: { password_confirm: ['Passwords do not match'] },
        layout: 'layout',
        isLoggedIn: false
      });
    }

    console.log('[Apply] Validating signup schema...');
    signupParsed = signupSchema.safeParse({
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      password: req.body.password,
      role: 'TALENT'
    });

    if (!signupParsed.success) {
      const signupErrors = signupParsed.error.flatten().fieldErrors;
      console.log('[Apply] Signup validation failed:', signupErrors);
      
      const applyParsed = applyProfileSchema.safeParse(req.body);
      const applyErrors = applyParsed.success ? {} : applyParsed.error.flatten().fieldErrors;
      
      if (!applyParsed.success) {
        console.log('[Apply] Profile validation also failed:', applyParsed.error.flatten().fieldErrors);
      }
      
      return res.status(422).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: req.body,
        errors: { ...signupErrors, ...applyErrors },
        layout: 'layout',
        isLoggedIn: false
      });
    }

    console.log('[Apply] Signup validation passed:', {
      email: signupParsed.data.email,
      first_name: signupParsed.data.first_name,
      last_name: signupParsed.data.last_name,
      role: signupParsed.data.role
    });

    // Handle specialties - convert to array if it's a single value or array
    // This must happen BEFORE profile validation
    let specialtiesArray = [];
    if (req.body.specialties) {
      if (Array.isArray(req.body.specialties)) {
        specialtiesArray = req.body.specialties;
      } else {
        specialtiesArray = [req.body.specialties];
      }
    }

    // Prepare body for validation (convert specialties to array)
    const bodyForValidation = {
      ...req.body,
      specialties: specialtiesArray.length > 0 ? specialtiesArray : undefined
    };

    // Validate profile fields (with specialties already converted to array)
    console.log('[Apply] Validating profile schema...');
    const applyParsed = applyProfileSchema.safeParse(bodyForValidation);
    if (!applyParsed.success) {
      const profileErrors = applyParsed.error.flatten().fieldErrors;
      console.log('[Apply] Profile validation failed:', profileErrors);
      return res.status(422).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: { ...req.body, specialties: specialtiesArray },
        errors: profileErrors,
        layout: 'layout',
        isLoggedIn: false
      });
    }

    console.log('[Apply] Profile validation passed');

    // Extract profile data from validated result (specialties is already an array)
    const {
      first_name,
      last_name,
      city,
      phone,
      height_cm,
      bust,
      waist,
      hips,
      shoe_size,
      eye_color,
      hair_color,
      measurements,
      bio,
      specialties,
      partner_agency_email
    } = applyParsed.data;

    // Create account
    try {
      // Normalize email (lowercase, trim) for consistent storage and lookup
      normalizedEmail = signupParsed.data.email.toLowerCase().trim();
      
      console.log('[Signup/Apply] Creating account for email:', normalizedEmail);
      
      const existing = await knex('users').where({ email: normalizedEmail }).first();
      if (existing) {
        console.log('[Signup/Apply] Email already exists:', normalizedEmail);
        return res.status(422).render('apply/index', {
          title: 'Start your ZipSite profile',
          values: req.body,
          errors: { email: ['That email is already registered'] },
          layout: 'layout',
          isLoggedIn: false
        });
      }

      console.log('[Signup/Apply] Hashing password...');
      const passwordHash = await bcrypt.hash(signupParsed.data.password, 10);
      userId = uuidv4();

      console.log('[Signup/Apply] Inserting user into database...', {
        id: userId,
        email: normalizedEmail,
        role: 'TALENT',
        hasPasswordHash: !!passwordHash,
        passwordHashLength: passwordHash?.length || 0
      });

      await knex('users').insert({
        id: userId,
        email: normalizedEmail,
        password_hash: passwordHash,
        role: 'TALENT'
      });

      console.log('[Signup/Apply] User created successfully:', {
        id: userId,
        email: normalizedEmail,
        role: 'TALENT'
      });

      // Verify user was created
      const createdUser = await knex('users').where({ id: userId }).first();
      if (!createdUser) {
        console.error('[Signup/Apply] ERROR: User was not created!', { userId, email: normalizedEmail });
        throw new Error('Failed to create user account');
      }

      console.log('[Signup/Apply] User verified in database:', {
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
        hasPasswordHash: !!createdUser.password_hash,
        passwordHashLength: createdUser.password_hash?.length || 0
      });

      // Log user in
      req.session.userId = userId;
      req.session.role = 'TALENT';
      user = { id: userId, role: 'TALENT' };
      
      console.log('[Signup/Apply] Setting session:', {
        userId: req.session.userId,
        role: req.session.role
      });
      
      // Ensure session is saved before proceeding
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) {
            console.error('[Signup/Apply] Error saving session:', err);
            reject(err);
          } else {
            console.log('[Signup/Apply] Session saved successfully');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('[Signup/Apply] Error creating account:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      return next(error);
    }
  } else {
    // User is logged in, get their user record
    user = await knex('users').where({ id: req.currentUser.id }).first();
    if (!user || user.role !== 'TALENT') {
      addMessage(req, 'error', 'Only talent accounts can submit applications.');
      return res.redirect('/');
    }
    userId = user.id;

    // Handle specialties - convert to array if it's a single value or array
    let specialtiesArray = [];
    if (req.body.specialties) {
      if (Array.isArray(req.body.specialties)) {
        specialtiesArray = req.body.specialties;
      } else {
        specialtiesArray = [req.body.specialties];
      }
    }

    // Prepare body for validation (convert specialties to array)
    const bodyForValidation = {
      ...req.body,
      specialties: specialtiesArray.length > 0 ? specialtiesArray : undefined
    };

    // Validate profile data
    const parsed = applyProfileSchema.safeParse(bodyForValidation);
    if (!parsed.success) {
      return res.status(422).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: { ...req.body, specialties: specialtiesArray },
        errors: parsed.error.flatten().fieldErrors,
        layout: 'layout',
        isLoggedIn
      });
    }

    // Extract profile data from validated result
    var first_name = parsed.data.first_name;
    var last_name = parsed.data.last_name;
    var city = parsed.data.city;
    var phone = parsed.data.phone;
    var height_cm = parsed.data.height_cm;
    var bust = parsed.data.bust;
    var waist = parsed.data.waist;
    var hips = parsed.data.hips;
    var shoe_size = parsed.data.shoe_size;
    var eye_color = parsed.data.eye_color;
    var hair_color = parsed.data.hair_color;
    var measurements = parsed.data.measurements;
    var bio = parsed.data.bio;
    var specialties = parsed.data.specialties;
    var partner_agency_email = parsed.data.partner_agency_email;
  }

  let partnerAgencyId = null;
    if (partner_agency_email) {
      const agency = await knex('users').where({ email: partner_agency_email, role: 'AGENCY' }).first();
      if (!agency) {
        return res.status(422).render('apply/index', {
          title: 'Start your ZipSite profile',
          values: req.body,
          errors: { partner_agency_email: ['We could not find that agency account.'] },
          layout: 'layout'
        });
      }
      partnerAgencyId = agency.id;
    }

    const existingProfile = await knex('profiles').where({ user_id: userId }).first();
    const curatedBio = curateBio(bio, first_name, last_name);
    const cleanedMeasurements = normalizeMeasurements(measurements);
    const specialtiesJson = specialties && Array.isArray(specialties) && specialties.length > 0 
      ? JSON.stringify(specialties) 
      : null;

    let profileId;
    if (existingProfile) {
      let slug = existingProfile.slug;
      if (!slug) {
        slug = await ensureUniqueSlug(knex, 'profiles', `${first_name}-${last_name}`);
      }
      profileId = existingProfile.id;
      await knex('profiles')
        .where({ id: existingProfile.id })
        .update({
          first_name,
          last_name,
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
          partner_agency_id: partnerAgencyId,
          slug,
          updated_at: knex.fn.now()
        });
    } else {
      const slug = await ensureUniqueSlug(knex, 'profiles', `${first_name}-${last_name}`);
      profileId = uuidv4();
      await knex('profiles').insert({
        id: profileId,
        user_id: userId,
        slug,
        first_name,
        last_name,
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
        partner_agency_id: partnerAgencyId
      });
    }

    // Process and save uploaded images
    if (req.files && req.files.length > 0) {
      const profile = await knex('profiles').where({ id: profileId }).first();
      const countResult = await knex('images')
        .where({ profile_id: profileId })
        .count({ total: '*' })
        .first();
      let nextSort = Number(countResult?.total || 0) + 1;
      let heroSet = false;

      for (const file of req.files) {
        try {
          const storedPath = await processImage(file.path);
          const imageId = uuidv4();
          await knex('images').insert({
            id: imageId,
            profile_id: profileId,
            path: storedPath,
            label: 'Portfolio image',
            sort: nextSort++
          });

          // Set first uploaded image as hero if no hero exists
          if (!profile.hero_image_path && !heroSet) {
            await knex('profiles').where({ id: profileId }).update({ hero_image_path: storedPath });
            heroSet = true;
          }
        } catch (fileError) {
          console.error('Error processing file:', fileError);
        }
      }
    }

    const profile = await knex('profiles').where({ id: profileId }).first();
    if (!profile) {
      console.error('[Apply] Profile not found after creation, profileId:', profileId);
      addMessage(req, 'error', 'Profile creation failed. Please try again.');
      return res.status(500).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: req.body,
        errors: {},
        layout: 'layout',
        isLoggedIn
      });
    }

    // Set profileId in session for easier access (for both new and existing users)
    req.session.profileId = profileId;

    // Set welcome message based on whether user was just created
    // Use a more prominent success message for new signups
    if (!isLoggedIn) {
      // New user signup - show prominent welcome message with user's name
      const welcomeMessage = `🎉 Welcome to ZipSite, ${first_name}! Your account has been created and your profile is ready. Upload photos to complete your comp card.`;
      addMessage(req, 'success', welcomeMessage);
      console.log('[Apply] New user signup completed:', {
        userId: userId,
        email: normalizedEmail,
        profileId: profileId,
        name: `${first_name} ${last_name}`,
        message: welcomeMessage
      });
    } else {
      // Existing user updating profile
      addMessage(req, 'success', '✅ Application saved successfully! Upload media to finish your comp card.');
    }
    
    // Ensure session is saved with all data (userId, role, profileId) before redirect
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[Apply] Session save error:', err);
          reject(err);
        } else {
          console.log('[Apply] Session saved successfully before redirect');
          resolve();
        }
      });
    });
    
    // Use 303 See Other for POST redirect (best practice)
    // This ensures the message is displayed on the dashboard
    console.log('[Apply] Redirecting to dashboard with success message');
    return res.redirect(303, '/dashboard/talent');
  } catch (error) {
    console.error('[Apply] Error in POST /apply:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    return next(error);
  }
});

module.exports = router;
