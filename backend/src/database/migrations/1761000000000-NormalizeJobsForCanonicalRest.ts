import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeJobsForCanonicalRest1761000000000
  implements MigrationInterface
{
  name = 'NormalizeJobsForCanonicalRest1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE jobs
      SET status = 'pending'
      WHERE status = 'unscheduled';
    `);

    await queryRunner.query(`
      UPDATE jobs
      SET status = 'assigned'
      WHERE status = 'scheduled';
    `);

    await queryRunner.query(`
      UPDATE jobs
      SET pickup_address_structured = jsonb_build_object(
        'line1', pickup_address,
        'line2', NULL,
        'city', '',
        'state', '',
        'zip', ''
      )
      WHERE pickup_address_structured IS NULL
        AND pickup_address IS NOT NULL
        AND pickup_address <> '';
    `);

    await queryRunner.query(`
      UPDATE jobs
      SET delivery_address_structured = jsonb_build_object(
        'line1', delivery_address,
        'line2', NULL,
        'city', '',
        'state', '',
        'zip', ''
      )
      WHERE delivery_address_structured IS NULL
        AND delivery_address IS NOT NULL
        AND delivery_address <> '';
    `);
  }

  public async down(): Promise<void> {
    // Intentionally left as a no-op because the canonical status/address
    // normalization is not safely reversible once existing pending/assigned rows
    // are mixed with migrated data.
  }
}
