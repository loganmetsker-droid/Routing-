import type { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import type { Socket } from 'socket.io';
import type { Repository } from 'typeorm';
import type { AuthSession } from '../../modules/auth/entities/auth-session.entity';
import {
  MAX_JWT_BEARER_TOKEN_LENGTH,
  type JwtPayload,
} from '../../modules/auth/strategies/jwt.strategy';

export type SocketAuthContext = {
  token: string;
  userId: string;
  sessionId?: string;
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
  if (raw.length > MAX_JWT_BEARER_TOKEN_LENGTH + 32) return null;
  const bearerMatch = raw.match(/^Bearer\s+(.+)$/i);
  const token = (bearerMatch?.[1] || raw).trim();
  if (!token) return null;
  if (token.length > MAX_JWT_BEARER_TOKEN_LENGTH) return null;
  return token;
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
  authSessions?: Pick<Repository<AuthSession>, 'findOne' | 'save'>,
): Promise<SocketAuthContext> {
  const token = extractSocketBearerToken(client);
  if (!token) {
    throw new UnauthorizedException('Socket authentication token is required');
  }

  let payload: JwtPayload;
  try {
    payload = await jwtService.verifyAsync<JwtPayload>(token);
  } catch {
    throw new UnauthorizedException('Invalid socket authentication token');
  }
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

  const sessionId = typeof payload.sid === 'string' ? payload.sid.trim() : '';
  if (authSessions) {
    if (!sessionId) {
      throw new UnauthorizedException('Socket authentication session is required');
    }

    const session = await authSessions.findOne({
      where: { id: sessionId, userId },
    });
    if (
      !session ||
      session.revokedAt ||
      (session.organizationId && session.organizationId !== organizationId)
    ) {
      throw new UnauthorizedException('Socket authentication session has expired');
    }

    session.lastSeenAt = new Date();
    await authSessions.save(session);
  }

  return {
    token,
    userId,
    sessionId: sessionId || undefined,
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
