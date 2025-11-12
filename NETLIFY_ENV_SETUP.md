# Netlify Environment Variables Setup Guide

## Problem: `connect ECONNREFUSED 127.0.0.1:5432`

This error means your function is trying to connect to a local PostgreSQL database (`localhost:5432`) instead of your Neon database. This happens when environment variables are not set in Netlify.

## Solution: Set Environment Variables in Netlify

### Step 1: Get Your REAL Neon Connection String

**⚠️ CRITICAL: You must use your ACTUAL connection string from Neon, not a placeholder!**

1. **Go to [Neon Console](https://console.neon.tech)**
   - Log in to your Neon account
   - If you don't have an account, sign up for free

2. **Select Your Project**
   - Click on your project (or create a new one if you haven't)

3. **Get Connection String**
   - Click on **"Connection Details"** or **"Connection String"** in the dashboard
   - You'll see your connection string - it will look something like:
     ```
     postgresql://username:password@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
     ```
   - **Notice**: The hostname is unique and **MUST start with `ep-`** (like `ep-cool-darkness-123456.us-east-2.aws.neon.tech`)
   - **⚠️ CRITICAL**: The hostname must start with `ep-` - this is required for Neon databases
   - **DO NOT** use placeholder values like `host.neon.tech`, `your-host.neon.tech`, or any hostname without the `ep-` prefix

4. **Copy the Complete String**
   - Click the copy button next to the connection string
   - **⚠️ CRITICAL**: Copy ONLY the connection string itself, NOT the command!
   - **DO NOT** copy commands like `psql 'postgresql://...'` or `PGPASSWORD=... psql ...`
   - **DO NOT** include quotes around the connection string
   - Make sure you copy the ENTIRE connection string including:
     - `postgresql://` prefix
     - Username and password
     - Your unique hostname (starts with `ep-`)
     - Database name
     - `?sslmode=require` at the end

5. **Verify the Format**
   - Should start with `postgresql://` or `postgres://`
   - Should NOT start with `psql`, `PGPASSWORD`, or any command
   - Should NOT have quotes around it (`'...'` or `"..."`)
   - Should contain your unique hostname that **starts with `ep-`** (e.g., `ep-xxx-xxx.us-east-2.aws.neon.tech`)
   - Should NOT contain placeholder hostnames like `host.neon.tech`, `your-host.neon.tech`, or `localhost`
   - Should end with `?sslmode=require`
   - Should be a long string (not a short placeholder)
   
   **What to copy:**
   - ✅ `postgresql://user:pass@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
     - Hostname starts with `ep-` ✓
     - Hostname includes `.neon.tech` ✓
     - Includes `?sslmode=require` ✓
   
   **What NOT to copy:**
   - ❌ `psql 'postgresql://user:pass@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'` (includes `psql` command)
   - ❌ `'postgresql://user:pass@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'` (includes quotes)
   - ❌ `postgresql://user:pass@host.neon.tech/dbname?sslmode=require` (placeholder hostname, no `ep-` prefix)
   - ❌ `postgresql://user:pass@localhost/dbname?sslmode=require` (Neon databases are remote, not localhost)
   - ❌ Any command that includes `psql` or `PGPASSWORD`

**Example of CORRECT connection string:**
```
postgresql://myuser:mypassword@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Examples of WRONG (will cause errors):**

❌ **Placeholder hostname (wrong - no `ep-` prefix):**
```
postgresql://user:password@host.neon.tech/dbname?sslmode=require
```
**Problem**: Hostname doesn't start with `ep-` (Neon hostnames always start with `ep-`)

❌ **Localhost (wrong - Neon databases are remote):**
```
postgresql://user:password@localhost/dbname?sslmode=require
```
**Problem**: Neon databases are remote, not localhost

❌ **Includes psql command (wrong - copied entire command):**
```
psql 'postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'
```
**Problem**: Includes `psql` command - should only include the connection string

❌ **Includes quotes (wrong - quotes should not be included):**
```
'postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'
```
**Problem**: Includes quotes - should only include the connection string

❌ **Includes PGPASSWORD command (wrong - copied entire command):**
```
PGPASSWORD=password psql -h ep-xxx-xxx.us-east-2.aws.neon.tech -U user -d neondb
```
**Problem**: Includes command - should only include the connection string

### Step 2: Set Environment Variables in Netlify

1. **Go to Netlify Dashboard**
   - Navigate to your site
   - Click on **Site settings** (gear icon)

2. **Open Environment Variables**
   - Click on **Environment variables** in the left sidebar
   - Or go directly to: `Site settings → Build & deploy → Environment`

3. **Add Required Variables**

   Click **Add a variable** and add each of these:

   #### Required Variables

   **1. DB_CLIENT**
   - Key: `DB_CLIENT`
   - Value: `pg`
   - Scopes: All scopes (Production, Deploy previews, Branch deploys)

   **2. DATABASE_URL**
   - Key: `DATABASE_URL`
   - Value: Your Neon connection string
   - Example: `postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - **Important**: 
     - Include the full connection string from Neon
     - Must start with `postgresql://` or `postgres://`
     - Hostname **MUST start with `ep-`** (e.g., `ep-cool-darkness-123456`)
     - Hostname **MUST include `.neon.tech`** (e.g., `ep-xxx.us-east-2.aws.neon.tech`)
     - Must include `?sslmode=require` for Neon
     - **DO NOT** use placeholder hostnames like `host.neon.tech` or `localhost`
   - Scopes: All scopes

   **3. SESSION_SECRET**
   - Key: `SESSION_SECRET`
   - Value: A random secret string
   - Generate one with:
     ```bash
     openssl rand -base64 32
     ```
   - Or use Node.js:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
     ```
   - Scopes: All scopes

   **4. NODE_ENV**
   - Key: `NODE_ENV`
   - Value: `production`
   - Scopes: Production only (or all scopes)

   #### Optional Variables

   **5. PDF_BASE_URL**
   - Key: `PDF_BASE_URL`
   - Value: Your Netlify site URL
   - Example: `https://your-site.netlify.app`
   - Scopes: All scopes

   **6. COMMISSION_RATE**
   - Key: `COMMISSION_RATE`
   - Value: `0.25` (default)
   - Scopes: All scopes

   **7. MAX_UPLOAD_MB**
   - Key: `MAX_UPLOAD_MB`
   - Value: `8` (default)
   - Scopes: All scopes

### Step 3: Verify Environment Variables

After adding all variables, you should see:

```
DB_CLIENT = pg
DATABASE_URL = postgresql://username:password@ep-xxx-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
SESSION_SECRET = <your-secret>
NODE_ENV = production
PDF_BASE_URL = https://your-site.netlify.app (optional)
```

**⚠️ Important**: Your DATABASE_URL should have a unique hostname that **starts with `ep-`** (like `ep-xxx-xxx-xxx.us-east-2.aws.neon.tech`), NOT a placeholder like `host.neon.tech` or `localhost`!

**Verification:**
- ✅ Hostname starts with `ep-` (e.g., `ep-cool-darkness-123456`)
- ✅ Hostname includes `.neon.tech` (e.g., `ep-xxx.us-east-2.aws.neon.tech`)
- ✅ Includes `?sslmode=require` at the end
- ❌ NOT a placeholder like `host.neon.tech` or `localhost`
- ❌ Does NOT include `psql` command or quotes

### Step 4: Redeploy Your Site

After setting environment variables:

1. **Trigger a new deploy**:
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**
   - Or push a new commit to trigger automatic deploy

2. **Verify the deploy**:
   - Check build logs for any errors
   - Verify function logs show no connection errors
   - Test your site to ensure it works

## Verification Checklist

- [ ] `DB_CLIENT` is set to `pg`
- [ ] `DATABASE_URL` is set with your Neon connection string
- [ ] `DATABASE_URL` hostname **starts with `ep-`** (e.g., `ep-xxx-xxx.us-east-2.aws.neon.tech`)
- [ ] `DATABASE_URL` hostname includes `.neon.tech` (e.g., `ep-xxx.us-east-2.aws.neon.tech`)
- [ ] `DATABASE_URL` does NOT contain placeholder hostnames (`host.neon.tech`, `localhost`, etc.)
- [ ] `DATABASE_URL` includes `?sslmode=require`
- [ ] `DATABASE_URL` does NOT include `psql` command or quotes
- [ ] `SESSION_SECRET` is set (random string)
- [ ] `NODE_ENV` is set to `production`
- [ ] Site has been redeployed after setting variables
- [ ] Function logs show no connection errors
- [ ] Site is working correctly

## Common Issues

### Issue 1: Error `getaddrinfo ENOTFOUND host.neon.tech`

**Problem**: Your DATABASE_URL contains a placeholder instead of your actual Neon connection string.

**Solution**: 
1. **Go to Neon Console** (https://console.neon.tech)
2. **Select your project**
3. **Click "Connection Details"** or **"Connection String"**
4. **Copy your REAL connection string** (it will have a unique hostname like `ep-xxx-xxx.us-east-2.aws.neon.tech`)
5. **Verify the hostname**:
   - ✅ **MUST start with `ep-`** (e.g., `ep-cool-darkness-123456`)
   - ✅ **MUST include `.neon.tech`** (e.g., `ep-xxx.us-east-2.aws.neon.tech`)
   - ❌ **WRONG**: `host.neon.tech`, `your-host.neon.tech`, or any hostname without `ep-` prefix
6. **Update DATABASE_URL in Netlify**:
   - Go to Netlify Dashboard → Site settings → Environment variables
   - Find `DATABASE_URL`
   - Click "Edit" and paste your REAL connection string
   - Make sure it's the complete string with `?sslmode=require` at the end
7. **Redeploy your site** after updating

**What to look for:**
- ✅ **CORRECT**: `postgresql://user:pass@ep-cool-darkness-123456.us-east-2.aws.neon.tech/neondb?sslmode=require`
  - Hostname starts with `ep-` ✓
  - Hostname includes `.neon.tech` ✓
  - Includes `?sslmode=require` ✓
- ❌ **WRONG**: `postgresql://user:pass@host.neon.tech/dbname?sslmode=require` (placeholder!)
- ❌ **WRONG**: `postgresql://user:pass@your-host.neon.tech/dbname?sslmode=require` (placeholder!)
- ❌ **WRONG**: `postgresql://user:pass@localhost/dbname?sslmode=require` (Neon databases are remote!)
- ❌ **WRONG**: Hostname without `ep-` prefix (Neon hostnames always start with `ep-`)

**Neon Hostname Format:**
- All Neon hostnames follow this pattern: `ep-{unique-id}.{region}.aws.neon.tech`
- Example: `ep-cool-darkness-123456.us-east-2.aws.neon.tech`
- The `ep-` prefix is **required** and indicates it's a Neon endpoint

### Issue 2: Still getting `ECONNREFUSED 127.0.0.1:5432`

**Solution**: 
- Verify `DB_CLIENT=pg` is set
- Verify `DATABASE_URL` is set and correct (use your REAL Neon connection string, not a placeholder)
- Make sure you redeployed after setting variables
- Check that variables are set for the correct scope (Production, Preview, etc.)

### Issue 3: Invalid DATABASE_URL format (includes `psql` command or quotes)

**Problem**: Your DATABASE_URL contains a command (like `psql`) or quotes instead of just the connection string.

**Error message**: `Invalid DATABASE_URL format. Expected postgresql:// or postgres://, got: psql 'postgresql://...`

**Solution**:
1. **Go to Neon Console** (https://console.neon.tech)
2. **Select your project**
3. **Click "Connection Details"** or **"Connection String"**
4. **Find the connection string** (it starts with `postgresql://`)
5. **Copy ONLY the connection string**, NOT the command:
   - ✅ **CORRECT**: `postgresql://user:pass@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`
   - ❌ **WRONG**: `psql 'postgresql://user:pass@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'`
   - ❌ **WRONG**: `'postgresql://user:pass@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require'`
6. **Update DATABASE_URL in Netlify**:
   - Go to Netlify Dashboard → Site settings → Environment variables
   - Find `DATABASE_URL`
   - Click "Edit" and paste ONLY the connection string (no `psql`, no quotes)
7. **Verify**:
   - Should start with `postgresql://` or `postgres://`
   - Should NOT start with `psql` or contain quotes
   - Should end with `?sslmode=require`
8. **Redeploy your site** after updating

**Common mistakes to avoid**:
- ❌ Copying the entire `psql` command
- ❌ Including quotes (`'...'` or `"..."`)
- ❌ Including `PGPASSWORD` or other environment variables
- ❌ Copying example commands from documentation

### Issue 4: Environment variables not taking effect

**Solution**:
- Environment variables only apply to new deploys
- Trigger a new deploy after setting variables
- Check that variables are set for the correct scope
- Verify variables are not being overridden elsewhere

### Issue 5: SSL connection error

**Solution**:
- Ensure `?sslmode=require` is in your DATABASE_URL
- Neon requires SSL connections
- Check Neon dashboard for connection string format

## Testing Your Setup

### 1. Check Function Logs

1. Go to Netlify Dashboard → Your Site
2. Click on **Functions** → **server**
3. Click on **View logs**
4. Look for any database connection errors
5. Should see successful connections, not `ECONNREFUSED` errors

### 2. Test Database Connection

1. Visit your site URL
2. Try to access a page that requires database connection
3. Check function logs for any errors
4. If errors persist, verify DATABASE_URL is correct

### 3. Verify Environment Variables

You can add a temporary route to verify environment variables (remove after testing):

```javascript
// Temporary route to check env vars (remove after testing)
app.get('/debug/env', (req, res) => {
  res.json({
    dbClient: process.env.DB_CLIENT,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPreview: process.env.DATABASE_URL?.substring(0, 20) + '...',
    nodeEnv: process.env.NODE_ENV
  });
});
```

**Note**: Remove this route after verification for security.

## Security Notes

- **Never commit** `.env` files to git
- **Never commit** DATABASE_URL or SESSION_SECRET to git
- Use Netlify's environment variables for production secrets
- Rotate SESSION_SECRET if it's ever exposed
- Use different DATABASE_URL for different environments (production, preview, etc.)

## Quick Reference

### Minimal Required Variables

```bash
DB_CLIENT=pg
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
SESSION_SECRET=<generate-with-openssl-rand-base64-32>
NODE_ENV=production
```

**⚠️ Important Notes:**
- `DATABASE_URL` hostname **MUST start with `ep-`** (e.g., `ep-cool-darkness-123456`)
- `DATABASE_URL` hostname **MUST include `.neon.tech`** (e.g., `ep-xxx.us-east-2.aws.neon.tech`)
- Do NOT use placeholder hostnames like `host.neon.tech` or `localhost`
- Do NOT include `psql` command or quotes in `DATABASE_URL`
- Always include `?sslmode=require` at the end

### Generate SESSION_SECRET

```bash
# macOS/Linux
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Additional Resources

- [Netlify Environment Variables Documentation](https://docs.netlify.com/environment-variables/overview/)
- [Neon Connection String Guide](https://neon.tech/docs/connect/connect-from-any-app)
- [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) - Full deployment guide
- [NEON_SETUP.md](./NEON_SETUP.md) - Neon database setup guide

## Support

If you continue to have issues:

1. Check Netlify function logs for detailed error messages
2. Verify your Neon database is active (not paused)
3. Test your DATABASE_URL locally first
4. Review [NETLIFY_DEPLOYMENT.md](./NETLIFY_DEPLOYMENT.md) troubleshooting section
5. Check Neon dashboard for connection issues

