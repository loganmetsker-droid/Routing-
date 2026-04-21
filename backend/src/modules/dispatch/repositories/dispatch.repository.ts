import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from '../entities/route.entity';

@Injectable()
export class DispatchRepository {
  constructor(
    @InjectRepository(Route)
    private readonly routeRepo: Repository<Route>,
  ) {}

  findRouteById(id: string): Promise<Route | null> {
    return this.routeRepo.findOne({ where: { id } });
  }

  saveRoute(route: Route): Promise<Route> {
    return this.routeRepo.save(route);
  }
}
