import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreateJobDto } from './create-job.dto';

export class ImportJobsDto {
  @ApiPropertyOptional({
    description: 'Jobs to import (validated like CreateJobDto)',
    type: () => [CreateJobDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateJobDto)
  jobs?: CreateJobDto[];
}

