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
import type { Response } from 'express';
import {
  resolveRoutingServiceUrl,
  routingServiceAuthHeaders,
} from '../../common/routing/routing-service-url.util';
import { WorkosService } from '../../common/integrations/workos.service';
import { ProofStorageService } from '../dispatch/services/proof-storage.service';

type HostedProviderProbe = {
  workos: 'up' | 'down' | 'missing' | 'optional';
  postmark: 'up' | 'down' | 'missing' | 'optional';
  storage: 'up' | 'down' | 'missing' | 'optional';
};

@ApiTags('health')
@Controller('health')
export class HealthController {
  private providerProbeCache:
    | { expiresAt: number; value: HostedProviderProbe }
    | null = null;

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

  private async probeHostedProviders(
    hostedEnvironment: boolean,
    runtime: ReturnType<RuntimeStatusService['getSummary']>,
  ): Promise<HostedProviderProbe> {
    if (!hostedEnvironment) {
      return {
        workos: runtime.integrations.workos.configured ? 'up' : 'optional',
        postmark: runtime.integrations.postmark.configured ? 'up' : 'optional',
        storage: runtime.integrations.storage.configured ? 'up' : 'optional',
      };
    }
    if (this.providerProbeCache?.expiresAt > Date.now()) {
      return this.providerProbeCache.value;
    }

    const workos = !runtime.integrations.workos.configured
      ? 'missing'
      : (await this.workosService?.checkAvailability())
        ? 'up'
        : 'down';
    let postmark: HostedProviderProbe['postmark'] = 'missing';
    if (runtime.integrations.postmark.configured) {
      try {
        const response = await fetch('https://api.postmarkapp.com/server', {
          headers: {
            Accept: 'application/json',
            'X-Postmark-Server-Token': String(
              this.configService.get('POSTMARK_SERVER_TOKEN', ''),
            ),
          },
          signal: AbortSignal.timeout(3_000),
        });
        postmark = response.ok ? 'up' : 'down';
      } catch {
        postmark = 'down';
      }
    }
    const storage = !runtime.integrations.storage.configured
      ? 'missing'
      : (await this.proofStorageService?.checkR2Availability())
        ? 'up'
        : 'down';
    const value: HostedProviderProbe = { workos, postmark, storage };
    this.providerProbeCache = {
      expiresAt: Date.now() + 30_000,
      value,
    };
    return value;
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
      runtime,
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
        lastFailure: runtime.worker.lastFailure,
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

    const [
      notificationsOverview,
      platformOverview,
      database,
      redis,
      routingService,
      providerProbe,
    ] = await Promise.all([
      this.notificationsService?.getOverview().catch(() => null) || null,
      this.platformService?.getOverview(
        this.configService.get('DEFAULT_ORGANIZATION_ID', 'default'),
      ).catch(() => null) || null,
      databaseProbe,
      queueProbe,
      routingProbe,
      this.probeHostedProviders(hostedEnvironment, runtime),
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
        ...runtime.integrations.workos,
        required: hostedEnvironment,
        status: providerProbe.workos,
      },
      postmark: {
        configured:
          runtime.integrations.postmark.configured &&
          runtime.integrations.leadIntake.operatorNotificationConfigured,
        required: hostedEnvironment,
        status:
          runtime.integrations.leadIntake.operatorNotificationConfigured
            ? providerProbe.postmark
            : 'missing',
      },
      storage: {
        ...runtime.integrations.storage,
        required: hostedEnvironment,
        status: providerProbe.storage,
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
      runtime,
      dependencies,
      notifications: notificationsOverview,
      platform: platformOverview,
      missingCritical,
      launchWarnings,
    };
  }
}
