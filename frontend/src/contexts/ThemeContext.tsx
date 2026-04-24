import { useMemo, type ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { createTrovanTheme, type TrovanThemeMode } from '../theme/trovanTheme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode: TrovanThemeMode = 'light';

  const theme = useMemo(() => createTrovanTheme(mode), [mode]);

  return <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>;
}
