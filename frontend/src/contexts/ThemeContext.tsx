import type { ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { trovanTheme } from '../theme/trovanTheme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <MuiThemeProvider theme={trovanTheme}>{children}</MuiThemeProvider>;
}
