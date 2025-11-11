const { addMessage } = require('./context');

function ensureSignedIn(req) {
  return Boolean(req.session && req.session.userId);
}

function requireAuth(req, res, next) {
  if (!ensureSignedIn(req)) {
    addMessage(req, 'error', 'Please sign in to continue.');
    return res.redirect('/login');
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!ensureSignedIn(req)) {
      addMessage(req, 'error', 'Please sign in to continue.');
      return res.redirect('/login');
    }
    const userRole = req.session.role;
    if (roles.length && !roles.includes(userRole)) {
      return res.status(403).render('errors/403', { title: 'Forbidden' });
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
