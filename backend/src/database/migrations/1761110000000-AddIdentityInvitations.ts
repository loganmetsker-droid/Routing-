import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdentityInvitations1761110000000
  implements MigrationInterface
{
  name = 'AddIdentityInvitations1761110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app_users
      ADD COLUMN IF NOT EXISTS external_id varchar(128) NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE auth_sessions
      ADD COLUMN IF NOT EXISTS provider_session_id varchar(128) NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organization_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        email varchar(255) NOT NULL,
        role varchar(32) NOT NULL DEFAULT 'VIEWER',
        roles jsonb NOT NULL DEFAULT '[]'::jsonb,
        status varchar(32) NOT NULL DEFAULT 'PENDING',
        invited_by_user_id uuid NULL,
        provider varchar(32) NOT NULL DEFAULT 'local',
        provider_invitation_id varchar(128) NULL,
        accept_url text NULL,
        provider_state varchar(32) NULL,
        last_error text NULL,
        expires_at timestamptz NULL,
        accepted_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_org_invitations_org_email_status
      ON organization_invitations (organization_id, email, status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS organization_invitations;`);
    await queryRunner.query(`
      ALTER TABLE auth_sessions
      DROP COLUMN IF EXISTS provider_session_id;
    `);
    await queryRunner.query(`
      ALTER TABLE app_users
      DROP COLUMN IF EXISTS external_id;
    `);
  }
}
