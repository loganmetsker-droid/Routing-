import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayNotEmpty } from 'class-validator';

export class CreateGlobalRouteDto {
    @ApiProperty({ description: 'List of vehicle UUIDs to include in the routing pool' })
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    vehicleIds: string[];

    @ApiProperty({ description: 'List of unassigned job UUIDs to route' })
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID('4', { each: true })
    jobIds: string[];
}
