import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationsService } from './organizations.service';

type AuthenticatedRequest = {
  user: {
    userId: string;
    organizationId?: string;
    role?: string;
    roles?: string[];
  };
};

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const items = await this.organizationsService.listForUser(req.user.userId);
    return {
      organizations: items.map((item) => ({
        ...item.organization,
        membership: item.membership,
      })),
    };
  }

  @Get('current')
  async current(@Req() req: AuthenticatedRequest) {
    const organization = req.user.organizationId
      ? await this.organizationsService.getOrganization(req.user.organizationId)
      : null;
    return { organization };
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrganizationDto) {
    return {
      organization: await this.organizationsService.create(dto, req.user.userId),
    };
  }
}
