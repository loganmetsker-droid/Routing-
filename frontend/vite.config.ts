import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const frontendHost = '127.0.0.1';

const isTruthy = (value: string | undefined) =>
  ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  };
  const releaseSha =
    env.VITE_RELEASE_SHA || env.VERCEL_GIT_COMMIT_SHA || 'unknown';

  if (!['development', 'test', 'local'].includes(mode)) {
    if (isTruthy(env.VITE_AUTH_BYPASS) || isTruthy(env.VITE_MOCK_PREVIEW)) {
      throw new Error(
        `Preview auth bypass is forbidden in "${mode}" mode. Disable VITE_AUTH_BYPASS and VITE_MOCK_PREVIEW before building.`,
      );
    }
  }

  const frontendPort = Number(
    env.FRONTEND_PORT || env.VITE_FRONTEND_PORT || '5184',
  );
  const productionSourcemaps = isTruthy(env.VITE_ENABLE_PRODUCTION_SOURCEMAPS);

  return {
    plugins: [
      {
        name: 'release-identity-meta',
        transformIndexHtml(html) {
          return html.replace('__TROVAN_RELEASE_SHA__', releaseSha);
        },
      },
      react(),
    ],
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: [],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@services': path.resolve(__dirname, './src/services'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@types': path.resolve(__dirname, './src/types'),
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    server: {
      host: frontendHost,
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    preview: {
      host: frontendHost,
      port: frontendPort,
      strictPort: true,
    },
    build: {
      sourcemap: mode === 'production' ? productionSourcemaps : true,
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }
            if (
              id.includes('@mui') ||
              id.includes('@emotion')
            ) {
              return 'vendor-ui';
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/') ||
              id.includes('/use-sync-external-store/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            return undefined;
          },
        },
      },
    },
  };
});
