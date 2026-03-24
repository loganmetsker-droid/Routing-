import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDispatchEventStructuredIndexes1741800000000
  implements MigrationInterface
{
  name = 'AddDispatchEventStructuredIndexes1741800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE dispatch_events
      ADD COLUMN IF NOT EXISTS reason_code varchar(120) NULL,
      ADD COLUMN IF NOT EXISTS action varchar(64) NULL,
      ADD COLUMN IF NOT EXISTS actor varchar(128) NULL,
      ADD COLUMN IF NOT EXISTS pack_id varchar(64) NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_reason_created
      ON dispatch_events (reason_code, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_action_created
      ON dispatch_events (action, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_actor_created
      ON dispatch_events (actor, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_dispatch_events_pack_created
      ON dispatch_events (pack_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dispatch_events_pack_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dispatch_events_actor_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dispatch_events_action_created;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dispatch_events_reason_created;`);
    await queryRunner.query(`
      ALTER TABLE dispatch_events
      DROP COLUMN IF EXISTS pack_id,
      DROP COLUMN IF EXISTS actor,
      DROP COLUMN IF EXISTS action,
      DROP COLUMN IF EXISTS reason_code;
    `);
  }
}

