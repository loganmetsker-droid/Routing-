import { Route, RouteStatus } from './entities/route.entity';
import { Job } from '../jobs/entities/job.entity';
import { Vehicle } from '../vehicles/entities/vehicle.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { RerouteAction } from './entities/reroute-request.entity';
import {
  getConstraintPack,
  getRegisteredConstraintPacks,
  PackDiagnostics,
  registerConstraintPack,
} from './constraint-packs';
import { constructionConcretePack } from './packs/construction-concrete.pack';

export type RerouteDiagnosticReasonCode =
  | 'WORKFLOW_INCOMPATIBLE'
  | 'CAPACITY_WEIGHT_EXCEEDED'
  | 'CAPACITY_VOLUME_EXCEEDED'
  | 'TIME_WINDOW_VIOLATION'
  | 'SKILL_MISMATCH'
  | 'TARGET_ROUTE_REQUIRED'
  | 'TARGET_ROUTE_NOT_FOUND'
  | 'TARGET_ROUTE_INCOMPATIBLE'
  | 'JOB_DATA_MISSING'
  | 'CONCRETE_SITE_NOT_READY'
  | 'CONCRETE_EQUIPMENT_REQUIRED'
  | 'CONCRETE_OPERATOR_SKILL_REQUIRED'
  | 'CONCRETE_POUR_WINDOW_VIOLATION';

type TimeWindowViolation = {
  jobId: string;
  eta: string;
  windowStart: string;
  windowEnd: string;
  latenessMinutes: number;
};

type SkillMismatch = {
  jobId: string;
  requiredSkills: string[];
  availableSkills: string[];
};

type CapacityConflict = {
  metric: 'weight_kg' | 'volume_m3';
  demand: number;
  capacity: number;
  overBy: number;
};

export type RerouteConstraintDiagnostics = {
  feasible: boolean;
  reasonCodes: RerouteDiagnosticReasonCode[];
  infeasibleJobReasonCodes: Record<string, RerouteDiagnosticReasonCode[]>;
  impactedJobIds: string[];
  impactedStopIds: string[];
  capacityConflicts: CapacityConflict[];
  timeWindowViolations: TimeWindowViolation[];
  skillMismatches: SkillMismatch[];
  warnings: string[];
  selectedPackId: string | null;
  packDiagnostics: PackDiagnostics[];
  feasibilityScore: number;
  conflictSummary: {
    critical: number;
    major: number;
    minor: number;
    total: number;
  };
};

export type ReroutePreviewAlternative = {
  action: RerouteAction;
  label: string;
  summary: string;
  feasible: boolean;
  score: number;
  rank: number;
  rationale: string;
  tradeoffs: string[];
};

const round2 = (n: number) => Number(n.toFixed(2));

const REASON_CODE_PENALTIES: Record<string, number> = {
  WORKFLOW_INCOMPATIBLE: 100,
  TARGET_ROUTE_REQUIRED: 80,
  TARGET_ROUTE_NOT_FOUND: 80,
  TARGET_ROUTE_INCOMPATIBLE: 70,
  JOB_DATA_MISSING: 60,
  CAPACITY_WEIGHT_EXCEEDED: 35,
  CAPACITY_VOLUME_EXCEEDED: 35,
  TIME_WINDOW_VIOLATION: 30,
  SKILL_MISMATCH: 25,
  CONCRETE_SITE_NOT_READY: 35,
  CONCRETE_EQUIPMENT_REQUIRED: 25,
  CONCRETE_OPERATOR_SKILL_REQUIRED: 20,
  CONCRETE_POUR_WINDOW_VIOLATION: 25,
};

const toConflictBucket = (reasonCode: string): 'critical' | 'major' | 'minor' => {
  const penalty = REASON_CODE_PENALTIES[reasonCode] || 10;
  if (penalty >= 70) return 'critical';
  if (penalty >= 30) return 'major';
  return 'minor';
};

const computeFeasibilityScore = (reasonCodes: string[]) => {
  const totalPenalty = reasonCodes.reduce(
    (sum, code) => sum + (REASON_CODE_PENALTIES[code] || 10),
    0,
  );
  return Math.max(0, 100 - totalPenalty);
};

