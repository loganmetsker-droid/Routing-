import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformAndNotifications1761100000000
  implements MigrationInterface
{
  name = 'AddPlatformAndNotifications1761100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        name varchar(160) NOT NULL,
        prefix varchar(24) NOT NULL UNIQUE,
        key_hash varchar(128) NOT NULL,
        scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
        last_used_at timestamptz NULL,
        revoked_at timestamptz NULL,
        created_by_user_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_org_name
      ON api_keys (organization_id, name);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS webhook_endpoints (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NOT NULL,
        name varchar(160) NOT NULL,
        url text NOT NULL,
        signing_secret varchar(128) NOT NULL,
        subscribed_events jsonb NOT NULL DEFAULT '[]'::jsonb,
        status varchar(16) NOT NULL DEFAULT 'ACTIVE',
        last_delivery_at timestamptz NULL,
        last_failure text NULL,
        created_by_user_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org_status
      ON webhook_endpoints (organization_id, status);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint_id uuid NOT NULL,
        organization_id uuid NOT NULL,
        event_type varchar(80) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'PENDING',
        request_id varchar(128) NULL,
        attempts int NOT NULL DEFAULT 0,
        response_status int NULL,
        response_body text NULL,
        failure_reason text NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        delivered_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org_created
      ON webhook_deliveries (organization_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_created
      ON webhook_deliveries (endpoint_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS notification_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id uuid NULL,
        route_id uuid NULL,
        route_run_stop_id uuid NULL,
        job_id uuid NULL,
        customer_id uuid NULL,
        event_type varchar(64) NOT NULL,
        channel varchar(16) NOT NULL,
        recipient varchar(255) NOT NULL,
        provider varchar(32) NOT NULL DEFAULT 'disabled',
        status varchar(16) NOT NULL DEFAULT 'PENDING',
        subject varchar(255) NULL,
        message text NOT NULL,
        tracking_url text NULL,
        provider_message_id varchar(255) NULL,
        failure_reason text NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        sent_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_deliveries_org_created
      ON notification_deliveries (organization_id, created_at DESC);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_deliveries_route_created
      ON notification_deliveries (route_id, created_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notification_deliveries;`);
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_deliveries;`);
    await queryRunner.query(`DROP TABLE IF EXISTS webhook_endpoints;`);
    await queryRunner.query(`DROP TABLE IF EXISTS api_keys;`);
  }
}
