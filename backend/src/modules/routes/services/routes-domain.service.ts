import { Injectable } from '@nestjs/common';
import { RoutesRepository } from '../repositories/routes.repository';

@Injectable()
export class RoutesDomainService {
  constructor(private readonly routesRepository: RoutesRepository) {}

  repositoryReady(): boolean {
    return Boolean(this.routesRepository);
  }
}
