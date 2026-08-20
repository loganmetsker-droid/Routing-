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
import {
  boundTrackingHistoryHours,
  TRACKING_HISTORY_POINT_LIMIT,
  TrackingService,
} from './tracking.service';
import { TelemetryIngestDto } from './dto/telemetry-ingest.dto';

type AuthenticatedRequest = {
  user?: {
    userId?: string;
    email?: string;
    organizationId?: string;
    role?: string;
    roles?: string[];
  };
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
    const rangeHours = boundTrackingHistoryHours(hours ?? 24);
    const history = await this.trackingService.getVehicleLocationHistory(
      vehicleId,
      rangeHours,
      scopedOrganizationId,
    );

    return {
      vehicleId,
      organizationId: scopedOrganizationId,
      rangeHours,
      count: history.length,
      pointLimit: TRACKING_HISTORY_POINT_LIMIT,
      pointLimitReached: history.length >= TRACKING_HISTORY_POINT_LIMIT,
      order: 'ascending',
      source: 'telemetry',
      oldestAt: history[0]?.timestamp,
      newestAt: history.at(-1)?.timestamp,
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
      }, req.user),
    };
  }

  @Get('readiness')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  async readiness(@Req() req: AuthenticatedRequest) {
    return this.trackingService.getReadiness(this.requireOrganizationId(req));
  }
}
