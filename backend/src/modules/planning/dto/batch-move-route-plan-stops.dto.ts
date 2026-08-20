import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class BatchMoveRoutePlanStopsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  stopIds: string[];

  @IsUUID()
  targetGroupId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  targetSequence?: number;
}
