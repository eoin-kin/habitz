export const colors = {
  // Dark mode - using the custom palette from style.jsx
  dark: {
    bg: {
      primary: '#1F1B24',    // neutral-900 - main backgrounds
      secondary: '#2D2833',  // neutral-800 - secondary backgrounds, cards
      tertiary: '#6E6A75',   // neutral-500 - tertiary, disabled states
    },
    text: {
      primary: '#F5F3F7',    // neutral-100 - main text
      secondary: '#E6D4F5',  // primary-subtle - secondary text, labels
      tertiary: '#B97CE0',   // primary-light - tertiary text, placeholders
    },
    border: '#6E6A75',       // neutral-500
    input: '#2D2833',        // form input background
  },
  // Light mode (fallback)
  light: {
    bg: {
      primary: '#F5F3F7',    // neutral-100
      secondary: '#FFFFFF',  // neutral-0
      tertiary: '#E6D4F5',   // primary-subtle
    },
    text: {
      primary: '#1F1B24',    // neutral-900
      secondary: '#2D2833',  // neutral-800
      tertiary: '#6E6A75',   // neutral-500
    },
    border: '#B97CE0',       // primary-light
    input: '#FFFFFF',
  },
  // Brand colors from style.jsx
  primary: '#A05CD0',        // primary DEFAULT
  primaryDark: '#8E4BC2',    // primary dark
  primaryLight: '#B97CE0',   // primary light
  primarySubtle: '#E6D4F5',  // primary subtle
  accent: {
    green: '#5CD0A0',
    pink: '#D05CA0',
  },
  // Semantic colors
  error: '#D05CA0',          // using accent pink for errors
  success: '#5CD0A0',        // using accent green for success
  warning: '#A05CD0',        // using primary for warnings
};

export const theme = colors.dark;
