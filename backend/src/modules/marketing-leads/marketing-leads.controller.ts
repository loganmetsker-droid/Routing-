import { Body, Controller, Get, Headers, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import { ListMarketingLeadsQueryDto } from './dto/list-marketing-leads-query.dto';
import { UpdateMarketingLeadDto } from './dto/update-marketing-lead.dto';
import { MarketingLeadsService } from './marketing-leads.service';
import { PostmarkBounceDto } from './dto/postmark-bounce.dto';
import { PostmarkEventsService } from './postmark-events.service';

@Controller('marketing-leads')
export class MarketingLeadsController {
  constructor(
    private readonly marketingLeads: MarketingLeadsService,
    private readonly postmarkEvents: PostmarkEventsService,
  ) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(@Body() dto: CreateMarketingLeadDto) {
    return this.marketingLeads.create(dto);
  }

  @Get()
  @Roles('OWNER', 'ADMIN')
  async list(@Query() query: ListMarketingLeadsQueryDto) {
    return { leads: await this.marketingLeads.list(query.status) };
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateMarketingLeadDto) {
    return { lead: await this.marketingLeads.updateStatus(id, dto.status) };
  }

  @Public()
  @Post('postmark/bounces')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async postmarkBounce(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: PostmarkBounceDto,
  ) {
    this.postmarkEvents.assertAuthorized(authorization);
    const result = await this.postmarkEvents.recordBounce(dto);
    return {
      accepted: true,
      duplicate: result.duplicate,
      eventId: result.event.id,
      messageId: result.event.messageId,
    };
  }

  @Get('postmark/bounces')
  @Roles('OWNER', 'ADMIN')
  async postmarkBounces(@Query('messageId') messageId?: string) {
    return {
      bounces: await this.postmarkEvents.listBounces(messageId?.trim() || undefined),
    };
  }
}
