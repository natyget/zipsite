# Fix for "Cannot find module 'pg'" Error on Netlify

## Problem

Netlify Functions were failing with the error:
```
Error: Knex: run $ npm install pg --save
Cannot find module 'pg'
```

## Root Cause

The issue was caused by:
1. **Bundler configuration**: Using `esbuild` bundler which doesn't handle native modules like `pg` well
2. **Native module handling**: `pg` is a native module with C++ bindings that requires special handling in serverless environments
3. **Version mismatch**: Package.json and package-lock.json had mismatched versions (now fixed)

## Solution Applied

### 1. Updated `netlify.toml`

Changed the bundler from `esbuild` to `nft` (Node Function Tracing):
```toml
[functions]
  directory = "netlify/function"
  node_bundler = "nft"  # Better native module support
  included_files = ["views/**", "public/**", "migrations/**"]
```

**Why `nft`?**
- `nft` (Node Function Tracing) includes required dependencies without breaking native modules
- `esbuild` tries to bundle everything and breaks native C++ bindings
- `nft` traces imports and includes only what's needed, preserving native modules

### 2. Verified `package.json`

Ensured `pg` is in `dependencies` (not `devDependencies`):
```json
{
  "dependencies": {
    "pg": "^8.16.3",
    ...
  }
}
```

### 3. Fixed Version Alignment

Updated package.json to match package-lock.json version (`^8.16.3`)

## Deployment Steps

1. **Commit changes**:
   ```bash
   git add netlify.toml package.json package-lock.json
   git commit -m "Fix pg module error: use nft bundler for native modules"
   git push
   ```

2. **Verify Netlify build**:
   - Check Netlify build logs to ensure `npm install` completes successfully
   - Look for `pg@8.16.3` in the build output
   - Verify no errors during function bundling

3. **Test the function**:
   - After deployment, test a database query
   - Check function logs for any remaining errors
   - Verify database connection works

## Alternative Solutions (if nft doesn't work)

### Option 1: Disable Bundling (slower but reliable)

Remove `node_bundler` from `netlify.toml`:
```toml
[functions]
  directory = "netlify/function"
  # No bundler - uses node_modules directly (slower cold starts)
  included_files = ["views/**", "public/**", "migrations/**"]
```

### Option 2: Use Default Bundler

Let Netlify use its default bundler:
```toml
[functions]
  directory = "netlify/function"
  # Remove node_bundler line to use default
  included_files = ["views/**", "public/**", "migrations/**"]
```

### Option 3: Verify Build Process

Ensure dependencies are installed:
```toml
[build]
  command = "npm ci && npm run build"
  publish = "public"
```

Note: Netlify automatically runs `npm install` before the build command, so `npm ci` might be redundant but ensures a clean install.

## Verification Checklist

- [ ] `pg` is in `dependencies` (not `devDependencies`)
- [ ] `package.json` and `package-lock.json` versions match
- [ ] `netlify.toml` uses `nft` bundler (or no bundler)
- [ ] `DB_CLIENT=pg` is set in Netlify environment variables
- [ ] `DATABASE_URL` is set in Netlify environment variables
- [ ] Build logs show `pg` being installed successfully
- [ ] Function logs show no "Cannot find module 'pg'" errors

## Related Native Modules

Other native modules in this project that need similar handling:
- `sharp` - Image processing (C++ bindings)
- `puppeteer` - PDF generation (Chromium)
- `bcrypt` - Password hashing (C++ bindings)

The `nft` bundler should handle all of these correctly.

## Additional Resources

- [Netlify Functions Bundling](https://docs.netlify.com/functions/optimize-functions/#bundling)
- [Native Modules in Serverless](https://docs.netlify.com/functions/troubleshooting/#native-dependencies)
- [pg Module Documentation](https://node-postgres.com/)

## Support

If issues persist:
1. Check Netlify build logs for installation errors
2. Verify Node.js version matches (should be 20)
3. Check function logs for runtime errors
4. Ensure all environment variables are set correctly
5. Try disabling bundling as a test (Option 1 above)

