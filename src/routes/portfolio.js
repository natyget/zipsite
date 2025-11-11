const express = require('express');
const knex = require('../db/knex');
const { toFeetInches } = require('../lib/stats');

const router = express.Router();

router.get('/portfolio/:slug', async (req, res, next) => {
  try {
    const profile = await knex('profiles').where({ slug: req.params.slug }).first();
    if (!profile) {
      return res.status(404).render('errors/404', { title: 'Profile not found' });
    }
    const images = await knex('images').where({ profile_id: profile.id }).orderBy('sort');
    return res.render('portfolio/show', {
      title: `${profile.first_name} ${profile.last_name}`,
      profile,
      images,
      heightFeet: toFeetInches(profile.height_cm)
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
