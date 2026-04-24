import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('auth_sessions')
@Index(['userId', 'createdAt'])
@Index(['organizationId', 'createdAt'])
export class AuthSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId?: string | null;

  @Column({ length: 255 })
  email: string;

  @Column({ name: 'auth_provider', length: 32, default: 'local-config' })
  authProvider: string;

  @Column({ name: 'provider_session_id', length: 128, nullable: true })
  providerSessionId?: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  roles: string[];

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string | null;

  @Column({ name: 'ip_address', length: 128, nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt?: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
