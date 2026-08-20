import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingLead } from './entities/marketing-lead.entity';
import { PostmarkBounceEvent } from './entities/postmark-bounce-event.entity';
import { MarketingLeadsController } from './marketing-leads.controller';
import { MarketingLeadsService } from './marketing-leads.service';
import { PostmarkEventsService } from './postmark-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([MarketingLead, PostmarkBounceEvent])],
  controllers: [MarketingLeadsController],
  providers: [MarketingLeadsService, PostmarkEventsService],
  exports: [MarketingLeadsService],
})
export class MarketingLeadsModule {}
