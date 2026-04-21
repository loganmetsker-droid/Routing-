import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type MembershipRole = 'OWNER' | 'ADMIN' | 'DISPATCHER' | 'VIEWER' | 'DRIVER';

@Entity('organization_memberships')
@Index(['organizationId', 'userId'], { unique: true })
export class OrganizationMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32, default: 'ADMIN' })
  role: MembershipRole;

  @Column({ type: 'jsonb', default: () => "'[\"ADMIN\"]'::jsonb" })
  roles: string[];

  @Column({ name: 'is_default', type: 'boolean', default: true })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
