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

  // Clean up DATABASE_URL if it contains common mistakes (psql command, quotes, etc.)
  let cleanedUrl = process.env.DATABASE_URL.trim();

  // Try to extract connection string from common command patterns
  // Pattern 1: psql 'postgresql://...' or psql "postgresql://..." (with quotes)
  // This handles: psql 'postgresql://user:pass@host/db?param=value&param2=value2'
  let match = cleanedUrl.match(/psql\s+['"](postgres(?:ql)?:\/\/[^'"]+)['"]/i);
  if (match && match[1]) {
    cleanedUrl = match[1];
  } else {
    // Pattern 2: psql postgresql://... (without quotes)
    match = cleanedUrl.match(/psql\s+(postgres(?:ql)?:\/\/[^\s]+)/i);
    if (match && match[1]) {
      cleanedUrl = match[1];
    } else {
      // Pattern 3: Just quotes around connection string: 'postgresql://...' or "postgresql://..."
      match = cleanedUrl.match(/^['"](postgres(?:ql)?:\/\/[^'"]+)['"]$/);
      if (match && match[1]) {
        cleanedUrl = match[1];
      } else {
        // Pattern 4: Connection string might be embedded in other text, try to find it
        // Match postgresql:// or postgres:// followed by non-whitespace, non-quote characters
        match = cleanedUrl.match(/(postgres(?:ql)?:\/\/[^\s'"]+)/);
        if (match && match[1]) {
          cleanedUrl = match[1];
        }
      }
    }
  }

  // Remove surrounding quotes (single or double) if still present
  cleanedUrl = cleanedUrl.replace(/^['"]+|['"]+$/g, '');

  // Remove any leading/trailing whitespace
  cleanedUrl = cleanedUrl.trim();

  // Validate that cleaned URL looks like a PostgreSQL connection string
  if (!cleanedUrl.startsWith('postgresql://') && !cleanedUrl.startsWith('postgres://')) {
    throw new Error(
      `Invalid DATABASE_URL format. Expected postgresql:// or postgres://, got: ${process.env.DATABASE_URL.substring(0, 50)}...\n\n` +
      '❌ ERROR: Your DATABASE_URL contains invalid content.\n\n' +
      'Common mistakes:\n' +
      '1. Copied the entire psql command instead of just the connection string\n' +
      '2. Included quotes around the connection string\n' +
      '3. Included extra text or commands\n\n' +
      '✅ SOLUTION:\n' +
      '1. Go to https://console.neon.tech\n' +
      '2. Select your project\n' +
      '3. Click on "Connection Details" or "Connection String"\n' +
      '4. Look for the connection string (starts with postgresql://)\n' +
      '5. Copy ONLY the connection string, NOT the psql command\n' +
      '6. It should look like: postgresql://user:pass@host/dbname?sslmode=require\n' +
      '7. Do NOT include: psql, quotes, or any other text\n\n' +
      `What you provided: ${process.env.DATABASE_URL.substring(0, 80)}...\n\n` +
      'Example of CORRECT format:\n' +
      'postgresql://username:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'
    );
  }

  // Detect common placeholder patterns in cleaned DATABASE_URL
  const dbUrl = cleanedUrl.toLowerCase();
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

  // Update process.env with cleaned URL so it can be used throughout the application
  process.env.DATABASE_URL = cleanedUrl;
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
