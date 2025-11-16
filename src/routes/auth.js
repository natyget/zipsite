const express = require('express');
const { v4: uuidv4 } = require('uuid');
const knex = require('../db/knex');
const { loginSchema, agencySignupSchema } = require('../lib/validation');
const { addMessage } = require('../middleware/context');
const { ensureUniqueSlug } = require('../lib/slugify');
const { verifyIdToken, createUser: createFirebaseUser, getUserByEmail } = require('../lib/firebase-admin');
const { extractIdToken } = require('../middleware/firebase-auth');

const router = express.Router();

function redirectForRole(role) {
  if (role === 'TALENT') return '/dashboard/talent';
  if (role === 'AGENCY') return '/dashboard/agency';
  return '/';
}

function safeNext(input) {
  if (!input || typeof input !== 'string') return null;
  if (!input.startsWith('/')) return null;
  if (input.startsWith('//')) return null;
  return input;
}

// GET /login
router.get('/login', async (req, res) => {
  if (req.session && req.session.userId) {
    // If user is logged in, redirect to their dashboard
    // Dashboard routes handle empty states internally (no need to check for profile here)
    return res.redirect(redirectForRole(req.session.role));
  }
  const nextPath = safeNext(req.query.next);
  res.locals.currentPage = 'login';
  return res.render('auth/login', {
    title: 'Sign in',
    values: { next: nextPath || '' },
    errors: {},
    layout: 'layout',
    currentPage: 'login'
  });
});

