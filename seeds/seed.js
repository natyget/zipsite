const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

/**
 * @param {import('knex')} knex
 */
exports.seed = async function seed(knex) {
  await knex('commissions').del();
  await knex('images').del();
  await knex('profiles').del();
  await knex('users').del();

  const passwordHash = await bcrypt.hash('password123', 10);

  const agencyId = uuidv4();
  await knex('users').insert({
    id: agencyId,
    email: 'agency@example.com',
    password_hash: passwordHash,
    role: 'AGENCY'
  });

  const talentId = uuidv4();
  await knex('users').insert({
    id: talentId,
    email: 'talent@example.com',
    password_hash: passwordHash,
    role: 'TALENT'
  });

  const profileId = uuidv4();
  await knex('profiles').insert({
    id: profileId,
    user_id: talentId,
    slug: 'elara-k',
    first_name: 'Elara',
    last_name: 'Keats',
    city: 'Los Angeles, CA',
    height_cm: 177,
    measurements: '32-25-35',
    bio_raw:
      'Elara is a collaborative creative professional with a background in editorial campaigns and on-set leadership.',
    bio_curated:
      'Elara Keats brings a polished presence to every production. Based in Los Angeles, she balances editorial edge with commercial versatility.',
    hero_image_path: '/uploads/seed/elara-headshot.webp',
    partner_agency_id: agencyId
  });

  const imageBase = [
    { label: 'Headshot', file: 'elara-headshot.webp', sort: 1 },
    { label: 'Editorial', file: 'elara-editorial.webp', sort: 2 },
    { label: 'Runway', file: 'elara-runway.webp', sort: 3 }
  ];

  for (const img of imageBase) {
    await knex('images').insert({
      id: uuidv4(),
      profile_id: profileId,
      path: `/uploads/seed/${img.file}`,
      label: img.label,
      sort: img.sort
    });
  }
};
