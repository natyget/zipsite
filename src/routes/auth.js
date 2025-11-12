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
router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
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

  try {
    const user = await knex('users').where({ email }).first();
    if (!user) {
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
    if (!valid) {
      res.locals.currentPage = 'login';
      return res.status(401).render('auth/login', {
        title: 'Sign in',
        values: req.body,
        errors: { email: ['Invalid credentials'] },
        layout: 'layout',
        currentPage: 'login'
      });
    }

    req.session.userId = user.id;
    req.session.role = user.role;

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
        error.message && (error.message.includes('connect') || error.message.includes('connection') || 
        error.message.includes('DATABASE_URL') || error.message.includes('database'))) {
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
        isDevelopment: process.env.NODE_ENV !== 'production'
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

  try {
    const existing = await knex('users').where({ email }).first();
    if (existing) {
      res.locals.currentPage = 'partners';
      return res.status(422).render('auth/partners', {
        title: 'Partner with ZipSite',
        values: req.body,
        errors: { email: ['That email is already registered'] },
        layout: 'layout',
        currentPage: 'partners'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Insert agency user with agency_name
    // Note: company_website field doesn't exist in schema, we'll skip it for now
    await knex('users').insert({
      id: userId,
      email,
      password_hash: passwordHash,
      role: 'AGENCY',
      agency_name: agency_name || null
    });

    req.session.userId = userId;
    req.session.role = 'AGENCY';
    addMessage(req, 'success', 'Welcome to ZipSite! Your agency account has been created.');

    return res.redirect('/dashboard/agency');
  } catch (error) {
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