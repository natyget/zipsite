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

const client = (process.env.DB_CLIENT || 'sqlite3').toLowerCase();

// Validate DATABASE_URL when using PostgreSQL
if (client === 'pg') {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL environment variable is required when DB_CLIENT=pg.\n' +
      'Please set DATABASE_URL in your environment variables.\n' +
      'Example: DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require\n' +
      'For Neon: Get your connection string from https://console.neon.tech'
    );
  }
  
  // Validate that DATABASE_URL looks like a PostgreSQL connection string
  if (!process.env.DATABASE_URL.startsWith('postgresql://') && 
      !process.env.DATABASE_URL.startsWith('postgres://')) {
    throw new Error(
      `Invalid DATABASE_URL format. Expected postgresql:// or postgres://, got: ${process.env.DATABASE_URL.substring(0, 20)}...\n` +
      'Example: DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require'
    );
  }
}

const pg = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  ...shared
};

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
