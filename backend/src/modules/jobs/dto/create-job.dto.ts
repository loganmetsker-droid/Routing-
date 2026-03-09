import { InputType, Field, Float, Int } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  IsPositive,
  Length,
  Min,
  Max,
  ValidateIf,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobPriority, JobStatus } from '../entities/job.entity';

@InputType()
export class CreateJobDto {
  @ApiPropertyOptional({
    description: 'Linked customer UUID',
    example: '6f5f5b36-6f71-4ca9-b9e2-0fcfbf1dc4a5',
  })
  @IsOptional()
  @IsUUID()
  @Field({ nullable: true })
  customerId?: string;

  @ApiProperty({ description: 'Customer name', maxLength: 200 })
  @IsString()
  @Length(1, 200)
  @Field()
  customerName: string;

  @ApiPropertyOptional({ description: 'Customer phone number', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  @Field({ nullable: true })
  customerPhone?: string;

  @ApiPropertyOptional({ description: 'Customer email address', maxLength: 100 })
  @IsOptional()
  @IsEmail()
  @Length(1, 100)
  @Field({ nullable: true })
  customerEmail?: string;

  @ApiPropertyOptional({ description: 'Pickup address', maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  @Field({ nullable: true })
  pickupAddress?: string;

  @ApiPropertyOptional({
    description: 'Pickup location as GeoJSON point',
    example: { type: 'Point', coordinates: [-122.4194, 37.7749] },
  })
  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  pickupLocation?: any;

  @ApiProperty({ description: 'Delivery address', maxLength: 500 })
  @IsString()
  @Length(1, 500)
  @Field()
  deliveryAddress: string;

  @ApiPropertyOptional({
    description: 'Structured pickup address payload',
    example: { line1: '123 Main St', line2: null, city: 'Austin', state: 'TX', zip: '78701' },
  })
  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  pickupAddressStructured?: any;

  @ApiPropertyOptional({
    description: 'Structured delivery address payload',
    example: { line1: '500 Elm St', line2: null, city: 'Dallas', state: 'TX', zip: '75201' },
  })
  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  deliveryAddressStructured?: any;

  @ApiPropertyOptional({
    description: 'Delivery location as GeoJSON point',
    example: { type: 'Point', coordinates: [-122.4194, 37.7749] },
  })
  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  deliveryLocation?: any;

  @ApiPropertyOptional({
    description: 'Time window start (ISO 8601 format)',
    example: '2024-01-15T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  @Field({ nullable: true })
  timeWindowStart?: string;

  @ApiPropertyOptional({
    description: 'Time window end (ISO 8601 format)',
    example: '2024-01-15T17:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  @Field({ nullable: true })
  timeWindowEnd?: string;

  @ApiPropertyOptional({
    description: 'Legacy nested time window payload',
    example: { start: '2024-01-15T09:00:00Z', end: '2024-01-15T17:00:00Z' },
  })
  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  timeWindow?: { start?: string; end?: string };

  @ApiPropertyOptional({ description: 'Weight in kg', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Field(() => Float, { nullable: true })
  weight?: number;

  @ApiPropertyOptional({ description: 'Volume in cubic meters', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Field(() => Float, { nullable: true })
  volume?: number;

  @ApiPropertyOptional({ description: 'Number of packages/items', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Field(() => Int, { nullable: true })
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Job priority',
    enum: JobPriority,
    default: JobPriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(JobPriority)
  @Field({ nullable: true })
  priority?: JobPriority;

  @ApiPropertyOptional({
    description: 'Estimated duration in minutes',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Field(() => Float, { nullable: true })
  estimatedDuration?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  notes?: string;

  @ApiPropertyOptional({ description: 'Special handling instructions' })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  specialInstructions?: string;

  @ApiPropertyOptional({
    description: 'Legacy status field accepted from UI',
    enum: JobStatus,
  })
  @IsOptional()
  @IsEnum(JobStatus)
  @Field({ nullable: true })
  status?: JobStatus;
}
