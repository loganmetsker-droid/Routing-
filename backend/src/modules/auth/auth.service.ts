import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OrganizationsService } from '../organizations/organizations.service';

type AuthUser = {
  id: string;
  email: string;
  role: string;
  roles: string[];
  organizationId?: string;
  organizationSlug?: string;
  membershipId?: string;
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
  ) {}

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
      organizationId: user.organizationId,
      organizationSlug: user.organizationSlug,
      membershipId: user.membershipId,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user,
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
    };
  }

  getSessionUser(user: {
    userId: string;
    email: string;
    role?: string;
    roles?: string[];
    organizationId?: string;
    organizationSlug?: string;
    membershipId?: string;
  }) {
    const roles = normalizeRoles(...(user.roles || []), user.role);
    return {
      id: user.userId,
      email: user.email,
      role: roles[0],
      roles,
      organizationId: user.organizationId,
      organizationSlug: user.organizationSlug,
      membershipId: user.membershipId,
    };
  }

  private async validateUser(email: string, password: string): Promise<AuthUser> {
    const normalizedEmail = email.trim().toLowerCase();
    const configuredEmail = this.configService
      .get<string>('AUTH_ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();
    const configuredPassword = this.configService.get<string>('AUTH_ADMIN_PASSWORD');
    const configuredUserId = this.configService.get<string>(
      'AUTH_ADMIN_USER_ID',
      'admin-user',
    );
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
      id: bootstrap.user.id || configuredUserId,
      email: configuredEmail,
      role: configuredRoles[0],
      roles: configuredRoles,
      organizationId: bootstrap.organization.id,
      organizationSlug: bootstrap.organization.slug,
      membershipId: bootstrap.membership.id,
    };
  }
}
