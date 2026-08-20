import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type MarketingLeadStatus = 'new' | 'contacted' | 'qualified' | 'closed';
export type LeadNotificationStatus = 'pending' | 'sent' | 'failed' | 'skipped';

@Entity('marketing_leads')
@Index(['workEmail', 'createdAt'])
@Index(['status', 'createdAt'])
export class MarketingLead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ name: 'work_email', type: 'varchar', length: 254 })
  workEmail: string;

  @Column({ type: 'varchar', length: 160 })
  company: string;

  @Column({ name: 'fleet_size', type: 'varchar', length: 40 })
  fleetSize: string;

  @Column({ name: 'exact_fleet_size', type: 'integer', nullable: true })
  exactFleetSize?: number | null;

  @Column({ name: 'request_type', type: 'varchar', length: 80 })
  requestType: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'varchar', length: 80, default: 'trytrovan.com' })
  source: string;

  @Column({ name: 'page_path', type: 'varchar', length: 240, nullable: true })
  pagePath?: string | null;

  @Column({ type: 'varchar', length: 32, default: 'new' })
  status: MarketingLeadStatus;

  @Column({ name: 'notification_status', type: 'varchar', length: 32, default: 'pending' })
  notificationStatus: LeadNotificationStatus;

  @Column({ name: 'notification_error', type: 'varchar', length: 240, nullable: true })
  notificationError?: string | null;

  @Column({ name: 'notification_message_id', type: 'varchar', length: 80, nullable: true })
  notificationMessageId?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
