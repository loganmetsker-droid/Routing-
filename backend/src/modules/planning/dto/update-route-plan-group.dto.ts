import { IsOptional, IsUUID } from 'class-validator';

export class UpdateRoutePlanGroupDto {
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;
}
