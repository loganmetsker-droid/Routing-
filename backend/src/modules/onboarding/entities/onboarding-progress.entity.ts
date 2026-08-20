import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('onboarding_progress')
@Index(['organizationId', 'userId', 'moduleKey', 'contentVersion'], { unique: true })
@Index(['organizationId', 'updatedAt'])
export class OnboardingProgressEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'module_key', type: 'varchar', length: 80 })
  moduleKey: string;

  @Column({ name: 'content_version', type: 'varchar', length: 24 })
  contentVersion: string;

  @Column({ type: 'varchar', length: 24, default: 'IN_PROGRESS' })
  status: 'IN_PROGRESS' | 'COMPLETED';

  @Column({ type: 'smallint', nullable: true })
  score?: number | null;

  @Column({ name: 'signoff_acknowledged', type: 'boolean', default: false })
  signoffAcknowledged: boolean;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'welcome_email_sent_at', type: 'timestamptz', nullable: true })
  welcomeEmailSentAt?: Date | null;

  @Column({ name: 'next_step_email_sent_at', type: 'timestamptz', nullable: true })
  nextStepEmailSentAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
