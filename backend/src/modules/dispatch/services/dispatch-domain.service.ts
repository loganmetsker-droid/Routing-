import { Injectable } from '@nestjs/common';
import { DispatchRepository } from '../repositories/dispatch.repository';

@Injectable()
export class DispatchDomainService {
  constructor(private readonly dispatchRepository: DispatchRepository) {}

  async routeExists(routeId: string): Promise<boolean> {
    const route = await this.dispatchRepository.findRouteById(routeId);
    return Boolean(route);
  }
}
