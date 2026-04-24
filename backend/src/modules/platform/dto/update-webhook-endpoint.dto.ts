import { IsArray, IsIn, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class UpdateWebhookEndpointDto {
  @IsOptional()
  @IsString()
  @Length(3, 160)
  name?: string;

  @IsOptional()
  @IsUrl({
    require_tld: true,
    require_protocol: true,
    protocols: ['https'],
  })
  url?: string;

  @IsOptional()
  @IsArray()
  @Matches(/^[a-z0-9._*-]+$/i, { each: true })
  subscribedEvents?: string[];

  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED'])
  status?: 'ACTIVE' | 'PAUSED';
}
