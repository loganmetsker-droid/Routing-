import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WebhookDeliveryStatus =
  | 'PENDING'
  | 'DELIVERED'
  | 'FAILED'
  | 'SKIPPED';

@Entity('webhook_deliveries')
@Index(['organizationId', 'createdAt'])
@Index(['endpointId', 'createdAt'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'endpoint_id', type: 'uuid' })
  endpointId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'event_type', length: 80 })
  eventType: string;

  @Column({ length: 16, default: 'PENDING' })
  status: WebhookDeliveryStatus;

  @Column({ name: 'request_id', length: 128, nullable: true })
  requestId?: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus?: number | null;

  @Column({ name: 'response_body', type: 'text', nullable: true })
  responseBody?: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
