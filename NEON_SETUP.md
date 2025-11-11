# Neon Database Setup Guide

This guide will help you set up and connect ZipSite to a Neon PostgreSQL database.

## What is Neon?

[Neon](https://neon.tech) is a serverless Postgres database that automatically scales to zero when not in use, making it perfect for development and production applications. It offers:

- **Free tier** with generous limits
- **Serverless architecture** - scales automatically
- **Branching** - create database branches like Git branches
- **Automatic backups** and point-in-time recovery
- **Web dashboard** for easy management

## Prerequisites

- A Neon account (sign up at [neon.tech](https://neon.tech))
- Node.js 20+ installed
- This project cloned and dependencies installed (`npm install`)

## Step 1: Create a Neon Database

### Option A: Using Neon Dashboard (Recommended)

1. **Sign up or Log in**
   - Go to [console.neon.tech](https://console.neon.tech)
   - Sign up for a free account (or log in if you already have one)

2. **Create a New Project**
   - Click "Create a project" or "New Project"
   - Choose a project name (e.g., "zipsite")
   - Select a region closest to your users
   - Choose PostgreSQL version (15 or 16 recommended)
   - Click "Create project"

3. **Get Your Connection String**
   - Once the project is created, you'll see the connection details
   - Copy the connection string (it looks like: `postgresql://user:password@host.neon.tech/dbname?sslmode=require`)
   - **Important**: Neon requires SSL, so make sure `sslmode=require` is in your connection string

### Option B: Using Neon CLI (Optional)

If you prefer using the command line:

```bash
# Install Neon CLI
npm install -g neonctl

# Login to Neon
neonctl auth

# Create a new project and branch
neonctl projects create --name zipsite
neonctl branches create --project-id <project-id> --name main
```

## Step 2: Configure Environment Variables

### Option A: Using the Setup Script (Recommended)

The easiest way to set up your Neon connection is using the provided setup script:

```bash
./scripts/setup-neon.sh
```

This script will:
- Prompt you for your Neon connection string
- Generate a secure session secret
- Create a `.env` file with all necessary configuration
- Optionally run migrations and seed the database

### Option B: Manual Configuration

1. **Create `.env` file**
   ```bash
   # Create .env file manually or copy from example if available
   touch .env
   ```

2. **Update `.env` with your Neon connection details**
   ```env
   # Database Configuration
   DB_CLIENT=pg
   DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
   
   # Session Secret (generate a random string)
   SESSION_SECRET=your-random-secret-here
   
   # Other configuration
   NODE_ENV=development
   PORT=3000
   COMMISSION_RATE=0.25
   MAX_UPLOAD_MB=8
   PDF_BASE_URL=http://localhost:3000
   ```

3. **Generate a Session Secret**
   ```bash
   # On macOS/Linux
   openssl rand -base64 32
   
   # Or use Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

## Step 3: Run Database Migrations

Once your environment variables are configured, run the migrations:

```bash
# Make sure DB_CLIENT and DATABASE_URL are set
export DB_CLIENT=pg
export DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"

# Run migrations
npm run migrate
```

You should see output like:
```
Batch 1 run: 7 migrations
```

## Step 4: Seed the Database (Optional)

To populate the database with sample data:

```bash
npm run seed
```

This will create:
- Sample talent and agency accounts
- Demo profiles with images
- Test data for development

## Step 5: Verify Connection

### Test Database Connection

Before starting the server, you can test your database connection:

```bash
npm run test:db
```

This will:
- Verify your environment variables are set correctly
- Test the database connection
- Show database information (PostgreSQL version, database name, user)
- List existing tables (if any)
- Provide helpful error messages if something is wrong

### Start Development Server

Once the connection test passes, start your development server:

```bash
npm run dev
```

The server should start without database errors. You can verify the connection by:

1. Checking the server logs for any database errors
2. Logging in with sample accounts (after seeding):
   - Talent: `talent@example.com` / `password123`
   - Agency: `agency@example.com` / `password123`

## Troubleshooting

### Connection Errors

**Error: "Connection refused" or "Connection timeout"**
- Verify your `DATABASE_URL` is correct
- Check that your Neon project is active (not paused)
- Ensure `sslmode=require` is in your connection string
- Verify your IP is not blocked (Neon allows all IPs by default)

**Error: "SSL required"**
- Add `?sslmode=require` to your connection string
- Neon requires SSL for all connections

**Error: "Database does not exist"**
- Verify the database name in your connection string
- Check your Neon project dashboard for the correct database name

### Migration Errors

**Error: "relation already exists"**
- The migrations may have already been run
- Check your Neon dashboard to see if tables exist
- If you need to reset, you can drop and recreate your database in Neon dashboard

**Error: "ENUM type already exists"**
- PostgreSQL ENUMs are created once and reused
- This is normal if migrations were partially run
- You can safely ignore this or manually drop the ENUM type if needed

### Performance Issues

**Slow queries**
- Check your Neon project region matches your application region
- Consider upgrading to a paid plan for better performance
- Use connection pooling (Neon provides a pooled connection string)

### Connection Pooling

Neon provides a separate connection string for connection pooling. To use it:

1. Go to your Neon project dashboard
2. Find the "Connection pooling" section
3. Copy the pooled connection string (usually ends with `-pooler.neon.tech`)
4. Use this connection string in your `DATABASE_URL`

Example pooled connection string:
```
postgresql://user:password@host-pooler.neon.tech/dbname?sslmode=require
```

## Neon-Specific Features

### Database Branching

Neon allows you to create database branches (like Git branches) for testing:

1. Go to your Neon project dashboard
2. Click "Branches"
3. Create a new branch (e.g., "staging" or "feature-test")
4. Use the branch's connection string for your test environment

### Auto-Suspend

Neon's free tier automatically suspends databases after inactivity. The database will automatically resume when you connect to it (may take a few seconds on first connection).

### Monitoring

- View query performance in the Neon dashboard
- Check connection metrics and database size
- Monitor active connections

## Production Deployment

For production deployment:

1. **Use Connection Pooling**
   - Use the pooled connection string from Neon
   - This improves performance and handles connection limits better

2. **Set Environment Variables**
   - Set `NODE_ENV=production`
   - Use a strong `SESSION_SECRET`
   - Configure `PDF_BASE_URL` to your production domain

3. **Database Backups**
   - Neon automatically backs up your database
   - Configure point-in-time recovery if needed
   - Set up backup retention policies

4. **Monitoring**
   - Enable Neon's monitoring and alerts
   - Set up error tracking for database issues
   - Monitor connection pool usage

## Additional Resources

- [Neon Documentation](https://neon.tech/docs)
- [Neon Connection String Guide](https://neon.tech/docs/connect/connect-from-any-app)
- [Neon Connection Pooling](https://neon.tech/docs/connect/connection-pooling)
- [PostgreSQL Best Practices](https://neon.tech/docs/guides/postgres-best-practices)

## Support

If you encounter issues:

1. Check the [Neon Status Page](https://status.neon.tech)
2. Review Neon's [Troubleshooting Guide](https://neon.tech/docs/troubleshoot)
3. Check the Neon Discord community
4. Review this project's [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) for deployment-specific issues

