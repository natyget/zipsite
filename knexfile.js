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
  
  // Detect common placeholder patterns in DATABASE_URL
  const dbUrl = process.env.DATABASE_URL.toLowerCase();
  const placeholderPatterns = [
    'host.neon.tech',
    'your-host.neon.tech',
    'example.com',
    'localhost',
    '127.0.0.1',
    'placeholder',
    'your-database',
    'your-host'
  ];
  
  const containsPlaceholder = placeholderPatterns.some(pattern => dbUrl.includes(pattern));
  
  if (containsPlaceholder) {
    throw new Error(
      'DATABASE_URL contains a placeholder value instead of your actual Neon connection string.\n\n' +
      '❌ ERROR: You used a placeholder like "host.neon.tech" instead of your real database hostname.\n\n' +
      '✅ SOLUTION:\n' +
      '1. Go to https://console.neon.tech\n' +
      '2. Select your project\n' +
      '3. Click on "Connection Details" or "Connection String"\n' +
      '4. Copy the COMPLETE connection string (it will have a unique hostname like "ep-xxx-xxx.us-east-2.aws.neon.tech")\n' +
      '5. Paste the REAL connection string in Netlify environment variables\n' +
      '6. Make sure it includes ?sslmode=require at the end\n\n' +
      `Current DATABASE_URL starts with: ${process.env.DATABASE_URL.substring(0, 50)}...\n\n` +
      'Your real Neon connection string should look like:\n' +
      'postgresql://username:password@ep-xxx-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'
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
