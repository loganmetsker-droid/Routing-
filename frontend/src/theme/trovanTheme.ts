import { alpha, createTheme } from '@mui/material/styles';
import { trovanColors, trovanLayout, trovanShadows } from './designTokens';

export const trovanTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: trovanColors.copper[500],
      light: trovanColors.copper[300],
      dark: trovanColors.copper[700],
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: trovanColors.stone[700],
      light: trovanColors.stone[400],
      dark: trovanColors.stone[900],
      contrastText: '#FFFFFF',
    },
    success: { main: trovanColors.semantic.success },
    warning: { main: trovanColors.semantic.warning },
    error: { main: trovanColors.semantic.danger },
    info: { main: trovanColors.semantic.info },
    background: {
      default: trovanColors.stone[50],
      paper: '#FFFFFF',
    },
    text: {
      primary: trovanColors.stone[900],
      secondary: trovanColors.stone[600],
    },
    divider: trovanColors.utility.border,
  },
  shape: {
    borderRadius: trovanLayout.panelRadius,
  },
  typography: {
    fontFamily: [
      'Inter',
      'ui-sans-serif',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'sans-serif',
    ].join(','),
    h1: { fontSize: '2rem', lineHeight: 1.15, fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.625rem', lineHeight: 1.2, fontWeight: 700, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.25rem', lineHeight: 1.25, fontWeight: 700, letterSpacing: '-0.01em' },
    h4: { fontSize: '1.1rem', lineHeight: 1.3, fontWeight: 700 },
    h5: { fontSize: '1rem', lineHeight: 1.35, fontWeight: 700 },
    h6: { fontSize: '0.95rem', lineHeight: 1.35, fontWeight: 700 },
    body1: { fontSize: '0.95rem', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', lineHeight: 1.55 },
    subtitle1: { fontSize: '0.95rem', lineHeight: 1.45, fontWeight: 600 },
    subtitle2: {
      fontSize: '0.8rem',
      lineHeight: 1.4,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'light',
        },
        html: {
          backgroundColor: trovanColors.stone[50],
        },
        body: {
          backgroundColor: trovanColors.stone[50],
          color: trovanColors.stone[900],
        },
        '#root': {
          minHeight: '100vh',
          backgroundColor: trovanColors.stone[50],
        },
        '*': {
          boxSizing: 'border-box',
        },
        '.leaflet-container': {
          fontFamily: 'inherit',
          background: trovanColors.stone[75],
          borderRadius: `${trovanLayout.panelRadius}px`,
        },
        '.leaflet-control-zoom': {
          border: `1px solid ${trovanColors.utility.border} !important`,
          boxShadow: trovanShadows.soft,
          overflow: 'hidden',
          borderRadius: '14px',
        },
        '.leaflet-control-zoom a': {
          color: trovanColors.stone[900],
          background: '#FFFFFF',
          borderBottom: `1px solid ${trovanColors.utility.border} !important`,
        },
        '.leaflet-control-zoom a:last-of-type': {
          borderBottom: 'none !important',
        },
        '.leaflet-popup-content-wrapper': {
          borderRadius: '16px',
          border: `1px solid ${trovanColors.utility.border}`,
          boxShadow: trovanShadows.soft,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          width: trovanLayout.sidebarWidth,
          backgroundColor: trovanColors.stone[75],
          backgroundImage: 'none',
          borderRight: `1px solid ${trovanColors.utility.border}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#FFFFFF', 0.82),
          color: trovanColors.stone[900],
          boxShadow: 'none',
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${trovanColors.utility.border}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${trovanColors.utility.border}`,
          boxShadow: 'none',
        },
        rounded: {
          borderRadius: trovanLayout.panelRadius,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${trovanColors.utility.border}`,
          boxShadow: 'none',
          borderRadius: trovanLayout.panelRadius,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 40,
          borderRadius: trovanLayout.controlRadius,
          paddingInline: 16,
          boxShadow: 'none',
        },
        containedPrimary: {
          background: trovanColors.copper[500],
          color: '#FFFFFF',
          '&:hover': {
            background: trovanColors.copper[600],
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: trovanColors.utility.borderStrong,
          color: trovanColors.stone[900],
          backgroundColor: '#FFFFFF',
          '&:hover': {
            borderColor: trovanColors.copper[300],
            backgroundColor: trovanColors.utility.selectedTint,
          },
        },
        text: {
          color: trovanColors.stone[700],
          '&:hover': {
            backgroundColor: trovanColors.utility.selectedTint,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
        },
        filledPrimary: {
          backgroundColor: trovanColors.utility.selectedTint,
          color: trovanColors.copper[700],
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 14,
          marginBottom: 4,
          paddingInline: 12,
          '&.Mui-selected': {
            backgroundColor: trovanColors.utility.selectedTint,
            color: trovanColors.copper[700],
            border: `1px solid ${trovanColors.copper[200]}`,
          },
          '&.Mui-selected:hover': {
            backgroundColor: trovanColors.utility.selectedTint,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: trovanColors.stone[600],
          fontWeight: 700,
          backgroundColor: trovanColors.stone[25],
          borderBottom: `1px solid ${trovanColors.utility.border}`,
        },
        body: {
          borderBottom: `1px solid ${trovanColors.utility.border}`,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          height: 3,
          borderRadius: 999,
          backgroundColor: trovanColors.copper[500],
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          minHeight: 44,
          fontWeight: 600,
          color: trovanColors.stone[600],
          '&.Mui-selected': {
            color: trovanColors.stone[900],
          },
        },
      },
    },
  },
});
