import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class AssignDriverDto {
  @IsUUID()
  driverId: string;
}

export class ReorderStopsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  newJobOrder: string[];
}

export class MoveStopDto {
  @IsUUID()
  jobId: string;

  @IsUUID()
  targetRouteId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  targetSequence?: number;
}
