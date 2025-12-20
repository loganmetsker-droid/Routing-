import { InputType, Field, PartialType } from '@nestjs/graphql';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { CreateJobDto } from './create-job.dto';
import { JobStatus } from '../entities/job.entity';

@InputType()
export class UpdateJobDto extends PartialType(CreateJobDto) {
  @ApiPropertyOptional({
    description: 'Job status',
    enum: JobStatus,
  })
  @IsOptional()
  @IsEnum(JobStatus)
  @Field({ nullable: true })
  status?: JobStatus;

  @ApiPropertyOptional({
    description: 'Job completion timestamp (ISO 8601 format)',
    example: '2024-01-15T17:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  @Field({ nullable: true })
  completedAt?: string;
}
