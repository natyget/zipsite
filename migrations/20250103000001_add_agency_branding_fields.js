/**
 * @param {import('knex')} knex
 */
exports.up = async function up(knex) {
  await knex.schema.table('users', (table) => {
    table.string('agency_name').nullable();
    table.string('agency_logo_path').nullable();
    table.string('agency_brand_color').nullable();
  });
};

/**
 * @param {import('knex')} knex
 */
exports.down = async function down(knex) {
  await knex.schema.table('users', (table) => {
    table.dropColumn('agency_name');
    table.dropColumn('agency_logo_path');
    table.dropColumn('agency_brand_color');
  });
};

