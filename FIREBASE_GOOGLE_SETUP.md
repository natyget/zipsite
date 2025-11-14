# Firebase Google Sign-In Setup Guide

This guide explains how to enable Google Sign-In in Firebase Authentication.

## Steps to Enable Google Sign-In

### 1. Enable Google Sign-In Provider in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **zipsite-78e85**
3. Click **Authentication** in the left menu
4. Go to **Sign-in method** tab
5. Find **Google** in the list of providers
6. Click on **Google**
7. Enable the toggle switch (turn it ON)
8. Select a **Project support email** (this is required)
   - Choose your email address from the dropdown
   - Or enter a custom email if you're the project owner
9. Click **Save**

### 2. Authorized Domains

Firebase automatically authorizes your Firebase project domain. For production, you may need to add additional authorized domains:

1. In the **Sign-in method** tab, scroll down to **Authorized domains**
2. Click **Add domain**
3. Add your production domain (e.g., `zipsitestudio.com` or `your-site.netlify.app`)
4. Click **Add**

### 3. Configure OAuth Consent Screen (if needed)

If you see errors about OAuth consent screen:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **zipsite-78e85**
3. Navigate to **APIs & Services** → **OAuth consent screen**
4. Configure the consent screen:
   - User Type: **External** (for most cases) or **Internal** (for Google Workspace)
   - App name: **ZipSite** (or your preferred name)
   - User support email: Your email
   - Developer contact information: Your email
   - Add your domain to authorized domains if needed
5. Click **Save and Continue**
6. Add scopes (if needed):
   - Email
   - Profile
7. Click **Save and Continue**
8. Add test users (if in Testing mode)
9. Submit for verification (if publishing to production)

### 4. Verify Setup

After enabling Google Sign-In:

1. Visit your login page: `/login`
2. You should see a "Sign in with Google" button
3. Click the button
4. A popup should open with Google Sign-In
5. Sign in with your Google account
6. You should be redirected to your dashboard

## Troubleshooting

### "Error: auth/popup-blocked"

- The popup was blocked by the browser
- Solution: Allow popups for your domain in browser settings

### "Error: auth/popup-closed-by-user"

- The user closed the popup before completing sign-in
- Solution: This is normal user behavior, just inform them they need to complete the flow

### "Error: auth/unauthorized-domain"

- The domain is not authorized in Firebase
- Solution: Add your domain to authorized domains in Firebase Console → Authentication → Settings → Authorized domains

### "Error: OAuth client not found"

- Google OAuth credentials are missing
- Solution: Make sure Google Sign-In is enabled in Firebase Console → Authentication → Sign-in method → Google

### "Error: access_denied"

- The OAuth consent screen is not configured or the app is in restricted mode
- Solution: Configure the OAuth consent screen in Google Cloud Console

## Testing

1. **Test with existing user**: If a user already signed up with email/password, they can also use Google Sign-In if they use the same email address
2. **Test with new user**: A new user can sign in with Google, and an account will be created automatically (if your backend handles this)
3. **Test email linking**: If a user has both email/password and Google accounts with the same email, Firebase may link them automatically

## Notes

- Google Sign-In uses popup authentication by default
- The same Firebase ID token is used for both email/password and Google Sign-In
- Your existing backend authentication should work without changes since both methods provide Firebase ID tokens
- If you want to allow users to link multiple auth providers to one account, you may need additional backend logic

