import { IsArray, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class CreateWebhookEndpointDto {
  @IsString()
  @Length(3, 160)
  name: string;

  @IsUrl({
    require_tld: true,
    require_protocol: true,
    protocols: ['https'],
  })
  url: string;

  @IsOptional()
  @IsArray()
  @Matches(/^[a-z0-9._*-]+$/i, { each: true })
  subscribedEvents?: string[];

  @IsOptional()
  @IsString()
  @Length(16, 128)
  signingSecret?: string;
}
