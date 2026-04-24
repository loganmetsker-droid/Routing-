import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

type RequestContext = {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: {
    userId: string;
    organizationId?: string;
    email: string;
    role?: string;
    roles?: string[];
    sessionId?: string;
    authProvider?: string;
  };
};

function getUserAgent(req: RequestContext) {
  const userAgentHeader = req.headers?.['user-agent'];
  return Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('config')
  async config() {
    return {
      auth: await this.authService.getAuthConfiguration(),
    };
  }

  @Public()
  @Get('workos/authorize-url')
  async workosAuthorizeUrl(
    @Query('organizationId') organizationId?: string,
    @Query('state') state?: string,
  ) {
    const configuration = await this.authService.getAuthConfiguration();
    const url = await this.authService.getWorkosAuthorizeUrl(
      organizationId,
      state,
    );
    if (!url) {
      return {
        url: null,
        auth: configuration,
      };
    }

    return {
      url,
      auth: configuration,
    };
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Log in and receive JWT access token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged in',
  })
  login(@Body() body: LoginDto, @Req() req: RequestContext) {
    return this.authService.login(body.email, body.password, {
      userAgent: getUserAgent(req) || null,
      ipAddress: req.ip || null,
    });
  }

  @Public()
  @Post('workos/callback')
  async workosCallback(
    @Body() body: { code: string; invitationToken?: string },
    @Req() req: RequestContext,
  ) {
    return this.authService.loginWithWorkosCode(
      body.code,
      {
        userAgent: getUserAgent(req) || null,
        ipAddress: req.ip || null,
      },
      body.invitationToken,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get authenticated session user' })
  @ApiResponse({ status: 200, description: 'Current authenticated user' })
  me(@Req() req: RequestContext) {
    return {
      user: this.authService.getSessionUser(req.user!),
    };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  sessions(@Req() req: RequestContext) {
    return this.authService
      .listSessions(
        req.user!.userId,
        req.user!.organizationId,
        req.user!.sessionId,
      )
      .then((sessions) => ({ sessions }));
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  revokeSession(@Param('id') id: string, @Req() req: RequestContext) {
    return this.authService
      .revokeSession(id, req.user!.userId, req.user!.organizationId)
      .then((session) => ({ session }));
  }

  @Get('logout-url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  logoutUrl(@Req() req: RequestContext) {
    return this.authService
      .getLogoutUrl(req.user!.sessionId || '', req.user!.userId)
      .then((url) => ({ url }));
  }
}