registerConstraintPack(constructionConcretePack);

const pushJobReason = (
  bag: Record<string, RerouteDiagnosticReasonCode[]>,
  jobId: string,
  code: RerouteDiagnosticReasonCode,
) => {
  if (!bag[jobId]) bag[jobId] = [];
  if (!bag[jobId].includes(code)) bag[jobId].push(code);
};

export const evaluateRerouteConstraints = (input: {
  route: Pick<Route, 'id' | 'status' | 'routeData'>;
  action: RerouteAction;
  payload?: Record<string, any>;
  beforeSnapshot: { jobIds?: string[] };
  afterSnapshot: { jobIds?: string[]; dataQuality?: string };
  jobs: Job[];
  vehicle: Vehicle | null;
  driver: Driver | null;
  targetRoute?: Pick<Route, 'id' | 'status'> | null;
}): RerouteConstraintDiagnostics => {
  const beforeJobIds = Array.isArray(input.beforeSnapshot?.jobIds)
    ? input.beforeSnapshot.jobIds
    : [];
  const afterJobIds = Array.isArray(input.afterSnapshot?.jobIds)
    ? input.afterSnapshot.jobIds
    : [];
  const impactedJobIds = Array.from(new Set([...beforeJobIds, ...afterJobIds]));
  const jobById = new Map(input.jobs.map((job) => [job.id, job]));
  const reasonCodes: RerouteDiagnosticReasonCode[] = [];
  const infeasibleJobReasonCodes: Record<string, RerouteDiagnosticReasonCode[]> = {};
  const capacityConflicts: CapacityConflict[] = [];
  const timeWindowViolations: TimeWindowViolation[] = [];
  const skillMismatches: SkillMismatch[] = [];
  const warnings: string[] = [];

  const addReason = (code: RerouteDiagnosticReasonCode) => {
    if (!reasonCodes.includes(code)) reasonCodes.push(code);
  };

  if (
    input.route.status === RouteStatus.COMPLETED ||
    input.route.status === RouteStatus.CANCELLED
  ) {
    addReason('WORKFLOW_INCOMPATIBLE');
  }

  if (input.action === 'reassign_stop_to_route') {
    if (!input.payload?.targetRouteId || typeof input.payload.targetRouteId !== 'string') {
      addReason('TARGET_ROUTE_REQUIRED');
    } else if (!input.targetRoute) {
      addReason('TARGET_ROUTE_NOT_FOUND');
    } else if (
      input.targetRoute.status === RouteStatus.COMPLETED ||
      input.targetRoute.status === RouteStatus.CANCELLED
    ) {
      addReason('TARGET_ROUTE_INCOMPATIBLE');
    }
  }

  const afterJobs = afterJobIds.map((jobId) => jobById.get(jobId)).filter(Boolean) as Job[];
  const missingJobs = afterJobIds.filter((jobId) => !jobById.has(jobId));
  if (missingJobs.length > 0) {
    addReason('JOB_DATA_MISSING');
    missingJobs.forEach((jobId) => pushJobReason(infeasibleJobReasonCodes, jobId, 'JOB_DATA_MISSING'));
  }

  if (input.vehicle) {
    const totalWeight = round2(
      afterJobs.reduce((sum, job) => sum + Number(job.weight || 0), 0),
    );
    const totalVolume = round2(
      afterJobs.reduce((sum, job) => sum + Number(job.volume || 0), 0),
    );
    const weightCapacity = Number(input.vehicle.capacityWeightKg || 0);
    const volumeCapacity = Number(input.vehicle.capacityVolumeM3 || 0);

    if (weightCapacity > 0 && totalWeight > weightCapacity) {
      addReason('CAPACITY_WEIGHT_EXCEEDED');
      capacityConflicts.push({
        metric: 'weight_kg',
        demand: totalWeight,
        capacity: weightCapacity,
        overBy: round2(totalWeight - weightCapacity),
      });
      afterJobs.forEach((job) =>
        pushJobReason(infeasibleJobReasonCodes, job.id, 'CAPACITY_WEIGHT_EXCEEDED'),
      );
    }

    if (volumeCapacity > 0 && totalVolume > volumeCapacity) {
      addReason('CAPACITY_VOLUME_EXCEEDED');
      capacityConflicts.push({
        metric: 'volume_m3',
        demand: totalVolume,
        capacity: volumeCapacity,
        overBy: round2(totalVolume - volumeCapacity),
      });
      afterJobs.forEach((job) =>
        pushJobReason(infeasibleJobReasonCodes, job.id, 'CAPACITY_VOLUME_EXCEEDED'),
      );
    }
  }

  const defaultServiceDurationMin = Math.max(
    1,
    Number(input.payload?.defaultServiceDurationMinutes || 20),
  );
  const travelBufferMin = Math.max(0, Number(input.payload?.travelBufferMinutes || 12));
  let clock = input.payload?.plannedStart
    ? new Date(input.payload.plannedStart)
    : new Date();

  afterJobs.forEach((job) => {
    const serviceDuration = Math.max(1, Number(job.estimatedDuration || defaultServiceDurationMin));
    const eta = new Date(clock.getTime() + travelBufferMin * 60000);
    const windowStart = job.timeWindowStart ? new Date(job.timeWindowStart) : null;
    const windowEnd = job.timeWindowEnd ? new Date(job.timeWindowEnd) : null;

    if (windowStart && eta < windowStart) {
      clock = new Date(windowStart);
    } else {
      clock = eta;
    }

    if (windowEnd && clock > windowEnd) {
      const latenessMinutes = Math.max(
        0,
        Math.round((clock.getTime() - windowEnd.getTime()) / 60000),
      );
      addReason('TIME_WINDOW_VIOLATION');
      timeWindowViolations.push({
        jobId: job.id,
        eta: clock.toISOString(),
        windowStart: windowStart ? windowStart.toISOString() : '',
        windowEnd: windowEnd.toISOString(),
        latenessMinutes,
      });
      pushJobReason(infeasibleJobReasonCodes, job.id, 'TIME_WINDOW_VIOLATION');
    }

    clock = new Date(clock.getTime() + serviceDuration * 60000);
  });

  const requiredSkillsByJob = input.payload?.requiredSkillsByJob || {};
  const availableSkills = (input.driver?.certifications || []).map((s) =>
    String(s).toLowerCase(),
  );
  Object.entries(requiredSkillsByJob).forEach(([jobId, rawSkills]) => {
    if (!Array.isArray(rawSkills) || rawSkills.length === 0) return;
    if (!afterJobIds.includes(jobId)) return;
    const requiredSkills = rawSkills.map((s: any) => String(s).toLowerCase());
    const missing = requiredSkills.filter((skill) => !availableSkills.includes(skill));
    if (missing.length === 0) return;
    addReason('SKILL_MISMATCH');
    skillMismatches.push({
      jobId,
      requiredSkills,
      availableSkills,
    });
    pushJobReason(infeasibleJobReasonCodes, jobId, 'SKILL_MISMATCH');
  });

  if (input.afterSnapshot?.dataQuality === 'simulated') {
    warnings.push('Preview/apply uses simulated planning quality; validate before dispatch.');
  } else if (input.afterSnapshot?.dataQuality === 'degraded') {
    warnings.push('Preview/apply indicates degraded planning quality.');
  }

  const selectedPackId =
    typeof input.payload?.constraintPackId === 'string'
      ? input.payload.constraintPackId
      : null;
  const packDiagnostics: PackDiagnostics[] = [];
  const packsToRun = selectedPackId
    ? [getConstraintPack(selectedPackId)].filter(Boolean)
    : getRegisteredConstraintPacks();

  packsToRun.forEach((pack) => {
    if (!pack) return;
    const ctx = {
      route: input.route,
      action: input.action,
      payload: input.payload,
      beforeSnapshot: input.beforeSnapshot,
      afterSnapshot: input.afterSnapshot,
      jobs: input.jobs,
      vehicle: input.vehicle,
      driver: input.driver,
    };
    if (!pack.applies(ctx as any)) return;
    const result = pack.evaluate(ctx as any);
    packDiagnostics.push(result);
    result.reasonCodes.forEach((code) => addReason(code as RerouteDiagnosticReasonCode));
    result.warnings.forEach((warning) => warnings.push(warning));
  });

  return {
    feasible: reasonCodes.length === 0,
    reasonCodes,
    infeasibleJobReasonCodes,
    impactedJobIds,
    impactedStopIds: impactedJobIds,
    capacityConflicts,
    timeWindowViolations,
    skillMismatches,
    warnings: Array.from(new Set(warnings)),
    selectedPackId,
    packDiagnostics,
    feasibilityScore: computeFeasibilityScore(reasonCodes),
    conflictSummary: reasonCodes.reduce(
      (acc, code) => {
        const bucket = toConflictBucket(code);
        acc[bucket] += 1;
        acc.total += 1;
        return acc;
      },
      { critical: 0, major: 0, minor: 0, total: 0 },
    ),
  };
};

