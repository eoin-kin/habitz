export const colors = {
  // Dark mode
  dark: {
    bg: {
      primary: '#0F172A',    // Darkest - main backgrounds
      secondary: '#1E293B',  // Secondary backgrounds, cards
      tertiary: '#334155',   // Tertiary, disabled states
    },
    text: {
      primary: '#F1F5F9',    // Main text
      secondary: '#CBD5E1',  // Secondary text, labels
      tertiary: '#94A3B8',   // Tertiary text, placeholders
    },
    border: '#475569',
    input: '#1E293B',
  },
  // Light mode (fallback)
  light: {
    bg: {
      primary: '#F8FAFC',
      secondary: '#fff',
      tertiary: '#F1F5F9',
    },
    text: {
      primary: '#0F172A',
      secondary: '#64748B',
      tertiary: '#94A3B8',
    },
    border: '#E2E8F0',
    input: '#fff',
  },
  // Brand color
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
};

export const theme = colors.dark;
