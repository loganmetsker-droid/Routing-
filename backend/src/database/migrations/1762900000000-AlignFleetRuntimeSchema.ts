import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns the original fleet tables with the entity model used by the running
 * API. The initial migration predates the expanded driver, vehicle, shift,
 * and telemetry models, so a clean database could migrate successfully and
 * then fail as soon as TypeORM applied its default soft-delete predicate.
 */
export class AlignFleetRuntimeSchema1762900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "vehicles"
        ADD COLUMN IF NOT EXISTS "vehicle_type" varchar(50) NOT NULL DEFAULT 'van',
        ADD COLUMN IF NOT EXISTS "capacity_weight_kg" decimal(10,2),
        ADD COLUMN IF NOT EXISTS "capacity_volume_m3" decimal(10,2),
        ADD COLUMN IF NOT EXISTS "fuel_type" varchar(20) NOT NULL DEFAULT 'diesel',
        ADD COLUMN IF NOT EXISTS "current_location" jsonb,
        ADD COLUMN IF NOT EXISTS "current_odometer_km" decimal(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "last_maintenance_date" date,
        ADD COLUMN IF NOT EXISTS "next_maintenance_km" decimal(10,2),
        ADD COLUMN IF NOT EXISTS "metadata" jsonb,
        ADD COLUMN IF NOT EXISTS "deleted_at" timestamp
    `);

    await queryRunner.query(`
      ALTER TABLE "drivers"
        ADD COLUMN IF NOT EXISTS "date_of_birth" date,
        ADD COLUMN IF NOT EXISTS "license_class" varchar(10),
        ADD COLUMN IF NOT EXISTS "license_expiry_date" date,
        ADD COLUMN IF NOT EXISTS "certifications" jsonb NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS "employee_id" varchar(50),
        ADD COLUMN IF NOT EXISTS "hire_date" date NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN IF NOT EXISTS "employment_status" varchar(20) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "current_vehicle_id" uuid,
        ADD COLUMN IF NOT EXISTS "total_hours_driven" decimal(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_distance_km" decimal(10,2) NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "total_deliveries" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "average_rating" decimal(3,2),
        ADD COLUMN IF NOT EXISTS "metadata" jsonb,
        ADD COLUMN IF NOT EXISTS "deleted_at" timestamp
    `);
    await queryRunner.query(`
      UPDATE "drivers"
      SET "license_number" = 'legacy-' || "id"::text
      WHERE "license_number" IS NULL OR btrim("license_number") = ''
    `);
    await queryRunner.query(`
      UPDATE "drivers"
      SET "license_expiry_date" = CURRENT_DATE
      WHERE "license_expiry_date" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "drivers" ALTER COLUMN "license_number" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "drivers" ALTER COLUMN "license_expiry_date" SET NOT NULL`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_drivers_location"`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'drivers'
            AND column_name = 'current_location'
            AND udt_name = 'geography'
        ) THEN
          ALTER TABLE "drivers" ALTER COLUMN "current_location" DROP DEFAULT;
          ALTER TABLE "drivers" ALTER COLUMN "current_location" TYPE jsonb
          USING CASE
            WHEN "current_location" IS NULL THEN NULL
            ELSE jsonb_build_object(
              'lat', ST_Y("current_location"::geometry),
              'lng', ST_X("current_location"::geometry)
            )
          END;
        END IF;
      END $$
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_drivers_location"
      ON "drivers" USING GIN ("current_location")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_drivers_license_number_unique"
      ON "drivers" ("license_number")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_drivers_employee_id_unique"
      ON "drivers" ("employee_id")
      WHERE "employee_id" IS NOT NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_drivers_current_vehicle'
        ) THEN
          ALTER TABLE "drivers"
            ADD CONSTRAINT "fk_drivers_current_vehicle"
            FOREIGN KEY ("current_vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL;
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "telemetry" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "vehicle_id" uuid NOT NULL REFERENCES "vehicles"("id") ON DELETE CASCADE,
        "location" jsonb NOT NULL,
        "speed" decimal(5,2),
        "heading" decimal(5,2),
        "odometer" decimal(10,2),
        "fuel_level" decimal(5,2),
        "engine_temp" decimal(5,2),
        "timestamp" timestamptz NOT NULL,
        "metadata" jsonb
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_telemetry_timestamp" ON "telemetry" ("timestamp")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_telemetry_vehicle_timestamp" ON "telemetry" ("vehicle_id", "timestamp")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shifts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "driver_id" uuid NOT NULL REFERENCES "drivers"("id") ON DELETE CASCADE,
        "vehicle_id" uuid REFERENCES "vehicles"("id") ON DELETE SET NULL,
        "shift_date" date NOT NULL,
        "scheduled_start" timestamptz NOT NULL,
        "scheduled_end" timestamptz NOT NULL,
        "actual_start" timestamptz,
        "actual_end" timestamptz,
        "shift_type" varchar(20) NOT NULL DEFAULT 'regular',
        "status" varchar(20) NOT NULL DEFAULT 'scheduled',
        "start_location" jsonb,
        "end_location" jsonb,
        "total_break_minutes" integer NOT NULL DEFAULT 0,
        "breaks" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "distance_covered_km" decimal(10,2),
        "deliveries_completed" integer NOT NULL DEFAULT 0,
        "fuel_consumed_liters" decimal(10,2),
        "notes" text,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_shifts_driver_date" ON "shifts" ("driver_id", "shift_date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_shifts_vehicle_date" ON "shifts" ("vehicle_id", "shift_date")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shifts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "telemetry"`);
    await queryRunner.query(`ALTER TABLE "drivers" DROP CONSTRAINT IF EXISTS "fk_drivers_current_vehicle"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_drivers_employee_id_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_drivers_license_number_unique"`);
    await queryRunner.query(`
      ALTER TABLE "drivers"
        DROP COLUMN IF EXISTS "date_of_birth",
        DROP COLUMN IF EXISTS "license_class",
        DROP COLUMN IF EXISTS "license_expiry_date",
        DROP COLUMN IF EXISTS "certifications",
        DROP COLUMN IF EXISTS "employee_id",
        DROP COLUMN IF EXISTS "hire_date",
        DROP COLUMN IF EXISTS "employment_status",
        DROP COLUMN IF EXISTS "current_vehicle_id",
        DROP COLUMN IF EXISTS "total_hours_driven",
        DROP COLUMN IF EXISTS "total_distance_km",
        DROP COLUMN IF EXISTS "total_deliveries",
        DROP COLUMN IF EXISTS "average_rating",
        DROP COLUMN IF EXISTS "metadata",
        DROP COLUMN IF EXISTS "deleted_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "vehicles"
        DROP COLUMN IF EXISTS "vehicle_type",
        DROP COLUMN IF EXISTS "capacity_weight_kg",
        DROP COLUMN IF EXISTS "capacity_volume_m3",
        DROP COLUMN IF EXISTS "fuel_type",
        DROP COLUMN IF EXISTS "current_location",
        DROP COLUMN IF EXISTS "current_odometer_km",
        DROP COLUMN IF EXISTS "last_maintenance_date",
        DROP COLUMN IF EXISTS "next_maintenance_km",
        DROP COLUMN IF EXISTS "metadata",
        DROP COLUMN IF EXISTS "deleted_at"
    `);
  }
}
