import { PartialType } from '@nestjs/swagger';
import { InputType, Field } from '@nestjs/graphql';
import { CreateDriverDto } from './create-driver.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max, IsString } from 'class-validator';

@InputType()
export class UpdateDriverDto extends PartialType(CreateDriverDto) {
  @ApiProperty({
    example: 'available',
    description: 'Driver status',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

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
