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
          const profile = await knex('profiles').where({ user_id: user.id }).first();
          if (profile) {
            req.currentProfile = profile;
            res.locals.currentProfile = profile;
          }
        }
      }
    } catch (error) {
      return next(error);
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
