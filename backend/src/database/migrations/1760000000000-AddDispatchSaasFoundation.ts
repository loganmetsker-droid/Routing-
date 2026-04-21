import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDispatchSaasFoundation1760000000000 implements MigrationInterface {
  name = 'AddDispatchSaasFoundation1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name varchar(160) NOT NULL,
        slug varchar(80) NOT NULL UNIQUE,
        service_timezone varchar(64) NOT NULL DEFAULT 'UTC',
        settings jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        email varchar(255) NOT NULL UNIQUE,
        display_name varchar(160) NOT NULL,
        auth_provider varchar(32) NOT NULL DEFAULT 'local-config',
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS organization_memberships (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        role varchar(32) NOT NULL DEFAULT 'ADMIN',
        roles jsonb NOT NULL DEFAULT '["ADMIN"]'::jsonb,
        is_default boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (organization_id, user_id)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS depots (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name varchar(160) NOT NULL,
        address text NOT NULL,
        location jsonb NULL,
        is_primary boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    for (const tableName of ['customers', 'drivers', 'vehicles', 'jobs', 'routes']) {
      await queryRunner.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS organization_id uuid NULL;`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_${tableName}_organization_id ON ${tableName}(organization_id);`);
    }

    await queryRunner.query(`ALTER TABLE route_versions ADD COLUMN IF NOT EXISTS organization_id uuid NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_route_versions_organization_id ON route_versions(organization_id);`);
    await queryRunner.query(`ALTER TABLE reroute_requests ADD COLUMN IF NOT EXISTS organization_id uuid NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_reroute_requests_organization_id ON reroute_requests(organization_id);`);
    await queryRunner.query(`ALTER TABLE dispatch_events ADD COLUMN IF NOT EXISTS organization_id uuid NULL;`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_dispatch_events_organization_id ON dispatch_events(organization_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS job_stops (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL,
        job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        stop_order int NOT NULL,
        stop_type varchar(24) NOT NULL DEFAULT 'DROPOFF',
        address text NOT NULL,
        location jsonb NULL,
        service_duration_minutes int NOT NULL DEFAULT 10,
        time_window_start timestamptz NULL,
        time_window_end timestamptz NULL,
        demand_weight_kg decimal(10,2) NULL,
        demand_volume_m3 decimal(10,2) NULL,
        notes text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (job_id, stop_order)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS route_plans (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        service_date date NOT NULL,
        depot_id uuid NULL REFERENCES depots(id) ON DELETE SET NULL,
        status varchar(32) NOT NULL DEFAULT 'DRAFT',
        objective varchar(32) NOT NULL DEFAULT 'distance',
        metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
        warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_by_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
        published_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_route_plans_org_service_date ON route_plans(organization_id, service_date);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS route_plan_groups (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        route_plan_id uuid NOT NULL REFERENCES route_plans(id) ON DELETE CASCADE,
        group_index int NOT NULL,
        label varchar(160) NOT NULL,
        driver_id uuid NULL REFERENCES drivers(id) ON DELETE SET NULL,
        vehicle_id uuid NULL REFERENCES vehicles(id) ON DELETE SET NULL,
        total_distance_km decimal(10,2) NOT NULL DEFAULT 0,
        total_duration_minutes int NOT NULL DEFAULT 0,
        service_time_minutes int NOT NULL DEFAULT 0,
        total_weight_kg decimal(10,2) NOT NULL DEFAULT 0,
        total_volume_m3 decimal(10,2) NOT NULL DEFAULT 0,
        warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (route_plan_id, group_index)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS route_plan_stops (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        route_plan_id uuid NOT NULL REFERENCES route_plans(id) ON DELETE CASCADE,
        route_plan_group_id uuid NOT NULL REFERENCES route_plan_groups(id) ON DELETE CASCADE,
        job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        job_stop_id uuid NOT NULL REFERENCES job_stops(id) ON DELETE CASCADE,
        stop_sequence int NOT NULL,
        is_locked boolean NOT NULL DEFAULT false,
        planned_arrival timestamptz NULL,
        planned_departure timestamptz NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (route_plan_group_id, stop_sequence)
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_route_plan_stops_unique_assignment ON route_plan_stops(route_plan_id, job_stop_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS route_run_stops (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL,
        route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
        job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        job_stop_id uuid NOT NULL REFERENCES job_stops(id) ON DELETE CASCADE,
        stop_sequence int NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'PENDING',
        planned_arrival timestamptz NULL,
        actual_arrival timestamptz NULL,
        actual_departure timestamptz NULL,
        proof_required boolean NOT NULL DEFAULT false,
        notes text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (route_id, stop_sequence)
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_route_run_stops_unique_assignment ON route_run_stops(route_id, job_stop_id);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS route_assignments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL,
        route_id uuid NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
        route_plan_group_id uuid NULL REFERENCES route_plan_groups(id) ON DELETE SET NULL,
        driver_id uuid NULL REFERENCES drivers(id) ON DELETE SET NULL,
        vehicle_id uuid NULL REFERENCES vehicles(id) ON DELETE SET NULL,
        assigned_by_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
        assigned_at timestamptz NOT NULL DEFAULT now(),
        unassigned_at timestamptz NULL,
        reason text NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS stop_events (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL,
        route_run_stop_id uuid NOT NULL REFERENCES route_run_stops(id) ON DELETE CASCADE,
        event_type varchar(48) NOT NULL,
        actor_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        happened_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_stop_events_route_run_stop_id ON stop_events(route_run_stop_id, happened_at DESC);`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exceptions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL,
        route_id uuid NULL REFERENCES routes(id) ON DELETE CASCADE,
        route_run_stop_id uuid NULL REFERENCES route_run_stops(id) ON DELETE CASCADE,
        code varchar(48) NOT NULL,
        message text NOT NULL,
        status varchar(24) NOT NULL DEFAULT 'OPEN',
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        acknowledged_by_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
        resolved_by_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
        resolved_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS proof_artifacts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL,
        route_run_stop_id uuid NOT NULL REFERENCES route_run_stops(id) ON DELETE CASCADE,
        type varchar(32) NOT NULL,
        uri text NOT NULL,
        created_by_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NULL REFERENCES organizations(id) ON DELETE SET NULL,
        actor_id varchar(128) NOT NULL,
        actor_type varchar(32) NOT NULL,
        entity_type varchar(64) NOT NULL,
        entity_id varchar(128) NOT NULL,
        action varchar(120) NOT NULL,
        source varchar(32) NOT NULL DEFAULT 'system',
        previous_value jsonb NULL,
        new_value jsonb NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_logs_org_created;`);
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS proof_artifacts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS exceptions;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_stop_events_route_run_stop_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS stop_events;`);
    await queryRunner.query(`DROP TABLE IF EXISTS route_assignments;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_run_stops_unique_assignment;`);
    await queryRunner.query(`DROP TABLE IF EXISTS route_run_stops;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_plan_stops_unique_assignment;`);
    await queryRunner.query(`DROP TABLE IF EXISTS route_plan_stops;`);
    await queryRunner.query(`DROP TABLE IF EXISTS route_plan_groups;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_plans_org_service_date;`);
    await queryRunner.query(`DROP TABLE IF EXISTS route_plans;`);
    await queryRunner.query(`DROP TABLE IF EXISTS job_stops;`);
    for (const tableName of ['customers', 'drivers', 'vehicles', 'jobs', 'routes']) {
      await queryRunner.query(`ALTER TABLE ${tableName} DROP COLUMN IF EXISTS organization_id;`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_${tableName}_organization_id;`);
    }
    await queryRunner.query(`ALTER TABLE route_versions DROP COLUMN IF EXISTS organization_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_route_versions_organization_id;`);
    await queryRunner.query(`ALTER TABLE reroute_requests DROP COLUMN IF EXISTS organization_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_reroute_requests_organization_id;`);
    await queryRunner.query(`ALTER TABLE dispatch_events DROP COLUMN IF EXISTS organization_id;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_dispatch_events_organization_id;`);
    await queryRunner.query(`DROP TABLE IF EXISTS depots;`);
    await queryRunner.query(`DROP TABLE IF EXISTS organization_memberships;`);
    await queryRunner.query(`DROP TABLE IF EXISTS app_users;`);
    await queryRunner.query(`DROP TABLE IF EXISTS organizations;`);
  }
}
