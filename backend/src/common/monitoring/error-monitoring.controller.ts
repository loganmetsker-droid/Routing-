import { Body, Controller, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ClientErrorDto } from './client-error.dto';
import { ErrorMonitoringService } from './error-monitoring.service';

type AuthenticatedRequest = {
  requestId?: string;
  user?: { userId?: string; organizationId?: string };
};

@Controller('monitoring')
export class ErrorMonitoringController {
  constructor(private readonly monitoring: ErrorMonitoringService) {}

  @Post('client-errors')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  captureClientError(
    @Body() dto: ClientErrorDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const eventId = this.monitoring.capture({
      source: 'frontend',
      name: dto.name,
      message: dto.message,
      stack: dto.componentStack,
      context: {
        requestId: request.requestId,
        userId: request.user?.userId,
        organizationId: request.user?.organizationId,
        path: dto.path,
      },
    });
    return { accepted: true, eventId };
  }
}
