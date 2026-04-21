import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type RouteRunStopStatus = 'PENDING' | 'DISPATCHED' | 'ARRIVED' | 'SERVICED' | 'FAILED' | 'RESCHEDULED' | 'SKIPPED';

@Entity('route_run_stops')
@Index(['routeId', 'stopSequence'], { unique: true })
export class RouteRunStop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @Column({ name: 'job_stop_id', type: 'uuid' })
  jobStopId: string;

  @Column({ name: 'stop_sequence', type: 'int' })
  stopSequence: number;

  @Column({ type: 'varchar', length: 24, default: 'PENDING' })
  status: RouteRunStopStatus;

  @Column({ name: 'planned_arrival', type: 'timestamptz', nullable: true })
  plannedArrival?: Date | null;

  @Column({ name: 'actual_arrival', type: 'timestamptz', nullable: true })
  actualArrival?: Date | null;

  @Column({ name: 'actual_departure', type: 'timestamptz', nullable: true })
  actualDeparture?: Date | null;

  @Column({ name: 'proof_required', type: 'boolean', default: false })
  proofRequired: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
