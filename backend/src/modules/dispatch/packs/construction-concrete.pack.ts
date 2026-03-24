import {
  ConstraintPack,
  PackConstraintContext,
  PackDiagnostics,
} from '../constraint-packs';

const toLower = (value: any) => String(value || '').toLowerCase();

const isConcreteJob = (job: any) => {
  const text = `${job?.notes || ''} ${job?.specialInstructions || ''}`.toLowerCase();
  return text.includes('concrete') || text.includes('pour') || text.includes('construction');
};

const buildConcreteTimingDiagnostics = (ctx: PackConstraintContext) => {
  const jobOrder = Array.isArray(ctx.afterSnapshot?.jobIds) ? ctx.afterSnapshot.jobIds : [];
  const jobById = new Map(ctx.jobs.map((job) => [job.id, job]));
  const defaultServiceDurationMin = Math.max(
    1,
    Number(ctx.payload?.defaultServiceDurationMinutes || 20),
  );
  const travelBufferMin = Math.max(0, Number(ctx.payload?.travelBufferMinutes || 12));
  const maxPourDelayMinutes = Number(ctx.payload?.concrete?.maxPourDelayMinutes || 120);
  const plannedStart = ctx.payload?.plannedStart
    ? new Date(ctx.payload.plannedStart)
    : new Date();
  let clock = new Date(plannedStart);
  const concreteDelayViolations: Array<{ jobId: string; elapsedMinutes: number; maxAllowed: number }> = [];

  jobOrder.forEach((jobId) => {
    const job = jobById.get(jobId);
    if (!job) return;
    clock = new Date(clock.getTime() + travelBufferMin * 60000);
    if (isConcreteJob(job)) {
      const elapsedMinutes = Math.round((clock.getTime() - plannedStart.getTime()) / 60000);
      if (elapsedMinutes > maxPourDelayMinutes) {
        concreteDelayViolations.push({
          jobId,
          elapsedMinutes,
          maxAllowed: maxPourDelayMinutes,
        });
      }
    }
    const duration = Math.max(1, Number(job.estimatedDuration || defaultServiceDurationMin));
    clock = new Date(clock.getTime() + duration * 60000);
  });

  return concreteDelayViolations;
};

export const constructionConcretePack: ConstraintPack = {
  id: 'construction_concrete',
  label: 'Construction / Concrete',
  applies: (ctx) => {
    if (ctx.payload?.constraintPackId === 'construction_concrete') return true;
    return ctx.jobs.some((job) => isConcreteJob(job));
  },
  evaluate: (ctx): PackDiagnostics => {
    const reasonCodes: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, any> = {};
    const jobIds = Array.isArray(ctx.afterSnapshot?.jobIds) ? ctx.afterSnapshot.jobIds : [];
    const jobById = new Map(ctx.jobs.map((job) => [job.id, job]));
    const siteReadinessByJob = ctx.payload?.siteReadinessByJob || {};
    const requiredEquipmentByJob = ctx.payload?.requiredEquipmentByJob || {};
    const vehicleEquipmentTags = Array.isArray(ctx.payload?.vehicleEquipmentTags)
      ? ctx.payload.vehicleEquipmentTags.map((tag: any) => toLower(tag))
      : [];
    const requiredSkillsByJob = ctx.payload?.requiredSkillsByJob || {};
    const driverTags = Array.isArray(ctx.driver?.certifications)
      ? ctx.driver.certifications.map((tag) => toLower(tag))
      : [];

    for (const jobId of jobIds) {
      const job = jobById.get(jobId);
      if (!job || !isConcreteJob(job)) continue;

      if (siteReadinessByJob[jobId] === false) {
        reasonCodes.push('CONCRETE_SITE_NOT_READY');
      }

      const requiredEquipment = Array.isArray(requiredEquipmentByJob[jobId])
        ? requiredEquipmentByJob[jobId].map((tag: any) => toLower(tag))
        : [];
      const missingEquipment = requiredEquipment.filter(
        (tag: string) => !vehicleEquipmentTags.includes(tag),
      );
      if (missingEquipment.length > 0) {
        reasonCodes.push('CONCRETE_EQUIPMENT_REQUIRED');
        details[`equipment_${jobId}`] = missingEquipment;
      }

      const requiredSkills = Array.isArray(requiredSkillsByJob[jobId])
        ? requiredSkillsByJob[jobId].map((tag: any) => toLower(tag))
        : [];
      const missingSkills = requiredSkills.filter((tag: string) => !driverTags.includes(tag));
      if (missingSkills.length > 0) {
        reasonCodes.push('CONCRETE_OPERATOR_SKILL_REQUIRED');
        details[`skills_${jobId}`] = missingSkills;
      }
    }

    const timing = buildConcreteTimingDiagnostics(ctx);
    if (timing.length > 0) {
      reasonCodes.push('CONCRETE_POUR_WINDOW_VIOLATION');
      details.concretePourWindowViolations = timing;
    }

    if (ctx.afterSnapshot?.dataQuality === 'simulated') {
      warnings.push('Concrete pack checks are based on simulated telemetry/planning quality.');
    }

    return {
      packId: 'construction_concrete',
      feasible: reasonCodes.length === 0,
      reasonCodes: Array.from(new Set(reasonCodes)),
      warnings,
      details,
    };
  },
};

