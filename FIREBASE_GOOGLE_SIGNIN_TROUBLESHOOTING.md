# Firebase Google Sign-In Troubleshooting Guide

## Issue: Google Sign-In Not Redirecting After Authentication

If Google Sign-In opens the popup, you authenticate, but then it doesn't redirect you to the dashboard, check the following Firebase Console settings:

## 1. Authorized Domains

**Location**: Firebase Console → Authentication → Settings → Authorized domains

**Required domains**:
- `pholio.studio` (your production domain)
- `localhost` (for local development)
- Any other domains where you're testing (e.g., `pholio-studio.netlify.app`)

**How to add**:
1. Go to Firebase Console → Authentication → Settings
2. Scroll to "Authorized domains"
3. Click "Add domain"
4. Enter `pholio.studio`
5. Click "Add"

## 2. OAuth Redirect URIs (Google Cloud Console)

**Location**: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs

**Required redirect URIs**:
- `https://pholio.studio/__/auth/handler` (Firebase default handler)
- `https://pholio.studio` (your domain)
- `http://localhost:3000/__/auth/handler` (for local development)
- `http://localhost:3000` (for local development)

**How to check/update**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to "APIs & Services" → "Credentials"
4. Find your OAuth 2.0 Client ID (should match your Firebase Web App)
5. Click to edit
6. Under "Authorized redirect URIs", ensure the above URIs are listed
7. Click "Save"

## 3. Firebase Auth Domain

**Location**: Firebase Console → Authentication → Settings → Authorized domains

**Check**: Your `FIREBASE_AUTH_DOMAIN` environment variable should match your Firebase project's auth domain.

**Format**: `[project-id].firebaseapp.com` or your custom domain

**How to verify**:
1. Go to Firebase Console → Project Settings
2. Scroll to "Your apps" section
3. Find your Web app
4. Check the "authDomain" value
5. Ensure it matches your `.env` file's `FIREBASE_AUTH_DOMAIN`

## 4. Google Sign-In Provider Status

**Location**: Firebase Console → Authentication → Sign-in method

**Check**:
1. Go to Firebase Console → Authentication → Sign-in method
2. Find "Google" in the list
3. Ensure it's **Enabled**
4. Click on it to verify:
   - "Project support email" is set
   - "Authorized domains" includes your domain
   - "OAuth consent screen" is configured

## 5. OAuth Consent Screen

**Location**: Google Cloud Console → APIs & Services → OAuth consent screen

**Check**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Navigate to "APIs & Services" → "OAuth consent screen"
4. Ensure:
   - User type is set (Internal or External)
   - App name, support email, and developer contact are filled
   - Scopes include `email` and `profile`
   - Test users (if in testing mode) include your test accounts

## 6. Environment Variables

**Check your `.env` file**:
```bash
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
```

**Verify**:
- All values are set (no empty values)
- `FIREBASE_AUTH_DOMAIN` matches your Firebase project's auth domain
- No extra spaces or quotes around values

## 7. Browser Console Errors

**Check for these specific errors**:

- `auth/unauthorized-domain`: Domain not in authorized domains list
- `auth/popup-blocked`: Browser blocked the popup (should auto-fallback to redirect)
- `auth/popup-closed-by-user`: Popup closed (code now checks if user is authenticated)
- `auth/network-request-failed`: Network issue or CORS problem

## 8. Testing Steps

1. **Clear browser cache and cookies** for your domain
2. **Open browser console** (F12) to see detailed logs
3. **Try Google Sign-In** and watch console for:
   - `[Login] 🔵 Starting Google Sign-In...`
   - `[Login] ✅ Google Sign-In successful...`
   - `[Login] 🔵 Calling handleLogin with token...`
   - `[Login] 📥 Response received...`
   - `[Login] ✅ Redirecting to: /dashboard/talent`

4. **If popup closes with `auth/popup-closed-by-user`**:
   - The code now checks if you're authenticated
   - Look for: `[Login] ✅ User is authenticated (immediate check)...`
   - If you see this, login should proceed automatically

## 9. Common Fixes

### Fix 1: Add Domain to Authorized Domains
```bash
# In Firebase Console → Authentication → Settings → Authorized domains
# Add: pholio.studio
```

### Fix 2: Update OAuth Redirect URIs
```bash
# In Google Cloud Console → Credentials → OAuth 2.0 Client ID
# Add redirect URI: https://pholio.studio/__/auth/handler
```

### Fix 3: Verify Auth Domain
```bash
# Check your .env file
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
# Should match Firebase Console → Project Settings → Your apps → authDomain
```

### Fix 4: Enable Google Sign-In Provider
```bash
# In Firebase Console → Authentication → Sign-in method
# Ensure "Google" is Enabled
```

## 10. Still Not Working?

If after checking all the above, Google Sign-In still doesn't work:

1. **Check Firebase project**: Ensure you're using the correct Firebase project
2. **Check environment**: Ensure production environment variables are set correctly
3. **Check logs**: Review server logs for authentication errors
4. **Test with redirect flow**: The code should automatically fall back to redirect if popup fails
5. **Contact support**: If all else fails, check Firebase status page or contact Firebase support

## Code Changes Made

The code has been updated to:
- Check if user is authenticated after popup closes (Firebase sometimes closes popup after successful auth)
- Use `onAuthStateChanged` to detect authentication state changes
- Automatically fall back to redirect flow if popup is blocked
- Provide better error messages and logging

These changes should handle the `auth/popup-closed-by-user` error more gracefully by checking if authentication actually succeeded despite the popup closing.

