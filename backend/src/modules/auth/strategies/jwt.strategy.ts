import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthSession } from '../entities/auth-session.entity';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role?: string;
  roles?: string[];
  sid?: string;
  organizationId?: string;
  organizationSlug?: string;
  membershipId?: string;
  authProvider?: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Strategy for Passport
 * Validates JWT tokens and extracts user information
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(AuthSession)
    private readonly authSessions: Repository<AuthSession>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: (() => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is required');
        }
        return secret;
      })(),
    });
  }

  async validate(payload: JwtPayload) {
    // This is called after the token is verified
    // You can add additional validation here (e.g., check if user exists in DB)

    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    const enforceSessions =
      this.configService.get<string>('AUTH_SESSION_ENFORCEMENT', 'true') !==
      'false';
    if (enforceSessions) {
      if (!payload.sid) {
        throw new UnauthorizedException('Session is required');
      }
      const session = await this.authSessions.findOne({
        where: { id: payload.sid, userId: payload.sub },
      });
      if (!session || session.revokedAt) {
        throw new UnauthorizedException('Session has expired');
      }
      session.lastSeenAt = new Date();
      await this.authSessions.save(session);
    }

    // Return user object that will be attached to request.user
    return {
      userId: payload.sub,
      sessionId: payload.sid,
      email: payload.email,
      role: payload.role,
      roles: Array.isArray(payload.roles)
        ? payload.roles.map((role) => String(role).trim().toUpperCase())
        : payload.role
          ? [String(payload.role).trim().toUpperCase()]
          : [],
      organizationId: payload.organizationId,
      organizationSlug: payload.organizationSlug,
      membershipId: payload.membershipId,
      authProvider: payload.authProvider,
    };
  }
}
