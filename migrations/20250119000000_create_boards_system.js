/**
 * @param {import('knex')} knex
 */
exports.up = async function up(knex) {
  // Create boards table
  await knex.schema.createTable('boards', (table) => {
    table.uuid('id').primary();
    table
      .uuid('agency_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index('agency_id');
    table.index('is_active');
  });

  // Create board_requirements table
  await knex.schema.createTable('board_requirements', (table) => {
    table.uuid('id').primary();
    table
      .uuid('board_id')
      .notNullable()
      .references('id')
      .inTable('boards')
      .onDelete('CASCADE');
    
    // Age range
    table.integer('min_age').nullable();
    table.integer('max_age').nullable();
    
    // Height range
    table.integer('min_height_cm').nullable();
    table.integer('max_height_cm').nullable();
    
    // Gender (stored as JSON array)
    table.text('genders').nullable(); // JSON array: ["Female", "Non-binary"]
    
    // Measurements range
    table.decimal('min_bust', 5, 2).nullable();
    table.decimal('max_bust', 5, 2).nullable();
    table.decimal('min_waist', 5, 2).nullable();
    table.decimal('max_waist', 5, 2).nullable();
    table.decimal('min_hips', 5, 2).nullable();
    table.decimal('max_hips', 5, 2).nullable();
    
    // Arrays stored as JSON
    table.text('body_types').nullable(); // JSON array
    table.text('comfort_levels').nullable(); // JSON array
    table.text('experience_levels').nullable(); // JSON array
    table.text('skills').nullable(); // JSON array
    table.text('locations').nullable(); // JSON array of cities
    
    // Social reach
    table.integer('min_social_reach').nullable(); // Minimum followers
    table.string('social_reach_importance', 20).nullable(); // 'none', 'low', 'medium', 'high', 'critical'
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // One requirement set per board
    table.unique(['board_id']);
    table.index('board_id');
  });

  // Create board_scoring_weights table
  await knex.schema.createTable('board_scoring_weights', (table) => {
    table.uuid('id').primary();
    table
      .uuid('board_id')
      .notNullable()
      .references('id')
      .inTable('boards')
      .onDelete('CASCADE');
    
    // Weight sliders (0-5 scale, stored as decimal)
    table.decimal('age_weight', 3, 1).notNullable().defaultTo(0);
    table.decimal('height_weight', 3, 1).notNullable().defaultTo(0);
    table.decimal('measurements_weight', 3, 1).notNullable().defaultTo(0);
    table.decimal('body_type_weight', 3, 1).notNullable().defaultTo(0);
    table.decimal('comfort_weight', 3, 1).notNullable().defaultTo(0);
    table.decimal('experience_weight', 3, 1).notNullable().defaultTo(0);
    table.decimal('skills_weight', 3, 1).notNullable().defaultTo(0);
    table.decimal('location_weight', 3, 1).notNullable().defaultTo(0);
    table.decimal('social_reach_weight', 3, 1).notNullable().defaultTo(0);
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // One weight set per board
    table.unique(['board_id']);
    table.index('board_id');
  });

  // Create board_applications junction table
  await knex.schema.createTable('board_applications', (table) => {
    table.uuid('id').primary();
    table
      .uuid('board_id')
      .notNullable()
      .references('id')
      .inTable('boards')
      .onDelete('CASCADE');
    table
      .uuid('application_id')
      .notNullable()
      .references('id')
      .inTable('applications')
      .onDelete('CASCADE');
    table.integer('match_score').nullable(); // 0-100
    table.text('match_details').nullable(); // JSON object with score breakdown
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // One application can be in multiple boards, but only once per board
    table.unique(['board_id', 'application_id']);
    table.index('board_id');
    table.index('application_id');
    table.index('match_score'); // For sorting
  });

  // Modify applications table
  await knex.schema.table('applications', (table) => {
    table
      .uuid('board_id')
      .nullable()
      .references('id')
      .inTable('boards')
      .onDelete('SET NULL');
    table.integer('match_score').nullable(); // Cached match score (0-100)
    table.timestamp('match_calculated_at').nullable();
    
    table.index('board_id');
    table.index('match_score'); // For sorting
  });
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function down(knex) {
  // Drop modifications to applications table
  await knex.schema.table('applications', (table) => {
    table.dropIndex('match_score');
    table.dropIndex('board_id');
    table.dropColumn('match_calculated_at');
    table.dropColumn('match_score');
    table.dropColumn('board_id');
  });

  // Drop junction table
  await knex.schema.dropTableIfExists('board_applications');

  // Drop weights table
  await knex.schema.dropTableIfExists('board_scoring_weights');

  // Drop requirements table
  await knex.schema.dropTableIfExists('board_requirements');

  // Drop boards table
  await knex.schema.dropTableIfExists('boards');
};

