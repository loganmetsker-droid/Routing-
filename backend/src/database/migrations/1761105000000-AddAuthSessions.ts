import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthSessions1761105000000 implements MigrationInterface {
  name = 'AddAuthSessions1761105000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        organization_id uuid NULL,
        email varchar(255) NOT NULL,
        auth_provider varchar(32) NOT NULL DEFAULT 'local-config',
        roles jsonb NOT NULL DEFAULT '[]'::jsonb,
        user_agent text NULL,
        ip_address varchar(128) NULL,
        last_seen_at timestamptz NULL,
        revoked_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_created
      ON auth_sessions (user_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_org_created
      ON auth_sessions (organization_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS auth_sessions;`);
  }
}
