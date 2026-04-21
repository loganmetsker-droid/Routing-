import { Global, Module } from '@nestjs/common';
import { RuntimeStatusService } from './runtime-status.service';

@Global()
@Module({
  providers: [RuntimeStatusService],
  exports: [RuntimeStatusService],
})
export class RuntimeStatusModule {}
