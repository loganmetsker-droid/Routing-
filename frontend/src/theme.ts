import { alpha, createTheme, ThemeOptions } from '@mui/material/styles';
import { shellTokens, trovanTokens } from './theme/tokens';

const headingFont = trovanTokens.typography.heading;
const bodyFont = trovanTokens.typography.body;

export const createAppTheme = (mode: 'light' | 'dark' = 'light') => {
  const isDark = mode === 'dark';

  const palette = isDark
    ? {
        mode,
        primary: {
          main: trovanTokens.color.copper[400],
          light: trovanTokens.color.copper[300],
          dark: trovanTokens.color.copper[500],
          contrastText: trovanTokens.color.slate[950],
        },
        secondary: {
          main: trovanTokens.color.slate[300],
          light: trovanTokens.color.slate[200],
          dark: trovanTokens.color.slate[500],
          contrastText: trovanTokens.color.slate[950],
        },
        success: {
          main: '#43A87A',
          light: '#67C192',
          dark: '#2E7D58',
        },
        warning: {
          main: '#D09A43',
          light: '#E1B56A',
          dark: '#B7791F',
        },
        error: {
          main: '#D56B6B',
          light: '#E09292',
          dark: '#B23A3A',
        },
        info: {
          main: '#5C88B3',
          light: '#7AA2C7',
          dark: '#2F6EA8',
        },
        background: {
          default: trovanTokens.color.slate[950],
          paper: trovanTokens.color.slate[900],
        },
        text: {
          primary: '#E8EEF4',
          secondary: '#A8B7C6',
        },
        divider: alpha('#E8EEF4', 0.12),
      }
    : {
        mode,
        primary: {
          main: trovanTokens.color.copper[500],
          light: trovanTokens.color.copper[400],
          dark: trovanTokens.color.copper[700],
          contrastText: '#FFF9F2',
        },
        secondary: {
          main: trovanTokens.color.slate[700],
          light: trovanTokens.color.slate[600],
          dark: trovanTokens.color.slate[900],
          contrastText: '#F4F7FB',
        },
        success: {
          main: trovanTokens.color.semantic.success,
          light: '#4C9A72',
          dark: '#246045',
        },
        warning: {
          main: trovanTokens.color.semantic.warning,
          light: '#CC9238',
          dark: '#93611A',
        },
        error: {
          main: trovanTokens.color.semantic.danger,
          light: '#CF5D5D',
          dark: '#8C2D2D',
        },
        info: {
          main: trovanTokens.color.semantic.info,
          light: '#4D82B3',
          dark: '#245781',
        },
        background: {
          default: trovanTokens.color.slate[50],
          paper: '#FFFFFF',
        },
        text: {
          primary: '#1A252F',
          secondary: '#5A6D7E',
        },
        divider: alpha('#1A252F', 0.12),
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
      borderRadius: trovanTokens.radius.md,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: isDark ? trovanTokens.color.slate[950] : trovanTokens.color.slate[50],
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
            backdropFilter: 'blur(12px)',
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
            borderRadius: trovanTokens.radius.md,
            padding: '10px 18px',
            transition: 'background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
          },
          contained: {
            boxShadow: `0 10px 22px -16px ${alpha(palette.primary.main, 0.45)}`,
            '&:hover': {
              boxShadow: `0 14px 24px -16px ${alpha(palette.primary.main, 0.52)}`,
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
            boxShadow: isDark ? `0 18px 36px -30px ${alpha('#000000', 0.75)}` : shellTokens.shadow.soft,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${alpha(palette.text.primary, 0.08)}`,
            boxShadow: isDark ? `0 18px 36px -30px ${alpha('#000000', 0.75)}` : shellTokens.shadow.soft,
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: trovanTokens.radius.sm,
            fontWeight: 600,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: trovanTokens.radius.md,
            margin: '4px 10px',
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
            '&:hover': {
              backgroundColor: alpha(palette.primary.main, 0.08),
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
              borderRadius: trovanTokens.radius.sm,
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
