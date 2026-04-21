import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('route_assignments')
export class RouteAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @Column({ name: 'route_plan_group_id', type: 'uuid', nullable: true })
  routePlanGroupId?: string | null;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId?: string | null;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId?: string | null;

  @Column({ name: 'assigned_by_user_id', type: 'uuid', nullable: true })
  assignedByUserId?: string | null;

  @Column({ name: 'unassigned_at', type: 'timestamptz', nullable: true })
  unassignedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @CreateDateColumn({ name: 'assigned_at' })
  assignedAt: Date;
}
