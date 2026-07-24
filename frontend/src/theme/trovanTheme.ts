import { alpha, createTheme } from '@mui/material/styles';
import {
  trovanColors,
  trovanGradients,
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
    lineHeight: 1.08,
    fontWeight: 700,
    letterSpacing: '-0.025em',
  },
  h2: {
    fontSize: '1.62rem',
    lineHeight: 1.12,
    fontWeight: 700,
    letterSpacing: '-0.02em',
  },
  h3: {
    fontSize: '1.26rem',
    lineHeight: 1.14,
    fontWeight: 700,
    letterSpacing: 0,
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
  const surfaceTokens = isDark ? trovanColors.dark : trovanColors.light;
  const backgroundDefault = surfaceTokens.appBg;
  const backgroundPaper = surfaceTokens.surface;
  const surfaceAlt = surfaceTokens.surfaceAlt;
  const textPrimary = surfaceTokens.text;
  const textSecondary = surfaceTokens.muted;
  const divider = surfaceTokens.border;
  const selectedTint = isDark ? trovanColors.utility.selectedTint : alpha(trovanColors.copper[500], 0.12);
  const mapBg = isDark ? trovanColors.dark.panel : trovanColors.light.appBg;
  const bodyBackground = isDark
    ? `radial-gradient(circle at top left, ${alpha(trovanColors.copper[500], 0.16)}, transparent 28%), linear-gradient(180deg, ${trovanColors.dark.appBg} 0%, #0A1724 54%, ${trovanColors.dark.panel} 100%)`
    : trovanColors.light.appBg;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? trovanColors.copper[300] : trovanColors.copper[700],
        light: trovanColors.copper[300],
        dark: trovanColors.copper[700],
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: trovanColors.brand.navy900,
        light: trovanColors.brand.navy800,
        dark: trovanColors.brand.navy950,
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
      MuiTypography: {
        defaultProps: {
          // MUI maps subtitle variants to <h6> by default. Trovan uses those
          // variants for labels and metadata, so keep them out of the document
          // outline unless a component explicitly opts into a heading element.
          variantMapping: {
            h1: 'h1',
            h2: 'h2',
            h3: 'h3',
            h4: 'h4',
            h5: 'h5',
            h6: 'h6',
            subtitle1: 'p',
            subtitle2: 'p',
            body1: 'p',
            body2: 'p',
            inherit: 'p',
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: mode,
            '--trovan-copper': trovanColors.copper[500],
            '--trovan-copper-hover': trovanColors.copper[300],
            '--trovan-copper-pressed': trovanColors.copper[700],
            '--trovan-copper-soft': 'rgba(184, 115, 51, 0.16)',
            '--trovan-copper-line': 'rgba(184, 115, 51, 0.48)',
            '--trovan-deep-navy': trovanColors.brand.navy950,
            '--trovan-white': '#FFFFFF',
            '--trovan-charcoal': '#1C1C1E',
            '--app-bg': surfaceTokens.appBg,
            '--surface': surfaceTokens.surface,
            '--surface-alt': surfaceTokens.surfaceAlt,
            '--border': surfaceTokens.border,
            '--border-strong': surfaceTokens.borderStrong,
            '--text': surfaceTokens.text,
            '--muted': surfaceTokens.muted,
            '--sidebar-bg': surfaceTokens.sidebar,
            '--primary': trovanColors.copper[500],
          },
          'html': {
            backgroundColor: backgroundDefault,
          },
          'html[data-theme="light"]': {
            '--app-bg': trovanColors.light.appBg,
            '--surface': trovanColors.light.surface,
            '--surface-alt': trovanColors.light.surfaceAlt,
            '--border': trovanColors.light.border,
            '--border-strong': trovanColors.light.borderStrong,
            '--text': trovanColors.light.text,
            '--muted': trovanColors.light.muted,
            '--sidebar-bg': trovanColors.light.sidebar,
            '--primary': trovanColors.copper[500],
          },
          'html[data-theme="dark"]': {
            '--app-bg': trovanColors.dark.appBg,
            '--surface': trovanColors.dark.surface,
            '--surface-alt': trovanColors.dark.surfaceAlt,
            '--panel': trovanColors.dark.panel,
            '--border': trovanColors.dark.border,
            '--border-strong': trovanColors.dark.borderStrong,
            '--text': trovanColors.dark.text,
            '--muted': trovanColors.dark.muted,
            '--sidebar-bg': trovanColors.dark.sidebar,
            '--primary': trovanColors.copper[500],
          },
          body: {
            background: bodyBackground,
            color: textPrimary,
            fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
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
          'a': {
            color: trovanColors.copper[500],
          },
          'button, a, input, textarea, select': {
            WebkitTapHighlightColor: 'transparent',
          },
          '.leaflet-container': {
            fontFamily: 'inherit',
            background: mapBg,
            borderRadius: `${trovanLayout.innerRadius}px`,
          },
          '.trovan-map .leaflet-overlay-pane path': {
            filter: `drop-shadow(0 2px 5px ${alpha(trovanColors.brand.navy950, 0.18)})`,
          },
          '.leaflet-control-zoom': {
            border: `1px solid ${surfaceTokens.borderStrong} !important`,
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
          '@media (pointer: coarse)': {
            '.leaflet-control-zoom a': {
              width: '40px !important',
              height: '40px !important',
              lineHeight: '40px !important',
              fontSize: '20px !important',
            },
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
            backgroundClip: 'padding-box',
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
            transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 38,
            borderRadius: trovanLayout.controlRadius,
            paddingInline: 14,
            boxShadow: 'none',
            fontWeight: 750,
            transition: 'background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, color 150ms ease, transform 150ms ease',
            '&:focus-visible': {
              outline: 'none',
              boxShadow: trovanShadows.focus,
            },
            '&.Mui-disabled': {
              opacity: 0.58,
            },
          },
          sizeSmall: {
            minHeight: 34,
            paddingInline: 10,
            fontSize: '0.78rem',
          },
          containedPrimary: {
            background: trovanGradients.copper,
            color: '#FFFFFF',
            boxShadow: `0 1px 2px ${alpha(trovanColors.copper[900], 0.2)}, 0 6px 14px ${alpha(trovanColors.copper[600], 0.16)}`,
            '&:hover': {
              background: trovanGradients.copper,
              boxShadow: `0 2px 4px ${alpha(trovanColors.copper[900], 0.22)}, 0 9px 20px ${alpha(trovanColors.copper[600], 0.2)}`,
              transform: 'translateY(-1px)',
            },
            '&:active': { transform: 'translateY(0)' },
          },
          outlined: {
            borderColor: surfaceTokens.borderStrong,
            color: textPrimary,
            backgroundColor: isDark ? alpha('#FFFFFF', 0.035) : alpha('#FFFFFF', 0.72),
            '&:hover': {
              borderColor: isDark ? trovanColors.copper[300] : trovanColors.copper[500],
              backgroundColor: alpha(trovanColors.copper[500], 0.08),
            },
          },
          text: {
            color: isDark ? alpha(trovanColors.dark.text, 0.82) : alpha(trovanColors.light.text, 0.78),
            '&:hover': {
              backgroundColor: alpha(trovanColors.copper[500], 0.08),
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            height: 24,
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
            height: 21,
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
            fontWeight: 800,
            fontSize: '0.73rem',
            letterSpacing: '0.015em',
            backgroundColor: isDark ? trovanColors.dark.surfaceAlt : surfaceAlt,
            backgroundImage: 'none',
            borderBottom: `1px solid ${divider}`,
            boxShadow: `0 1px 0 ${divider}`,
            paddingBlock: 10,
            paddingInline: 14,
          },
          body: {
            borderBottom: `1px solid ${divider}`,
            paddingBlock: 10,
            paddingInline: 14,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 130ms ease',
            '&:last-of-type .MuiTableCell-body': { borderBottom: 0 },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 40,
            borderRadius: trovanLayout.controlRadius,
            backgroundColor: isDark ? alpha('#FFFFFF', 0.025) : alpha('#FFFFFF', 0.82),
            transition: 'background-color 150ms ease, box-shadow 150ms ease',
            '&:hover': {
              backgroundColor: isDark ? alpha('#FFFFFF', 0.04) : '#FFFFFF',
            },
            '&.Mui-focused': {
              boxShadow: trovanShadows.focus,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 1,
            },
          },
          input: {
            paddingBlock: 9.5,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease, transform 150ms ease',
            '&:focus-visible': {
              outline: 'none',
              boxShadow: trovanShadows.focus,
            },
            '&:active': { transform: 'scale(0.97)' },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 7,
            padding: '7px 9px',
            fontSize: '0.72rem',
            fontWeight: 650,
            backgroundColor: alpha(trovanColors.brand.navy950, 0.96),
            boxShadow: trovanShadows.soft,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            boxShadow: '0 24px 80px rgba(3, 10, 20, 0.28)',
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            marginTop: 6,
            borderRadius: 10,
            boxShadow: '0 16px 42px rgba(3, 10, 20, 0.18)',
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
