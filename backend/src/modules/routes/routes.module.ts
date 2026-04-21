import { Module } from '@nestjs/common';
import { RoutesRepository } from './repositories/routes.repository';
import { RoutesDomainService } from './services/routes-domain.service';

@Module({
  providers: [RoutesRepository, RoutesDomainService],
  exports: [RoutesRepository, RoutesDomainService],
})
export class RoutesModule {}
