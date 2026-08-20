import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateOnboardingProgressDto {
  @IsIn(['IN_PROGRESS', 'COMPLETED'])
  status: 'IN_PROGRESS' | 'COMPLETED';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsBoolean()
  signoffAcknowledged?: boolean;
}
