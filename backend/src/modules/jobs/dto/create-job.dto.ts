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
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobPriority } from '../entities/job.entity';

@InputType()
export class CreateJobDto {
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

  @ApiProperty({ description: 'Pickup address', maxLength: 500 })
  @IsString()
  @Length(1, 500)
  @Field()
  pickupAddress: string;

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
    description: 'Delivery location as GeoJSON point',
    example: { type: 'Point', coordinates: [-122.4194, 37.7749] },
  })
  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true })
  deliveryLocation?: any;

  @ApiProperty({
    description: 'Time window start (ISO 8601 format)',
    example: '2024-01-15T09:00:00Z',
  })
  @IsDateString()
  @Field()
  timeWindowStart: string;

  @ApiProperty({
    description: 'Time window end (ISO 8601 format)',
    example: '2024-01-15T17:00:00Z',
  })
  @IsDateString()
  @Field()
  timeWindowEnd: string;

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
}
