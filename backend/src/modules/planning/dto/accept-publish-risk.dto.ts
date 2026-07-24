import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class AcceptPublishRiskDto {
  @ApiProperty({ example: 'JOB_CAPACITY_RISK' })
  @IsString()
  @Length(2, 80)
  blockerCode: string;

  @ApiProperty({
    example: 'Operations confirmed this runs on a dedicated trailer.',
  })
  @IsString()
  @Length(8, 500)
  reason: string;

  @ApiPropertyOptional({ example: 'job-1' })
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiPropertyOptional({ example: 'group-1' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  warningIndex?: number;
}
