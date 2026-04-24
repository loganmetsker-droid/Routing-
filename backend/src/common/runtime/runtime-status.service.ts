import { Injectable } from '@nestjs/common';

type WorkerRunState = 'idle' | 'running' | 'failed';

@Injectable()
export class RuntimeStatusService {
  private readonly startedAt = new Date().toISOString();
  private workerRegisteredAt: string | null = null;
  private workerHeartbeatAt: string | null = null;
  private workerLastRunStartedAt: string | null = null;
  private workerLastRunCompletedAt: string | null = null;
  private workerLastRunDurationMs: number | null = null;
  private workerLastFailure: string | null = null;
  private workerRunState: WorkerRunState = 'idle';

  registerWorker() {
    const now = new Date().toISOString();
    this.workerRegisteredAt = now;
    this.workerHeartbeatAt = now;
  }

  touchWorkerHeartbeat() {
    this.workerHeartbeatAt = new Date().toISOString();
  }

  markWorkerRunStarted() {
    this.workerRunState = 'running';
    this.workerLastRunStartedAt = new Date().toISOString();
    this.touchWorkerHeartbeat();
  }

  markWorkerRunCompleted(durationMs?: number) {
    this.workerRunState = 'idle';
    this.workerLastRunCompletedAt = new Date().toISOString();
    this.workerLastRunDurationMs = typeof durationMs === 'number' ? durationMs : null;
    this.workerLastFailure = null;
    this.touchWorkerHeartbeat();
  }

  markWorkerRunFailed(message: string, durationMs?: number) {
    this.workerRunState = 'failed';
    this.workerLastRunCompletedAt = new Date().toISOString();
    this.workerLastRunDurationMs = typeof durationMs === 'number' ? durationMs : null;
    this.workerLastFailure = message;
    this.touchWorkerHeartbeat();
  }

  private getDatabaseSummary() {
    if (process.env.DATABASE_URL) {
      try {
        const url = new URL(process.env.DATABASE_URL);
        return {
          source: 'DATABASE_URL',
          host: url.hostname,
          port: Number(url.port || 5432),
          database: url.pathname.replace(/^\//, '') || 'unknown',
        };
      } catch {
        return {
          source: 'DATABASE_URL',
          host: 'invalid',
          port: 5432,
          database: 'invalid',
        };
      }
    }

    return {
      source: 'split-env',
      host: process.env.DATABASE_HOST || process.env.DB_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT || process.env.DB_PORT || 5432),
      database: process.env.DATABASE_NAME || process.env.DB_NAME || 'routing_dispatch',
    };
  }

  getSummary() {
    const queueConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
    const queueRequired = String(process.env.QUEUE_REQUIRED || 'false') === 'true';
    const schedulerEnabled = String(process.env.ENABLE_SCHEDULER || '0') === '1';
    const storageMode = process.env.STORAGE_MODE || 'local';
    const optimizationMode = process.env.OPTIMIZATION_MODE || (schedulerEnabled ? 'embedded' : 'manual');
    const authMode =
      process.env.AUTH_PROVIDER ||
      (process.env.NODE_ENV === 'development' ? 'local-admin-jwt' : 'jwt');
    const workerMode = schedulerEnabled ? 'embedded' : 'disabled';
    const storageConfigured =
      storageMode === 'local' ||
      Boolean(
        process.env.R2_BUCKET &&
          process.env.R2_ACCESS_KEY_ID &&
          process.env.R2_SECRET_ACCESS_KEY &&
          process.env.R2_ENDPOINT,
      );

    return {
      startedAt: this.startedAt,
      envSource: process.env.TROVAN_ENV_SOURCES || 'process-environment',
      nodeEnv: process.env.NODE_ENV || 'development',
      authMode,
      queue: {
        mode: queueConfigured ? 'redis' : 'disabled',
        required: queueRequired,
      },
      worker: {
        mode: workerMode,
        state: this.workerRunState,
        registeredAt: this.workerRegisteredAt,
        heartbeatAt: this.workerHeartbeatAt,
        lastRunStartedAt: this.workerLastRunStartedAt,
        lastRunCompletedAt: this.workerLastRunCompletedAt,
        lastRunDurationMs: this.workerLastRunDurationMs,
        lastFailure: this.workerLastFailure,
      },
      optimization: {
        mode: optimizationMode,
      },
      storage: {
        mode: storageMode,
        configured: storageConfigured,
      },
      database: this.getDatabaseSummary(),
      integrations: {
        workos: {
          configured: Boolean(
            process.env.WORKOS_CLIENT_ID &&
              process.env.WORKOS_API_KEY &&
              process.env.WORKOS_REDIRECT_URI,
          ),
        },
        stripe: {
          configured: Boolean(
            process.env.STRIPE_SECRET_KEY &&
              process.env.STRIPE_WEBHOOK_SECRET,
          ),
        },
        postmark: {
          configured: Boolean(
            process.env.POSTMARK_SERVER_TOKEN &&
              (process.env.POSTMARK_FROM_EMAIL ||
                process.env.NOTIFICATION_FROM_EMAIL),
          ),
        },
        twilio: {
          configured: Boolean(
            process.env.TWILIO_ACCOUNT_SID &&
              process.env.TWILIO_AUTH_TOKEN &&
              process.env.TWILIO_FROM_NUMBER,
          ),
        },
        storage: {
          configured: storageConfigured,
          mode: storageMode,
        },
      },
    };
  }
}
