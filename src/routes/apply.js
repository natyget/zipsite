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
  // /apply is only for logged-out users (new signups)
  // If user is logged in, redirect them to their dashboard
  if (req.session && req.session.userId && req.currentUser) {
    // Logged-in users should go to their dashboard, not /apply
    if (req.session.role === 'TALENT') {
      return res.redirect('/dashboard/talent');
    } else if (req.session.role === 'AGENCY') {
      return res.redirect('/dashboard/agency');
    } else {
      return res.redirect('/dashboard');
    }
  }

  // Only logged-out users can access /apply
  const defaults = {
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
    isLoggedIn: false // Always false for /apply since logged-in users are redirected
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

    // Declare profile variables at function scope so they're available after if/else
    let first_name, last_name, city, phone, height_cm, bust, waist, hips, shoe_size;
    let eye_color, hair_color, measurements, bio, specialties, partner_agency_email;
    let passwordHash = null; // Store password hash for transaction use

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

    // Prepare body for validation - only include fields that are in the schema
    // The schema uses .strict() so we must exclude extra fields like password, email, etc.
    const bodyForValidation = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      city: req.body.city,
      phone: req.body.phone,
      height_cm: req.body.height_cm,
      bust: req.body.bust,
      waist: req.body.waist,
      hips: req.body.hips,
      shoe_size: req.body.shoe_size,
      eye_color: req.body.eye_color,
      hair_color: req.body.hair_color,
      measurements: req.body.measurements,
      bio: req.body.bio,
      specialties: specialtiesArray.length > 0 ? specialtiesArray : undefined,
      partner_agency_email: req.body.partner_agency_email
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
    // Assign to function-scope variables so they're available after this block
    first_name = applyParsed.data.first_name;
    last_name = applyParsed.data.last_name;
    city = applyParsed.data.city;
    phone = applyParsed.data.phone;
    height_cm = applyParsed.data.height_cm;
    bust = applyParsed.data.bust;
    waist = applyParsed.data.waist;
    hips = applyParsed.data.hips;
    shoe_size = applyParsed.data.shoe_size;
    eye_color = applyParsed.data.eye_color;
    hair_color = applyParsed.data.hair_color;
    measurements = applyParsed.data.measurements;
    bio = applyParsed.data.bio;
    specialties = applyParsed.data.specialties;
    partner_agency_email = applyParsed.data.partner_agency_email;

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
      passwordHash = await bcrypt.hash(signupParsed.data.password, 10);
      userId = uuidv4();

      console.log('[Signup/Apply] Preparing user data:', {
        id: userId,
        email: normalizedEmail,
        role: 'TALENT',
        hasPasswordHash: !!passwordHash,
        passwordHashLength: passwordHash?.length || 0
      });

      // Store password hash for use in transaction
      // User will be created in transaction below along with profile
      // Session is set early so user is logged in even if profile creation fails
      req.session.userId = userId;
      req.session.role = 'TALENT';
      user = { id: userId, role: 'TALENT' };
      
      console.log('[Signup/Apply] Setting session:', {
        userId: req.session.userId,
        role: req.session.role
      });
      
      // Save session before proceeding with database operations
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
      console.error('[Signup/Apply] Error preparing account:', {
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

    // Prepare body for validation - only include fields that are in the schema
    // The schema uses .strict() so we must exclude extra fields
    const bodyForValidation = {
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      city: req.body.city,
      phone: req.body.phone,
      height_cm: req.body.height_cm,
      bust: req.body.bust,
      waist: req.body.waist,
      hips: req.body.hips,
      shoe_size: req.body.shoe_size,
      eye_color: req.body.eye_color,
      hair_color: req.body.hair_color,
      measurements: req.body.measurements,
      bio: req.body.bio,
      specialties: specialtiesArray.length > 0 ? specialtiesArray : undefined,
      partner_agency_email: req.body.partner_agency_email
    };

    // Validate profile data
    console.log('[Apply] Validating profile schema for logged-in user...');
    const parsed = applyProfileSchema.safeParse(bodyForValidation);
    if (!parsed.success) {
      const profileErrors = parsed.error.flatten().fieldErrors;
      console.log('[Apply] Profile validation failed for logged-in user:', profileErrors);
      return res.status(422).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: { ...req.body, specialties: specialtiesArray },
        errors: profileErrors,
        layout: 'layout',
        isLoggedIn
      });
    }

    console.log('[Apply] Profile validation passed for logged-in user');

    // Extract profile data from validated result
    // Assign to function-scope variables (already declared above)
    first_name = parsed.data.first_name;
    last_name = parsed.data.last_name;
    city = parsed.data.city;
    phone = parsed.data.phone;
    height_cm = parsed.data.height_cm;
    bust = parsed.data.bust;
    waist = parsed.data.waist;
    hips = parsed.data.hips;
    shoe_size = parsed.data.shoe_size;
    eye_color = parsed.data.eye_color;
    hair_color = parsed.data.hair_color;
    measurements = parsed.data.measurements;
    bio = parsed.data.bio;
    specialties = parsed.data.specialties;
    partner_agency_email = parsed.data.partner_agency_email;
    
    console.log('[Apply] Extracted profile data for logged-in user:', {
      name: `${first_name} ${last_name}`,
      city: city,
      hasBio: !!bio,
      hasSpecialties: !!specialties
    });
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

    // Check for existing profile using userId (for both logged-in and new users)
    console.log('[Apply] Checking for existing profile for user:', userId);
    const existingProfile = await knex('profiles').where({ user_id: userId }).first();
    
    console.log('[Apply] Profile lookup result:', {
      userId: userId,
      existingProfileFound: !!existingProfile,
      existingProfileId: existingProfile?.id || null,
      existingProfileSlug: existingProfile?.slug || null
    });
    
    const curatedBio = curateBio(bio, first_name, last_name);
    const cleanedMeasurements = normalizeMeasurements(measurements);
    const specialtiesJson = specialties && Array.isArray(specialties) && specialties.length > 0 
      ? JSON.stringify(specialties) 
      : null;

    let profileId;
    
    // Use transaction for new signups to ensure atomicity of user + profile creation
    if (!isLoggedIn && !existingProfile) {
      console.log('[Apply] Creating user and profile in transaction:', {
        userId: userId,
        name: `${first_name} ${last_name}`,
        email: normalizedEmail
      });
      
      // Wrap user and profile creation in a transaction
      // Use the password hash that was already computed above
      await knex.transaction(async (trx) => {
        try {
          // Insert user first
          await trx('users').insert({
            id: userId,
            email: normalizedEmail,
            password_hash: passwordHash,
            role: 'TALENT'
          });
          
          console.log('[Apply] User inserted in transaction:', userId);
          
          // Create profile
          const slug = await ensureUniqueSlug(trx, 'profiles', `${first_name}-${last_name}`);
          profileId = uuidv4();
          
          const profileData = {
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
          };
          
          await trx('profiles').insert(profileData);
          
          console.log('[Apply] User and profile created atomically:', {
            userId: userId,
            profileId: profileId,
            slug: slug
          });
        } catch (txError) {
          console.error('[Apply] Transaction error, rolling back:', {
            message: txError.message,
            code: txError.code,
            name: txError.name
          });
          throw txError; // Re-throw to trigger rollback
        }
      });
    } else if (existingProfile) {
      // Update existing profile (no transaction needed, user already exists)
      console.log('[Apply] Updating existing profile:', existingProfile.id);
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
      console.log('[Apply] Profile updated successfully:', {
        profileId: profileId,
        userId: userId,
        slug: slug
      });
    } else {
      // Logged-in user creating profile for first time (user already exists)
      console.log('[Apply] Creating new profile for logged-in user:', {
        userId: userId,
        name: `${first_name} ${last_name}`
      });
      const slug = await ensureUniqueSlug(knex, 'profiles', `${first_name}-${last_name}`);
      profileId = uuidv4();
      
      const profileData = {
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
      };
      
      console.log('[Apply] Inserting profile into database:', {
        profileId: profileId,
        userId: userId,
        slug: slug,
        name: `${first_name} ${last_name}`,
        user_id: profileData.user_id
      });
      
      await knex('profiles').insert(profileData);
      
      console.log('[Apply] Profile created successfully:', {
        profileId: profileId,
        userId: userId,
        slug: slug,
        linkedToUser: true,
        user_id: profileData.user_id
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
      const successMessage = `✅ Profile updated successfully, ${first_name}! Upload media to complete your comp card.`;
      addMessage(req, 'success', successMessage);
      console.log('[Apply] Logged-in user profile update completed:', {
        userId: userId,
        profileId: profileId,
        name: `${first_name} ${last_name}`,
        message: successMessage
      });
    }
    
    // Save session once with all data (userId, role, profileId) before redirect
    // For new signups, session was already saved earlier, but we need to save again with profileId
    // For logged-in users, this is the first save
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[Apply] Session save error:', err);
          reject(err);
        } else {
          console.log('[Apply] Session saved successfully before redirect:', {
            userId: req.session.userId,
            role: req.session.role,
            profileId: req.session.profileId,
            hasProfileId: !!req.session.profileId
          });
          resolve();
        }
      });
    });
    
    // Verify profile was created/updated and is linked to the user before redirecting
    const verifyProfile = await knex('profiles').where({ id: profileId }).first();
    if (!verifyProfile) {
      console.error('[Apply] ERROR: Profile not found after creation!', { profileId, userId });
      addMessage(req, 'error', 'Profile creation failed. Please try again.');
      return res.status(500).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: req.body,
        errors: {},
        layout: 'layout',
        isLoggedIn
      });
    }
    
    // Verify the profile is linked to the correct user
    if (verifyProfile.user_id !== userId) {
      console.error('[Apply] ERROR: Profile user_id mismatch!', {
        profileId: verifyProfile.id,
        profileUserId: verifyProfile.user_id,
        sessionUserId: userId,
        expectedMatch: verifyProfile.user_id === userId
      });
      addMessage(req, 'error', 'Profile linking error. Please contact support.');
      return res.status(500).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: req.body,
        errors: {},
        layout: 'layout',
        isLoggedIn
      });
    }
    
    console.log('[Apply] Profile verified and linked to user, redirecting to dashboard:', {
      profileId: verifyProfile.id,
      userId: verifyProfile.user_id,
      sessionUserId: userId,
      slug: verifyProfile.slug,
      name: `${verifyProfile.first_name} ${verifyProfile.last_name}`,
      linkedCorrectly: verifyProfile.user_id === userId
    });
    
    // Use 303 See Other for POST redirect (best practice)
    // This ensures the message is displayed on the dashboard
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
