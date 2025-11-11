# Netlify Deployment Guide

This guide explains how to deploy ZipSite to Netlify and configure the necessary environment variables.

## Prerequisites

1. **PostgreSQL Database**: Netlify Functions run in a serverless environment where SQLite3 is not available. You need a PostgreSQL database.

   Recommended options:
   - [Supabase](https://supabase.com) (free tier available)
   - [Neon](https://neon.tech) (free tier available)
   - [Railway](https://railway.app) (free tier available)
   - [Render](https://render.com) (free tier available)
   - [AWS RDS](https://aws.amazon.com/rds/) (paid)
   - [Netlify Postgres](https://www.netlify.com/products/addons/postgres/) (paid addon)

2. **Netlify Account**: Sign up at [netlify.com](https://www.netlify.com)

## Environment Variables

Configure the following environment variables in your Netlify site settings:

### Required Variables

1. **`DB_CLIENT`**
   - Value: `pg`
   - Description: Database client to use. Must be `pg` for PostgreSQL in serverless environments.

2. **`DATABASE_URL`**
   - Value: Your PostgreSQL connection string
   - Example: `postgresql://user:password@host:5432/database?sslmode=require`
   - Description: Full PostgreSQL connection URL. Get this from your database provider.

3. **`SESSION_SECRET`**
   - Value: A random secret string (generate with `openssl rand -base64 32`)
   - Description: Secret key for encrypting session cookies. Use a strong, random value.

4. **`NODE_ENV`**
   - Value: `production`
   - Description: Sets the application to production mode.

### Optional Variables

5. **`PDF_BASE_URL`**
   - Value: Your Netlify site URL (e.g., `https://yoursite.netlify.app`)
   - Description: Base URL for PDF generation. If not set, will use Netlify's `URL` environment variable or default to `http://localhost:3000`.

6. **`SESSION_SECRET`** (if not set above)
   - Value: A random secret string
   - Description: Required for session management. Set a strong, random value.

7. **`COMMISSION_RATE`**
   - Value: `0.25` (default)
   - Description: Commission rate for agency transactions.

8. **`MAX_UPLOAD_MB`**
   - Value: `8` (default)
   - Description: Maximum upload size in megabytes.

9. **`UPLOAD_DIR`**
   - Value: (optional, defaults to `/tmp/zipsite-uploads` in serverless)
   - Description: Directory for file uploads. In serverless, files are stored in `/tmp` and are temporary.

## Database Setup

### 1. Create Database

Create a PostgreSQL database using your preferred provider and note the connection string.

### 2. Run Migrations

Before deploying, run database migrations:

```bash
# Set your DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
export DB_CLIENT="pg"

# Run migrations
npm run migrate

# (Optional) Run seeds for development data
npm run seed
```

Alternatively, you can run migrations after deployment using Netlify's build command or a one-time migration script.

### 3. Update Netlify Build Command (Optional)

If you want to run migrations during deployment, update your `netlify.toml`:

```toml
[build]
  command = "npm run migrate && npm run build"
  publish = "public"
```

**Note**: This runs migrations on every deploy. For production, consider running migrations separately or using a migration service.

## File Uploads

### Current Limitation

The current implementation stores uploaded files in `/tmp` directory in serverless environments. **Files in `/tmp` are deleted after each function execution**, so uploaded files will not persist.

### Solution: Cloud Storage Integration

For production, you need to integrate cloud storage:

1. **Netlify Blob Storage** (Recommended for Netlify)
   - Add Netlify Blob addon to your site
   - Update upload handler to use Blob storage API

2. **AWS S3**
   - Create an S3 bucket
   - Configure AWS credentials in Netlify
   - Update upload handler to upload to S3
   - Update image paths to use S3 URLs

3. **Other Cloud Storage**
   - Cloudinary, ImageKit, or similar services
   - Update upload handler accordingly

### Temporary Workaround

For development/testing, you can:
- Use Netlify's local development server (`netlify dev`)
- Files will be stored locally and persist between requests
- This is not suitable for production

## Function Configuration

The `netlify.toml` file includes function configuration, but you may need to set timeout and memory in the Netlify UI:

1. Go to Site settings > Functions
2. Set function timeout: 26 seconds (Pro tier) or 10 seconds (Free tier)
3. Set function memory: 3008 MB (Pro tier) or 1024 MB (Free tier)

**Note**: 
- Puppeteer (used for PDF generation) requires significant memory and time
- The free tier (10s timeout, 1024 MB memory) may not be sufficient for PDF generation
- Consider upgrading to Pro tier for production use
- Alternative: Use a separate service for PDF generation if free tier limitations are an issue

## Deployment Steps

1. **Connect Repository**
   - Go to Netlify dashboard
   - Click "New site from Git"
   - Connect your repository

2. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `public`
   - These should be automatically detected from `netlify.toml`

3. **Set Environment Variables**
   - Go to Site settings > Environment variables
   - Add all required variables (see above)

4. **Deploy**
   - Netlify will automatically deploy on push to your main branch
   - Or click "Deploy site" to deploy manually

5. **Verify Deployment**
   - Check function logs for any errors
   - Test the application functionality
   - Verify database connections

## Troubleshooting

### SQLite3 Error

If you see "Cannot find module 'sqlite3'":
- Ensure `DB_CLIENT=pg` is set in environment variables
- Verify `DATABASE_URL` is correctly formatted
- Check that `sqlite3` is in `optionalDependencies` (it should be after our changes)

### PostgreSQL Module Error (Cannot find module 'pg')

If you see "Cannot find module 'pg'" or "Knex: run $ npm install pg --save":
- **Verify `pg` is in dependencies**: Check that `pg` is listed in `package.json` under `dependencies` (not `devDependencies`)
- **Check bundler configuration**: The `netlify.toml` should use `node_bundler = "nft"` for better native module support
- **Verify build process**: Ensure Netlify is installing dependencies correctly
  - Check build logs to confirm `npm install` runs successfully
  - Verify that `pg` is being installed (look for "pg@8.12.0" in build logs)
- **Native module compatibility**: `pg` is a native module with C++ bindings
  - Ensure Node.js version matches (set `NODE_VERSION = "20"` in `netlify.toml`)
  - Native modules must be compiled for the correct platform (Netlify handles this automatically)
- **Solution steps**:
  1. Verify `package.json` has `"pg": "8.12.0"` in `dependencies`
  2. Commit and push changes to trigger a new build
  3. Check Netlify build logs for installation errors
  4. If issues persist, try removing `node_bundler` from `netlify.toml` to use default bundler
  5. Ensure `package-lock.json` is committed to repository (helps with consistent installs)

### Database Connection Error

If you see database connection errors:

**Error: `connect ECONNREFUSED 127.0.0.1:5432`**
- This means environment variables are not set correctly
- **Solution**: See [NETLIFY_ENV_SETUP.md](./NETLIFY_ENV_SETUP.md) for detailed setup instructions
- Verify `DB_CLIENT=pg` is set in Netlify environment variables
- Verify `DATABASE_URL` is set with your Neon connection string
- Ensure you redeployed after setting environment variables

**Other connection errors:**
- Verify `DATABASE_URL` is correct and includes `?sslmode=require`
- Check that your database allows connections from Netlify's IPs
- Ensure SSL is enabled if required (`?sslmode=require`)
- Verify your Neon database is active (not paused)
- Check Neon dashboard for connection issues

### Puppeteer/PDF Generation Issues

If PDF generation fails:
- Check function logs for memory/timeout errors
- Verify function has enough memory (may need Pro tier)
- Ensure `PDF_BASE_URL` is set correctly
- Check that Puppeteer args are compatible with serverless environment

### File Upload Issues

If file uploads don't work:
- Remember that files in `/tmp` are temporary in serverless
- Implement cloud storage integration for production
- Check function logs for upload errors

### Static Files Not Loading

If CSS/JS files aren't loading:
- Verify `public` directory is set as publish directory
- Check that static files are in the `public` directory
- Ensure redirects in `netlify.toml` are correct

## Additional Resources

- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Netlify Environment Variables](https://docs.netlify.com/environment-variables/overview/)
- [Netlify Blob Storage](https://docs.netlify.com/blobs/overview/)
- [Puppeteer Serverless Guide](https://pptr.dev/guides/configuration)

## Support

For issues specific to this deployment:
1. Check function logs in Netlify dashboard
2. Review environment variables configuration
3. Verify database connection and migrations
4. Check Netlify status page for service issues
