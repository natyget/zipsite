const express = require('express');
const knex = require('../db/knex');
const { toFeetInches } = require('../lib/stats');

const router = express.Router();

router.get('/portfolio/:slug', async (req, res, next) => {
  try {
    const profile = await knex('profiles').where({ slug: req.params.slug }).first();
    if (!profile) {
      return res.status(404).render('errors/404', { 
        title: 'Profile not found',
        layout: 'layout'
      });
    }
    const images = await knex('images').where({ profile_id: profile.id }).orderBy('sort');
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
    return next(error);
  }
});

module.exports = router;
