import { alpha, createTheme } from '@mui/material/styles';
import {
  trovanColors,
  trovanLayout,
  trovanShadows,
  trovanTypography,
} from './designTokens';

export type TrovanThemeMode = 'light' | 'dark';

const baseTypography = {
  fontFamily: [
    trovanTypography.uiFontFamily,
  ].join(','),
  h1: {
    fontSize: '2.08rem',
    lineHeight: 1.04,
    fontWeight: 700,
    letterSpacing: '-0.034em',
  },
  h2: {
    fontSize: '1.62rem',
    lineHeight: 1.08,
    fontWeight: 700,
    letterSpacing: '-0.03em',
  },
  h3: {
    fontSize: '1.26rem',
    lineHeight: 1.14,
    fontWeight: 700,
    letterSpacing: '-0.024em',
  },
  h4: {
    fontSize: '1.03rem',
    lineHeight: 1.18,
    fontWeight: 700,
  },
  h5: { fontSize: '0.95rem', lineHeight: 1.24, fontWeight: 700 },
  h6: { fontSize: '0.88rem', lineHeight: 1.28, fontWeight: 700 },
  body1: { fontSize: '0.93rem', lineHeight: 1.56 },
  body2: { fontSize: '0.82rem', lineHeight: 1.5 },
  subtitle1: { fontSize: '0.9rem', lineHeight: 1.38, fontWeight: 600 },
  subtitle2: {
    fontSize: '0.72rem',
    lineHeight: 1.35,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.13em',
  },
  button: { textTransform: 'none', fontWeight: 700, letterSpacing: '0.005em' },
} as const;

