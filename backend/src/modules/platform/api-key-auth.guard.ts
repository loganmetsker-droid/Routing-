import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformService } from './platform.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly platformService: PlatformService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      apiKey?: Record<string, unknown>;
      user?: Record<string, unknown>;
    }>();

    const headerKey = request.headers['x-api-key'];
    const authHeader = request.headers.authorization;
    const rawKey = (() => {
      const fromHeader = Array.isArray(headerKey)
        ? headerKey.find((entry) => typeof entry === 'string')
        : typeof headerKey === 'string'
          ? headerKey
          : null;
      if (fromHeader) return fromHeader.trim();

      if (typeof authHeader !== 'string') return '';
      const match = authHeader.trim().match(/^Bearer\s+(.+)$/i);
      return (match?.[1] || '').trim();
    })();

    if (!rawKey) {
      throw new UnauthorizedException('Missing API key');
    }

    // Avoid passing arbitrary large headers to DB/auth logic.
    if (rawKey.length > 512) {
      throw new UnauthorizedException('Invalid API key');
    }

    const apiKey = await this.platformService.authenticateApiKey(rawKey);
    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.apiKey = apiKey;
    request.user = {
      userId: `api-key:${apiKey.id}`,
      organizationId: apiKey.organizationId,
      roles: ['INTEGRATION'],
    };
    return true;
  }
}
