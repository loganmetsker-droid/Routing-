import { IsArray, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateRoutePlanDto {
  @IsDateString()
  serviceDate: string;

  @IsOptional()
  @IsUUID()
  depotId?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsArray()
  jobIds?: string[];

  @IsOptional()
  @IsArray()
  vehicleIds?: string[];
}
