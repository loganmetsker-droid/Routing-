import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoutePlanPublishDecisions1762800100000
  implements MigrationInterface
{
  name = 'AddRoutePlanPublishDecisions1762800100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE route_plans
      ADD COLUMN IF NOT EXISTS publish_decisions jsonb NOT NULL DEFAULT '[]'::jsonb;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN route_plans.publish_decisions IS
      'Persisted publish blocker decisions, including accepted-risk reasons, actor, and timestamp.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE route_plans
      DROP COLUMN IF EXISTS publish_decisions;
    `);
  }
}
