import { IsBoolean, IsOptional, IsUUID, Min } from 'class-validator';

export class UpdateRoutePlanStopDto {
  @IsOptional()
  @IsUUID()
  targetGroupId?: string;

  @IsOptional()
  @Min(1)
  targetSequence?: number;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;
}
