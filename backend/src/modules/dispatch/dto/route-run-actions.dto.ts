import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';

function trimString({ value }: { value: unknown }) {
  return typeof value === 'string' ? value.trim() : value;
}

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

export class DispatchRouteRunDto {
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  @Transform(trimString)
  note?: string;
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

export class StopProofFileDto {
  @IsIn(['BOL', 'DOCUMENT'])
  type: 'BOL' | 'DOCUMENT';

  @IsOptional()
  @IsString()
  @Length(1, 4000)
  metadata?: string;
}

export class StopProofDecisionDto {
  @IsIn(['BOL', 'DOCUMENTS'])
  type: 'BOL' | 'DOCUMENTS';

  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'false') return false;
    if (value === 'true') return true;
    return value;
  })
  required: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  @Transform(trimString)
  reason?: string;
}

export class StopNoteDto {
  @IsString()
  @Length(1, 2000)
  note: string;
}

export class RouteRunMessageDto {
  @IsString()
  @Length(1, 2000)
  @Transform(trimString)
  @Matches(/\S/, { message: 'body must not be blank' })
  body: string;

  @IsOptional()
  @IsUUID()
  routeRunStopId?: string;
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
