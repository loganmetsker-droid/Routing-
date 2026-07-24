/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_REST_API_URL?: string;
  readonly VITE_GRAPHQL_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_AUTH_BYPASS?: string;
  readonly VITE_MOCK_PREVIEW?: string;
  readonly VITE_TROVAN_DATA_MODE?: 'live' | 'preview' | 'degraded' | 'simulated' | string;
  readonly VITE_DATA_MODE?: 'live' | 'preview' | 'degraded' | 'simulated' | string;
  readonly VITE_LEAD_INTAKE_EMAIL?: string;
  readonly VITE_LEAD_INTAKE_WEBHOOK_URL?: string;
  readonly VITE_RELEASE_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}
