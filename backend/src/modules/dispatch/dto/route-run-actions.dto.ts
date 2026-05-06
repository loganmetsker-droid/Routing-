import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class ReassignRouteRunDto {
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

export class StopReasonDto {
  @IsString()
  @Length(1, 500)
  reason: string;
}

export class StopProofDto {
  @IsString()
  @Length(1, 80)
  type: string;

  @IsString()
  @Length(1, 2048)
  uri: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class StopNoteDto {
  @IsString()
  @Length(1, 2000)
  note: string;
}

export class CreateDispatchExceptionDto {
  @IsOptional()
  @IsUUID()
  routeId?: string;

  @IsOptional()
  @IsUUID()
  routeRunStopId?: string;

  @IsString()
  @Length(1, 120)
  code: string;

  @IsString()
  @Length(1, 1000)
  message: string;

  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}

export class UpdateDispatchExceptionDto {
  @IsOptional()
  @IsIn(['ACKNOWLEDGED', 'RESOLVED'])
  status?: 'ACKNOWLEDGED' | 'RESOLVED';
}
