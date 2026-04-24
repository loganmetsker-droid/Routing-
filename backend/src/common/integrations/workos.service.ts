import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WorkOS } from '@workos-inc/node';

type WorkosAuthorizationOptions = {
  connectionId?: string;
  invitationToken?: string;
  organizationId?: string;
  provider?:
    | 'authkit'
    | 'AppleOAuth'
    | 'GitHubOAuth'
    | 'GoogleOAuth'
    | 'MicrosoftOAuth';
  state?: string;
};

type WorkosAuthenticateWithCodeOptions = {
  code: string;
  invitationToken?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type WorkosInvitationOptions = {
  email: string;
  expiresInDays?: number;
  inviterUserId?: string | null;
  organizationId?: string;
  roleSlug?: string;
};

type WorkosConfiguration = {
  enabled: boolean;
  configured: boolean;
  localLoginAllowed: boolean;
  preferredProvider: 'workos' | 'local-config';
  workos: {
    apiKeyConfigured: boolean;
    authkitDomain?: string | null;
    clientIdConfigured: boolean;
    connectionIdConfigured: boolean;
    mfaManagedByProvider: boolean;
    redirectUri?: string | null;
    ssoReady: boolean;
  };
};

const truthy = new Set(['1', 'true', 'yes', 'on']);

@Injectable()
export class WorkosService {
  private readonly workos: WorkOS | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('WORKOS_API_KEY');
    const clientId = this.configService.get<string>('WORKOS_CLIENT_ID');

    this.workos =
      apiKey && clientId
        ? new WorkOS(apiKey, {
            clientId,
          })
        : null;
  }

  private getAuthProvider() {
    return this.configService.get<string>('AUTH_PROVIDER', 'local-config');
  }

  private getFrontendUrl() {
    return this.configService.get<string>('FRONTEND_URL', 'http://127.0.0.1:5184');
  }

  private getWorkosRedirectUri() {
    return this.configService.get<string>(
      'WORKOS_REDIRECT_URI',
      `${this.getFrontendUrl().replace(/\/+$/, '')}/auth/callback`,
    );
  }

  private getLogoutReturnTo() {
    return this.configService.get<string>(
      'WORKOS_LOGOUT_REDIRECT_URI',
      `${this.getFrontendUrl().replace(/\/+$/, '')}/login`,
    );
  }

  private getLocalLoginAllowed() {
    const configured = this.configService.get<string>('ALLOW_LOCAL_AUTH');
    if (configured !== undefined) {
      return truthy.has(configured.toLowerCase());
    }
    return ['development', 'test'].includes(
      this.configService.get<string>('NODE_ENV', 'development'),
    );
  }

  isConfigured() {
    return Boolean(
      this.workos &&
        this.configService.get<string>('WORKOS_API_KEY') &&
        this.configService.get<string>('WORKOS_CLIENT_ID'),
    );
  }

  isEnabled() {
    return this.getAuthProvider() === 'workos' && this.isConfigured();
  }

  getConfiguration(): WorkosConfiguration {
    return {
      enabled: this.isEnabled(),
      configured: this.isConfigured(),
      localLoginAllowed: this.getLocalLoginAllowed(),
      preferredProvider: this.isEnabled() ? 'workos' : 'local-config',
      workos: {
        apiKeyConfigured: Boolean(this.configService.get<string>('WORKOS_API_KEY')),
        authkitDomain:
          this.configService.get<string>('WORKOS_AUTHKIT_DOMAIN') || null,
        clientIdConfigured: Boolean(
          this.configService.get<string>('WORKOS_CLIENT_ID'),
        ),
        connectionIdConfigured: Boolean(
          this.configService.get<string>('WORKOS_CONNECTION_ID'),
        ),
        mfaManagedByProvider: this.isConfigured(),
        redirectUri: this.getWorkosRedirectUri(),
        ssoReady: this.isConfigured(),
      },
    };
  }

  getAuthorizationUrl(options: WorkosAuthorizationOptions = {}) {
    if (!this.workos) {
      throw new Error('WorkOS is not configured');
    }

    return this.workos.userManagement.getAuthorizationUrl({
      clientId: this.configService.getOrThrow<string>('WORKOS_CLIENT_ID'),
      connectionId:
        options.connectionId ||
        this.configService.get<string>('WORKOS_CONNECTION_ID') ||
        undefined,
      organizationId: options.organizationId,
      provider: options.provider || 'authkit',
      redirectUri: this.getWorkosRedirectUri(),
      state: options.state,
    });
  }

  async authenticateWithCode(options: WorkosAuthenticateWithCodeOptions) {
    if (!this.workos) {
      throw new Error('WorkOS is not configured');
    }

    return this.workos.userManagement.authenticateWithCode({
      clientId: this.configService.getOrThrow<string>('WORKOS_CLIENT_ID'),
      code: options.code,
      invitationToken: options.invitationToken,
      ipAddress: options.ipAddress || undefined,
      userAgent: options.userAgent || undefined,
    });
  }

  async sendInvitation(options: WorkosInvitationOptions) {
    if (!this.workos) {
      throw new Error('WorkOS is not configured');
    }

    return this.workos.userManagement.sendInvitation({
      email: options.email,
      expiresInDays: options.expiresInDays,
      inviterUserId: options.inviterUserId || undefined,
      organizationId: options.organizationId,
      roleSlug: options.roleSlug,
    });
  }

  getLogoutUrl(sessionId: string) {
    if (!this.workos) {
      throw new Error('WorkOS is not configured');
    }

    return this.workos.userManagement.getLogoutUrl({
      sessionId,
      returnTo: this.getLogoutReturnTo(),
    });
  }
}
