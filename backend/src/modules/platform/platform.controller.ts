import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { PlatformService } from './platform.service';

type AuthenticatedRequest = {
  user: {
    userId: string;
    organizationId?: string;
  };
};

@ApiTags('platform', 'api-keys', 'webhooks')
@ApiBearerAuth('JWT-auth')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('overview')
  @Roles('OWNER', 'ADMIN')
  async overview(@Req() req: AuthenticatedRequest) {
    return {
      overview: await this.platformService.getOverview(
        req.user.organizationId || '',
      ),
    };
  }

  @Get('api-keys')
  @Roles('OWNER', 'ADMIN')
  async listApiKeys(@Req() req: AuthenticatedRequest) {
    return {
      apiKeys: await this.platformService.listApiKeys(
        req.user.organizationId || '',
      ),
    };
  }

  @Post('api-keys')
  @Roles('OWNER', 'ADMIN')
  async createApiKey(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.platformService.createApiKey(
      req.user.organizationId || '',
      dto,
      req.user.userId,
    );
  }

  @Delete('api-keys/:id')
  @Roles('OWNER', 'ADMIN')
  async revokeApiKey(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return {
      apiKey: await this.platformService.revokeApiKey(
        id,
        req.user.organizationId || '',
      ),
    };
  }

  @Get('webhooks')
  @Roles('OWNER', 'ADMIN')
  async listWebhooks(@Req() req: AuthenticatedRequest) {
    return {
      webhooks: await this.platformService.listWebhookEndpoints(
        req.user.organizationId || '',
      ),
    };
  }

  @Post('webhooks')
  @Roles('OWNER', 'ADMIN')
  async createWebhook(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateWebhookEndpointDto,
  ) {
    return this.platformService.createWebhookEndpoint(
      req.user.organizationId || '',
      dto,
      req.user.userId,
    );
  }

  @Patch('webhooks/:id')
  @Roles('OWNER', 'ADMIN')
  async updateWebhook(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ) {
    return {
      webhook: await this.platformService.updateWebhookEndpoint(
        id,
        req.user.organizationId || '',
        dto,
      ),
    };
  }

  @Post('webhooks/:id/rotate-secret')
  @Roles('OWNER', 'ADMIN')
  async rotateWebhookSecret(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.platformService.rotateWebhookSigningSecret(
      id,
      req.user.organizationId || '',
    );
  }

  @Get('webhook-deliveries')
  @Roles('OWNER', 'ADMIN')
  async listDeliveries(
    @Req() req: AuthenticatedRequest,
    @Query('endpointId') endpointId?: string,
  ) {
    return {
      deliveries: await this.platformService.listWebhookDeliveries(
        req.user.organizationId || '',
        endpointId,
      ),
    };
  }

  @Post('webhook-deliveries/:id/replay')
  @Roles('OWNER', 'ADMIN')
  async replayDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return {
      delivery: await this.platformService.replayWebhookDelivery(
        req.user.organizationId || '',
        id,
      ),
    };
  }
}
