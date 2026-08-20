import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnboardingProgress1763300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "onboarding_progress" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "app_users"("id") ON DELETE CASCADE,
        "module_key" varchar(80) NOT NULL,
        "content_version" varchar(24) NOT NULL,
        "status" varchar(24) NOT NULL DEFAULT 'IN_PROGRESS',
        "score" smallint,
        "signoff_acknowledged" boolean NOT NULL DEFAULT false,
        "started_at" timestamptz,
        "completed_at" timestamptz,
        "welcome_email_sent_at" timestamptz,
        "next_step_email_sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "chk_onboarding_progress_status" CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED')),
        CONSTRAINT "chk_onboarding_progress_score" CHECK ("score" IS NULL OR "score" BETWEEN 0 AND 100),
        CONSTRAINT "uq_onboarding_progress_version" UNIQUE ("organization_id", "user_id", "module_key", "content_version")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_onboarding_progress_org_updated" ON "onboarding_progress" ("organization_id", "updated_at" DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_onboarding_progress_user" ON "onboarding_progress" ("organization_id", "user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "onboarding_progress"`);
  }
}
