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
    if (!profile) {
      addMessage(req, 'error', 'Create your profile before upgrading.');
      return res.redirect('/apply');
    }

    return res.render('pro/upgrade', {
      title: 'Upgrade to Pro',
      profile,
      layout: 'layouts/dashboard'
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
