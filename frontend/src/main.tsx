import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CssBaseline from '@mui/material/CssBaseline';
import 'leaflet/dist/leaflet.css';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';
import ErrorBoundary from './components/ui/ErrorBoundary';
import './styles/index.css';

const LOCAL_DEMO_AUTH_TOKEN = 'preview-auth-bypass';

const bootstrapLocalDemoMode = () => {
  try {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
    const isLocal = localHosts.has(host);
    const isLoginPage = window.location.pathname === '/login';
    if (!isLocal || !isLoginPage) return;
    if (!window.localStorage.getItem('authToken')) {
      window.localStorage.setItem('authToken', LOCAL_DEMO_AUTH_TOKEN);
    }
  } catch {
    // Demo bootstrap is best-effort only.
  }
};

bootstrapLocalDemoMode();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <CssBaseline />
          <ErrorBoundary
            title="Trovan Failed To Load"
            message="The application shell crashed during startup. Reload after checking the current build and backend health."
          >
            <App />
          </ErrorBoundary>
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
