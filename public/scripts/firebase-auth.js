// Firebase Authentication client-side handling
(function() {
  // Wait for Firebase SDK to load
  if (typeof firebase === 'undefined') {
    console.error('[Firebase Auth] Firebase SDK not loaded. Make sure to include Firebase SDK scripts before this file.');
    return;
  }

  // Initialize Firebase App
  let app;
  let auth;
  
  try {
    const config = window.FIREBASE_CONFIG;
    if (!config || !config.apiKey || !config.authDomain || !config.projectId) {
      console.error('[Firebase Auth] Firebase configuration not found or incomplete.');
      console.error('[Firebase Auth] Missing values:', {
        apiKey: !config || !config.apiKey,
        authDomain: !config || !config.authDomain,
        projectId: !config || !config.projectId,
        config: config
      });
      console.error('[Firebase Auth] Make sure Firebase environment variables are set in your deployment environment.');
      // Don't set window.FirebaseAuth if config is invalid - this will trigger the error message
      return;
    }
    
    app = firebase.initializeApp(config);
    auth = app.auth();
    console.log('[Firebase Auth] Initialized successfully');
  } catch (error) {
    console.error('[Firebase Auth] Initialization error:', error);
    // Don't set window.FirebaseAuth if initialization fails
    return;
  }

  // Export auth instance
  window.FirebaseAuth = {
    auth: auth,
    app: app,

    /**
     * Sign up a new user with email and password
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<firebase.auth.UserCredential>}
     */
    signUp: async function(email, password) {
      if (!auth) {
        throw new Error('Firebase Auth not initialized');
      }
      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
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
     * @returns {Promise<firebase.auth.UserCredential>}
     */
    signIn: async function(email, password) {
      if (!auth) {
        throw new Error('Firebase Auth not initialized');
      }
      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
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
      if (!auth) {
        throw new Error('Firebase Auth not initialized');
      }
      try {
        await auth.signOut();
        console.log('[Firebase Auth] User signed out');
      } catch (error) {
        console.error('[Firebase Auth] Sign out error:', error);
        throw error;
      }
    },

    /**
     * Get the current user's ID token
     * @returns {Promise<string>} Firebase ID token
     */
    getIdToken: async function() {
      if (!auth || !auth.currentUser) {
        return null;
      }
      try {
        const token = await auth.currentUser.getIdToken();
        return token;
      } catch (error) {
        console.error('[Firebase Auth] Get ID token error:', error);
        return null;
      }
    },

    /**
     * Get the current authenticated user
     * @returns {firebase.User|null}
     */
    getCurrentUser: function() {
      if (!auth) {
        return null;
      }
      return auth.currentUser;
    },

    /**
     * Listen for authentication state changes
     * @param {function} callback - Callback function(user)
     */
    onAuthStateChanged: function(callback) {
      if (!auth) {
        return;
      }
      auth.onAuthStateChanged(callback);
    },

    /**
     * Send password reset email
     * @param {string} email - User email
     */
    sendPasswordResetEmail: async function(email) {
      if (!auth) {
        throw new Error('Firebase Auth not initialized');
      }
      try {
        await auth.sendPasswordResetEmail(email);
        console.log('[Firebase Auth] Password reset email sent');
      } catch (error) {
        console.error('[Firebase Auth] Send password reset email error:', error);
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
      'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
      'auth/network-request-failed': 'Network error. Please check your connection.',
      'auth/requires-recent-login': 'Please sign in again to complete this action.'
    };

    return errorMessages[error.code] || error.message || 'An authentication error occurred. Please try again.';
  };
})();

