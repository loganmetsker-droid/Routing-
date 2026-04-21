import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type JobStopType = 'PICKUP' | 'DROPOFF' | 'SERVICE';

@Entity('job_stops')
@Index(['jobId', 'stopOrder'], { unique: true })
export class JobStop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'job_id', type: 'uuid' })
  jobId: string;

  @Column({ name: 'stop_order', type: 'int' })
  stopOrder: number;

  @Column({ name: 'stop_type', type: 'varchar', length: 24, default: 'DROPOFF' })
  stopType: JobStopType;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'jsonb', nullable: true })
  location?: { lat: number; lng: number } | null;

  @Column({ name: 'service_duration_minutes', type: 'int', default: 10 })
  serviceDurationMinutes: number;

  @Column({ name: 'time_window_start', type: 'timestamptz', nullable: true })
  timeWindowStart?: Date | null;

  @Column({ name: 'time_window_end', type: 'timestamptz', nullable: true })
  timeWindowEnd?: Date | null;

  @Column({ name: 'demand_weight_kg', type: 'decimal', precision: 10, scale: 2, nullable: true })
  demandWeightKg?: number | null;

  @Column({ name: 'demand_volume_m3', type: 'decimal', precision: 10, scale: 2, nullable: true })
  demandVolumeM3?: number | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
