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

router.post('/apply', upload.array('photos', 12), async (req, res, next) => {
  const isLoggedIn = Boolean(req.currentUser);
  let user = null;
  let userId = null;

  // If not logged in, validate account creation fields
  if (!isLoggedIn) {
    // Check password confirmation
    if (req.body.password !== req.body.password_confirm) {
      return res.status(422).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: req.body,
        errors: { password_confirm: ['Passwords do not match'] },
        layout: 'layout',
        isLoggedIn: false
      });
    }

    const signupParsed = signupSchema.safeParse({
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      password: req.body.password,
      role: 'TALENT'
    });

    if (!signupParsed.success) {
      const signupErrors = signupParsed.error.flatten().fieldErrors;
      const applyParsed = applyProfileSchema.safeParse(req.body);
      const applyErrors = applyParsed.success ? {} : applyParsed.error.flatten().fieldErrors;
      
      return res.status(422).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: req.body,
        errors: { ...signupErrors, ...applyErrors },
        layout: 'layout',
        isLoggedIn: false
      });
    }

    // Validate profile fields
    const applyParsed = applyProfileSchema.safeParse(req.body);
    if (!applyParsed.success) {
      return res.status(422).render('apply/index', {
        title: 'Start your ZipSite profile',
        values: req.body,
        errors: applyParsed.error.flatten().fieldErrors,
        layout: 'layout',
        isLoggedIn: false
      });
    }

    // Create account
    try {
      const existing = await knex('users').where({ email: signupParsed.data.email }).first();
      if (existing) {
        return res.status(422).render('apply/index', {
          title: 'Start your ZipSite profile',
          values: req.body,
          errors: { email: ['That email is already registered'] },
          layout: 'layout',
          isLoggedIn: false
        });
      }

      const passwordHash = await bcrypt.hash(signupParsed.data.password, 10);
      userId = uuidv4();

      await knex('users').insert({
        id: userId,
        email: signupParsed.data.email,
        password_hash: passwordHash,
        role: 'TALENT'
      });

      // Log user in
      req.session.userId = userId;
      req.session.role = 'TALENT';
      user = { id: userId, role: 'TALENT' };
      
      // Ensure session is saved before proceeding
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
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
  }

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
  } = parsed.data;

  try {

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
    if (!isLoggedIn) {
      addMessage(req, 'success', 'Welcome to ZipSite! Your profile is ready. Upload media to finish your comp card.');
    } else {
      addMessage(req, 'success', 'Application saved successfully! Upload media to finish your comp card.');
    }
    
    // Ensure session is saved with all data (userId, role, profileId) before redirect
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[Apply] Session save error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    return res.redirect(303, '/dashboard/talent');
  } catch (error) {
    console.error('[Apply] Error in POST /apply:', error);
    return next(error);
  }
});

module.exports = router;
