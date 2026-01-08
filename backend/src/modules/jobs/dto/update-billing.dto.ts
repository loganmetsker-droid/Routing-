import { IsEnum, IsOptional, IsNumber, IsString } from 'class-validator';
import { BillingStatus } from '../entities/job.entity';

export class UpdateBillingDto {
  @IsEnum(BillingStatus)
  billingStatus: BillingStatus;

  @IsOptional()
  @IsNumber()
  billingAmount?: number;

  @IsOptional()
  @IsString()
  billingNotes?: string;

  @IsOptional()
  @IsString()
  invoiceRef?: string;
}
