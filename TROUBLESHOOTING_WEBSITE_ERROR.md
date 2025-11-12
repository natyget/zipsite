# Troubleshooting: "Unexpected error" on Website

## Problem

Your website is showing "Unexpected error" instead of the homepage. This is likely a database connection issue.

## Why This Happens

The homepage tries to load data from the database when someone visits. If the database connection fails, it shows an error page.

## What I Fixed

1. **Made homepage more resilient**: The homepage now uses fallback data if the database is unavailable, so it should still work even if there are database issues.

2. **Better error logging**: Errors are now logged with more details to help diagnose issues.

3. **Improved error page**: In development mode, the error page shows more details about what went wrong.

## What You Need to Do

### Step 1: Check Netlify Function Logs

1. Go to **Netlify Dashboard** → Your Site
2. Click on **Functions** → **server**
3. Click on **View logs**
4. Look for error messages - they will tell you what's wrong

Common errors you might see:
- `DATABASE_URL environment variable is required` - DATABASE_URL is not set
- `Invalid DATABASE_URL format` - DATABASE_URL is formatted incorrectly
- `connect ECONNREFUSED` - Database connection is failing
- `getaddrinfo ENOTFOUND` - Database hostname cannot be found

### Step 2: Verify Environment Variables

1. Go to **Netlify Dashboard** → Your Site → **Site settings** → **Environment variables**
2. Verify these variables are set:
   - `DB_CLIENT` = `pg`
   - `DATABASE_URL` = Your Neon connection string (should start with `postgresql://`)
   - `SESSION_SECRET` = A random secret string
   - `NODE_ENV` = `production`

3. **Important**: Make sure `DATABASE_URL` is:
   - The complete connection string from Neon
   - Does NOT include `psql` command
   - Does NOT include quotes
   - Should look like: `postgresql://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require`

### Step 3: Update DATABASE_URL (if needed)

If your DATABASE_URL is incorrect:

1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. Click **"Connection Details"** or **"Connection String"**
4. Copy the connection string (starts with `postgresql://`)
5. Go to Netlify → Site settings → Environment variables
6. Update `DATABASE_URL` with the correct connection string
7. **Redeploy** your site

### Step 4: Redeploy Your Site

After updating environment variables:

1. Go to **Deploys** tab in Netlify
2. Click **"Trigger deploy"** → **"Deploy site"**
3. Wait for deployment to complete
4. Test your website

### Step 5: Check Database Connection

Verify your Neon database is:
- **Active** (not paused)
- **Accessible** from the internet
- Has the correct connection string

## Quick Checklist

- [ ] Checked Netlify function logs for errors
- [ ] Verified `DB_CLIENT=pg` is set
- [ ] Verified `DATABASE_URL` is set correctly (no `psql`, no quotes)
- [ ] Verified `SESSION_SECRET` is set
- [ ] Verified `NODE_ENV=production` is set
- [ ] Redeployed site after updating variables
- [ ] Checked Neon database is active
- [ ] Tested website after deployment

## After These Changes

The code I just updated will:
1. **Show the homepage even if database fails** - Uses fallback data
2. **Log detailed errors** - Check Netlify function logs to see what's wrong
3. **Show error details in development** - If `NODE_ENV` is not `production`, you'll see more error details

## Still Having Issues?

1. **Check function logs** - This is the most important step
2. **Verify DATABASE_URL** - Make sure it's the correct format
3. **Test database connection** - Try connecting to your Neon database from your local machine
4. **Check Neon dashboard** - Make sure your database is active and accessible

## Common Issues

### Issue: "DATABASE_URL environment variable is required"
**Solution**: Set `DATABASE_URL` in Netlify environment variables

### Issue: "Invalid DATABASE_URL format"
**Solution**: Make sure DATABASE_URL starts with `postgresql://` and doesn't include `psql` or quotes

### Issue: "connect ECONNREFUSED" or "getaddrinfo ENOTFOUND"
**Solution**: 
- Verify DATABASE_URL has the correct hostname
- Check that your Neon database is active
- Make sure you're using the correct connection string from Neon

### Issue: Website still shows error after fixing
**Solution**:
- Make sure you redeployed after updating environment variables
- Clear your browser cache
- Check function logs for new errors

## Next Steps

1. **Deploy the updated code** - The changes I made will make the homepage more resilient
2. **Check function logs** - See what the actual error is
3. **Fix DATABASE_URL** - If it's incorrect, update it in Netlify
4. **Redeploy** - After fixing environment variables, redeploy your site

The updated code should help, but you still need to fix the database connection issue for the website to work properly with database data.

