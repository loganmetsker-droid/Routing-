import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type NotificationChannel = 'EMAIL' | 'SMS';
export type NotificationDeliveryStatus =
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'SKIPPED';

@Entity('notification_deliveries')
@Index(['organizationId', 'createdAt'])
@Index(['routeId', 'createdAt'])
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'route_id', type: 'uuid', nullable: true })
  routeId?: string | null;

  @Column({ name: 'route_run_stop_id', type: 'uuid', nullable: true })
  routeRunStopId?: string | null;

  @Column({ name: 'job_id', type: 'uuid', nullable: true })
  jobId?: string | null;

  @Column({ name: 'customer_id', type: 'uuid', nullable: true })
  customerId?: string | null;

  @Column({ name: 'event_type', length: 64 })
  eventType: string;

  @Column({ length: 16 })
  channel: NotificationChannel;

  @Column({ length: 255 })
  recipient: string;

  @Column({ length: 32, default: 'disabled' })
  provider: string;

  @Column({ length: 16, default: 'PENDING' })
  status: NotificationDeliveryStatus;

  @Column({ length: 255, nullable: true })
  subject?: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'tracking_url', type: 'text', nullable: true })
  trackingUrl?: string | null;

  @Column({ name: 'provider_message_id', length: 255, nullable: true })
  providerMessageId?: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata: Record<string, unknown>;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
