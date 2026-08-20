import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostmarkBounceEvents1763200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marketing_leads"
      ADD COLUMN IF NOT EXISTS "notification_message_id" varchar(80)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "postmark_bounce_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "provider_bounce_id" varchar(40) NOT NULL UNIQUE,
        "message_id" varchar(80) NOT NULL,
        "record_type" varchar(40) NOT NULL,
        "bounce_type" varchar(80) NOT NULL,
        "bounce_name" varchar(120) NOT NULL,
        "type_code" integer,
        "message_stream" varchar(80),
        "recipient_hash" char(64) NOT NULL,
        "inactive" boolean NOT NULL DEFAULT false,
        "provider_bounced_at" timestamptz,
        "lead_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_postmark_bounce_message_created"
      ON "postmark_bounce_events" ("message_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "postmark_bounce_events"`);
    await queryRunner.query(`
      ALTER TABLE "marketing_leads"
      DROP COLUMN IF EXISTS "notification_message_id"
    `);
  }
}
