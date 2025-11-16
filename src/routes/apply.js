const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const knex = require('../db/knex');
const { applyProfileSchema, signupSchema } = require('../lib/validation');
const { normalizeMeasurements, curateBio } = require('../lib/curate');
const { ensureUniqueSlug } = require('../lib/slugify');
const { addMessage } = require('../middleware/context');
const { upload, processImage } = require('../lib/uploader');
const { calculateAge, generateSocialMediaUrl, parseSocialMediaHandle, convertKgToLbs, convertLbsToKg } = require('../lib/profile-helpers');
const { verifyIdToken } = require('../lib/firebase-admin');
const { extractIdToken } = require('../middleware/firebase-auth');

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
    password_confirm: '',
    // New comprehensive fields
    gender: '',
    date_of_birth: '',
    weight: '',
    weight_unit: '',
    weight_kg: '',
    weight_lbs: '',
    dress_size: '',
    hair_length: '',
    skin_tone: '',
    languages: [],
    availability_travel: false,
    availability_schedule: '',
    experience_level: '',
    training: '',
    portfolio_url: '',
    instagram_handle: '',
    twitter_handle: '',
    tiktok_handle: '',
    reference_name: '',
    reference_email: '',
    reference_phone: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relationship: '',
    work_eligibility: '',
    work_status: '',
    union_membership: '',
    ethnicity: '',
    tattoos: false,
    piercings: false,
    comfort_levels: [],
    previous_representations: []
  };

  return res.render('apply/index', {
    title: 'Start your Pholio profile',
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
    console.log('[Apply] ===== POST /apply route hit =====');
    console.log('[Apply] Request method:', req.method);
    console.log('[Apply] Request URL:', req.url);
    console.log('[Apply] Request path:', req.path);
    console.log('[Apply] Request originalUrl:', req.originalUrl);
    console.log('[Apply] Content-Type:', req.headers['content-type']);
    console.log('[Apply] Request body keys:', Object.keys(req.body || {}));
    console.log('[Apply] Request body values:', {
      email: req.body?.email ? `${req.body.email.substring(0, 10)}...` : 'missing',
      first_name: req.body?.first_name || 'missing',
      last_name: req.body?.last_name || 'missing',
      has_password: !!req.body?.password,
      has_password_confirm: !!req.body?.password_confirm,
      has_firebase_token: !!req.body?.firebase_token,
      firebase_token_value: req.body?.firebase_token ? 'PRESENT' : 'MISSING',
      firebase_token_length: req.body?.firebase_token?.length || 0,
      firebase_token_preview: req.body?.firebase_token ? `${req.body.firebase_token.substring(0, 30)}...` : 'missing',
      firebase_token_full: req.body?.firebase_token ? req.body.firebase_token : 'NOT IN BODY',
      city: req.body?.city || 'missing',
      height_cm: req.body?.height_cm || 'missing',
      bio: req.body?.bio ? `${req.body.bio.substring(0, 20)}...` : 'missing'
    });
    console.log('[Apply] Is logged in:', Boolean(req.currentUser));
    console.log('[Apply] Files uploaded:', req.files?.length || 0);
    console.log('[Apply] =================================');

    const isLoggedIn = Boolean(req.currentUser);
    let user = null;
    let userId = null;
    let signupParsed = null; // Store signup validation result for use in success message
    let normalizedEmail = null; // Store normalized email for use in success message

    // Declare profile variables at function scope so they're available after if/else
    let first_name, last_name, city, city_secondary, phone, height_cm, bust, waist, hips, shoe_size;
    let eye_color, hair_color, bio, specialties, experience_details, partner_agency_email;
    let gender, date_of_birth, age, weight_kg, weight_lbs, dress_size, hair_length, skin_tone;
    let languages, availability_travel, availability_schedule, experience_level, training, portfolio_url;
    let instagram_handle, instagram_url, twitter_handle, twitter_url, tiktok_handle, tiktok_url;
    let reference_name, reference_email, reference_phone;
    let emergency_contact_name, emergency_contact_phone, emergency_contact_relationship;
    let work_eligibility, work_status, union_membership, ethnicity, tattoos, piercings, comfort_levels, previous_representations;

    // If not logged in, validate account creation fields
    if (!isLoggedIn) {
      console.log('[Apply] User is not logged in, validating signup...');

      // Check if Firebase token exists (Google Sign-In)
      // For multipart/form-data, check req.body first (multer parses form fields)
      // Then check headers/cookies as fallback
      const idToken = (req.body && req.body.firebase_token) 
        ? req.body.firebase_token.trim() 
        : extractIdToken(req);
      let firebaseEmail = null;
      let firebaseUid = null;

      console.log('[Apply] Checking for Firebase token:', {
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body).slice(0, 10) : [],
        hasBodyToken: !!(req.body && req.body.firebase_token),
        bodyTokenValue: req.body && req.body.firebase_token ? `${req.body.firebase_token.substring(0, 30)}...` : 'missing',
        bodyTokenLength: req.body && req.body.firebase_token ? req.body.firebase_token.length : 0,
        extractedToken: !!extractIdToken(req),
        idToken: !!idToken,
        idTokenLength: idToken ? idToken.length : 0
      });

      if (idToken) {
        try {
          // Verify Firebase ID token and get email from it
          const decodedToken = await verifyIdToken(idToken);
          firebaseUid = decodedToken.uid;
          firebaseEmail = decodedToken.email;
          console.log('[Apply] Firebase token verified, email from token:', firebaseEmail);
        } catch (error) {
          console.error('[Apply] Firebase token verification failed:', error.message);
          // Continue with email/password validation if token is invalid
          firebaseEmail = null;
          firebaseUid = null;
        }
      } else {
        console.log('[Apply] ⚠️ No Firebase token found in request');
        console.log('[Apply] Request body keys:', req.body ? Object.keys(req.body).slice(0, 20) : 'no body');
        console.log('[Apply] Request headers:', {
          'content-type': req.headers['content-type'],
          'authorization': req.headers['authorization'] ? 'present' : 'missing'
        });
        console.log('[Apply] Full req.body.firebase_token:', req.body?.firebase_token || 'NOT PRESENT');
        console.log('[Apply] extractIdToken(req):', extractIdToken(req) || 'NOT FOUND');
      }

      // If Firebase token exists and is valid, use email from token and skip password validation
      if (firebaseEmail && firebaseUid) {
        console.log('[Apply] Using Google Sign-In authentication, skipping password validation');
        // Validate signup without password (email comes from Firebase token)
        const emailSchema = z.string().email('Enter a valid email').max(255).transform((val) => val.toLowerCase());
        const nameSchema = z.string().trim().min(1, 'Required').max(60, 'Too long');

        const googleSignupSchema = z.object({
          first_name: nameSchema,
          last_name: nameSchema,
          email: emailSchema, // Still validate format but will use Firebase email
          role: z.enum(['TALENT'])
        });

        signupParsed = googleSignupSchema.safeParse({
          first_name: req.body.first_name,
          last_name: req.body.last_name,
          email: firebaseEmail, // Use email from Firebase token
          role: 'TALENT'
        });

        if (!signupParsed.success) {
          const signupErrors = signupParsed.error.flatten().fieldErrors;
          console.log('[Apply] Google Sign-In validation failed:', signupErrors);
          console.log('[Apply] Validation data:', {
            first_name: req.body.first_name || 'missing',
            last_name: req.body.last_name || 'missing',
            email: firebaseEmail || 'missing',
            firebaseUid: firebaseUid || 'missing'
          });

          const applyParsed = applyProfileSchema.safeParse(req.body);
          const applyErrors = applyParsed.success ? {} : applyParsed.error.flatten().fieldErrors;

          // Don't show email/password errors if we're using Google Sign-In
          const filteredErrors = { ...signupErrors, ...applyErrors };
          delete filteredErrors.email;
          delete filteredErrors.password;
          delete filteredErrors.password_confirm;

          return res.status(422).render('apply/index', {
            title: 'Start your Pholio profile',
            values: req.body,
            errors: filteredErrors,
            layout: 'layout',
            isLoggedIn: false
          });
        }

        // Override email with Firebase email
        signupParsed.data.email = firebaseEmail;

        // Store Firebase UID for use later
        req.firebaseUid = firebaseUid;

        console.log('[Apply] Google Sign-In validation passed:', {
          email: signupParsed.data.email,
          first_name: signupParsed.data.first_name,
          last_name: signupParsed.data.last_name,
          firebaseUid: firebaseUid
        });
      } else {
        // No Firebase token or invalid token - use email/password validation
        console.log('[Apply] No Firebase token found or token invalid, checking if email/password signup...');
        console.log('[Apply] Email/password check:', {
          has_email: !!req.body.email,
          has_password: !!req.body.password,
          has_password_confirm: !!req.body.password_confirm,
          email_value: req.body.email ? `${req.body.email.substring(0, 10)}...` : 'missing',
          password_length: req.body.password ? req.body.password.length : 0
        });

        // If no email/password provided, this might be a Google Sign-In that failed
        // Show a helpful error message instead of validation errors
        if (!req.body.email || !req.body.password) {
          console.log('[Apply] No email/password provided and no valid Firebase token - likely Google Sign-In issue');
          return res.status(422).render('apply/index', {
            title: 'Start your Pholio profile',
            values: req.body,
            errors: { 
              firebase: ['Google Sign-In authentication failed. Please try signing in with Google again, or use email/password to create an account.']
            },
            layout: 'layout',
            isLoggedIn: false
          });
        }

        // Check password confirmation
        if (req.body.password !== req.body.password_confirm) {
          console.log('[Apply] Password confirmation mismatch');
          return res.status(422).render('apply/index', {
            title: 'Start your Pholio profile',
            values: req.body,
            errors: { password_confirm: ['Passwords do not match'] },
            layout: 'layout',
            isLoggedIn: false
          });
        }

        console.log('[Apply] Validating signup schema for email/password signup...');
        signupParsed = signupSchema.safeParse({
          first_name: req.body.first_name,
          last_name: req.body.last_name,
          email: req.body.email,
          password: req.body.password,
          role: 'TALENT'
        });

        if (!signupParsed.success) {
          const signupErrors = signupParsed.error.flatten().fieldErrors;
          console.log('[Apply] Email/password signup validation failed:', signupErrors);

          const applyParsed = applyProfileSchema.safeParse(req.body);
          const applyErrors = applyParsed.success ? {} : applyParsed.error.flatten().fieldErrors;

          if (!applyParsed.success) {
            console.log('[Apply] Profile validation also failed:', applyParsed.error.flatten().fieldErrors);
          }

          return res.status(422).render('apply/index', {
            title: 'Start your Pholio profile',
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
      }

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

      // Handle languages - convert to array if needed
      let languagesArray = [];
      if (req.body.languages) {
        if (Array.isArray(req.body.languages)) {
          languagesArray = req.body.languages;
        } else if (typeof req.body.languages === 'string') {
          try {
            languagesArray = JSON.parse(req.body.languages);
          } catch {
            languagesArray = req.body.languages.split(',').map(l => l.trim()).filter(l => l);
          }
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
        bio: req.body.bio,
        specialties: specialtiesArray.length > 0 ? specialtiesArray : undefined,
        partner_agency_email: req.body.partner_agency_email,
        // New comprehensive fields
        gender: req.body.gender,
        date_of_birth: req.body.date_of_birth,
        weight_kg: req.body.weight_kg,
        weight_lbs: req.body.weight_lbs,
        dress_size: req.body.dress_size,
        hair_length: req.body.hair_length,
        skin_tone: req.body.skin_tone,
        languages: languagesArray.length > 0 ? languagesArray : undefined,
        availability_travel: req.body.availability_travel,
        availability_schedule: req.body.availability_schedule,
        experience_level: req.body.experience_level,
        training: req.body.training,
        portfolio_url: req.body.portfolio_url,
        instagram_handle: req.body.instagram_handle,
        instagram_url: req.body.instagram_url,
        twitter_handle: req.body.twitter_handle,
        twitter_url: req.body.twitter_url,
        tiktok_handle: req.body.tiktok_handle,
        tiktok_url: req.body.tiktok_url,
        reference_name: req.body.reference_name,
        reference_email: req.body.reference_email,
        reference_phone: req.body.reference_phone,
        emergency_contact_name: req.body.emergency_contact_name,
        emergency_contact_phone: req.body.emergency_contact_phone,
        emergency_contact_relationship: req.body.emergency_contact_relationship,
        work_eligibility: req.body.work_eligibility,
        work_status: req.body.work_status,
        union_membership: req.body.union_membership,
        ethnicity: req.body.ethnicity,
        tattoos: req.body.tattoos,
        piercings: req.body.piercings,
        comfort_levels: req.body.comfort_levels,
        previous_representations: req.body.previous_representations
      };

      // Validate profile fields (with specialties already converted to array)
      console.log('[Apply] Validating profile schema...');
      const applyParsed = applyProfileSchema.safeParse(bodyForValidation);
      if (!applyParsed.success) {
        const profileErrors = applyParsed.error.flatten().fieldErrors;
        console.log('[Apply] Profile validation failed:', profileErrors);
        return res.status(422).render('apply/index', {
          title: 'Start your Pholio profile',
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
      city_secondary = applyParsed.data.city_secondary;
      phone = applyParsed.data.phone;
      height_cm = applyParsed.data.height_cm;
      bust = applyParsed.data.bust;
      waist = applyParsed.data.waist;
      hips = applyParsed.data.hips;
      shoe_size = applyParsed.data.shoe_size;
      eye_color = applyParsed.data.eye_color;
      hair_color = applyParsed.data.hair_color;
      bio = applyParsed.data.bio;
      specialties = applyParsed.data.specialties;
      experience_details = applyParsed.data.experience_details;
      partner_agency_email = applyParsed.data.partner_agency_email;

      // Extract new comprehensive fields
      gender = applyParsed.data.gender;
      date_of_birth = applyParsed.data.date_of_birth;
      // Handle weight - prefer hidden fields (populated by JS), fallback to weight/weight_unit
      const weight = applyParsed.data.weight;
      const weight_unit = applyParsed.data.weight_unit;
      weight_kg = applyParsed.data.weight_kg;
      weight_lbs = applyParsed.data.weight_lbs;

      // If weight/weight_unit provided but kg/lbs not, convert
      if (weight && weight_unit && (!weight_kg && !weight_lbs)) {
        if (weight_unit === 'kg') {
          weight_kg = weight;
          weight_lbs = convertKgToLbs(weight);
        } else {
          weight_lbs = weight;
          weight_kg = convertLbsToKg(weight);
        }
      }
      dress_size = applyParsed.data.dress_size;
      hair_length = applyParsed.data.hair_length;
      skin_tone = applyParsed.data.skin_tone;
      languages = applyParsed.data.languages;
      availability_travel = applyParsed.data.availability_travel;
      availability_schedule = applyParsed.data.availability_schedule;
      experience_level = applyParsed.data.experience_level;
      training = applyParsed.data.training;
      portfolio_url = applyParsed.data.portfolio_url;
      instagram_handle = applyParsed.data.instagram_handle;
      instagram_url = applyParsed.data.instagram_url;
      twitter_handle = applyParsed.data.twitter_handle;
      twitter_url = applyParsed.data.twitter_url;
      tiktok_handle = applyParsed.data.tiktok_handle;
      tiktok_url = applyParsed.data.tiktok_url;
      reference_name = applyParsed.data.reference_name;
      reference_email = applyParsed.data.reference_email;
      reference_phone = applyParsed.data.reference_phone;
      emergency_contact_name = applyParsed.data.emergency_contact_name;
      emergency_contact_phone = applyParsed.data.emergency_contact_phone;
      emergency_contact_relationship = applyParsed.data.emergency_contact_relationship;
      work_eligibility = applyParsed.data.work_eligibility;
      work_status = applyParsed.data.work_status;
      union_membership = applyParsed.data.union_membership;
      ethnicity = applyParsed.data.ethnicity;
      tattoos = applyParsed.data.tattoos;
      piercings = applyParsed.data.piercings;
      comfort_levels = applyParsed.data.comfort_levels;
      previous_representations = applyParsed.data.previous_representations;

      // Calculate age from date of birth
      if (date_of_birth) {
        age = calculateAge(date_of_birth);
      }

      // Handle weight conversion if only one is provided
      if (weight_kg && !weight_lbs) {
        weight_lbs = convertKgToLbs(weight_kg);
      } else if (weight_lbs && !weight_kg) {
        weight_kg = convertLbsToKg(weight_lbs);
      }

      // Handle languages - convert to JSON string
      const languagesJson = languages && Array.isArray(languages) && languages.length > 0
        ? JSON.stringify(languages)
        : null;

      // Create account (Firebase user should be created client-side first)
      try {
        // Normalize email (lowercase, trim) for consistent storage and lookup
        normalizedEmail = signupParsed.data.email.toLowerCase().trim();

        console.log('[Signup/Apply] Creating account for email:', normalizedEmail);

        // Get Firebase token from request (may already be verified above for Google Sign-In)
        // Check req.firebaseUid first (set during Google Sign-In validation above)
        // Then check req.body.firebase_token (for multipart form data)
        // Finally check headers/cookies as fallback
        let idToken = null;
        let decodedToken = null;
        let firebaseUid = null;

        // If Firebase UID was already set (Google Sign-In), use it
        if (req.firebaseUid) {
          firebaseUid = req.firebaseUid;
          console.log('[Signup/Apply] Using Firebase UID from Google Sign-In:', firebaseUid);
          // Token was already verified above, so we can skip verification here
          idToken = req.body?.firebase_token || extractIdToken(req);
        } else {
          // Email/password signup - need to get and verify token
          idToken = (req.body && req.body.firebase_token) 
            ? req.body.firebase_token.trim() 
            : extractIdToken(req);
            
          if (!idToken) {
            console.log('[Signup/Apply] No Firebase token provided');
            console.log('[Signup/Apply] Request body keys:', req.body ? Object.keys(req.body) : 'no body');
            console.log('[Signup/Apply] Request body firebase_token:', req.body && req.body.firebase_token ? 'present' : 'missing');
            return res.status(422).render('apply/index', {
              title: 'Start your Pholio profile',
              values: req.body,
              errors: { email: ['Authentication failed. Please try again.'] },
              layout: 'layout',
              isLoggedIn: false
            });
          }

          // Verify Firebase ID token
          decodedToken = await verifyIdToken(idToken);
          firebaseUid = decodedToken.uid;
          const firebaseEmail = decodedToken.email;

          if (firebaseEmail.toLowerCase().trim() !== normalizedEmail) {
            console.log('[Signup/Apply] Email mismatch:', { firebaseEmail, normalizedEmail });
            return res.status(422).render('apply/index', {
              title: 'Start your Pholio profile',
              values: req.body,
              errors: { email: ['Email does not match authenticated account.'] },
              layout: 'layout',
              isLoggedIn: false
            });
          }
        }

        // Check if user already exists
        let existing = null;
        if (firebaseUid) {
          existing = await knex('users').where({ firebase_uid: firebaseUid }).first();
        }
        if (!existing) {
          existing = await knex('users').where({ email: normalizedEmail }).first();
        }

        if (existing) {
          console.log('[Signup/Apply] User already exists:', { firebaseUid, email: normalizedEmail });
          return res.status(422).render('apply/index', {
            title: 'Start your Pholio profile',
            values: req.body,
            errors: { email: ['That email is already registered'] },
            layout: 'layout',
            isLoggedIn: false
          });
        }

        userId = uuidv4();

        console.log('[Signup/Apply] Preparing user data:', {
          id: userId,
          email: normalizedEmail,
          firebase_uid: firebaseUid,
          role: 'TALENT'
        });

        // Store Firebase UID for use in transaction
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

        // Store firebaseUid for use in transaction
        req.firebaseUid = firebaseUid;
      } catch (error) {
        console.error('[Signup/Apply] Error preparing account:', {
          message: error.message,
          code: error.code,
          name: error.name
        });

        // Handle Firebase-specific errors
        if (error.message.includes('Email already exists')) {
          return res.status(422).render('apply/index', {
            title: 'Start your Pholio profile',
            values: req.body,
            errors: { email: ['That email is already registered'] },
            layout: 'layout',
            isLoggedIn: false
          });
        }

        if (error.message.includes('Token expired') || error.message.includes('expired')) {
          return res.status(422).render('apply/index', {
            title: 'Start your Pholio profile',
            values: req.body,
            errors: { email: ['Your session has expired. Please try again.'] },
            layout: 'layout',
            isLoggedIn: false
          });
        }

        if (error.message.includes('Invalid token') || error.message.includes('verification failed')) {
          return res.status(422).render('apply/index', {
            title: 'Start your Pholio profile',
            values: req.body,
            errors: { email: ['Invalid authentication token. Please try again.'] },
            layout: 'layout',
            isLoggedIn: false
          });
        }

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

      // Handle languages - convert to array if needed
      let languagesArray = [];
      if (req.body.languages) {
        if (Array.isArray(req.body.languages)) {
          languagesArray = req.body.languages;
        } else if (typeof req.body.languages === 'string') {
          try {
            languagesArray = JSON.parse(req.body.languages);
          } catch {
            languagesArray = req.body.languages.split(',').map(l => l.trim()).filter(l => l);
          }
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
        bio: req.body.bio,
        specialties: specialtiesArray.length > 0 ? specialtiesArray : undefined,
        partner_agency_email: req.body.partner_agency_email,
        // New comprehensive fields
        gender: req.body.gender,
        date_of_birth: req.body.date_of_birth,
        weight_kg: req.body.weight_kg,
        weight_lbs: req.body.weight_lbs,
        dress_size: req.body.dress_size,
        hair_length: req.body.hair_length,
        skin_tone: req.body.skin_tone,
        languages: languagesArray.length > 0 ? languagesArray : undefined,
        availability_travel: req.body.availability_travel,
        availability_schedule: req.body.availability_schedule,
        experience_level: req.body.experience_level,
        training: req.body.training,
        portfolio_url: req.body.portfolio_url,
        instagram_handle: req.body.instagram_handle,
        instagram_url: req.body.instagram_url,
        twitter_handle: req.body.twitter_handle,
        twitter_url: req.body.twitter_url,
        tiktok_handle: req.body.tiktok_handle,
        tiktok_url: req.body.tiktok_url,
        reference_name: req.body.reference_name,
        reference_email: req.body.reference_email,
        reference_phone: req.body.reference_phone,
        emergency_contact_name: req.body.emergency_contact_name,
        emergency_contact_phone: req.body.emergency_contact_phone,
        emergency_contact_relationship: req.body.emergency_contact_relationship,
        work_eligibility: req.body.work_eligibility,
        work_status: req.body.work_status,
        union_membership: req.body.union_membership,
        ethnicity: req.body.ethnicity,
        tattoos: req.body.tattoos,
        piercings: req.body.piercings,
        comfort_levels: req.body.comfort_levels,
        previous_representations: req.body.previous_representations
      };

      // Validate profile data
      console.log('[Apply] Validating profile schema for logged-in user...');
      const parsed = applyProfileSchema.safeParse(bodyForValidation);
      if (!parsed.success) {
        const profileErrors = parsed.error.flatten().fieldErrors;
        console.log('[Apply] Profile validation failed for logged-in user:', profileErrors);
        return res.status(422).render('apply/index', {
          title: 'Start your Pholio profile',
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
      city_secondary = parsed.data.city_secondary;
      phone = parsed.data.phone;
      height_cm = parsed.data.height_cm;
      bust = parsed.data.bust;
      waist = parsed.data.waist;
      hips = parsed.data.hips;
      shoe_size = parsed.data.shoe_size;
      eye_color = parsed.data.eye_color;
      hair_color = parsed.data.hair_color;
      bio = parsed.data.bio;
      specialties = parsed.data.specialties;
      experience_details = parsed.data.experience_details;
      partner_agency_email = parsed.data.partner_agency_email;

      // Extract new comprehensive fields
      gender = parsed.data.gender;
      date_of_birth = parsed.data.date_of_birth;
      // Handle weight - prefer hidden fields (populated by JS), fallback to weight/weight_unit
      const weight = parsed.data.weight;
      const weight_unit = parsed.data.weight_unit;
      weight_kg = parsed.data.weight_kg;
      weight_lbs = parsed.data.weight_lbs;

      // If weight/weight_unit provided but kg/lbs not, convert
      if (weight && weight_unit && (!weight_kg && !weight_lbs)) {
        if (weight_unit === 'kg') {
          weight_kg = weight;
          weight_lbs = convertKgToLbs(weight);
        } else {
          weight_lbs = weight;
          weight_kg = convertLbsToKg(weight);
        }
      }
      dress_size = parsed.data.dress_size;
      hair_length = parsed.data.hair_length;
      skin_tone = parsed.data.skin_tone;
      languages = parsed.data.languages;
      availability_travel = parsed.data.availability_travel;
      availability_schedule = parsed.data.availability_schedule;
      experience_level = parsed.data.experience_level;
      training = parsed.data.training;
      portfolio_url = parsed.data.portfolio_url;
      instagram_handle = parsed.data.instagram_handle;
      instagram_url = parsed.data.instagram_url;
      twitter_handle = parsed.data.twitter_handle;
      twitter_url = parsed.data.twitter_url;
      tiktok_handle = parsed.data.tiktok_handle;
      tiktok_url = parsed.data.tiktok_url;
      reference_name = parsed.data.reference_name;
      reference_email = parsed.data.reference_email;
      reference_phone = parsed.data.reference_phone;
      emergency_contact_name = parsed.data.emergency_contact_name;
      emergency_contact_phone = parsed.data.emergency_contact_phone;
      emergency_contact_relationship = parsed.data.emergency_contact_relationship;
      work_eligibility = parsed.data.work_eligibility;
      work_status = parsed.data.work_status;
      union_membership = parsed.data.union_membership;
      ethnicity = parsed.data.ethnicity;
      tattoos = parsed.data.tattoos;
      piercings = parsed.data.piercings;
      comfort_levels = parsed.data.comfort_levels;
      previous_representations = parsed.data.previous_representations;

      // Calculate age from date of birth
      if (date_of_birth) {
        age = calculateAge(date_of_birth);
      }

      // Handle weight conversion if only one is provided
      if (weight_kg && !weight_lbs) {
        weight_lbs = convertKgToLbs(weight_kg);
      } else if (weight_lbs && !weight_kg) {
        weight_kg = convertLbsToKg(weight_lbs);
      }

      // Handle languages - convert to JSON string
      const languagesJson = languages && Array.isArray(languages) && languages.length > 0
        ? JSON.stringify(languages)
        : null;

      console.log('[Apply] Extracted profile data for logged-in user:', {
        name: `${first_name} ${last_name}`,
        city: city,
        hasBio: !!bio,
        hasSpecialties: !!specialties,
        hasLanguages: !!languagesJson
      });
    }

    let partnerAgencyId = null;
    if (partner_agency_email) {
      const agency = await knex('users').where({ email: partner_agency_email, role: 'AGENCY' }).first();
      if (!agency) {
        return res.status(422).render('apply/index', {
          title: 'Start your Pholio profile',
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
    const specialtiesJson = specialties && Array.isArray(specialties) && specialties.length > 0
      ? JSON.stringify(specialties)
      : null;
    const experienceDetailsJson = experience_details
      ? (typeof experience_details === 'string' ? experience_details : JSON.stringify(experience_details))
      : null;
    const previousRepsJson = previous_representations
      ? (typeof previous_representations === 'string' ? previous_representations : JSON.stringify(previous_representations))
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
      // Use the Firebase UID that was extracted from the token above
      await knex.transaction(async (trx) => {
        try {
          // Insert user first with Firebase UID
          await trx('users').insert({
            id: userId,
            email: normalizedEmail,
            firebase_uid: req.firebaseUid,
            role: 'TALENT'
          });

          console.log('[Apply] User inserted in transaction:', userId);

          // Create profile
          const slug = await ensureUniqueSlug(trx, 'profiles', `${first_name}-${last_name}`);
          profileId = uuidv4();

          // For new signups, always Free - just store handles, no URLs
          // Clean social media handles
          const cleanInstagramHandle = instagram_handle ? parseSocialMediaHandle(instagram_handle) : null;
          const cleanTwitterHandle = twitter_handle ? parseSocialMediaHandle(twitter_handle) : null;
          const cleanTiktokHandle = tiktok_handle ? parseSocialMediaHandle(tiktok_handle) : null;

          const profileData = {
            id: profileId,
            user_id: userId,
            slug,
            first_name,
            last_name,
            city,
            city_secondary: city_secondary || null,
            phone: phone || null,
            height_cm,
            bust: bust || null,
            waist: waist || null,
            hips: hips || null,
            shoe_size: shoe_size || null,
            eye_color: eye_color || null,
            hair_color: hair_color || null,
            bio_raw: bio,
            bio_curated: curatedBio,
            specialties: specialtiesJson,
            experience_details: experienceDetailsJson,
            partner_agency_id: partnerAgencyId,
            // New comprehensive fields
            gender: gender || null,
            date_of_birth: date_of_birth || null,
            age: age || null,
            weight_kg: weight_kg || null,
            weight_lbs: weight_lbs || null,
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
            work_status: (work_status === 'Other' && req.body.work_status_other) ? req.body.work_status_other : (work_status || null),
            union_membership: union_membership || null,
            ethnicity: ethnicity || null,
            tattoos: tattoos || null,
            piercings: piercings || null,
            comfort_levels: comfort_levels && Array.isArray(comfort_levels) && comfort_levels.length > 0 ? JSON.stringify(comfort_levels) : null,
            previous_representations: previousRepsJson,
            is_pro: false // New signups are always Free
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

      // Check if user is Studio+ to determine if we should generate social media URLs
      const isPro = existingProfile.is_pro || false;

      // Clean social media handles
      const cleanInstagramHandle = instagram_handle ? parseSocialMediaHandle(instagram_handle) : null;
      const cleanTwitterHandle = twitter_handle ? parseSocialMediaHandle(twitter_handle) : null;
      const cleanTiktokHandle = tiktok_handle ? parseSocialMediaHandle(tiktok_handle) : null;

      // Generate URLs for Studio+ users if handles are provided but URLs are not
      let finalInstagramUrl = instagram_url || null;
      let finalTwitterUrl = twitter_url || null;
      let finalTiktokUrl = tiktok_url || null;

      if (isPro) {
        // Studio+ users get URLs - generate from handles if URL not provided
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
        // Free users don't get URLs - clear any URLs that might have been provided
        finalInstagramUrl = null;
        finalTwitterUrl = null;
        finalTiktokUrl = null;
      }

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
          bio_raw: bio,
          bio_curated: curatedBio,
          specialties: specialtiesJson,
          experience_details: experienceDetailsJson,
          partner_agency_id: partnerAgencyId,
          slug,
          // New comprehensive fields
          gender: gender || null,
          date_of_birth: date_of_birth || null,
          age: age || null,
          weight_kg: weight_kg || null,
          weight_lbs: weight_lbs || null,
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
          instagram_url: finalInstagramUrl,
          twitter_handle: cleanTwitterHandle,
          twitter_url: finalTwitterUrl,
          tiktok_handle: cleanTiktokHandle,
          tiktok_url: finalTiktokUrl,
          reference_name: reference_name || null,
          reference_email: reference_email || null,
          reference_phone: reference_phone || null,
          emergency_contact_name: emergency_contact_name || null,
          emergency_contact_phone: emergency_contact_phone || null,
          emergency_contact_relationship: emergency_contact_relationship || null,
          work_eligibility: work_eligibility || null,
          work_status: (work_status === 'Other' && req.body.work_status_other) ? req.body.work_status_other : (work_status || null),
          union_membership: union_membership || null,
          ethnicity: ethnicity || null,
          tattoos: tattoos || null,
          piercings: piercings || null,
          comfort_levels: comfort_levels && Array.isArray(comfort_levels) && comfort_levels.length > 0 ? JSON.stringify(comfort_levels) : null,
          previous_representations: previousRepsJson,
          updated_at: knex.fn.now()
        });
      console.log('[Apply] Profile updated successfully:', {
        profileId: profileId,
        userId: userId,
        slug: slug,
        isPro: isPro
      });
    } else {
      // Logged-in user creating profile for first time (user already exists)
      console.log('[Apply] Creating new profile for logged-in user:', {
        userId: userId,
        name: `${first_name} ${last_name}`
      });
      const slug = await ensureUniqueSlug(knex, 'profiles', `${first_name}-${last_name}`);
      profileId = uuidv4();

      // For logged-in users creating profile, check if they're Studio+ (unlikely but possible)
      // For now, assume Free unless they already have a Studio+ profile elsewhere
      // Clean social media handles
      const cleanInstagramHandle = instagram_handle ? parseSocialMediaHandle(instagram_handle) : null;
      const cleanTwitterHandle = twitter_handle ? parseSocialMediaHandle(twitter_handle) : null;
      const cleanTiktokHandle = tiktok_handle ? parseSocialMediaHandle(tiktok_handle) : null;

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
        bio_raw: bio,
        bio_curated: curatedBio,
        specialties: specialtiesJson,
        experience_details: experienceDetailsJson,
        partner_agency_id: partnerAgencyId,
        // New comprehensive fields
        gender: gender || null,
        date_of_birth: date_of_birth || null,
        age: age || null,
        weight_kg: weight_kg || null,
        weight_lbs: weight_lbs || null,
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
        instagram_url: null, // Assume Free for new profiles
        twitter_handle: cleanTwitterHandle,
        twitter_url: null, // Assume Free for new profiles
        tiktok_handle: cleanTiktokHandle,
        tiktok_url: null, // Assume Free for new profiles
        reference_name: reference_name || null,
        reference_email: reference_email || null,
        reference_phone: reference_phone || null,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        emergency_contact_relationship: emergency_contact_relationship || null,
        work_eligibility: work_eligibility || null,
        work_status: (work_status === 'Other' && req.body.work_status_other) ? req.body.work_status_other : (work_status || null),
        union_membership: union_membership || null,
        ethnicity: ethnicity || null,
        tattoos: tattoos || null,
        piercings: piercings || null,
        comfort_levels: comfort_levels && Array.isArray(comfort_levels) && comfort_levels.length > 0 ? JSON.stringify(comfort_levels) : null,
        previous_representations: previousRepsJson,
        is_pro: false // Assume Free for new profiles
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
        title: 'Start your Pholio profile',
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
      const welcomeMessage = `🎉 Welcome to Pholio, ${first_name}! Your account has been created and your profile is ready. Upload photos to complete your comp card.`;
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
        title: 'Start your Pholio profile',
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
        title: 'Start your Pholio profile',
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
    // Redirect to success page instead of directly to dashboard
    return res.redirect(303, '/apply/success');
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
