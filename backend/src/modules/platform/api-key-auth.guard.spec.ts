import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

function createExecutionContext(request: { headers: Record<string, any> }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as any;
}

describe('ApiKeyAuthGuard', () => {
  it('rejects when API key header is missing', async () => {
    const platformService = {
      authenticateApiKey: vi.fn(),
    } as any;
    const guard = new ApiKeyAuthGuard(platformService);
    const request = { headers: {} as any };

    await expect(() =>
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toThrow(new UnauthorizedException('Missing API key'));
  });

  it('uses and trims x-api-key header value', async () => {
    const platformService = {
      authenticateApiKey: vi.fn().mockResolvedValue({
        id: 'key_1',
        organizationId: 'org_1',
        scopes: ['jobs:read'],
      }),
    } as any;
    const guard = new ApiKeyAuthGuard(platformService);
    const request: any = { headers: { 'x-api-key': '  abc123  ' } };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
    expect(platformService.authenticateApiKey).toHaveBeenCalledWith('abc123');
    expect(request.user).toEqual({
      userId: 'api-key:key_1',
      organizationId: 'org_1',
      roles: ['INTEGRATION'],
    });
    expect(request.apiKey.organizationId).toBe('org_1');
  });

  it('accepts Bearer authorization header case-insensitively', async () => {
    const platformService = {
      authenticateApiKey: vi.fn().mockResolvedValue({
        id: 'key_2',
        organizationId: 'org_2',
        scopes: [],
      }),
    } as any;
    const guard = new ApiKeyAuthGuard(platformService);
    const request: any = { headers: { authorization: 'bEaReR  token_2  ' } };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
    expect(platformService.authenticateApiKey).toHaveBeenCalledWith('token_2');
  });

  it('uses the first x-api-key header value when multiple are provided', async () => {
    const platformService = {
      authenticateApiKey: vi.fn().mockResolvedValue({
        id: 'key_3',
        organizationId: 'org_3',
        scopes: [],
      }),
    } as any;
    const guard = new ApiKeyAuthGuard(platformService);
    const request: any = { headers: { 'x-api-key': ['  first  ', 'second'] } };

    await expect(
      guard.canActivate(createExecutionContext(request)),
    ).resolves.toBe(true);
    expect(platformService.authenticateApiKey).toHaveBeenCalledWith('first');
  });

  it('rejects excessively long keys before hitting PlatformService', async () => {
    const platformService = {
      authenticateApiKey: vi.fn(),
    } as any;
    const guard = new ApiKeyAuthGuard(platformService);
    const request: any = {
      headers: { 'x-api-key': 'a'.repeat(600) },
    };

    await expect(() =>
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toThrow(new UnauthorizedException('Invalid API key'));
    expect(platformService.authenticateApiKey).not.toHaveBeenCalled();
  });

  it('rejects when PlatformService does not authenticate the key', async () => {
    const platformService = {
      authenticateApiKey: vi.fn().mockResolvedValue(null),
    } as any;
    const guard = new ApiKeyAuthGuard(platformService);
    const request: any = { headers: { 'x-api-key': 'abc' } };

    await expect(() =>
      guard.canActivate(createExecutionContext(request)),
    ).rejects.toThrow(new UnauthorizedException('Invalid API key'));
  });
});
