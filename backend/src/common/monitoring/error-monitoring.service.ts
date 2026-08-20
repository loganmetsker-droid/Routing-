import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { sanitizeValue } from '../http/request-logging.middleware';

const MAX_ERROR_TEXT = 8_000;

export function sanitizeErrorText(value: unknown) {
  return String(value || 'Unknown error')
    .slice(0, MAX_ERROR_TEXT)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[REDACTED_PHONE]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_TOKEN]')
    .replace(/\b(?:sk|pk|tvp)_[A-Za-z0-9_-]{12,}\b/g, '[REDACTED_SECRET]');
}

export type ErrorMonitoringEvent = {
  source: 'backend' | 'frontend';
  name?: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
};

@Injectable()
export class ErrorMonitoringService {
  private readonly logger = new Logger(ErrorMonitoringService.name);

  constructor(private readonly configService: ConfigService) {}

  capture(event: ErrorMonitoringEvent) {
    const endpoint = this.configService
      .get<string>('ERROR_MONITORING_WEBHOOK_URL', '')
      .trim();
    if (!endpoint) return null;

    const token = this.configService
      .get<string>('ERROR_MONITORING_WEBHOOK_TOKEN', '')
      .trim();
    const eventId = randomUUID();
    const payload = {
      eventId,
      capturedAt: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV', 'development'),
      release:
        this.configService.get('RENDER_GIT_COMMIT') ||
        this.configService.get('GIT_SHA') ||
        'unknown',
      source: event.source,
      name: sanitizeErrorText(event.name || 'Error'),
      message: sanitizeErrorText(event.message),
      stack: event.stack ? sanitizeErrorText(event.stack) : undefined,
      context: sanitizeValue('context', event.context || {}),
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    void fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3_000),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`receiver returned HTTP ${response.status}`);
      }
    }).catch((error) => {
      this.logger.warn(
        `Error monitoring delivery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    return eventId;
  }
}
