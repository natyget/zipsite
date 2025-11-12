# Netlify Database Migration Setup Guide

## Problem: Missing Database Tables

If you see errors like:
```
relation "profiles" does not exist
relation "users" does not exist
```

This means the database is connected, but the tables haven't been created yet. You need to run database migrations.

## Solution: Run Migrations

### Option 1: Use the Migration Endpoint (Recommended)

After deploying to Netlify, call the migration endpoint to create all database tables:

#### Step 1: Set Migration Secret (Optional but Recommended)

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your site → Site settings → Environment variables
3. Add a new variable:
   - Key: `MIGRATION_SECRET`
   - Value: A random secret string (generate with `openssl rand -base64 32`)
4. Save and redeploy your site

#### Step 2: Run Migrations

**Method A: Using curl (from your terminal)**

```bash
# Replace YOUR_SECRET with your migration secret (if set)
# Replace yoursite.netlify.app with your actual Netlify site URL
curl -X POST "https://yoursite.netlify.app/api/migrate?secret=YOUR_SECRET"
```

If you didn't set a migration secret, you can call it without the secret (for initial setup only):

```bash
curl -X POST "https://yoursite.netlify.app/api/migrate"
```

**Method B: Using Netlify Functions Dashboard**

1. Go to Netlify Dashboard → Your Site → Functions
2. Find the `server` function
3. Use the function's invoke URL to call the migration endpoint
4. Or use Netlify's function logs to trigger it

**Method C: Using a REST Client**

1. Use Postman, Insomnia, or any REST client
2. Make a POST request to: `https://yoursite.netlify.app/api/migrate`
3. Add query parameter: `?secret=YOUR_SECRET` (if you set a migration secret)
4. Or add header: `X-Migration-Secret: YOUR_SECRET`

#### Step 3: Verify Migrations

Check migration status:

```bash
curl "https://yoursite.netlify.app/api/migrate/status"
```

You should see:
```json
{
  "currentVersion": "20250103000002",
  "status": "up to date",
  "pending": 0,
  "list": [...]
}
```

### Option 2: Run Migrations Locally

If you have access to the Neon database from your local machine:

#### Step 1: Set Environment Variables

Create a `.env` file or set environment variables:

```bash
export DB_CLIENT=pg
export DATABASE_URL="postgresql://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

**Important**: 
- Use your actual Neon connection string
- Remove any `psql` command or quotes
- Ensure it starts with `postgresql://`
- Include `?sslmode=require` at the end

#### Step 2: Run Migrations

```bash
npm run migrate
```

You should see output like:
```
Batch 1 run: 8 migrations
```

#### Step 3: Verify Tables

Check that tables were created:

```bash
npm run test:db
```

Or check migration status:

```bash
npm run migrate:status
```

### Option 3: Run Migrations During Build (Not Recommended)

You can run migrations during the build process, but this is not recommended because:

1. Build environment may not have access to the database
2. Migrations should only run once, not on every deploy
3. Build timeouts may occur if migrations take too long

If you still want to try this, update `netlify.toml`:

```toml
[build]
  command = "npm run migrate && npm run build"
  publish = "public"
```

**Note**: This will run migrations on every deploy, which may cause issues if migrations are not idempotent.

## Migration Endpoints

### POST /api/migrate

Runs all pending migrations.

**Security**: Protected by `MIGRATION_SECRET` environment variable (optional but recommended).

**Request**:
```bash
POST /api/migrate?secret=YOUR_SECRET
```

**Response**:
```json
{
  "success": true,
  "message": "Migrations completed successfully",
  "batchNo": 1,
  "migrationsRun": 8,
  "currentVersion": "20250103000002",
  "status": "up to date",
  "log": ["20250101000000_create_tables.js", ...]
}
```

### GET /api/migrate/status

Check migration status (read-only, no secret required).

**Request**:
```bash
GET /api/migrate/status
```

**Response**:
```json
{
  "currentVersion": "20250103000002",
  "status": "up to date",
  "pending": 0,
  "list": [
    { "file": "20250101000000_create_tables.js", "batch": 1 },
    ...
  ]
}
```

## Troubleshooting

### Error: "relation does not exist"

**Cause**: Database tables haven't been created yet.

**Solution**: Run migrations using one of the methods above.

### Error: "Migration failed"

**Possible causes**:
1. Database connection issue - check `DATABASE_URL` is correct
2. Tables already exist - check migration status
3. Migration script error - check Netlify function logs

**Solution**:
1. Check Netlify function logs for detailed error messages
2. Verify `DATABASE_URL` is set correctly in Netlify environment variables
3. Check migration status: `GET /api/migrate/status`
4. Try running migrations locally if possible

### Error: "Unauthorized" when calling /api/migrate

**Cause**: Migration secret is set, but you didn't provide it.

**Solution**:
1. Check Netlify environment variables for `MIGRATION_SECRET`
2. Provide the secret in the request: `?secret=YOUR_SECRET`
3. Or temporarily remove `MIGRATION_SECRET` from environment variables (not recommended for production)

### Migrations run but tables still don't exist

**Possible causes**:
1. Migrations ran against wrong database
2. Database connection string changed
3. Migrations failed silently

**Solution**:
1. Check migration status: `GET /api/migrate/status`
2. Verify `DATABASE_URL` points to the correct database
3. Check Netlify function logs for migration errors
4. Try running migrations locally to verify they work

## After Running Migrations

Once migrations are complete:

1. ✅ All database tables should be created
2. ✅ PDF preview system should work
3. ✅ PDF download system should work
4. ✅ Dashboard should work
5. ✅ All routes should function correctly

## Next Steps

1. **Verify Tables**: Check that all tables exist using migration status endpoint
2. **Seed Database (Optional)**: Run seeds to add sample data:
   ```bash
   npm run seed
   ```
   (Note: Seeds need to be run locally or via a separate endpoint)
3. **Test Application**: Test PDF preview, download, and dashboard functionality
4. **Monitor Logs**: Check Netlify function logs for any errors

## Security Notes

- **Migration Secret**: Always set `MIGRATION_SECRET` in production to prevent unauthorized access
- **One-Time Setup**: Migrations should only be run once during initial setup
- **Production**: After migrations are complete, consider removing or restricting access to the migration endpoint
- **Backup**: Always backup your database before running migrations in production

## Quick Reference

```bash
# Check migration status
curl "https://yoursite.netlify.app/api/migrate/status"

# Run migrations (with secret)
curl -X POST "https://yoursite.netlify.app/api/migrate?secret=YOUR_SECRET"

# Run migrations (without secret - initial setup only)
curl -X POST "https://yoursite.netlify.app/api/migrate"
```

## Need Help?

- Check Netlify function logs for detailed error messages
- Verify `DATABASE_URL` is set correctly in Netlify environment variables
- Check [NEON_SETUP.md](./NEON_SETUP.md) for database setup instructions
- Review [NETLIFY_ENV_SETUP.md](./NETLIFY_ENV_SETUP.md) for environment variable setup

