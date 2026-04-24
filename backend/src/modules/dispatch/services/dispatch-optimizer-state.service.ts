import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OptimizerEvent,
  OptimizerHealth,
} from '../dto/routing-service.dto';
import { DispatchEvent } from '../entities/dispatch-event.entity';
import { DispatchEventsService } from './dispatch-events.service';

@Injectable()
export class DispatchOptimizerStateService {
  private optimizerHealth: OptimizerHealth = {
    status: 'degraded',
    circuitOpen: false,
    consecutiveFailures: 0,
    lastCheckedAt: new Date(0).toISOString(),
    message: 'Optimizer has not been checked yet.',
  };
  private optimizerEvents: OptimizerEvent[] = [];

  constructor(
    @InjectRepository(DispatchEvent)
    private readonly dispatchEventRepository: Repository<DispatchEvent>,
    private readonly dispatchEvents: DispatchEventsService,
  ) {}

  async markSuccess() {
    const now = new Date().toISOString();
    this.optimizerHealth = {
      status: 'healthy',
      circuitOpen: false,
      consecutiveFailures: 0,
      lastCheckedAt: now,
      lastSuccessAt: now,
      lastFailureAt: this.optimizerHealth.lastFailureAt,
      message: 'Optimization service is responding normally.',
    };
    this.optimizerEvents.unshift({
      level: 'info',
      code: 'ROUTING_SERVICE_OK',
      message: 'Optimization service call succeeded.',
      fallbackUsed: false,
      timestamp: now,
    });
    this.optimizerEvents = this.optimizerEvents.slice(0, 200);
    await this.dispatchEvents.log({
      source: 'optimizer',
      level: 'info',
      code: 'ROUTING_SERVICE_OK',
      message: 'Optimization service call succeeded.',
      payload: {
        circuitOpen: this.optimizerHealth.circuitOpen,
        consecutiveFailures: this.optimizerHealth.consecutiveFailures,
        fallbackUsed: false,
      },
    });
  }

  async markFailure(message: string) {
    const now = new Date().toISOString();
    const failures = this.optimizerHealth.consecutiveFailures + 1;
    this.optimizerHealth = {
      status: failures >= 3 ? 'unavailable' : 'degraded',
      circuitOpen: failures >= 5,
      consecutiveFailures: failures,
      lastCheckedAt: now,
      lastSuccessAt: this.optimizerHealth.lastSuccessAt,
      lastFailureAt: now,
      message,
    };
    this.optimizerEvents.unshift({
      level: 'error',
      code: 'ROUTING_SERVICE_FAILURE',
      message,
      fallbackUsed: true,
      timestamp: now,
    });
    this.optimizerEvents = this.optimizerEvents.slice(0, 200);
    await this.dispatchEvents.log({
      source: 'optimizer',
      level: 'error',
      code: 'ROUTING_SERVICE_FAILURE',
      message,
      payload: {
        circuitOpen: this.optimizerHealth.circuitOpen,
        consecutiveFailures: this.optimizerHealth.consecutiveFailures,
        fallbackUsed: true,
      },
    });
  }

  getHealth(): OptimizerHealth {
    return { ...this.optimizerHealth };
  }

  async getEvents(limit = 50): Promise<OptimizerEvent[]> {
    const capped = Math.max(1, Math.min(200, limit));
    const persisted = await this.dispatchEventRepository.find({
      where: { source: 'optimizer' },
      order: { createdAt: 'DESC' },
      take: capped,
    });
    if (persisted.length > 0) {
      return persisted.map((event) => ({
        level: event.level as 'info' | 'warning' | 'error',
        code: event.code,
        message: event.message,
        fallbackUsed: Boolean(
          event.payload?.fallbackUsed || event.level === 'error',
        ),
        timestamp: event.createdAt.toISOString(),
      }));
    }
    return this.optimizerEvents.slice(0, capped);
  }
}
