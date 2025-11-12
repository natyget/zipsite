const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const knex = require('../db/knex');
const { loginSchema, signupSchema, agencySignupSchema } = require('../lib/validation');
const { addMessage } = require('../middleware/context');
const { ensureUniqueSlug } = require('../lib/slugify');

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
    // If user is logged in, check if they have a profile
    // If TALENT user without profile, redirect to /apply
    if (req.session.role === 'TALENT') {
      try {
        const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
        if (!profile) {
          return res.redirect('/apply');
        }
      } catch (error) {
        // If database error, still redirect to dashboard (it will handle the error)
        console.error('[Login] Error checking profile:', error);
      }
    }
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

// POST /login
router.post('/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log('[Login] Validation failed:', parsed.error.flatten().fieldErrors);
    res.locals.currentPage = 'login';
    return res.status(422).render('auth/login', {
      title: 'Sign in',
      values: req.body,
      errors: parsed.error.flatten().fieldErrors,
      layout: 'layout',
      currentPage: 'login'
    });
  }

  const { email, password } = parsed.data;
  const nextPath = safeNext(req.body.next);

  // Normalize email (lowercase, trim)
  const normalizedEmail = email.toLowerCase().trim();

  console.log('[Login] Attempting login for email:', normalizedEmail);

  try {
    const user = await knex('users').where({ email: normalizedEmail }).first();
    
    if (!user) {
      console.log('[Login] User not found for email:', normalizedEmail);
      // Also check if there are any users in the database (for debugging)
      const userCount = await knex('users').count('id as count').first();
      console.log('[Login] Total users in database:', userCount?.count || 0);
      
      res.locals.currentPage = 'login';
      return res.status(401).render('auth/login', {
        title: 'Sign in',
        values: req.body,
        errors: { email: ['Invalid credentials'] },
        layout: 'layout',
        currentPage: 'login'
      });
    }

    console.log('[Login] User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      hasPasswordHash: !!user.password_hash,
      passwordHashLength: user.password_hash?.length || 0
    });

    if (!user.password_hash) {
      console.error('[Login] User has no password hash!', { userId: user.id, email: user.email });
      res.locals.currentPage = 'login';
      return res.status(401).render('auth/login', {
        title: 'Sign in',
        values: req.body,
        errors: { email: ['Invalid credentials'] },
        layout: 'layout',
        currentPage: 'login'
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    console.log('[Login] Password comparison result:', valid);
    
    if (!valid) {
      console.log('[Login] Invalid password for email:', normalizedEmail);
      res.locals.currentPage = 'login';
      return res.status(401).render('auth/login', {
        title: 'Sign in',
        values: req.body,
        errors: { email: ['Invalid credentials'] },
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

    return res.redirect(nextPath || redirectForRole(user.role));
  } catch (error) {
    // Log database connection errors for debugging
    console.error('[Login Route] Database error:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    
    // Check if it's a database connection error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNRESET' || error.code === '42P01' || error.code === '42P07' || 
        error.code === '3D000' || error.code === '28P01' ||
        error.message && (error.message.includes('connect') || error.message.includes('connection') || 
        error.message.includes('DATABASE_URL') || error.message.includes('database') ||
        error.message.includes('relation') || error.message.includes('does not exist'))) {
      console.error('[Login Route] Database connection error detected');
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
      title: 'Partner with ZipSite',
      values: {},
      errors: {},
      layout: 'layout',
      currentPage: 'partners'
    });
  } catch (error) {
    return next(error);
  }
});

// POST /partners - Agency signup
router.post('/partners', async (req, res, next) => {
  const parsed = agencySignupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.locals.currentPage = 'partners';
    return res.status(422).render('auth/partners', {
      title: 'Partner with ZipSite',
      values: req.body,
      errors: parsed.error.flatten().fieldErrors,
      layout: 'layout',
      currentPage: 'partners'
    });
  }

  const { email, password, agency_name, company_website, contact_name, contact_role } = parsed.data;

  // Normalize email (lowercase, trim) for consistent storage and lookup
  const normalizedEmail = email.toLowerCase().trim();

  console.log('[Signup/Partners] Creating agency account for email:', normalizedEmail);

  try {
    const existing = await knex('users').where({ email: normalizedEmail }).first();
    if (existing) {
      console.log('[Signup/Partners] Email already exists:', normalizedEmail);
      res.locals.currentPage = 'partners';
      return res.status(422).render('auth/partners', {
        title: 'Partner with ZipSite',
        values: req.body,
        errors: { email: ['That email is already registered'] },
        layout: 'layout',
        currentPage: 'partners'
      });
    }

    console.log('[Signup/Partners] Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    console.log('[Signup/Partners] Inserting agency user into database...', {
      id: userId,
      email: normalizedEmail,
      role: 'AGENCY',
      agency_name: agency_name || null,
      hasPasswordHash: !!passwordHash,
      passwordHashLength: passwordHash?.length || 0
    });

    // Insert agency user with agency_name
    // Note: company_website field doesn't exist in schema, we'll skip it for now
    await knex('users').insert({
      id: userId,
      email: normalizedEmail,
      password_hash: passwordHash,
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

    console.log('[Signup/Partners] User verified in database:', {
      id: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
      hasPasswordHash: !!createdUser.password_hash,
      passwordHashLength: createdUser.password_hash?.length || 0
    });

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
    
    addMessage(req, 'success', 'Welcome to ZipSite! Your agency account has been created.');

    return res.redirect('/dashboard/agency');
  } catch (error) {
    console.error('[Signup/Partners] Error creating agency account:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
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