import { alpha, createTheme, ThemeOptions } from '@mui/material/styles';

const headingFont = '"Space Grotesk", "Inter", "Segoe UI", sans-serif';
const bodyFont = '"Inter", "Segoe UI", sans-serif';

export const createAppTheme = (mode: 'light' | 'dark' = 'light') => {
  const isDark = mode === 'dark';

  const palette = isDark
    ? {
        mode,
        primary: {
          main: '#14B8A6',
          light: '#5EEAD4',
          dark: '#0F766E',
          contrastText: '#031716',
        },
        secondary: {
          main: '#F59E0B',
          light: '#FCD34D',
          dark: '#B45309',
          contrastText: '#1C1202',
        },
        success: {
          main: '#22C55E',
          light: '#4ADE80',
          dark: '#15803D',
        },
        warning: {
          main: '#F59E0B',
          light: '#FBBF24',
          dark: '#B45309',
        },
        error: {
          main: '#F87171',
          light: '#FCA5A5',
          dark: '#DC2626',
        },
        info: {
          main: '#60A5FA',
          light: '#93C5FD',
          dark: '#2563EB',
        },
        background: {
          default: '#111827',
          paper: '#17212B',
        },
        text: {
          primary: '#E5E7EB',
          secondary: '#A7B1BC',
        },
        divider: alpha('#E5E7EB', 0.1),
      }
    : {
        mode,
        primary: {
          main: '#0F766E',
          light: '#2DA79D',
          dark: '#115E59',
          contrastText: '#F6F5F0',
        },
        secondary: {
          main: '#C96F2D',
          light: '#DD8B4E',
          dark: '#A85B25',
          contrastText: '#FFF8F2',
        },
        success: {
          main: '#2F855A',
          light: '#48BB78',
          dark: '#276749',
        },
        warning: {
          main: '#D69E2E',
          light: '#ECC94B',
          dark: '#B7791F',
        },
        error: {
          main: '#C53030',
          light: '#E53E3E',
          dark: '#9B2C2C',
        },
        info: {
          main: '#2B6CB0',
          light: '#4299E1',
          dark: '#2C5282',
        },
        background: {
          default: '#F3F1EC',
          paper: '#FBF9F4',
        },
        text: {
          primary: '#1F2A2E',
          secondary: '#55636B',
        },
        divider: alpha('#1F2A2E', 0.12),
      };

  const themeOptions: ThemeOptions = {
    palette,
    typography: {
      fontFamily: bodyFont,
      h1: {
        fontFamily: headingFont,
        fontSize: '2.8rem',
        fontWeight: 700,
        letterSpacing: '-0.03em',
      },
      h2: {
        fontFamily: headingFont,
        fontSize: '2.2rem',
        fontWeight: 700,
        letterSpacing: '-0.025em',
      },
      h3: {
        fontFamily: headingFont,
        fontSize: '1.85rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h4: {
        fontFamily: headingFont,
        fontSize: '1.55rem',
        fontWeight: 700,
        letterSpacing: '-0.015em',
      },
      h5: {
        fontFamily: headingFont,
        fontSize: '1.2rem',
        fontWeight: 700,
      },
      h6: {
        fontFamily: headingFont,
        fontSize: '1rem',
        fontWeight: 700,
      },
      button: {
        textTransform: 'none',
        fontWeight: 700,
      },
    },
    shape: {
      borderRadius: 16,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: isDark
              ? 'radial-gradient(circle at top left, rgba(20,184,166,0.14), transparent 28%), radial-gradient(circle at top right, rgba(245,158,11,0.12), transparent 24%), #111827'
              : 'radial-gradient(circle at top left, rgba(15,118,110,0.10), transparent 28%), radial-gradient(circle at top right, rgba(201,111,45,0.10), transparent 24%), #F3F1EC',
            color: palette.text.primary,
            minHeight: '100vh',
            scrollbarWidth: 'thin',
            scrollbarColor: isDark ? '#31505A #17212B' : '#A8B0A5 #FBF9F4',
            '&::-webkit-scrollbar': {
              width: '10px',
              height: '10px',
            },
            '&::-webkit-scrollbar-track': {
              background: palette.background.paper,
            },
            '&::-webkit-scrollbar-thumb': {
              background: isDark ? '#31505A' : '#C2C8BB',
              borderRadius: '999px',
              border: `2px solid ${palette.background.paper}`,
            },
          },
          '::selection': {
            backgroundColor: alpha(palette.primary.main, 0.25),
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: alpha(palette.background.paper, isDark ? 0.94 : 0.92),
            color: palette.text.primary,
            borderBottom: `1px solid ${alpha(palette.text.primary, 0.08)}`,
            boxShadow: 'none',
            backdropFilter: 'blur(14px)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: alpha(palette.background.paper, isDark ? 0.95 : 0.93),
            borderRight: `1px solid ${alpha(palette.text.primary, 0.08)}`,
            backdropFilter: 'blur(16px)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            padding: '10px 18px',
            transition: 'all 0.2s ease',
            '&:active': {
              transform: 'scale(0.98)',
            },
          },
          contained: {
            boxShadow: `0 14px 22px -16px ${alpha(palette.primary.main, 0.55)}`,
            '&:hover': {
              boxShadow: `0 18px 28px -16px ${alpha(palette.primary.main, 0.65)}`,
              transform: 'translateY(-1px)',
            },
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': {
              borderWidth: '1.5px',
              backgroundColor: alpha(palette.primary.main, 0.05),
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${alpha(palette.text.primary, 0.08)}`,
            boxShadow: `0 18px 36px -30px ${alpha('#000000', isDark ? 0.75 : 0.25)}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${alpha(palette.text.primary, 0.08)}`,
            boxShadow: `0 18px 36px -30px ${alpha('#000000', isDark ? 0.75 : 0.2)}`,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            fontWeight: 700,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 14,
            margin: '4px 10px',
            transition: 'all 0.2s ease',
            '&:hover': {
              backgroundColor: alpha(palette.primary.main, 0.08),
              transform: 'translateX(3px)',
            },
            '&.Mui-selected': {
              backgroundColor: alpha(palette.primary.main, 0.14),
              borderLeft: `3px solid ${palette.primary.main}`,
              '&:hover': {
                backgroundColor: alpha(palette.primary.main, 0.18),
              },
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: alpha(palette.text.primary, 0.08),
          },
          head: {
            fontWeight: 700,
            backgroundColor: alpha(palette.primary.main, 0.06),
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 14,
              '&.Mui-focused': {
                boxShadow: `0 0 0 4px ${alpha(palette.primary.main, 0.12)}`,
              },
            },
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};
