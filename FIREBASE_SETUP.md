# Firebase Authentication Setup Guide

This guide helps you configure Firebase Authentication for ZipSite.

## Quick Setup

### 1. Firebase Web API Key

✅ **Already Configured!** Your Firebase Web API Key is:
- `AIzaSyBqO78jrAfsec0NaWMqOCdSsWhI7cSokEc`

This has been retrieved from your Firebase Console configuration.

### 2. Add Firebase Config to .env

You have two options:

#### Option A: Manual Setup (Recommended)

Add these lines to your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID=zipsite-78e85
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC4OO3EAracXChT\nQ9KytWFXt1PIbn7aMsNRBSZGHDewTegZo2xdSAoyY7C8LpGW+xA8EttX3W6M64LV\n7pKcDUgC3i0TES5DLxRj2k+62CHalBg2OPiL5ScseHJLQHkcC/0yqHXO2jFFDoU8\n7owi5gwIMWlO/SUUnjRZpLpopzLeV43lyulDkL4NkCxCExm3qqoBWBedxnH1RThd\ndTy91aijev/UE7OiBirOWrPX5UUq5r1XFrsVdKpY3QIb1OruDiXRVVZfglUhk4OE\nM1K4kVaqchtumUb7ymOnG3dQGR/uxvqCuld9LEWoboY32AjHVZD2Mfp9aqxm30p0\nRWABkZGVAgMBAAECggEAAnTgjMrUIw534NuzFqbPCGj9gRsiGL2bt6adLaBTiMe9\nLCxZoKkk2P+rJr3rO0DCpRPDoNlnJOdrZvgSXz+DweVduKxJD48e6JGhGwwl8BYl\n+CvMeqxrWDnh8klxjqjFRKnqP5V5bzg5RB2n45DpllQMWV02+POpczbnCnK3qFnW\nLnGVsWiFQ+pl3t4gPQQ4cRZg4+q9l2IEMRgZ2dlfsMC5KAkctu8tQKv7fDWgttSo\nXMEc/ltuWBt86B5FHxITDN3HQ3lZXn9yo4/j4Hm22RYpQOC8WxltHYDAGljK3jIp\nWcPvXNpGozyrJgsu+Weix9ZFCLU7lsB4Y1UxdfqS+QKBgQD7s/5m8adwpd/CEvUI\nx0MqgkCpMoC253d5aUun7Ev5qE2tISLfXzsZTLMngF1qFA7230eKBwcCZtgTCvfA\nDUx+pUre8vf42KDNErJ+ltIQ89gNIfY5AE62u8qQFkaXbrNquaSThyNOLYCePvVP\n9FX5MYkyZEt3+4zXB5N0PqVcCQKBgQC7Xgb1THQzLoTnSWjIOayeSVFK1rEpbfPB\ntEpO8aVarTunkvTn37c3Vt24LVCo/DkxSuyh0fvjylO6n71WnuL2mVTCrtUnSMgy\neUHqHemOLNjKZoQU4+R7p17JXe7JiPpUzhpwdr0sQNzzEOHWgbnLuR9cLtGKAmKx\nMZieQR5ELQKBgH6FkLjQehlO1/YnL1K1TxbcGIK0Zy0Jlu3JtwT2643YQwtm36+m\nn/9spZWSmeJLqOYBgGVqeOSFK9IOrlC0nqH+lm8RdQJ6agILhvvI9lkdKZoYWzt1\n4xtJtF3PRLa0J63bGVYrFN0kVEW3YfpJ2LmFY/CXp7PtF3OzVDSXlOl5AoGAA0vf\nMXeb376kxfDrsAIbwFkn3foy+biefjzuxb7ImvTLROJ3/pBYB9g2ZGQftClj1DMu\nQJaSKOrJWFIxIZIACjieXiJ3S46jPwgVGcpW7pJpaf4turRbs7U5HK/TYKZRSSar\nHmloYJvvhzM31e9IVoY2QAfu1c++7sEhnz8kCi0CgYAOJ5R+js+nh955X9kaeGqm\nxj8DPseY93VZTrMysKKkhnNt20qtKVW1EwD27TYVMy01wZXmPRRtTMWkNMThW83u\nafgJ8ps6wFzT8h+cUb8H3BUo1glIwdp/+BnM3V9OoDS8adSO8yopMpazGL2U1Rel\nlVnP7ptVb/iOILia4H10GQ==\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@zipsite-78e85.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=102912011769394336459
FIREBASE_AUTH_DOMAIN=zipsite-78e85.firebaseapp.com
FIREBASE_API_KEY=AIzaSyBqO78jrAfsec0NaWMqOCdSsWhI7cSokEc
```

#### Option B: Use Template File

Copy from `.env.firebase-template`:

```bash
# Append Firebase config to your .env file
cat .env.firebase-template >> .env
```

Then edit `.env` and replace `YOUR_WEB_API_KEY_HERE` with your actual API key.

### 3. Enable Email/Password Authentication in Firebase

1. Go to Firebase Console → Your Project
2. Click **Authentication** in the left menu
3. Click **Get started** (if first time)
4. Go to **Sign-in method** tab
5. Click on **Email/Password**
6. Enable **Email/Password** (toggle ON)
7. Click **Save**

### 4. Run Database Migration

Run the migration to add the `firebase_uid` column:

```bash
npm run migrate
```

### 5. Test the Setup

Start your server:

```bash
npm start
```

Then test authentication:
1. Visit `/apply` and try creating a new account
2. Visit `/login` and try signing in

## Environment Variables Summary

| Variable | Value | Where to Get It |
|----------|-------|-----------------|
| `FIREBASE_PROJECT_ID` | `zipsite-78e85` | Service account JSON (`project_id`) |
| `FIREBASE_PRIVATE_KEY` | `-----BEGIN...` | Service account JSON (`private_key`) |
| `FIREBASE_CLIENT_EMAIL` | `firebase-adminsdk...` | Service account JSON (`client_email`) |
| `FIREBASE_CLIENT_ID` | `102912011769394336459` | Service account JSON (`client_id`) |
| `FIREBASE_AUTH_DOMAIN` | `zipsite-78e85.firebaseapp.com` | Auto-generated from project ID |
| `FIREBASE_API_KEY` | `AIzaSyBqO78jrAfsec0NaWMqOCdSsWhI7cSokEc` | ✅ Already configured |

## Verification

After setup, verify Firebase is initialized:

1. Start your server
2. Check server logs for: `[Firebase Admin] Initialized successfully`
3. Check browser console for: `[Firebase Auth] Initialized successfully`

## Troubleshooting

### "Firebase Admin not initialized" error

- Check that all environment variables are set in `.env`
- Verify `FIREBASE_PRIVATE_KEY` includes the full key with `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Check that newlines in private key are escaped as `\n`

### "Firebase Auth not initialized" error (client-side)

- Check that `FIREBASE_API_KEY` is set correctly
- Verify `FIREBASE_AUTH_DOMAIN` matches your project
- Check browser console for Firebase SDK loading errors

### "Token verification failed" error

- Ensure Email/Password authentication is enabled in Firebase Console
- Check that the Firebase project ID matches in both server and client config

## Next Steps

- Test user registration at `/apply`
- Test user login at `/login`
- Test agency signup at `/partners`
- Migrate existing users (they'll need to reset passwords via Firebase)

