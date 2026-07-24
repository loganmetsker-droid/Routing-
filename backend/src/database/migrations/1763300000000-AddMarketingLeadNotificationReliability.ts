import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketingLeadNotificationReliability1763300000000
  implements MigrationInterface
{
  name = 'AddMarketingLeadNotificationReliability1763300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE marketing_leads
      ADD COLUMN IF NOT EXISTS notification_attempts int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_notification_attempt_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS next_notification_attempt_at timestamptz NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_marketing_leads_notification_retry_due
      ON marketing_leads (notification_status, next_notification_attempt_at)
      WHERE notification_status = 'failed'
        AND next_notification_attempt_at IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_marketing_leads_notification_retry_due;
    `);
    await queryRunner.query(`
      ALTER TABLE marketing_leads
      DROP COLUMN IF EXISTS next_notification_attempt_at,
      DROP COLUMN IF EXISTS last_notification_attempt_at,
      DROP COLUMN IF EXISTS notification_attempts;
    `);
  }
}
