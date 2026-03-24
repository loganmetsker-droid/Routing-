import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type RerouteExceptionCategory =
  | 'urgent_insert'
  | 'vehicle_unavailable'
  | 'driver_unavailable'
  | 'missed_time_window'
  | 'traffic_delay'
  | 'customer_not_ready'
  | 'no_show'
  | 'capacity_issue';

export type RerouteAction =
  | 'reorder_stops'
  | 'reassign_stop_to_route'
  | 'split_route'
  | 'hold_stop'
  | 'remove_stop'
  | 'reassign_driver';

export type RerouteRequestStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'cancelled';

@Entity('reroute_requests')
@Index(['routeId', 'status'])
@Index(['createdAt'])
export class RerouteRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @Column({
    type: 'varchar',
    length: 64,
    comment: 'Exception category triggering reroute',
  })
  exceptionCategory: RerouteExceptionCategory;

  @Column({
    type: 'varchar',
    length: 64,
    comment: 'Requested reroute action',
  })
  action: RerouteAction;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'requested',
  })
  status: RerouteRequestStatus;

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'request_payload', type: 'jsonb', nullable: true })
  requestPayload?: Record<string, any> | null;

  @Column({ name: 'before_snapshot', type: 'jsonb', nullable: true })
  beforeSnapshot?: Record<string, any> | null;

  @Column({ name: 'after_snapshot', type: 'jsonb', nullable: true })
  afterSnapshot?: Record<string, any> | null;

  @Column({ name: 'impact_summary', type: 'jsonb', nullable: true })
  impactSummary?: Record<string, any> | null;

  @Column({ name: 'planner_diagnostics', type: 'jsonb', nullable: true })
  plannerDiagnostics?: Record<string, any> | null;

  @Column({ name: 'requester_id', type: 'varchar', length: 128, nullable: true })
  requesterId?: string | null;

  @Column({ name: 'reviewer_id', type: 'varchar', length: 128, nullable: true })
  reviewerId?: string | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote?: string | null;

  @Column({ name: 'applied_by', type: 'varchar', length: 128, nullable: true })
  appliedBy?: string | null;

  @Column({ name: 'requested_at', type: 'timestamp with time zone', nullable: true })
  requestedAt?: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamp with time zone', nullable: true })
  reviewedAt?: Date | null;

  @Column({ name: 'applied_at', type: 'timestamp with time zone', nullable: true })
  appliedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
