import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import PublicLaunchPage from './pages/PublicLaunchPage';

export function PublicRoot() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <CssBaseline />
          <ErrorBoundary
            title="Trovan Failed To Load"
            message="The public site hit a rendering problem. Reload to recover and contact Trovan support if this repeats."
          >
            <PublicLaunchPage />
          </ErrorBoundary>
        </ThemeProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
