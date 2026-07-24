import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingLead } from './entities/marketing-lead.entity';
import { MarketingLeadsController } from './marketing-leads.controller';
import { MarketingLeadRetryWorker } from './marketing-lead-retry.worker';
import { MarketingLeadsService } from './marketing-leads.service';

@Module({
  imports: [TypeOrmModule.forFeature([MarketingLead])],
  controllers: [MarketingLeadsController],
  providers: [MarketingLeadsService, MarketingLeadRetryWorker],
  exports: [MarketingLeadsService],
})
export class MarketingLeadsModule {}
