import { PartialType } from '@nestjs/swagger';
import { InputType, Field } from '@nestjs/graphql';
import { CreateDriverDto } from './create-driver.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';

export enum DriverStatus {
  AVAILABLE = 'available',
  ON_ROUTE = 'on_route',
  ON_BREAK = 'on_break',
  OFF_DUTY = 'off_duty',
  UNAVAILABLE = 'unavailable',
}

@InputType()
export class UpdateDriverDto extends PartialType(CreateDriverDto) {
  @ApiProperty({
    enum: DriverStatus,
    example: DriverStatus.AVAILABLE,
    description: 'Driver status',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @ApiProperty({
    example: 2450.5,
    description: 'Total hours driven',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalHoursDriven?: number;

  @ApiProperty({
    example: 125430.75,
    description: 'Total distance driven in kilometers',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDistanceKm?: number;

  @ApiProperty({
    example: 1823,
    description: 'Total number of deliveries',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDeliveries?: number;

  @ApiProperty({
    example: 4.85,
    description: 'Average rating (0-5)',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  averageRating?: number;
}
