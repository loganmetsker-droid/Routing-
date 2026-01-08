import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDriverRoles1735100000000 implements MigrationInterface {
  name = 'AddDriverRoles1735100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add roles field to drivers table
    await queryRunner.query(
      `ALTER TABLE "drivers" ADD "roles" jsonb DEFAULT '["DRIVER"]'`,
    );

    // Update existing drivers to have DRIVER role
    await queryRunner.query(
      `UPDATE "drivers" SET "roles" = '["DRIVER"]' WHERE "roles" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN "roles"`);
  }
}
