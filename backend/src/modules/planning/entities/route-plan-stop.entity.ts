import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('route_plan_stops')
@Index(['routePlanGroupId', 'stopSequence'], { unique: true })
export class RoutePlanStop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_plan_id', type: 'uuid' })
  routePlanId: string;

  @Column({ name: 'route_plan_group_id', type: 'uuid' })
  routePlanGroupId: string;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @Column({ name: 'job_stop_id', type: 'uuid' })
  jobStopId: string;

  @Column({ name: 'stop_sequence', type: 'int' })
  stopSequence: number;

  @Column({ name: 'is_locked', type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ name: 'planned_arrival', type: 'timestamptz', nullable: true })
  plannedArrival?: Date | null;

  @Column({ name: 'planned_departure', type: 'timestamptz', nullable: true })
  plannedDeparture?: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
