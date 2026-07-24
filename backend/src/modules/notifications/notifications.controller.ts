import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = {
  user: {
    organizationId?: string;
  };
};

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private requireOrganizationId(req: AuthenticatedRequest): string {
    const organizationId = req.user.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Organization scope required');
    }
    return organizationId;
  }

  @Get('overview')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  async overview(@Req() req: AuthenticatedRequest) {
    return {
      overview: await this.notificationsService.getOverview(
        this.requireOrganizationId(req),
      ),
    };
  }

  @Get()
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('routeId') routeId?: string,
  ) {
    return {
      deliveries: await this.notificationsService.list(
        this.requireOrganizationId(req),
        routeId,
      ),
    };
  }
}
