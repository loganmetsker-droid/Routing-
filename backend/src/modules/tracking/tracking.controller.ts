import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TrackingService } from './tracking.service';

type AuthenticatedRequest = {
  user?: {
    userId?: string;
    organizationId?: string;
    role?: string;
    roles?: string[];
  };
};

type TelemetryIngestDto = {
  vehicleId: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  odometer?: number;
  fuelLevel?: number;
  engineTemp?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  organizationId?: string;
};

@ApiTags('tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  private requireOrganizationId(req: AuthenticatedRequest): string {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Organization scope required');
    }
    return organizationId;
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async overview(
    @Req() req: AuthenticatedRequest,
    @Query('freshnessMinutes', new ParseIntPipe({ optional: true }))
    freshnessMinutes?: number,
  ) {
    const scopedOrganizationId = this.requireOrganizationId(req);
    return this.trackingService.getOverview({
      organizationId: scopedOrganizationId,
      freshnessMinutes,
    });
  }

  @Get('history/:vehicleId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async history(
    @Req() req: AuthenticatedRequest,
    @Param('vehicleId') vehicleId: string,
    @Query('hours', new ParseIntPipe({ optional: true })) hours?: number,
  ) {
    const scopedOrganizationId = this.requireOrganizationId(req);
    const history = await this.trackingService.getVehicleLocationHistory(
      vehicleId,
      hours ?? 24,
      scopedOrganizationId,
    );

    return {
      vehicleId,
      organizationId: scopedOrganizationId,
      count: history.length,
      history,
    };
  }

  @Post('ingest')
  @HttpCode(202)
  async ingest(@Body() body: TelemetryIngestDto, @Req() req: AuthenticatedRequest) {
    const organizationId = this.requireOrganizationId(req);
    return {
      accepted: true,
      telemetry: await this.trackingService.ingestTelemetry({
        ...body,
        organizationId,
      }),
    };
  }

  @Get('readiness')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async readiness(@Req() req: AuthenticatedRequest) {
    return this.trackingService.getReadiness(this.requireOrganizationId(req));
  }
}
