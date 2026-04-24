import { Controller, Get, Query, Req } from '@nestjs/common';
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

  @Get('overview')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  async overview(@Req() req: AuthenticatedRequest) {
    return {
      overview: await this.notificationsService.getOverview(
        req.user.organizationId,
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
        req.user.organizationId,
        routeId,
      ),
    };
  }
}
