# Quick Fix: Run Database Migrations

## Your Current Issue

✅ **Database Connection**: Working (connects to Neon successfully)  
❌ **Database Tables**: Missing (need to run migrations)  
🔧 **Solution**: Run migrations to create all database tables

## Quick Fix (Choose One Method)

### Method 1: Call Migration Endpoint (Easiest)

**Step 1**: Get your Netlify site URL
- Go to your Netlify dashboard
- Find your site URL (e.g., `https://yoursite.netlify.app`)

**Step 2**: Call the migration endpoint

```bash
# Replace YOURSITE.netlify.app with your actual site URL
curl -X POST "https://YOURSITE.netlify.app/api/migrate"
```

**Step 3**: Verify migrations completed

```bash
# Check migration status
curl "https://YOURSITE.netlify.app/api/migrate/status"
```

You should see:
```json
{
  "currentVersion": "20250103000002",
  "status": "up to date",
  "pending": 0
}
```

### Method 2: Run Migrations Locally (Alternative)

**Step 1**: Set your Neon connection string

```bash
export DATABASE_URL="postgresql://neondb_owner:npg_qviTLhP35tWO@ep-cold-moon-a4bwyid7-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require"
export DB_CLIENT=pg
```

**Step 2**: Run migrations

```bash
npm run migrate
```

You should see:
```
Batch 1 run: 8 migrations
```

**Step 3**: Verify migrations

```bash
npm run migrate:status
```

### Method 3: Use the Migration Scripts

**For Netlify endpoint:**
```bash
./scripts/run-migrations-netlify.sh
```

**For local migrations:**
```bash
./scripts/run-migrations-local.sh
```

## After Running Migrations

✅ All database tables will be created  
✅ PDF preview system will work  
✅ PDF download system will work  
✅ Dashboard will work  
✅ All routes will function correctly

## Verify Everything Works

1. **Check migration status**:
   ```bash
   curl "https://YOURSITE.netlify.app/api/migrate/status"
   ```

2. **Test PDF preview**:
   - Visit: `https://YOURSITE.netlify.app/pdf/view/elara-k`
   - Should show PDF preview (or error if profile doesn't exist)

3. **Test PDF download**:
   - Visit: `https://YOURSITE.netlify.app/pdf/elara-k`
   - Should download PDF (or error if profile doesn't exist)

4. **Test dashboard**:
   - Visit: `https://YOURSITE.netlify.app/dashboard/talent`
   - Should show dashboard (or login page)

## Troubleshooting

### Error: "Unauthorized" when calling /api/migrate

**Cause**: Migration secret is set in Netlify, but you didn't provide it.

**Solution**:
1. Check Netlify environment variables for `MIGRATION_SECRET`
2. Provide it in the request: `?secret=YOUR_SECRET`
3. Or temporarily remove `MIGRATION_SECRET` from environment variables (not recommended for production)

### Error: "Migration failed"

**Possible causes**:
1. Database connection issue
2. Migration script error
3. Tables already exist

**Solution**:
1. Check Netlify function logs for detailed error messages
2. Verify `DATABASE_URL` is set correctly in Netlify environment variables
3. Check migration status: `GET /api/migrate/status`

### Migrations run but tables still don't exist

**Possible causes**:
1. Migrations ran against wrong database
2. Database connection string changed
3. Migrations failed silently

**Solution**:
1. Check migration status: `GET /api/migrate/status`
2. Verify `DATABASE_URL` points to the correct database
3. Check Netlify function logs for migration errors

## Next Steps

1. ✅ Run migrations using one of the methods above
2. ✅ Verify migrations completed successfully
3. ✅ Test PDF preview, download, and dashboard
4. ✅ Set `MIGRATION_SECRET` in Netlify environment variables (optional but recommended)
5. ✅ Monitor Netlify function logs for any errors

## Need Help?

- Check [NETLIFY_MIGRATION_SETUP.md](./NETLIFY_MIGRATION_SETUP.md) for detailed instructions
- Review Netlify function logs for error messages
- Verify `DATABASE_URL` is set correctly in Netlify environment variables

