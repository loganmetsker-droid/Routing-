import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkosService } from '../../common/integrations/workos.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuthSession } from './entities/auth-session.entity';

type AuthUser = {
  id: string;
  email: string;
  role: string;
  roles: string[];
  authProvider?: string;
  organizationId?: string;
  organizationSlug?: string;
  membershipId?: string;
};

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

function normalizeRoles(...values: Array<string | undefined | null>) {
  const roles = values
    .flatMap((value) => String(value || '').split(','))
    .map((role) => role.trim().toUpperCase())
    .filter(Boolean);

  return Array.from(new Set(roles.length > 0 ? roles : ['ADMIN']));
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly organizationsService: OrganizationsService,
    private readonly workosService: WorkosService,
    @InjectRepository(AuthSession)
    private readonly authSessions: Repository<AuthSession>,
  ) {}

  private decodeJwtClaims(token: string) {
    try {
      const [, payload] = token.split('.');
      if (!payload) {
        return {};
      }
      const json = Buffer.from(payload, 'base64url').toString('utf8');
      const value = JSON.parse(json);
      return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  private getSessionExpiry() {
    return this.configService.get<string>('JWT_EXPIRES_IN', '7d');
  }

  private async createApplicationSession(
    user: AuthUser,
    authProvider: string,
    sessionContext?: SessionContext,
    providerSessionId?: string | null,
  ) {
    const session = await this.authSessions.save(
      this.authSessions.create({
        userId: user.id,
        organizationId: user.organizationId || null,
        email: user.email,
        authProvider,
        providerSessionId: providerSessionId || null,
        roles: user.roles,
        userAgent: sessionContext?.userAgent || null,
        ipAddress: sessionContext?.ipAddress || null,
        lastSeenAt: new Date(),
      }),
    );

    const payload = {
      sub: user.id,
      sid: session.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
      authProvider,
      organizationId: user.organizationId,
      organizationSlug: user.organizationSlug,
      membershipId: user.membershipId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        ...user,
        authProvider,
      },
      sessionId: session.id,
      expiresIn: this.getSessionExpiry(),
    };
  }

  async getAuthConfiguration() {
    return this.workosService.getConfiguration();
  }

  async getWorkosAuthorizeUrl(organizationId?: string, state?: string) {
    if (!this.workosService.isConfigured()) {
      return null;
    }

    return this.workosService.getAuthorizationUrl({
      organizationId,
      state,
    });
  }

  async login(email: string, password: string, sessionContext?: SessionContext) {
    const config = this.workosService.getConfiguration();
    if (
      config.preferredProvider === 'workos' &&
      !config.localLoginAllowed
    ) {
      throw new UnauthorizedException(
        'Password sign-in is disabled in this environment. Use WorkOS AuthKit.',
      );
    }

    const user = await this.validateLocalUser(email, password);
    return this.createApplicationSession(
      user,
      'local-config',
      sessionContext,
      null,
    );
  }

  async loginWithWorkosCode(
    code: string,
    sessionContext?: SessionContext,
    invitationToken?: string,
  ) {
    if (!this.workosService.isConfigured()) {
      throw new UnauthorizedException('WorkOS is not configured');
    }

    const response = await this.workosService.authenticateWithCode({
      code,
      invitationToken,
      ipAddress: sessionContext?.ipAddress || null,
      userAgent: sessionContext?.userAgent || null,
    });

    const claims = this.decodeJwtClaims(response.accessToken);
    const providerRoles = normalizeRoles(
      typeof claims.role === 'string' ? claims.role : undefined,
    );
    const displayName = [response.user.firstName, response.user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
      response.user.email;

    const provisioned = await this.organizationsService.provisionIdentityUser({
      authProvider: 'workos',
      displayName,
      email: response.user.email,
      externalUserId: response.user.id,
      providerOrganizationId:
        response.organizationId ||
        (typeof claims.org_id === 'string' ? claims.org_id : null),
      requestedRoles: providerRoles,
    });

    return this.createApplicationSession(
      {
        id: provisioned.user.id,
        email: provisioned.user.email,
        role: provisioned.membership.role,
        roles: provisioned.membership.roles,
        authProvider: 'workos',
        organizationId: provisioned.organization.id,
        organizationSlug: provisioned.organization.slug,
        membershipId: provisioned.membership.id,
      },
      'workos',
      sessionContext,
      typeof claims.sid === 'string' ? claims.sid : null,
    );
  }

  getSessionUser(user: {
    userId: string;
    email: string;
    role?: string;
    roles?: string[];
    authProvider?: string;
    organizationId?: string;
    organizationSlug?: string;
    membershipId?: string;
    sessionId?: string;
  }) {
    const roles = normalizeRoles(...(user.roles || []), user.role);
    return {
      id: user.userId,
      email: user.email,
      role: roles[0],
      roles,
      authProvider: user.authProvider || 'local-config',
      organizationId: user.organizationId,
      organizationSlug: user.organizationSlug,
      membershipId: user.membershipId,
      sessionId: user.sessionId,
    };
  }

  async listSessions(
    userId: string,
    organizationId?: string,
    currentSessionId?: string,
  ) {
    const sessions = await this.authSessions.find({
      where: organizationId ? { userId, organizationId } : { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return sessions.map((session) => ({
      id: session.id,
      email: session.email,
      authProvider: session.authProvider,
      providerSessionId: session.providerSessionId || null,
      current: currentSessionId === session.id,
      roles: session.roles,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastSeenAt: session.lastSeenAt?.toISOString() || null,
      revokedAt: session.revokedAt?.toISOString() || null,
      createdAt: session.createdAt?.toISOString(),
      updatedAt: session.updatedAt?.toISOString(),
    }));
  }

  async revokeSession(
    sessionId: string,
    userId: string,
    organizationId?: string,
  ) {
    const session = await this.authSessions.findOne({
      where: organizationId
        ? { id: sessionId, userId, organizationId }
        : { id: sessionId, userId },
    });
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }
    session.revokedAt = new Date();
    await this.authSessions.save(session);
    return {
      id: session.id,
      revokedAt: session.revokedAt.toISOString(),
    };
  }

  async getLogoutUrl(sessionId: string, userId: string) {
    if (!sessionId) {
      return null;
    }
    const session = await this.authSessions.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) {
      return null;
    }

    if (session.authProvider === 'workos' && session.providerSessionId) {
      return this.workosService.getLogoutUrl(session.providerSessionId);
    }

    return null;
  }

  private async validateLocalUser(
    email: string,
    password: string,
  ): Promise<AuthUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const configuredEmail = this.configService
      .get<string>('AUTH_ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();
    const configuredPassword = this.configService.get<string>('AUTH_ADMIN_PASSWORD');
    const configuredRole = this.configService.get<string>(
      'AUTH_ADMIN_ROLE',
      'ADMIN',
    );
    const configuredRoles = normalizeRoles(
      this.configService.get<string>('AUTH_ADMIN_ROLES'),
      configuredRole,
    );

    if (!configuredEmail || !configuredPassword) {
      throw new UnauthorizedException('Authentication is not configured');
    }

    if (
      normalizedEmail !== configuredEmail ||
      password !== configuredPassword
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const bootstrap = await this.organizationsService.ensureBootstrapOrganization(
      configuredEmail,
      this.configService.get<string>('AUTH_ADMIN_DISPLAY_NAME', 'Local Admin'),
      configuredRoles,
    );

    return {
      id: bootstrap.user.id,
      email: configuredEmail,
      role: configuredRoles[0],
      roles: configuredRoles,
      authProvider: 'local-config',
      organizationId: bootstrap.organization.id,
      organizationSlug: bootstrap.organization.slug,
      membershipId: bootstrap.membership.id,
    };
  }
}
