import { Body, Controller, ForbiddenException, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateDepotDto } from './dto/create-depot.dto';
import { DepotsService } from './depots.service';

type AuthenticatedRequest = {
  user?: {
    organizationId?: string;
  };
};

@ApiTags('depots')
@Controller('depots')
@ApiBearerAuth('JWT-auth')
export class DepotsController {
  constructor(private readonly depots: DepotsService) {}

  private requireOrganizationId(req: AuthenticatedRequest): string {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Organization scope required');
    }
    return organizationId;
  }

  @Get()
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  async list(@Req() req: AuthenticatedRequest) {
    return { depots: await this.depots.findAll(this.requireOrganizationId(req)) };
  }

  @Get(':id')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  async detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return { depot: await this.depots.findOne(id, this.requireOrganizationId(req)) };
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'DISPATCHER')
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateDepotDto) {
    return {
      depot: await this.depots.create({
        ...dto,
        organizationId: this.requireOrganizationId(req),
      }),
    };
  }
}
