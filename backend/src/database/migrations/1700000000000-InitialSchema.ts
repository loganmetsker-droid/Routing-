import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);

    // Create drivers table
    await queryRunner.query(`
      CREATE TABLE "drivers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "first_name" varchar NOT NULL,
        "last_name" varchar NOT NULL,
        "email" varchar UNIQUE NOT NULL,
        "phone" varchar NOT NULL,
        "license_number" varchar,
        "status" varchar NOT NULL DEFAULT 'available',
        "current_location" geography(Point, 4326),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create vehicles table
    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "make" varchar NOT NULL,
        "model" varchar NOT NULL,
        "year" integer NOT NULL,
        "license_plate" varchar UNIQUE NOT NULL,
        "vin" varchar UNIQUE,
        "status" varchar NOT NULL DEFAULT 'available',
        "capacity" decimal,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create routes table
    await queryRunner.query(`
      CREATE TABLE "routes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "driver_id" uuid REFERENCES drivers(id),
        "vehicle_id" uuid REFERENCES vehicles(id),
        "status" varchar NOT NULL DEFAULT 'planned',
        "start_location" geography(Point, 4326),
        "end_location" geography(Point, 4326),
        "waypoints" jsonb,
        "estimated_distance" decimal,
        "estimated_duration" integer,
        "started_at" timestamp,
        "completed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create dispatches table
    await queryRunner.query(`
      CREATE TABLE "dispatches" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "route_id" uuid REFERENCES routes(id),
        "priority" varchar NOT NULL DEFAULT 'normal',
        "status" varchar NOT NULL DEFAULT 'pending',
        "pickup_location" geography(Point, 4326),
        "delivery_location" geography(Point, 4326),
        "pickup_time" timestamp,
        "delivery_time" timestamp,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "idx_drivers_status" ON "drivers"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_drivers_location" ON "drivers" USING GIST("current_location")`);
    await queryRunner.query(`CREATE INDEX "idx_vehicles_status" ON "vehicles"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_routes_status" ON "routes"("status")`);
    await queryRunner.query(`CREATE INDEX "idx_routes_driver" ON "routes"("driver_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "dispatches"`);
    await queryRunner.query(`DROP TABLE "routes"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TABLE "drivers"`);
  }
}
