import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RouteRunMessageSenderRole = 'DRIVER' | 'DISPATCH';

@Entity('route_run_messages')
@Index(['organizationId', 'routeId', 'createdAt'])
export class RouteRunMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'route_id', type: 'uuid' })
  routeId: string;

  @Column({ name: 'route_run_stop_id', type: 'uuid', nullable: true })
  routeRunStopId?: string | null;

  @Column({ name: 'sender_user_id', type: 'uuid', nullable: true })
  senderUserId?: string | null;

  @Column({ name: 'sender_role', type: 'varchar', length: 24 })
  senderRole: RouteRunMessageSenderRole;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'read_by_driver_at', type: 'timestamptz', nullable: true })
  readByDriverAt?: Date | null;

  @Column({ name: 'read_by_dispatch_at', type: 'timestamptz', nullable: true })
  readByDispatchAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
