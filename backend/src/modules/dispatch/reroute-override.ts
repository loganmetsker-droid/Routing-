import { BadRequestException, ForbiddenException } from '@nestjs/common';

export type OverrideActorRole = 'admin' | 'dispatcher' | 'viewer' | 'unknown';

const DISALLOWED_OVERRIDE_REASON_CODES = new Set([
  'WORKFLOW_INCOMPATIBLE',
  'TARGET_ROUTE_NOT_FOUND',
  'TARGET_ROUTE_REQUIRED',
  'TARGET_ROUTE_INCOMPATIBLE',
  'JOB_DATA_MISSING',
]);

const DISPATCHER_ALLOWED_REASON_CODES = new Set([
  'CAPACITY_WEIGHT_EXCEEDED',
  'CAPACITY_VOLUME_EXCEEDED',
  'TIME_WINDOW_VIOLATION',
  'SKILL_MISMATCH',
  'CONCRETE_SITE_NOT_READY',
  'CONCRETE_EQUIPMENT_REQUIRED',
  'CONCRETE_OPERATOR_SKILL_REQUIRED',
  'CONCRETE_POUR_WINDOW_VIOLATION',
]);

export const validateRerouteOverride = (params: {
  overrideRequested: boolean;
  overrideReason?: string;
  overrideActorRole?: string;
  blockedReasonCodes?: string[];
}) => {
  if (!params.overrideRequested) return;
  const reason = String(params.overrideReason || '').trim();
  if (!reason) {
    throw new BadRequestException(
      'overrideReason is required when overrideRequested=true',
    );
  }
  if (reason.length < 8) {
    throw new BadRequestException(
      'overrideReason must be at least 8 characters',
    );
  }

  const actorRole = (params.overrideActorRole || 'unknown') as OverrideActorRole;
  if (actorRole === 'viewer' || actorRole === 'unknown') {
    throw new ForbiddenException(
      'Override denied by policy: actor role is not permitted',
    );
  }

  const reasonCodes = Array.isArray(params.blockedReasonCodes)
    ? params.blockedReasonCodes
    : [];
  const blockedByHardPolicy = reasonCodes.filter((code) =>
    DISALLOWED_OVERRIDE_REASON_CODES.has(code),
  );
  if (blockedByHardPolicy.length > 0) {
    throw new ForbiddenException(
      `Override denied by policy for reason codes: ${blockedByHardPolicy.join(', ')}`,
    );
  }

  if (actorRole === 'dispatcher') {
    const nonAllowed = reasonCodes.filter((code) => !DISPATCHER_ALLOWED_REASON_CODES.has(code));
    if (nonAllowed.length > 0) {
      throw new ForbiddenException(
        `Override denied by policy for dispatcher role: ${nonAllowed.join(', ')}`,
      );
    }
  }
};
