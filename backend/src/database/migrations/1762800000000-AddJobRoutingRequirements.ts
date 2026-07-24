import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobRoutingRequirements1762800000000
  implements MigrationInterface
{
  name = 'AddJobRoutingRequirements1762800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE jobs
      ADD COLUMN IF NOT EXISTS routing_requirements jsonb;
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN jobs.routing_requirements IS
      'Routing-critical constraints: pallet/load dimensions, stackability, required equipment, driver, site/access rules, hazmat, and temperature control';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE jobs
      DROP COLUMN IF EXISTS routing_requirements;
    `);
  }
}
