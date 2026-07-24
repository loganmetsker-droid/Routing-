import { IsIn } from 'class-validator';
import type { MarketingLeadStatus } from '../entities/marketing-lead.entity';

export class UpdateMarketingLeadDto {
  @IsIn(['new', 'contacted', 'qualified', 'closed'])
  status: MarketingLeadStatus;
}
