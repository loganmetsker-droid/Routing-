import type { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

export type SocketAuthContext = {
  token: string;
  userId: string;
  email?: string;
  organizationId: string;
  roles: string[];
};

function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const match = value.find((entry) => typeof entry === 'string');
    return typeof match === 'string' ? match : null;
  }
  return null;
}

function normalizeBearerToken(value: unknown): string | null {
  const raw = firstString(value)?.trim();
  if (!raw) return null;
  const bearerMatch = raw.match(/^Bearer\s+(.+)$/i);
  return (bearerMatch?.[1] || raw).trim() || null;
}

export function extractSocketBearerToken(client: Pick<Socket, 'handshake'>) {
  return (
    normalizeBearerToken(client.handshake.auth?.token) ||
    normalizeBearerToken(client.handshake.auth?.authorization) ||
    normalizeBearerToken(client.handshake.auth?.Authorization) ||
    normalizeBearerToken(client.handshake.headers?.authorization) ||
    normalizeBearerToken(client.handshake.query?.token)
  );
}

export async function authenticateSocket(
  jwtService: JwtService,
  client: Pick<Socket, 'handshake'>,
): Promise<SocketAuthContext> {
  const token = extractSocketBearerToken(client);
  if (!token) {
    throw new UnauthorizedException('Socket authentication token is required');
  }

  const payload = await jwtService.verifyAsync<JwtPayload>(token);
  const userId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
  const organizationId =
    typeof payload.organizationId === 'string'
      ? payload.organizationId.trim()
      : '';

  if (!userId || !organizationId) {
    throw new UnauthorizedException(
      'Socket authentication requires user and organization scope',
    );
  }

  return {
    token,
    userId,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    organizationId,
    roles: Array.isArray(payload.roles)
      ? payload.roles.map((role) => String(role).trim().toUpperCase())
      : payload.role
        ? [String(payload.role).trim().toUpperCase()]
        : [],
  };
}

export function getSocketAuth(client: Socket): SocketAuthContext | null {
  const value = client.data?.auth;
  if (!value || typeof value !== 'object') return null;
  const auth = value as Partial<SocketAuthContext>;
  return typeof auth.organizationId === 'string' && auth.organizationId
    ? (auth as SocketAuthContext)
    : null;
}

export function socketOrganizationRoom(
  namespace: 'dispatch' | 'tracking',
  organizationId: string,
  channel?: string,
) {
  return [namespace, 'org', organizationId, channel].filter(Boolean).join(':');
}
