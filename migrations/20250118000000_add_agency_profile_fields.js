/**
 * @param {import('knex')} knex
 */
exports.up = async function up(knex) {
  await knex.schema.table('users', (table) => {
    table.string('agency_location').nullable();
    table.string('agency_website').nullable();
    table.text('agency_description').nullable();
    table.boolean('notify_new_applications').defaultTo(true);
    table.boolean('notify_status_changes').defaultTo(true);
    table.string('default_view').nullable();
  });
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function down(knex) {
  await knex.schema.table('users', (table) => {
    table.dropColumn('agency_location');
    table.dropColumn('agency_website');
    table.dropColumn('agency_description');
    table.dropColumn('notify_new_applications');
    table.dropColumn('notify_status_changes');
    table.dropColumn('default_view');
  });
};

