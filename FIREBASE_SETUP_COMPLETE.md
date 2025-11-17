# Firebase Setup Complete ✅

## Client-Side Configuration

The Firebase client-side configuration has been added to your `.env` file:

- ✅ **API Key**: `AIzaSyDmfHshYXdbS_8Z06GsL5AMLyVt__SssW4`
- ✅ **Auth Domain**: `pholio-bc5ab.firebaseapp.com`
- ✅ **Project ID**: `pholio-bc5ab`
- ✅ **Storage Bucket**: `pholio-bc5ab.firebasestorage.app`
- ✅ **Messaging Sender ID**: `175772792582`
- ✅ **App ID**: `1:175772792582:web:e4a69b93344697e20f5087`
- ✅ **Measurement ID**: `G-2BBQXGH7EP`

## Firebase Packages

Firebase packages are already installed in your `package.json`:
- ✅ `firebase@^12.6.0` (client-side SDK)
- ✅ `firebase-admin@^13.6.0` (server-side Admin SDK)

**Note**: Your app uses CDN imports for client-side Firebase (in `views/layout.ejs`), so the npm package is available but not required for client-side. The Admin SDK is used server-side.

## Next Steps: Firebase Admin SDK Setup

For server-side operations (token verification, user management), you need to set up a Firebase service account:

### 1. Generate Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **pholio-bc5ab**
3. Click the gear icon ⚙️ → **Project settings**
4. Go to the **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file (e.g., `pholio-bc5ab-firebase-adminsdk-xxxxx.json`)

### 2. Extract Credentials from JSON

Open the downloaded JSON file and extract:

- `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` characters)
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `project_id` → Already set as `FIREBASE_PROJECT_ID`

### 3. Add to `.env` File

Add these lines to your `.env` file:

```bash
# Firebase Admin SDK (Server-side)
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@pholio-bc5ab.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=xxxxx
```

**Important**: 
- Keep the quotes around `FIREBASE_PRIVATE_KEY`
- Preserve the `\n` characters in the private key
- Replace `xxxxx` with actual values from your JSON file

### 4. Verify Configuration

After adding the Admin SDK credentials, restart your server and test:

```bash
npm run dev
```

## Firebase Console Configuration

### 1. Authorized Domains

**Location**: Firebase Console → Authentication → Settings → Authorized domains

**Add these domains**:
- ✅ `pholio.studio` (your production domain)
- ✅ `localhost` (for local development)
- ✅ Any Netlify preview URLs (e.g., `pholio-studio.netlify.app`)

**How to add**:
1. Go to Firebase Console → Authentication → Settings
2. Scroll to "Authorized domains"
3. Click "Add domain"
4. Enter `pholio.studio`
5. Click "Add"

### 2. Google Sign-In Provider

**Location**: Firebase Console → Authentication → Sign-in method

**Enable Google Sign-In**:
1. Go to Firebase Console → Authentication → Sign-in method
2. Find "Google" in the list
3. Click to enable
4. Set "Project support email"
5. Save

### 3. OAuth Consent Screen (Google Cloud Console)

**Location**: [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → OAuth consent screen

**Configure**:
1. Select your Firebase project: **pholio-bc5ab**
2. Set user type (Internal or External)
3. Fill in:
   - App name: **Pholio**
   - Support email: Your email
   - Developer contact: Your email
4. Add scopes: `email`, `profile`
5. Save

### 4. OAuth Redirect URIs

**Location**: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs

**Add redirect URIs**:
- `https://pholio.studio/__/auth/handler`
- `https://pholio.studio`
- `http://localhost:3000/__/auth/handler` (for local dev)
- `http://localhost:3000` (for local dev)

**How to add**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **pholio-bc5ab**
3. Navigate to "APIs & Services" → "Credentials"
4. Find your OAuth 2.0 Client ID (Web client)
5. Click to edit
6. Under "Authorized redirect URIs", add the URIs above
7. Save

## Testing

After completing the setup:

1. **Restart your server**:
   ```bash
   npm run dev
   ```

2. **Test Google Sign-In**:
   - Go to `/login`
   - Click "Sign in with Google"
   - Complete authentication
   - Should redirect to dashboard

3. **Check browser console** for Firebase initialization logs:
   ```
   [Firebase] Initialized successfully
   ```

4. **Check server logs** for any Firebase Admin SDK errors

## Troubleshooting

If you encounter issues:

1. **`auth/unauthorized-domain`**: Add domain to Firebase Console → Authentication → Settings → Authorized domains
2. **`auth/popup-blocked`**: Code automatically falls back to redirect flow
3. **Admin SDK errors**: Verify service account credentials in `.env`
4. **Token verification fails**: Check `FIREBASE_PRIVATE_KEY` format (must include `\n`)

See `FIREBASE_GOOGLE_SIGNIN_TROUBLESHOOTING.md` for detailed troubleshooting.

## Summary

✅ Client-side Firebase config added to `.env`  
✅ Firebase packages already installed  
⏳ **Next**: Set up Firebase Admin SDK service account (see steps above)  
⏳ **Next**: Add `pholio.studio` to authorized domains in Firebase Console  
⏳ **Next**: Configure OAuth redirect URIs in Google Cloud Console

