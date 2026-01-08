import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { JobStatus } from '../entities/job.entity';

export class UpdateLifecycleDto {
  @IsEnum(JobStatus)
  status: JobStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
