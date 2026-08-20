import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ClientErrorDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  componentStack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  path?: string;
}
