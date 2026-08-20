import * as dotenv from 'dotenv';
import { ConfigService } from '@nestjs/config';
import { AccessCodeCryptoService } from '../common/security/access-code-crypto.service';
import { Job } from '../modules/jobs/entities/job.entity';

dotenv.config({ path: '.env.local', override: false });
dotenv.config({ override: false });

async function run() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PRODUCTION_ACCESS_CODE_BACKFILL !== 'true'
  ) {
    throw new Error(
      'Refusing to encrypt production access codes without explicit approval.',
    );
  }
  if (!process.env.ACCESS_CODE_ENCRYPTION_KEY) {
    throw new Error('ACCESS_CODE_ENCRYPTION_KEY is required.');
  }

  const { AppDataSource } = await import('../data-source');
  await AppDataSource.initialize();
  try {
    const jobs = AppDataSource.getRepository(Job);
    const accessCodes = new AccessCodeCryptoService(new ConfigService(process.env));
    const candidates = await jobs
      .createQueryBuilder('job')
      .where("job.routing_requirements #>> '{site,accessCode}' IS NOT NULL")
      .andWhere("TRIM(job.routing_requirements #>> '{site,accessCode}') <> ''")
      .orderBy('job.created_at', 'ASC')
      .getMany();

    for (const job of candidates) {
      job.routingRequirements = accessCodes.protect(job.routingRequirements);
    }
    if (candidates.length) await jobs.save(candidates);

    console.log(JSON.stringify({
      ok: true,
      scanned: candidates.length,
      encrypted: candidates.length,
      keyVersion: process.env.ACCESS_CODE_KEY_VERSION || 'v1',
    }, null, 2));
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
