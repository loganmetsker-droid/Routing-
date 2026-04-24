import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type WebhookEndpointStatus = 'ACTIVE' | 'PAUSED';

@Entity('webhook_endpoints')
@Index(['organizationId', 'status'])
export class WebhookEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ length: 160 })
  name: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ name: 'signing_secret', length: 128 })
  signingSecret: string;

  @Column({ name: 'subscribed_events', type: 'jsonb', default: () => "'[]'::jsonb" })
  subscribedEvents: string[];

  @Column({ length: 16, default: 'ACTIVE' })
  status: WebhookEndpointStatus;

  @Column({ name: 'last_delivery_at', type: 'timestamptz', nullable: true })
  lastDeliveryAt?: Date | null;

  @Column({ name: 'last_failure', type: 'text', nullable: true })
  lastFailure?: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
