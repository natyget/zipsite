/**
 * @param {import('knex')} knex
 */
exports.up = async function up(knex) {
  await knex.schema.table('users', (table) => {
    // Add Firebase UID column for Firebase Authentication
    table.string('firebase_uid', 128).nullable().unique();
    // Make password_hash nullable to support migration period
    // Existing users can still use bcrypt passwords until migrated
    table.string('password_hash').nullable().alter();
    // Add index on firebase_uid for faster lookups
    table.index('firebase_uid');
  });
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function down(knex) {
  await knex.schema.table('users', (table) => {
    // Remove Firebase UID column
    table.dropIndex('firebase_uid');
    table.dropColumn('firebase_uid');
    // Restore password_hash as not nullable (will fail if any null values exist)
    // In production, would need to handle this more carefully
    table.string('password_hash').notNullable().alter();
  });
};

