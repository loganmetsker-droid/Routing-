import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';

function createExecutionContext(user?: { role?: string; roles?: string[] }) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as any;
}

describe('RolesGuard', () => {
  it('allows requests when no roles are required', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn().mockReturnValue([]),
    } as any);

    expect(guard.canActivate(createExecutionContext())).toBe(true);
  });

  it('rejects when authenticated user is missing', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    } as any);

    expect(() => guard.canActivate(createExecutionContext())).toThrow(
      new ForbiddenException('Authenticated user required'),
    );
  });

  it('accepts normalized role values from user.role', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn().mockReturnValue(['DISPATCHER']),
    } as any);

    expect(
      guard.canActivate(createExecutionContext({ role: 'dispatcher' })),
    ).toBe(true);
  });

  it('rejects when user roles do not satisfy requirements', () => {
    const guard = new RolesGuard({
      getAllAndOverride: jest.fn().mockReturnValue(['ADMIN']),
    } as any);

    expect(() =>
      guard.canActivate(createExecutionContext({ roles: ['VIEWER'] })),
    ).toThrow(new ForbiddenException('Insufficient permissions'));
  });
});
