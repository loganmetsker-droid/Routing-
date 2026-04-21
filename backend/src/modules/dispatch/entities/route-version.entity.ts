import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Route } from './route.entity';

export type RouteVersionStatus =
  | 'DRAFT'
  | 'REVIEWED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'SUPERSEDED';

@Entity('route_versions')
export class RouteVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @ManyToOne(() => Route, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'route_id' })
  route: Route;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber: number;

  @Column({ type: 'varchar', length: 32, default: 'DRAFT' })
  status: RouteVersionStatus;

  @Column({ type: 'jsonb' })
  snapshot: Record<string, unknown>;

  @Column({ name: 'created_by_user_id', type: 'varchar', length: 128, nullable: true })
  createdByUserId?: string | null;

  @Column({ name: 'reviewed_by_user_id', type: 'varchar', length: 128, nullable: true })
  reviewedByUserId?: string | null;

  @Column({ name: 'approved_by_user_id', type: 'varchar', length: 128, nullable: true })
  approvedByUserId?: string | null;

  @Column({ name: 'published_by_user_id', type: 'varchar', length: 128, nullable: true })
  publishedByUserId?: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp with time zone', nullable: true })
  reviewedAt?: Date | null;

  @Column({ name: 'approved_at', type: 'timestamp with time zone', nullable: true })
  approvedAt?: Date | null;

  @Column({ name: 'published_at', type: 'timestamp with time zone', nullable: true })
  publishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
