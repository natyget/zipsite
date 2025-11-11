/**
 * @param {import('knex')} knex
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('applications', (table) => {
    table.uuid('id').primary();
    table
      .uuid('profile_id')
      .notNullable()
      .references('id')
      .inTable('profiles')
      .onDelete('CASCADE');
    table
      .uuid('agency_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .enu('status', ['pending', 'accepted', 'archived', 'declined'])
      .notNullable()
      .defaultTo('pending');
    table.timestamp('declined_at').nullable();
    table.timestamp('accepted_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Unique constraint: one application per profile per agency
    table.unique(['profile_id', 'agency_id']);
    
    // Indexes for efficient queries
    table.index('agency_id');
    table.index('profile_id');
    table.index('status');
  });
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('applications');
};

