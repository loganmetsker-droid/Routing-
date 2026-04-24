import { IsArray, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import type { OptimizationObjective } from '../../../../../shared/contracts';

export class GenerateRoutePlanDto {
  @IsDateString()
  serviceDate: string;

  @IsOptional()
  @IsUUID()
  depotId?: string;

  @IsOptional()
  @IsString()
  objective?: OptimizationObjective | string;

  @IsOptional()
  @IsArray()
  jobIds?: string[];

  @IsOptional()
  @IsArray()
  vehicleIds?: string[];
}
