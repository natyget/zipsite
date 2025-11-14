const express = require('express');
const { v4: uuidv4 } = require('uuid');
const knex = require('../db/knex');
const { requireRole } = require('../middleware/auth');
const config = require('../config');
const { addMessage } = require('../middleware/context');

const router = express.Router();

router.get('/pro/upgrade', requireRole('TALENT'), async (req, res, next) => {
  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    // Allow upgrade access even without profile - user can upgrade and complete profile later

    return res.render('pro/upgrade', {
      title: 'Upgrade to Pro',
      profile: profile || null,
      layout: 'layouts/dashboard'
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
