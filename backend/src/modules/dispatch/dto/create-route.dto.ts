import { InputType, Field } from '@nestjs/graphql';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsArray, IsOptional, IsDateString, IsString } from 'class-validator';
import type { OptimizationObjective } from '../../../../../shared/contracts';

@InputType()
export class CreateRouteDto {
  @ApiProperty({ description: 'Vehicle UUID' })
  @IsUUID()
  @Field()
  vehicleId: string;

  @ApiPropertyOptional({ description: 'Driver UUID' })
  @IsOptional()
  @IsUUID()
  @Field({ nullable: true })
  driverId?: string;

  @ApiProperty({ description: 'Array of job UUIDs', type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @Field(() => [String])
  jobIds: string[];

  @ApiPropertyOptional({ description: 'Planned start time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  @Field({ nullable: true })
  plannedStart?: string;

  @ApiPropertyOptional({
    description: 'Optimization objective: speed, distance, or balanced',
    enum: ['speed', 'distance', 'balanced'],
  })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  objective?: OptimizationObjective | string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  notes?: string;
}
