import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class InsertRoutePlanJobDto {
  @IsUUID()
  jobId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  targetSequence?: number;
}
