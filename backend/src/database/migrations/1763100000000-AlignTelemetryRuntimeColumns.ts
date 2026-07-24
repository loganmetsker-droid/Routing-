import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignTelemetryRuntimeColumns1763100000000
  implements MigrationInterface
{
  name = 'AlignTelemetryRuntimeColumns1763100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'telemetry'
            AND column_name = 'fuelLevel'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'telemetry'
            AND column_name = 'fuel_level'
        ) THEN
          ALTER TABLE "telemetry" RENAME COLUMN "fuelLevel" TO "fuel_level";
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'telemetry'
            AND column_name = 'engineTemp'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'telemetry'
            AND column_name = 'engine_temp'
        ) THEN
          ALTER TABLE "telemetry" RENAME COLUMN "engineTemp" TO "engine_temp";
        END IF;
      END $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'telemetry'
            AND column_name = 'fuel_level'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'telemetry'
            AND column_name = 'fuelLevel'
        ) THEN
          ALTER TABLE "telemetry" RENAME COLUMN "fuel_level" TO "fuelLevel";
        END IF;

        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'telemetry'
            AND column_name = 'engine_temp'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'telemetry'
            AND column_name = 'engineTemp'
        ) THEN
          ALTER TABLE "telemetry" RENAME COLUMN "engine_temp" TO "engineTemp";
        END IF;
      END $$
    `);
  }
}
