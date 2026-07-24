import { Controller, Get, HttpStatus, Optional, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { JobsService } from '../jobs/jobs.service';
import { RuntimeStatusService } from '../../common/runtime/runtime-status.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformService } from '../platform/platform.service';
import { ProofStorageService } from '../dispatch/services/proof-storage.service';
import { WorkosService } from '../../common/integrations/workos.service';
import type { Response } from 'express';
import {
  resolveRoutingServiceUrl,
  routingServiceAuthHeaders,
} from '../../common/routing/routing-service-url.util';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private configService: ConfigService,
    private readonly runtimeStatusService: RuntimeStatusService,
    @Optional() private readonly jobsService?: JobsService,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly platformService?: PlatformService,
    @Optional() private readonly workosService?: WorkosService,
    @Optional() private readonly proofStorageService?: ProofStorageService,
  ) {}

  private presentPublicRuntime(
    runtime: ReturnType<RuntimeStatusService['getSummary']>,
  ) {
    return {
      startedAt: runtime.startedAt,
      releaseSha: runtime.releaseSha,
      nodeEnv: runtime.nodeEnv,
      authMode: runtime.authMode,
      queue: runtime.queue,
      worker: {
        ...runtime.worker,
        lastFailure: runtime.worker.lastFailure
          ? 'Worker run failed'
          : null,
      },
      optimization: runtime.optimization,
      storage: runtime.storage,
      database: {
        configured: runtime.database.host !== 'invalid',
      },
      integrations: runtime.integrations,
    };
  }

  private getDiskThresholdPercent() {
    const configured = Number(
      this.configService.get('DISK_HEALTH_THRESHOLD_PERCENT'),
    );

    if (Number.isFinite(configured) && configured > 0 && configured < 1) {
      return configured;
    }

    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    return ['development', 'test', 'local'].includes(nodeEnv) ? 0.98 : 0.9;
  }

  @Get()
  @Public()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({
    status: 200,
    description: 'The service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: {
          type: 'object',
          example: {
            database: { status: 'up' },
            memory_heap: { status: 'up' },
            memory_rss: { status: 'up' },
            storage: { status: 'up' },
          },
        },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  check() {
    return this.health.check([
      // Database health
      () => this.db.pingCheck('database'),

      // Memory health thresholds reflect the current Nest + GraphQL + realtime footprint.
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),

      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),

      // Disk health defaults are relaxed for local/dev machines with fuller disks.
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: this.getDiskThresholdPercent(),
        }),
    ]);
  }

  @Get('ping')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Simple ping endpoint' })
  @ApiResponse({ status: 200, description: 'Pong' })
  ping() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('runtime')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Runtime dependency and worker status' })
  @ApiResponse({ status: 200, description: 'Runtime dependency summary' })
  async runtime() {
    const runtime = this.runtimeStatusService.getSummary();
    const queueRequired = String(this.configService.get('QUEUE_REQUIRED', 'false')) === 'true';
    const queueConfigured = Boolean(
      this.configService.get('REDIS_URL') || this.configService.get('REDIS_HOST'),
    );

    let queue = {
      configured: queueConfigured,
      required: queueRequired,
      status: queueConfigured ? 'unknown' : 'disabled',
      counts: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      },
      oldestQueuedTimestamp: null as string | null,
    };

    if (this.jobsService) {
      try {
        const queueStatus = await this.jobsService.getQueueStatus();
        const waiting = queueStatus.waiting || [];
        queue = {
          configured: queueStatus.queueEnabled,
          required: queueRequired,
          status: queueStatus.queueEnabled ? 'ok' : 'disabled',
          counts: queueStatus.counts,
          oldestQueuedTimestamp: waiting[0]?.timestamp
            ? new Date(waiting[0].timestamp).toISOString()
            : null,
        };
      } catch {
        queue = { ...queue, status: 'unavailable' };
      }
    }

    const workerHeartbeatAgeMs = runtime.worker.heartbeatAt
      ? Date.now() - new Date(runtime.worker.heartbeatAt).getTime()
      : null;
    const workerStatus =
      runtime.worker.mode === 'disabled'
        ? 'disabled'
        : workerHeartbeatAgeMs !== null && workerHeartbeatAgeMs < 5 * 60 * 1000
          ? 'ok'
          : 'missing';

    const hardFailure =
      queueRequired && (queue.status === 'unavailable' || workerStatus === 'missing');
    const degraded =
      !hardFailure &&
      (queue.status === 'unavailable' ||
        (runtime.worker.mode !== 'disabled' && workerStatus !== 'ok'));

    return {
      status: hardFailure ? 'error' : degraded ? 'degraded' : 'ok',
      runtime: this.presentPublicRuntime(runtime),
      queue,
      worker: {
        mode: runtime.worker.mode,
        state: runtime.worker.state,
        status: workerStatus,
        registeredAt: runtime.worker.registeredAt,
        heartbeatAt: runtime.worker.heartbeatAt,
        heartbeatAgeMs: workerHeartbeatAgeMs,
        lastRunStartedAt: runtime.worker.lastRunStartedAt,
        lastRunCompletedAt: runtime.worker.lastRunCompletedAt,
        lastRunDurationMs: runtime.worker.lastRunDurationMs,
        lastFailure: runtime.worker.lastFailure ? 'Worker run failed' : null,
      },
      optimization: runtime.optimization,
      auth: {
        mode: runtime.authMode,
      },
    };
  }

  @Get('readiness')
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: 'Readiness truth for launch-critical dependencies' })
  @ApiResponse({ status: 200, description: 'Readiness details' })
  async readiness(@Res({ passthrough: true }) response: Response) {
    const runtime = this.runtimeStatusService.getSummary();
    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    const hostedEnvironment = ['staging', 'production'].includes(nodeEnv);
    const routingConfigured = Boolean(
      this.configService.get('ROUTING_SERVICE_URL') ||
        this.configService.get('ROUTING_PROVIDER_URL') ||
        this.configService.get('ROUTING_SERVICE_HOSTPORT'),
    );

    const databaseProbe = this.db
      .pingCheck('database')
      .then(() => ({ configured: true, required: true, status: 'up' }))
      .catch(() => ({ configured: true, required: true, status: 'down' }));

    const routingProbe = (async () => {
      if (!routingConfigured && !hostedEnvironment) {
        return {
          configured: false,
          required: false,
          status: 'disabled',
        };
      }
      if (!routingConfigured) {
        return {
          configured: false,
          required: true,
          status: 'missing',
        };
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4_000);
      try {
        const routingUrl = resolveRoutingServiceUrl(this.configService);
        const routingResponse = await fetch(`${routingUrl}/health`, {
          headers: routingServiceAuthHeaders(this.configService),
          signal: controller.signal,
        });
        return {
          configured: true,
          required: hostedEnvironment,
          status: routingResponse.ok ? 'up' : 'down',
        };
      } catch {
        return {
          configured: true,
          required: hostedEnvironment,
          status: 'down',
        };
      } finally {
        clearTimeout(timer);
      }
    })();

    const queueProbe = this.jobsService
      ? this.jobsService
          .getQueueStatus()
          .then((queue) => ({
            configured: queue.queueEnabled,
            required:
              String(this.configService.get('QUEUE_REQUIRED', 'false')) ===
              'true',
            status: queue.queueEnabled ? 'up' : 'disabled',
          }))
          .catch(() => ({
            configured: Boolean(
              this.configService.get('REDIS_URL') ||
                this.configService.get('REDIS_HOST'),
            ),
            required:
              String(this.configService.get('QUEUE_REQUIRED', 'false')) ===
              'true',
            status: 'down',
          }))
      : Promise.resolve({
          configured: Boolean(
            this.configService.get('REDIS_URL') ||
              this.configService.get('REDIS_HOST'),
          ),
          required:
            String(this.configService.get('QUEUE_REQUIRED', 'false')) ===
            'true',
          status: 'unknown',
        });

    const workosProbe =
      typeof this.workosService?.checkReadiness === 'function'
        ? this.workosService.checkReadiness()
        : Promise.resolve({
            configured: runtime.integrations.workos.configured,
            status: runtime.integrations.workos.configured
              ? ('unknown' as const)
              : ('missing' as const),
          });
    const postmarkProbe =
      typeof this.notificationsService?.checkReadiness === 'function'
        ? this.notificationsService.checkReadiness()
        : Promise.resolve({
            configured:
              runtime.integrations.postmark.configured &&
              runtime.integrations.leadIntake.operatorNotificationConfigured,
            status:
              runtime.integrations.postmark.configured &&
              runtime.integrations.leadIntake.operatorNotificationConfigured
                ? ('unknown' as const)
                : ('missing' as const),
          });
    const storageProbe =
      typeof this.proofStorageService?.checkReadiness === 'function'
        ? this.proofStorageService.checkReadiness()
        : Promise.resolve({
            configured: runtime.integrations.storage.configured,
            mode: runtime.integrations.storage.mode,
            status: runtime.integrations.storage.configured
              ? ('unknown' as const)
              : ('missing' as const),
          });

    const [
      database,
      redis,
      routingService,
      workos,
      postmark,
      storage,
    ] = await Promise.all([
      databaseProbe,
      queueProbe,
      routingProbe,
      workosProbe,
      postmarkProbe,
      storageProbe,
    ]);

    const dependencies = {
      database,
      redis,
      worker: {
        configured: runtime.worker.mode !== 'disabled',
        required: hostedEnvironment,
        status:
          runtime.worker.mode === 'disabled'
            ? 'disabled'
            : runtime.worker.heartbeatAt &&
                Date.now() - new Date(runtime.worker.heartbeatAt).getTime() <
                  5 * 60 * 1000 &&
                !runtime.worker.lastFailure
              ? 'up'
              : 'down',
      },
      routingService,
      workos: {
        ...workos,
        required: hostedEnvironment,
      },
      postmark: {
        ...postmark,
        required: hostedEnvironment,
      },
      storage: {
        ...storage,
        required: hostedEnvironment,
      },
      stripe: {
        ...runtime.integrations.stripe,
        required: false,
        status: runtime.integrations.stripe.configured ? 'up' : 'optional',
      },
      twilio: {
        ...runtime.integrations.twilio,
        required: false,
        status: runtime.integrations.twilio.configured ? 'up' : 'disabled',
      },
    };

    const missingCritical = Object.entries(dependencies)
      .filter(([, state]) =>
        Boolean(
          'required' in state &&
            state.required &&
            (!state.configured ||
              ('status' in state &&
                !['up', 'ok'].includes(String(state.status)))),
        ),
      )
      .map(([name]) => name);
    const launchWarnings = Object.entries(dependencies)
      .filter(([, state]) => !state.configured)
      .map(([name]) => `${name} is not configured`);
    const status = missingCritical.length > 0 ? 'error' : 'ok';

    response.status(
      missingCritical.length > 0
        ? HttpStatus.SERVICE_UNAVAILABLE
        : HttpStatus.OK,
    );

    return {
      status,
      runtime: this.presentPublicRuntime(runtime),
      dependencies,
      notifications: {
        configured: postmark.configured,
        status: postmark.status,
      },
      platform: {
        enabled: Boolean(this.platformService),
      },
      missingCritical,
      launchWarnings,
    };
  }
}
