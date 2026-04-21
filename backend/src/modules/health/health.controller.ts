import { Controller, Get, Optional } from '@nestjs/common';
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
  ) {}

  private getDiskThresholdPercent() {
    const configured = Number(
      this.configService.get('DISK_HEALTH_THRESHOLD_PERCENT'),
    );

    if (Number.isFinite(configured) && configured > 0 && configured < 1) {
      return configured;
    }

    const nodeEnv = this.configService.get('NODE_ENV', 'development');
    return ['development', 'test'].includes(nodeEnv) ? 0.98 : 0.9;
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
}
