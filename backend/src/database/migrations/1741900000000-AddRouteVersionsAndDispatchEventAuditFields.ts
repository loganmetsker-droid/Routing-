import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteVersionsAndDispatchEventAuditFields1741900000000
  implements MigrationInterface
{
  name = 'AddRouteVersionsAndDispatchEventAuditFields1741900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS route_versions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
        version_number integer NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'DRAFT',
        snapshot jsonb NOT NULL,
        created_by_user_id varchar(128) NULL,
        reviewed_by_user_id varchar(128) NULL,
        approved_by_user_id varchar(128) NULL,
        published_by_user_id varchar(128) NULL,
        reviewed_at timestamptz NULL,
        approved_at timestamptz NULL,
        published_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_route_versions_route_version UNIQUE (route_id, version_number)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_route_versions_route_created
      ON route_versions (route_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_route_versions_route_status
      ON route_versions (route_id, status);
    `);

    await queryRunner.query(`
      ALTER TABLE dispatch_events
      ADD COLUMN IF NOT EXISTS aggregate_type varchar(32) NOT NULL DEFAULT 'ROUTE',
      ADD COLUMN IF NOT EXISTS aggregate_id uuid NULL,
      ADD COLUMN IF NOT EXISTS event_type varchar(120) NOT NULL DEFAULT 'UNKNOWN',
      ADD COLUMN IF NOT EXISTS actor_user_id varchar(128) NULL;
    `);

    await queryRunner.query(`
      UPDATE dispatch_events
      SET aggregate_id = COALESCE(aggregate_id, route_id),
          event_type = CASE
            WHEN event_type = 'UNKNOWN' THEN code
            ELSE event_type
          END
      WHERE aggregate_id IS NULL OR event_type = 'UNKNOWN';
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_aggregate_created
      ON dispatch_events (aggregate_type, aggregate_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_event_type_created
      ON dispatch_events (event_type, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_dispatch_events_event_type_created;`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_dispatch_events_aggregate_created;`,
    );
    await queryRunner.query(`
      ALTER TABLE dispatch_events
      DROP COLUMN IF EXISTS actor_user_id,
      DROP COLUMN IF EXISTS event_type,
      DROP COLUMN IF EXISTS aggregate_id,
      DROP COLUMN IF EXISTS aggregate_type;
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_versions_route_status;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_versions_route_created;`);
    await queryRunner.query(`DROP TABLE IF EXISTS route_versions;`);
  }
}
