import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('audit')
@Controller('audit')
@ApiBearerAuth('JWT-auth')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  async list(
    @Req() req: { user?: { organizationId?: string } },
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
  ) {
    return {
      entries: await this.auditService.listPersisted({
        limit: Number(limit || 100),
        organizationId: req.user?.organizationId || undefined,
        action,
        entityType,
        actorId,
      }),
    };
  }

  @Get('overview')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  async overview(@Req() req: { user?: { organizationId?: string } }) {
    return this.auditService.getOverview({
      organizationId: req.user?.organizationId || undefined,
    });
  }
}
