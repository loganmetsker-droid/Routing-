import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type DispatchExceptionStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

@Entity('exceptions')
export class DispatchException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'route_id', type: 'uuid', nullable: true })
  routeId?: string | null;

  @Column({ name: 'route_run_stop_id', type: 'uuid', nullable: true })
  routeRunStopId?: string | null;

  @Column({ type: 'varchar', length: 48 })
  code: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 24, default: 'OPEN' })
  status: DispatchExceptionStatus;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details: Record<string, unknown>;

  @Column({ name: 'acknowledged_by_user_id', type: 'uuid', nullable: true })
  acknowledgedByUserId?: string | null;

  @Column({ name: 'resolved_by_user_id', type: 'uuid', nullable: true })
  resolvedByUserId?: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
