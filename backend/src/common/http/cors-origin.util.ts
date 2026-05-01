const DEFAULT_LOCAL_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5184',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5184',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

export function parseAllowedOriginsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return (env.CORS_ORIGINS || env.CORS_ORIGIN || env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

type OriginCallback = (err: Error | null, allowed?: boolean) => void;
type OriginValidator = (origin: string | undefined, callback: OriginCallback) => void;

export function createCorsOriginValidator(options?: {
  env?: NodeJS.ProcessEnv;
  allowedOrigins?: string[];
  localOrigins?: ReadonlyArray<string>;
}): OriginValidator {
  const env = options?.env ?? process.env;
  const nodeEnv = env.NODE_ENV || 'development';
  const allowedOrigins = options?.allowedOrigins ?? parseAllowedOriginsFromEnv(env);
  const localOrigins = new Set(options?.localOrigins ?? DEFAULT_LOCAL_ORIGINS);

  return (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0 && nodeEnv !== 'production') {
      const allowed = localOrigins.has(origin);
      return callback(allowed ? null : new Error('Origin not allowed'), allowed);
    }

    const allowed = allowedOrigins.includes(origin);
    return callback(allowed ? null : new Error('Origin not allowed'), allowed);
  };
}
