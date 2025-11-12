const knex = require('../db/knex');

async function attachLocals(req, res, next) {
  res.locals.currentUser = null;
  res.locals.currentProfile = null;
  if (typeof res.locals.isDashboard === 'undefined') {
    res.locals.isDashboard = false;
  }

  if (req.session && req.session.userId) {
    try {
      const user = await knex('users').where({ id: req.session.userId }).first();
      if (user) {
        req.currentUser = user;
        res.locals.currentUser = { id: user.id, role: user.role, email: user.email };
        if (user.role === 'TALENT') {
          try {
            const profile = await knex('profiles').where({ user_id: user.id }).first();
            if (profile) {
              req.currentProfile = profile;
              res.locals.currentProfile = profile;
            }
          } catch (profileError) {
            // Log profile query error but don't fail the request
            // This allows the app to continue even if profile query fails
            console.error('[attachLocals] Error loading profile:', profileError.message);
          }
        }
      }
    } catch (error) {
      // Check if it's a database connection error
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNRESET' || error.message && (
            error.message.includes('connect') || 
            error.message.includes('connection') || 
            error.message.includes('DATABASE_URL') || 
            error.message.includes('database') ||
            error.message.includes('Cannot find module \'pg\'') ||
            error.message.includes('Knex: run')
          )) {
        // Log database connection error but don't fail the request for non-dashboard routes
        // Dashboard routes will handle their own database errors
        console.error('[attachLocals] Database connection error:', error.message);
        // For dashboard routes, let the error propagate so it can be handled properly
        if (req.path && req.path.startsWith('/dashboard')) {
          return next(error);
        }
        // For other routes, continue without user data
        // This allows public pages to still work even if database is down
      } else {
        // For other errors, pass to error handler
        return next(error);
      }
    }
  }

  res.locals.messages = req.session?.messages || [];
  if (req.session) {
    req.session.messages = [];
  }

  next();
}

function addMessage(req, type, text) {
  if (!req.session) return;
  if (!req.session.messages) {
    req.session.messages = [];
  }
  req.session.messages.push({ type, text });
}

module.exports = {
  attachLocals,
  addMessage
};
