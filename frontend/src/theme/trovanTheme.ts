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
  const backgroundDefault = isDark ? '#16110E' : '#E7E5E0';
  const backgroundPaper = isDark ? trovanColors.utility.panel : '#F8F7F3';
  const textPrimary = isDark ? '#FFF8ED' : '#17110D';
  const textSecondary = isDark ? 'rgba(255, 248, 237, 0.66)' : 'rgba(23, 17, 13, 0.64)';
  const divider = isDark ? trovanColors.utility.border : 'rgba(32, 24, 18, 0.13)';
  const selectedTint = isDark ? trovanColors.utility.selectedTint : alpha(trovanColors.copper[500], 0.12);
  const mapBg = trovanColors.utility.mapCanvas;
  const bodyBackground = isDark
    ? `radial-gradient(circle at top left, ${alpha(trovanColors.copper[500], 0.2)}, transparent 28%), linear-gradient(180deg, #16110E 0%, #211914 52%, #120E0B 100%)`
    : `radial-gradient(circle at top left, ${alpha(trovanColors.copper[500], 0.12)}, transparent 30%), linear-gradient(180deg, #F3F2EF 0%, #E7E5E0 48%, #DAD6CF 100%)`;

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
            background: bodyBackground,
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
            filter: 'saturate(0.72) brightness(1.03) contrast(0.96) sepia(0.08)',
          },
          '.trovan-map .leaflet-overlay-pane path': {
            filter: `drop-shadow(0 2px 5px ${alpha(trovanColors.black[950], 0.18)})`,
          },
          '.leaflet-control-zoom': {
            border: `1px solid ${isDark ? trovanColors.utility.borderStrong : 'rgba(32,24,18,0.16)'} !important`,
            boxShadow: trovanShadows.soft,
            overflow: 'hidden',
            borderRadius: '10px',
          },
          '.leaflet-control-zoom a': {
            color: textPrimary,
            background: alpha(backgroundPaper, 0.88),
            borderBottom: `1px solid ${trovanColors.utility.border} !important`,
            backdropFilter: 'blur(14px)',
          },
          '.leaflet-control-zoom a:last-of-type': {
            borderBottom: 'none !important',
          },
          '.leaflet-control-attribution': {
            display: 'none !important',
          },
          '.leaflet-popup-content-wrapper': {
            borderRadius: '12px',
            border: `1px solid ${trovanColors.utility.borderStrong}`,
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
            fontWeight: 750,
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
            borderColor: isDark ? trovanColors.utility.borderStrong : 'rgba(32,24,18,0.18)',
            color: textPrimary,
            backgroundColor: isDark ? alpha('#FFF8ED', 0.035) : alpha('#FFFFFF', 0.42),
            '&:hover': {
              borderColor: isDark ? trovanColors.copper[300] : trovanColors.copper[500],
              backgroundColor: alpha(trovanColors.copper[500], 0.08),
            },
          },
          text: {
            color: isDark ? alpha('#FFF8ED', 0.82) : alpha(trovanColors.black[900], 0.78),
            '&:hover': {
              backgroundColor: alpha(trovanColors.copper[500], 0.08),
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 5,
            height: 22,
            fontWeight: 700,
            maxWidth: '100%',
            fontSize: '0.64rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            '.MuiChip-label': {
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              paddingInline: 8,
            },
          },
          sizeSmall: {
            height: 19,
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
            borderRadius: 6,
            marginBottom: 4,
            paddingInline: 12,
            '&.Mui-selected': {
              backgroundColor: selectedTint,
              color: isDark ? '#FFFFFF' : trovanColors.copper[800],
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
            backgroundColor: isDark ? alpha('#FFF8ED', 0.035) : alpha(trovanColors.black[900], 0.035),
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

export const trovanTheme = createTrovanTheme('dark');
