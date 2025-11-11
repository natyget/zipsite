# ZipSite Platform

ZipSite is an Express + SQLite/Postgres-ready application that powers the marketing site, application flow, curated dashboards, and printable comp-card PDFs.

## Requirements

- Node.js 20
- SQLite3 (bundled with Node via `sqlite3`)
- Chromium dependencies for Puppeteer (already bundled)

## Setup

```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm start
```

Default environment variables (override in `.env`):

- `PORT=3000`
- `SESSION_SECRET=change-me`
- `DB_CLIENT=sqlite3` (set to `pg` for Postgres)
- `DATABASE_URL=sqlite://./dev.sqlite3`
- `COMMISSION_RATE=0.25`
- `PDF_BASE_URL=http://localhost:3000`
- `UPLOAD_DIR=uploads`
- `MAX_UPLOAD_MB=8`

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

## Testing

The test suite exercises:

1. Authentication (login/logout)
2. Talent application -> upload -> curate -> PDF generation
3. Upgrade flow toggling `is_pro`
4. Agency commission creation when claiming + upgrading

Run with `npm test`.
