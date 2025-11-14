// Firebase Authentication client-side handling - ES Module
// Import Firebase Auth functions from CDN
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail as sendPasswordReset,
  onAuthStateChanged as onAuthStateChangedFn
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Wait for auth instance to be initialized in layout.ejs
function waitForAuth() {
  return new Promise((resolve, reject) => {
    if (window.firebaseAuth) {
      resolve(window.firebaseAuth);
      return;
    }
    
    // Poll for auth instance (Firebase initialization is in layout.ejs)
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max
    const interval = setInterval(() => {
      attempts++;
      if (window.firebaseAuth) {
        clearInterval(interval);
        resolve(window.firebaseAuth);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        reject(new Error('Firebase Auth not initialized. Make sure Firebase is properly configured.'));
      }
    }, 100);
  });
}

// Get auth instance (with retry logic)
async function getAuthInstance() {
  try {
    return await waitForAuth();
  } catch (error) {
    console.error('[Firebase Auth] Failed to get auth instance:', error);
    throw error;
  }
}

// Export auth functions to window.FirebaseAuth for compatibility
window.FirebaseAuth = {
  /**
   * Get the auth instance
   * @returns {Promise<Auth>}
   */
  getAuth: async function() {
    return await getAuthInstance();
  },

  /**
   * Sign up a new user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<UserCredential>}
   */
  signUp: async function(email, password) {
    try {
      const auth = await getAuthInstance();
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('[Firebase Auth] User created:', userCredential.user.uid);
      return userCredential;
    } catch (error) {
      console.error('[Firebase Auth] Sign up error:', error);
      throw error;
    }
  },

  /**
   * Sign in an existing user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<UserCredential>}
   */
  signIn: async function(email, password) {
    try {
      const auth = await getAuthInstance();
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('[Firebase Auth] User signed in:', userCredential.user.uid);
      return userCredential;
    } catch (error) {
      console.error('[Firebase Auth] Sign in error:', error);
      throw error;
    }
  },

  /**
   * Sign out the current user
   */
  signOut: async function() {
    try {
      const auth = await getAuthInstance();
      await firebaseSignOut(auth);
      console.log('[Firebase Auth] User signed out');
    } catch (error) {
      console.error('[Firebase Auth] Sign out error:', error);
      throw error;
    }
  },

  /**
   * Get auth instance (for compatibility)
   * @deprecated Use getAuth() instead
   */
  get auth() {
    return window.firebaseAuth || null;
  },

  /**
   * Get the current user's ID token
   * @returns {Promise<string|null>} Firebase ID token
   */
  getIdToken: async function() {
    try {
      const auth = await getAuthInstance();
      if (!auth.currentUser) {
        return null;
      }
      const token = await auth.currentUser.getIdToken();
      return token;
    } catch (error) {
      console.error('[Firebase Auth] Get ID token error:', error);
      return null;
    }
  },

  /**
   * Get the current authenticated user
   * @returns {Promise<User|null>}
   */
  getCurrentUser: async function() {
    try {
      const auth = await getAuthInstance();
      return auth.currentUser;
    } catch (error) {
      console.error('[Firebase Auth] Get current user error:', error);
      return null;
    }
  },

  /**
   * Listen for authentication state changes
   * @param {function} callback - Callback function(user)
   */
  onAuthStateChanged: async function(callback) {
    try {
      const auth = await getAuthInstance();
      return onAuthStateChangedFn(auth, callback);
    } catch (error) {
      console.error('[Firebase Auth] onAuthStateChanged error:', error);
    }
  },

  /**
   * Send password reset email
   * @param {string} email - User email
   */
  sendPasswordResetEmail: async function(email) {
    try {
      const auth = await getAuthInstance();
      await sendPasswordReset(auth, email);
      console.log('[Firebase Auth] Password reset email sent');
    } catch (error) {
      console.error('[Firebase Auth] Send password reset email error:', error);
      throw error;
    }
  },

  /**
   * Sign in with Google using popup
   * @returns {Promise<UserCredential>}
   */
  signInWithGoogle: async function() {
    try {
      const auth = await getAuthInstance();
      const provider = new GoogleAuthProvider();
      
      // Request additional scopes if needed
      provider.addScope('profile');
      provider.addScope('email');
      
      // Set custom parameters
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Try popup sign-in
      try {
        const userCredential = await signInWithPopup(auth, provider);
        console.log('[Firebase Auth] User signed in with Google:', userCredential.user.uid);
        return userCredential;
      } catch (popupError) {
        // If popup fails (blocked or closed), check the error code
        if (popupError.code === 'auth/popup-blocked') {
          console.warn('[Firebase Auth] Popup blocked, user may need to allow popups');
          throw popupError;
        } else if (popupError.code === 'auth/popup-closed-by-user') {
          console.log('[Firebase Auth] Popup closed by user');
          throw popupError;
        } else {
          // Re-throw other errors
          throw popupError;
        }
      }
    } catch (error) {
      console.error('[Firebase Auth] Google Sign-In error:', error);
      throw error;
    }
  }
};

// Helper function to get Firebase error message
window.getFirebaseErrorMessage = function(error) {
  if (!error || !error.code) {
    return 'An authentication error occurred. Please try again.';
  }

  const errorMessages = {
    'auth/email-already-in-use': 'That email is already registered.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/operation-not-allowed': 'Email/password accounts are not enabled. Please contact support.',
    'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/popup-closed-by-user': 'Sign-in popup was closed. Please try again.',
    'auth/popup-blocked': 'Sign-in popup was blocked. Please allow popups for this site.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/requires-recent-login': 'Please sign in again to complete this action.'
  };

  return errorMessages[error.code] || error.message || 'An authentication error occurred. Please try again.';
};

console.log('[Firebase Auth] Module loaded. Waiting for Firebase initialization...');
