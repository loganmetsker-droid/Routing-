import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { errorEnvelope } from '../../../../shared/contracts';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId || request.headers['x-request-id'] || randomUUID();

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
    }

    const envelope = errorEnvelope(code, message, String(requestId));
    response.status(status).json(envelope);
  }
}
