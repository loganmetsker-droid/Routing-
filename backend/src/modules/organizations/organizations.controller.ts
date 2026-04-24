import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
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
    if (!req.user.organizationId) {
      return { organization: null };
    }

    const context = await this.organizationsService.getOrganizationContext(
      req.user.organizationId,
      req.user.userId,
    );
    return { organization: context };
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrganizationDto) {
    return {
      organization: await this.organizationsService.create(dto, req.user.userId),
    };
  }

  @Patch('current/settings')
  @Roles('OWNER', 'ADMIN')
  async updateCurrentSettings(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOrganizationSettingsDto,
  ) {
    if (!req.user.organizationId) {
      throw new BadRequestException('No active organization selected');
    }

    return {
      organization: await this.organizationsService.updateCurrentSettings(
        req.user.organizationId,
        req.user.userId,
        dto,
      ),
    };
  }

  @Get('current/members')
  @Roles('OWNER', 'ADMIN')
  async listCurrentMembers(@Req() req: AuthenticatedRequest) {
    if (!req.user.organizationId) {
      throw new BadRequestException('No active organization selected');
    }

    return {
      members: await this.organizationsService.listMembers(req.user.organizationId),
    };
  }

  @Get('current/invitations')
  @Roles('OWNER', 'ADMIN')
  async listCurrentInvitations(@Req() req: AuthenticatedRequest) {
    if (!req.user.organizationId) {
      throw new BadRequestException('No active organization selected');
    }

    return {
      invitations: await this.organizationsService.listInvitations(
        req.user.organizationId,
      ),
    };
  }

  @Post('current/invitations')
  @Roles('OWNER', 'ADMIN')
  async inviteToCurrentOrganization(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateOrganizationInvitationDto,
  ) {
    if (!req.user.organizationId) {
      throw new BadRequestException('No active organization selected');
    }

    return {
      invitation: await this.organizationsService.createInvitation(
        req.user.organizationId,
        req.user.userId,
        dto,
      ),
    };
  }

  @Post('current/invitations/:id/revoke')
  @Roles('OWNER', 'ADMIN')
  async revokeCurrentInvitation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    if (!req.user.organizationId) {
      throw new BadRequestException('No active organization selected');
    }

    return {
      invitation: await this.organizationsService.revokeInvitation(
        req.user.organizationId,
        id,
      ),
    };
  }
}
