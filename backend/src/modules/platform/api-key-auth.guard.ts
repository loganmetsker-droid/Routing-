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
    const rawKey = Array.isArray(headerKey)
      ? headerKey[0]
      : typeof headerKey === 'string'
        ? headerKey
        : typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice('Bearer '.length)
          : '';

    if (!rawKey) {
      throw new UnauthorizedException('Missing API key');
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
