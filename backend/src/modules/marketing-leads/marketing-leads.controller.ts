import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import { ListMarketingLeadsQueryDto } from './dto/list-marketing-leads-query.dto';
import { UpdateMarketingLeadDto } from './dto/update-marketing-lead.dto';
import { MarketingLeadsService } from './marketing-leads.service';

@Controller('marketing-leads')
export class MarketingLeadsController {
  constructor(private readonly marketingLeads: MarketingLeadsService) {}

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
}
