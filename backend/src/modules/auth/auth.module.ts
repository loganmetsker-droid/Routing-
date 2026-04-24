import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AppUser } from '../organizations/entities/app-user.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { OrganizationMembership } from '../organizations/entities/organization-membership.entity';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AuthSession } from './entities/auth-session.entity';
import { WorkosModule } from '../../common/integrations/workos.module';

/**
 * Auth Module
 * Handles JWT authentication and authorization
 */
@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([
      Organization,
      AppUser,
      OrganizationMembership,
      AuthSession,
    ]),
    OrganizationsModule,
    WorkosModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET is required');
        }

        return {
          secret,
          signOptions: {
            expiresIn: configService.get<number>('JWT_EXPIRES_IN_SECONDS', 60 * 60 * 24 * 7),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule, TypeOrmModule],
})
export class AuthModule {}
