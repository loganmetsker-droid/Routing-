import { InputType, Field } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsNumber, IsString } from 'class-validator';
import { BillingStatus } from '../entities/job.entity';

@InputType()
export class UpdateBillingDto {
  @Field(() => BillingStatus)
  @IsEnum(BillingStatus)
  billingStatus: BillingStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  billingAmount?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  billingNotes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  invoiceRef?: string;
}
