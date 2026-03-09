import { InputType, Field, PartialType } from '@nestjs/graphql';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, IsBoolean, IsString, IsNumber } from 'class-validator';
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

  @ApiPropertyOptional({
    description: 'Route assignment',
    example: '6f5f5b36-6f71-4ca9-b9e2-0fcfbf1dc4a5',
  })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  assignedRouteId?: string;

  @ApiPropertyOptional({
    description: 'Legacy archive flag from older frontend screens',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Field({ nullable: true })
  archived?: boolean;

  @ApiPropertyOptional({
    description: 'Archive timestamp',
    example: '2024-01-15T17:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  @Field({ nullable: true })
  archivedAt?: string;

  @ApiPropertyOptional({ description: 'Legacy assigned vehicle id' })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  assignedVehicleId?: string;

  @ApiPropertyOptional({ description: 'Legacy stop sequence' })
  @IsOptional()
  @IsNumber()
  @Field({ nullable: true })
  stopSequence?: number;

  @ApiPropertyOptional({ description: 'Legacy driver assignment field' })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  driverId?: string;
}
