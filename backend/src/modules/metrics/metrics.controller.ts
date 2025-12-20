import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns all application metrics in Prometheus exposition format',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics successfully retrieved',
    content: {
      'text/plain': {
        example: `# HELP fleet_avg_distance_per_vehicle_km Average distance traveled per vehicle (km) in the last 24 hours
# TYPE fleet_avg_distance_per_vehicle_km gauge
fleet_avg_distance_per_vehicle_km{vehicle_id="1",vehicle_type="truck"} 245.5

# HELP fleet_fuel_consumption_liters_per_100km Fuel consumption trend (L/100km) in the last 24 hours
# TYPE fleet_fuel_consumption_liters_per_100km gauge
fleet_fuel_consumption_liters_per_100km{vehicle_id="1",fuel_type="diesel"} 12.3

# HELP fleet_ontime_delivery_rate_percent On-time delivery rate (percentage) in the last 24 hours
# TYPE fleet_ontime_delivery_rate_percent gauge
fleet_ontime_delivery_rate_percent 94.5`,
      },
    },
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
