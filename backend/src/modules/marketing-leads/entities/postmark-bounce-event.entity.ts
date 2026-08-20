import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('postmark_bounce_events')
@Index(['messageId', 'createdAt'])
export class PostmarkBounceEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_bounce_id', type: 'varchar', length: 40, unique: true })
  providerBounceId: string;

  @Column({ name: 'message_id', type: 'varchar', length: 80 })
  messageId: string;

  @Column({ name: 'record_type', type: 'varchar', length: 40 })
  recordType: string;

  @Column({ name: 'bounce_type', type: 'varchar', length: 80 })
  bounceType: string;

  @Column({ name: 'bounce_name', type: 'varchar', length: 120 })
  bounceName: string;

  @Column({ name: 'type_code', type: 'integer', nullable: true })
  typeCode?: number | null;

  @Column({ name: 'message_stream', type: 'varchar', length: 80, nullable: true })
  messageStream?: string | null;

  @Column({ name: 'recipient_hash', type: 'char', length: 64 })
  recipientHash: string;

  @Column({ name: 'inactive', type: 'boolean', default: false })
  inactive: boolean;

  @Column({ name: 'provider_bounced_at', type: 'timestamptz', nullable: true })
  providerBouncedAt?: Date | null;

  @Column({ name: 'lead_id', type: 'uuid', nullable: true })
  leadId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
