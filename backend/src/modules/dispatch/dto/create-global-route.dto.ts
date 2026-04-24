import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayNotEmpty, IsOptional, IsString } from 'class-validator';
import type { OptimizationObjective } from '../../../../../shared/contracts';

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

    @ApiPropertyOptional({
        description: 'Optimization objective: speed, distance, or balanced',
        enum: ['speed', 'distance', 'balanced'],
    })
    @IsOptional()
    @IsString()
    objective?: OptimizationObjective | string;
}
