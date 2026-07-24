import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateMarketingLeadDto } from './dto/create-marketing-lead.dto';
import { ListMarketingLeadsQueryDto } from './dto/list-marketing-leads-query.dto';
import { UpdateMarketingLeadDto } from './dto/update-marketing-lead.dto';
import { MarketingLeadsService } from './marketing-leads.service';

type AuthenticatedRequest = {
  user: {
    email: string;
  };
};

@Controller('marketing-leads')
export class MarketingLeadsController {
  constructor(private readonly marketingLeads: MarketingLeadsService) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async create(@Body() dto: CreateMarketingLeadDto) {
    await this.marketingLeads.create(dto);
    return { accepted: true };
  }

  @Get('access')
  access(@Req() req: AuthenticatedRequest) {
    return {
      operatorAccess: this.marketingLeads.hasOperatorAccess(req.user.email),
    };
  }

  @Get()
  @Roles('OWNER', 'ADMIN')
  async list(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListMarketingLeadsQueryDto,
  ) {
    this.marketingLeads.assertOperatorAccess(req.user.email);
    return { leads: await this.marketingLeads.list(query.status) };
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateMarketingLeadDto,
  ) {
    this.marketingLeads.assertOperatorAccess(req.user.email);
    return { lead: await this.marketingLeads.updateStatus(id, dto.status) };
  }

  @Post(':id/retry-notification')
  @Roles('OWNER', 'ADMIN')
  async retryNotification(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    this.marketingLeads.assertOperatorAccess(req.user.email);
    return {
      lead: await this.marketingLeads.retryOperatorNotification(id),
    };
  }
}