// POST /login - Verify Firebase token and create session
router.post('/login', async (req, res, next) => {
  // Check body first (for form submissions), then headers/cookies
  // Support both JSON and form-encoded requests
  let idToken = null;
  let nextPath = null;
  
  // Check if request is JSON
  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
    idToken = (req.body && req.body.firebase_token) 
      ? req.body.firebase_token.trim() 
      : extractIdToken(req);
    nextPath = safeNext(req.body.next);
  } else {
    // Form-encoded request
    idToken = (req.body && req.body.firebase_token) 
      ? req.body.firebase_token.trim() 
      : extractIdToken(req);
    nextPath = safeNext(req.body.next);
  }
  
  console.log('[Login] ===== POST /login route hit =====');
  console.log('[Login] Checking for Firebase token:', {
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body).slice(0, 10) : [],
    hasBodyToken: !!(req.body && req.body.firebase_token),
    bodyTokenLength: req.body && req.body.firebase_token ? req.body.firebase_token.length : 0,
    bodyTokenPreview: req.body && req.body.firebase_token ? `${req.body.firebase_token.substring(0, 30)}...` : 'MISSING',
    extractedToken: !!extractIdToken(req),
    idToken: !!idToken,
    idTokenLength: idToken ? idToken.length : 0,
    requestUrl: req.url,
    requestMethod: req.method,
    hasEmail: !!(req.body && req.body.email),
    hasPassword: !!(req.body && req.body.password)
  });

  // If Firebase token is provided, skip email/password validation and proceed with token auth
  if (!idToken) {
    // No Firebase token - this should not happen if client-side auth is working correctly
    // The client should authenticate with Firebase first (either Google or email/password),
    // then send the Firebase token to the backend
    console.log('[Login] ⚠️ No Firebase token provided');
    console.log('[Login] Request body contents:', {
      hasEmail: !!(req.body && req.body.email),
      hasPassword: !!(req.body && req.body.password),
      hasNext: !!(req.body && req.body.next),
      bodyKeys: req.body ? Object.keys(req.body) : [],
      contentType: req.headers['content-type'],
      fullBody: req.body ? JSON.stringify(req.body, null, 2) : 'no body'
    });
    
    // If request is JSON, return JSON error response
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      return res.status(401).json({
        success: false,
        errors: {
          firebase: ['Authentication failed. Please sign in with Google or enter your email and password to continue.']
        }
      });
    }
    
    // Show helpful error message - don't require email/password validation
    // The client-side should handle authentication and send the token
    res.locals.currentPage = 'login';
    return res.status(401).render('auth/login', {
      title: 'Sign in',
      values: req.body || {},
      errors: { 
        firebase: ['Authentication failed. Please sign in with Google or enter your email and password to continue.'] 
      },
      layout: 'layout',
      currentPage: 'login'
    });
  }
  
  console.log('[Login] ✅ Firebase token found, proceeding with token authentication');

  try {
    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    if (!firebaseUid || !email) {
      console.log('[Login] Invalid token data:', { firebaseUid, email });
      
      // If request is JSON, return JSON error response
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        return res.status(401).json({
          success: false,
          errors: { email: ['Invalid authentication token.'] }
        });
      }
      
      res.locals.currentPage = 'login';
      return res.status(401).render('auth/login', {
        title: 'Sign in',
        values: req.body,
        errors: { email: ['Invalid authentication token.'] },
        layout: 'layout',
        currentPage: 'login'
      });
    }

    console.log('[Login] Firebase token verified for:', { firebaseUid, email });

    // Look up user in database by Firebase UID
    let user = await knex('users').where({ firebase_uid: firebaseUid }).first();

    // Fallback: Try to find user by email (for migration period)
    if (!user) {
      const normalizedEmail = email.toLowerCase().trim();
      user = await knex('users').where({ email: normalizedEmail }).first();
      
      // If user exists but doesn't have firebase_uid, update it
      if (user && !user.firebase_uid) {
        await knex('users').where({ id: user.id }).update({ firebase_uid: firebaseUid });
        console.log('[Login] Updated user with Firebase UID:', { userId: user.id, firebaseUid });
      }
    }

    if (!user) {
      console.log('[Login] User not found in database for Firebase UID:', firebaseUid);
      
      // If request is JSON, return JSON error response
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        return res.status(401).json({
          success: false,
          errors: { email: ['Account not found. Please sign up first.'] }
        });
      }
      
      res.locals.currentPage = 'login';
      return res.status(401).render('auth/login', {
        title: 'Sign in',
        values: req.body,
        errors: { email: ['Account not found. Please sign up first.'] },
        layout: 'layout',
        currentPage: 'login'
      });
    }

    console.log('[Login] Login successful for user:', { id: user.id, email: user.email, role: user.role });

    req.session.userId = user.id;
    req.session.role = user.role;

    // Save session before redirect
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[Login] Error saving session:', err);
          reject(err);
        } else {
          console.log('[Login] Session saved successfully');
          resolve();
        }
      });
    });

    const redirectUrl = nextPath || redirectForRole(user.role);
    console.log('[Login] Redirecting to:', redirectUrl);
    
    // If request is JSON, return JSON response with redirect URL
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      console.log('[Login] Returning JSON response with redirect:', redirectUrl);
      return res.json({ 
        success: true,
        redirect: redirectUrl 
      });
    }
    
    // Otherwise, redirect normally
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('[Login Route] Error:', {
      message: error.message,
      code: error.code,
      name: error.name
    });

    // Handle Firebase-specific errors
    const contentType = req.headers['content-type'] || '';
    const isJsonRequest = contentType.includes('application/json');
    
    if (error.message.includes('Token expired') || error.message.includes('expired')) {
      if (isJsonRequest) {
        return res.status(401).json({
          success: false,
          errors: { email: ['Your session has expired. Please sign in again.'] }
        });
      }
      
      res.locals.currentPage = 'login';
      return res.status(401).render('auth/login', {
        title: 'Sign in',
        values: req.body,
        errors: { email: ['Your session has expired. Please sign in again.'] },
        layout: 'layout',
        currentPage: 'login'
      });
    }

    if (error.message.includes('Invalid token') || error.message.includes('verification failed')) {
      if (isJsonRequest) {
        return res.status(401).json({
          success: false,
          errors: { email: ['Invalid authentication token. Please try again.'] }
        });
      }
      
      res.locals.currentPage = 'login';
      return res.status(401).render('auth/login', {
        title: 'Sign in',
        values: req.body,
        errors: { email: ['Invalid authentication token. Please try again.'] },
        layout: 'layout',
        currentPage: 'login'
      });
    }

    // For other errors, pass to error handler
    return next(error);
  }
});

// GET /signup - Redirect to /apply for talent
router.get('/signup', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect(redirectForRole(req.session.role));
  }
  // Redirect talent signups to /apply
  return res.redirect('/apply');
});

// GET /partners - Agency signup page
router.get('/partners', (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      if (req.session.role === 'AGENCY') {
        return res.redirect('/dashboard/agency');
      }
      return res.redirect('/');
    }
    res.locals.currentPage = 'partners';
    return res.render('auth/partners', {
      title: 'Partner with Pholio',
      values: {},
      errors: {},
      layout: 'layout',
      currentPage: 'partners'
    });
  } catch (error) {
    return next(error);
  }
});

