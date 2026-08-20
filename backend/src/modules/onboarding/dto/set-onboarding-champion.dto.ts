import { IsUUID } from 'class-validator';

export class SetOnboardingChampionDto {
  @IsUUID()
  userId: string;
}
