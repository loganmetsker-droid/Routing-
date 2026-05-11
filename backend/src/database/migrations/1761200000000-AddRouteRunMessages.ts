import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteRunMessages1761200000000 implements MigrationInterface {
  name = 'AddRouteRunMessages1761200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS route_run_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NULL,
        route_id uuid NOT NULL,
        route_run_stop_id uuid NULL,
        sender_user_id uuid NULL,
        sender_role varchar(24) NOT NULL,
        body text NOT NULL,
        read_by_driver_at timestamptz NULL,
        read_by_dispatch_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_route_run_messages_org_route_created
      ON route_run_messages (organization_id, route_id, created_at);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_route_run_messages_route_created
      ON route_run_messages (route_id, created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS route_run_messages;`);
  }
}
