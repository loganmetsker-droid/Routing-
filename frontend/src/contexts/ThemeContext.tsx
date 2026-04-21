import { createContext, useContext, type ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { trovanTheme } from '../theme/trovanTheme';

type ThemeContextType = {
  mode: 'light';
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleTheme: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeContext.Provider value={{ mode: 'light', toggleTheme: () => {} }}>
      <MuiThemeProvider theme={trovanTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
