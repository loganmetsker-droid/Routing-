import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationDeliveryReliability1763200000000
  implements MigrationInterface
{
  name = 'AddNotificationDeliveryReliability1763200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notification_deliveries
      ADD COLUMN IF NOT EXISTS idempotency_key varchar(64),
      ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS attempt_token varchar(64) NULL,
      ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz NULL;
    `);

    await queryRunner.query(`
      UPDATE notification_deliveries
      SET idempotency_key = id::text
      WHERE idempotency_key IS NULL;
    `);

    await queryRunner.query(`
      UPDATE notification_deliveries
      SET lease_expires_at = now()
      WHERE status = 'PENDING'
        AND lease_expires_at IS NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE notification_deliveries
      ALTER COLUMN idempotency_key SET NOT NULL;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_idempotency
      ON notification_deliveries (idempotency_key);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_deliveries_retry_due
      ON notification_deliveries (status, next_attempt_at, lease_expires_at)
      WHERE status IN ('PENDING', 'FAILED');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_notification_deliveries_retry_due;
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_notification_deliveries_idempotency;
    `);
    await queryRunner.query(`
      ALTER TABLE notification_deliveries
      DROP COLUMN IF EXISTS lease_expires_at,
      DROP COLUMN IF EXISTS attempt_token,
      DROP COLUMN IF EXISTS next_attempt_at,
      DROP COLUMN IF EXISTS last_attempt_at,
      DROP COLUMN IF EXISTS attempts,
      DROP COLUMN IF EXISTS idempotency_key;
    `);
  }
}
