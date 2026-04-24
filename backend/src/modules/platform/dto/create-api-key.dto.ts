import { IsArray, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @Length(3, 160)
  name: string;

  @IsOptional()
  @IsArray()
  @Matches(/^[a-z0-9:*_.-]+$/i, { each: true })
  scopes?: string[];
}
