import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import {
  RerouteAction,
  RerouteExceptionCategory,
} from '../entities/reroute-request.entity';

export const EXCEPTION_CATEGORIES: RerouteExceptionCategory[] = [
  'urgent_insert',
  'vehicle_unavailable',
  'driver_unavailable',
  'missed_time_window',
  'traffic_delay',
  'customer_not_ready',
  'no_show',
  'capacity_issue',
];

export const REROUTE_ACTIONS: RerouteAction[] = [
  'reorder_stops',
  'reassign_stop_to_route',
  'split_route',
  'hold_stop',
  'remove_stop',
  'reassign_driver',
];

export class RequestRerouteDto {
  @ApiProperty({ enum: EXCEPTION_CATEGORIES })
  @IsIn(EXCEPTION_CATEGORIES)
  exceptionCategory: RerouteExceptionCategory;

  @ApiProperty({ enum: REROUTE_ACTIONS })
  @IsIn(REROUTE_ACTIONS)
  action: RerouteAction;

  @ApiProperty({ description: 'Operator rationale for reroute request' })
  @IsString()
  @MinLength(3)
  reason: string;

  @ApiPropertyOptional({ description: 'Operator/request context identifier' })
  @IsOptional()
  @IsString()
  requesterId?: string;

  @ApiPropertyOptional({
    description: 'Optional reroute payload (job/stop IDs, hold windows, target routes)',
  })
  @IsOptional()
  requestPayload?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Per-job infeasibility or planner diagnostics keyed by job id',
  })
  @IsOptional()
  plannerDiagnostics?: Record<string, any>;
}

export class ReviewRerouteDto {
  @ApiPropertyOptional({ description: 'Reviewer identifier' })
  @IsOptional()
  @IsString()
  reviewerId?: string;

  @ApiPropertyOptional({ description: 'Approval/rejection note' })
  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class ApplyRerouteDto {
  @ApiPropertyOptional({ description: 'Applied by identifier' })
  @IsOptional()
  @IsString()
  appliedBy?: string;

  @ApiPropertyOptional({
    description: 'Applied plan delta or resulting route patch',
  })
  @IsOptional()
  appliedPayload?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Explicit operator override flag for infeasible reroute applies',
  })
  @IsOptional()
  overrideRequested?: boolean;

  @ApiPropertyOptional({
    description: 'Human-readable reason required when overrideRequested is true',
  })
  @IsOptional()
  @IsString()
  overrideReason?: string;

  @ApiPropertyOptional({
    description: 'Operator identifier for audited override action',
  })
  @IsOptional()
  @IsString()
  overrideActor?: string;

  @ApiPropertyOptional({
    description: 'Operator role used for override policy enforcement',
  })
  @IsOptional()
  @IsString()
  overrideActorRole?: string;
}

export class RerouteRequestParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  requestId: string;
}

export class ReroutePreviewDto {
  @ApiProperty({ enum: REROUTE_ACTIONS })
  @IsIn(REROUTE_ACTIONS)
  action: RerouteAction;

  @ApiPropertyOptional({ description: 'Action payload for preview' })
  @IsOptional()
  payload?: Record<string, any>;
}
