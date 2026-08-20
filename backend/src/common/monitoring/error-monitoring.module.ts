import { Global, Module } from '@nestjs/common';
import { ErrorMonitoringController } from './error-monitoring.controller';
import { ErrorMonitoringService } from './error-monitoring.service';

@Global()
@Module({
  controllers: [ErrorMonitoringController],
  providers: [ErrorMonitoringService],
  exports: [ErrorMonitoringService],
})
export class ErrorMonitoringModule {}
