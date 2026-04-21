import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role?: string;
  roles?: string[];
  organizationId?: string;
  organizationSlug?: string;
  membershipId?: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Strategy for Passport
 * Validates JWT tokens and extracts user information
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        (configService.get<string>('NODE_ENV') === 'development'
          ? 'development-only-jwt-secret'
          : undefined),
    });
  }

  async validate(payload: JwtPayload) {
    // This is called after the token is verified
    // You can add additional validation here (e.g., check if user exists in DB)

    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Return user object that will be attached to request.user
    return {
      userId: payload.sub,
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
    };
  }
}
