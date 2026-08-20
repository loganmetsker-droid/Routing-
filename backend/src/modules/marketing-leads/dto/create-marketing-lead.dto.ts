import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { marketingRequestTypes } from '../../../../../shared/contracts';

const fleetSizes = ['5–15', '16–35', '36–75', '76–150', '151–300', '300+ / Custom'];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateMarketingLeadDto {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  workEmail: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  company: string;

  @IsIn(fleetSizes)
  fleetSize: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  exactFleetSize?: number;

  @IsIn(marketingRequestTypes)
  requestType: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(240)
  pagePath?: string;

  // Hidden honeypot. Legitimate clients leave this blank.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
