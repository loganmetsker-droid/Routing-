import {
  IsBoolean,
  IsIn,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;

export class UpdateOrganizationSettingsDto {
  @IsOptional()
  @IsString()
  @Length(2, 160)
  brandName?: string;

  @IsOptional()
  @Matches(HEX_COLOR)
  primaryColor?: string;

  @IsOptional()
  @Matches(HEX_COLOR)
  accentColor?: string;

  @IsOptional()
  @IsEmail()
  @Length(5, 255)
  supportEmail?: string;

  @IsOptional()
  @IsString()
  @Length(7, 32)
  supportPhone?: string;

  @IsOptional()
  @IsString()
  @Length(4, 120)
  trackingHeadline?: string;

  @IsOptional()
  @IsString()
  @Length(4, 240)
  trackingSubtitle?: string;

  @IsOptional()
  @IsBoolean()
  notificationEmailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationSmsEnabled?: boolean;

  @IsOptional()
  @IsEmail()
  @Length(5, 255)
  notificationReplyToEmail?: string;

  @IsOptional()
  @IsIn(['email', 'sms', 'both'])
  defaultNotificationChannel?: 'email' | 'sms' | 'both';

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(3650)
  auditRetentionDays?: number;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(3650)
  operationalRetentionDays?: number;

  @IsOptional()
  @IsString()
  @Length(2, 128)
  workosOrganizationId?: string;

  @IsOptional()
  @IsString()
  @Length(2, 128)
  workosConnectionId?: string;

  @IsOptional()
  @IsIn(['unverified', 'pending', 'verified'])
  domainVerificationStatus?: 'unverified' | 'pending' | 'verified';

  @IsOptional()
  @IsBoolean()
  ssoEnforced?: boolean;

  @IsOptional()
  @IsBoolean()
  mfaEnforced?: boolean;
}
