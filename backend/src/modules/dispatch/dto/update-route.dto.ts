import { InputType, Field, PartialType } from '@nestjs/graphql';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateRouteDto } from './create-route.dto';
import { RouteStatus } from '../entities/route.entity';

@InputType()
export class UpdateRouteDto extends PartialType(CreateRouteDto) {
  @ApiPropertyOptional({
    description: 'Route status (supports canonical aliases like ready_for_dispatch, rerouting, degraded)',
    enum: [...Object.values(RouteStatus), 'ready_for_dispatch', 'dispatched', 'rerouting', 'degraded'],
  })
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  status?: RouteStatus | 'ready_for_dispatch' | 'dispatched' | 'rerouting' | 'degraded';
}
