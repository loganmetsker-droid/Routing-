import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class PostmarkBounceDto {
  @IsString()
  @MaxLength(40)
  RecordType: string;

  @IsInt()
  ID: number;

  @IsString()
  @MaxLength(80)
  Type: string;

  @IsOptional()
  @IsInt()
  TypeCode?: number;

  @IsString()
  @MaxLength(120)
  Name: string;

  @IsString()
  @MaxLength(80)
  MessageID: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  MessageStream?: string;

  @IsEmail()
  @MaxLength(254)
  Email: string;

  @IsOptional()
  @IsISO8601()
  BouncedAt?: string;

  @IsBoolean()
  Inactive: boolean;

  @IsOptional()
  @IsObject()
  Metadata?: Record<string, unknown>;
}
