import { createTheme } from '@mui/material/styles';

// TablePulse SaaS theme — Zomato-grade polish, own identity.
// Brand: warm "tandoor orange" (distinct from Zomato red).
// Classic (non-CSS-vars) themes built per mode by buildTheme(mode),
// so `theme.palette.*` is always the ACTIVE scheme — no frozen values.
// Breakpoints align with Tailwind defaults: sm 640 / md 768 / lg 1024 / xl 1280.
const FONT = '"Plus Jakarta Sans", system-ui, "Segoe UI", Roboto, "Noto Sans", sans-serif';

const COMMON = {
  shape: { borderRadius: 16 },
  typography: {
    fontFamily: FONT,
    h1: { fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05 },
    h2: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15 },
    h3: { fontWeight: 700, letterSpacing: '-0.015em' },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 700 },
    button: { fontWeight: 700 },
  },
  shadows: [
    'none',
    '0 1px 2px rgba(28,25,23,0.05)',
    '0 1px 3px rgba(28,25,23,0.07), 0 1px 2px rgba(28,25,23,0.05)',
    '0 4px 12px -2px rgba(28,25,23,0.08)',
    '0 8px 24px -4px rgba(28,25,23,0.10)',
    '0 12px 32px -6px rgba(28,25,23,0.12)',
    '0 16px 40px -12px rgba(28,25,23,0.16)',
    ...Array(19).fill('0 16px 48px -8px rgba(28,25,23,0.14)'),
  ],
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 700, minHeight: 44, borderRadius: 12 },
        containedPrimary: {
          backgroundImage: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
        },
      },
    },
    MuiTextField: { defaultProps: { fullWidth: true, size: 'medium' } },
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 20,
          border: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    MuiSkeleton: {
      styleOverrides: {
        root: { borderRadius: 12 },
        text: { borderRadius: 6 },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          backgroundColor: 'transparent',
          boxShadow: 'none',
          '&:before': { display: 'none' },
          borderTop: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundImage: 'none',
          ...(theme.palette.mode === 'light'
            ? {
                backgroundColor: 'rgba(255,255,255,0.85)',
                color: theme.palette.text.primary,
                backdropFilter: 'blur(12px)',
                borderBottom: `1px solid ${theme.palette.divider}`,
              }
            : {
                backgroundColor: 'rgba(20,17,16,0.85)',
                color: theme.palette.text.primary,
                backdropFilter: 'blur(12px)',
                borderBottom: `1px solid ${theme.palette.divider}`,
              }),
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          backgroundImage: 'none',
          backgroundColor: theme.palette.background.paper,
          borderRight: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
  },
};

const PALETTES = {
  light: {
    mode: 'light',
    primary: { main: '#c2410c', light: '#ea580c', dark: '#9a3412', contrastText: '#fff' },
    secondary: { main: '#0f766e', light: '#14b8a6', dark: '#115e59', contrastText: '#fff' },
    background: { default: '#faf7f2', paper: '#ffffff' },
    text: { primary: '#1c1917', secondary: '#78716c' },
    divider: 'rgba(28, 25, 23, 0.08)',
    success: { main: '#15803d' },
    warning: { main: '#b45309' },
  },
  dark: {
    mode: 'dark',
    primary: { main: '#fb923c', light: '#fdba74', dark: '#ea580c', contrastText: '#1c0a00' },
    secondary: { main: '#2dd4bf', contrastText: '#04211e' },
    background: { default: '#141110', paper: '#1e1a17' },
    text: { primary: '#f5f0eb', secondary: '#a8a29e' },
    divider: 'rgba(245, 240, 235, 0.1)',
  },
};

export function buildTheme(mode) {
  return createTheme({ ...COMMON, palette: PALETTES[mode] ?? PALETTES.light });
}
