import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('route_plan_groups')
export class RoutePlanGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'route_plan_id', type: 'uuid' })
  routePlanId: string;

  @Column({ name: 'group_index', type: 'int' })
  groupIndex: number;

  @Column({ length: 160 })
  label: string;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId?: string | null;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId?: string | null;

  @Column({ name: 'total_distance_km', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalDistanceKm: number;

  @Column({ name: 'total_duration_minutes', type: 'int', default: 0 })
  totalDurationMinutes: number;

  @Column({ name: 'service_time_minutes', type: 'int', default: 0 })
  serviceTimeMinutes: number;

  @Column({ name: 'total_weight_kg', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalWeightKg: number;

  @Column({ name: 'total_volume_m3', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalVolumeM3: number;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  warnings: Array<string | Record<string, unknown>>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
