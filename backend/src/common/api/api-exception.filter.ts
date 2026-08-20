import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { errorEnvelope } from '../../../../shared/contracts';
import { sanitizePath } from '../http/request-logging.middleware';
import { ErrorMonitoringService } from '../monitoring/error-monitoring.service';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly monitoring?: ErrorMonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId || randomUUID();
    const safePath = sanitizePath(request.originalUrl || request.url);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const body = payload as Record<string, unknown>;
        const detail = body.message;
        if (Array.isArray(detail)) {
          message = detail.map(String).join(', ');
        } else if (typeof detail === 'string') {
          message = detail;
        }
        if (typeof body.error === 'string') {
          code = body.error;
        } else if (status === HttpStatus.NOT_FOUND) {
          code = 'NOT_FOUND';
        } else if (status === HttpStatus.BAD_REQUEST) {
          code = 'VALIDATION_ERROR';
        } else if (status === HttpStatus.UNAUTHORIZED) {
          code = 'UNAUTHORIZED';
        } else if (status === HttpStatus.FORBIDDEN) {
          code = 'FORBIDDEN';
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled ${request.method} ${safePath} (${requestId}): ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `Unhandled ${request.method} ${safePath} (${requestId}): ${String(exception)}`,
      );
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.monitoring?.capture({
        source: 'backend',
        name: exception instanceof Error ? exception.name : 'UnhandledError',
        message: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
        context: {
          requestId,
          method: request.method,
          path: safePath,
          status,
        },
      });
    }

    const envelope = errorEnvelope(code, message, String(requestId));
    response.status(status).json(envelope);
  }
}
