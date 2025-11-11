const express = require('express');
const { v4: uuidv4 } = require('uuid');
const knex = require('../db/knex');
const { upload, processImage } = require('../lib/uploader');
const { requireRole } = require('../middleware/auth');
const { cleanString } = require('../lib/sanitize');

const router = express.Router();

router.post('/upload', requireRole('TALENT'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File required' });
    }

    const storedPath = await processImage(req.file.path);
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const countResult = await knex('images')
      .where({ profile_id: profile.id })
      .count({ total: '*' })
      .first();
    const nextSort = Number(countResult?.total || 0) + 1;
    const label = cleanString(req.body.label) || 'Portfolio image';

    await knex('images').insert({
      id: uuidv4(),
      profile_id: profile.id,
      path: storedPath,
      label,
      sort: nextSort
    });

    if (!profile.hero_image_path) {
      await knex('profiles').where({ id: profile.id }).update({ hero_image_path: storedPath });
    }

    return res.json({ ok: true, path: storedPath });
  } catch (error) {
    return next(error);
  }
});

router.post('/media/reorder', requireRole('TALENT'), async (req, res, next) => {
  const order = Array.isArray(req.body.order) ? req.body.order : [];
  if (!order.length) {
    return res.status(400).json({ error: 'Order is required' });
  }

  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const images = await knex('images').where({ profile_id: profile.id });
    const allowedIds = new Set(images.map((image) => image.id));
    if (order.some((id) => !allowedIds.has(id))) {
      return res.status(400).json({ error: 'Invalid media selection' });
    }

    await knex.transaction(async (trx) => {
      await Promise.all(
        order.map((id, index) =>
          trx('images')
            .where({ id })
            .update({ sort: index + 1 })
        )
      );
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/media/:id/delete', requireRole('TALENT'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const image = await knex('images').where({ id, profile_id: profile.id }).first();
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    await knex.transaction(async (trx) => {
      await trx('images').where({ id }).delete();

      const remaining = await trx('images').where({ profile_id: profile.id }).orderBy('sort');
      await Promise.all(
        remaining.map((item, index) =>
          trx('images')
            .where({ id: item.id })
            .update({ sort: index + 1 })
        )
      );

      if (profile.hero_image_path === image.path) {
        const nextHero = remaining[0]?.path || null;
        await trx('profiles').where({ id: profile.id }).update({ hero_image_path: nextHero });
      }
    });

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/media/:id/label', requireRole('TALENT'), async (req, res, next) => {
  const { id } = req.params;
  const label = cleanString(req.body.label || '').slice(0, 80);
  if (!label) {
    return res.status(400).json({ error: 'Label required' });
  }

  try {
    const profile = await knex('profiles').where({ user_id: req.session.userId }).first();
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const updated = await knex('images')
      .where({ id, profile_id: profile.id })
      .update({ label });

    if (!updated) {
      return res.status(404).json({ error: 'Image not found' });
    }

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
