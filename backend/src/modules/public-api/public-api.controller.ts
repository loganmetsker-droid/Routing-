import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyAuthGuard } from '../platform/api-key-auth.guard';
import { Job } from '../jobs/entities/job.entity';
import { Customer } from '../customers/entities/customer.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Route } from '../dispatch/entities/route.entity';
import { RouteRunStop } from '../dispatch/entities/route-run-stop.entity';
import { DispatchException } from '../dispatch/entities/dispatch-exception.entity';
import { ProofArtifact } from '../dispatch/entities/proof-artifact.entity';
import { Telemetry } from '../tracking/entities/telemetry.entity';

type ApiKeyRequest = {
  apiKey: {
    organizationId: string;
    scopes: string[];
  };
};

@ApiTags('public-api', 'integrations')
@ApiSecurity('x-api-key')
@Public()
@UseGuards(ApiKeyAuthGuard)
@Controller('v1')
export class PublicApiController {
  constructor(
    @InjectRepository(Job)
    private readonly jobs: Repository<Job>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(Driver)
    private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Route)
    private readonly routes: Repository<Route>,
    @InjectRepository(RouteRunStop)
    private readonly routeRunStops: Repository<RouteRunStop>,
    @InjectRepository(DispatchException)
    private readonly exceptions: Repository<DispatchException>,
    @InjectRepository(ProofArtifact)
    private readonly proofs: Repository<ProofArtifact>,
    @InjectRepository(Telemetry)
    private readonly telemetry: Repository<Telemetry>,
  ) {}

  private requireScope(req: ApiKeyRequest, scope: string) {
    const scopes = req.apiKey.scopes || [];
    if (!scopes.includes(scope) && !scopes.includes('*') && !scopes.includes(`${scope.split(':')[0]}:*`)) {
      throw new ForbiddenException(`API key missing required scope: ${scope}`);
    }
  }

  @Get('jobs')
  async listJobs(@Req() req: ApiKeyRequest) {
    this.requireScope(req, 'jobs:read');
    return {
      jobs: await this.jobs.find({
        where: { organizationId: req.apiKey.organizationId },
        order: { createdAt: 'DESC' },
        take: 250,
      }),
    };
  }

  @Get('jobs/:id')
  async jobDetail(@Req() req: ApiKeyRequest, @Param('id') id: string) {
    this.requireScope(req, 'jobs:read');
    return {
      job: await this.jobs.findOneOrFail({
        where: { id, organizationId: req.apiKey.organizationId },
      }),
    };
  }

  @Get('customers')
  async listCustomers(@Req() req: ApiKeyRequest) {
    this.requireScope(req, 'customers:read');
    return {
      customers: await this.customers.find({
        where: { organizationId: req.apiKey.organizationId },
        order: { createdAt: 'DESC' },
        take: 250,
      }),
    };
  }

  @Get('drivers')
  async listDrivers(@Req() req: ApiKeyRequest) {
    this.requireScope(req, 'drivers:read');
    return {
      drivers: await this.drivers.find({
        where: { organizationId: req.apiKey.organizationId },
        order: { createdAt: 'DESC' },
        take: 250,
      }),
    };
  }

  @Get('vehicles')
  async listVehicles(@Req() req: ApiKeyRequest) {
    this.requireScope(req, 'vehicles:read');
    return {
      vehicles: await this.vehicles.find({
        where: { organizationId: req.apiKey.organizationId },
        order: { createdAt: 'DESC' },
        take: 250,
      }),
    };
  }

  @Get('route-runs')
  async listRouteRuns(@Req() req: ApiKeyRequest) {
    this.requireScope(req, 'route-runs:read');
    return {
      routeRuns: await this.routes.find({
        where: { organizationId: req.apiKey.organizationId },
        order: { createdAt: 'DESC' },
        take: 250,
      }),
    };
  }

  @Get('route-runs/:id')
  async routeRunDetail(@Req() req: ApiKeyRequest, @Param('id') id: string) {
    this.requireScope(req, 'route-runs:read');
    const routeRun = await this.routes.findOneOrFail({
      where: { id, organizationId: req.apiKey.organizationId },
    });
    const stops = await this.routeRunStops.find({
      where: {
        routeId: id,
        organizationId: req.apiKey.organizationId,
      },
      order: { stopSequence: 'ASC' },
    });
    const stopIds = stops.map((stop) => stop.id);
    return {
      routeRun,
      stops,
      exceptions: await this.exceptions.find({
        where: { routeId: id, organizationId: req.apiKey.organizationId },
        order: { createdAt: 'DESC' },
      }),
      proofArtifacts: stopIds.length
        ? await this.proofs.find({
            where: { routeRunStopId: In(stopIds), organizationId: req.apiKey.organizationId },
            order: { createdAt: 'DESC' },
          })
        : [],
    };
  }

  @Get('route-runs/:id/tracking')
  async routeRunTracking(@Req() req: ApiKeyRequest, @Param('id') id: string) {
    this.requireScope(req, 'route-runs:read');
    const routeRun = await this.routes.findOneOrFail({
      where: { id, organizationId: req.apiKey.organizationId },
    });
    const latestTelemetry = routeRun.vehicleId
      ? await this.telemetry.findOne({
          where: { vehicleId: routeRun.vehicleId },
          order: { timestamp: 'DESC' },
        })
      : null;
    return {
      routeRun,
      latestTelemetry,
    };
  }

  @Get('exceptions')
  async listExceptions(@Req() req: ApiKeyRequest) {
    this.requireScope(req, 'exceptions:read');
    return {
      exceptions: await this.exceptions.find({
        where: { organizationId: req.apiKey.organizationId },
        order: { createdAt: 'DESC' },
        take: 250,
      }),
    };
  }
}
