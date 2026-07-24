import { IsBoolean } from 'class-validator';

export class UpdateRouteOrderProtectionDto {
  @IsBoolean()
  isLocked!: boolean;
}
