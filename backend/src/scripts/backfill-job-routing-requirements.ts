import * as dotenv from 'dotenv';
import { In, IsNull, Not } from 'typeorm';
import { evaluateJobRoutingReadiness } from '@shared/contracts';
import { Job, JobStatus } from '../modules/jobs/entities/job.entity';
import { buildDefaultJobRoutingRequirements } from '../modules/jobs/job-routing-defaults';
import { Organization } from '../modules/organizations/entities/organization.entity';

dotenv.config({ path: '.env.local', override: false });
dotenv.config({ override: false });

async function run() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PRODUCTION_JOB_ROUTING_BACKFILL !== 'true'
  ) {
    throw new Error('Refusing to backfill production jobs without explicit approval.');
  }

  const { AppDataSource } = await import('../data-source');
  await AppDataSource.initialize();

  try {
    const jobRepo = AppDataSource.getRepository(Job);
    const orgRepo = AppDataSource.getRepository(Organization);
    const jobs = await jobRepo.find({
      where: {
        archivedAt: IsNull(),
        status: Not(In([JobStatus.COMPLETED, JobStatus.CANCELLED, JobStatus.ARCHIVED])),
      },
      order: { createdAt: 'ASC' },
    });
    const orgIds = Array.from(new Set(jobs.map((job) => job.organizationId).filter(Boolean)));
    const orgs = orgIds.length
      ? await orgRepo.find({ where: { id: In(orgIds as string[]) } })
      : [];
    const seededOrgIds = new Set(
      orgs
        .filter((org) => (org.settings as Record<string, unknown> | undefined)?.seeded)
        .map((org) => org.id),
    );

    const isLocalBackfill =
      process.env.BACKFILL_ALL_ORGS === 'true' || process.env.NODE_ENV !== 'production';
    const candidates = jobs.filter(
      (job) =>
        isLocalBackfill ||
        !job.organizationId ||
        seededOrgIds.has(job.organizationId),
    );

    const updates: Job[] = [];
    for (const job of candidates) {
      const before = evaluateJobRoutingReadiness({
        deliveryAddress: job.deliveryAddress,
        timeWindowStart: job.timeWindowStart,
        timeWindowEnd: job.timeWindowEnd,
        estimatedDuration: job.estimatedDuration,
        weight: job.weight,
        volume: job.volume,
        quantity: job.quantity,
        routingRequirements: job.routingRequirements,
      });
      if (!before.reasonCodes.some((code) => code.startsWith('MISSING_'))) continue;

      job.routingRequirements = buildDefaultJobRoutingRequirements(job);
      const after = evaluateJobRoutingReadiness({
        deliveryAddress: job.deliveryAddress,
        timeWindowStart: job.timeWindowStart,
        timeWindowEnd: job.timeWindowEnd,
        estimatedDuration: job.estimatedDuration,
        weight: job.weight,
        volume: job.volume,
        quantity: job.quantity,
        routingRequirements: job.routingRequirements,
      });
      if (after.reasonCodes.some((code) => code.startsWith('MISSING_'))) {
        console.warn(
          `Skipping ${job.id}: still missing ${after.reasonCodes.join(', ')}`,
        );
        continue;
      }
      updates.push(job);
    }

    if (updates.length) {
      await jobRepo.save(updates);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          scanned: jobs.length,
          candidates: candidates.length,
          updated: updates.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