export function createTrovanTheme(mode: TrovanThemeMode = 'light') {
  const isDark = mode === 'dark';
  const backgroundDefault = isDark ? '#0A1016' : '#F8F3EC';
  const backgroundPaper = isDark ? '#111923' : '#FFFDFC';
  const textPrimary = isDark ? '#F6F8FB' : trovanColors.stone[900];
  const textSecondary = isDark ? 'rgba(230, 236, 244, 0.68)' : trovanColors.stone[600];
  const divider = isDark ? 'rgba(255,255,255,0.09)' : trovanColors.utility.border;
  const selectedTint = isDark
    ? alpha(trovanColors.copper[500], 0.22)
    : trovanColors.utility.selectedTint;
  const mapBg = isDark ? '#0E1720' : trovanColors.utility.mapCanvas;

  return createTheme({
    palette: {
      mode,
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
        default: backgroundDefault,
        paper: backgroundPaper,
      },
      text: {
        primary: textPrimary,
        secondary: textSecondary,
      },
      divider,
    },
    shape: {
      borderRadius: trovanLayout.panelRadius,
    },
    typography: baseTypography,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: mode,
          },
          html: {
            backgroundColor: backgroundDefault,
          },
          body: {
            background: isDark
              ? backgroundDefault
              : `radial-gradient(circle at top left, ${alpha(
                  '#FFF6EE',
                  0.92,
                )} 0%, ${alpha('#F8F3EC', 0)} 34%), linear-gradient(180deg, #FBF7F1 0%, #F6F0E8 100%)`,
            color: textPrimary,
          },
          '#root': {
            minHeight: '100vh',
            backgroundColor: 'transparent',
          },
          '*': {
            boxSizing: 'border-box',
          },
          '.trovan-wordmark': {
            fontFamily: trovanTypography.brandFontFamily,
            letterSpacing: '0.07em',
          },
          '::selection': {
            backgroundColor: alpha(trovanColors.copper[500], 0.18),
          },
          '.leaflet-container': {
            fontFamily: 'inherit',
            background: mapBg,
            borderRadius: `${trovanLayout.innerRadius}px`,
          },
          '.trovan-map .leaflet-tile-pane': {
            filter: 'saturate(0.72) brightness(1.03) contrast(0.9) sepia(0.12)',
          },
          '.trovan-map .leaflet-overlay-pane path': {
            filter: `drop-shadow(0 0 6px ${alpha(trovanColors.stone[900], 0.08)})`,
          },
          '.leaflet-control-zoom': {
            border: `1px solid ${alpha(trovanColors.stone[700], 0.12)} !important`,
            boxShadow: trovanShadows.soft,
            overflow: 'hidden',
            borderRadius: '10px',
          },
          '.leaflet-control-zoom a': {
            color: textPrimary,
            background: alpha(backgroundPaper, 0.88),
            borderBottom: `1px solid ${alpha(trovanColors.stone[700], 0.1)} !important`,
            backdropFilter: 'blur(14px)',
          },
          '.leaflet-control-zoom a:last-of-type': {
            borderBottom: 'none !important',
          },
          '.leaflet-control-attribution': {
            display: 'none !important',
          },
          '.leaflet-popup-content-wrapper': {
            borderRadius: '16px',
            border: `1px solid ${alpha(trovanColors.stone[700], 0.12)}`,
            boxShadow: trovanShadows.soft,
            backgroundColor: alpha(backgroundPaper, 0.9),
            color: textPrimary,
            backdropFilter: 'blur(18px)',
          },
          '.leaflet-popup-tip': {
            backgroundColor: alpha(backgroundPaper, 0.9),
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${divider}`,
            boxShadow: trovanShadows.soft,
            backgroundColor: backgroundPaper,
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
            border: `1px solid ${divider}`,
            boxShadow: trovanShadows.soft,
            borderRadius: trovanLayout.panelRadius,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 36,
            borderRadius: trovanLayout.controlRadius,
            paddingInline: 12,
            boxShadow: 'none',
          },
          containedPrimary: {
            background: `linear-gradient(135deg, ${trovanColors.copper[500]}, ${trovanColors.copper[600]})`,
            color: '#FFFFFF',
            '&:hover': {
              background: trovanColors.copper[600],
              boxShadow: 'none',
            },
          },
          outlined: {
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : trovanColors.utility.borderStrong,
            color: textPrimary,
            backgroundColor: isDark ? alpha('#FFFFFF', 0.02) : alpha('#FFFDFC', 0.78),
            '&:hover': {
              borderColor: trovanColors.copper[300],
              backgroundColor: alpha(trovanColors.copper[500], 0.08),
            },
          },
          text: {
            color: isDark ? alpha('#FFFFFF', 0.82) : trovanColors.stone[700],
            '&:hover': {
              backgroundColor: alpha(trovanColors.copper[500], 0.08),
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 7,
            height: 24,
            fontWeight: 700,
            maxWidth: '100%',
            fontSize: '0.67rem',
            letterSpacing: '0.04em',
            '.MuiChip-label': {
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              paddingInline: 8,
            },
          },
          sizeSmall: {
            height: 20,
            fontSize: '0.62rem',
            '.MuiChip-label': {
              paddingInline: 6,
            },
          },
          filledPrimary: {
            backgroundColor: alpha(trovanColors.copper[500], 0.1),
            color: isDark ? trovanColors.copper[200] : trovanColors.copper[700],
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            minHeight: 40,
            borderRadius: 7,
            marginBottom: 4,
            paddingInline: 12,
            '&.Mui-selected': {
              backgroundColor: selectedTint,
              color: isDark ? '#FFFFFF' : trovanColors.copper[700],
              border: `1px solid ${alpha(trovanColors.copper[300], 0.34)}`,
            },
            '&.Mui-selected:hover': {
              backgroundColor: selectedTint,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            color: textSecondary,
            fontWeight: 700,
            backgroundColor: isDark ? alpha('#FFFFFF', 0.03) : alpha('#F7F1EA', 0.88),
            borderBottom: `1px solid ${divider}`,
          },
          body: {
            borderBottom: `1px solid ${divider}`,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            height: 2,
            borderRadius: 999,
            backgroundColor: trovanColors.copper[500],
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            minHeight: 40,
            fontWeight: 700,
            color: textSecondary,
            '&.Mui-selected': {
              color: textPrimary,
            },
          },
        },
      },
    },
  });
}

export const trovanTheme = createTrovanTheme('light');
