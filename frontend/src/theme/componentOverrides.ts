import { alpha, ThemeOptions } from '@mui/material/styles';
import { shellTokens, trovanTokens } from './tokens';

export function buildComponentOverrides(mode: 'light' | 'dark', palette: any): ThemeOptions['components'] {
  const isDark = mode === 'dark';
  return {
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
          borderRadius: trovanTokens.radius.md,
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
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: trovanTokens.radius.md,
        },
      },
    },
  };
}
