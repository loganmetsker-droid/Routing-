import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { createTrovanTheme, type TrovanThemeMode } from '../theme/trovanTheme';

type ThemeModeContextValue = {
  mode: TrovanThemeMode;
  setMode: (mode: TrovanThemeMode) => void;
  toggleMode: () => void;
};

const THEME_MODE_STORAGE_KEY = 'trovan.theme.mode';

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

function getInitialMode(): TrovanThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // If storage is unavailable, keep the current premium dark console.
  }
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<TrovanThemeMode>(getInitialMode);

  const theme = useMemo(() => createTrovanTheme(mode), [mode]);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const value = useMemo<ThemeModeContextValue>(() => {
    const setMode = (nextMode: TrovanThemeMode) => {
      setModeState(nextMode);
      try {
        window.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode);
      } catch {
        // Persistence is nice-to-have; the in-memory toggle should still work.
      }
    };

    return {
      mode,
      setMode,
      toggleMode: () => setMode(mode === 'dark' ? 'light' : 'dark'),
    };
  }, [mode]);

  return (
    <ThemeModeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useTrovanThemeMode() {
  const context = useContext(ThemeModeContext);
  if (!context) {
    throw new Error('useTrovanThemeMode must be used inside ThemeProvider.');
  }
  return context;
}
