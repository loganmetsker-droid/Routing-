import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type OrganizationInvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REVOKED'
  | 'EXPIRED';

@Entity('organization_invitations')
@Index(['organizationId', 'email', 'status'])
export class OrganizationInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 32, default: 'VIEWER' })
  role: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  roles: string[];

  @Column({ length: 32, default: 'PENDING' })
  status: OrganizationInvitationStatus;

  @Column({ name: 'invited_by_user_id', type: 'uuid', nullable: true })
  invitedByUserId?: string | null;

  @Column({ name: 'provider', length: 32, default: 'local' })
  provider: string;

  @Column({ name: 'provider_invitation_id', length: 128, nullable: true })
  providerInvitationId?: string | null;

  @Column({ name: 'accept_url', type: 'text', nullable: true })
  acceptUrl?: string | null;

  @Column({ name: 'provider_state', length: 32, nullable: true })
  providerState?: string | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
