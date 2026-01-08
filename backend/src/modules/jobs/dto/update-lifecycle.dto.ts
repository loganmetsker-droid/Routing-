import { InputType, Field } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { JobStatus } from '../entities/job.entity';

@InputType()
export class UpdateLifecycleDto {
  @Field(() => JobStatus)
  @IsEnum(JobStatus)
  status: JobStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
