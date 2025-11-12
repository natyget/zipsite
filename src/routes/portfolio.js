const express = require('express');
const knex = require('../db/knex');
const { toFeetInches } = require('../lib/stats');

const router = express.Router();

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

// Helper function to detect database connection errors
function isDatabaseError(error) {
  if (!error) return false;

  // Check for database connection error codes
  const dbErrorCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET'];
  if (dbErrorCodes.includes(error.code)) {
    return true;
  }

  // Check for PostgreSQL error codes
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

router.get('/portfolio/:slug', async (req, res, next) => {
  const slug = req.params.slug;
  let profile = null;
  let images = [];
  let isDemo = false;

  try {
    console.log('[Portfolio] Loading profile for slug:', slug);

    // For demo slug, ALWAYS use demo data first (works even if database is empty)
    if (slug === 'elara-k') {
      const demoData = getDemoProfile(slug);
      if (demoData) {
        console.log('[Portfolio] Using demo profile data for demo slug:', slug);
        profile = demoData.profile;
        images = demoData.images;
        isDemo = true;
      }
    }

    // Try to load from database (only if not already using demo data)
    if (!profile) {
      try {
        profile = await knex('profiles').where({ slug: slug }).first();
        if (profile) {
          images = await knex('images').where({ profile_id: profile.id }).orderBy('sort');
          console.log('[Portfolio] Profile loaded from database:', profile.slug, 'with', images.length, 'images');
        }
      } catch (dbError) {
        // If database error, check if it's a connection error and we have demo data
        if (isDatabaseError(dbError) && slug === 'elara-k') {
          console.log('[Portfolio] Database error, using demo fallback for:', slug);
          const demoData = getDemoProfile(slug);
          if (demoData) {
            profile = demoData.profile;
            images = demoData.images;
            isDemo = true;
          }
        } else {
          // Re-throw database errors that aren't handled
          throw dbError;
        }
      }
    }

    // If profile not found in database and not using demo, try demo fallback
    if (!profile && slug === 'elara-k') {
      console.log('[Portfolio] Profile not found in database, checking demo fallback');
      const demoData = getDemoProfile(slug);
      if (demoData) {
        profile = demoData.profile;
        images = demoData.images;
        isDemo = true;
        console.log('[Portfolio] Using demo profile fallback for slug:', slug);
      }
    }

    // If still no profile, return 404
    if (!profile) {
      console.log('[Portfolio] Profile not found for slug:', slug);
      return res.status(404).render('errors/404', { 
        title: 'Profile not found',
        layout: 'layout'
      });
    }

    // Render portfolio page
    res.locals.currentPage = 'portfolio';
    return res.render('portfolio/show', {
      title: `${profile.first_name} ${profile.last_name}`,
      profile,
      images,
      heightFeet: toFeetInches(profile.height_cm),
      layout: 'layout', // Portfolio is a public page, use public layout
      currentPage: 'portfolio'
    });
  } catch (error) {
    console.error('[Portfolio Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      slug: slug,
      stack: error.stack
    });

    // If it's a database error and we haven't tried demo fallback yet, try it
    if (isDatabaseError(error) && slug === 'elara-k' && !isDemo) {
      const demoData = getDemoProfile(slug);
      if (demoData) {
        console.log('[Portfolio Route] Using demo fallback in catch handler');
        res.locals.currentPage = 'portfolio';
        return res.render('portfolio/show', {
          title: `${demoData.profile.first_name} ${demoData.profile.last_name}`,
          profile: demoData.profile,
          images: demoData.images,
          heightFeet: toFeetInches(demoData.profile.height_cm),
          layout: 'layout',
          currentPage: 'portfolio'
        });
      }
    }

    return next(error);
  }
});

module.exports = router;
