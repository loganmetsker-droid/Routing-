import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { PlatformService } from './platform.service';
import { PlatformController } from './platform.controller';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, WebhookEndpoint, WebhookDelivery]),
  ],
  controllers: [PlatformController],
  providers: [PlatformService, ApiKeyAuthGuard],
  exports: [PlatformService, ApiKeyAuthGuard, TypeOrmModule],
})
export class PlatformModule {}
