import { PartialType } from '@nestjs/graphql';
import { CreateVehicleDto } from './create-vehicle.dto';
import { ApiProperty } from '@nestjs/swagger';
import { InputType, Field } from '@nestjs/graphql';
import { IsEnum, IsOptional } from 'class-validator';

export enum VehicleStatus {
  AVAILABLE = 'available',
  IN_USE = 'in_use',
  MAINTENANCE = 'maintenance',
  OUT_OF_SERVICE = 'out_of_service',
  RETIRED = 'retired',
}

@InputType()
export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @ApiProperty({
    enum: VehicleStatus,
    example: VehicleStatus.AVAILABLE,
    description: 'Vehicle status',
    required: false,
  })
  @Field({ nullable: true })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}
