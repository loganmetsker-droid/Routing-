import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteDispatchSentState1762800200000
  implements MigrationInterface
{
  name = 'AddRouteDispatchSentState1762800200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE routes
      ALTER COLUMN vehicle_id DROP NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE routes
      ADD COLUMN IF NOT EXISTS dispatched_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS dispatched_by_user_id uuid NULL,
      ADD COLUMN IF NOT EXISTS dispatch_note text NULL;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN routes.dispatched_at IS
      'When the route run was sent to the assigned driver.';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN routes.dispatched_by_user_id IS
      'Dispatcher or system actor that sent the route to the driver.';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN routes.dispatch_note IS
      'Optional note sent to the driver when the route was dispatched.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE routes
      DROP COLUMN IF EXISTS dispatch_note,
      DROP COLUMN IF EXISTS dispatched_by_user_id,
      DROP COLUMN IF EXISTS dispatched_at;
    `);
  }
}
