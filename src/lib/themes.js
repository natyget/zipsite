/**
 * PDF Theme Definitions
 * Each theme has: name, background, text, accent, and isPro flag
 */
const themes = {
  ink: {
    name: 'Ink',
    background: '#F8F8F8',
    text: '#111111',
    accent: '#1C1C1C',
    isPro: false
  },
  noir: {
    name: 'Noir',
    background: '#1C1C1C',
    text: '#FFFFFF',
    accent: '#E5E5E5',
    isPro: true
  },
  studio: {
    name: 'Studio',
    background: '#F4F2F0',
    text: '#2D2D2D',
    accent: '#C9A55A',
    isPro: true
  },
  paper: {
    name: 'Paper',
    background: '#FAF9F7',
    text: '#3A3A3A',
    accent: '#8B7355',
    isPro: false
  },
  slate: {
    name: 'Slate',
    background: '#2C3E50',
    text: '#ECF0F1',
    accent: '#95A5A6',
    isPro: true
  },
  archive: {
    name: 'Archive',
    background: '#F5E6D3',
    text: '#3D2817',
    accent: '#8B6F47',
    isPro: true
  }
};

/**
 * Get theme by key
 */
function getTheme(key) {
  return themes[key] || themes.ink;
}

/**
 * Get all themes
 */
function getAllThemes() {
  return themes;
}

/**
 * Check if theme is Pro-only
 */
function isProTheme(key) {
  return themes[key]?.isPro === true;
}

/**
 * Get default theme
 */
function getDefaultTheme() {
  return 'ink';
}

module.exports = {
  themes,
  getTheme,
  getAllThemes,
  isProTheme,
  getDefaultTheme
};

