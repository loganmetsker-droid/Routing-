import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

type AuthUser = {
  id: string;
  email: string;
  role: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = this.validateUser(email, password);

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user,
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '7d'),
    };
  }

  getSessionUser(user: { userId: string; email: string; role?: string }) {
    return {
      id: user.userId,
      email: user.email,
      role: user.role || 'operator',
    };
  }

  private validateUser(email: string, password: string): AuthUser {
    const normalizedEmail = email.trim().toLowerCase();
    const configuredEmail = this.configService
      .get<string>('AUTH_ADMIN_EMAIL', 'admin@routing.local')
      .trim()
      .toLowerCase();
    const configuredPassword = this.configService.get<string>(
      'AUTH_ADMIN_PASSWORD',
      'ChangeMe123!',
    );
    const configuredUserId = this.configService.get<string>(
      'AUTH_ADMIN_USER_ID',
      'admin-user',
    );
    const configuredRole = this.configService.get<string>(
      'AUTH_ADMIN_ROLE',
      'admin',
    );

    if (
      normalizedEmail !== configuredEmail ||
      password !== configuredPassword
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      id: configuredUserId,
      email: configuredEmail,
      role: configuredRole,
    };
  }
}
