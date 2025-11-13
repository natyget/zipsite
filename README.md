# ZipSite Platform

ZipSite is an Express + SQLite/Postgres-ready application that powers the marketing site, application flow, curated dashboards, and printable comp-card PDFs.

## Requirements

- Node.js 20
- SQLite3 (bundled with Node via `sqlite3`) - for local development only
- PostgreSQL client (`pg`) - for production and Neon
- Chromium dependencies for Puppeteer (already bundled)

## Quick Start

### Local Development (SQLite)

```bash
npm install
npm run migrate
npm run seed
npm start
```

### Production/Serverless (Neon PostgreSQL)

**🚀 Quick Start:** See [NEON_QUICKSTART.md](./NEON_QUICKSTART.md) for a 5-minute setup guide.

**👉 Detailed Guide:** See [NEON_SETUP.md](./NEON_SETUP.md) for comprehensive Neon setup instructions.

**Quick setup using the setup script:**
```bash
./scripts/setup-neon.sh
```

**Or manual setup:**
1. Create a Neon database at [neon.tech](https://neon.tech)
2. Copy your connection string from Neon dashboard
3. Create `.env` file with:
   ```env
   DB_CLIENT=pg
   DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
   SESSION_SECRET=your-random-secret-here
   ```
4. Run migrations: `npm run migrate`
5. (Optional) Seed data: `npm run seed`
6. Start server: `npm start`

## Database Setup

### SQLite (Local Development)

Default configuration uses SQLite for local development:

```env
DB_CLIENT=sqlite3
DATABASE_URL=sqlite://./dev.sqlite3
```

### PostgreSQL/Neon (Production)

For production and serverless environments, use PostgreSQL:

```env
DB_CLIENT=pg
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

**Recommended:** Use [Neon](https://neon.tech) for a free, serverless Postgres database. See [NEON_SETUP.md](./NEON_SETUP.md) for complete setup guide.

## Environment Variables

Default environment variables (override in `.env`):

- `PORT=3000` - Server port
- `SESSION_SECRET=change-me` - Session encryption secret (generate with `openssl rand -base64 32`)
- `DB_CLIENT=sqlite3` - Database client (`sqlite3` for local, `pg` for Postgres/Neon)
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_PRIVATE_KEY` - Firebase service account private key (from Firebase Console > Project Settings > Service Accounts)
- `FIREBASE_CLIENT_EMAIL` - Firebase service account client email
- `FIREBASE_CLIENT_ID` - Firebase service account client ID
- `FIREBASE_AUTH_DOMAIN` - Firebase auth domain (typically `{project-id}.firebaseapp.com`)
- `FIREBASE_API_KEY` - Firebase Web API key (from Firebase Console > Project Settings > General > Your apps)

See `.env.example` for a complete example configuration.
- `DATABASE_URL` - Database connection string
  - SQLite: `sqlite://./dev.sqlite3`
  - Postgres/Neon: `postgresql://user:password@host:5432/dbname?sslmode=require`
- `COMMISSION_RATE=0.25` - Agency commission rate (25%)
- `PDF_BASE_URL=http://localhost:3000` - Base URL for PDF generation
- `UPLOAD_DIR=uploads` - Upload directory (defaults to `/tmp` in serverless)
- `MAX_UPLOAD_MB=8` - Maximum file upload size in MB
- `NODE_ENV=development` - Environment mode

### Sample accounts

- Talent: `talent@example.com` / `password123`
- Agency: `agency@example.com` / `password123`

Uploaded demo assets live at `/uploads/seed`.

## Scripts

- `npm start` – launch the Express server
- `npm run dev` – start the server with nodemon
- `npm run migrate` – apply database migrations via Knex
- `npm run seed` – load seed data
- `npm test` – run API integration tests with Jest + Supertest
- `npm run test:db` – test Neon/PostgreSQL database connection

## Testing

The test suite exercises:

1. Authentication (login/logout)
2. Talent application -> upload -> curate -> PDF generation
3. Upgrade flow toggling `is_pro`
4. Agency commission creation when claiming + upgrading

Run with `npm test`.

## Database Migration

The application uses Knex.js for database migrations. Migrations are located in the `migrations/` directory.

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Make sure DB_CLIENT and DATABASE_URL are set correctly
export DB_CLIENT=pg
export DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
npm run migrate
```

### Database Providers

- **Local Development**: SQLite3 (no setup required)
- **Production/Serverless**: 
  - [Neon](https://neon.tech) (Recommended - see [NEON_SETUP.md](./NEON_SETUP.md))
  - [Supabase](https://supabase.com)
  - [Railway](https://railway.app)
  - [Render](https://render.com)
  - Any PostgreSQL database

## Deployment

- **Neon Database Setup**: 
  - Quick start: [NEON_QUICKSTART.md](./NEON_QUICKSTART.md)
  - Detailed guide: [NEON_SETUP.md](./NEON_SETUP.md)
- **Netlify Deployment**: See [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md)
