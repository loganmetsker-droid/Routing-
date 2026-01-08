import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteVisualizationFields1735000000000
  implements MigrationInterface
{
  name = 'AddRouteVisualizationFields1735000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add polyline field for route geometry
    await queryRunner.query(
      `ALTER TABLE "routes" ADD "polyline" jsonb COMMENT 'Route polyline geometry (GeoJSON or encoded polyline)'`,
    );

    // Add color field for route visualization
    await queryRunner.query(
      `ALTER TABLE "routes" ADD "color" varchar(7) COMMENT 'Hex color for route visualization (e.g., #FF5733)'`,
    );

    // Add eta field for estimated time of arrival
    await queryRunner.query(
      `ALTER TABLE "routes" ADD "eta" timestamp with time zone COMMENT 'Estimated time of arrival at final destination'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN "eta"`);
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN "color"`);
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN "polyline"`);
  }
}
