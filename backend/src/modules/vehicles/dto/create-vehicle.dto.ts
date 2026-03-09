import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field, Int, Float } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import {
  IsString,
  IsInt,
  IsOptional,
  IsNumber,
  Min,
  Max,
  Length,
  IsDateString,
} from 'class-validator';

export enum VehicleType {
  VAN = 'van',
  TRUCK = 'truck',
  MOTORCYCLE = 'motorcycle',
  CAR = 'car',
  SEMI_TRUCK = 'semi_truck',
}

export enum FuelType {
  DIESEL = 'diesel',
  GASOLINE = 'gasoline',
  ELECTRIC = 'electric',
  HYBRID = 'hybrid',
  CNG = 'cng',
  LPG = 'lpg',
}

@InputType()
export class CreateVehicleDto {
  @ApiProperty({ example: 'Ford', description: 'Vehicle make' })
  @Field()
  @IsString()
  @Length(1, 100)
  make: string;

  @ApiProperty({ example: 'Transit 350', description: 'Vehicle model' })
  @Field()
  @IsString()
  @Length(1, 100)
  model: string;

  @ApiProperty({ example: 2024, description: 'Manufacturing year' })
  @Field(() => Int)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year: number;

  @ApiProperty({ example: 'ABC-1234', description: 'License plate number' })
  @Field()
  @IsString()
  @Length(1, 20)
  licensePlate: string;

  @ApiProperty({
    example: '1FTBW3XM5PKA12345',
    description: 'Vehicle Identification Number',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(17, 17)
  vin?: string;

  @ApiProperty({
    enum: VehicleType,
    example: VehicleType.VAN,
    description: 'Type of vehicle',
  })
  @Field()
  @IsString()
  vehicleType: VehicleType;

  @ApiProperty({
    example: 1500.0,
    description: 'Weight capacity in kilograms',
    required: false,
  })
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityWeightKg?: number;

  @ApiProperty({
    example: 12.5,
    description: 'Volume capacity in cubic meters',
    required: false,
  })
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacityVolumeM3?: number;

  @ApiProperty({
    enum: FuelType,
    example: FuelType.DIESEL,
    description: 'Fuel type',
  })
  @Field()
  @IsString()
  fuelType: FuelType;

  @ApiProperty({
    example: 45230.5,
    description: 'Current odometer reading in kilometers',
    required: false,
  })
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentOdometerKm?: number;

  @ApiProperty({
    example: '2024-11-15',
    description: 'Date of last maintenance',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  lastMaintenanceDate?: string;

  @ApiProperty({
    example: 50000.0,
    description: 'Odometer reading for next maintenance',
    required: false,
  })
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  nextMaintenanceKm?: number;

  @ApiProperty({
    example: { color: 'white', features: ['gps', 'rear_camera'] },
    description: 'Additional metadata',
    required: false,
  })
  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({
    example: 1000,
    description: 'Legacy capacity alias (maps to capacityWeightKg)',
    required: false,
  })
  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number;

  @ApiProperty({
    example: 'AVAILABLE',
    description: 'Legacy status payload',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;
}
