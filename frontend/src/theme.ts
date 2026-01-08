import { createTheme, ThemeOptions } from '@mui/material/styles';

export const createAppTheme = (mode: 'light' | 'dark' = 'dark') => {
  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: '#6366f1', // Vibrant indigo
        light: '#818cf8',
        dark: '#4f46e5',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#ec4899', // Vibrant pink
        light: '#f472b6',
        dark: '#db2777',
        contrastText: '#ffffff',
      },
      success: {
        main: '#10b981',
        light: '#34d399',
        dark: '#059669',
      },
      warning: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#d97706',
      },
      error: {
        main: '#ef4444',
        light: '#f87171',
        dark: '#dc2626',
      },
      info: {
        main: '#3b82f6',
        light: '#60a5fa',
        dark: '#2563eb',
      },
      background: {
        default: mode === 'dark' ? '#0f0f1e' : '#ffffff',
        paper: mode === 'dark' ? '#1a1a2e' : '#fafafa',
      },
      text: {
        primary: mode === 'dark' ? '#f1f5f9' : '#0f172a',
        secondary: mode === 'dark' ? '#94a3b8' : '#64748b',
      },
      divider: mode === 'dark' ? 'rgba(148, 163, 184, 0.12)' : 'rgba(15, 23, 42, 0.12)',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 700,
        letterSpacing: '-0.01em',
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 12,
    },
    shadows: mode === 'dark' ? [
      'none',
      '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
      '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
      '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
      '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
      '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    ] : [
      'none',
      '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    ],
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            scrollbarColor: mode === 'dark' ? '#374151 #1a1a2e' : '#cbd5e1 #f1f5f9',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: mode === 'dark' ? '#1a1a2e' : '#f1f5f9',
            },
            '&::-webkit-scrollbar-thumb': {
              background: mode === 'dark' ? '#374151' : '#cbd5e1',
              borderRadius: '4px',
              '&:hover': {
                background: mode === 'dark' ? '#4b5563' : '#94a3b8',
              },
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: '10px',
            padding: '10px 20px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:active': {
              transform: 'scale(0.97)',
            },
          },
          contained: {
            boxShadow: mode === 'dark'
              ? '0 4px 14px 0 rgba(99, 102, 241, 0.39)'
              : '0 4px 14px 0 rgba(99, 102, 241, 0.25)',
            '&:hover': {
              boxShadow: mode === 'dark'
                ? '0 6px 20px 0 rgba(99, 102, 241, 0.5)'
                : '0 6px 20px 0 rgba(99, 102, 241, 0.35)',
              transform: 'translateY(-2px)',
            },
            '&:active': {
              transform: 'scale(0.97) translateY(0)',
            },
          },
          outlined: {
            borderWidth: '2px',
            '&:hover': {
              borderWidth: '2px',
              transform: 'translateY(-2px)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: '16px',
            backgroundImage: 'none',
            border: mode === 'dark' ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: mode === 'dark'
                ? '0 12px 24px -10px rgba(99, 102, 241, 0.3)'
                : '0 12px 24px -10px rgba(99, 102, 241, 0.2)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: mode === 'dark' ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
          },
          elevation1: {
            boxShadow: mode === 'dark'
              ? '0 1px 3px 0 rgba(0, 0, 0, 0.4)'
              : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          },
          elevation2: {
            boxShadow: mode === 'dark'
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.4)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          },
          elevation3: {
            boxShadow: mode === 'dark'
              ? '0 10px 15px -3px rgba(0, 0, 0, 0.4)'
              : '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'scale(1.1)',
              backgroundColor: mode === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.08)',
            },
            '&:active': {
              transform: 'scale(0.95)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: '8px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
          filled: {
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: mode === 'dark' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.06)',
          },
          head: {
            fontWeight: 700,
            backgroundColor: mode === 'dark' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.03)',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.2s ease',
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.03)',
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRight: mode === 'dark' ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: '10px',
            margin: '4px 8px',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.08)',
              transform: 'translateX(4px)',
            },
            '&.Mui-selected': {
              backgroundColor: mode === 'dark' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.12)',
              borderLeft: '3px solid #6366f1',
              '&:hover': {
                backgroundColor: mode === 'dark' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)',
              },
            },
            '&:active': {
              transform: 'translateX(2px)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-1px)',
              },
              '&.Mui-focused': {
                transform: 'translateY(-2px)',
                boxShadow: mode === 'dark'
                  ? '0 4px 12px rgba(99, 102, 241, 0.2)'
                  : '0 4px 12px rgba(99, 102, 241, 0.15)',
              },
            },
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: '4px',
            height: '6px',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: mode === 'dark' ? '#1a1a2e' : '#fafafa',
            color: mode === 'dark' ? '#f1f5f9' : '#0f172a',
            borderBottom: mode === 'dark' ? '1px solid rgba(99, 102, 241, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: mode === 'dark'
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.4)'
              : '0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          },
        },
      },
    },
  };

  return createTheme(themeOptions);
};
