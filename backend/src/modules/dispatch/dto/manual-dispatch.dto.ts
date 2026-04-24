import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { OptimizationObjective } from '../../../../../shared/contracts';

export class ManualDispatchDto {
  @ApiPropertyOptional({
    description: 'Optimization objective: speed, distance, or balanced',
    enum: ['speed', 'distance', 'balanced'],
  })
  @IsOptional()
  @IsString()
  objective?: OptimizationObjective | string;
}
