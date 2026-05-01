import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class TelemetryIngestDto {
  @IsUUID()
  vehicleId: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  speed?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(360)
  heading?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  odometer?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(0)
  @Max(100)
  fuelLevel?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  engineTemp?: number;

  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
