import { IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateDepotDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @Length(2, 160)
  name: string;

  @IsString()
  address: string;

  @IsOptional()
  location?: { lat: number; lng: number };

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
