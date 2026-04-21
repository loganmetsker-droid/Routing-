import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type RoutePlanStatus = 'DRAFT' | 'READY' | 'PUBLISHED' | 'ARCHIVED';

@Entity('route_plans')
export class RoutePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate: string;

  @Column({ name: 'depot_id', type: 'uuid', nullable: true })
  depotId?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'DRAFT' })
  status: RoutePlanStatus;

  @Column({ type: 'varchar', length: 32, default: 'distance' })
  objective: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metrics: Record<string, unknown>;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  warnings: Array<string | Record<string, unknown>>;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
