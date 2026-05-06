import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionOrganizationScope1761120000000
  implements MigrationInterface
{
  name = 'AddSubscriptionOrganizationScope1761120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS organization_id uuid NULL;
    `);

    await queryRunner.query(`
      UPDATE subscriptions subscription
      SET organization_id = membership.organization_id
      FROM organization_memberships membership
      WHERE subscription.organization_id IS NULL
        AND subscription.user_id = membership.user_id
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