export const buildRerouteAlternatives = (
  action: RerouteAction,
  diagnostics: RerouteConstraintDiagnostics,
  impactSummary?: {
    distanceDeltaKm?: number;
    durationDeltaMinutes?: number;
    droppedJobs?: string[];
  } | null,
): ReroutePreviewAlternative[] => {
  const hasCapacity = diagnostics.reasonCodes.includes('CAPACITY_WEIGHT_EXCEEDED') ||
    diagnostics.reasonCodes.includes('CAPACITY_VOLUME_EXCEEDED');
  const hasTimeWindow = diagnostics.reasonCodes.includes('TIME_WINDOW_VIOLATION');
  const hasSkills = diagnostics.reasonCodes.includes('SKILL_MISMATCH');

  const droppedJobs = impactSummary?.droppedJobs?.length || 0;
  const distancePenalty = Math.max(0, Number(impactSummary?.distanceDeltaKm || 0)) * 1.2;
  const durationPenalty = Math.max(0, Number(impactSummary?.durationDeltaMinutes || 0)) * 0.4;
  const base = Math.max(
    0,
    diagnostics.feasibilityScore - distancePenalty - durationPenalty - droppedJobs * 12,
  );
  const candidates: Omit<ReroutePreviewAlternative, 'rank'>[] = [
    {
      action,
      label: 'keep_current_route',
      summary: 'Keep route unchanged and monitor exception.',
      feasible: true,
      score: Math.max(0, Math.round(base - 6)),
      rationale: 'Lowest operational churn with immediate continuity.',
      tradeoffs: ['Exception remains active until manually resolved.'],
    },
    {
      action: 'reorder_stops',
      label: 'reorder_only',
      summary: 'Reorder current stops to reduce delay risk.',
      feasible: !hasCapacity,
      score: Math.max(0, Math.round(base + (hasTimeWindow ? 10 : 2) - (hasCapacity ? 25 : 0))),
      rationale: 'Improves sequencing without cross-route coordination.',
      tradeoffs: ['May not solve hard capacity constraints.'],
    },
    {
      action: 'split_route',
      label: 'split_route',
      summary: 'Split route to reduce load and time-window pressure.',
      feasible: hasCapacity || hasTimeWindow,
      score: Math.max(0, Math.round(base + (hasCapacity || hasTimeWindow ? 14 : -8))),
      rationale: 'Reduces per-route burden and isolates late segments.',
      tradeoffs: ['Introduces additional route/driver coordination.'],
    },
    {
      action: 'reassign_stop_to_route',
      label: 'move_stop_to_other_route',
      summary: 'Move one or more stops to another compatible route.',
      feasible: !hasSkills,
      score: Math.max(0, Math.round(base + (hasCapacity ? 12 : 4) - (hasSkills ? 18 : 0))),
      rationale: 'Balances load across routes when alternatives exist.',
      tradeoffs: ['Requires target route compatibility and capacity.'],
    },
    {
      action: 'hold_stop',
      label: 'hold_or_remove_stop',
      summary: 'Temporarily hold or remove a stop to preserve route feasibility.',
      feasible: diagnostics.impactedJobIds.length > 0,
      score: Math.max(0, Math.round(base - 10 - droppedJobs * 8)),
      rationale: 'Fastest way to restore short-term feasibility.',
      tradeoffs: ['Defers customer commitment and may increase backlog.'],
    },
  ];

  const sorted = candidates
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .map((alt, idx) => ({ ...alt, rank: idx + 1 }));
  return sorted;
};
