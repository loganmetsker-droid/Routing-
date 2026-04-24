import { IsEmail, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateOrganizationInvitationDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsIn(['OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER', 'DRIVER'])
  role?: 'OWNER' | 'ADMIN' | 'DISPATCHER' | 'VIEWER' | 'DRIVER';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}