// POST /partners - Agency signup (Firebase user should be created client-side first)
router.post('/partners', async (req, res, next) => {
  const parsed = agencySignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.locals.currentPage = 'partners';
    return res.status(422).render('auth/partners', {
      title: 'Partner with Pholio',
      values: req.body,
      errors: parsed.error.flatten().fieldErrors,
      layout: 'layout',
      currentPage: 'partners'
    });
  }

  const { email, agency_name, company_website, contact_name, contact_role } = parsed.data;
  const idToken = extractIdToken(req) || req.body.firebase_token;

  // Normalize email (lowercase, trim) for consistent storage and lookup
  const normalizedEmail = email.toLowerCase().trim();

  console.log('[Signup/Partners] Creating agency account for email:', normalizedEmail);

  if (!idToken) {
    console.log('[Signup/Partners] No Firebase token provided');
    res.locals.currentPage = 'partners';
    return res.status(422).render('auth/partners', {
      title: 'Partner with Pholio',
      values: req.body,
      errors: { email: ['Authentication failed. Please try again.'] },
      layout: 'layout',
      currentPage: 'partners'
    });
  }

  try {
    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const firebaseEmail = decodedToken.email;

    if (firebaseEmail.toLowerCase().trim() !== normalizedEmail) {
      console.log('[Signup/Partners] Email mismatch:', { firebaseEmail, normalizedEmail });
      res.locals.currentPage = 'partners';
      return res.status(422).render('auth/partners', {
        title: 'Partner with Pholio',
        values: req.body,
        errors: { email: ['Email does not match authenticated account.'] },
        layout: 'layout',
        currentPage: 'partners'
      });
    }

    // Check if user already exists
    let existing = await knex('users').where({ firebase_uid: firebaseUid }).first();
    if (!existing) {
      existing = await knex('users').where({ email: normalizedEmail }).first();
    }

    if (existing) {
      console.log('[Signup/Partners] User already exists:', { firebaseUid, email: normalizedEmail });
      res.locals.currentPage = 'partners';
      return res.status(422).render('auth/partners', {
        title: 'Partner with Pholio',
        values: req.body,
        errors: { email: ['That email is already registered'] },
        layout: 'layout',
        currentPage: 'partners'
      });
    }

    const userId = uuidv4();

    console.log('[Signup/Partners] Inserting agency user into database...', {
      id: userId,
      email: normalizedEmail,
      firebase_uid: firebaseUid,
      role: 'AGENCY',
      agency_name: agency_name || null
    });

    // Insert agency user with Firebase UID
    await knex('users').insert({
      id: userId,
      email: normalizedEmail,
      firebase_uid: firebaseUid,
      role: 'AGENCY',
      agency_name: agency_name || null
    });

    console.log('[Signup/Partners] Agency user created successfully:', {
      id: userId,
      email: normalizedEmail,
      role: 'AGENCY'
    });

    // Verify user was created
    const createdUser = await knex('users').where({ id: userId }).first();
    if (!createdUser) {
      console.error('[Signup/Partners] ERROR: User was not created!', { userId, email: normalizedEmail });
      throw new Error('Failed to create agency account');
    }

    req.session.userId = userId;
    req.session.role = 'AGENCY';
    
    console.log('[Signup/Partners] Setting session:', {
      userId: req.session.userId,
      role: req.session.role
    });
    
    // Save session before redirect
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[Signup/Partners] Error saving session:', err);
          reject(err);
        } else {
          console.log('[Signup/Partners] Session saved successfully');
          resolve();
        }
      });
    });
    
    addMessage(req, 'success', 'Welcome to Pholio! Your agency account has been created.');

    return res.redirect('/dashboard/agency');
  } catch (error) {
    console.error('[Signup/Partners] Error creating agency account:', {
      message: error.message,
      code: error.code,
      name: error.name
    });

    // Handle Firebase-specific errors
    if (error.message.includes('Email already exists')) {
      res.locals.currentPage = 'partners';
      return res.status(422).render('auth/partners', {
        title: 'Partner with Pholio',
        values: req.body,
        errors: { email: ['That email is already registered'] },
        layout: 'layout',
        currentPage: 'partners'
      });
    }

    return next(error);
  }
});

// POST /signup - Redirect to /apply (legacy route, kept for backward compatibility)
router.post('/signup', (req, res) => {
  return res.redirect('/apply');
});

// POST /logout
router.post('/logout', (req, res) => {
  if (!req.session) {
    return res.redirect('/');
  }
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

module.exports = router;