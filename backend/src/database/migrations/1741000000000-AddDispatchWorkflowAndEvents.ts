import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDispatchWorkflowAndEvents1741000000000
  implements MigrationInterface
{
  name = 'AddDispatchWorkflowAndEvents1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'routes_workflow_status_enum') THEN
          CREATE TYPE routes_workflow_status_enum AS ENUM (
            'planned',
            'ready_for_dispatch',
            'in_progress',
            'rerouting',
            'degraded',
            'completed',
            'cancelled'
          );
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE routes
      ADD COLUMN IF NOT EXISTS workflow_status routes_workflow_status_enum NOT NULL DEFAULT 'planned';
    `);

    await queryRunner.query(`
      UPDATE routes
      SET workflow_status = CASE
        WHEN status = 'assigned' THEN 'ready_for_dispatch'::routes_workflow_status_enum
        WHEN status = 'in_progress' THEN 'in_progress'::routes_workflow_status_enum
        WHEN status = 'completed' THEN 'completed'::routes_workflow_status_enum
        WHEN status = 'cancelled' THEN 'cancelled'::routes_workflow_status_enum
        ELSE 'planned'::routes_workflow_status_enum
      END
      WHERE workflow_status IS NULL OR workflow_status = 'planned';
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS reroute_requests (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        route_id uuid NOT NULL,
        exception_category varchar(64) NOT NULL,
        action varchar(64) NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'requested',
        reason text NOT NULL,
        request_payload jsonb NULL,
        before_snapshot jsonb NULL,
        after_snapshot jsonb NULL,
        impact_summary jsonb NULL,
        planner_diagnostics jsonb NULL,
        requester_id varchar(128) NULL,
        reviewer_id varchar(128) NULL,
        review_note text NULL,
        applied_by varchar(128) NULL,
        requested_at timestamptz NULL,
        reviewed_at timestamptz NULL,
        applied_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_reroute_requests_route_status
      ON reroute_requests (route_id, status);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_reroute_requests_created
      ON reroute_requests (created_at DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS dispatch_events (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        route_id uuid NULL,
        source varchar(32) NOT NULL,
        level varchar(32) NOT NULL DEFAULT 'info',
        code varchar(120) NOT NULL,
        message text NOT NULL,
        payload jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_route_created
      ON dispatch_events (route_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_source_created
      ON dispatch_events (source, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dispatch_events_source_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dispatch_events_route_created;`);
    await queryRunner.query(`DROP TABLE IF EXISTS dispatch_events;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reroute_requests_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reroute_requests_route_status;`);
    await queryRunner.query(`DROP TABLE IF EXISTS reroute_requests;`);
    await queryRunner.query(`ALTER TABLE routes DROP COLUMN IF EXISTS workflow_status;`);
    await queryRunner.query(`DROP TYPE IF EXISTS routes_workflow_status_enum;`);
  }
}
