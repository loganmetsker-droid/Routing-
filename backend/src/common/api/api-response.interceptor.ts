import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { itemEnvelope, listEnvelope } from '../../../../shared/contracts';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'graphql' | 'http'>() === 'graphql') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { requestId?: string }>();
    const response = context.switchToHttp().getResponse<any>();
    const requestId =
      (request.headers as Record<string, string | undefined>)?.['x-request-id'] ||
      request.requestId ||
      randomUUID();

    if (response?.setHeader) {
      response.setHeader('x-request-id', requestId);
    }

    return next.handle().pipe(
      map((value) => {
        const timestamp = new Date().toISOString();
        const meta = {
          request_id: requestId,
          timestamp,
          warnings: [],
        };

        if (Array.isArray(value)) {
          return listEnvelope(value, meta);
        }

        if (value && typeof value === 'object') {
          const keys = Object.keys(value as Record<string, unknown>);
          const arrayKey = keys.find((key) => Array.isArray((value as Record<string, unknown>)[key]));
          if (arrayKey) {
            const items = (value as Record<string, unknown>)[arrayKey] as unknown[];
            const extra = { ...(value as Record<string, unknown>) };
            delete (extra as Record<string, unknown>)[arrayKey];
            return itemEnvelope({
              items,
              total: items.length,
              ...extra,
            }, meta);
          }
        }

        return itemEnvelope(value as never, meta);
      }),
    );
  }
}
