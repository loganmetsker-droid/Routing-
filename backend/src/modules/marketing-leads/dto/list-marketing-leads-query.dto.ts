import { IsIn, IsOptional } from 'class-validator';
import type { MarketingLeadStatus } from '../entities/marketing-lead.entity';

export class ListMarketingLeadsQueryDto {
  @IsOptional()
  @IsIn(['new', 'contacted', 'qualified', 'closed'])
  status?: MarketingLeadStatus;
}
