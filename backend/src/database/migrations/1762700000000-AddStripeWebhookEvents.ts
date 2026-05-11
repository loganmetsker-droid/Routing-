import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeWebhookEvents1762700000000 implements MigrationInterface {
  name = 'AddStripeWebhookEvents1762700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "stripe_event_id" character varying(255) NOT NULL,
        "event_type" character varying(255) NOT NULL,
        "livemode" boolean NOT NULL DEFAULT false,
        "processed_at" TIMESTAMP WITH TIME ZONE,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stripe_webhook_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stripe_webhook_events_event_id"
      ON "stripe_webhook_events" ("stripe_event_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_stripe_webhook_events_event_id"');
    await queryRunner.query('DROP TABLE IF EXISTS "stripe_webhook_events"');
  }
}
