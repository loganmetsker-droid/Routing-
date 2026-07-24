import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketingLeads1763000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "marketing_leads" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(120) NOT NULL,
        "work_email" varchar(254) NOT NULL,
        "company" varchar(160) NOT NULL,
        "fleet_size" varchar(40) NOT NULL,
        "exact_fleet_size" integer,
        "request_type" varchar(80) NOT NULL,
        "notes" text,
        "source" varchar(80) NOT NULL DEFAULT 'trytrovan.com',
        "page_path" varchar(240),
        "status" varchar(32) NOT NULL DEFAULT 'new',
        "notification_status" varchar(32) NOT NULL DEFAULT 'pending',
        "notification_error" varchar(240),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_marketing_leads_exact_fleet_size"
          CHECK ("exact_fleet_size" IS NULL OR "exact_fleet_size" BETWEEN 1 AND 100000),
        CONSTRAINT "chk_marketing_leads_status"
          CHECK ("status" IN ('new', 'contacted', 'qualified', 'closed')),
        CONSTRAINT "chk_marketing_leads_notification_status"
          CHECK ("notification_status" IN ('pending', 'sent', 'failed', 'skipped'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_marketing_leads_email_created"
      ON "marketing_leads" ("work_email", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_marketing_leads_status_created"
      ON "marketing_leads" ("status", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "marketing_leads"`);
  }
}
