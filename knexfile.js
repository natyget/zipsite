require('dotenv').config();

const shared = {
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations'
  },
  seeds: {
    directory: './seeds'
  }
};

const sqlite = {
  client: 'sqlite3',
  connection: {
    filename: process.env.DATABASE_URL?.replace('sqlite://', '') || './dev.sqlite3'
  },
  useNullAsDefault: true,
  ...shared
};

const pg = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  ...shared
};

const client = (process.env.DB_CLIENT || 'sqlite3').toLowerCase();

module.exports = client === 'pg' ? pg : sqlite;
