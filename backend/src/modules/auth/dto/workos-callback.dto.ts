import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class WorkosCallbackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  invitationToken?: string;

  @IsOptional()
  @IsString()
  state?: string;
}

