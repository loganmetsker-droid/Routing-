import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionOrganizationScope1761120000000
  implements MigrationInterface
{
  name = 'AddSubscriptionOrganizationScope1761120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id varchar NOT NULL,
        organization_id uuid NULL,
        stripe_customer_id varchar NOT NULL,
        stripe_subscription_id varchar NOT NULL,
        plan varchar NOT NULL DEFAULT 'starter',
        status varchar NOT NULL DEFAULT 'incomplete',
        current_period_start timestamp NOT NULL,
        current_period_end timestamp NOT NULL,
        cancel_at_period_end boolean NOT NULL DEFAULT false,
        canceled_at timestamp NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS organization_id uuid NULL;
    `);

    await queryRunner.query(`
      UPDATE subscriptions subscription
      SET organization_id = membership.organization_id
      FROM organization_memberships membership
      WHERE subscription.organization_id IS NULL
        AND subscription.user_id = membership.user_id::text
        AND membership.is_default = true;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_org_user
      ON subscriptions (organization_id, user_id);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_org_stripe
      ON subscriptions (organization_id, stripe_subscription_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_subscriptions_org_stripe;
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_subscriptions_org_user;
    `);

    await queryRunner.query(`
      ALTER TABLE subscriptions
      DROP COLUMN IF EXISTS organization_id;
    `);
  }
}
