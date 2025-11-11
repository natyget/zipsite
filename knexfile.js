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

// Check if sqlite3 is requested and available
if (client === 'sqlite3') {
  try {
    require.resolve('sqlite3');
  } catch (err) {
    throw new Error(
      'SQLite3 is not available. This is expected in serverless environments.\n' +
      'Please set DB_CLIENT=pg and provide a DATABASE_URL for PostgreSQL, or install sqlite3 locally for development.\n' +
      'Example: DB_CLIENT=pg DATABASE_URL=postgresql://user:pass@host:5432/dbname'
    );
  }
}

module.exports = client === 'pg' ? pg : sqlite;
