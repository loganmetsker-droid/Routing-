import { InputType, Field, PartialType } from '@nestjs/graphql';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateRouteDto } from './create-route.dto';
import { RouteStatus } from '../entities/route.entity';

@InputType()
export class UpdateRouteDto extends PartialType(CreateRouteDto) {
  @ApiPropertyOptional({ description: 'Route status', enum: RouteStatus })
  @IsOptional()
  @IsEnum(RouteStatus)
  @Field({ nullable: true })
  status?: RouteStatus;
}
