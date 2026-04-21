import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type DispatchEventSource = 'optimizer' | 'reroute' | 'workflow' | 'system';
export type DispatchEventLevel = 'info' | 'warning' | 'error';
export type DispatchAggregateType = 'ROUTE' | 'JOB' | 'VEHICLE' | 'ROUTE_VERSION';

@Entity('dispatch_events')
@Index(['routeId', 'createdAt'])
@Index(['source', 'createdAt'])
@Index(['reasonCode', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['actor', 'createdAt'])
@Index(['packId', 'createdAt'])
export class DispatchEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_id', type: 'uuid', nullable: true })
  routeId?: string | null;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 32, default: 'ROUTE' })
  aggregateType: DispatchAggregateType;

  @Column({ name: 'aggregate_id', type: 'uuid', nullable: true })
  aggregateId?: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 120, default: 'UNKNOWN' })
  eventType: string;

  @Column({ name: 'actor_user_id', type: 'varchar', length: 128, nullable: true })
  actorUserId?: string | null;

  @Column({ type: 'varchar', length: 32 })
  source: DispatchEventSource;

  @Column({ type: 'varchar', length: 32, default: 'info' })
  level: DispatchEventLevel;

  @Column({ type: 'varchar', length: 120 })
  code: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, any> | null;

  @Column({ name: 'reason_code', type: 'varchar', length: 120, nullable: true })
  reasonCode?: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  action?: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  actor?: string | null;

  @Column({ name: 'pack_id', type: 'varchar', length: 64, nullable: true })
  packId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
